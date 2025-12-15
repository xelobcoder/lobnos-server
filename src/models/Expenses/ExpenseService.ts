
import { promisifyQuery, rowAffected, paginationQuery } from "../../hooks/helper";
import logger from "../../hooks/logger";
import { readdir, unlink } from 'fs/promises';
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
     RECEIPTS_PATH,
     updateExpenseCategoryQuery,
     updateExpenseDecisionQuery,
     updateExpenseQuery
} from "./queries";
import { IExpenseRepository } from "./interfaces/IExpenseRepository";
import path from "path";
import { PrimeLimsTableexpensesrecord } from "../../database/DatabaseTableSchema";
import { OperationsFailures } from "../operations/types";
import { primeTenancyConnector } from '../../models/Tenancy/tenantConnections';
import { databaseConnectionPool } from '../../database/connection';
import { configuration } from '../../hooks/configuration';
import KnexConnection from "../../database/KnexConnections";

export default class Expenses implements IExpenseRepository {
     private employeeid: number;
     private branchid: number;
     private tenantId: number;
     private expenseId: null | number

     constructor(employeeid: number, branchid: number, tenantId: number, expenseId: number | null = null) {
          this.employeeid = employeeid;
          this.branchid = branchid;
          this.tenantId = tenantId
          this.expenseId = expenseId;
     }


     isExpenseApproved(): Promise<boolean> {
          return
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

               const { employeeid, branchid, name, date, merchant, amount, description, category } = data;

               if (!employeeid || !branchid || !name) {
                    throw new Error('name, employeeid, branchid required');
               }
               if (category === 0 || !category) {
                    throw new Error('category id not provided');
               }

               const finalGroupId = groupId || this.generateGroupId();
               const result = trx ? await trx.raw(generateNewExpenseQuery, [name, amount, employeeid, branchid, description, merchant, category, date, finalGroupId]) : await promisifyQuery(this.tenantId, generateNewExpenseQuery, [name, amount, employeeid, branchid, description, merchant, category, date, finalGroupId]);
               if (rowAffected(result)) {
                    return result.insertId;
               }
               return null;
          } catch (err: any) {
               console.log(err)
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

                         if (!employeeid || !branchid || !name) {
                              throw new Error('name, employeeid, branchid required');
                         }
                         if (category === 0 || !category) {
                              throw new Error('category id not provided');
                         }

                         const [result] = await connection.query(generateNewExpenseQuery,
                              [name, amount, employeeid, branchid, description, merchant, category, date, results.groupId]);

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
          from?: string,
          to?: string,
          state?: string
     ): Promise<any> {
          const record = await new User(null, null, null, null, null).userExistWithId(employeeid, tenantId);

          if (!record || record.length === 0) {
               throw new Error('User not found');
          }


          let query = getExpensesRecordQuery;
          let values: (number | string)[] = [];
          let hasWhereClause = false;

          const role = record[0]['role'];

          const isAdmin = (role === 'admin' || role === 'manager');
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

          if (status === 'approved') {
               addCondition('er.approved = 1');
          } else if (status === 'rejected') {
               addCondition('er.approved = 2');
          } else if (status === 'pending') {
               addCondition('er.approved = 0');
          }

          if (from && to) {
               addCondition('er.date BETWEEN ? AND ?', [from, to]);
          }

          if (state) {
               addCondition('er.state = ?', [state]);
          }

          query += ` ORDER BY er.id DESC LIMIT ? OFFSET ?`;
          return await paginationQuery(pageQuery, query, values, tenantId);
     }



     async getExpenseImageList(expenseid: string): Promise<string[]> {
          try {
               let images = await readdir(path.join(__dirname, RECEIPTS_PATH));
               if (images.length > 0) {
                    images = images.filter((item) => item.split("-")[0] === expenseid);
               }
               return images;
          } catch (err: any) {
               throw err?.message || err;
          }
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


     public async updateExpenseRecord(expenseData: PrimeLimsTableexpensesrecord) {
          try {

               const isValidExpenseRecord = await this.isExpenseRecordAvailable();

               if (!isValidExpenseRecord) return OperationsFailures.unfoundID;

               const {
                    id,
                    name,
                    amount,
                    category,
                    branchid,
                    description,
                    merchant,
                    employeeid,
                    date,
               } = expenseData;


               const queryParams = [
                    name,
                    amount,
                    employeeid,
                    branchid,
                    description,
                    merchant,
                    category,
                    date,
                    id,
               ];

               const insertionStatus = await promisifyQuery(this.tenantId, updateExpenseQuery, queryParams);

               return rowAffected(insertionStatus);
          } catch (error) {
               console.error('Error updating expense record:', error);
               return false;
          }
     }


     async deleteReceiptsList(data: string[]): Promise<boolean> {
          if (!data) {
               throw new Error('data not provided');
          }
          if (!Array.isArray(data)) {
               throw new TypeError('Array required');
          }
          if (data.length === 0) return true;

          const status = await Promise.all(
               data.map(async (item) => {
                    try {
                         const filepath = path.join(__dirname, '../../../../', `/public/uploads/expenses/receipts/${item}`)
                         await unlink(filepath);
                         return true;
                    } catch {
                         return false;
                    }
               })
          );

          return !status.includes(false);
     }

     async calculateDailyExpense(tenantId: number, branchid: number | undefined, requireddate: string | null): Promise<number | null> {
          let query = calculateDailyExpenseQuery;
          query += branchid && typeof branchid === "number" ? ` AND branchid = ${branchid}` : query
          const result = await promisifyQuery(tenantId, query, [requireddate ? requireddate : 'CURRENT_DATE']);
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

     async updateExpenseDecision(tenantId: number, status: string, decisions: Array<{ expenseid: number, information: string, employeeid: number }>): Promise<boolean> {
          if (!decisions || decisions.length === 0 || !status) {
               throw new Error('status and decisions must be provided');
          }

          const connection = await KnexConnection(tenantId);
          const conn = await connection.transaction();

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

                    const [result] = await conn.raw(query, values);
                    if ((result as any).affectedRows === 0) {
                         throw new Error(`Failed to update expense ${expenseid}`);
                    }
               }

               await conn.commit();
               return true;

          } catch (err: any) {
               await conn.rollback();
               logger.error('Transaction error in bulk expense decisions:', err);
               throw new Error('Transaction failed: ' + err.message);
          } finally {
               conn.destroy();
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

     async createExpenseCategory(tenantId: number, category: string, employeeid: number): Promise<string | boolean> {
          if (!category) throw new ReferenceError('category not provided');
          if (typeof category !== 'string') throw new TypeError('category must be type string');
          if (isNaN(employeeid)) {
               throw new TypeError(employeeid + " must be type number");
          }

          if (await this.isExpenseExist(tenantId, category)) {
               return `category exist`;
          }

          const isInserted = await promisifyQuery(tenantId, createExpenseCategoryQuery, [category, employeeid]);
          return rowAffected(isInserted);
     }
     async updateExpenseCategory(tenantId: number, editid: number, category: string): Promise<boolean> {
          if (!editid || !category) {
               throw new Error('category and editid not provided');
          }
          return rowAffected(await promisifyQuery(tenantId, updateExpenseCategoryQuery, [category, editid]));
     }


     public static async getExpensesByCreatedOnRange(tenantId: number,from: string | Date, to: string | Date): Promise<PrimeLimsTableexpensesrecord[] | []> {
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
