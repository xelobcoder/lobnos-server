import { Knex } from 'knex';
import { systemConfigConnection } from '../../database/connection';
import KnexConnection from '../../database/KnexConnections';
import { FacilityError } from './FacilityInput';
import { FacilityManagementService } from './FacilityManagementService';
import { formatCents } from './FacilityManagementInput';
import {
     ensureFacilityModuleTable, FACILITY_MODULES, FacilityModule, FacilityModuleConfiguration, MODULE_CONFIG_TABLE,
     validateModuleConfiguration,
} from './FacilityModules';
import type { FacilityActor } from './FacilityProvisioningService';
import { TENANTS_TABLE, TenantRegistry } from './TenantRegistry';

export const FACILITY_SUBSCRIPTION_TIERS_TABLE = 'facility_subscription_tiers';
export const FACILITY_PLAN_UPGRADE_REQUESTS_TABLE = 'facility_plan_upgrade_requests';
const PLAN_CODE_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/;
const MAX_CENTS = 999_999_999_999;
const professionalModules: FacilityModule[] = [
     'inventory', 'email', 'sms', 'appointments', 'expenses', 'consultations',
];

export interface FacilitySubscriptionTier {
     code: string;
     name: string;
     description: string;
     currency: string;
     monthlyPrice: string;
     modules: FacilityModule[];
     branchMode: 'single' | 'multiple';
     rank: number;
     active: boolean;
}

export interface FacilityPlanUpgradeRequest {
     id: number;
     tenantId: number;
     fromPlanCode: string | null;
     toPlanCode: string;
     status: 'pending' | 'approved' | 'rejected';
     requestedAt: string;
     requestedByEmail: string;
     decidedAt: string | null;
     decisionReason: string | null;
     platformId?: string | null;
     organizationName?: string | null;
}

function validateCode(value: unknown): string {
     if (typeof value !== 'string' || !PLAN_CODE_PATTERN.test(value)) {
          throw new FacilityError('Plan code must match ^[a-z][a-z0-9_-]{1,31}$');
     }
     return value;
}

function priceCents(value: unknown): number {
     if (typeof value !== 'string' || !/^(0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value)) {
          throw new FacilityError('monthlyPrice must be a nonnegative decimal string with at most two decimal places');
     }
     const [whole, fraction = ''] = value.split('.');
     const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
     if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) throw new FacilityError('monthlyPrice exceeds the supported amount');
     return cents;
}

function validateCurrency(value: unknown): string {
     if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) {
          throw new FacilityError('currency must be three uppercase letters');
     }
     return value;
}

function validateModules(value: unknown): FacilityModule[] {
     if (!Array.isArray(value) || value.length === 0 ||
          value.some(module => typeof module !== 'string' || !(FACILITY_MODULES as readonly string[]).includes(module)) ||
          new Set(value).size !== value.length) {
          throw new FacilityError('modules must contain at least one unique supported facility module');
     }
     return [...value] as FacilityModule[];
}

export function validateFacilitySubscriptionTier(codeValue: unknown, value: unknown): FacilitySubscriptionTier {
     const code = validateCode(codeValue);
     if (!value || typeof value !== 'object' || Array.isArray(value)) throw new FacilityError('Plan details are required');
     const input = value as Record<string, unknown>;
     if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 60) {
          throw new FacilityError('name is required and must be at most 60 characters');
     }
     if (typeof input.description !== 'string' || input.description.length > 300) {
          throw new FacilityError('description must be a string of at most 300 characters');
     }
     const currency = validateCurrency(input.currency);
     const cents = priceCents(input.monthlyPrice);
     const modules = validateModules(input.modules);
     if (input.branchMode !== 'single' && input.branchMode !== 'multiple') {
          throw new FacilityError('branchMode must be single or multiple');
     }
     if (!Number.isSafeInteger(input.rank) || Number(input.rank) < -2_147_483_648 || Number(input.rank) > 2_147_483_647) {
          throw new FacilityError('rank must be a signed 32-bit integer');
     }
     if (typeof input.active !== 'boolean') throw new FacilityError('active must be a boolean');
     if (input.active && cents === 0) throw new FacilityError('A plan cannot be activated while monthlyPrice is 0');
     return {
          code, name: input.name.trim(), description: input.description, currency, monthlyPrice: formatCents(cents),
          modules, branchMode: input.branchMode, rank: Number(input.rank), active: input.active,
     };
}

function parseStoredModules(value: unknown): FacilityModule[] {
     let parsed = value;
     if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); }
          catch { throw new FacilityError('Stored plan modules are invalid', 409); }
     }
     try { return validateModules(parsed); }
     catch { throw new FacilityError('Stored plan modules are invalid', 409); }
}

