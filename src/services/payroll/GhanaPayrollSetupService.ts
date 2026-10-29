import { createHash } from "crypto";
import { z } from "zod";
import KnexConnection from "../../database/KnexConnections";
import { roleAllowed } from "../../middleware/roles";
import { ensureGhanaPayrollSchema, ensureGhanaPayeRecord } from "../../models/payroll/GhanaPayrollSchema";
import { GHANA_RULE, ghanaRuleFor, ghanaManagedDeduction, calculateGhanaPayroll, money } from "./GhanaPayrollRules";
const date = z
     .string()
     .regex(/^\d{4}-\d{2}-\d{2}$/)
     .refine(
          (value) => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value,
          "Invalid date",
     );
const setupDto = z
     .object({
          country: z.literal("GH"),
          effectiveFrom: date.refine((value) => value.endsWith("-01"), "Select the first day of a payroll month"),
          defaultResidency: z.enum(["resident", "nonresident"]),
          ssnitEmployerNumber: z.string().trim().min(1).max(100),
          tier2Provider: z.string().trim().min(1).max(150),
          version: z.number().int().min(0),
     })
     .strict();
export const ghanaProfileDto = z
     .object({
          tax_year: z.literal(2026),
          residency: z.enum(["resident", "nonresident"]),
          dependents_count: z.number().int().min(0).max(30),
          pension_exempt: z.boolean(),
          pension_exemption_reason: z.string().trim().max(250).default(""),
          tax_exempt: z.boolean(),
          tax_exemption_reason: z.string().trim().max(250).default(""),
          approved_monthly_relief: z.number().min(0).max(1000000),
          relief_reference: z.string().trim().max(250).default(""),
          annual_basic_for_bonus: z.number().positive().max(100000000).nullable(),
          opening_taxable_bonus: z.number().min(0).max(100000000),
          bonus_history_reviewed: z.boolean(),
          junior_overtime_eligible: z.boolean(),
          annual_qualifying_income: z.number().min(0).max(100000000).nullable(),
     })
     .strict()
     .superRefine((value, ctx) => {
          for (const [condition, field] of [
               [value.pension_exempt, "pension_exemption_reason"],
               [value.tax_exempt, "tax_exemption_reason"],
               [value.approved_monthly_relief > 0, "relief_reference"],
          ] as const)
               if (condition && !value[field])
                    ctx.addIssue({
                         code: "custom",
                         path: [field],
                         message: "An approval reference or exemption reason is required",
                    });
          if (value.bonus_history_reviewed && !value.annual_basic_for_bonus)
               ctx.addIssue({
                    code: "custom",
                    path: ["annual_basic_for_bonus"],
                    message: "Confirm annual basic salary for bonus treatment",
               });
          if (
               value.junior_overtime_eligible &&
               (!value.annual_qualifying_income || value.annual_qualifying_income > 18000)
          )
               ctx.addIssue({
                    code: "custom",
                    path: ["annual_qualifying_income"],
                    message: "Junior overtime requires verified annual qualifying income of at most GHS 18,000",
               });
     });
