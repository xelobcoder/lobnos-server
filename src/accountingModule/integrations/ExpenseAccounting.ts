import KnexConnection from '../../database/KnexConnections';
import { enqueuePosting } from '../services/AccountingOutboxService';
import { IExpenseAccounting } from '../interfaces/IAccountingIntegrations';
import { NormalBalance } from '../enums/normal-balance.enum';
import { SourceModule } from '../enums/source-module.enum';
import { TransactionType } from '../enums/transaction-type.enum';
import logger from '../../hooks/logger';

const ACCOUNTS_PAYABLE = 'acc-2000';
const CASH = 'acc-1000';
const BANK = 'acc-1001';
const DEFAULT_EXPENSE_ACCOUNT = 'acc-5001';

const CATEGORY_ACCOUNT_RULES: Array<{ match: RegExp; accountCode: string }> = [
     { match: /commission/i, accountCode: 'acc-5005' },
     { match: /salar|wage|payroll|staff/i, accountCode: 'acc-5002' },
     { match: /rent|lease/i, accountCode: 'acc-5003' },
     { match: /utilit|electric|power|water|internet|fuel|generator/i, accountCode: 'acc-5004' },
     { match: /reagent|consumable|stock|inventory|supply|supplies|purchase/i, accountCode: 'acc-5000' },
];

const MODULE_OWNED_CATEGORIES = /supplier[_\s-]?payments?|bad[_\s-]?debt|^salary$|payroll/i;

const BANK_METHOD_PATTERN = /bank|transfer|cheque|check|card|momo|mobile|online|eft/i;

async function resolveDb(tenantId: number, trx?: any): Promise<any> {
     return trx || (await KnexConnection(tenantId));
}

async function resolveCategoryName(db: any, categoryId?: number | null): Promise<string | null> {
     if (!categoryId) return null;
     const row = await db('dboexpensecategory').select('category').where({ id: categoryId }).first();
     return row?.category || null;
}

function isModuleOwnedCategory(categoryName: string | null): boolean {
     return !!categoryName && MODULE_OWNED_CATEGORIES.test(categoryName);
}

function resolveExpenseAccountCode(categoryName: string | null): string {
     if (!categoryName) return DEFAULT_EXPENSE_ACCOUNT;
     const rule = CATEGORY_ACCOUNT_RULES.find((candidate) => candidate.match.test(categoryName));
     return rule ? rule.accountCode : DEFAULT_EXPENSE_ACCOUNT;
}

function resolveCashAccountCode(method?: string | null): string {
     return method && BANK_METHOD_PATTERN.test(method) ? BANK : CASH;
}

export async function enqueueExpenseAccrual(tenantId: number, expenseId: number, trx?: any): Promise<void> {
     try {
          const db = await resolveDb(tenantId, trx);
          const expense = await db('expensesrecord')
               .select('id', 'amount', 'category', 'branchid', 'employeeid', 'date', 'approvedby')
               .where({ id: expenseId })
               .first();

          if (!expense || Number(expense.amount) <= 0) return;

          const categoryName = await resolveCategoryName(db, expense.category);
          if (isModuleOwnedCategory(categoryName)) return;

          const amount = Number(expense.amount);
          const accountCode = resolveExpenseAccountCode(categoryName);
          const shared = {
               amount,
               expenseId: Number(expense.id),
               branchid: expense.branchid ? Number(expense.branchid) : null,
               employeeid: expense.employeeid ? Number(expense.employeeid) : null,
          };

          await enqueuePosting(
               tenantId,
               {
                    tenantId,
                    transactionType: TransactionType.ACCRUAL,
                    sourceModule: SourceModule.EXPENSE,
                    sourceTable: 'expensesrecord',
                    sourcePk: Number(expense.id),
                    description: 'Expense approved',
                    occurredAt: expense.date || new Date(),
                    createdBy: expense.approvedby ? Number(expense.approvedby) : null,
                    lines: [
                         { accountCode, direction: NormalBalance.DEBIT, ...shared },
                         { accountCode: ACCOUNTS_PAYABLE, direction: NormalBalance.CREDIT, ...shared },
                    ],
               },
               db
          );
     } catch (error: any) {
          logger.warn('Failed to enqueue expense accrual posting', {
               tenantId,
               expenseId,
               error: error?.message || String(error),
          });
     }
}

