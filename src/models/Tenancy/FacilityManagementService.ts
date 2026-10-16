import { Knex } from 'knex';
import mysql from 'mysql2/promise';
import { singleTenantKnexInstance, systemConfigConnection } from '../../database/connection';
import KnexConnection from '../../database/KnexConnections';
import { configuration } from '../../hooks/configuration';
import { TENANTS_TABLE, TenantRegistry } from './TenantRegistry';
import { FacilityError } from './FacilityInput';
import type { FacilityActor } from './FacilityProvisioningService';
import {
     ensureFacilityModuleTable, FACILITY_MODULES, MODULE_CONFIG_TABLE, FacilityModuleConfiguration,
     validateModuleConfiguration,
} from './FacilityModules';
import {
     AuditQuery, FacilityStatusTarget, PaymentInput, SubscriptionFrequency, SubscriptionPlanInput,
     formatCents, normalizeStoredAmount, parseAsOf, storedDateToIso, storedTimestampToIso, utcToday, validatePaymentInput,
} from './FacilityManagementInput';
import {
     PlanSegment, countPeriodsBefore, exactPeriod, maxAdvancePeriodStart, periodOf, planScheduleChange, scheduleWindow,
     segmentEndDate, segmentFor,
} from './FacilitySubscriptionSchedule';
import { SmsProviderSettingsDto } from '../application/sms/dtos/SmsProviderSettingsDto';
import { SmsProviderSettingsRepo } from '../application/sms/repositories/SmsProviderSettingsRepo';
import { SmsProviderSettingsService } from '../application/sms/services/SmsProviderSettingsService';
import { bootstrapSmsProviderSettings } from '../application/sms/SmsProviderBootstrapper';
import { releaseTenantConnection } from './tenantConnections';
import { safeDatabaseIdentifier } from './FacilitySchema';
import { applyFacilityModulePricing, FacilityModulePricingCatalog } from './FacilityModulePricingCatalog';

export const PLANS_TABLE = 'facility_subscription_plans';
export const PAYMENTS_TABLE = 'facility_subscription_payments';
export const EVENTS_TABLE = 'facility_management_events';
/** Created by FacilityProvisioningService (stage audit); read-only here. */
export const PROVISIONING_EVENTS_TABLE = 'facility_provisioning_events';
export const HISTORY_LIMIT = 500;
const MANAGEABLE_STATUSES = ['active', 'suspended'];

export type PeriodStatus = 'paid' | 'unpaid' | 'overdue';
export interface SubscriptionPlanView { frequency: SubscriptionFrequency; amount: string; currency: string; startDate: string; }
export interface ScheduleSegmentView extends SubscriptionPlanView { endDate: string | null; }
export interface PaymentHistoryItem {
     id: number; periodStart: string; periodEnd: string; amount: string; currency: string;
     paidAt: string; reference: string; notes: string; voidedAt: string | null; voidReason: string | null;
}
export interface SubscriptionPeriodView {
     periodStart: string; periodEnd: string; dueDate: string; amount: string; currency: string; status: PeriodStatus;
     payment: null | { id: number; paidAt: string; reference: string; notes: string };
}
export interface SubscriptionView {
     moduleConfiguration: FacilityModuleConfiguration | null;
     tenantId: number;
     organizationIdentifier: string;
     facilityStatus: string;
     isControlTenant: boolean;
     asOf: string;
     /** Segment in effect on asOf (or the first scheduled segment if asOf precedes it). */
     plan: SubscriptionPlanView | null;
     /** All effective segments, ascending; endDate is inclusive, null for the open-ended last one. */
     schedule: ScheduleSegmentView[];
     window: null | { from: string; to: string; label: string; pastPeriods: number; futurePeriods: number; currentPeriodStart: string | null };
     periods: SubscriptionPeriodView[];
     overdueBeforeWindow: number;
     history: PaymentHistoryItem[];
     historyTruncated: boolean;
}

export interface FacilityAuditEvent {
     id: number;
     source: 'management' | 'provisioning';
     action: string;
     createdAt: string | null;
     actorTenantId: number;
     actorEmployeeId: number;
     reason: string | null;
     fromStatus: string | null;
     toStatus: string | null;
     details: Record<string, unknown> | null;
}
export interface FacilityAuditPage { events: FacilityAuditEvent[]; page: number; pageSize: number; total: number; }

const periodKey = (start: string, end: string) => `${start}/${end}`;

function storedObject(value: unknown, field: string): Record<string, unknown> {
     if (value === null || value === undefined || value === '') return {};
     let parsed = value;
     if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); }
          catch { throw new FacilityError(`Stored ${field} is invalid`, 409); }
     }
     if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new FacilityError(`Stored ${field} is invalid`, 409);
     }
     return parsed as Record<string, unknown>;
}

function storedModuleConfiguration(value: unknown): FacilityModuleConfiguration | null {
     if (value === null || value === undefined || value === '') return null;
     let parsed = value;
     if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); }
          catch { throw new FacilityError('Stored module configuration is invalid', 409); }
     }
     return validateModuleConfiguration(parsed);
}