function tierView(row: any): FacilitySubscriptionTier {
     const cents = priceCents(String(row.monthly_price));
     return {
          code: String(row.code), name: String(row.name), description: String(row.description ?? ''),
          currency: validateCurrency(row.currency), monthlyPrice: formatCents(cents), modules: parseStoredModules(row.modules),
          branchMode: row.branch_mode, rank: Number(row.rank), active: Number(row.active) === 1 || row.active === true,
     };
}

function timestamp(value: unknown): string {
     if (value instanceof Date) return value.toISOString();
     return String(value ?? '');
}

function requestView(row: any): FacilityPlanUpgradeRequest {
     return {
          id: Number(row.id), tenantId: Number(row.tenant_id), fromPlanCode: row.from_plan_code ?? null,
          toPlanCode: String(row.to_plan_code), status: row.status,
          requestedAt: timestamp(row.requested_at), requestedByEmail: String(row.requested_by_email),
          decidedAt: row.decided_at == null ? null : timestamp(row.decided_at),
          decisionReason: row.decision_reason ?? null,
     };
}

export async function ensureFacilitySubscriptionPlanTables(db: Knex): Promise<void> {
     if (!(await db.schema.hasTable(FACILITY_SUBSCRIPTION_TIERS_TABLE))) {
          try {
               await db.schema.createTable(FACILITY_SUBSCRIPTION_TIERS_TABLE, table => {
                    table.string('code', 32).primary();
                    table.string('name', 60).notNullable();
                    table.string('description', 300).notNullable();
                    table.string('currency', 3).notNullable();
                    table.decimal('monthly_price', 12, 2).notNullable();
                    table.json('modules').notNullable();
                    table.enu('branch_mode', ['single', 'multiple']).notNullable();
                    table.integer('rank').notNullable();
                    table.boolean('active').notNullable().defaultTo(false);
                    table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
                    table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
                    table.index(['currency', 'active', 'rank'], 'idx_facility_tiers_currency_active_rank');
               });
          } catch (error: any) {
               if (error?.code !== 'ER_TABLE_EXISTS_ERROR') throw error;
          }
     }
     const seeds: FacilitySubscriptionTier[] = [
          { code: 'basic', name: 'Basic', description: 'Essential laboratory modules', currency: 'GHS',
               monthlyPrice: '0.00', modules: ['inventory'], branchMode: 'single', rank: 1, active: false },
          { code: 'professional', name: 'Professional', description: 'Expanded laboratory operations', currency: 'GHS',
               monthlyPrice: '0.00', modules: professionalModules, branchMode: 'multiple', rank: 2, active: false },
          { code: 'enterprise', name: 'Enterprise', description: 'All available facility modules', currency: 'GHS',
               monthlyPrice: '0.00', modules: [...FACILITY_MODULES], branchMode: 'multiple', rank: 3, active: false },
     ];
     await db(FACILITY_SUBSCRIPTION_TIERS_TABLE).insert(seeds.map(plan => ({
          code: plan.code, name: plan.name, description: plan.description, currency: plan.currency,
          monthly_price: plan.monthlyPrice, modules: JSON.stringify(plan.modules), branch_mode: plan.branchMode,
          rank: plan.rank, active: false,
     }))).onConflict('code').ignore();

     if (!(await db.schema.hasTable(FACILITY_PLAN_UPGRADE_REQUESTS_TABLE))) {
          try {
               await db.schema.createTable(FACILITY_PLAN_UPGRADE_REQUESTS_TABLE, table => {
                    table.bigIncrements('id');
                    table.integer('tenant_id').unsigned().notNullable();
                    table.string('from_plan_code', 32).nullable();
                    table.string('to_plan_code', 32).notNullable();
                    table.enu('status', ['pending', 'approved', 'rejected']).notNullable().defaultTo('pending');
                    table.timestamp('requested_at').notNullable().defaultTo(db.fn.now());
                    table.string('requested_by_email', 200).notNullable();
                    table.timestamp('decided_at').nullable();
                    table.string('decision_reason', 500).nullable();
                    table.integer('decided_by_tenant_id').unsigned().nullable();
                    table.integer('decided_by_employee_id').unsigned().nullable();
                    table.index(['tenant_id', 'status', 'requested_at'], 'idx_facility_upgrade_tenant_status');
                    table.index(['status', 'requested_at'], 'idx_facility_upgrade_status_requested');
               });
          } catch (error: any) {
               if (error?.code !== 'ER_TABLE_EXISTS_ERROR') throw error;
          }
     }
}

