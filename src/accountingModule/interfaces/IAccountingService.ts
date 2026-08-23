import { IJournalEntry } from './IJournalEntry';
import { IJournalLine } from './IJournalLine';
import { PostTransactionDto } from '../dto/PostTransactionDto';
import { ReverseTransactionDto } from '../dto/ReverseTransactionDto';

export interface IAccountingService {
     /**
      * Rejects with UnbalancedTransactionError unless sum(debit lines) === sum(credit lines).
      * Idempotent on (sourceModule, sourceTable, sourcePk, transactionType): a repeated call
      * returns the existing entry instead of posting a duplicate. Writes the header and all
      * lines in a single DB transaction, and dual-writes matching rows into the legacy
      * finance_ledger table so existing consumers keep working during the migration.
      */
     postTransaction(input: PostTransactionDto): Promise<{ entry: IJournalEntry; lines: IJournalLine[] }>;
     /**
      * Never mutates or deletes the original entry. Creates a new entry with
      * transactionType REVERSAL and reversalOfEntryId set, posting the exact opposite
      * direction for every line of the original entry.
      */
     reverse(input: ReverseTransactionDto): Promise<{ entry: IJournalEntry; lines: IJournalLine[] }>;
}
