import { BankDateFormat } from '../utils/bankWorkbook';

export interface BankAccount {
     id: number;
     name: string;
     bank_name: string | null;
     account_number: string | null;
     gl_account_code: string;
     branchid: number | null;
     is_active: boolean;
     /** Joined and counted by listAccounts only, so the setup screen can show reconciliation state. */
     gl_account_name?: string | null;
     total_lines?: number;
     unmatched_lines?: number;
     last_statement_date?: string | null;
}

export interface BankStatementLine {
     id: number;
     bank_account_id: number;
     txn_date: string;
     description: string | null;
     reference: string | null;
     /** signed: positive is money into the bank, negative is money out */
     amount: number;
     status: 'unmatched' | 'matched' | 'ignored';
     matched_journal_line_id: number | null;
     matched_by: number | null;
     matched_at: Date | null;
}

export interface ImportStatementInput {
     bankAccountId: number;
     importedBy: number;
     lines: Array<{
          txnDate: string;
          description?: string | null;
          reference?: string | null;
          amount: number;
     }>;
}

export interface ImportResult {
     imported: number;
     skipped: number;
     problems?: string[];
}

export interface MatchSuggestion {
     statementLineId: number;
     journalLineId: number;
     journalEntryId: number;
     occurredAt: string;
     description: string | null;
     amount: number;
     dayGap: number;
}

export interface ReconciliationSummary {
     bankAccountId: number;
     asOf: string;
     glBalance: number;
     statementBalance: number;
     outstandingDeposits: number;
     outstandingPayments: number;
     adjustedBankBalance: number;
     difference: number;
     unmatchedStatementLines: number;
     unmatchedLedgerLines: number;
}

export interface IBankReconciliationService {
     listAccounts(): Promise<BankAccount[]>;

     /**
      * Bank accounts map to a GL account rather than replacing it, so several banks and a petty
      * cash float can each be reconciled separately while still rolling up to the same control
      * account on the balance sheet.
      */
     createAccount(input: Omit<BankAccount, 'id' | 'is_active'> & { is_active?: boolean }): Promise<BankAccount>;

     /**
      * Only the descriptive fields and the active flag may change. The GL mapping is fixed once
      * lines have been reconciled against it, because moving it would silently invalidate every
      * match already made.
      */
     updateAccount(id: number, input: Partial<Pick<BankAccount, 'name' | 'bank_name' | 'account_number' | 'gl_account_code' | 'branchid' | 'is_active'>>): Promise<BankAccount>;

     /**
      * Appends statement lines. Idempotent on (account, date, amount, reference) so re-importing an
      * overlapping statement window cannot duplicate transactions.
      */
     importStatement(input: ImportStatementInput): Promise<ImportResult>;

     importExcel(input: { bankAccountId: number; importedBy: number; buffer: Buffer; dateFormat?: BankDateFormat }): Promise<ImportResult>;

     statementLines(
          bankAccountId: number,
          filters?: { from?: string; to?: string; status?: string; page?: number; count?: number }
     ): Promise<{ data: BankStatementLine[]; total: number; page: number; count: number }>;

     /** Ledger postings against the bank's GL account that no statement line has claimed yet. */
     unmatchedLedgerLines(bankAccountId: number, from?: string, to?: string): Promise<any[]>;

     /**
      * Proposes pairings on equal amount and closest date within a tolerance. Deliberately
      * conservative: a statement line with two equally plausible candidates is left for a human.
      */
     suggestMatches(bankAccountId: number, from?: string, to?: string, dayTolerance?: number): Promise<MatchSuggestion[]>;

     match(statementLineId: number, journalLineId: number, employeeId: number): Promise<void>;
     unmatch(statementLineId: number, employeeId: number): Promise<void>;
     ignore(statementLineId: number, employeeId: number): Promise<void>;

     /**
      * The classic reconciliation: ledger balance adjusted for items the bank has not yet seen
      * should equal the statement balance. A non-zero difference is unexplained.
      */
     summary(bankAccountId: number, asOf: string, statementBalance: number): Promise<ReconciliationSummary>;
}
