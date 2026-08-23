export interface YearEndCloseResult {
     fiscalYear: number;
     revenueClosed: number;
     expensesClosed: number;
     netProfit: number;
     journalEntryId: number;
     alreadyClosed: boolean;
}

export interface OpeningBalanceLine {
     accountCode: string;
     debit?: number;
     credit?: number;
}

export interface IAccountingCloseService {
     /**
      * Zeroes every revenue and expense account into retained earnings, dated the last day of the
      * fiscal year. Posting is idempotent on the year, so re-running returns the existing entry
      * rather than closing twice.
      *
      * Balances are read as at year end without a lower bound, which is correct only while prior
      * years have themselves been closed — an unclosed prior year would be swept in a second time.
      */
     closeFiscalYear(fiscalYear: number, employeeId?: number | null): Promise<YearEndCloseResult>;

     /**
      * One-off journal for onboarding an existing laboratory, dated the day before the first
      * trading day. Rejected once any other posting exists for the tenant, because opening
      * balances entered after trading has begun would double count.
      */
     postOpeningBalances(
          asOf: string,
          lines: OpeningBalanceLine[],
          employeeId?: number | null
     ): Promise<{ journalEntryId: number; debits: number; credits: number }>;
}
