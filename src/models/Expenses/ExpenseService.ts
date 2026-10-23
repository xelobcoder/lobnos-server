
import { promisifyQuery, rowAffected, paginationQuery } from "../../hooks/helper";
import logger from "../../hooks/logger";
import User from "../../LobnosAuth/user";
import {
     calculateDailyExpenseQuery,
     calculateYearlyExpenseQuery,
     calCurrentMonthExpenseQuery,
     createExpenseCategoryQuery,
     expense_between_dates_query,
     generateNewExpenseQuery,
     getAllExpenseCategoryQuery,
     getExpenseImageListQuery,
     getExpensesRecordQuery,
     isExpenseExistQuery,
     isRecordExistQuery,
     updateExpenseCategoryQuery,
     updateExpenseDecisionQuery
} from "./queries";
import { IExpenseRepository } from "./interfaces/IExpenseRepository";
import { PrimeLimsTableexpensesrecord } from "../../database/DatabaseTableSchema";
import { OperationsFailures } from "../operations/types";
import { primeTenancyConnector } from '../../models/Tenancy/tenantConnections';
import { databaseConnectionPool } from '../../database/connection';
import { configuration } from '../../hooks/configuration';
import KnexConnection from "../../database/KnexConnections";
import { roleAllowed } from "../../middleware/roles";
import { enqueueExpenseAccrual, enqueueExpenseAccrualReversal } from "../../accountingModule/integrations/ExpenseAccounting";
import { listTenantReceipts } from './ExpenseReceiptService';
import { FinancialFinalizationGuard } from '../../accountingModule/services/FinancialFinalizationGuard';

export default class Expenses implements IExpenseRepository {
     private employeeid: number;
     private branchid: number;
     private tenantId: number;
     private expenseId: null | number
     private trx: any;

     constructor(employeeid: number, branchid: number, tenantId: number, expenseId: number | null = null, trx: any = null) {
          this.employeeid = employeeid;
          this.branchid = branchid;
          this.tenantId = tenantId
          this.expenseId = expenseId;
          this.trx = trx;
     }


     async isExpenseApproved(tenantId: number, expenseid: number): Promise<boolean> {
          if (!expenseid) throw new Error('expenseid not provided');
          const connection = await KnexConnection(tenantId);
          const record = await connection('expensesrecord').select('approved').where({ id: expenseid }).first();
          return Number(record?.approved) === 1;
     }

     getAdminRequest(): void { }

     getRequest(): void {
          if (!this.employeeid || !this.branchid) {
               throw new Error('branchid or employeeid not provided');
          }
     }
     async generateNewExpense(
          data: Omit<PrimeLimsTableexpensesrecord, 'id'>,
          groupId?: string,
          trx?: any
     ): Promise<number | null> {
          try {
               if (Object.keys(data).length === 0 || typeof data !== 'object') {
                    throw new TypeError('object with keys required');
               }

               const { employeeid, branchid, name, date, merchant, amount, description, category, serviceid, isassociatedservice } = data;

               if (!employeeid || !branchid || !name) {
                    throw new Error('name, employeeid, branchid required');
               }
               if (category === 0 || !category) {
                    throw new Error('category id not provided');
               }

               const finalGroupId = groupId || this.generateGroupId();
               const saveAsDraft = Boolean((data as any).save_as_draft ?? (data as any).saveAsDraft);

               let insertData = {
                    name,
                    amount,
                    employeeid,
                    branchid,
                    description,
                    merchant,
                    category,
                    serviceid,
                    isassociatedservice: isassociatedservice || 0,
                    date,
                    groupId: finalGroupId,
                    workflow_status: saveAsDraft ? 'draft' : 'pending_approval',
                    submitted_by: saveAsDraft ? null : employeeid,
                    submitted_at: saveAsDraft ? null : new Date(),
               };

               let result;
               if (trx) {
                    result = await trx('expensesrecord').insert(insertData);
               } else {
                    const connection = await KnexConnection(this.tenantId);
                    result = await connection('expensesrecord').insert(insertData);
               }

               if (result && result.length > 0) {
                    return result[0];
               }
               return null;
          } catch (err: any) {
               logger.error(err?.message);
               throw new Error(err);
          }
     }

