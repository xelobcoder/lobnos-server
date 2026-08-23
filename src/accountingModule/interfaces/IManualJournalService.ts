export type ManualJournalStatus = 'draft' | 'submitted' | 'approved' | 'posted' | 'void';

export interface IManualJournalLine {
     id?: number;
     manual_journal_id?: number;
     account_code: string;
     direction: 'debit' | 'credit';
     amount: number;
     branchid?: number | null;
     employeeid?: number | null;
     line_description?: string | null;
}

export interface IManualJournal {
     id: number;
     journal_no: string;
     journal_date: Date | string;
     description: string;
     reference: string | null;
     status: ManualJournalStatus;
     journal_entry_id: number | null;
     created_by: number | null;
     submitted_by: number | null;
     approved_by: number | null;
     posted_by: number | null;
     submitted_at: Date | null;
     approved_at: Date | null;
     posted_at: Date | null;
     notes: string | null;
}

export interface CreateManualJournalInput {
     journalDate: Date | string;
     description: string;
     reference?: string | null;
     notes?: string | null;
     createdBy?: number | null;
     lines: IManualJournalLine[];
}

export interface IManualJournalService {
     /**
      * Creates a draft. Lines are validated for balance and for account existence up front so the
      * author sees the problem immediately rather than at posting time.
      */
     create(input: CreateManualJournalInput): Promise<IManualJournal>;

     /** Replaces the draft's header and lines. Only `draft` may be edited. */
     update(id: number, input: CreateManualJournalInput): Promise<IManualJournal>;

     /**
      * Advances draft to submitted, submitted to approved. Approval and submission must be
      * different people: a journal that can be raised and approved by one person is not a control.
      */
     submit(id: number, employeeId: number): Promise<IManualJournal>;
     approve(id: number, employeeId: number): Promise<IManualJournal>;

     /**
      * Posts an approved journal to the ledger synchronously, so a closed period or an unbalanced
      * entry is reported to the user instead of failing later on the outbox. Posted journals are
      * immutable — correct them with a reversal.
      */
     post(id: number, employeeId: number): Promise<IManualJournal>;

     /** Posts the mirror image of a posted journal and marks the original reversed. */
     reverse(id: number, employeeId: number, description?: string): Promise<IManualJournal>;

     /** Discards a journal that was never posted. */
     void(id: number, employeeId: number, reason?: string): Promise<IManualJournal>;

     findById(id: number): Promise<{ journal: IManualJournal; lines: IManualJournalLine[] } | null>;
     list(filters: { status?: ManualJournalStatus; from?: string; to?: string; page?: number; count?: number }): Promise<{ data: IManualJournal[]; total: number; page: number; count: number }>;
}
