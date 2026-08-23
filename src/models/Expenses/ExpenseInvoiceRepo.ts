import { promisifyQuery, rowAffected, paginationQuery } from "../../hooks/helper";
import logger from "../../hooks/logger";
import User from "../../LobnosAuth/user";
import ExpenseService from "./ExpenseService";
import { PrimeLimsTableexpensesrecord } from "../../database/DatabaseTableSchema";
import KnexConnection from "../../database/KnexConnections";
import { enqueueExpensePayment, enqueueExpensePaymentReversal } from "../../accountingModule/integrations/ExpenseAccounting";

export default class ExpenseInvoiceRepo {
     private employeeid: number;
     private branchid: number;
     private tenantId: number;

     constructor(employeeid: number, branchid: number, tenantId: number) {
          this.employeeid = employeeid;
          this.branchid = branchid;
          this.tenantId = tenantId;
     }

     async calculateTotalFromExpenses(expenseIds: number[]): Promise<number> {
          if (!expenseIds || expenseIds.length === 0) {
               return 0;
          }

          const placeholders = expenseIds.map(() => '?').join(',');
          const query = `SELECT SUM(amount) as total FROM expensesrecord WHERE id IN (${placeholders}) AND approved = 1`;
          const result = await promisifyQuery(this.tenantId, query, expenseIds);

          return result[0]?.total || 0;
     }

     async getMerchantFromExpenses(expenseIds: number[]): Promise<number | null> {
          if (!expenseIds || expenseIds.length === 0) {
               return null;
          }

          const placeholders = expenseIds.map(() => '?').join(',');
          const query = `SELECT DISTINCT merchant FROM expensesrecord WHERE id IN (${placeholders}) AND approved = 1`;
          const result = await promisifyQuery(this.tenantId, query, expenseIds);

          if (result.length === 0) {
               return null;
          }

          if (result.length === 1) {
               return result[0].merchant;
          }

          const merchantCounts: { [key: number]: number } = {};
          result.forEach((row: any) => {
               const merchant = row.merchant;
               merchantCounts[merchant] = (merchantCounts[merchant] || 0) + 1;
          });

          const mostCommonMerchant = Object.keys(merchantCounts).reduce((a, b) =>
               merchantCounts[parseInt(a)] > merchantCounts[parseInt(b)] ? a : b
          );

          return parseInt(mostCommonMerchant);
     }