export function buildPlanModuleConfiguration(plan: FacilitySubscriptionTier): FacilityModuleConfiguration {
     const enabled = new Set(plan.modules);
     const config = {
          branchMode: plan.branchMode, currency: plan.currency,
          modules: Object.fromEntries(FACILITY_MODULES.map(module => [module, {
               enabled: enabled.has(module), monthlyPrice: '0.00',
          }])) as FacilityModuleConfiguration['modules'],
          monthlyTotal: plan.monthlyPrice,
          plan: { code: plan.code, name: plan.name },
     };
     return validateModuleConfiguration(config)!;
}

export class FacilitySubscriptionTierService {
     private readonly management: FacilityManagementService;
     constructor(
          private master: Knex = systemConfigConnection,
          management?: FacilityManagementService,
     ) {
          this.management = management || new FacilityManagementService(master);
     }

     async ensureSchema(): Promise<void> {
          await ensureFacilitySubscriptionPlanTables(this.master);
     }

     async listPlans(): Promise<FacilitySubscriptionTier[]> {
          await this.ensureSchema();
          const rows = await this.master(FACILITY_SUBSCRIPTION_TIERS_TABLE).select()
               .orderBy('rank', 'asc').orderBy('code', 'asc');
          return rows.map(tierView);
     }

     async getPlan(codeValue: unknown, activeOnly = false): Promise<FacilitySubscriptionTier> {
          const code = validateCode(codeValue);
          await this.ensureSchema();
          const row = await this.master(FACILITY_SUBSCRIPTION_TIERS_TABLE).where({ code }).first();
          if (!row) throw new FacilityError('Subscription plan not found', activeOnly ? 400 : 404);
          const plan = tierView(row);
          if (activeOnly && !plan.active) throw new FacilityError('Subscription plan is inactive', 400);
          return plan;
     }

     async upsertPlan(codeValue: unknown, value: unknown, actor: FacilityActor): Promise<FacilitySubscriptionTier> {
          const plan = validateFacilitySubscriptionTier(codeValue, value);
          await this.ensureSchema();
          await this.management.ensureSchema();
          await this.master.transaction(async trx => {
               await trx(FACILITY_SUBSCRIPTION_TIERS_TABLE).insert({
                    code: plan.code, name: plan.name, description: plan.description, currency: plan.currency,
                    monthly_price: plan.monthlyPrice, modules: JSON.stringify(plan.modules), branch_mode: plan.branchMode,
                    rank: plan.rank, active: plan.active, updated_at: trx.fn.now(),
               }).onConflict('code').merge([
                    'name', 'description', 'currency', 'monthly_price', 'modules', 'branch_mode', 'rank', 'active', 'updated_at',
               ]);
               await this.management.recordPlanLifecycleEvent(trx, actor.tenantId, actor, 'subscription_tier_updated', {
                    code: plan.code, currency: plan.currency, monthlyPrice: plan.monthlyPrice,
                    modules: plan.modules, branchMode: plan.branchMode, rank: plan.rank, active: plan.active,
               });
          });
          return plan;
     }

     private async currentConfiguration(tenantId: number): Promise<FacilityModuleConfiguration> {
          await ensureFacilityModuleTable(this.master);
          const row = await this.master(MODULE_CONFIG_TABLE).where({ tenant_id: tenantId }).first('configuration');
          if (row) {
               let saved = row.configuration;
               if (typeof saved === 'string') {
                    try { saved = JSON.parse(saved); }
                    catch { throw new FacilityError('Stored module configuration is invalid', 409); }
               }
               const config = validateModuleConfiguration(saved);
               if (!config) throw new FacilityError('Stored module configuration is invalid', 409);
               return config;
          }
          const tenantDb = await KnexConnection(tenantId);
          const settings = await tenantDb('applicationsettings').where({ keyid: 1 }).first('moduleConfiguration');
          if (settings?.moduleConfiguration) {
               let saved = settings.moduleConfiguration;
               if (typeof saved === 'string') {
                    try { saved = JSON.parse(saved); }
                    catch { throw new FacilityError('Stored module configuration is invalid', 409); }
               }
               const config = validateModuleConfiguration(saved);
               if (config) return config;
          }
          const modules = Object.fromEntries(FACILITY_MODULES.map(module => [module, { enabled: false, monthlyPrice: '0.00' }])) as
               FacilityModuleConfiguration['modules'];
          return { branchMode: 'single', currency: 'GHS', modules, monthlyTotal: '0.00' };
     }

     private async tenantRequestRows(tenantId: number, limit?: number): Promise<any[]> {
          let query = this.master(FACILITY_PLAN_UPGRADE_REQUESTS_TABLE).where({ tenant_id: tenantId })
               .orderBy('requested_at', 'desc');
          if (limit !== undefined) query = query.limit(limit);
          return query.select();
     }

