import { IAccount } from './IAccount';
import { IJournalEntry } from './IJournalEntry';
import { IJournalLine } from './IJournalLine';
import { CreateAccountDto } from '../dto/CreateAccountDto';
import { SourceModule } from '../enums/source-module.enum';
import { TransactionType } from '../enums/transaction-type.enum';

export interface IAccountingRepository {
     findAccountByCode(accountCode: string, trx?: any): Promise<IAccount | null>;
     listAccounts(trx?: any): Promise<IAccount[]>;
     createAccount(input: CreateAccountDto, trx?: any): Promise<IAccount>;
     /** used for the idempotency key (source_module, source_table, source_pk, transaction_type) so retried requests never double-post */
     findJournalEntryBySource(
          sourceModule: SourceModule,
          sourceTable: string,
          sourcePk: number,
          transactionType: TransactionType,
          trx?: any
     ): Promise<IJournalEntry | null>;
     findJournalEntryById(journalEntryId: number, trx?: any): Promise<IJournalEntry | null>;
     findLinesByJournalEntryId(journalEntryId: number, trx?: any): Promise<IJournalLine[]>;
     createJournalEntry(
          entry: Omit<IJournalEntry, 'id' | 'created_at'>,
          lines: Omit<IJournalLine, 'id' | 'journal_entry_id' | 'created_at'>[],
          trx?: any
     ): Promise<{ entry: IJournalEntry; lines: IJournalLine[] }>;
     markEntryStatus(journalEntryId: number, status: IJournalEntry['status'], trx?: any): Promise<void>;
}