     async createInvoice(
          invoiceData: {
               invoice_number?: string;
               invoice_date: string;
               due_date?: string;
               merchant_id?: number;
               total_amount?: number;
               tax_amount?: number;
               status?: 'Pending' | 'Approved' | 'Rejected' | 'Paid';
               expense_ids: number[];
          },
          trx?: any
     ): Promise<any> {
          const record = await new User(null, null, null, null, null).userExistWithId(this.employeeid, this.tenantId);
          if (!record || record.length === 0) {
               throw new Error('User not found');
          }

          const role = record[0]['role'];
          const isAdminOrManager = role === 'admin' || role === 'manager';

          const { invoice_date, expense_ids } = invoiceData;
          if (!invoice_date || !expense_ids || expense_ids.length === 0) {
               throw new Error('Required fields are missing');
          }

          let merchant_id = invoiceData.merchant_id as any
          if (!merchant_id) {
               merchant_id = await this.getMerchantFromExpenses(expense_ids);
               if (!merchant_id) {
                    throw new Error('Could not determine merchant from approved expenses');
               }
          }

          let total_amount = invoiceData.total_amount;
          if (!total_amount || total_amount === 0) {
               total_amount = await this.calculateTotalFromExpenses(expense_ids);
          }

          let invoice_number = invoiceData.invoice_number;
          if (!invoice_number) {
               const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
               const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
               invoice_number = `INV-${timestamp}-${random}`;
          } else {
               const checkQuery = 'SELECT id FROM invoices WHERE invoice_number = ?';
               const existing = trx ? await trx.raw(checkQuery, [invoice_number]) : await promisifyQuery(this.tenantId, checkQuery, [invoice_number]);
               const existingData = trx ? existing[0] : existing;
               if (existingData && existingData.length > 0) {
                    throw new Error('Invoice number must be unique');
               }
          }

          const merchantQuery = 'SELECT id FROM expense_merchants WHERE id = ?';
          const merchant = trx ? await trx.raw(merchantQuery, [merchant_id]) : await promisifyQuery(this.tenantId, merchantQuery, [merchant_id]);
          const merchantData = trx ? merchant[0] : merchant;
          if (!merchantData || merchantData.length === 0) {
               throw new Error('Merchant not found');
          }

          for (const expenseId of expense_ids) {
               const expenseQuery = 'SELECT id, employeeid, approved FROM expensesrecord WHERE id = ?';
               const expense = trx ? await trx.raw(expenseQuery, [expenseId]) : await promisifyQuery(this.tenantId, expenseQuery, [expenseId]);
               const expenseData = trx ? expense[0] : expense;
               if (!expenseData || expenseData.length === 0) {
                    throw new Error(`Expense with ID ${expenseId} not found`);
               }
               const expenseRecord = trx ? expenseData[0] : expenseData[0];
               if (!isAdminOrManager && expenseRecord.employeeid !== this.employeeid) {
                    throw new Error(`Unauthorized to include expense ${expenseId}`);
               }
               if (expenseRecord.approved !== 1) {
                    throw new Error(`Expense ${expenseId} must be approved before it can be invoiced`);
               }
          }

          const insertQuery = `
            INSERT INTO invoices (invoice_number, invoice_date, due_date, merchant_id, employee_id, branch_id, total_amount, tax_amount, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
          const values = [
               invoice_number,
               invoice_date,
               invoiceData.due_date || null,
               merchant_id,
               this.employeeid,
               this.branchid,
               total_amount,
               invoiceData.tax_amount || 0.00,
               invoiceData.status || 'Pending'
          ];
          const result = trx ? await trx.raw(insertQuery, values) : await promisifyQuery(this.tenantId, insertQuery, values);
          const invoiceId = trx ? result[0].insertId : result.insertId;

          for (const expenseId of expense_ids) {
               const linkQuery = 'INSERT INTO invoice_expenses (invoice_id, expense_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE invoice_id = invoice_id';
               if (trx) {
                    await trx.raw(linkQuery, [invoiceId, expenseId]);
               } else {
                    await promisifyQuery(this.tenantId, linkQuery, [invoiceId, expenseId]);
               }
          }

          return { invoiceId, invoice_number };
     }

     async getInvoices(
          filters: {
               page?: number;
               count?: number;
               status?: string;
               from?: string;
               to?: string;
               search?: string;
               sortby?: 'DESC' | 'ASC';
          } = {}
     ): Promise<any> {
          const connection = await KnexConnection(this.tenantId);

          const record = await new User(null, null, null, null, null).userExistWithId(this.employeeid, this.tenantId);
          if (!record || record.length === 0) {
               throw new Error('User not found');
          }

          const role = record[0]['role'];
          const isAdminOrManager = role === 'admin' || role === 'manager';

          let baseQuery = connection('invoices as i')
               .leftJoin('expense_merchants as em', 'i.merchant_id', 'em.id')
               .leftJoin('invoice_expenses as ie', 'i.id', 'ie.invoice_id')
               .leftJoin('expensesrecord as er', 'ie.expense_id', 'er.id')
               .leftJoin('expense_payments as ep', 'er.id', 'ep.expense_id')
               .leftJoin('expense_payment_reversals as epr', 'ep.id', 'epr.payment_id')
               .leftJoin('roles as r', 'epr.reversed_by', 'r.employeeid')
               .select(
                    'i.*',
                    'er.id as expense_id',
                    'em.name as merchant_name',
                    'ep.id as payment_id',
                    'ep.amount as payment_amount',
                    'ep.status as payment_status',
                    'ep.is_reversed',
                    connection.raw('CASE WHEN ep.is_reversed = 1 THEN "Reversed" ELSE ep.status END as final_payment_status'),
                    'epr.id as reversal_id',
                    'epr.reversed_amount',
                    'epr.reversed_by',
                    'epr.reversal_reason',
                    'epr.reversed_on',
                    'r.username as reversed_by_name',
                    connection.raw('COUNT(DISTINCT ie.expense_id) as expense_count'),
                    connection.raw('MIN(er.groupId) as groupId')
               );

          if (!isAdminOrManager) {
               baseQuery.where('i.employee_id', this.employeeid);
          }

          if (filters.status) {
               baseQuery.where('i.status', filters.status);
          }

          if (filters.from && filters.to) {
               baseQuery.whereBetween('i.invoice_date', [filters.from, filters.to]);
          }

          if (filters.search) {
               baseQuery.where(function () {
                    this.where('i.invoice_number', 'like', `%${filters.search}%`)
                         .orWhere('em.name', 'like', `%${filters.search}%`);
               });
          }

          baseQuery.groupBy('i.id').orderBy('i.created_on', filters.sortby?.toLowerCase() || 'desc');

          const countQuery = connection('invoices as i')
               .leftJoin('expense_merchants as em', 'i.merchant_id', 'em.id')
               .leftJoin('invoice_expenses as ie', 'i.id', 'ie.invoice_id')
               .leftJoin('expensesrecord as er', 'ie.expense_id', 'er.id')
               .select(connection.raw('COUNT(DISTINCT i.id) as total'));

          if (!isAdminOrManager) {
               countQuery.where('i.employee_id', this.employeeid);
          }

          if (filters.status) {
               countQuery.where('i.status', filters.status);
          }

          if (filters.from && filters.to) {
               countQuery.whereBetween('i.invoice_date', [filters.from, filters.to]);
          }

          if (filters.search) {
               countQuery.where(function () {
                    this.where('i.invoice_number', 'like', `%${filters.search}%`)
                         .orWhere('em.name', 'like', `%${filters.search}%`);
               });
          }

          const totalResult = await countQuery.first() as any;
          const total = totalResult?.total || 0;

          const page = filters.page || 1;
          const count = filters.count || 10;
          const results = await baseQuery.limit(count).offset((page - 1) * count);

          return {
               data: results,
               total,
               page,
               count,
               totalPages: Math.ceil(total / count)
          };
     }

     async getInvoiceById(invoiceId: number): Promise<any> {
          const record = await new User(null, null, null, null, null).userExistWithId(this.employeeid, this.tenantId);
          if (!record || record.length === 0) {
               throw new Error('User not found');
          }

          const role = record[0]['role'];
          const isAdminOrManager = role === 'admin' || role === 'manager';

          const query = `
            SELECT i.*, em.name as merchant_name
            FROM invoices i
            LEFT JOIN expense_merchants em ON i.merchant_id = em.id
            WHERE i.id = ?
        `;
          const invoice = await promisifyQuery(this.tenantId, query, [invoiceId]);
          if (invoice.length === 0) {
               throw new Error('Invoice not found');
          }

          if (!isAdminOrManager && invoice[0].employee_id !== this.employeeid) {
               throw new Error('Unauthorized');
          }

          const expensesQuery = `
            SELECT er.*, ie.invoice_id
            FROM expensesrecord er
            JOIN invoice_expenses ie ON er.id = ie.expense_id
            WHERE ie.invoice_id = ?
        `;
          const expenses = await promisifyQuery(this.tenantId, expensesQuery, [invoiceId]);

          return { ...invoice[0], expenses };
     }

     async updateInvoiceStatus(invoiceId: number, status: 'Pending' | 'Approved' | 'Rejected' | 'Paid'): Promise<boolean> {
          const record = await new User(null, null, null, null, null).userExistWithId(this.employeeid, this.tenantId);
          if (!record || record.length === 0) {
               throw new Error('User not found');
          }

          const role = record[0]['role'];
          const isAdminOrManager = role === 'admin' || role === 'manager';

          const invoiceQuery = 'SELECT employee_id FROM invoices WHERE id = ?';
          const invoice = await promisifyQuery(this.tenantId, invoiceQuery, [invoiceId]);
          if (invoice.length === 0) {
               throw new Error('Invoice not found');
          }

          if (!isAdminOrManager && invoice[0].employee_id !== this.employeeid) {
               throw new Error('Unauthorized');
          }

          const updateQuery = 'UPDATE invoices SET status = ?, updated_on = NOW() WHERE id = ?';
          const result = await promisifyQuery(this.tenantId, updateQuery, [status, invoiceId]);
          return rowAffected(result);
     }

     async updateInvoiceStatusIfFullyPaid(invoiceId: number, trx?: any): Promise<void> {
          const invoiceQuery = 'SELECT total_amount, status FROM invoices WHERE id = ?';
          const invoice = trx ? await trx.raw(invoiceQuery, [invoiceId]) : await promisifyQuery(this.tenantId, invoiceQuery, [invoiceId]);
          const invoiceData = trx ? invoice[0] : invoice;

          if (!invoiceData || invoiceData.length === 0) {
               return;
          }

          const invoiceRecord = trx ? invoiceData[0] : invoiceData[0];
          const invoiceTotal = parseFloat(invoiceRecord.total_amount);

          const paymentsQuery = `
               SELECT SUM(amount) as total_paid
               FROM expense_payments
               WHERE invoice_id = ? AND status = 'Paid' AND (is_reversed = 0 OR is_reversed IS NULL)
          `;
          const payments = trx ? await trx.raw(paymentsQuery, [invoiceId]) : await promisifyQuery(this.tenantId, paymentsQuery, [invoiceId]);
          const paymentsData = trx ? payments[0] : payments;
          const totalPaid = parseFloat((trx ? paymentsData[0] : paymentsData[0])?.total_paid || 0);

          if (invoiceRecord.status === 'Rejected') {
               return;
          }

          let nextStatus: 'Paid' | 'Pending' | null = null;
          if (totalPaid >= invoiceTotal) {
               nextStatus = 'Paid';
          } else if (invoiceRecord.status === 'Paid') {
               nextStatus = 'Pending';
          }

          if (!nextStatus || nextStatus === invoiceRecord.status) {
               return;
          }

          const updateQuery = 'UPDATE invoices SET status = ?, updated_on = NOW() WHERE id = ?';
          if (trx) {
               await trx.raw(updateQuery, [nextStatus, invoiceId]);
          } else {
               await promisifyQuery(this.tenantId, updateQuery, [nextStatus, invoiceId]);
          }
     }

     async addPayment(
          paymentData: {
               expense_id: number;
               invoice_id?: number;
               payment_date: string;
               amount: number;
               method: string;
               status?: 'Paid' | 'Pending' | 'Failed';
          },
          trx?: any
     ): Promise<any> {
          try {
               const record = await new User(null, null, null, null, null).userExistWithId(this.employeeid, this.tenantId);
               if (!record || record.length === 0) {
                    throw new Error('User not found');
               }

               const role = record[0]['role'];
               const isAdminOrManager = role === 'admin' || role === 'manager';

               const { expense_id, payment_date, amount, method } = paymentData;
               if (!expense_id || !payment_date || !amount || !method) {
                    throw new Error('Required fields are missing');
               }

               const expenseQuery = 'SELECT id, employeeid, approved FROM expensesrecord WHERE id = ?';
               const expense = trx ? await trx.raw(expenseQuery, [expense_id]) : await promisifyQuery(this.tenantId, expenseQuery, [expense_id]);
               const expenseData = trx ? expense[0] : expense;
               if (!expenseData || expenseData.length === 0) {
                    throw new Error(`Expense with ID ${expense_id} not found in the system`);
               }

               const expenseRecord = trx ? expenseData[0] : expenseData[0];
               if (expenseRecord.approved !== 1) {
                    throw new Error(`Cannot add payment for expense ${expense_id} - expense must be approved first`);
               }

               if (!isAdminOrManager && expenseRecord.employeeid !== this.employeeid) {
                    throw new Error('Unauthorized');
               }

               if (paymentData.invoice_id) {
                    const invoiceQuery = 'SELECT id, employee_id FROM invoices WHERE id = ?';
                    const invoice = trx ? await trx.raw(invoiceQuery, [paymentData.invoice_id]) : await promisifyQuery(this.tenantId, invoiceQuery, [paymentData.invoice_id]);
                    const invoiceData = trx ? invoice[0] : invoice;
                    if (!invoiceData || invoiceData.length === 0) {
                         throw new Error('Invoice not found');
                    }
                    const invoiceRecord = trx ? invoiceData[0] : invoiceData[0];
                    if (!isAdminOrManager && invoiceRecord.employee_id !== this.employeeid) {
                         throw new Error('Unauthorized');
                    }

               }

               const existingPaymentQuery = `
               SELECT id FROM expense_payments
               WHERE expense_id = ? AND invoice_id = ? AND status = 'Paid'
          `;
               const existingPayment = trx ? await trx.raw(existingPaymentQuery, [expense_id, paymentData.invoice_id || null]) : await promisifyQuery(this.tenantId, existingPaymentQuery, [expense_id, paymentData.invoice_id || null]);
               const existingPaymentData = trx ? existingPayment[0] : existingPayment;
               if (existingPaymentData && existingPaymentData.length > 0) {
                    throw new Error(`Payment already exists for expense ${expense_id}${paymentData.invoice_id ? ` and invoice ${paymentData.invoice_id}` : ''}. Duplicate payments are not allowed.`);
               }

               const insertQuery = `
            INSERT INTO expense_payments (expense_id, invoice_id, payment_date, amount, method, status, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
               const values = [
                    expense_id,
                    paymentData.invoice_id || null,
                    payment_date,
                    amount,
                    method,
                    paymentData.status || 'Paid',
                    this.employeeid
               ];
               const result = trx ? await trx.raw(insertQuery, values) : await promisifyQuery(this.tenantId, insertQuery, values);
               const paymentId = trx ? result[0].insertId : result.insertId;

               if (paymentData.invoice_id) {
                    await this.updateInvoiceStatusIfFullyPaid(paymentData.invoice_id, trx);
               }

               await enqueueExpensePayment(this.tenantId, Number(paymentId), trx);

               return { paymentId };
          } catch (error) {
               console.error('Error in addPayment:', error);
               throw error;
          }
     }

