export type SubledgerName = 'AR' | 'AP';

export type SubledgerDocumentType =
     | 'invoice'
     | 'adjustment'
     | 'payment'
     | 'credit_note'
     | 'write_off'
     | 'refund'
     | 'bill'
     | 'supplier_payment';

export interface SubledgerEntryInput {
     ledger: SubledgerName;
     partyType: string;
     partyId: number | null;
     partyName?: string | null;
     documentType: SubledgerDocumentType;
     documentRef: string;
     documentDate: Date | string;
     dueDate?: Date | string | null;
     /** signed: positive increases what is owed, negative settles it */
     amount: number;
     grossAmount?: number;
     taxAmount?: number;
     sourceModule: string;
     sourceTable: string;
     sourceRef: string;
     branchid?: number | null;
}

export interface SubledgerEntry extends SubledgerEntryInput {
     id: number;
     created_at: Date;
}

export interface PartyBalance {
     partyType: string;
     partyId: number | null;
     partyName: string | null;
     documents: number;
     charged: number;
     settled: number;
     balance: number;
     oldestDocumentDate: string | null;
}

export interface AgingRow {
     partyType: string;
     partyId: number | null;
     partyName: string | null;
     reference: string;
     documentDate: string;
     ageDays: number;
     current: number;
     days30: number;
     days60: number;
     days90: number;
     over90: number;
     total: number;
}

export interface ISubledgerService {
     /**
      * Appends an entry. Idempotent on (ledger, source_table, source_ref), so a replayed posting
      * cannot inflate a party's balance.
      */
     record(entry: SubledgerEntryInput, trx?: any): Promise<void>;

     /** Net balance per party, i.e. charges less settlements. */
     balances(ledger: SubledgerName, asOf?: string): Promise<PartyBalance[]>;

     /**
      * Open documents bucketed by age. Settlements are applied oldest-first within a party rather
      * than matched to a specific document, because the operational tables do not record which
      * invoice a payment was meant for.
      */
     aging(ledger: SubledgerName, asOf?: string): Promise<{ rows: AgingRow[]; totals: Omit<AgingRow, 'partyType' | 'partyId' | 'partyName' | 'reference' | 'documentDate' | 'ageDays'> }>;

     /** Every entry for one party, oldest first, with a running balance. */
     statement(
          ledger: SubledgerName,
          partyType: string,
          partyId: number,
          from?: string,
          to?: string
     ): Promise<{ entries: Array<SubledgerEntry & { runningBalance: number }>; openingBalance: number; closingBalance: number }>;

     /**
      * Compares the subledger total against its control account in the general ledger. A non-zero
      * difference means a posting reached one and not the other.
      */
     reconcile(ledger: SubledgerName, asOf?: string): Promise<{ subledger: number; generalLedger: number; difference: number }>;
}