     async generateBulkExpenses(
          expensesData: Array<Omit<PrimeLimsTableexpensesrecord, 'id'>>,
          groupId?: string
     ): Promise<{ success: number[]; failed: Array<{ data: any; error: string }>; groupId: string }> {
          const results = {
               success: [] as number[],
               failed: [] as Array<{ data: any; error: string }>,
               groupId: groupId || this.generateGroupId()
          };

          const pool = configuration.isMultiTenant
               ? await primeTenancyConnector(this.tenantId)
               : databaseConnectionPool;

          const connection = await pool.getConnection();

          try {
               await connection.beginTransaction();

               for (const expenseData of expensesData) {
                    try {
                         const { employeeid, branchid, name, date, merchant, amount, description, category } = expenseData;
                         const saveAsDraft = Boolean((expenseData as any).save_as_draft ?? (expenseData as any).saveAsDraft);

                         if (!employeeid || !branchid || !name) {
                              throw new Error('name, employeeid, branchid required');
                         }
                         if (category === 0 || !category) {
                              throw new Error('category id not provided');
                         }

                         const [result] = await connection.query(generateNewExpenseQuery,
                              [name, amount, employeeid, branchid, description, merchant, category, date, results.groupId, saveAsDraft ? 'draft' : 'pending_approval', saveAsDraft ? null : employeeid, saveAsDraft ? null : new Date()]);

                         if ((result as any).insertId) {
                              results.success.push((result as any).insertId);
                         } else {
                              throw new Error('Failed to create expense - no ID returned');
                         }
                    } catch (err: any) {
                         results.failed.push({
                              data: expenseData,
                              error: err.message || 'Unknown error'
                         });
                         await connection.rollback();
                         return results;
                    }
               }

               await connection.commit();
               return results;

          } catch (err: any) {
               await connection.rollback();
               logger.error('Transaction error in bulk expenses:', err);
               throw new Error('Transaction failed: ' + err.message);
          } finally {
               connection.release();
          }
     } async getExpensesRecord(
          tenantId: number,
          employeeid: number,
          branchid: number,
          status: string | undefined,
          pageQuery: { count: number; page: number } = { count: 10, page: 1 },
          from?: string | null,
          to?: string | null,
          state?: string,
          ownerOnly = false
     ): Promise<any> {
          const record = await new User(null, null, null, null, null).userExistWithId(employeeid, tenantId);

          if (!record || record.length === 0) throw new Error('User not found');

          let query = getExpensesRecordQuery;
          let values: (number | string)[] = [];
          let hasWhereClause = false;

          const role = record[0]['role'];

          const isAdmin = roleAllowed(role, ['admin', 'manager', 'accountant']);

          if (!isAdmin) {
               query += ` WHERE er.employeeid = ?`;
               values = [employeeid];
               hasWhereClause = true;
          }

          const addCondition = (condition: string, params: (number | string)[] = []) => {
               query += ` ${hasWhereClause ? 'AND' : 'WHERE'} ${condition}`;
               values.push(...params);
               hasWhereClause = true;
          };
          addCondition('er.branchid = ?', [branchid]);
          if (ownerOnly && isAdmin) addCondition('er.employeeid = ?', [employeeid]);

          if (status === 'approved') {
               addCondition('er.approved = 1');
          } else if (status === 'rejected') {
               addCondition('er.approved = 2');
          } else if (status === 'pending' || status === 'requested') {
               addCondition("er.approved = 0 AND COALESCE(er.workflow_status, 'pending_approval') = 'pending_approval'");
          } else if (status === 'awaiting_payment') {
               addCondition("er.approved = 1 AND COALESCE((SELECT SUM(ep.amount) FROM expense_payments ep WHERE ep.expense_id = er.id AND ep.status = 'Paid' AND COALESCE(ep.is_reversed, 0) = 0), 0) < er.amount");
          } else if (status === 'paid') {
               addCondition("er.approved = 1 AND COALESCE((SELECT SUM(ep.amount) FROM expense_payments ep WHERE ep.expense_id = er.id AND ep.status = 'Paid' AND COALESCE(ep.is_reversed, 0) = 0), 0) >= er.amount");
          }

          if (from && to) {
               addCondition('DATE(er.date) BETWEEN ? AND ?', [from, to]);
          } else if (from) {
               addCondition('DATE(er.date) >= ?', [from]);
          } else if (to) {
               addCondition('DATE(er.date) <= ?', [to]);
          }

          if (state) {
               addCondition('er.state = ?', [state]);
          }

          query += ` ORDER BY er.id DESC LIMIT ? OFFSET ?`;

          return await paginationQuery(pageQuery, query, values, tenantId);
     }