     async getPayments(
          filters: {
               expense_id?: number;
               invoice_id?: number;
               status?: string;
               page?: number;
               count?: number;
          } = {}
     ): Promise<any> {
          const record = await new User(null, null, null, null, null).userExistWithId(this.employeeid, this.tenantId);
          if (!record || record.length === 0) {
               throw new Error('User not found');
          }
          const role = record[0]['role'];
          const isAdminOrManager = role === 'admin' || role === 'manager';

          let query = 'SELECT * FROM expense_payments';
          let values: (number | string)[] = [];
          let hasWhere = false;

          const addCondition = (condition: string, params: (number | string)[] = []) => {
               query += ` ${hasWhere ? 'AND' : 'WHERE'} ${condition}`;
               values.push(...params);
               hasWhere = true;
          };

          if (!isAdminOrManager) {
               const subQuery = `
                SELECT id FROM expensesrecord WHERE employeeid = ?
                UNION
                SELECT ie.expense_id FROM invoice_expenses ie
                JOIN invoices i ON ie.invoice_id = i.id
                WHERE i.employee_id = ?
            `;
               addCondition(`expense_id IN (${subQuery})`, [this.employeeid, this.employeeid]);
          }

          if (filters.expense_id) {
               addCondition('expense_id = ?', [filters.expense_id]);
          }

          if (filters.invoice_id) {
               console.log('Filtering by invoice_id:', filters.invoice_id);
               addCondition('invoice_id = ?', [filters.invoice_id]);
          }

          if (filters.status) {
               addCondition('status = ?', [filters.status]);
          }

          query += ' ORDER BY created_on DESC';

          const pageQuery = { count: filters.count || 10, page: filters.page || 1 };
          return await paginationQuery(pageQuery, query, values, this.tenantId);
     }

