"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../../hooks/helper");
class ExpensesAnalytics {
    constructor(branchid, tenantId, expenseId, startdate, enddate) {
        this.branchid = branchid;
        this.tenantId = tenantId;
        this.expenseId = expenseId;
        this.startdate = startdate;
        this.enddate = enddate;
    }
    async getBranchMonthlyExpenses() {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL BranchMonthlyExpenses(?, ?, ?)`, [this.branchid, this.startdate, this.enddate]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    async getEmployeeCategoryExpenses(empId) {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL EmployeeCategoryExpenses(?, ?, ?, ?)`, [empId, this.branchid, this.startdate, this.enddate]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    async getApprovalStatusByBranchExpenses() {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL ApprovalStatusByBranchExpenses(?)`, [this.branchid]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    async getServiceLinkedExpenses() {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL ServiceLinkedExpenses(?)`, [this.branchid]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    async getExpenseDetailsExpenses(expenseId) {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL GetExpenseDetailsExpenses(?, ?)`, [expenseId, this.branchid]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    async getMonthlyExpenseSummaryExpenses() {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL MonthlyExpenseSummaryExpenses(?)`, [this.branchid]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    async getTotalExpensesByCategory() {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL TotalExpensesByCategory(?)`, [this.branchid]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    async getDailyExpenseSummaryExpenses() {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL DailyExpenseSummaryExpenses(?)`, [this.branchid]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    async getWeeklyExpenseSummaryExpenses() {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL WeeklyExpenseSummaryExpenses(?)`, [this.branchid]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    async getYearlyExpenseSummaryExpenses() {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL YearlyExpenseSummaryExpenses(?)`, [this.branchid]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    async getHourlyExpenseSummaryForDateExpenses(targetDate) {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL HourlyExpenseSummaryForDateExpenses(?, ?)`, [this.branchid, targetDate]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    async getTopExpenseCategoriesExpenses(limitCount) {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL TopExpenseCategoriesExpenses(?, ?)`, [this.branchid, limitCount]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    async getEmployeeTopExpenses(limitCount) {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL EmployeeTopExpenses(?, ?)`, [this.branchid, limitCount]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    async getExpenseTrendByCategoryExpenses(categoryId, startDate, endDate) {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL ExpenseTrendByCategoryExpenses(?, ?, ?, ?)`, [this.branchid, categoryId, startDate, endDate]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    async getPendingExpensesList() {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL PendingExpensesList(?)`, [this.branchid]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    async getExpenseCountByStatusExpenses() {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL ExpenseCountByStatusExpenses(?)`, [this.branchid]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
}
exports.default = ExpensesAnalytics;