const hash = (value: any) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const parseIds = (value: any): number[] => (typeof value === "string" ? JSON.parse(value) : value || []);
export class GhanaPayrollSetupService {
     constructor(
          private tenantId: number,
          private suppliedDb?: any,
     ) {}
     async db(actor: any) {
          if (!actor || Number(actor.tenantId) !== this.tenantId || !roleAllowed(actor.role, ["admin", "accountant"]))
               throw Object.assign(new Error("Payroll configuration permission is required"), { statusCode: 403 });
          return this.suppliedDb || KnexConnection(this.tenantId);
     }
     async conflicts(db: any) {
          const definitions = await db("payroll_deduction_definitions")
               .where({ is_active: true })
               .select("id", "deduction_code", "deduction_name", "is_statutory")
               .orderBy("id");
          const other = await db("payroll_employee_other_deductions")
               .where({ is_active: true })
               .select("id", "employeeid", "deduction_definition_id", "deduction_type", "deduction_name")
               .orderBy("id");
          return {
               definitions: definitions.filter(ghanaManagedDeduction),
               other: other.filter(
                    (row: any) =>
                         ghanaManagedDeduction(row) ||
                         definitions.some(
                              (definition: any) =>
                                   ghanaManagedDeduction(definition) &&
                                   Number(definition.id) === Number(row.deduction_definition_id),
                         ),
               ),
          };
     }
     async read(actor: any) {
          const db = await this.db(actor);
          await ensureGhanaPayrollSchema(db);
          const settings = await db("payroll_country_setup").where({ id: 1 }).first();
          return {
               settings,
               rule: GHANA_RULE,
               conflicts: await this.conflicts(db),
               employees: await db("roles")
                    .join(
                         "payroll_employee_compensation as compensation",
                         "roles.employeeid",
                         "compensation.employeeid",
                    )
                    .where("compensation.is_active", true)
                    .distinct("roles.employeeid", "roles.firstname", "roles.lastname", "roles.username")
                    .orderBy("roles.employeeid"),
          };
     }
     async preview(input: unknown, actor: any) {
          const dto = setupDto.parse(input);
          ghanaRuleFor(dto.effectiveFrom);
          const db = await this.db(actor);
          await ensureGhanaPayrollSchema(db);
          const current = await db("payroll_country_setup").where({ id: 1 }).first();
          if (Number(current.version) !== dto.version)
               throw Object.assign(new Error("Payroll setup changed. Reload before reviewing."), { statusCode: 409 });
          const conflicts = await this.conflicts(db);
          const review = { ...dto, rule: GHANA_RULE, conflicts };
          return {
               ...review,
               fingerprint: hash(review),
               example: calculateGhanaPayroll({
                    date: dto.effectiveFrom,
                    basic: 3000,
                    regularTaxable: 3000,
                    gross: 3000,
                    bonus: 0,
                    overtime: 0,
                    profile: { residency: dto.defaultResidency },
               }),
          };
     }
     async save(input: any, actor: any) {
          const { fingerprint, confirmed, ...values } = z
               .object({
                    ...setupDto.shape,
                    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
                    confirmed: z.literal(true),
               })
               .strict()
               .parse(input);
          const db = await this.db(actor);
          await ensureGhanaPayrollSchema(db);
          return db.transaction(async (trx: any) => {
               await trx("payroll_country_setup").where({ id: 1 }).forUpdate().first();
               const review = await new GhanaPayrollSetupService(this.tenantId, trx).preview(values, actor);
               if (review.fingerprint !== fingerprint)
                    throw Object.assign(new Error("Payroll deductions or settings changed. Review the latest setup."), {
                         statusCode: 409,
                    });
               const taxConfigurationId = await ensureGhanaPayeRecord(trx, actor.employeeid);
               const snapshot = {
                    country: "GH",
                    tax_configuration_id: taxConfigurationId,
                    effective_from: values.effectiveFrom,
                    default_residency: values.defaultResidency,
                    ssnit_employer_number: values.ssnitEmployerNumber,
                    tier2_provider: values.tier2Provider,
                    managed_definitions: JSON.stringify(review.conflicts.definitions.map((r: any) => Number(r.id))),
                    managed_other_deductions: JSON.stringify(review.conflicts.other.map((r: any) => Number(r.id))),
                    version: values.version + 1,
                    updated_by: actor.employeeid,
               };
               await trx("payroll_country_setup")
                    .where({ id: 1 })
                    .update({ ...snapshot, updated_at: new Date() });
               await trx("payroll_country_setup_audit").insert({
                    action: "ghana_setup_saved",
                    snapshot: JSON.stringify({ ...snapshot, rule: GHANA_RULE }),
                    performed_by: actor.employeeid,
               });
               return { version: snapshot.version };
          });
     }
     async employee(employeeid: number, actor: any) {
          const db = await this.db(actor);
          if (!(await db("roles").where({ employeeid }).first()))
               throw Object.assign(new Error("Employee not found"), { statusCode: 404 });
          return {
               profile: (await db("payroll_ghana_profiles").where({ employeeid }).first()) || null,
               statutory: (await db("payroll_employee_statutory_deductions").where({ employeeid }).first()) || null,
          };
     }
     async saveEmployee(employeeid: number, input: any, actor: any) {
          const db = await this.db(actor);
          await this.employee(employeeid, actor);
          const dto = ghanaProfileDto.parse(input);
          return db.transaction(async (trx: any) => {
               await trx("payroll_ghana_profiles")
                    .insert({ ...dto, employeeid, updated_by: actor.employeeid })
                    .onConflict("employeeid")
                    .merge({ ...dto, updated_by: actor.employeeid, updated_at: new Date() });
               await trx("payroll_country_setup_audit").insert({
                    action: "ghana_profile_saved",
                    employeeid,
                    snapshot: JSON.stringify(dto),
                    performed_by: actor.employeeid,
               });
          });
     }
     async enabledForPeriod(date: string): Promise<boolean> {
          const db = this.suppliedDb || await KnexConnection(this.tenantId);
          if (!await db.schema.hasTable('payroll_country_setup')) return false;
          return !!await db('payroll_country_setup')
               .where({ id: 1, country: 'GH' })
               .where('effective_from', '<=', date)
               .first();
     }