     async createExpensesAndInvoice(
          expensesData: Array<Omit<PrimeLimsTableexpensesrecord, 'id'>>,
          invoiceData: {
               invoice_number?: string;
               invoice_date: string;
               due_date?: string;
               merchant_id: number;
               total_amount: number;
               tax_amount?: number;
               status?: 'Pending' | 'Approved' | 'Rejected' | 'Paid';
          },
          trx?: any
     ): Promise<any> {
          try {
               const expenseService = new ExpenseService(this.employeeid, this.branchid, this.tenantId, null, trx);

               const groupId = expenseService['generateGroupId']();

               const expenseIds: number[] = [];
               for (const expense of expensesData) {
                    const expenseId = await expenseService.generateNewExpense(expense, groupId, trx);
                    if (expenseId) {
                         expenseIds.push(expenseId);
                    } else {
                         throw new Error('Failed to create expense');
                    }
               }

               let invoice_number = invoiceData.invoice_number;
               if (!invoice_number) {
                    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
                    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                    invoice_number = `INV-${timestamp}-${random}`;
               }

               let invoiceInsertData = {
                    invoice_number,
                    invoice_date: invoiceData.invoice_date,
                    due_date: invoiceData.due_date || null,
                    merchant_id: invoiceData.merchant_id,
                    employee_id: this.employeeid,
                    branch_id: this.branchid,
                    total_amount: invoiceData.total_amount,
                    tax_amount: invoiceData.tax_amount || 0.00,
                    status: invoiceData.status || 'Pending'
               };

               let invoiceId;
               if (trx) {
                    const result = await trx('invoices').insert(invoiceInsertData);
                    invoiceId = result[0];
               } else {
                    const connection = await KnexConnection(this.tenantId);
                    const result = await connection('invoices').insert(invoiceInsertData);
                    invoiceId = result[0];
               }


               // Link expenses to invoice
               for (const expenseId of expenseIds) {
                    if (trx) {
                         await trx('invoice_expenses').insert({
                              invoice_id: invoiceId,
                              expense_id: expenseId
                         }).onConflict(['invoice_id', 'expense_id']).merge();
                    } else {
                         const connection = await KnexConnection(this.tenantId);
                         await connection('invoice_expenses').insert({
                              invoice_id: invoiceId,
                              expense_id: expenseId
                         }).onConflict(['invoice_id', 'expense_id']).merge();
                    }
               }

               return {
                    message: 'Expenses and invoice created successfully',
                    expenseIds,
                    invoiceId,
                    invoice_number,
                    groupId,
                    requiresApproval: false // Since we're creating the invoice immediately
               };
          } catch (error) {
               logger.error('Error in createExpensesAndInvoice:', error);
               throw error;
          }
     }

