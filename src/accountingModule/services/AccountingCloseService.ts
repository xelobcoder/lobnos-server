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
import { minorUnits, sumMinor } from '../utils/money';
import { AccountingPeriodService } from './AccountingPeriodService';

export class AccountingCloseService implements IAccountingCloseService {
     constructor(private tenantId: number) { }

     private async connection() {
          return KnexConnection(this.tenantId);
     }

     async closeFiscalYear(fiscalYear: number, employeeId?: number | null): Promise<YearEndCloseResult> {
          if (!Number.isInteger(fiscalYear) || fiscalYear < 1900 || fiscalYear > 9999) throw new AccountingError('Invalid fiscal year', 'INVALID_FISCAL_YEAR', 400);
          const connection = await this.connection();
          return connection.transaction(async db => {
          // Take the same locks as posting before calculating the sweep. Read committed
          // avoids an earlier period-ensure read hiding postings committed while we waited.
          for (let month = 1; month <= 12; month++) {
               await new AccountingPeriodService(this.tenantId).lockPeriodForDate(`${fiscalYear}-${String(month).padStart(2, '0')}-01`, db);
          }
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

          const { rows } = await new AccountingReportService(this.tenantId, db).trialBalance(undefined, yearEnd);
          const revenue = rows.filter((row) => row.type === 'revenue' && row.balance !== 0);
          const expenses = rows.filter((row) => row.type === 'expense' && row.balance !== 0);

          if (revenue.length === 0 && expenses.length === 0) {
               throw new AccountingError(
                    `Fiscal year ${fiscalYear} has no revenue or expense balances to close`,
                    'NOTHING_TO_CLOSE',
                    409
               );
          }

          // Trial balance is normal-side signed, not revenue/expense signed. Contra
          // accounts must be closed against their actual debit/credit position.
          const revenueTotal = sumMinor(revenue.map(row => (minorUnits(row.credits) - minorUnits(row.debits)) / 100)) / 100;
          const expenseTotal = sumMinor(expenses.map(row => (minorUnits(row.debits) - minorUnits(row.credits)) / 100)) / 100;
          const netProfit = (minorUnits(revenueTotal) - minorUnits(expenseTotal)) / 100;

          const lines = [
               ...revenue.map((row) => ({
                    accountCode: row.account_code,
                    direction: row.credits > row.debits ? NormalBalance.DEBIT : NormalBalance.CREDIT,
                    amount: Math.abs(minorUnits(row.credits) - minorUnits(row.debits)) / 100,
               })),
               ...expenses.map((row) => ({
                    accountCode: row.account_code,
                    direction: row.debits > row.credits ? NormalBalance.CREDIT : NormalBalance.DEBIT,
                    amount: Math.abs(minorUnits(row.debits) - minorUnits(row.credits)) / 100,
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
               trx: db,
          });

          return {
               fiscalYear,
               revenueClosed: revenueTotal,
               expensesClosed: expenseTotal,
               netProfit,
               journalEntryId: entry.id,
               alreadyClosed: false,
          };
          }, { isolationLevel: 'read committed' });
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

          for (const line of lines) {
               const debit = minorUnits(line.debit || 0), credit = minorUnits(line.credit || 0);
               if (debit < 0 || credit < 0 || (debit > 0 && credit > 0)) throw new AccountingError('Enter either a positive debit or a positive credit per opening line', 'INVALID_JOURNAL_LINE', 400);
          }
          const debits = sumMinor(lines.map(line => line.debit || 0)) / 100;
          const credits = sumMinor(lines.map(line => line.credit || 0)) / 100;

          if (minorUnits(debits) !== minorUnits(credits)) {
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
