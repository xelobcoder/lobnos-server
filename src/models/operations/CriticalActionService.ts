import { decrypt_value } from "../../utils/encryptionModels";
import ResultSettings from "../application/appsettings/result-settings/resultSettings";
import { z } from "zod";
import {
     evaluateConditionRuleAgainstValue,
     normalizeParameterName,
     buildCriticalAlertStatement,
     normalizeConstraintType,
} from "../creator/criticalValueAnalyzer";
import { controlsFail, labSupervisor, assertLabTestAccess, scopeLabWork } from "./LabAccessPolicy";
import type { AuthUser } from "../../middleware/authority";

export const criticalActions = z.object({
     acknowledge: z.boolean().default(false),
     communicate: z.boolean().default(false),
     hold_print: z.boolean().default(false),
     hold_release: z.boolean().default(false),
     supervisor_clearance: z.boolean().default(false),
});
export const readJson = (value: any) => (typeof value === "string" ? JSON.parse(value) : value || {});
export async function controlAudit(
     db: any,
     actor: number,
     entity: string,
     id: number,
     action: string,
     reason: string,
     metadata: any = {},
) {
     await db("lab_control_audit").insert({
          entity,
          entity_id: id,
          action,
          employeeid: actor,
          reason,
          metadata: JSON.stringify(metadata),
          created_at: new Date(),
     });
}
export function criticalHoldApplies(event: any, channel: "print" | "release") {
     if (event.resolved_at) return false;
     const policy = readJson(event.policy_snapshot);
     return channel === "print" ? Boolean(policy.hold_print) : Boolean(policy.hold_release);
}
export async function assertCriticalRelease(db: any, ascensionid: number, channel: "print" | "release") {
     const events = await db("lab_critical_events").where({ ascensionid }).whereNull("resolved_at");
     if (events.some((event: any) => criticalHoldApplies(event, channel)))
          return controlsFail(
               `Critical-result ${channel === "print" ? "printing" : "release"} hold: complete the required critical-value actions`,
               409,
          );
}
/** Runs in the same transaction as result values and revision invalidation. Failures roll back the save. */
export async function evaluateCriticalActions(
     trx: any,
     context: { testid: number; ascensionid: number; billingid: number; employeeid: number },
     fields: any[],
) {
     const rules = await trx("testconditions as rule")
          .leftJoin("testconditiondefinitions as definition", "definition.id", "rule.conditionId")
          .leftJoin("lab_critical_policies as policy", "policy.rule_id", "rule.id")
          .where("rule.testId", context.testid)
          .select("rule.*", "definition.conditionName", "policy.actions");
     const stored = await trx("test_results")
          .where({ ascensionid: context.ascensionid, testid: context.testid })
          .select("field", "fieldid", "value", "originalvalue");
     const effectiveFields = stored.length
          ? stored.map((row: any) => ({
                 field: row.field,
                 fieldid: row.fieldid,
                 value: decrypt_value(row.originalvalue || row.value),
            }))
          : fields;
     const approval = await trx("dbotestresultapproval").where({ ascensionid: context.ascensionid }).first();
     for (const rule of rules) {
          const field = effectiveFields.find(
               (item) => normalizeParameterName(item.field) === normalizeParameterName(rule.parameter),
          );
          if (
               !field ||
               field.value == null ||
               field.value === "" ||
               !evaluateConditionRuleAgainstValue(rule, field.value)
          )
               continue;
          const policy = criticalActions.parse(readJson(rule.actions));
          const statement = buildCriticalAlertStatement(field.field, field.value, rule);
          const [legacyId] = await trx("loggingcriticalvaluealert").insert({
               billingid: context.billingid,
               testid: context.testid,
               ascensionid: context.ascensionid,
               constraint_type: normalizeConstraintType(rule.conditionConstraint) || "null",
               statement,
               createdBy: context.employeeid,
               isSeen: 0,
          });
          const [eventId] = await trx("lab_critical_events").insert({
               testid: context.testid,
               billingid: context.billingid,
               ascensionid: context.ascensionid,
               created_by: context.employeeid,
               legacy_alert_id: legacyId,
               revision: Number(approval?.approval_revision || 0),
               rule_id: rule.id,
               statement,
               policy_snapshot: JSON.stringify(policy),
               created_at: new Date(),
          });
          await trx("in_app_notifications").insert({
               event_code: "CRITICAL_RESULT",
               module: "result",
               title: "CRITICAL RESULT REQUIRES REVIEW",
               message: "A laboratory critical-value event requires authorized review.",
               priority: "critical",
               reference_type: "critical_event",
               reference_id: eventId,
               actor_employeeid: context.employeeid,
               action_url: `/operations/laboratory/criticalvaluesAlert?event=${eventId}`,
               created_at: new Date(),
          });
     }
}
export class CriticalActionService {
     constructor(private db: any) {}
     async policies(actor: AuthUser, testid: number) {
          if (!labSupervisor(actor)) return controlsFail("Only supervisors may configure critical actions", 403);
          return this.db("testconditions as rule")
               .leftJoin("testconditiondefinitions as definition", "definition.id", "rule.conditionId")
               .leftJoin("lab_critical_policies as policy", "policy.rule_id", "rule.id")
               .where("rule.testId", testid)
               .select("rule.*", "definition.conditionName", "policy.actions", "policy.version");
     }
     async savePolicy(actor: AuthUser, testid: number, ruleId: number, input: any) {
          if (!labSupervisor(actor)) return controlsFail("Only supervisors may configure critical actions", 403);
          const data = z
               .object({
                    actions: criticalActions,
                    version: z.number().int().min(0),
                    reason: z.string().trim().min(3).max(2000),
               })
               .parse(input);
          return this.db.transaction(async (trx: any) => {
               if (!(await trx("testconditions").where({ id: ruleId, testId: testid }).forUpdate().first()))
                    return controlsFail("Critical rule not found", 404);
               const old = await trx("lab_critical_policies").where({ rule_id: ruleId }).first();
               if (Number(old?.version || 0) !== data.version)
                    return controlsFail("Critical rule changed. Reload before saving.", 409);
               const row = {
                    rule_id: ruleId,
                    testid,
                    actions: JSON.stringify(data.actions),
                    version: data.version + 1,
                    updated_by: actor.employeeid,
                    updated_at: new Date(),
               };
               if (old) await trx("lab_critical_policies").where({ rule_id: ruleId }).update(row);
               else await trx("lab_critical_policies").insert(row);
               await controlAudit(trx, actor.employeeid, "critical_policy", ruleId, "updated", data.reason, {
                    before: old,
                    after: row,
               });
               return row;
          });
     }
     private async scoped(actor: AuthUser) {
          let q = this.db("lab_critical_events as event")
               .join("billing as bill", "bill.billingid", "event.billingid")
               .join("new_patients as patient", "patient.patientid", "bill.patientid")
               .join("test_panels as panel", "panel.id", "event.testid");
          if (actor.branch != null) q.where("bill.branchid", actor.branch);
          await scopeLabWork(q, this.db, actor, "event.ascensionid");
          return { query: q };
     }
     async list(actor: AuthUser, input: any) {
          const page = z.coerce
                    .number()
                    .int()
                    .min(1)
                    .parse(input.page || 1),
               count = 25;
          const { query } = await this.scoped(actor);
          if (input.status !== "all")
               input.status === "resolved"
                    ? query.whereNotNull("event.resolved_at")
                    : query.whereNull("event.resolved_at");
          if (input.search)
               query.where((q: any) =>
                    q
                         .where("patient.fullpatientid", "like", `%${String(input.search).slice(0, 80)}%`)
                         .orWhere("panel.name", "like", `%${String(input.search).slice(0, 80)}%`)
                         .orWhere("patient.lastname", "like", `%${String(input.search).slice(0, 80)}%`),
               );
          if (input.held === "true")
               query.whereRaw(
                    "(JSON_EXTRACT(event.policy_snapshot, '$.hold_print') = true OR JSON_EXTRACT(event.policy_snapshot, '$.hold_release') = true)",
               );
          const total = Number((await query.clone().count("* as count").first())?.count || 0);
          const data = await query
               .select(
                    "event.*",
                    "panel.name as test_name",
                    "patient.fullpatientid",
                    this.db.raw("CONCAT_WS(' ', patient.firstname, patient.lastname) as patient_name"),
               )
               .orderByRaw("event.resolved_at IS NULL DESC")
               .orderBy("event.created_at", "asc")
               .limit(count)
               .offset((page - 1) * count);
          return { data, total, page, count };
     }
     async detail(actor: AuthUser, id: number) {
          const row = await (await this.scoped(actor)).query
               .where("event.id", id)
               .select(
                    "event.*",
                    "panel.name as test_name",
                    "patient.fullpatientid",
                    this.db.raw("CONCAT_WS(' ', patient.firstname, patient.lastname) as patient_name"),
               )
               .first();
          if (!row) return controlsFail("Critical event not found in your scope", 404);
          const current = row.ascensionid
               ? await this.db("dbotestresultapproval").where({ ascensionid: row.ascensionid }).first()
               : null;
          return {
               ...row,
               current_revision: current?.approval_revision,
               audit: await this.db("lab_control_audit")
                    .where({ entity: "critical_event", entity_id: id })
                    .orderBy("id", "desc"),
          };
     }
     async act(actor: AuthUser, id: number, input: any) {
          const data = z
               .object({
                    action: z.enum(["acknowledge", "communicate", "resolve"]),
                    version: z.number().int().positive(),
                    reason: z.string().trim().min(3).max(2000),
                    confirmed: z.boolean().optional(),
                    recipient: z.string().trim().max(150).optional(),
                    method: z.enum(["phone", "in_person", "secure_message"]).optional(),
                    outcome: z.string().trim().max(1000).optional(),
               })
               .parse(input);
          await this.detail(actor, id);
          return this.db.transaction(async (trx: any) => {
               const before = await trx("lab_critical_events").where({ id }).forUpdate().first();
               if (Number(before.version) !== data.version || before.resolved_at)
                    return controlsFail("Event changed or is already resolved. Reload.", 409);
               const policy = readJson(before.policy_snapshot);
               const changes: any = { version: data.version + 1 };
               if (data.action === "acknowledge")
                    Object.assign(changes, { acknowledged_at: new Date(), acknowledged_by: actor.employeeid });
               if (data.action === "communicate") {
                    if (!data.recipient || !data.method || !data.outcome)
                         return controlsFail("Record the recipient, communication method and outcome");
                    Object.assign(changes, {
                         communication: JSON.stringify({
                              recipient: data.recipient,
                              method: data.method,
                              outcome: data.outcome,
                              confirmed: !!data.confirmed,
                         }),
                    });
                    if (data.confirmed)
                         Object.assign(changes, { communicated_at: new Date(), communicated_by: actor.employeeid });
               }
               if (data.action === "resolve") {
                    if (policy.supervisor_clearance && !labSupervisor(actor))
                         return controlsFail("A supervisor must clear this critical hold", 403);
                    if (
                         (policy.hold_print || policy.hold_release) &&
                         !labSupervisor(actor) &&
                         !(await ResultSettings.canStaffApproveResult(actor.tenantId, actor.employeeid))
                    )
                         return controlsFail("An authorized result validator must clear this hold", 403);
                    if (policy.acknowledge && !before.acknowledged_at)
                         return controlsFail("Acknowledge this finding first");
                    if (policy.communicate && !before.communicated_at)
                         return controlsFail("Record clinician communication first");
                    Object.assign(changes, {
                         resolved_at: new Date(),
                         resolved_by: actor.employeeid,
                         resolution: data.reason,
                    });
               }
               await trx("lab_critical_events").where({ id }).update(changes);
               if (data.action === "acknowledge" && before.legacy_alert_id)
                    await trx("loggingcriticalvaluealert")
                         .where({ crkeyId: before.legacy_alert_id })
                         .update({ isSeen: 1, isSeenBy: actor.employeeid });
               await controlAudit(trx, actor.employeeid, "critical_event", id, data.action, data.reason, {
                    before,
                    changes,
               });
               return changes;
          });
     }
}