function moduleSettingsPatch(existing: any, config: FacilityModuleConfiguration, final: boolean) {
     const services = storedObject(existing.services, 'service settings');
     const enabled = (name: keyof FacilityModuleConfiguration['modules']) => config.modules[name].enabled;
     const smsEnabled = enabled('sms') && (final || Number(existing.smsActivated) === 1);
     const emailEnabled = enabled('email') && (final || Number(existing.emailModuleActivated) === 1);
     return {
          moduleConfiguration: JSON.stringify(config),
          smsActivated: Number(smsEnabled),
          emailModuleActivated: Number(emailEnabled),
          services: JSON.stringify({
               ...services,
               isConnectedInventory: Number(enabled('inventory')),
               isSmsServicesConnected: Number(smsEnabled),
               isEmailServicesConnected: Number(emailEnabled),
          }),
     };
}

function branchModePatch(existing: any, branchMode: FacilityModuleConfiguration['branchMode']) {
     const additionalInfo = storedObject(existing.additionalInfo, 'company profile additionalInfo');
     return { additionalInfo: JSON.stringify({ ...additionalInfo, branchMode }) };
}

const UNSAFE_DETAIL_KEY = /pass|secret|token|hash|credential|connection|dsn|private|api[-_]?key|pin$/i;
const MAX_DETAIL_DEPTH = 4;

