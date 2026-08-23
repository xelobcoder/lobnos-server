import KnexConnection from '../../database/KnexConnections';
import { FinanceLedgerService } from '../../services/finance/FinanceLedgerService';
import { ensureAccountingSchema } from '../init/accountingSchemaInit';
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
import {
     AccountNotFoundError,
     EmptyTransactionError,
     JournalEntryNotFoundError,
     UnbalancedTransactionError,
} from '../errors/AccountingErrors';

const BALANCE_TOLERANCE = 0.01;

export class AccountingService implements IAccountingService {
     constructor(private repository: IAccountingRepository) { }

     async postTransaction(input: PostTransactionDto): Promise<{ entry: IJournalEntry; lines: IJournalLine[] }> {
          if (!input.lines || input.lines.length === 0) {
               throw new EmptyTransactionError();
          }

          // must run even when the caller passes its own trx, since a supplied trx skips the repository's lazy schema check
          await ensureAccountingSchema(input.tenantId);

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

          await new AccountingPeriodService(input.tenantId).assertPostingAllowed(
               input.occurredAt || new Date(),
               input.trx
          );

          const resolvedLines = await Promise.all(
               input.lines.map(async (line) => {
                    const account = await this.repository.findAccountByCode(line.accountCode, input.trx);
                    if (!account) {
                         throw new AccountNotFoundError(line.accountCode);
                    }
                    return { line, accountId: account.id };
               })
          );

          const totalDebits = round2(sumByDirection(input.lines, NormalBalance.DEBIT));
          const totalCredits = round2(sumByDirection(input.lines, NormalBalance.CREDIT));

          if (Math.abs(totalDebits - totalCredits) > BALANCE_TOLERANCE) {
               throw new UnbalancedTransactionError(totalDebits, totalCredits);
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
                    })),
                    trx
               );

               // dual-write into the legacy single-entry ledger so existing finance_ledger consumers keep working
               for (const { line } of resolvedLines) {
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
                         sourceRef: input.sourceRef || '',
                         billingid: line.billingid ?? null,
                         expenseId: line.expenseId ?? null,
                         invoiceId: line.invoiceId ?? null,
                         employeeid: line.employeeid ?? null,
                         branchid: line.branchid ?? null,
                    });
               }

               return { entry, lines };
          };

          if (input.trx) {
               return runInTransaction(input.trx);
          }

          const db = await KnexConnection(input.tenantId);
          return db.transaction((trx) => runInTransaction(trx));
     }

     async reverse(input: ReverseTransactionDto): Promise<{ entry: IJournalEntry; lines: IJournalLine[] }> {
          await ensureAccountingSchema(input.tenantId);

          const original = await this.repository.findJournalEntryById(input.journalEntryId, input.trx);
          if (!original) {
               throw new JournalEntryNotFoundError(input.journalEntryId);
          }

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
               createdBy: input.createdBy,
               reversalOfEntryId: original.id,
               lines: reversalLines,
          });

          await this.repository.markEntryStatus(original.id, JournalStatus.REVERSED, input.trx);

          return reversal;
     }
}

function sumByDirection(lines: PostTransactionDto['lines'], direction: NormalBalance): number {
     return lines.filter((line) => line.direction === direction).reduce((total, line) => total + Number(line.amount), 0);
}

function round2(value: number): number {
     return Math.round(value * 100) / 100;
}
