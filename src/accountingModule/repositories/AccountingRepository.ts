import KnexConnection from '../../database/KnexConnections';
import { IAccountingRepository } from '../interfaces/IAccountingRepository';
import { IAccount } from '../interfaces/IAccount';
import { IJournalEntry } from '../interfaces/IJournalEntry';
import { IJournalLine } from '../interfaces/IJournalLine';
import { CreateAccountDto } from '../dto/CreateAccountDto';
import { SourceModule } from '../enums/source-module.enum';
import { TransactionType } from '../enums/transaction-type.enum';

export class AccountingRepository implements IAccountingRepository {
     constructor(private tenantId: number) { }

     private async connection(trx?: any) {
          if (trx) return trx;
          return KnexConnection(this.tenantId);
     }

     async findAccountByCode(accountCode: string, trx?: any): Promise<IAccount | null> {
          const db = await this.connection(trx);
          const row = await db('acc_accounts').where({ account_code: accountCode }).first();
          return row || null;
     }

     async listAccounts(trx?: any): Promise<IAccount[]> {
          const db = await this.connection(trx);
          return db('acc_accounts').orderBy('account_code', 'asc');
     }

     async createAccount(input: CreateAccountDto, trx?: any): Promise<IAccount> {
          const db = await this.connection(trx);
          const [id] = await db('acc_accounts').insert({
               account_code: input.accountCode,
               name: input.name,
               type: input.type,
               normal_balance: input.normalBalance,
               parent_account_id: input.parentAccountId || null,
               is_active: true,
               created_at: new Date(),
               updated_at: new Date(),
          });
          return db('acc_accounts').where({ id }).first();
     }

     async findJournalEntryBySource(
          sourceModule: SourceModule,
          sourceTable: string,
          sourcePk: number,
          transactionType: TransactionType,
          sourceRef = '',
          trx?: any
     ): Promise<IJournalEntry | null> {
          const db = await this.connection(trx);
          const row = await db('acc_journal_entries')
               .where({
                    source_module: sourceModule,
                    source_table: sourceTable,
                    source_pk: sourcePk,
                    transaction_type: transactionType,
                    source_ref: sourceRef,
               })
               .modify((query: any) => { if (trx) query.forUpdate(); })
               .first();
          return row || null;
     }

     async findJournalEntryById(journalEntryId: number, trx?: any): Promise<IJournalEntry | null> {
          const db = await this.connection(trx);
          const row = await db('acc_journal_entries').where({ id: journalEntryId }).first();
          return row || null;
     }

     async findLinesByJournalEntryId(journalEntryId: number, trx?: any): Promise<IJournalLine[]> {
          const db = await this.connection(trx);
          return db('acc_journal_lines').where({ journal_entry_id: journalEntryId });
     }

     async createJournalEntry(
          entry: Omit<IJournalEntry, 'id' | 'created_at'>,
          lines: Omit<IJournalLine, 'id' | 'journal_entry_id' | 'created_at'>[],
          trx?: any
     ): Promise<{ entry: IJournalEntry; lines: IJournalLine[] }> {
          const db = await this.connection(trx);

          await db('acc_accounts').whereIn('id',[...new Set(lines.map(line=>line.account_id))]).orderBy('id').forUpdate().select('id');
          const [journalEntryId] = await db('acc_journal_entries').insert({
               transaction_type: entry.transaction_type,
               source_module: entry.source_module,
               source_table: entry.source_table,
               source_pk: entry.source_pk,
               source_ref: entry.source_ref || '',
               description: entry.description || null,
               occurred_at: entry.occurred_at,
               status: entry.status,
               reversal_of_entry_id: entry.reversal_of_entry_id,
               created_by: entry.created_by,
               created_at: new Date(),
          });

          const linePayloads = lines.map((line) => ({
               journal_entry_id: journalEntryId,
               account_id: line.account_id,
               direction: line.direction,
               amount: line.amount,
               branchid: line.branchid ?? null,
               billingid: line.billingid ?? null,
               expense_id: line.expense_id ?? null,
               invoice_id: line.invoice_id ?? null,
               employeeid: line.employeeid ?? null,
               ...(line.party_type ? { party_type: line.party_type, party_ref: line.party_ref, party_name: line.party_name, document_ref: line.document_ref } : {}),
               created_at: new Date(),
          }));

          await db('acc_journal_lines').insert(linePayloads);

          const savedEntry = await db('acc_journal_entries').where({ id: journalEntryId }).first();
          const savedLines = await db('acc_journal_lines').where({ journal_entry_id: journalEntryId });

          return { entry: savedEntry, lines: savedLines };
     }

     async markEntryStatus(journalEntryId: number, status: IJournalEntry['status'], trx?: any): Promise<void> {
          const db = await this.connection(trx);
          await db('acc_journal_entries').where({ id: journalEntryId }).update({ status });
     }
}