     async getExpenseImageList(expenseid: string): Promise<string[]> {
          return listTenantReceipts(this.tenantId, Number(expenseid));
     }

     async getSingleExpense(tenantId: number, expenseid: string): Promise<any[]> {
          const result = await promisifyQuery(tenantId, getExpenseImageListQuery, [parseInt(expenseid)]);
          if (result.length > 0) {
               const images = await this.getExpenseImageList(expenseid);
               result[0]['images'] = images;
               return result;
          }
          return result;
     }

     async isExpenseRecordAvailable(): Promise<boolean> {
          const result = await promisifyQuery(this.tenantId, isRecordExistQuery, [this.expenseId]);
          return Array.isArray(result) && result.length > 0;
     }

     private async hasApprovedPayments(): Promise<boolean> {
          const checkQuery = `
               SELECT COUNT(ep.id) as payment_count
               FROM expense_payments ep
               WHERE ep.expense_id = ?
          `;
          const result = await promisifyQuery(this.tenantId, checkQuery, [this.expenseId]);
          return result && result.length > 0 && result[0].payment_count > 0;
     }

     public async updateExpenseRecord(expenseData: PrimeLimsTableexpensesrecord) {
          const connection = await KnexConnection(this.tenantId);
          return connection.transaction(async (trx: any) => {
               const before = await trx('expensesrecord').where({ id: this.expenseId }).forUpdate().first();
               if (!before) return OperationsFailures.unfoundID;
               const status = String(before.workflow_status || (Number(before.approved) === 1 ? 'approved' : Number(before.approved) === 2 ? 'rejected' : 'pending_approval'));
               if (!['draft', 'rejected', 'pending_approval'].includes(status)) return `Cannot edit an expense in ${status.replace(/_/g, ' ')} status.`;
               if (Number(before.employeeid) !== Number(this.employeeid) || Number(before.branchid) !== Number(this.branchid)) return 'You can only edit your own branch expense.';
               const { name, amount, description, merchant, category, date } = expenseData;
               const commission = !trx.schema || await trx.schema.hasTable('commission_batch_payments') ? await trx('commission_batch_payments').where({ expense_id: this.expenseId }).first() : null;
               if (commission && Number(amount) !== Number((Number(commission.total_commission_amount) - Number(commission.waived_amount || 0)).toFixed(2))) return 'A commission request must retain its approved commission obligation; adjust the commission before changing its amount.';
               if (!String(name || '').trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || !category || !merchant || !Number.isFinite(new Date(date).getTime())) return 'Enter a name, positive amount, category, merchant and valid date.';
               const guard = new FinancialFinalizationGuard(this.tenantId, trx);
               await guard.assertRecordMutable('expensesrecord', this.expenseId!);
               await guard.assertDateOpen(this.branchid, before.date);
               await guard.assertDateOpen(this.branchid, date);
               const version = Number(before.workflow_version || 1) + 1;
               await trx('expensesrecord').where({ id: this.expenseId }).update({ name, amount, description, merchant, category, date: new Date(date), approved: 0, approvedby: null, approvedon: null, rejectionmessage: null, rejected_by: null, rejected_at: null, workflow_status: 'pending_approval', workflow_version: version, submitted_by: this.employeeid, submitted_at: new Date() });
               await trx('expense_approval_actions').insert({ expense_id: this.expenseId, action: 'resubmitted', from_status: status, to_status: 'pending_approval', actor_employeeid: this.employeeid, actor_branchid: this.branchid, amount, authority_source: 'submitter', workflow_version: version, metadata: JSON.stringify({ previous_amount: before.amount }), created_at: new Date() });
               return true;
          });
     }


