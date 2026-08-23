export interface TrialBalanceRow {
     account_code: string;
     name: string;
     type: string;
     normal_balance: string;
     debits: number;
     credits: number;
     balance: number;
}

export interface LedgerLine {
     journal_entry_id: number;
     occurred_at: Date | string;
     transaction_type: string;
     source_module: string;
     source_table: string;
     source_pk: number;
     source_ref: string;
     description: string | null;
     account_code: string;
     account_name: string;
     direction: string;
     amount: number;
     branchid: number | null;
     billingid: number | null;
     expense_id: number | null;
     invoice_id: number | null;
     employeeid: number | null;
}

export interface IncomeStatement {
     revenue: TrialBalanceRow[];
     costOfSales: TrialBalanceRow[];
     operatingExpenses: TrialBalanceRow[];
     totals: {
          revenue: number;
          costOfSales: number;
          grossProfit: number;
          operatingExpenses: number;
          netProfit: number;
     };
}

export interface BalanceSheet {
     assets: TrialBalanceRow[];
     liabilities: TrialBalanceRow[];
     equity: TrialBalanceRow[];
     totals: {
          assets: number;
          liabilities: number;
          equity: number;
          retainedProfit: number;
          liabilitiesAndEquity: number;
          difference: number;
     };
}

export interface AgingBucket {
     reference: string;
     partyId: number | null;
     current: number;
     days30: number;
     days60: number;
     days90: number;
     over90: number;
     total: number;
}

export interface CashFlowLine {
     category: 'operating' | 'investing' | 'financing';
     accountCode: string;
     accountName: string;
     amount: number;
}

export interface CashFlowStatement {
     lines: CashFlowLine[];
     totals: {
          operating: number;
          investing: number;
          financing: number;
          netMovement: number;
          openingCash: number;
          closingCash: number;
     };
}

export interface PeriodBreakdownRow {
     accountCode: string;
     accountName: string;
     periods: Record<string, number>;
     total: number;
}

export interface BranchPerformanceRow {
     branchid: number | null;
     revenue: number;
     costOfSales: number;
     grossProfit: number;
     operatingExpenses: number;
     netProfit: number;
}

export interface InventoryValuationRow {
     itemId: string;
     name: string;
     sku: string | null;
     quantity: number;
     unitCost: number;
     value: number;
}

export interface InventoryValuation {
     rows: InventoryValuationRow[];
     totals: { quantity: number; value: number; generalLedger: number; difference: number };
}

export interface IAccountingReportService {
     /**
      * Balances are signed by the account's normal side, so a debit-normal account with more
      * credits than debits reports negative rather than flipping column.
      */
     trialBalance(from?: string, to?: string, branchId?: number): Promise<{ rows: TrialBalanceRow[]; totals: { debits: number; credits: number; balanced: boolean } }>;

     /** Flat journal line listing with its header joined, for the general ledger view and drill-down. */
     generalLedger(filters: {
          from?: string;
          to?: string;
          accountCode?: string;
          sourceModule?: string;
          branchId?: number;
          page?: number;
          count?: number;
     }): Promise<{ data: LedgerLine[]; total: number; page: number; count: number }>;

     incomeStatement(from: string, to: string, branchId?: number): Promise<IncomeStatement>;

     /**
      * Equity includes the profit earned in the period being reported, because the year-end close
      * that would roll it into retained earnings has not run yet. `difference` is the check figure
      * and must be zero.
      */
     balanceSheet(asOf: string, branchId?: number): Promise<BalanceSheet>;

     /** Outstanding customer balances bucketed by the age of the bill. */
     receivableAging(asOf?: string): Promise<{ rows: AgingBucket[]; totals: AgingBucket }>;

     /** Outstanding supplier balances bucketed by the age of the purchase order receipt. */
     payableAging(asOf?: string): Promise<{ rows: AgingBucket[]; totals: AgingBucket }>;

     /**
      * Direct-method cash flow. Only entries that actually move cash or bank are considered, and
      * the movement is attributed to the counterpart accounts on the same entry, so a transfer
      * between cash and bank nets to nothing rather than appearing twice.
      */
     cashFlow(from: string, to: string): Promise<CashFlowStatement>;

     /** Account balances split by calendar month, used for the revenue and expense analyses. */
     periodBreakdown(
          type: 'revenue' | 'expense',
          from: string,
          to: string,
          branchId?: number
     ): Promise<{ rows: PeriodBreakdownRow[]; periods: string[]; totals: Record<string, number> }>;

     /**
      * Revenue and cost by branch. Lines with no branch are grouped under null rather than dropped,
      * since supplier and inventory postings do not carry a branch yet.
      */
     branchPerformance(from: string, to: string): Promise<BranchPerformanceRow[]>;

     /**
      * Stock on hand valued at its most recent known unit cost, next to the inventory control
      * account so the two can be reconciled.
      */
     inventoryValuation(asOf?: string): Promise<InventoryValuation>;
}
