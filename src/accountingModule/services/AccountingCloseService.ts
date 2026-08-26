import KnexConnection from '../../database/KnexConnections';
import { createAccountingService } from '../index';
import { AccountingReportService } from './AccountingReportService';
import { AccountingError, EmptyTransactionError, UnbalancedTransactionError } from '../errors/AccountingErrors';
import { NormalBalance } from '../enums/normal-balance.enum';
import { SourceModule } from '../enums/source-module.enum';
import { TransactionType } from '../enums/transaction-type.enum';
import {
     IAccountingCloseService,
     OpeningBalanceLine,
     YearEndCloseResult,
} from '../interfaces/IAccountingCloseService';

const RETAINED_EARNINGS = 'acc-3001';
const BALANCE_TOLERANCE = 0.01;

export class AccountingCloseService implements IAccountingCloseService {
     constructor(private tenantId: number) { }

     private async connection() {
          return KnexConnection(this.tenantId);
     }

     async closeFiscalYear(fiscalYear: number, employeeId?: number | null): Promise<YearEndCloseResult> {
          const db = await this.connection();
          const yearEnd = `${fiscalYear}-12-31`;

          const existing = await db('acc_journal_entries')
               .where({
                    source_module: SourceModule.MANUAL,
                    source_table: 'acc_year_close',
                    source_pk: fiscalYear,
                    transaction_type: TransactionType.ADJUSTMENT,
               })
               .first();

          if (existing) {
               return {
                    fiscalYear,
                    revenueClosed: 0,
                    expensesClosed: 0,
                    netProfit: 0,
                    journalEntryId: existing.id,
                    alreadyClosed: true,
               };
          }

          const { rows } = await new AccountingReportService(this.tenantId).trialBalance(undefined, yearEnd);
          const revenue = rows.filter((row) => row.type === 'revenue' && row.balance !== 0);
          const expenses = rows.filter((row) => row.type === 'expense' && row.balance !== 0);

          if (revenue.length === 0 && expenses.length === 0) {
               throw new AccountingError(
                    `Fiscal year ${fiscalYear} has no revenue or expense balances to close`,
                    'NOTHING_TO_CLOSE',
                    409
               );
          }

          const revenueTotal = round2(revenue.reduce((total, row) => total + row.balance, 0));
          const expenseTotal = round2(expenses.reduce((total, row) => total + row.balance, 0));
          const netProfit = round2(revenueTotal - expenseTotal);

          const lines = [
               ...revenue.map((row) => ({
                    accountCode: row.account_code,
                    direction: row.balance > 0 ? NormalBalance.DEBIT : NormalBalance.CREDIT,
                    amount: Math.abs(row.balance),
               })),
               ...expenses.map((row) => ({
                    accountCode: row.account_code,
                    direction: row.balance > 0 ? NormalBalance.CREDIT : NormalBalance.DEBIT,
                    amount: Math.abs(row.balance),
               })),
               {
                    accountCode: RETAINED_EARNINGS,
                    direction: netProfit >= 0 ? NormalBalance.CREDIT : NormalBalance.DEBIT,
                    amount: Math.abs(netProfit),
               },
          ].filter((line) => line.amount > 0);

          const { entry } = await createAccountingService(this.tenantId).postTransaction({
               tenantId: this.tenantId,
               transactionType: TransactionType.ADJUSTMENT,
               sourceModule: SourceModule.MANUAL,
               sourceTable: 'acc_year_close',
               sourcePk: fiscalYear,
               description: `Year-end close ${fiscalYear}`,
               occurredAt: yearEnd,
               createdBy: employeeId ?? null,
               lines,
          });

          return {
               fiscalYear,
               revenueClosed: revenueTotal,
               expensesClosed: expenseTotal,
               netProfit,
               journalEntryId: entry.id,
               alreadyClosed: false,
          };
     }

     async postOpeningBalances(
          asOf: string,
          lines: OpeningBalanceLine[],
          employeeId?: number | null
     ): Promise<{ journalEntryId: number; debits: number; credits: number }> {
          if (!lines || lines.length === 0) throw new EmptyTransactionError();

          const db = await this.connection();

          const anyPosting = await db('acc_journal_entries')
               .whereNot({ source_table: 'acc_opening_balances' })
               .first();

          if (anyPosting) {
               throw new AccountingError(
                    'Opening balances can only be entered before any other transaction has been posted',
                    'LEDGER_NOT_EMPTY',
                    409
               );
          }

          const debits = round2(lines.reduce((total, line) => total + Number(line.debit || 0), 0));
          const credits = round2(lines.reduce((total, line) => total + Number(line.credit || 0), 0));

          if (Math.abs(debits - credits) > BALANCE_TOLERANCE) {
               throw new UnbalancedTransactionError(debits, credits);
          }

          const postingLines = lines
               .map((line) => ({
                    accountCode: line.accountCode,
                    direction: Number(line.debit || 0) > 0 ? NormalBalance.DEBIT : NormalBalance.CREDIT,
                    amount: Number(line.debit || 0) > 0 ? Number(line.debit) : Number(line.credit || 0),
               }))
               .filter((line) => line.amount > 0);

          const { entry } = await createAccountingService(this.tenantId).postTransaction({
               tenantId: this.tenantId,
               transactionType: TransactionType.ADJUSTMENT,
               sourceModule: SourceModule.MANUAL,
               sourceTable: 'acc_opening_balances',
               sourcePk: 1,
               description: `Opening balances as at ${asOf}`,
               occurredAt: asOf,
               createdBy: employeeId ?? null,
               lines: postingLines,
          });

          return { journalEntryId: entry.id, debits, credits };
     }
}

function round2(value: number): number {
     return Math.round(value * 100) / 100;
}