     async deleteReceiptsList(data: string[]): Promise<boolean> {
          throw new Error('Use the authenticated expense receipt service to delete attachments');
     }

     async calculateDailyExpense(tenantId: number, branchid?: number, requireddate?: string | null): Promise<number | null> {
          let query = requireddate
               ? calculateDailyExpenseQuery
               : calculateDailyExpenseQuery.replace('DATE(date) = ?', 'DATE(date) = CURRENT_DATE');
          const values: Array<number | string> = requireddate ? [requireddate] : [];

          if (typeof branchid === 'number' && !isNaN(branchid)) {
               query += ` AND branchid = ?`;
               values.push(branchid);
          }

          const result = await promisifyQuery(tenantId, query, values);
          if (result.length > 0) {
               return result[0]['expense'];
          }
          return null;
     }

     async calCurrentMonthExpense(tenantId: number, month?: number): Promise<number | null> {
          if (month && typeof month !== 'number') {
               throw new TypeError('Argument must be empty if current month required or an integer of the month interested provided');
          }

          let query = calCurrentMonthExpenseQuery
          if (month) {
               query += ` MONTH(date) = ? AND approved = 1`;
          } else {
               query += ` MONTH(date) = MONTH(CURRENT_DATE) AND approved = 1`;
          }
          const result = await promisifyQuery(tenantId, query, [month]);
          if (result.length > 0) {
               return result[0]['expense'];
          }
          return null;
     }

     async calculateYearlyExpense(tenantId: number, year?: number): Promise<number | null> {
          let query = calculateYearlyExpenseQuery
          if (year) {
               query += ` YEAR(date) = ? AND approved = 1`;
          } else {
               query += ` YEAR(date) = YEAR(CURRENT_DATE) AND approved = 1`;
          }
          const result = await promisifyQuery(tenantId, query, [year]);
          if (result.length > 0) {
               return result[0]['expense'];
          }
          return null;
     }

     async getMonthlySummary(tenantId: number): Promise<{ [key: number]: number | null }> {
          let report: { [key: number]: number | null } = {};
          let current = 0;
          while (current <= 12) {
               const result = await this.calCurrentMonthExpense(tenantId, current);
               report[current] = result;
               current++;
          }
          return report;
     }

