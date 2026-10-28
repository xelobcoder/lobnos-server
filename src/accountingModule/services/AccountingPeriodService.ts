import KnexConnection from '../../database/KnexConnections';
import { IAccountingPeriod, PeriodStatus } from '../interfaces/IAccountingPeriod';
import { IAccountingPeriodService } from '../interfaces/IAccountingPeriodService';
import { AccountingReportService } from './AccountingReportService';
import { AccountingError, PeriodClosedError, PeriodNotFoundError, UnbalancedTransactionError } from '../errors/AccountingErrors';

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

     async lockPeriodForDate(date: Date | string, trx: any): Promise<IAccountingPeriod> {
          const target = new Date(date);
          if (!Number.isFinite(target.getTime())) throw new AccountingError('Invalid posting date', 'INVALID_DATE', 400);
          await this.ensurePeriodForDate(date, trx);
          return trx('acc_periods').where({ period_code: toPeriodCode(target) }).forUpdate().first();
     }

     async assertPostingAllowed(date: Date | string, trx?: any): Promise<void> {
          if (!trx) {
               const db = await this.connection();
               return db.transaction((transaction: any) => this.assertPostingAllowed(date, transaction));
          }
          const period = await this.lockPeriodForDate(date, trx);
          if (BLOCKING_STATUSES.includes(period.status)) throw new PeriodClosedError(period.period_code, period.status);
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
          const connection = await this.connection();
          return connection.transaction(async (db: any) => {
          const period = await db('acc_periods').where({ period_code: periodCode }).forUpdate().first();
          if (!period) throw new PeriodNotFoundError(periodCode);

          if (BLOCKING_STATUSES.includes(status)) {
               const pending = await db('acc_posting_outbox').whereNot({ status: 'posted' }).whereRaw("COALESCE(DATE(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.occurredAt'))), DATE(created_at)) BETWEEN ? AND ?", [period.period_start, period.period_end]).first();
               if (pending) throw new AccountingError('Resolve pending or failed accounting postings before closing this period', 'UNPOSTED_TRANSACTIONS', 409);
               const totals = await this.getPeriodTotals(periodCode, db);
               if (round2(totals.debits) !== round2(totals.credits)) {
                    throw new UnbalancedTransactionError(round2(totals.debits), round2(totals.credits));
               }
               const cashFlow = await new AccountingReportService(this.tenantId, db).cashFlow(toDateOnly(new Date(period.period_start)), toDateOnly(new Date(period.period_end)));
               if (cashFlow.classificationIssues?.length) throw new AccountingError('Review compound journal cash-flow classifications before closing this period', 'CASH_FLOW_CLASSIFICATION_REQUIRED', 409);
               if (cashFlow.reconciliation?.balanced === false) throw new AccountingError('Cash flow must reconcile to the ledger before closing this period', 'UNRECONCILED_CASH_FLOW', 409);
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

          await db('acc_control_audit').insert({ action: 'period_status', entity_id: period.id, employee_id: employeeId ?? null, before_state: JSON.stringify(period), after_state: JSON.stringify({ status, notes: notes ?? period.notes }), created_at: new Date() });
          return db('acc_periods').where({ period_code: periodCode }).first();
          });
     }

     async getPeriodTotals(periodCode: string, trx?: any): Promise<{ debits: number; credits: number; entries: number }> {
          const db = await this.connection(trx);
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
