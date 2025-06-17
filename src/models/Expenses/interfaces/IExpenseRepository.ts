import { PrimeLimsTableexpensesrecord } from "../../../database/DatabaseTableSchema";
import { ExpenseData, PaginationQuery } from "./types";

export interface IExpenseRepository {
    generateNewExpense(data: Omit<PrimeLimsTableexpensesrecord,'id'>): Promise<boolean>;
    getExpensesRecord(
        tenantId: number,
        employeeId: number,
        branchId: number,
        status?: string,
        pageQuery?: PaginationQuery,
        from?: string,
        to?: string,
        state?: string
    ): Promise<any>;
    getExpenseImageList(expenseId: string): Promise<string[]>;
    getSingleExpense(tenantId: number, expenseId: string): Promise<any[]>;
    isExpenseApproved(tenantId: number, expenseid: number): Promise<boolean>;
    deleteReceiptsList(data: string[]): Promise<boolean>;
    calculateDailyExpense(tenantId: number, branchId?: number, requiredDate?: string): Promise<number | null>;
    calCurrentMonthExpense(tenantId: number, month?: number): Promise<number | null>;
    calculateYearlyExpense(tenantId: number, year?: number): Promise<number | null>;
    getMonthlySummary(tenantId: number): Promise<{ [key: number]: number | null }>;
    updateExpenseDecision(tenantId: number, status: string, expenseId: number, information: string, employeeId: number): Promise<boolean>;
    getAllExpenseCategory(tenantId: number): Promise<any[]>;
    isExpenseExist(tenantId: number, category: string): Promise<boolean>;
    createExpenseCategory(tenantId: number, category: string, employeeId: number): Promise<string | boolean>;
    updateExpenseCategory(tenantId: number, editId: number, category: string): Promise<boolean>;
}