     async addExpensesToInvoice(invoiceId: number, newExpenseIds: number[]): Promise<any> {
          const record = await new User(null, null, null, null, null).userExistWithId(this.employeeid, this.tenantId);
          if (!record || record.length === 0) {
               throw new Error('User not found');
          }

          const role = record[0]['role'];
          const isAdminOrManager = role === 'admin' || role === 'manager';

          const invoiceQuery = 'SELECT id, employee_id, merchant_id FROM invoices WHERE id = ?';
          const invoice = await promisifyQuery(this.tenantId, invoiceQuery, [invoiceId]);
          if (invoice.length === 0) {
               throw new Error('Invoice not found');
          }

          if (!isAdminOrManager && invoice[0].employee_id !== this.employeeid) {
               throw new Error('Unauthorized');
          }

          for (const expenseId of newExpenseIds) {
               const expenseQuery = 'SELECT id, employeeid, approved FROM expensesrecord WHERE id = ?';
               const expense = await promisifyQuery(this.tenantId, expenseQuery, [expenseId]);
               if (expense.length === 0) {
                    throw new Error(`Expense with ID ${expenseId} not found`);
               }
               if (!isAdminOrManager && expense[0].employeeid !== this.employeeid) {
                    throw new Error(`Unauthorized to include expense ${expenseId}`);
               }
               if (expense[0].approved !== 1) {
                    throw new Error(`Expense ${expenseId} must be approved before it can be added to an invoice`);
               }

               const existingLinkQuery = 'SELECT invoice_id FROM invoice_expenses WHERE expense_id = ?';
               const existingLink = await promisifyQuery(this.tenantId, existingLinkQuery, [expenseId]);
               if (existingLink.length > 0) {
                    throw new Error(`Expense ${expenseId} is already linked to an invoice`);
               }
          }

          for (const expenseId of newExpenseIds) {
               const linkQuery = 'INSERT INTO invoice_expenses (invoice_id, expense_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE invoice_id = invoice_id';
               await promisifyQuery(this.tenantId, linkQuery, [invoiceId, expenseId]);
          }

          const allExpenseIdsQuery = 'SELECT expense_id FROM invoice_expenses WHERE invoice_id = ?';
          const allExpenseLinks = await promisifyQuery(this.tenantId, allExpenseIdsQuery, [invoiceId]);
          const allExpenseIds = allExpenseLinks.map((link: { expense_id: number }) => link.expense_id);

          const newTotalAmount = await this.calculateTotalFromExpenses(allExpenseIds);

          const updateQuery = 'UPDATE invoices SET total_amount = ?, updated_on = NOW() WHERE id = ?';
          await promisifyQuery(this.tenantId, updateQuery, [newTotalAmount, invoiceId]);

          return { invoiceId, totalAmount: newTotalAmount, addedExpenses: newExpenseIds };
     }

