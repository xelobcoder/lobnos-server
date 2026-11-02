import { NormalBalance } from '../enums/normal-balance.enum';

export interface IJournalLine {
     id: number;
     journal_entry_id: number;
     account_id: number;
     direction: NormalBalance;
     amount: number;
     branchid?: number | null;
     billingid?: number | null;
     expense_id?: number | null;
     invoice_id?: number | null;
     employeeid?: number | null;
     party_type?: string;
     party_ref?: string;
     party_name?: string;
     document_ref?: string;
     created_at?: Date;
}
