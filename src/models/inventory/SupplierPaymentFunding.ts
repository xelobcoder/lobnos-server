import {PaymentFundingError} from '../Expenses/FundingAvailability';
import { Knex } from 'knex';
import { AuthUser } from '../../middleware/authority';

export class SupplierPaymentValidationError extends PaymentFundingError {
     constructor(message: string, readonly statusCode = 400) { super(message,statusCode); }
}

export async function ensureSupplierPaymentFundingColumns(connection: Knex): Promise<void> {
     if (!(await connection.schema.hasTable('inv_supplier_payments'))) return;
     for (const column of ['payment_account_id', 'payment_account_gl_code', 'branchid']) {
          if (!(await connection.schema.hasColumn('inv_supplier_payments', column))) {
               await connection.schema.alterTable('inv_supplier_payments', table => {
                    if (column === 'payment_account_gl_code') table.string(column, 20).nullable();
                    else table.integer(column).unsigned().nullable();
               });
          }
     }
     const [columns] = await connection.raw('SHOW COLUMNS FROM ?? LIKE ?', ['inv_supplier_payments', 'payment_method']);
     if (!String(columns[0]?.Type).includes('mobile_money') || !String(columns[0]?.Type).includes('cheque')) {
          await connection.schema.alterTable('inv_supplier_payments', table => {
               table.enum('payment_method', ['cash', 'check', 'bank_transfer', 'credit_card', 'wire_transfer', 'other', 'mobile_money', 'cheque']).defaultTo('bank_transfer').alter();
          });
     }
}

export async function validateSupplierPaymentFunding(db: any, actor: AuthUser, accountId: number, method: string, branchid?: number | null) {
     if (!actor?.employeeid) throw new SupplierPaymentValidationError('Authentication required', 401);
     if (!Number.isSafeInteger(accountId) || accountId <= 0) throw new SupplierPaymentValidationError('Select a payment source account');
     const account = await db('payment_accounts').where({ id: accountId, is_active: true }).forUpdate().first();
     if (!account) throw new SupplierPaymentValidationError('Payment source account was not found or is inactive');
     const branch = branchid ?? actor.branch ?? account.branchid;
     if (actor.branch != null && branch != null && Number(actor.branch) !== Number(branch)) throw new SupplierPaymentValidationError('Payment belongs to another branch', 403);
     if (account.branchid != null && Number(account.branchid) !== Number(branch)) throw new SupplierPaymentValidationError('Payment source account belongs to another branch', 403);
     const access = await db('payment_account_users').where({ payment_account_id: accountId, employeeid: actor.employeeid, can_pay: true, is_active: true }).forUpdate().first();
     if (!access) throw new SupplierPaymentValidationError('You are not authorized to pay from this account', 403);
     if (account.currency !== 'GHS') throw new SupplierPaymentValidationError('Supplier payments currently require a GHS payment account');
     const allowed: Record<string, string[]> = {
          cash: ['cash'], bank: ['bank_transfer', 'check', 'cheque', 'wire_transfer', 'credit_card'],
          mobile_money: ['mobile_money'], other: ['other'],
     };
     if (!allowed[account.account_type]?.includes(method)) throw new SupplierPaymentValidationError('Payment method does not match the selected source account');
     const ledgerAccount = await db('acc_accounts').where({ account_code: account.gl_account_code, type: 'asset', is_active: true }).first();
     if (!ledgerAccount) throw new SupplierPaymentValidationError('Payment source does not have an active asset ledger account');
     return { account, branchid: branch == null ? null : Number(branch) };
}
