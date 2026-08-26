import KnexConnection from '../../database/KnexConnections';
import { IAccountingPeriod, PeriodStatus } from '../interfaces/IAccountingPeriod';
import { IAccountingPeriodService } from '../interfaces/IAccountingPeriodService';
import { PeriodClosedError, PeriodNotFoundError, UnbalancedTransactionError } from '../errors/AccountingErrors';

const BLOCKING_STATUSES: PeriodStatus[] = ['closed', 'locked'];

export class AccountingPeriodService implements IAccountingPeriodService {
     constructor(private tenantId: number) { }

     private async connection(trx?: any) {
          if (trx) return trx;
          return KnexConnection(this.tenantId);
     }

     async ensurePeriodForDate(date: Date | string, trx?: any): Promise<IAccountingPeriod> {
          const db = await this.connection(trx);
          const target = new Date(date);
          const periodCode = toPeriodCode(target);

          const existing = await db('acc_periods').where({ period_code: periodCode }).first();
          if (existing) return existing;

          const start = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), 1));
          const end = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0));

          await db('acc_periods')
               .insert({
                    period_code: periodCode,
                    period_start: toDateOnly(start),
                    period_end: toDateOnly(end),
                    status: 'open',
                    created_at: new Date(),
                    updated_at: new Date(),
               })
               .onConflict('period_code')
               .ignore();

          return db('acc_periods').where({ period_code: periodCode }).first();
     }

     async assertPostingAllowed(date: Date | string, trx?: any): Promise<void> {
          const period = await this.ensurePeriodForDate(date, trx);
          if (period && BLOCKING_STATUSES.includes(period.status)) {
               throw new PeriodClosedError(period.period_code, period.status);
          }
     }

     async list(from?: string, to?: string): Promise<IAccountingPeriod[]> {
          const db = await this.connection();
          let query = db('acc_periods').orderBy('period_code', 'desc');
          if (from) query = query.where('period_code', '>=', from);
          if (to) query = query.where('period_code', '<=', to);
          return query;
     }

     async setStatus(
          periodCode: string,
          status: PeriodStatus,
          employeeId?: number | null,
          notes?: string
     ): Promise<IAccountingPeriod> {
          const db = await this.connection();
          const period = await db('acc_periods').where({ period_code: periodCode }).first();
          if (!period) throw new PeriodNotFoundError(periodCode);

          if (BLOCKING_STATUSES.includes(status)) {
               const totals = await this.getPeriodTotals(periodCode);
               if (round2(totals.debits) !== round2(totals.credits)) {
                    throw new UnbalancedTransactionError(round2(totals.debits), round2(totals.credits));
               }
          }

          await db('acc_periods')
               .where({ period_code: periodCode })
               .update({
                    status,
                    closed_by: BLOCKING_STATUSES.includes(status) ? employeeId ?? null : null,
                    closed_at: BLOCKING_STATUSES.includes(status) ? new Date() : null,
                    notes: notes ?? period.notes,
                    updated_at: new Date(),
               });

          return db('acc_periods').where({ period_code: periodCode }).first();
     }

     async getPeriodTotals(periodCode: string): Promise<{ debits: number; credits: number; entries: number }> {
          const db = await this.connection();
          const period = await db('acc_periods').where({ period_code: periodCode }).first();
          if (!period) throw new PeriodNotFoundError(periodCode);

          const row = await db('acc_journal_lines as l')
               .join('acc_journal_entries as e', 'l.journal_entry_id', 'e.id')
               .whereBetween(db.raw('DATE(e.occurred_at)'), [period.period_start, period.period_end])
               .andWhere('e.status', '!=', 'voided')
               .select(
                    db.raw("COALESCE(SUM(CASE WHEN l.direction = 'debit' THEN l.amount ELSE 0 END), 0) AS debits"),
                    db.raw("COALESCE(SUM(CASE WHEN l.direction = 'credit' THEN l.amount ELSE 0 END), 0) AS credits"),
                    db.raw('COUNT(DISTINCT e.id) AS entries')
               )
               .first();

          return {
               debits: Number(row?.debits || 0),
               credits: Number(row?.credits || 0),
               entries: Number(row?.entries || 0),
          };
     }
}

function toPeriodCode(date: Date): string {
     return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function toDateOnly(date: Date): string {
     return date.toISOString().split('T')[0];
}

function round2(value: number): number {
     return Math.round(value * 100) / 100;
}