     async calculate(input: any) {
          const db = this.suppliedDb || (await KnexConnection(this.tenantId));
          if (!(await db.schema.hasTable("payroll_country_setup"))) return null;
          const setup = await db("payroll_country_setup").where({ id: 1, country: "GH" }).first();
          if (!setup || input.period_start_date < String(setup.effective_from).slice(0, 10)) return null;
          const configuration = await db("payroll_tax_configuration")
               .where({ id: setup.tax_configuration_id, managed_by: "ghana_setup" })
               .first();
          if (!configuration)
               throw new Error("Ghana PAYE configuration is missing. Open the Ghana setup wizard to repair the link.");
          const rule = {
               ...JSON.parse(configuration.rule_snapshot),
               bands:
                    typeof configuration.tax_bands === "string"
                         ? JSON.parse(configuration.tax_bands)
                         : configuration.tax_bands,
               version: configuration.rule_version,
               effectiveFrom: configuration.effective_from,
               effectiveTo: configuration.effective_to,
          };
          ghanaRuleFor(input.period_start_date, rule);
          ghanaRuleFor(input.period_end_date, rule);
          const start = new Date(input.period_start_date + "T00:00:00Z"),
               end = new Date(input.period_end_date + "T00:00:00Z");
          if (
               start.getUTCDate() !== 1 ||
               end.getUTCMonth() !== start.getUTCMonth() ||
               end.getUTCDate() !==
                    new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate() ||
               input.compensation.payment_frequency !== "monthly" ||
               (input.compensation.currency && input.compensation.currency !== "GHS")
          )
               throw new Error(
                    "Ghana automatic payroll currently requires a full calendar month and GHS monthly compensation",
               );
          const profile = await db("payroll_ghana_profiles").where({ employeeid: input.employeeid }).first();
          const statutory =
               (await db("payroll_employee_statutory_deductions").where({ employeeid: input.employeeid }).first()) ||
               {};
          const configured = profile || { residency: setup.default_residency };
          if (profile && Number(profile.tax_year) !== start.getUTCFullYear())
               throw new Error("Review the employee Ghana tax profile for this tax year");
          const definitions = parseIds(setup.managed_definitions),
               other = parseIds(setup.managed_other_deductions);
          for (const row of input.definitionDetails)
               if (
                    ghanaManagedDeduction({ deduction_code: row.type, deduction_name: row.name }) &&
                    !definitions.includes(Number(row.definition_id))
               )
                    throw new Error("A new Ghana statutory deduction needs review in the setup wizard");
          for (const row of input.otherDetails)
               if (
                    ghanaManagedDeduction({ deduction_type: row.type, deduction_name: row.name }) &&
                    !other.includes(Number(row.id)) &&
                    !definitions.includes(Number(row.deduction_definition_id))
               )
                    throw new Error("A new employee statutory deduction needs review in the setup wizard");
          const keptDefinitions = input.definitionDetails.filter(
                    (row: any) => !definitions.includes(Number(row.definition_id)),
               ),
               keptOther = input.otherDetails.filter(
                    (row: any) =>
                         !other.includes(Number(row.id)) && !definitions.includes(Number(row.deduction_definition_id)),
               );
          const previous = await db("payroll_transactions as tx")
               .join("payroll_periods as period", "tx.payroll_period_id", "period.id")
               .where("tx.employeeid", input.employeeid)
               .whereNot("tx.status", "cancelled")
               .whereNot("tx.payroll_period_id", input.payroll_period_id)
               .where("period.period_start_date", ">=", setup.effective_from)
               .where("period.period_end_date", "<", input.period_start_date)
               .where("period.period_year", start.getUTCFullYear())
               .select("tx.bonuses_detail");
          let priorTaxableBonus = 0;
          for (const row of previous) {
               const detail =
                    typeof row.bonuses_detail === "string" ? JSON.parse(row.bonuses_detail) : row.bonuses_detail;
               for (const bonus of detail || []) if (bonus.is_taxable) priorTaxableBonus += Number(bonus.amount) || 0;
          }
          const result = calculateGhanaPayroll({
               date: input.period_end_date,
               basic: input.basic,
               regularTaxable: input.regularTaxable,
               bonus: input.bonus,
               overtime: input.overtime,
               gross: input.gross,
               profile: configured,
               statutory,
               priorTaxableBonus,
               rule,
          });
          return {
               ...result,
               taxConfigurationId: Number(configuration.id),
               setupVersion: Number(setup.version),
               keptDefinitions,
               keptOther,
               otherDeductions: money(
                    [...keptDefinitions, ...keptOther].reduce((sum, row) => sum + Number(row.amount), 0),
               ),
          };
     }
}