     async updateExpenseDecision(tenantId: number, status: string, decisions: Array<{ expenseid: number, information: string, employeeid: number }>, tTransaction?: any): Promise<boolean> {
          if (!decisions || decisions.length === 0 || !status) {
               throw new Error('status and decisions must be provided');
          }

          const connection = tTransaction ? tTransaction : await KnexConnection(tenantId);
          const conn = tTransaction ? tTransaction : await connection.transaction();
          const shouldManageTransaction = !tTransaction;



          try {

               for (const decision of decisions) {
                    const { expenseid, information, employeeid } = decision;

                    let statusNumber: number | undefined = undefined;

                    if (status === "pending") {
                         statusNumber = 0;
                    } else if (status === "rejected") {
                         statusNumber = 2;
                    } else if (status === "approved") {
                         statusNumber = 1;
                    } else {
                         statusNumber = undefined;
                    }

                    if (statusNumber === undefined) {
                         throw new Error('Invalid status provided');
                    }

                    let query = updateExpenseDecisionQuery;
                    let values: Array<any> = [];
                    values.push(statusNumber);
                    values.push(employeeid);

                    if (statusNumber === 2) {
                         query += `, rejectionMessage = ?`;
                         values.push(information);
                    }
                    query += ` WHERE id = ?`;
                    values.push(expenseid);

                    const previous = await conn('expensesrecord').select('approved').where({ id: expenseid }).first();
                    const previousStatus = previous ? Number(previous.approved) : null;

                    const [result] = await conn.raw(query, values);
                    if ((result as any).affectedRows === 0) {
                         throw new Error(`Failed to update expense ${expenseid}`);
                    }

                    if (statusNumber === 1 && previousStatus !== 1) {
                         await enqueueExpenseAccrual(tenantId, expenseid, conn);
                    } else if (statusNumber !== 1 && previousStatus === 1) {
                         await enqueueExpenseAccrualReversal(tenantId, expenseid, conn);
                    }
               }

               if (shouldManageTransaction) {
                    await conn.commit();
               }
               return true;

          } catch (err: any) {
               if (shouldManageTransaction) {
                    await conn.rollback();
               }
               logger.error('Transaction error in bulk expense decisions:', err);
               throw new Error('Transaction failed: ' + err.message);
          } finally {
               if (shouldManageTransaction) {
                    conn.destroy();
               }
          }
     }

     async getAllExpenseCategory(): Promise<PrimeLimsTableexpensesrecord[]> {
          return await promisifyQuery(this.tenantId, getAllExpenseCategoryQuery);
     }

     async isExpenseExist(tenantId: number, category: string): Promise<boolean> {
          if (!category) throw new TypeError('category not needed');
          const row = await promisifyQuery(tenantId, isExpenseExistQuery, [category]);
          return row.length > 0;
     }

     async createExpenseCategory(tenantId: number, category: string, employeeid: number, trx?: any): Promise<string | boolean> {
          if (!category) throw new ReferenceError('category not provided');
          if (typeof category !== 'string') throw new TypeError('category must be type string');
          if (isNaN(employeeid)) {
               throw new TypeError(employeeid + " must be type number");
          }

          if (await this.isExpenseExist(tenantId, category)) {
               return `category exist`;
          }

          let result;
          if (trx) {
               result = await trx('dboexpensecategory').insert({
                    category,
                    employeeid,
                    createdon: new Date()
               });
          } else {
               const connection = await KnexConnection(tenantId);
               result = await connection('dboexpensecategory').insert({
                    category,
                    employeeid,
                    createdon: new Date()
               });
          }
          return result && result.length > 0;
     }
     async updateExpenseCategory(tenantId: number, editid: number, category: string): Promise<boolean> {
          if (!editid || !category) {
               throw new Error('category and editid not provided');
          }
          return rowAffected(await promisifyQuery(tenantId, updateExpenseCategoryQuery, [category, editid]));
     }


     public static async getExpensesByCreatedOnRange(tenantId: number, from: string | Date, to: string | Date): Promise<PrimeLimsTableexpensesrecord[] | []> {
          if (!from || !to) throw new Error('Both from and to timestamps are required');
          return await promisifyQuery(tenantId, expense_between_dates_query, [from, to]);
     }

     async getExpensesByGroup(tenantId: number, groupId: string): Promise<any[]> {
          try {
               const query = `
                    SELECT * FROM expensesrecord
                    WHERE groupId = ?
                    ORDER BY date DESC
               `;
               const expenses = await promisifyQuery(tenantId, query, [groupId]);
               return expenses;
          } catch (err: any) {
               logger.error(err?.message);
               throw new Error(err);
          }
     }

     private generateGroupId(): string {
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(2, 8);
          const employeePart = this.employeeid.toString().padStart(4, '0');
          return `EXP-${timestamp}-${employeePart}-${random}`.toUpperCase();
     }

}
