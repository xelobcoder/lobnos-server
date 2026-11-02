import KnexConnection from '../../database/KnexConnections';
import { FinanceLedgerService } from '../../services/finance/FinanceLedgerService';
import { AccountingPeriodService } from './AccountingPeriodService';
import { IAccountingService } from '../interfaces/IAccountingService';
import { IAccountingRepository } from '../interfaces/IAccountingRepository';
import { IJournalEntry } from '../interfaces/IJournalEntry';
import { IJournalLine } from '../interfaces/IJournalLine';
import { PostTransactionDto } from '../dto/PostTransactionDto';
import { ReverseTransactionDto } from '../dto/ReverseTransactionDto';
import { NormalBalance } from '../enums/normal-balance.enum';
import { JournalStatus } from '../enums/journal-status.enum';
import { TransactionType } from '../enums/transaction-type.enum';
import { SourceModule } from '../enums/source-module.enum';
import {
     AccountNotFoundError,
     PeriodClosedError,
     EmptyTransactionError,
     JournalEntryNotFoundError,
     UnbalancedTransactionError,
} from '../errors/AccountingErrors';

import { minorUnits, sumMinor } from '../utils/money';
import { AccountingError } from '../errors/AccountingErrors';

export class AccountingService implements IAccountingService {
     constructor(private repository: IAccountingRepository) { }

     async postTransaction(input: PostTransactionDto): Promise<{ entry: IJournalEntry; lines: IJournalLine[] }> {
          if (!input.lines || input.lines.length === 0) {
               throw new EmptyTransactionError();
          }

          // All validation and the period check share the posting transaction and its lock.
          if (!input.trx) {
               const db = await KnexConnection(input.tenantId);
               return db.transaction((trx) => this.postTransaction({ ...input, trx }));
          }
          const normalised = input.lines.map(line => {
               const amount = minorUnits(line.amount);
               if (amount < 0 || ![NormalBalance.DEBIT, NormalBalance.CREDIT].includes(line.direction)) throw new AccountingError('Invalid journal line', 'INVALID_JOURNAL_LINE', 400);
               return { ...line, amount: amount / 100 };
          });
          input = { ...input, lines: normalised };
          const period = await new AccountingPeriodService(input.tenantId).lockPeriodForDate(input.occurredAt || new Date(), input.trx);

          const existing = await this.repository.findJournalEntryBySource(
               input.sourceModule,
               input.sourceTable,
               input.sourcePk,
               input.transactionType,
               input.sourceRef || '',
               input.trx
          );

          if (existing) {
               const lines = await this.repository.findLinesByJournalEntryId(existing.id, input.trx);
               return { entry: existing, lines };
          }

          if (['closed', 'locked'].includes(period.status)) throw new PeriodClosedError(period.period_code, period.status);
          const resolvedLines = await Promise.all(
               input.lines.map(async (line) => {
                    const account = await this.repository.findAccountByCode(line.accountCode, input.trx);
                    if (!account) {
                         throw new AccountNotFoundError(line.accountCode);
                    }
                    if (account.is_active === false || Number(account.is_active) === 0) throw new AccountingError('Account is inactive', 'ACCOUNT_INACTIVE', 400);
                    return { line, accountId: account.id };
               })
          );

          const totalDebits = sumMinor(input.lines.filter(line => line.direction === NormalBalance.DEBIT).map(line => line.amount));
          const totalCredits = sumMinor(input.lines.filter(line => line.direction === NormalBalance.CREDIT).map(line => line.amount));

          if (totalDebits <= 0 || totalCredits <= 0) throw new EmptyTransactionError();
          if (totalDebits !== totalCredits) {
               throw new UnbalancedTransactionError(totalDebits / 100, totalCredits / 100);
          }

          const runInTransaction = async (trx: any) => {
               const { entry, lines } = await this.repository.createJournalEntry(
                    {
                         transaction_type: input.transactionType,
                         source_module: input.sourceModule,
                         source_table: input.sourceTable,
                         source_pk: input.sourcePk,
                         source_ref: input.sourceRef || '',
                         description: input.description || null,
                         occurred_at: input.occurredAt ? new Date(input.occurredAt) : new Date(),
                         status: JournalStatus.POSTED,
                         reversal_of_entry_id: input.reversalOfEntryId ?? null,
                         created_by: input.createdBy ?? null,
                    },
                    resolvedLines.map(({ line, accountId }) => ({
                         account_id: accountId,
                         direction: line.direction,
                         amount: Number(line.amount),
                         branchid: line.branchid ?? null,
                         billingid: line.billingid ?? null,
                         expense_id: line.expenseId ?? null,
                         invoice_id: line.invoiceId ?? null,
                         employeeid: line.employeeid ?? null,
                         ...(line.partyType ? { party_type: line.partyType, party_ref: line.partyRef, party_name: line.partyName, document_ref: line.documentRef } : {}),
                    })),
                    trx
               );

               // dual-write into the legacy single-entry ledger so existing finance_ledger consumers keep working
               for (const [index, { line }] of resolvedLines.entries()) {
                    await FinanceLedgerService.recordEntry({
                         tenantId: input.tenantId,
                         trx,
                         occurredAt: entry.occurred_at,
                         direction: line.direction,
                         amount: Number(line.amount),
                         accountRef: line.accountCode,
                         sourceModule: input.sourceModule,
                         sourceTable: input.sourceTable,
                         sourcePk: input.sourcePk,
                         sourceRef: input.sourceModule === SourceModule.PHARMACY ? `${input.sourceRef}:line:${index}` : input.sourceRef || '',
                         billingid: line.billingid ?? null,
                         expenseId: line.expenseId ?? null,
                         invoiceId: line.invoiceId ?? null,
                         employeeid: line.employeeid ?? null,
                         branchid: line.branchid ?? null,
                    });
               }

               return { entry, lines };
          };

          return runInTransaction(input.trx);
     }

