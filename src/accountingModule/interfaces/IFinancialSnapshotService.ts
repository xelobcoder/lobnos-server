export interface FinancialDaySnapshot {
     branchId: number;
     financialDate: string;
     totals: Record<string, number>;
     recordCounts: Record<string, number>;
     discrepancies: Array<{ code: string; message: string; amount?: number }>;
     outboxPending: number;
     outboxFailed: number;
     ledgerDebits: number;
     ledgerCredits: number;
     hash: string;
}

export interface IFinancialSnapshotService {
     /**
      * Builds a deterministic branch/day snapshot from source records and posted journal lines.
      * The hash excludes generated timestamps so repeated reads of unchanged financial data match.
      */
     create(branchId: number, financialDate: string): Promise<FinancialDaySnapshot>;
}
