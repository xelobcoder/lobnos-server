import { IAccountingPeriod, PeriodStatus } from './IAccountingPeriod';

export interface IAccountingPeriodService {
     /**
      * Returns the period covering the date, creating it as `open` when it does not exist yet.
      * Periods are calendar months keyed `YYYY-MM`.
      */
     ensurePeriodForDate(date: Date | string, trx?: any): Promise<IAccountingPeriod>;

     /**
      * Throws PeriodClosedError when the date falls in a `closed` or `locked` period.
      * `soft_closed` is deliberately permissive: it signals "review in progress" without blocking
      * the operational side of the business, which must keep trading while the books are reviewed.
      */
     assertPostingAllowed(date: Date | string, trx?: any): Promise<void>;

     list(from?: string, to?: string): Promise<IAccountingPeriod[]>;

     /**
      * Moving to `closed` or `locked` requires the period's postings to be balanced; an unbalanced
      * period means the outbox still has unposted or failed work and closing would hide it.
      */
     setStatus(periodCode: string, status: PeriodStatus, employeeId?: number | null, notes?: string): Promise<IAccountingPeriod>;

     /** Debit/credit totals for the period, used both for the trial balance and the close check. */
     getPeriodTotals(periodCode: string): Promise<{ debits: number; credits: number; entries: number }>;
}