     async reverse(input: ReverseTransactionDto): Promise<{ entry: IJournalEntry; lines: IJournalLine[] }> {
          if (!input.trx) {
               const db = await KnexConnection(input.tenantId);
               return db.transaction((trx) => this.reverse({ ...input, trx }));
          }
          const reversedAt = new Date();
          await new AccountingPeriodService(input.tenantId).lockPeriodForDate(reversedAt, input.trx);
          // Serialize reversals of the same entry, including concurrent retries.
          await input.trx('acc_journal_entries').where({ id: input.journalEntryId }).forUpdate().first();
          const original = await this.repository.findJournalEntryById(input.journalEntryId, input.trx);
          if (!original) {
               throw new JournalEntryNotFoundError(input.journalEntryId);
          }
          if (original.source_module === SourceModule.PHARMACY) throw new AccountingError('Reverse the original pharmacy source document through Pharmacy Accounting so both ledgers and allocations remain consistent', 'PHARMACY_SOURCE_REVERSAL_REQUIRED', 409);

          if (original.transaction_type === TransactionType.REVERSAL) throw new AccountingError('Create a correcting journal instead of reversing a reversal', 'INVALID_REVERSAL', 409);
          const originalLines = await this.repository.findLinesByJournalEntryId(original.id, input.trx);
          const accounts = await this.repository.listAccounts(input.trx);
          const accountCodeById = new Map(accounts.map((account) => [account.id, account.account_code]));

          const reversalLines = originalLines.map((line) => ({
               accountCode: accountCodeById.get(line.account_id) as string,
               direction: line.direction === NormalBalance.DEBIT ? NormalBalance.CREDIT : NormalBalance.DEBIT,
               amount: Number(line.amount),
               branchid: line.branchid,
               billingid: line.billingid,
               expenseId: line.expense_id,
               invoiceId: line.invoice_id,
               employeeid: line.employeeid,
               partyType: line.party_type,
               partyRef: line.party_ref,
               partyName: line.party_name,
               documentRef: line.document_ref,
          }));

          const reversal = await this.postTransaction({
               tenantId: input.tenantId,
               trx: input.trx,
               transactionType: TransactionType.REVERSAL,
               sourceModule: original.source_module,
               sourceTable: original.source_table,
               sourcePk: original.source_pk,
               sourceRef: original.source_ref || '',
               description: input.description || `Reversal of journal entry ${original.id}`,
               occurredAt: reversedAt,
               createdBy: input.createdBy,
               reversalOfEntryId: original.id,
               lines: reversalLines,
          });

          await this.repository.markEntryStatus(original.id, JournalStatus.REVERSED, input.trx);

          return reversal;
     }
}
