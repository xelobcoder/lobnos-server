import { customError, promisifyQuery, rowAffected, paginationQuery } from "../../hooks/helper";
import logger from "../../hooks/logger";
import { readdir, unlink } from 'fs/promises';
import User from "../../LobnosAuth/user";
import {
     calculateDailyExpenseQuery,
     calculateYearlyExpenseQuery,
     calCurrentMonthExpenseQuery,
     createExpenseCategoryQuery,
     generateNewExpenseQuery,
     getAllExpenseCategoryQuery,
     getExpenseImageListQuery,
     getExpensesRecordQuery,
     isExpenseExistQuery,
     RECEIPTS_PATH,
     updateExpenseCategoryQuery,
     updateExpenseDecisionQuery
} from "./queries";
import { IExpenseRepository } from "./interfaces/IExpenseRepository";
import { ExpenseData } from "./interfaces/types";
import path from "path";

export default class Expenses implements IExpenseRepository {
     private employeeid: number | undefined;
     private branchid: number | undefined;

     constructor(employeeid: number | undefined, branchid: number | undefined) {
          this.employeeid = employeeid;
          this.branchid = branchid;
     }

     isExpenseApproved(): void { }

     getAdminRequest(): void { }

     getRequest(): void {
          if (!this.employeeid || !this.branchid) {
               throw new Error('branchid or employeeid not provided');
          }
     }
     async generateNewExpense(
          tenantId:number,
          data: ExpenseData
     ): Promise<boolean> {
          try {
               if (Object.keys(data).length === 0 || typeof data !== 'object') {
                    throw new TypeError('object with keys required');
               }

               const { employeeid, branchid, name, date, merchant, amount, mode, description, category } = data;

               if (!employeeid || !branchid || !name) {
                    throw new Error('name, employeeid, branchid required');
               }
               if (category === 0 || !category) {
                    throw new Error('category id not provided');
               }

               let inserted = await promisifyQuery(tenantId, generateNewExpenseQuery, [name, amount, mode, employeeid, branchid, description, merchant, category, date]);

               inserted = rowAffected(inserted);
               return inserted
          } catch (err: any) {
               logger.error(err?.message);
          }
     }

     async getExpensesRecord(
          tenantId:number,
          employeeid: number,
          branchid: number,
          status: string | undefined,
          pageQuery: { count: number; page: number } = { count: 10, page: 1 },
          from?: string,
          to?: string,
          state?: string
     ): Promise<any> {
          const record = await new User(null, null, null, null, null).userExistWithId(employeeid,tenantId);

          let role: string | undefined;
          let query = getExpensesRecordQuery;
          let values: (number | string)[] = [];

          if (record.length > 0) {
               role = record[0]['role'];
          }

          if (!['admin', 'manager'].includes(role || '')) {
               query += ` WHERE er.employeeid = ? AND er.branchid = ?`;
               values = [employeeid, branchid];
          } else {
               query += ` WHERE er.employeeid = ?`;
               values = [employeeid];
          }

          if (status === 'approved') {
               query += ` AND er.approved = 1`;
          } else if (status === 'rejected') {
               query += ` AND er.approved = 2`;
          } else if (status === 'pending') {
               query += ` AND er.approved = 0`;
          }

          if (from && to) {
               query += ` AND er.date BETWEEN ? AND ?`;
               values.push(from, to);
          }

          if (state) {
               query += ` AND er.state = ?`;
               values.push(state);
          }

          query += ` LIMIT ? OFFSET ?`;
          return await paginationQuery(pageQuery, query, values,tenantId);
     }



     async getExpenseImageList(expenseid: string): Promise<string[]> {
          try {
               let images = await readdir(path.join(__dirname,RECEIPTS_PATH));
               if (images.length > 0) {
                    images = images.filter((item) => item.split("-")[0] === expenseid);
               }
               return images;
          } catch (err: any) {
               throw err?.message || err;
          }
     }

     async getSingleExpense(tenantId:number,expenseid: string): Promise<any[]> {
          const result = await promisifyQuery(tenantId, getExpenseImageListQuery, [parseInt(expenseid)]);
          if (result.length > 0) {
               const images = await this.getExpenseImageList(expenseid);
               result[0]['images'] = images;
               return result;
          }
          return result;
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
                         await unlink(`api/uploads/receipts/${item}`);
                         return true;
                    } catch {
                         return false;
                    }
               })
          );

          return !status.includes(false);
     }

     async calculateDailyExpense(tenantId:number,branchid: number | undefined, requireddate: string | null): Promise<number | null> {
          let query = calculateDailyExpenseQuery;
          query += branchid && typeof branchid === "number" ? ` AND branchid = ${branchid}` : query
          const result = await promisifyQuery(tenantId, query, [requireddate ? requireddate : 'CURRENT_DATE']);
          if (result.length > 0) {
               return result[0]['expense'];
          }
          return null;
     }

     async calCurrentMonthExpense(tenantId:number,month?: number): Promise<number | null> {
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

     async calculateYearlyExpense(tenantId:number,year?: number): Promise<number | null> {
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

     async updateExpenseDecision(tenantId:number,status: string, expenseid: number, information: string, employeeid: number): Promise<boolean> {
          if (!expenseid || !status || !employeeid) {
               throw new Error('status, employeeid, and expenseid must be provided');
          }

          let statusNumber: number | undefined = undefined;
          let values: Array<any> = [];

          if (status === "pending") {
               statusNumber = 0;
          } else if (status === "rejected") {
               statusNumber = 2;
          } else if (status === "approved") {
               statusNumber = 1;
          } else {
               statusNumber = undefined;
          }

          let query = updateExpenseDecisionQuery
          values.push(statusNumber);
          values.push(employeeid);

          if (statusNumber === 2) {
               query += `, rejectionMessage = ?`;
               values.push(information);
          }

          query += ` WHERE id = ?`;
          values.push(expenseid);

          return rowAffected(await promisifyQuery(tenantId, query, values));
     }

     async getAllExpenseCategory(tenantId:number): Promise<any[]> {
          return await promisifyQuery(tenantId, getAllExpenseCategoryQuery);
     }

     async isExpenseExist(tenantId:number,category: string): Promise<boolean> {
          if (!category) throw new TypeError('category not needed');
          const row = await promisifyQuery(tenantId, isExpenseExistQuery, [category]);
          return row.length > 0;
     }

     async createExpenseCategory(tenantId:number,category: string, employeeid: number): Promise<string | boolean> {
          if (!category) throw new ReferenceError('category not provided');
          if (typeof category !== 'string') throw new TypeError('category must be type string');
          if (isNaN(employeeid)) {
               throw new TypeError(employeeid + " must be type number");
          }

          if (await this.isExpenseExist(tenantId,category)) {
               return `category exist`;
          }

          const isInserted = await promisifyQuery(tenantId, createExpenseCategoryQuery, [category, employeeid]);
          return rowAffected(isInserted);
     }
     async updateExpenseCategory(tenantId:number,editid: number, category: string): Promise<boolean> {
          if (!editid || !category) {
               throw new Error('category and editid not provided');
          }
          return rowAffected(await promisifyQuery(tenantId, updateExpenseCategoryQuery, [category, editid]));
     }
}