     async tenantPlanView(tenantId: number) {
          const currentConfig = await this.currentConfiguration(tenantId);
          const currentCode = currentConfig.plan?.code ?? null;
          const currentTier = currentCode ? await this.getPlan(currentCode).catch(error => {
               if (error instanceof FacilityError && error.statusCode === 404) return null;
               throw error;
          }) : null;
          const enabled = FACILITY_MODULES.filter(module => currentConfig.modules[module].enabled);
          const allActive = (await this.listPlans()).filter(plan => plan.active);
          const plans = allActive.map(plan => {
               const sameCurrency = plan.currency === currentConfig.currency;
               const isCurrent = plan.code === currentCode;
               const isUpgrade = sameCurrency && !isCurrent && (currentTier
                    ? currentTier.currency === currentConfig.currency && plan.rank > currentTier.rank
                    : enabled.every(module => plan.modules.includes(module)));
               const isDowngrade = sameCurrency && !isCurrent &&
                    Boolean(currentTier && currentTier.currency === currentConfig.currency && plan.rank < currentTier.rank);
               return { ...plan, isCurrent, isUpgrade, isDowngrade };
          });
          const requests = await this.tenantRequestRows(tenantId, 20);
          const pending = requests.find(request => request.status === 'pending');
          return {
               current: {
                    planCode: currentCode, planName: currentConfig.plan?.name ?? null, currency: currentConfig.currency,
                    monthlyTotal: currentConfig.monthlyTotal, branchMode: currentConfig.branchMode,
                    modules: FACILITY_MODULES.map(module => ({ module, enabled: currentConfig.modules[module].enabled })),
               },
               plans,
               pendingRequest: pending ? {
                    id: Number(pending.id), toPlanCode: String(pending.to_plan_code), requestedAt: timestamp(pending.requested_at),
               } : null,
          };
     }

     async createUpgradeRequest(tenantId: number, planCodeValue: unknown, requestedByEmail: unknown, actor: FacilityActor) {
          const planCode = validateCode(planCodeValue);
          if (typeof requestedByEmail !== 'string' || !requestedByEmail.trim()) {
               throw new FacilityError('Authenticated staff email is required', 401);
          }
          const plan = await this.getPlan(planCode, true);
          const overview = await this.tenantPlanView(tenantId);
          const choice = overview.plans.find(candidate => candidate.code === plan.code);
          if (!choice) throw new FacilityError('Plan currency does not match the current facility currency');
          if (!choice.isUpgrade) throw new FacilityError('The selected plan is not an upgrade');
          await TenantRegistry.ensureReady();
          await ensureFacilitySubscriptionPlanTables(this.master);
          await this.management.ensureSchema();
          return this.master.transaction(async trx => {
               const tenant = await trx(TENANTS_TABLE).where({ tenant_number: tenantId }).forUpdate()
                    .first('id', 'tenant_number', 'status', 'deleted_at');
               if (!tenant || tenant.deleted_at || !['active', 'suspended'].includes(String(tenant.status))) {
                    throw new FacilityError('Facility is not eligible for a plan upgrade request', 409);
               }
               const pending = await trx(FACILITY_PLAN_UPGRADE_REQUESTS_TABLE)
                    .where({ tenant_id: tenantId, status: 'pending' }).forUpdate().first('id');
               if (pending) throw new FacilityError('A plan upgrade request is already pending', 409);
               const current = await this.currentConfiguration(tenantId);
               const [id] = await trx(FACILITY_PLAN_UPGRADE_REQUESTS_TABLE).insert({
                    tenant_id: tenantId, from_plan_code: current.plan?.code ?? null,
                    to_plan_code: plan.code, status: 'pending', requested_by_email: requestedByEmail.trim(),
               });
               await this.management.recordPlanLifecycleEvent(trx, tenantId, actor, 'plan_upgrade_requested', {
                    requestId: Number(id), fromPlanCode: current.plan?.code ?? null, toPlanCode: plan.code,
               });
               const created = await trx(FACILITY_PLAN_UPGRADE_REQUESTS_TABLE).where({ id }).first();
               return requestView(created);
          });
     }

     async tenantUpgradeRequests(tenantId: number): Promise<FacilityPlanUpgradeRequest[]> {
          await this.ensureSchema();
          return (await this.tenantRequestRows(tenantId, 20)).map(requestView);
     }

