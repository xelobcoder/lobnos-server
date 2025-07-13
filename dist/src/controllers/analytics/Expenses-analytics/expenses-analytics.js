"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../../hooks/helper");
const Expenses_Analytics_1 = __importDefault(require("../../../models/analytics/ExpensesAnalytics/Expenses-Analytics"));
class ExpensesAnalyticsController {
    constructor() {
        this.getBranchMonthlyExpensesHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const monthlyExpenses = await expensesAnalytics.getBranchMonthlyExpenses();
                res.status(200).json(monthlyExpenses);
            }
            catch (error) {
                console.error("Error fetching monthly expenses:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        this.getEmployeeCategoryExpensesHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const empId = req.query.employeeid ? parseInt(req.query.employeeid) : null;
                if (!empId)
                    return (0, helper_1.customError)("Employee ID is required.", 400, res);
                const data = await expensesAnalytics.getEmployeeCategoryExpenses(empId);
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching employee category expenses:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        this.getApprovalStatusByBranchExpensesHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const data = await expensesAnalytics.getApprovalStatusByBranchExpenses();
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching approval status by branch:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        this.getServiceLinkedExpensesHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const data = await expensesAnalytics.getServiceLinkedExpenses();
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching service linked expenses:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        this.getExpenseDetailsExpensesHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const expenseId = req.query.expensesId ? parseInt(req.query.expensesId.toString()) : null;
                if (!expenseId)
                    return (0, helper_1.customError)("Expense ID is required.", 400, res);
                const data = await expensesAnalytics.getExpenseDetailsExpenses(expenseId);
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching expense details:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        this.getMonthlyExpenseSummaryExpensesHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const data = await expensesAnalytics.getMonthlyExpenseSummaryExpenses();
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching monthly expense summary:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        this.getTotalExpensesByCategoryHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const data = await expensesAnalytics.getTotalExpensesByCategory();
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching total expenses by category:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        this.getDailyExpenseSummaryExpensesHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                console.log("Expenses Analytics:", expensesAnalytics);
                if (!expensesAnalytics)
                    return;
                const data = await expensesAnalytics.getDailyExpenseSummaryExpenses();
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching daily expense summary:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        this.getWeeklyExpenseSummaryExpensesHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const data = await expensesAnalytics.getWeeklyExpenseSummaryExpenses();
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching weekly expense summary:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        this.getYearlyExpenseSummaryExpensesHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const data = await expensesAnalytics.getYearlyExpenseSummaryExpenses();
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching yearly expense summary:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        this.getHourlyExpenseSummaryForDateExpensesHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const targetDate = req.query.targetDate;
                if (!targetDate)
                    return (0, helper_1.customError)("Target date is required.", 400, res);
                const data = await expensesAnalytics.getHourlyExpenseSummaryForDateExpenses(targetDate);
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching hourly expense summary:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        this.getTopExpenseCategoriesExpensesHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const limitCount = req.query.limitCount ? parseInt(req.query.limitCount) : 5;
                const data = await expensesAnalytics.getTopExpenseCategoriesExpenses(limitCount);
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching top expense categories:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        this.getEmployeeTopExpensesHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const limitCount = req.query.limitCount ? parseInt(req.query.limitCount) : 5;
                const data = await expensesAnalytics.getEmployeeTopExpenses(limitCount);
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching employee top expenses:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        this.getExpenseTrendByCategoryExpensesHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const categoryId = req.query.categoryId ? parseInt(req.query.categoryId) : null;
                const startDate = req.query.startDate;
                const endDate = req.query.endDate;
                if (!categoryId || !startDate || !endDate) {
                    return (0, helper_1.customError)("Category ID, start date, and end date are required.", 400, res);
                }
                const data = await expensesAnalytics.getExpenseTrendByCategoryExpenses(categoryId, startDate, endDate);
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching expense trend by category:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        this.getPendingExpensesListHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const data = await expensesAnalytics.getPendingExpensesList();
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching pending expenses list:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        this.getExpenseCountByStatusExpensesHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const data = await expensesAnalytics.getExpenseCountByStatusExpenses();
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching expense count by status:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
    }
    evaluateQueryParams(query, response) {
        const { branchid, employeeid, tenantId, expensesId, startDate, endDate } = query;
        if (!branchid || !tenantId) {
            return (0, helper_1.customError)("Branch ID and Tenant ID are required.", 400, response);
        }
        const pTenantId = parseInt(tenantId);
        const pBranchId = parseInt(branchid);
        const pstartDate = startDate ? startDate : null;
        const pendDate = endDate ? endDate : null;
        const pexpensesId = expensesId ? parseInt(expensesId.toString()) : null;
        const pEmployeeId = employeeid ? parseInt(employeeid.toString()) : null;
        return new Expenses_Analytics_1.default(pBranchId, pTenantId, pexpensesId, pstartDate, pendDate);
    }
}
exports.default = ExpensesAnalyticsController;