     async calculateTotalAmount(expenseIds: number[]): Promise<number> {
          if (!Array.isArray(expenseIds) || expenseIds.length === 0) {
               throw new Error('Invalid expense IDs');
          }

          const query = `
            SELECT SUM(total_amount) as total_amount
            FROM expensesrecord
            WHERE id IN (?)
        `;
          const result = await promisifyQuery(this.tenantId, query, [expenseIds]);
          return result[0]?.total_amount || 0;
     }


     async getPaymentsBetweenDates(tenantId: number, from: string, to: string): Promise<any[]> {
          const query = `
               SELECT 
               expense_payments.*,
               expensesrecord.*,
               expense_merchants.*,
               roles.username AS paid_by
               FROM expense_payments
               LEFT JOIN expensesrecord ON expense_payments.expense_id = expensesrecord.id
               LEFT JOIN expense_merchants ON expensesrecord.merchant = expense_merchants.id
               LEFT JOIN roles ON expense_payments.created_by = roles.employeeid

               WHERE payment_date BETWEEN ? AND ? AND (expense_payments.is_reversed = 0 OR expense_payments.is_reversed IS NULL)
          `;
          return promisifyQuery(tenantId, query, [from, to]);
     }


     async getSumOfPayments(tenantId: number, start: string, end: string): Promise<number> {
          const query = `
               SELECT SUM(amount) as total_payments FROM expense_payments
               WHERE payment_date BETWEEN ? AND ? AND status = 'Paid' AND (is_reversed = 0 OR is_reversed IS NULL)
          `;
          const result = await promisifyQuery(tenantId, query, [start, end]);
          return result[0]?.total_payments || 0;
     }

