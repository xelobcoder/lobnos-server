"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../../hooks/helper");
const Expenses_Analytics_1 = __importDefault(require("../../../models/analytics/ExpensesAnalytics/Expenses-Analytics"));
class ExpensesAnalyticsController {
    constructor() {
        // Daily Expense Analytics Handler
        this.getDailyExpenseAnalyticsHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const data = await expensesAnalytics.getDailyExpenseAnalytics();
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching daily expense analytics:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        // Hourly Expense Analytics Handler
        this.getHourlyExpenseAnalyticsHandler = async (req, res) => {
            try {
                const { branchid } = req.query;
                if (!branchid)
                    return (0, helper_1.customError)("Branch ID is required.", 400, res);
                const targetDate = req.query.targetDate;
                if (!targetDate)
                    return (0, helper_1.customError)("Target date is required.", 400, res);
                const pBranchId = parseInt(branchid);
                const expensesAnalytics = new Expenses_Analytics_1.default(null, pBranchId, null, null, null);
                const data = await expensesAnalytics.getHourlyExpenseAnalytics(targetDate);
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching hourly expense analytics:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        // Weekly Expense Analytics Handler
        this.getWeeklyExpenseAnalyticsHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const data = await expensesAnalytics.getWeeklyExpenseAnalytics();
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching weekly expense analytics:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        // Monthly Expense Analytics Handler
        this.getMonthlyExpenseAnalyticsHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const data = await expensesAnalytics.getMonthlyExpenseAnalytics();
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching monthly expense analytics:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        // Quarterly Expense Analytics Handler
        this.getQuarterlyExpenseAnalyticsHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const data = await expensesAnalytics.getQuarterlyExpenseAnalytics();
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching quarterly expense analytics:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        // Yearly Expense Analytics Handler
        this.getYearlyExpenseAnalyticsHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const startYear = req.query.startYear ? parseInt(req.query.startYear) : new Date().getFullYear() - 1;
                const endYear = req.query.endYear ? parseInt(req.query.endYear) : new Date().getFullYear();
                const data = await expensesAnalytics.getYearlyExpenseAnalytics(startYear, endYear);
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching yearly expense analytics:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        // Top Expense Categories Handler
        this.getTopExpenseCategoriesHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const data = await expensesAnalytics.getTopExpenseCategories();
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching top expense categories:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        // Top Expense Merchants Handler
        this.getTopExpenseMerchantsHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const data = await expensesAnalytics.getTopExpenseMerchants();
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching top expense merchants:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        // Top Expense Employees Handler
        this.getTopExpenseEmployeesHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const limitCount = req.query.limitCount ? parseInt(req.query.limitCount) : 10;
                const data = await expensesAnalytics.getTopExpenseEmployees(limitCount);
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching top expense employees:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        // Expense Trends by Category Handler
        this.getExpenseTrendsByCategoryHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const categoryId = req.query.categoryId ? parseInt(req.query.categoryId) : undefined;
                const data = await expensesAnalytics.getExpenseTrendsByCategory(categoryId);
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching expense trends by category:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
        // Expense Comparison by Period Handler
        this.getExpenseComparisonByPeriodHandler = async (req, res) => {
            try {
                const expensesAnalytics = this.evaluateQueryParams(req.query, res);
                if (!expensesAnalytics)
                    return;
                const { currentStartDate, currentEndDate, previousStartDate, previousEndDate } = req.query;
                if (!currentStartDate || !currentEndDate || !previousStartDate || !previousEndDate) {
                    return (0, helper_1.customError)("All date parameters (currentStartDate, currentEndDate, previousStartDate, previousEndDate) are required.", 400, res);
                }
                const data = await expensesAnalytics.getExpenseComparisonByPeriod(currentStartDate, currentEndDate, previousStartDate, previousEndDate);
                res.status(200).json(data);
            }
            catch (error) {
                console.error("Error fetching expense comparison by period:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        };
    }
    evaluateQueryParams(query, response) {
        const { branchid, employeeid, expensesId, startDate, endDate, tenantId } = query;
        if (!branchid) {
            return (0, helper_1.customError)("Branch ID is required.", 400, response);
        }
        const pBranchId = parseInt(branchid);
        const pstartDate = startDate ? startDate : null;
        const pTenantId = tenantId ? parseInt(tenantId) : null;
        const pendDate = endDate ? endDate : null;
        const pexpensesId = expensesId ? parseInt(expensesId.toString()) : null;
        const pEmployeeId = employeeid ? parseInt(employeeid.toString()) : null;
        return new Expenses_Analytics_1.default(pTenantId, pBranchId, pexpensesId, pstartDate, pendDate);
    }
}
exports.default = ExpensesAnalyticsController;
