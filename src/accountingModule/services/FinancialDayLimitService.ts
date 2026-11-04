import type { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';
import { AccountingError } from '../errors/AccountingErrors';
import { excludeHistoricalLocks, financialActivity } from './financialActivity';
import { readFinancialLockPolicy, validateGraceHours } from './FinancialLockSettingsService';

export const FINANCIAL_DAY_GRACE_HOURS = 48;
export interface FinancialDayReadiness {
     branchId: number;
     graceHours: number;
     oldestFinancialDate: string | null;
     deadline: string | null;
     blocked: boolean;
     closeUrl: string;
     enabled: boolean;
     overdue: boolean;
}

export function financialDayReadiness(branchId: number, oldest: unknown, now = new Date(), pharmacy = false, graceHours = FINANCIAL_DAY_GRACE_HOURS, enabled = true): FinancialDayReadiness {
     validateGraceHours(graceHours);
     if (!Number.isSafeInteger(branchId) || branchId <= 0) throw new AccountingError('Select your active branch before starting a transaction.', 'FINANCIAL_BRANCH_REQUIRED', 400);
     if (!Number.isFinite(now.getTime())) throw new AccountingError('Unable to verify the financial day.', 'FINANCIAL_DAY_CHECK_FAILED', 503);
     let oldestFinancialDate: string | null = null;
     let deadline: Date | null = null;
     if (oldest != null) {
          const value = oldest instanceof Date ? oldest.toISOString().slice(0, 10) : String(oldest);
          const start = new Date(`${value}T00:00:00.000Z`);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== value)
               throw new AccountingError('Unable to verify the financial day. Contact your administrator.', 'FINANCIAL_DAY_CHECK_FAILED', 503);
          oldestFinancialDate = value;
          deadline = new Date(start.getTime() + graceHours * 60 * 60 * 1000);
     }
     return {
          branchId, graceHours, oldestFinancialDate, deadline: deadline?.toISOString() || null, enabled,
          overdue: !!deadline && now.getTime() >= deadline.getTime(),
          blocked: enabled && !!deadline && now.getTime() >= deadline.getTime(),
          closeUrl: pharmacy ? '/pharmacy/finance' : `/accounting/daily-close${oldestFinancialDate ? `?financialDate=${oldestFinancialDate}` : ''}`,
     };
}

export class FinancialDayLimitService {
     constructor(private readonly tenantId: number, private readonly connectionOverride?: Knex) { }

     async transactionStatus(branchId: number, pharmacy = false): Promise<FinancialDayReadiness> {
          const status = await this.status(branchId, new Date(), pharmacy);
          if (!pharmacy || status.blocked) return status;
          const db = this.connectionOverride || await KnexConnection(this.tenantId);
          const settings = await db('pharmacy_accounting_settings').where({ branchid: branchId, tenant_id: this.tenantId }).first('enabled');
          return Number(settings?.enabled) === 1 ? this.status(branchId) : status;
     }

     async status(branchId: number, now = new Date(), pharmacy = false): Promise<FinancialDayReadiness> {
          financialDayReadiness(branchId, null, now, pharmacy);
          const db = this.connectionOverride || await KnexConnection(this.tenantId);
          if (pharmacy) {
               const row = await db('pharmacy_financial_days').where({ branchid: branchId }).whereNot('status', 'closed').min('financial_date as oldest_date').first();
               return financialDayReadiness(branchId, row?.oldest_date, now, true);
          }
          const policy = await db('financial_lock_settings').where({ branchid: branchId }).first();
          // A missing branch policy is an explicit migration-safe default, not a missing-schema fallback.
          const { graceHours, enabled } = readFinancialLockPolicy(policy);
          const row = await excludeHistoricalLocks(db.from(financialActivity(db, branchId)).leftJoin('financial_day_closures as closure', function () {
               this.on('closure.financial_date', 'activity.financial_date').andOnVal('closure.branchid', branchId);
          }).where(function () {
               this.whereNull('closure.id').orWhere('closure.status', '<>', 'finalized');
          }), db, branchId).min('activity.financial_date as oldest_date').first();
          return financialDayReadiness(branchId, row?.oldest_date, now, false, graceHours, enabled);
     }
}