export async function enqueueExpenseAccrualReversal(tenantId: number, expenseId: number, trx?: any): Promise<void> {
     try {
          const db = await resolveDb(tenantId, trx);
          const expense = await db('expensesrecord')
               .select('id', 'amount', 'category', 'branchid', 'employeeid')
               .where({ id: expenseId })
               .first();

          if (!expense || Number(expense.amount) <= 0) return;

          const categoryName = await resolveCategoryName(db, expense.category);
          if (isModuleOwnedCategory(categoryName)) return;

          const amount = Number(expense.amount);
          const accountCode = resolveExpenseAccountCode(categoryName);
          const shared = {
               amount,
               expenseId: Number(expense.id),
               branchid: expense.branchid ? Number(expense.branchid) : null,
               employeeid: expense.employeeid ? Number(expense.employeeid) : null,
          };

          await enqueuePosting(
               tenantId,
               {
                    tenantId,
                    transactionType: TransactionType.REVERSAL,
                    sourceModule: SourceModule.EXPENSE,
                    sourceTable: 'expensesrecord',
                    sourcePk: Number(expense.id),
                    description: 'Expense approval withdrawn',
                    occurredAt: new Date(),
                    lines: [
                         { accountCode: ACCOUNTS_PAYABLE, direction: NormalBalance.DEBIT, ...shared },
                         { accountCode, direction: NormalBalance.CREDIT, ...shared },
                    ],
               },
               db
          );
     } catch (error: any) {
          logger.warn('Failed to enqueue expense accrual reversal posting', {
               tenantId,
               expenseId,
               error: error?.message || String(error),
          });
     }
}

export async function enqueueExpensePayment(tenantId: number, paymentId: number, trx?: any): Promise<void> {
     try {
          const db = await resolveDb(tenantId, trx);
          const payment = await db('expense_payments')
               .select('id', 'expense_id', 'invoice_id', 'amount', 'method', 'payment_date', 'created_by')
               .where({ id: paymentId })
               .first();

          if (!payment || Number(payment.amount) <= 0) return;

          const expense = await db('expensesrecord')
               .select('branchid', 'employeeid', 'category')
               .where({ id: payment.expense_id })
               .first();

          if (isModuleOwnedCategory(await resolveCategoryName(db, expense?.category))) return;

          const shared = {
               amount: Number(payment.amount),
               expenseId: payment.expense_id ? Number(payment.expense_id) : null,
               invoiceId: payment.invoice_id ? Number(payment.invoice_id) : null,
               branchid: expense?.branchid ? Number(expense.branchid) : null,
               employeeid: expense?.employeeid ? Number(expense.employeeid) : null,
          };

          await enqueuePosting(
               tenantId,
               {
                    tenantId,
                    transactionType: TransactionType.PAYMENT,
                    sourceModule: SourceModule.EXPENSE,
                    sourceTable: 'expense_payments',
                    sourcePk: Number(payment.id),
                    description: 'Expense payment',
                    occurredAt: payment.payment_date || new Date(),
                    createdBy: payment.created_by ? Number(payment.created_by) : null,
                    lines: [
                         { accountCode: ACCOUNTS_PAYABLE, direction: NormalBalance.DEBIT, ...shared },
                         { accountCode: resolveCashAccountCode(payment.method), direction: NormalBalance.CREDIT, ...shared },
                    ],
               },
               db
          );
     } catch (error: any) {
          logger.warn('Failed to enqueue expense payment posting', {
               tenantId,
               paymentId,
               error: error?.message || String(error),
          });
     }
}

export async function enqueueExpensePaymentReversal(tenantId: number, paymentId: number, trx?: any): Promise<void> {
     try {
          const db = await resolveDb(tenantId, trx);
          const payment = await db('expense_payments')
               .select('id', 'expense_id', 'invoice_id', 'amount', 'method')
               .where({ id: paymentId })
               .first();

          if (!payment || Number(payment.amount) <= 0) return;

          const expense = await db('expensesrecord')
               .select('branchid', 'employeeid', 'category')
               .where({ id: payment.expense_id })
               .first();

          if (isModuleOwnedCategory(await resolveCategoryName(db, expense?.category))) return;

          const shared = {
               amount: Number(payment.amount),
               expenseId: payment.expense_id ? Number(payment.expense_id) : null,
               invoiceId: payment.invoice_id ? Number(payment.invoice_id) : null,
               branchid: expense?.branchid ? Number(expense.branchid) : null,
               employeeid: expense?.employeeid ? Number(expense.employeeid) : null,
          };

          await enqueuePosting(
               tenantId,
               {
                    tenantId,
                    transactionType: TransactionType.REVERSAL,
                    sourceModule: SourceModule.EXPENSE,
                    sourceTable: 'expense_payments',
                    sourcePk: Number(payment.id),
                    description: 'Expense payment reversed',
                    occurredAt: new Date(),
                    lines: [
                         { accountCode: resolveCashAccountCode(payment.method), direction: NormalBalance.DEBIT, ...shared },
                         { accountCode: ACCOUNTS_PAYABLE, direction: NormalBalance.CREDIT, ...shared },
                    ],
               },
               db
          );
     } catch (error: any) {
          logger.warn('Failed to enqueue expense payment reversal posting', {
               tenantId,
               paymentId,
               error: error?.message || String(error),
          });
     }
}

export const expenseAccounting: IExpenseAccounting = {
     enqueueExpenseAccrual,
     enqueueExpenseAccrualReversal,
     enqueueExpensePayment,
     enqueueExpensePaymentReversal,
};
