"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../../hooks/helper");
class ExpensesAnalytics {
    constructor(tenantId, branchid, expenseId, startdate, enddate) {
        this.branchid = branchid;
        this.tenantId = tenantId;
        this.expenseId = expenseId;
        this.startdate = startdate;
        this.enddate = enddate;
    }
    // Daily Expense Analytics
    async getDailyExpenseAnalytics() {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL lims_anal_exp_DailyExpenseAnalytics(?, ?, ?)`, [this.branchid, this.startdate, this.enddate]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    // Hourly Expense Analytics
    async getHourlyExpenseAnalytics(targetDate) {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL lims_anal_exp_HourlyExpenseAnalytics(?, ?)`, [this.branchid, targetDate]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    // Weekly Expense Analytics
    async getWeeklyExpenseAnalytics() {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL lims_anal_exp_WeeklyExpenseAnalytics(?, ?, ?)`, [this.branchid, this.startdate, this.enddate]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    // Monthly Expense Analytics
    async getMonthlyExpenseAnalytics() {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL lims_anal_exp_MonthlyExpenseAnalytics(?, ?, ?)`, [this.branchid, this.startdate, this.enddate]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    // Quarterly Expense Analytics
    async getQuarterlyExpenseAnalytics() {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL lims_anal_exp_QuarterlyExpenseAnalytics(?, ?, ?)`, [this.branchid, this.startdate, this.enddate]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    // Yearly Expense Analytics
    async getYearlyExpenseAnalytics(startYear, endYear) {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL lims_anal_exp_YearlyExpenseAnalytics(?, ?, ?)`, [this.branchid, startYear, endYear]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    // Top Expense Categories
    async getTopExpenseCategories() {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL lims_anal_exp_TopExpenseCategories(?, ?, ?)`, [this.branchid, this.startdate, this.enddate]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    // Top Expense Merchants
    async getTopExpenseMerchants() {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL lims_anal_exp_TopExpenseMerchants(?, ?, ?)`, [this.branchid, this.startdate, this.enddate]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    // Top Expense Employees
    async getTopExpenseEmployees(limitCount = 10) {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL lims_anal_exp_TopExpenseEmployees(?, ?, ?, ?)`, [this.branchid, this.startdate, this.enddate, limitCount]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    // Expense Trends by Category
    async getExpenseTrendsByCategory(categoryId) {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL lims_anal_exp_ExpenseTrendsByCategory(?, ?, ?, ?)`, [categoryId || null, this.branchid, this.startdate, this.enddate]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
    // Expense Comparison by Period
    async getExpenseComparisonByPeriod(currentStartDate, currentEndDate, previousStartDate, previousEndDate) {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, `CALL lims_anal_exp_ExpenseComparisonByPeriod(?, ?, ?, ?, ?)`, [this.branchid, currentStartDate, currentEndDate, previousStartDate, previousEndDate]);
        return Array.isArray(result) && result.length > 0 ? result[0] : [];
    }
}
exports.default = ExpensesAnalytics;
