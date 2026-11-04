import type { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';
import { AccountingError } from '../errors/AccountingErrors';
import { excludeHistoricalLocks, financialActivity } from './financialActivity';

export function financialDate(value: unknown): string {
     const date = value instanceof Date ? value.toISOString().slice(0, 10) : value;
     if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date))
          throw new AccountingError('Use a valid YYYY-MM-DD financial date.', 'INVALID_FINANCIAL_DATE', 400);
     const parsed = new Date(`${date}T00:00:00.000Z`);
     if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
          throw new AccountingError('Use a valid YYYY-MM-DD financial date.', 'INVALID_FINANCIAL_DATE', 400);
     return date;
}

export function validateGraceHours(value: unknown): number {
     if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > 8760)
          throw new AccountingError('Closing interval must be a whole number from 1 to 8760 hours.', 'INVALID_FINANCIAL_INTERVAL', 400);
     return value;
}

export function readFinancialLockPolicy(row?: { enabled: unknown; grace_hours: unknown }) {
     if (!row) return { enabled: false, graceHours: 48 };
     if (![true, false, 0, 1, '0', '1'].some(value => value === row.enabled))
          throw new AccountingError('Unable to verify the financial closing policy. Contact your administrator.', 'INVALID_FINANCIAL_POLICY', 503);
     return { enabled: Number(row.enabled) === 1, graceHours: validateGraceHours(row.grace_hours) };
}

function reason(value: unknown): string {
     if (typeof value !== 'string' || !value.trim() || value.trim().length > 1000)
          throw new AccountingError('Provide an audit reason of 1 to 1000 characters.', 'FINANCIAL_REASON_REQUIRED', 400);
     return value.trim();
}

export class FinancialLockSettingsService {
     constructor(private readonly tenantId: number, private readonly connectionOverride?: Knex) {}
     private async connection() { return this.connectionOverride || await KnexConnection(this.tenantId); }
     private validateBranch(branchId: number) {
          if (!Number.isSafeInteger(branchId) || branchId <= 0)
               throw new AccountingError('Select your active branch.', 'FINANCIAL_BRANCH_REQUIRED', 400);
     }
     private range(input: { startDate?: unknown; endDate?: unknown }, now: Date) {
          const startDate = financialDate(input.startDate), endDate = financialDate(input.endDate);
          if (startDate > endDate || endDate >= financialDate(now))
               throw new AccountingError('Select an ordered historical range ending before today. Today must remain available for operations.', 'INVALID_HISTORICAL_RANGE', 400);
          return { startDate, endDate };
     }
     async get(branchId: number, now = new Date()) {
          this.validateBranch(branchId);
          const db = await this.connection();
          const row = await db('financial_lock_settings').where({ branchid: branchId }).first();
          const bounds = await db.from(financialActivity(db, branchId))
               .min('financial_date as earliest').max('financial_date as latest').first<{ earliest: unknown; latest: unknown }>();
          const ranges = await db('financial_historical_locks').where({ branchid: branchId }).orderBy('start_date');
          return {
               policy: readFinancialLockPolicy(row),
               bounds: {
                    earliestDate: bounds?.earliest == null ? null : financialDate(bounds.earliest),
                    latestDate: bounds?.latest == null ? null : financialDate(bounds.latest),
                    currentDate: financialDate(now),
               },
               ranges: ranges.map(row => ({
                    id: Number(row.id), startDate: financialDate(row.start_date), endDate: financialDate(row.end_date),
                    reason: row.reason as string, createdBy: Number(row.created_by),
                    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
               })),
          };
     }
     private async lockPolicy(db: Knex.Transaction, branchId: number) {
          await db('financial_lock_settings').insert({ branchid: branchId }).onConflict('branchid').ignore();
          return db('financial_lock_settings').where({ branchid: branchId }).forUpdate().first();
     }
     async save(branchId: number, actor: number, input: { enabled?: unknown; graceHours?: unknown; reason?: unknown }) {
          this.validateBranch(branchId);
          if (typeof input.enabled !== 'boolean')
               throw new AccountingError('Choose whether closing enforcement is active.', 'INVALID_FINANCIAL_POLICY', 400);
          const graceHours = validateGraceHours(input.graceHours), auditReason = reason(input.reason);
          const db = await this.connection();
          await db.transaction(async trx => {
               const before = await this.lockPolicy(trx, branchId);
               const after = { enabled: input.enabled, grace_hours: graceHours, updated_by: actor, updated_at: trx.fn.now() };
               await trx('financial_lock_settings').where({ branchid: branchId }).update(after);
               await trx('acc_control_audit').insert({
                    action: 'financial_lock_policy', entity_id: branchId, employee_id: actor,
                    before_state: JSON.stringify(before),
                    after_state: JSON.stringify({ enabled: input.enabled, graceHours, reason: auditReason }),
               });
          });
          return this.get(branchId);
     }
     async preview(branchId: number, input: { startDate?: unknown; endDate?: unknown }, now = new Date()) {
          this.validateBranch(branchId);
          const { startDate, endDate } = this.range(input, now), db = await this.connection();
          const query = db.from(financialActivity(db, branchId)).whereBetween('activity.financial_date', [startDate, endDate]);
          const all = await query.clone().countDistinct('activity.financial_date as count').first<{ count: string | number }>();
          const eligible = await excludeHistoricalLocks(query.clone(), db, branchId)
               .whereNotExists(db('financial_day_closures as closure').select(db.raw('1'))
                    .where({ 'closure.branchid': branchId, 'closure.status': 'finalized' })
                    .whereRaw('closure.financial_date = activity.financial_date'))
               .countDistinct('activity.financial_date as count').first<{ count: string | number }>();
          const financialDayCount = Number(all?.count ?? 0), eligibleDayCount = Number(eligible?.count ?? 0);
          return { financialDayCount, eligibleDayCount, alreadyLockedDayCount: financialDayCount - eligibleDayCount };
     }
     async migrate(branchId: number, actor: number, input: { startDate?: unknown; endDate?: unknown; reason?: unknown; confirm?: unknown }, now = new Date()) {
          this.validateBranch(branchId);
          const { startDate, endDate } = this.range(input, now), auditReason = reason(input.reason);
          if (input.confirm !== true)
               throw new AccountingError('Confirm that this historical period will become financially immutable.', 'FINANCIAL_MIGRATION_CONFIRM_REQUIRED', 400);
          const db = await this.connection();
          await db.transaction(async trx => {
               await this.lockPolicy(trx, branchId);
               const existing = await trx('financial_historical_locks').where({ branchid: branchId, start_date: startDate, end_date: endDate }).first();
               if (existing) return;
               await trx('financial_historical_locks').insert({
                    branchid: branchId, start_date: startDate, end_date: endDate, reason: auditReason, created_by: actor,
               });
               await trx('acc_control_audit').insert({
                    action: 'financial_historical_lock', entity_id: branchId, employee_id: actor,
                    before_state: '{}', after_state: JSON.stringify({ startDate, endDate, reason: auditReason, reconciled: false }),
               });
          });
          return this.get(branchId, now);
     }
}