     async platformUpgradeRequests(statusValue: unknown = 'pending'): Promise<FacilityPlanUpgradeRequest[]> {
          if (typeof statusValue !== 'string' || !['pending', 'approved', 'rejected'].includes(statusValue)) {
               throw new FacilityError('status must be pending, approved, or rejected');
          }
          await this.ensureSchema();
          const rows = await this.master(FACILITY_PLAN_UPGRADE_REQUESTS_TABLE)
               .where({ status: statusValue }).orderBy('requested_at', 'desc').select();
          const tenantIds = [...new Set(rows.map((row: any) => Number(row.tenant_id)))];
          const tenants = tenantIds.length
               ? await this.master(TENANTS_TABLE).whereIn('tenant_number', tenantIds)
                    .select('tenant_number', 'id', 'company_name')
               : [];
          const byTenant = new Map(tenants.map((row: any) => [Number(row.tenant_number), row]));
          return rows.map((row: any) => {
               const item = requestView(row);
               const tenant: any = byTenant.get(item.tenantId);
               return { ...item, platformId: tenant?.id ?? null, organizationName: tenant?.company_name ?? null };
          });
     }

     private async getRequest(idValue: unknown, trx?: Knex | Knex.Transaction, lock = false): Promise<any> {
          const id = typeof idValue === 'number' ? idValue : Number(idValue);
          if (!Number.isSafeInteger(id) || id <= 0) throw new FacilityError('Request id must be a positive integer');
          const db = trx || this.master;
          const query = db(FACILITY_PLAN_UPGRADE_REQUESTS_TABLE).where({ id });
          const row = await (lock ? query.forUpdate() : query).first();
          if (!row) throw new FacilityError('Plan upgrade request not found', 404);
          return row;
     }

     async decideUpgradeRequest(idValue: unknown, decision: 'approve' | 'reject', actor: FacilityActor, reasonValue: unknown = null) {
          let reason: string | null = null;
          if (decision === 'reject') {
               if (typeof reasonValue !== 'string' || reasonValue.trim().length < 3 || reasonValue.trim().length > 500) {
                    throw new FacilityError('reason must contain 3-500 characters');
               }
               reason = reasonValue.trim();
          }
          await TenantRegistry.ensureReady();
          await this.ensureSchema();
          await this.management.ensureSchema();
          const initial = await this.getRequest(idValue);
          if (initial.status === (decision === 'approve' ? 'approved' : 'rejected')) return requestView(initial);
          if (initial.status !== 'pending') throw new FacilityError('Plan upgrade request has already been decided', 409);

          if (decision === 'approve') {
               const plan = await this.getPlan(initial.to_plan_code, true);
               const requested = buildPlanModuleConfiguration(plan);
               await this.management.setModuleConfiguration(Number(initial.tenant_id), requested, actor, {
                    code: plan.code, name: plan.name, monthlyPrice: plan.monthlyPrice,
               });
          }

          return this.master.transaction(async trx => {
               const row = await this.getRequest(initial.id, trx, true);
               if (row.status === (decision === 'approve' ? 'approved' : 'rejected')) return requestView(row);
               if (row.status !== 'pending') throw new FacilityError('Plan upgrade request has already been decided', 409);
               const updated = await trx(FACILITY_PLAN_UPGRADE_REQUESTS_TABLE).where({ id: row.id, status: 'pending' }).update({
                    status: decision === 'approve' ? 'approved' : 'rejected',
                    decided_at: trx.fn.now(), decision_reason: reason,
                    decided_by_tenant_id: actor.tenantId, decided_by_employee_id: actor.employeeId,
               });
               if (updated !== 1) throw new FacilityError('Plan upgrade request changed concurrently; reload and retry', 409);
               await this.management.recordPlanLifecycleEvent(trx, Number(row.tenant_id), actor,
                    decision === 'approve' ? 'plan_upgrade_approved' : 'plan_upgrade_rejected', {
                         requestId: Number(row.id), fromPlanCode: row.from_plan_code ?? null, toPlanCode: row.to_plan_code,
                    }, reason);
               const result = await trx(FACILITY_PLAN_UPGRADE_REQUESTS_TABLE).where({ id: row.id }).first();
               return requestView(result);
          });
     }

     async assignPlan(tenantId: number, planCodeValue: unknown, actor: FacilityActor) {
          const plan = await this.getPlan(planCodeValue, true);
          const requested = buildPlanModuleConfiguration(plan);
          const result = await this.management.setModuleConfiguration(tenantId, requested, actor, {
               code: plan.code, name: plan.name, monthlyPrice: plan.monthlyPrice,
          });
          return { tenantId, plan: { code: plan.code, name: plan.name }, moduleConfiguration: result.moduleConfiguration };
     }
}