/** Stored event details are service-written JSON; still drop secret-like keys and bound depth/length defensively. */
export function sanitizeAuditDetails(value: unknown, depth = 0): unknown {
     if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
     if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}?` : value;
     if (depth >= MAX_DETAIL_DEPTH || typeof value !== 'object') return null;
     if (Array.isArray(value)) return value.slice(0, 50).map(item => sanitizeAuditDetails(item, depth + 1));
     const result: Record<string, unknown> = {};
     for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
          if (UNSAFE_DETAIL_KEY.test(key)) continue;
          result[key] = sanitizeAuditDetails(item, depth + 1);
     }
     return result;
}

function parseStoredDetails(raw: unknown): Record<string, unknown> | null {
     if (raw === null || raw === undefined || raw === '') return null;
     let parsed: unknown = raw;
     if (typeof raw === 'string') {
          try { parsed = JSON.parse(raw); } catch { return null; }
     }
     const clean = sanitizeAuditDetails(parsed);
     return clean && typeof clean === 'object' && !Array.isArray(clean) ? clean as Record<string, unknown> : { value: clean };
}

function toAuditEvent(row: any): FacilityAuditEvent {
     const source = row.source === 'provisioning' ? 'provisioning' : 'management';
     const nullableText = (value: unknown) => value === null || value === undefined ? null : String(value);
     let details: Record<string, unknown> | null;
     if (source === 'provisioning') {
          const stage = String(row.action ?? '');
          details = { stage, failed: stage.startsWith('failed:') };
     } else {
          details = parseStoredDetails(row.details);
          const ids: Record<string, number> = {};
          if (row.plan_id !== null && row.plan_id !== undefined) ids.planId = Number(row.plan_id);
          if (row.payment_id !== null && row.payment_id !== undefined) ids.paymentId = Number(row.payment_id);
          if (Object.keys(ids).length) details = { ...ids, ...(details ?? {}) };
     }
     return {
          id: Number(row.id), source, action: String(row.action ?? ''),
          createdAt: storedTimestampToIso(row.created_at),
          actorTenantId: Number(row.actor_tenant_id), actorEmployeeId: Number(row.actor_employee_id),
          reason: nullableText(row.reason), fromStatus: nullableText(row.from_status), toStatus: nullableText(row.to_status),
          details,
     };
}

function toSegment(row: any): PlanSegment {
     return {
          planId: Number(row.id), frequency: row.frequency, amount: normalizeStoredAmount(row.amount),
          currency: String(row.currency), startDate: storedDateToIso(row.start_date),
     };
}

const planView = (segment: PlanSegment): SubscriptionPlanView => ({
     frequency: segment.frequency, amount: segment.amount, currency: segment.currency, startDate: segment.startDate,
});

function toHistoryItem(row: any): PaymentHistoryItem {
     return {
          id: Number(row.id), periodStart: storedDateToIso(row.period_start), periodEnd: storedDateToIso(row.period_end),
          amount: normalizeStoredAmount(row.amount), currency: String(row.currency), paidAt: storedDateToIso(row.paid_at),
          reference: String(row.reference ?? ''), notes: String(row.notes ?? ''),
          voidedAt: storedTimestampToIso(row.voided_at), voidReason: row.void_reason ?? null,
     };
}

/**
 * Platform (control-tenant) management of provisioned client facilities: manual access status and
 * subscription period payment markers. All data lives in the master/control database. Access status is
 * never changed automatically by overdue periods.
 */
export class FacilityManagementService {
     private static schemaReady: Promise<void> | null = null;

     constructor(private master: Knex = systemConfigConnection, private now: () => Date = () => new Date()) { }

     private isControl(tenantId: number) {
          return tenantId === configuration.defaultTenantId;
     }

     /** Idempotent create-if-missing, matching the provisioning audit table bootstrap pattern. */
     async ensureSchema(): Promise<void> {
          if (!FacilityManagementService.schemaReady) {
               const create = async (name: string, build: (table: Knex.CreateTableBuilder) => void) => {
                    if (await this.master.schema.hasTable(name)) return;
                    try {
                         await this.master.schema.createTable(name, build);
                    } catch (error: any) {
                         if (error?.code !== 'ER_TABLE_EXISTS_ERROR') throw error;
                    }
               };
               FacilityManagementService.schemaReady = (async () => {
                    await create(PLANS_TABLE, table => {
                         table.bigIncrements('id');
                         table.integer('tenant_id').unsigned().notNullable();
                         table.string('organization_identifier', 30).notNullable();
                         table.enu('frequency', ['daily', 'weekly', 'monthly', 'yearly']).notNullable();
                         table.decimal('amount', 12, 2).notNullable();
                         table.string('currency', 3).notNullable();
                         table.date('start_date').notNullable();
                         // Rows are never edited: a scheduled change appends a later segment; a correction of the latest
                         // segment marks it replaced (is_effective=0) and inserts a new row.
                         table.boolean('is_effective').notNullable().defaultTo(true);
                         table.integer('created_by_tenant_id').unsigned().notNullable();
                         table.integer('created_by_employee_id').unsigned().notNullable();
                         table.timestamp('created_at').notNullable().defaultTo(this.master.fn.now());
                         table.timestamp('replaced_at').nullable();
                         table.integer('replaced_by_employee_id').unsigned().nullable();
                         table.index(['tenant_id', 'is_effective', 'start_date'], 'idx_fsp_tenant_effective');
                    });
                    await create(PAYMENTS_TABLE, table => {
                         table.bigIncrements('id');
                         table.integer('tenant_id').unsigned().notNullable();
                         table.string('organization_identifier', 30).notNullable();
                         table.bigInteger('plan_id').unsigned().notNullable().references('id').inTable(PLANS_TABLE);
                         table.enu('frequency', ['daily', 'weekly', 'monthly', 'yearly']).notNullable();
                         table.date('period_start').notNullable();
                         table.date('period_end').notNullable();
                         // Snapshot of the governing segment's amount/currency at recording time; authoritative for this period.
                         table.decimal('amount', 12, 2).notNullable();
                         table.string('currency', 3).notNullable();
                         table.date('paid_at').notNullable();
                         table.string('reference', 100).notNullable();
                         table.string('notes', 500).notNullable().defaultTo('');
                         // 'YYYY-MM-DD/YYYY-MM-DD' while active, NULL once voided: one active payment per exact period.
                         table.string('active_period_key', 21).nullable();
                         table.integer('recorded_by_tenant_id').unsigned().notNullable();
                         table.integer('recorded_by_employee_id').unsigned().notNullable();
                         table.timestamp('created_at').notNullable().defaultTo(this.master.fn.now());
                         table.timestamp('voided_at').nullable();
                         table.integer('voided_by_tenant_id').unsigned().nullable();
                         table.integer('voided_by_employee_id').unsigned().nullable();
                         table.string('void_reason', 500).nullable();
                         table.unique(['tenant_id', 'active_period_key'], { indexName: 'uq_fspay_tenant_active_period' });
                         table.index(['tenant_id', 'period_start'], 'idx_fspay_tenant_period');
                    });
                    await create(EVENTS_TABLE, table => {
                         table.bigIncrements('id');
                         table.integer('tenant_id').unsigned().notNullable().index('idx_fme_tenant');
                         table.string('organization_identifier', 30).notNullable();
                         table.string('action', 40).notNullable();
                         table.string('from_status', 20).nullable();
                         table.string('to_status', 20).nullable();
                         table.string('reason', 500).nullable();
                         table.bigInteger('plan_id').unsigned().nullable();
                         table.bigInteger('payment_id').unsigned().nullable();
                         table.text('details').nullable();
                         table.integer('actor_tenant_id').unsigned().notNullable();
                         table.integer('actor_employee_id').unsigned().notNullable();
                         table.timestamp('created_at').notNullable().defaultTo(this.master.fn.now());
                    });
                    await this.reconcileLegacyPlansTable();
                    await ensureFacilityModuleTable(this.master);
               })().catch(error => {
                    FacilityManagementService.schemaReady = null;
                    throw error;
               });
          }
          await FacilityManagementService.schemaReady;
     }

     /**
      * An earlier build created facility_subscription_plans with is_current/superseded_at/superseded_by_employee_id.
      * create-if-missing skipped it, so every query on is_effective failed with ER_BAD_FIELD_ERROR. Additive only:
      * add the current columns, backfill pre-existing rows from the legacy ones (rows with NULL is_effective, so a
      * partially applied run resumes), then enforce NOT NULL DEFAULT 1 and the lookup index. Legacy columns are
      * kept (never dropped) and are no longer read or written.
      */
     async reconcileLegacyPlansTable(): Promise<void> {
          // Knex schema builders are mutable: each inspection/ALTER needs a fresh builder.
          const has = (column: string) => this.master.schema.hasColumn(PLANS_TABLE, column);
          const ignore = (codes: string[]) => (error: any) => { if (!codes.includes(error?.code)) throw error; };
          const missing = {
               isEffective: !(await has('is_effective')),
               replacedAt: !(await has('replaced_at')),
               replacedBy: !(await has('replaced_by_employee_id')),
          };
          if (missing.isEffective || missing.replacedAt || missing.replacedBy) {
               await this.master.schema.alterTable(PLANS_TABLE, table => {
                    // Nullable first so not-yet-backfilled legacy rows are distinguishable.
                    if (missing.isEffective) table.boolean('is_effective').nullable();
                    if (missing.replacedAt) table.timestamp('replaced_at').nullable();
                    if (missing.replacedBy) table.integer('replaced_by_employee_id').unsigned().nullable();
               }).catch(ignore(['ER_DUP_FIELDNAME']));
          }
          const info: any = await this.master(PLANS_TABLE).columnInfo();
          if (!info.is_effective?.nullable) return;
          const raw = (sql: string, bindings: string[]) => this.master.raw(sql, bindings);
          await this.master(PLANS_TABLE).whereNull('is_effective').update({
               is_effective: info.is_current ? raw('??', ['is_current']) : 1,
               ...(info.superseded_at ? { replaced_at: raw('COALESCE(??, ??)', ['replaced_at', 'superseded_at']) } : {}),
               ...(info.superseded_by_employee_id
                    ? { replaced_by_employee_id: raw('COALESCE(??, ??)', ['replaced_by_employee_id', 'superseded_by_employee_id']) } : {}),
          });
          // Index before the NOT NULL step: a crash in between re-enters here and the duplicate index is tolerated.
          await this.master.schema.alterTable(PLANS_TABLE, table => {
               table.index(['tenant_id', 'is_effective', 'start_date'], 'idx_fsp_tenant_effective');
          }).catch(ignore(['ER_DUP_KEYNAME']));
          await this.master.schema.alterTable(PLANS_TABLE, table => {
               table.boolean('is_effective').notNullable().defaultTo(true).alter();
          });
     }

     private async tenantRow(db: Knex | Knex.Transaction, tenantId: number, lock: boolean) {
          const query = db(TENANTS_TABLE).where({ tenant_number: tenantId });
          const row = await (lock ? query.forUpdate() : query).first('id', 'tenant_number', 'status', 'deleted_at', 'database_name');
          if (!row || row.deleted_at) throw new FacilityError('Facility not found', 404);
          return row;
     }

     private event(trx: Knex.Transaction, tenant: any, actor: FacilityActor, values: Record<string, unknown>) {
          return trx(EVENTS_TABLE).insert({
               tenant_id: Number(tenant.tenant_number), organization_identifier: tenant.id,
               actor_tenant_id: actor.tenantId, actor_employee_id: actor.employeeId, ...values,
          });
     }

     /** Write plan lifecycle events into the existing facility audit stream within the caller's transaction. */
     async recordPlanLifecycleEvent(
          trx: Knex.Transaction, tenantId: number, actor: FacilityActor, action: string,
          details: Record<string, unknown>, reason: string | null = null,
     ): Promise<void> {
          const tenant = await this.tenantRow(trx, tenantId, false);
          await this.event(trx, tenant, actor, { action, details: JSON.stringify(details), reason });
     }

     private requireClient(tenantId: number, action: string) {
          if (this.isControl(tenantId)) throw new FacilityError(`The control tenant cannot ${action}`, 403);
     }

     private requireManageable(tenant: any, action: string) {
          if (!MANAGEABLE_STATUSES.includes(tenant.status)) {
               throw new FacilityError(`Facility is ${tenant.status}; only active or suspended facilities can ${action}`, 409);
          }
     }

     async setStatus(tenantId: number, input: { status: FacilityStatusTarget; reason: string }, actor: FacilityActor) {
          this.requireClient(tenantId, 'be suspended or reactivated');
          await TenantRegistry.ensureReady();
          await this.ensureSchema();
          const result = await this.master.transaction(async trx => {
               const tenant = await this.tenantRow(trx, tenantId, true);
               this.requireManageable(tenant, 'change status');
               const previousStatus = String(tenant.status);
               if (previousStatus === input.status) {
                    return { tenantId, organizationIdentifier: tenant.id, previousStatus, status: input.status, changed: false };
               }
               const updated = await trx(TENANTS_TABLE).where({ tenant_number: tenantId, status: previousStatus }).update({
                    status: input.status, suspended_at: input.status === 'suspended' ? trx.fn.now() : null,
               });
               if (updated !== 1) throw new FacilityError('Facility status changed concurrently; reload and retry', 409);
               await this.event(trx, tenant, actor, {
                    action: 'status_changed', from_status: previousStatus, to_status: input.status, reason: input.reason,
               });
               return { tenantId, organizationIdentifier: tenant.id, previousStatus, status: input.status, changed: true };
          });
          // Login and every tenant request re-read registry status; drop the cached "active" immediately.
          TenantRegistry.invalidate();
          return { ...result, isControlTenant: false };
     }

     /** Per-tenant SMS credentials live in the tenant database; the control plane never reads the raw key back. */
     private async smsProvider(tenantId: number): Promise<SmsProviderSettingsService> {
          await bootstrapSmsProviderSettings(tenantId);
          return new SmsProviderSettingsService(new SmsProviderSettingsRepo(tenantId));
     }

     async getSmsProvider(tenantId: number) {
          await TenantRegistry.ensureReady();
          await this.ensureSchema();
          const tenant = await this.tenantRow(this.master, tenantId, false);
          const settings = await (await this.smsProvider(tenantId)).getForAdministration();
          return { tenantId, organizationIdentifier: tenant.id, status: String(tenant.status), settings };
     }

     async setSmsProvider(tenantId: number, input: SmsProviderSettingsDto, actor: FacilityActor) {
          await TenantRegistry.ensureReady();
          await this.ensureSchema();
          const tenant = await this.tenantRow(this.master, tenantId, false);
          this.requireManageable(tenant, 'change SMS configuration');
          const service = await this.smsProvider(tenantId);
          const existing = await service.getForAdministration();
          if (!existing.configured && !input.apiKey?.trim()) {
               throw new FacilityError('An API key is required when configuring SMS for this facility for the first time');
          }
          await service.save(input, actor.employeeId);
          const settings = await service.getForAdministration();
          // Audit records what changed, never the credential itself.
          await this.master.transaction(trx => this.event(trx, tenant, actor, {
               action: 'sms_provider_updated',
               details: JSON.stringify({
                    providerType: input.providerType, senderId: input.senderId,
                    baseUrl: input.baseUrl, isActive: input.isActive, apiKeyReplaced: Boolean(input.apiKey?.trim()),
               }),
          }));
          return { tenantId, organizationIdentifier: tenant.id, status: String(tenant.status), settings };
     }

     async deleteTenant(tenantId: number, confirmation: unknown, reason: string, actor: FacilityActor) {
          await TenantRegistry.ensureReady();
          this.requireClient(tenantId, 'be deleted');
          await this.ensureSchema();
          const result = await this.master.transaction(async trx => {
               const tenant = await this.tenantRow(trx, tenantId, true);
               if (tenant.status === 'provisioning') throw new FacilityError('Facility is provisioning; wait for it to finish before deleting', 409);
               if (confirmation !== tenant.id) throw new FacilityError('Enter the exact organization identifier to confirm deletion', 400);
               const databasePreserved = tenant.status !== 'failed';
               if (!databasePreserved) {
                    const localConnection = singleTenantKnexInstance.client.config.connection;
                    const localDatabase = typeof localConnection === 'object' && localConnection && 'database' in localConnection
                         ? localConnection.database : undefined;
                    const databaseName = tenant.database_name;
                    if (!configuration.isMultiTenant || typeof databaseName !== 'string' ||
                         databaseName !== `pls_${String(tenant.id).toLowerCase()}_${tenantId}` ||
                         databaseName.toLowerCase() === configuration.masterControlDatabase.toLowerCase() ||
                         (typeof localDatabase === 'string' && databaseName.toLowerCase() === localDatabase.toLowerCase())) {
                         throw new FacilityError('Failed facility database cannot be safely deleted', 409);
                    }
                    safeDatabaseIdentifier(databaseName);
                    if (!process.env.DB_HOST || !process.env.DB_USERNAME || !process.env.DB_PORT) {
                         throw new FacilityError('Tenant database connection settings are incomplete', 503);
                    }
               }
               await this.event(trx, tenant, actor, {
                    action: 'tenant_deleted', from_status: tenant.status, to_status: 'deleted', reason,
                    details: JSON.stringify({ databasePreserved }),
               });
               if (!databasePreserved) {
                    // DDL uses a separate connection so MySQL cannot implicitly commit the registry transaction.
                    const admin = await mysql.createConnection({
                         host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
                         user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, multipleStatements: false,
                    });
                    try {
                         await releaseTenantConnection(tenantId);
                         await admin.query('DROP DATABASE IF EXISTS ??', [tenant.database_name]);
                    } finally {
                         await admin.end();
                    }
                    if (await trx.schema.hasTable('marketplace_facilities')) {
                         await trx('marketplace_facilities').where({
                              linked_tenant_id: tenantId, integration_state: 'provision_failed',
                         }).update({ linked_tenant_id: null, updated_at: trx.fn.now() });
                    }
               }
               const deleted = await trx(TENANTS_TABLE).where({ tenant_number: tenantId, id: tenant.id }).delete();
               if (deleted !== 1) throw new FacilityError('Facility changed concurrently; reload and retry', 409);
               return { tenantId, organizationIdentifier: tenant.id, deleted: true, databasePreserved };
          });
          TenantRegistry.invalidate();
          return result;
     }

     private async segments(db: Knex | Knex.Transaction, tenantId: number, lock: boolean): Promise<PlanSegment[]> {
          const query = db(PLANS_TABLE).where({ tenant_id: tenantId, is_effective: 1 }).orderBy('start_date', 'asc');
          return (await (lock ? query.forUpdate() : query).select()).map(toSegment);
     }

     async getSubscription(tenantId: number, asOfRaw?: unknown): Promise<SubscriptionView> {
          const asOf = parseAsOf(asOfRaw, utcToday(this.now()));
          await TenantRegistry.ensureReady();
          await this.ensureSchema();
          const tenant = await this.tenantRow(this.master, tenantId, false);
          const segments = await this.segments(this.master, tenantId, false);
          const historyRows = await this.master(PAYMENTS_TABLE).where({ tenant_id: tenantId })
               .orderBy('period_start', 'desc').orderBy('id', 'desc').limit(HISTORY_LIMIT + 1).select();
          const view: SubscriptionView = {
               moduleConfiguration: null,
               tenantId, organizationIdentifier: tenant.id, facilityStatus: String(tenant.status),
               isControlTenant: this.isControl(tenantId), asOf, plan: null, schedule: [], window: null, periods: [],
               overdueBeforeWindow: 0,
               history: historyRows.slice(0, HISTORY_LIMIT).map(toHistoryItem),
               historyTruncated: historyRows.length > HISTORY_LIMIT,
          };
          const moduleRow = await this.master(MODULE_CONFIG_TABLE).where({ tenant_id: tenantId }).first('configuration');
          if (moduleRow) view.moduleConfiguration = JSON.parse(moduleRow.configuration);
          if (segments.length === 0) return view;
          view.schedule = segments.map((segment, i) => ({ ...planView(segment), endDate: segmentEndDate(segments, i) }));
          view.plan = planView(segments[Math.max(segmentFor(segments, asOf), 0)]);
          const bounds = scheduleWindow(segments, asOf);
          const periods = bounds.positions.map(position => periodOf(segments, position));
          const from = periods[0].periodStart;
          const last = periods[periods.length - 1];
          // Active (non-voided) payments only; bounded by the window end.
          const activeRows = await this.master(PAYMENTS_TABLE).where({ tenant_id: tenantId }).whereNull('voided_at')
               .where('period_start', '<=', last.periodStart).select();
          const active = new Map<string, PaymentHistoryItem>();
          for (const row of activeRows) {
               const item = toHistoryItem(row);
               active.set(periodKey(item.periodStart, item.periodEnd), item);
          }
          view.periods = periods.map(period => {
               const payment = active.get(periodKey(period.periodStart, period.periodEnd));
               return {
                    periodStart: period.periodStart, periodEnd: period.periodEnd, dueDate: period.dueDate,
                    amount: payment ? payment.amount : period.amount,
                    currency: payment ? payment.currency : period.currency,
                    status: payment ? 'paid' : period.dueDate < asOf ? 'overdue' : 'unpaid',
                    payment: payment ? { id: payment.id, paidAt: payment.paidAt, reference: payment.reference, notes: payment.notes } : null,
               };
          });
          // Every schedule period before the window is past due; subtract those with an exactly matching active payment.
          let paidBefore = 0;
          for (const item of active.values()) {
               if (item.periodStart >= from) continue;
               const match = exactPeriod(segments, item.periodStart);
               if (match && match.period.periodEnd === item.periodEnd) paidBefore++;
          }
          view.overdueBeforeWindow = countPeriodsBefore(segments, from) - paidBefore;
          view.window = {
               from, to: last.periodEnd, pastPeriods: bounds.past, futurePeriods: bounds.future,
               currentPeriodStart: bounds.current ? periodOf(segments, bounds.current).periodStart : null,
               label: bounds.current
                    ? `Current ${bounds.frequency} period with up to ${bounds.past} previous and ${bounds.future} upcoming periods as of ${asOf}`
                    : `First ${bounds.future} ${bounds.frequency} period(s) (plan starts after ${asOf})`,
          };
          return view;
     }

          /**
           * Updates both the platform entitlement and tenant operational settings. The tenant is first
           * moved to the intersection of its current modules and the requested modules; therefore a
           * failure between databases can leave access more restrictive, but cannot grant a requested
           * module before both stores are ready.
           */
          async setModuleConfiguration(
               tenantId: number, input: FacilityModuleConfiguration, actor: FacilityActor,
               planAssignment?: { code: string; name: string; monthlyPrice: string },
          ) {
               await TenantRegistry.ensureReady();
               await this.ensureSchema();

               const initialTenant = await this.tenantRow(this.master, tenantId, false);
               this.requireManageable(initialTenant, 'change module configuration');
               const tenantDb = await KnexConnection(tenantId);
               const customInput: any = { ...input };
               delete customInput.plan;
               delete customInput.monthlyTotal;
               const submitted = validateModuleConfiguration(customInput);
               if (!submitted) throw new FacilityError('moduleConfiguration is required');
               const requested = planAssignment
                    ? validateModuleConfiguration({
                         ...submitted, plan: { code: planAssignment.code, name: planAssignment.name },
                         monthlyTotal: planAssignment.monthlyPrice,
                         modules: Object.fromEntries(FACILITY_MODULES.map(module => [module, {
                              enabled: submitted.modules[module].enabled, monthlyPrice: '0.00',
                         }])),
                    })!
                    : applyFacilityModulePricing(submitted,
                         await new FacilityModulePricingCatalog(this.master).get(submitted.currency));

               await tenantDb.transaction(async trx => {
                    const settings = await trx('applicationsettings').where({ keyid: 1 }).forUpdate().first();
                    const profile = await trx('companyprofile').forUpdate().first();
                    if (!settings || !profile || profile.ID === undefined) throw new FacilityError('Facility settings are unavailable', 409);
                    const previous = storedModuleConfiguration(settings.moduleConfiguration);
                    const modules = {} as FacilityModuleConfiguration['modules'];
                    for (const module of FACILITY_MODULES) {
                         modules[module] = {
                              enabled: Boolean(previous?.modules[module].enabled && requested.modules[module].enabled),
                              monthlyPrice: requested.modules[module].monthlyPrice,
                         };
                    }
                    const intermediate = validateModuleConfiguration({
                         ...requested,
                         branchMode: previous?.branchMode === 'single' || requested.branchMode === 'single' ? 'single' : 'multiple',
                         modules,
                    });
                    if (!intermediate) throw new Error('Failed to construct restrictive module configuration');
                    await trx('applicationsettings').where({ keyid: 1 }).update(moduleSettingsPatch(settings, intermediate, false));
                    await trx('companyprofile').where({ ID: profile.ID }).update(branchModePatch(profile, intermediate.branchMode));
               });

               let masterTenant: any;
               let platformUpdated = false;
               let tenantFinalized = false;
               const auditDetails = JSON.stringify({
                    moduleConfiguration: requested,
                    enabledModules: FACILITY_MODULES.filter(module => requested.modules[module].enabled),
                    syncStatus: 'pending',
               });
               try {
                    masterTenant = await this.master.transaction(async trx => {
                         const tenant = await this.tenantRow(trx, tenantId, true);
                         this.requireManageable(tenant, 'change module configuration');
                         const existing = await trx(MODULE_CONFIG_TABLE).where({ tenant_id: tenantId }).first('tenant_id');
                         const record = { configuration: JSON.stringify(requested) };
                         if (existing) await trx(MODULE_CONFIG_TABLE).where({ tenant_id: tenantId }).update(record);
                         else await trx(MODULE_CONFIG_TABLE).insert({ tenant_id: tenantId, ...record });
                         await this.event(trx, tenant, actor, {
                              action: 'module_configuration_sync_started',
                              details: auditDetails,
                         });
                         return tenant;
                    });
                    platformUpdated = true;

                    await tenantDb.transaction(async trx => {
                         const settings = await trx('applicationsettings').where({ keyid: 1 }).forUpdate().first();
                         const profile = await trx('companyprofile').forUpdate().first();
                         if (!settings || !profile || profile.ID === undefined) throw new FacilityError('Facility settings are unavailable', 409);
                         await trx('applicationsettings').where({ keyid: 1 }).update(moduleSettingsPatch(settings, requested, true));
                         await trx('companyprofile').where({ ID: profile.ID }).update(branchModePatch(profile, requested.branchMode));
                    });
                    tenantFinalized = true;

                    await this.master.transaction(trx => this.event(trx, masterTenant, actor, {
                         action: 'module_configuration_updated',
                         details: JSON.stringify({
                              moduleConfiguration: requested,
                              enabledModules: FACILITY_MODULES.filter(module => requested.modules[module].enabled),
                              syncStatus: 'complete',
                         }),
                    }));
               } catch (error) {
                    // The restrictive tenant write is intentionally retained. Record partial sync when
                    // possible; never roll it back into a state that could grant a module.
                    const auditTenant = masterTenant || initialTenant;
                    if (auditTenant) {
                         await this.master.transaction(trx => this.event(trx, auditTenant, actor, {
                              action: 'module_configuration_sync_failed',
                              details: JSON.stringify({
                                   enabledModules: FACILITY_MODULES.filter(module => requested.modules[module].enabled),
                                   syncStatus: !platformUpdated ? 'platform_copy_unchanged'
                                        : tenantFinalized ? 'tenant_copy_synced_audit_failed' : 'tenant_copy_restricted',
                              }),
                         })).catch(() => undefined);
                    }
                    throw error;
               }

               return { tenantId, moduleConfiguration: requested, monthlyTotal: requested.monthlyTotal };
          }

          /** Any registered facility, including the default/control tenant, can carry a subscription. */
          async setPlan(tenantId: number, input: SubscriptionPlanInput, actor: FacilityActor) {
          await TenantRegistry.ensureReady();
          await this.ensureSchema();
          const next = { frequency: input.frequency, amount: formatCents(input.amountCents), currency: input.currency, startDate: input.startDate };
          const result = await this.master.transaction(async trx => {
               const tenant = await this.tenantRow(trx, tenantId, true);
               this.requireManageable(tenant, 'have a subscription');
               const segments = await this.segments(trx, tenantId, true);
               const change = planScheduleChange(segments, next);
               if (!change) return { changed: false, mode: 'unchanged' };
               // Never orphan an active payment: every one on/after the new start must still be an exact period.
               const affected = await trx(PAYMENTS_TABLE).where({ tenant_id: tenantId }).whereNull('voided_at')
                    .where('period_start', '>=', next.startDate).select();
               const orphaned = affected.map(toHistoryItem).filter(item => {
                    const match = exactPeriod(change.segments, item.periodStart);
                    return !match || match.period.periodEnd !== item.periodEnd;
               });
               if (orphaned.length) {
                    throw new FacilityError(`${orphaned.length} active payment(s) on or after ${next.startDate} would not match the new plan's periods (payment IDs: ${orphaned.map(item => item.id).join(', ')}); void them first`, 409);
               }
               if (change.replaced) {
                    const updated = await trx(PLANS_TABLE).where({ id: change.replaced.planId, is_effective: 1 }).update({
                         is_effective: 0, replaced_at: trx.fn.now(), replaced_by_employee_id: actor.employeeId,
                    });
                    if (updated !== 1) throw new FacilityError('Subscription changed concurrently; reload and retry', 409);
               }
               const [planId] = await trx(PLANS_TABLE).insert({
                    tenant_id: tenantId, organization_identifier: tenant.id, frequency: next.frequency, amount: next.amount,
                    currency: next.currency, start_date: next.startDate, is_effective: 1,
                    created_by_tenant_id: actor.tenantId, created_by_employee_id: actor.employeeId,
               });
               await this.event(trx, tenant, actor, {
                    action: `plan_${change.mode}`, plan_id: planId,
                    details: JSON.stringify({ replaced: change.replaced ? planView(change.replaced) : null, next }),
               });
               return { changed: true, mode: change.mode };
          });
          return { ...result, ...(await this.getSubscription(tenantId)) };
     }

     async recordPayment(tenantId: number, body: unknown, actor: FacilityActor) {
          const today = utcToday(this.now());
          const input: PaymentInput = validatePaymentInput(body, today);
          await TenantRegistry.ensureReady();
          await this.ensureSchema();
          const paymentId = await this.master.transaction(async trx => {
               const tenant = await this.tenantRow(trx, tenantId, true);
               this.requireManageable(tenant, 'record payments');
               const segments = await this.segments(trx, tenantId, true);
               if (segments.length === 0) throw new FacilityError('Configure a subscription plan before recording payments', 409);
               const match = exactPeriod(segments, input.periodStart);
               if (!match) throw new FacilityError('periodStart must be the first day of a period in the subscription schedule');
               const limit = maxAdvancePeriodStart(segments, today);
               if (input.periodStart > limit) {
                    throw new FacilityError(`Payments can be recorded in advance only up to the period starting ${limit}`);
               }
               const { period } = match;
               const key = periodKey(period.periodStart, period.periodEnd);
               const existing = await trx(PAYMENTS_TABLE).where({ tenant_id: tenantId, active_period_key: key }).first('id');
               if (existing) {
                    throw new FacilityError(`Period ${key} is already marked paid (payment ${existing.id}); void it before recording a correction`, 409);
               }
               let id: number;
               try {
                    [id] = await trx(PAYMENTS_TABLE).insert({
                         tenant_id: tenantId, organization_identifier: tenant.id, plan_id: period.planId, frequency: period.frequency,
                         period_start: period.periodStart, period_end: period.periodEnd, amount: period.amount, currency: period.currency,
                         paid_at: input.paidAt, reference: input.reference, notes: input.notes, active_period_key: key,
                         recorded_by_tenant_id: actor.tenantId, recorded_by_employee_id: actor.employeeId,
                    });
               } catch (error: any) {
                    if (error?.code === 'ER_DUP_ENTRY') throw new FacilityError(`Period ${key} is already marked paid`, 409);
                    throw error;
               }
               await this.event(trx, tenant, actor, {
                    action: 'payment_recorded', plan_id: period.planId, payment_id: id,
                    details: JSON.stringify({
                         periodStart: period.periodStart, periodEnd: period.periodEnd, amount: period.amount,
                         currency: period.currency, paidAt: input.paidAt,
                    }),
               });
               return id;
          });
          const row = await this.master(PAYMENTS_TABLE).where({ id: paymentId, tenant_id: tenantId }).first();
          return { payment: toHistoryItem(row), ...(await this.getSubscription(tenantId)) };
     }
     async voidPayment(tenantId: number, paymentId: number, input: { reason: string }, actor: FacilityActor) {
          await TenantRegistry.ensureReady();
          await this.ensureSchema();
          await this.master.transaction(async trx => {
               const tenant = await this.tenantRow(trx, tenantId, true);
               const payment = await trx(PAYMENTS_TABLE).where({ id: paymentId, tenant_id: tenantId }).forUpdate().first();
               if (!payment) throw new FacilityError('Payment not found for this facility', 404);
               if (payment.voided_at) throw new FacilityError('Payment is already voided', 409);
               const updated = await trx(PAYMENTS_TABLE).where({ id: paymentId, tenant_id: tenantId }).whereNull('voided_at').update({
                    voided_at: trx.fn.now(), voided_by_tenant_id: actor.tenantId, voided_by_employee_id: actor.employeeId,
                    void_reason: input.reason, active_period_key: null,
               });
               if (updated !== 1) throw new FacilityError('Payment changed concurrently; reload and retry', 409);
               await this.event(trx, tenant, actor, {
                    action: 'payment_voided', plan_id: payment.plan_id, payment_id: paymentId, reason: input.reason,
               });
          });
          const row = await this.master(PAYMENTS_TABLE).where({ id: paymentId, tenant_id: tenantId }).first();
          return { payment: toHistoryItem(row), ...(await this.getSubscription(tenantId)) };
     }

     /**
      * Newest-first, paginated union of management events (status/plan/payment) and provisioning stage events
      * for one registered facility. Read-only; ties on created_at are broken by source then id for stable paging.
      */
     async listAudit(tenantId: number, query: AuditQuery): Promise<FacilityAuditPage> {
          await TenantRegistry.ensureReady();
          await this.ensureSchema();
          await this.tenantRow(this.master, tenantId, false);
          const withProvisioning = await this.master.schema.hasTable(PROVISIONING_EVENTS_TABLE);
          const management = `SELECT 'management' AS source, id, action, created_at, actor_tenant_id, actor_employee_id,
               reason, from_status, to_status, details, plan_id, payment_id FROM ?? WHERE tenant_id = ?`;
          const provisioning = `SELECT 'provisioning' AS source, id, stage AS action, created_at, actor_tenant_id, actor_employee_id,
               NULL AS reason, NULL AS from_status, NULL AS to_status, NULL AS details, NULL AS plan_id, NULL AS payment_id
               FROM ?? WHERE tenant_id = ?`;
          const union = withProvisioning ? `${management} UNION ALL ${provisioning}` : management;
          const unionBindings = withProvisioning
               ? [EVENTS_TABLE, tenantId, PROVISIONING_EVENTS_TABLE, tenantId] : [EVENTS_TABLE, tenantId];
          const offset = (query.page - 1) * query.pageSize;
          const [rows] = await this.master.raw(
               `SELECT * FROM (${union}) AS audit ORDER BY created_at DESC, source ASC, id DESC LIMIT ? OFFSET ?`,
               [...unionBindings, query.pageSize, offset],
          );
          const count = async (table: string) => Number((await this.master(table).where({ tenant_id: tenantId }).count({ n: '*' }))[0]?.n ?? 0);
          const total = (await count(EVENTS_TABLE)) + (withProvisioning ? await count(PROVISIONING_EVENTS_TABLE) : 0);
          return { events: (rows as any[]).map(toAuditEvent), page: query.page, pageSize: query.pageSize, total };
     }
}