     async reversePayment(paymentId: number, reversalReason?: string): Promise<any> {
          try {
               // Get payment details
               const paymentQuery = `SELECT * FROM expense_payments WHERE id = ?`;
               const paymentResult = await promisifyQuery(this.tenantId, paymentQuery, [paymentId]);

               if (!paymentResult || paymentResult.length === 0) {
                    throw new Error(`Payment with ID ${paymentId} not found`);
               }

               const payment = paymentResult[0];
               const { expense_id, invoice_id, amount, method } = payment;

               // Create reversal record in audit table
               const reversalQuery = `
                    INSERT INTO expense_payment_reversals 
                    (payment_id, expense_id, invoice_id, reversed_amount, reversed_by, reversal_reason, reversal_method)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
               `;
               const reversalResult = await promisifyQuery(
                    this.tenantId,
                    reversalQuery,
                    [paymentId, expense_id, invoice_id, amount, this.employeeid, reversalReason || null, method]
               );

               const reversalId = reversalResult.insertId;

               // Update expense_payments table to mark as reversed
               const updatePaymentQuery = `
                    UPDATE expense_payments 
                    SET is_reversed = 1, reversal_id = ?, reversed_on = NOW()
                    WHERE id = ?
               `;
               await promisifyQuery(this.tenantId, updatePaymentQuery, [reversalId, paymentId]);

               await enqueueExpensePaymentReversal(this.tenantId, paymentId);

               if (invoice_id) {
                    await this.updateInvoiceStatusIfFullyPaid(invoice_id);
               }

               const supplierPayment = await promisifyQuery(
                    this.tenantId,
                    `
                         SELECT id, payment_status
                         FROM inv_supplier_payments
                         WHERE expense_id = ?
                              OR (? IS NOT NULL AND expense_invoice_id = ?)
                         ORDER BY updated_at DESC
                         LIMIT 1
                    `,
                    [expense_id, invoice_id, invoice_id]
               );

               if (supplierPayment && supplierPayment.length > 0) {
                    const sp = supplierPayment[0];
                    if (sp.payment_status !== 'refunded') {
                         const note = `\n\n[EXPENSE PAYMENT REVERSED] payment_id=${paymentId}, reversal_id=${reversalId}${reversalReason ? `, reason=${reversalReason}` : ''}`;
                         await promisifyQuery(
                              this.tenantId,
                              `
                                   UPDATE inv_supplier_payments
                                   SET payment_status = 'refunded',
                                        payment_notes = CONCAT(COALESCE(payment_notes, ''), ?),
                                        updated_at = NOW()
                                   WHERE id = ?
                              `,
                              [note, sp.id]
                         );
                    }
               }

               await promisifyQuery(
                    this.tenantId,
                    `
                         DELETE s FROM commission_batch_payment_services s
                         JOIN commission_batch_payments p ON s.batch_payment_id = p.id
                         WHERE p.expense_id = ?
                            OR (? IS NOT NULL AND p.expense_invoice_id = ?)
                    `,
                    [expense_id, invoice_id, invoice_id]
               );

               await promisifyQuery(
                    this.tenantId,
                    `
                         DELETE FROM commission_batch_payments
                         WHERE expense_id = ?
                            OR (? IS NOT NULL AND expense_invoice_id = ?)
                    `,
                    [expense_id, invoice_id, invoice_id]
               );

               return {
                    success: true,
                    message: `Payment of ${amount} has been successfully reversed`,
                    payment_id: paymentId,
                    reversal_id: reversalId,
                    expense_id: expense_id,
                    amount_reversed: amount,
                    reversed_by: this.employeeid,
                    reversed_on: new Date().toISOString()
               };
          } catch (error: any) {
               logger.error(`Error reversing payment ${paymentId}:`, error);
               throw new Error(`Failed to reverse payment: ${error.message}`);
          }
     }
}
