"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpenseAnalyticsController = void 0;
const ExpenseAnalyticsQueries_1 = require("../../models/Expenses/ExpenseAnalyticsQueries");
const helper_1 = require("../../hooks/helper");
class ExpenseAnalyticsController {
    static async getDailyExpenseAnalytics(req, res) {
        try {
            const { tenantId, startDate, endDate } = req.query;
            if (!tenantId || !startDate || !endDate) {
                return (0, helper_1.customError)('tenantId, startDate, and endDate are required', 400, res);
            }
            const analytics = new ExpenseAnalyticsQueries_1.ExpenseAnalyticsQueries(parseInt(tenantId));
            const result = await analytics.getDailyExpenseAnalytics(startDate, endDate);
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Daily expense analytics retrieved successfully',
                data: result[0]
            });
        }
        catch (error) {
            console.error('Error in getDailyExpenseAnalytics:', error);
            (0, helper_1.customError)('Failed to retrieve daily expense analytics', 500, res);
        }
    }
    static async getExpenseComparisonByPeriod(req, res) {
        try {
            const { tenantId, currentStart, currentEnd, previousStart, previousEnd, branchid } = req.query;
            if (!tenantId || !currentStart || !currentEnd || !previousStart || !previousEnd) {
                return (0, helper_1.customError)('All date parameters and tenantId are required', 400, res);
            }
            const analytics = new ExpenseAnalyticsQueries_1.ExpenseAnalyticsQueries(parseInt(tenantId));
            const result = await analytics.getExpenseComparisonByPeriod(currentStart, currentEnd, previousStart, previousEnd, branchid ? parseInt(branchid) : undefined);
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Expense comparison analytics retrieved successfully',
                data: result[0]
            });
        }
        catch (error) {
            console.error('Error in getExpenseComparisonByPeriod:', error);
            (0, helper_1.customError)('Failed to retrieve expense comparison analytics', 500, res);
        }
    }
    static async getExpenseTrendsByCategory(req, res) {
        try {
            const { tenantId, startDate, endDate } = req.query;
            if (!tenantId || !startDate || !endDate) {
                return (0, helper_1.customError)('tenantId, startDate, and endDate are required', 400, res);
            }
            const analytics = new ExpenseAnalyticsQueries_1.ExpenseAnalyticsQueries(parseInt(tenantId));
            const result = await analytics.getExpenseTrendsByCategory(startDate, endDate);
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Expense trends by category retrieved successfully',
                data: result[0]
            });
        }
        catch (error) {
            console.error('Error in getExpenseTrendsByCategory:', error);
            (0, helper_1.customError)('Failed to retrieve expense trends by category', 500, res);
        }
    }
    static async getExpenseTrendsByEmployee(req, res) {
        try {
            const { tenantId, startDate, endDate, branchid } = req.query;
            if (!tenantId || !startDate || !endDate) {
                return (0, helper_1.customError)('tenantId, startDate, and endDate are required', 400, res);
            }
            const analytics = new ExpenseAnalyticsQueries_1.ExpenseAnalyticsQueries(parseInt(tenantId));
            const result = await analytics.getExpenseTrendsByEmployee(startDate, endDate, branchid ? parseInt(branchid) : undefined);
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Expense trends by employee retrieved successfully',
                data: result[0]
            });
        }
        catch (error) {
            console.error('Error in getExpenseTrendsByEmployee:', error);
            (0, helper_1.customError)('Failed to retrieve expense trends by employee', 500, res);
        }
    }
    static async getExpenseTrendsByMerchant(req, res) {
        try {
            const { tenantId, startDate, endDate } = req.query;
            if (!tenantId || !startDate || !endDate) {
                return (0, helper_1.customError)('tenantId, startDate, and endDate are required', 400, res);
            }
            const analytics = new ExpenseAnalyticsQueries_1.ExpenseAnalyticsQueries(parseInt(tenantId));
            const result = await analytics.getExpenseTrendsByMerchant(startDate, endDate);
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Expense trends by merchant retrieved successfully',
                data: result[0]
            });
        }
        catch (error) {
            console.error('Error in getExpenseTrendsByMerchant:', error);
            (0, helper_1.customError)('Failed to retrieve expense trends by merchant', 500, res);
        }
    }
    static async getHourlyExpenseAnalytics(req, res) {
        try {
            const { tenantId, date } = req.query;
            if (!tenantId || !date) {
                return (0, helper_1.customError)('tenantId and date are required', 400, res);
            }
            const analytics = new ExpenseAnalyticsQueries_1.ExpenseAnalyticsQueries(parseInt(tenantId));
            const result = await analytics.getHourlyExpenseAnalytics(date);
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Hourly expense analytics retrieved successfully',
                data: result[0]
            });
        }
        catch (error) {
            console.error('Error in getHourlyExpenseAnalytics:', error);
            (0, helper_1.customError)('Failed to retrieve hourly expense analytics', 500, res);
        }
    }
    static async getMonthlyExpenseAnalytics(req, res) {
        try {
            const { tenantId, year } = req.query;
            if (!tenantId || !year) {
                return (0, helper_1.customError)('tenantId and year are required', 400, res);
            }
            const analytics = new ExpenseAnalyticsQueries_1.ExpenseAnalyticsQueries(parseInt(tenantId));
            const result = await analytics.getMonthlyExpenseAnalytics(parseInt(year));
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Monthly expense analytics retrieved successfully',
                data: result[0]
            });
        }
        catch (error) {
            console.error('Error in getMonthlyExpenseAnalytics:', error);
            (0, helper_1.customError)('Failed to retrieve monthly expense analytics', 500, res);
        }
    }
    static async getWeeklyExpenseAnalytics(req, res) {
        try {
            const { tenantId, year } = req.query;
            if (!tenantId || !year) {
                return (0, helper_1.customError)('tenantId and year are required', 400, res);
            }
            const analytics = new ExpenseAnalyticsQueries_1.ExpenseAnalyticsQueries(parseInt(tenantId));
            const result = await analytics.getWeeklyExpenseAnalytics(parseInt(year));
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Weekly expense analytics retrieved successfully',
                data: result[0]
            });
        }
        catch (error) {
            console.error('Error in getWeeklyExpenseAnalytics:', error);
            (0, helper_1.customError)('Failed to retrieve weekly expense analytics', 500, res);
        }
    }
    static async getQuarterlyExpenseAnalytics(req, res) {
        try {
            const { tenantId, year } = req.query;
            if (!tenantId || !year) {
                return (0, helper_1.customError)('tenantId and year are required', 400, res);
            }
            const analytics = new ExpenseAnalyticsQueries_1.ExpenseAnalyticsQueries(parseInt(tenantId));
            const result = await analytics.getQuarterlyExpenseAnalytics(parseInt(year));
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Quarterly expense analytics retrieved successfully',
                data: result[0]
            });
        }
        catch (error) {
            console.error('Error in getQuarterlyExpenseAnalytics:', error);
            (0, helper_1.customError)('Failed to retrieve quarterly expense analytics', 500, res);
        }
    }
    static async getYearlyExpenseAnalytics(req, res) {
        try {
            const { tenantId, startYear, endYear } = req.query;
            if (!tenantId || !startYear || !endYear) {
                return (0, helper_1.customError)('tenantId, startYear, and endYear are required', 400, res);
            }
            const analytics = new ExpenseAnalyticsQueries_1.ExpenseAnalyticsQueries(parseInt(tenantId));
            const result = await analytics.getYearlyExpenseAnalytics(parseInt(startYear), parseInt(endYear));
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Yearly expense analytics retrieved successfully',
                data: result[0]
            });
        }
        catch (error) {
            console.error('Error in getYearlyExpenseAnalytics:', error);
            (0, helper_1.customError)('Failed to retrieve yearly expense analytics', 500, res);
        }
    }
    static async getExpenseAnalyticsByBranch(req, res) {
        try {
            const { tenantId, startDate, endDate } = req.query;
            if (!tenantId || !startDate || !endDate) {
                return (0, helper_1.customError)('tenantId, startDate, and endDate are required', 400, res);
            }
            const analytics = new ExpenseAnalyticsQueries_1.ExpenseAnalyticsQueries(parseInt(tenantId));
            const result = await analytics.getExpenseAnalyticsByBranch(startDate, endDate);
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Expense analytics by branch retrieved successfully',
                data: result[0]
            });
        }
        catch (error) {
            console.error('Error in getExpenseAnalyticsByBranch:', error);
            (0, helper_1.customError)('Failed to retrieve expense analytics by branch', 500, res);
        }
    }
    static async getTopExpenseCategories(req, res) {
        try {
            const { tenantId, startDate, endDate, branchid } = req.query;
            if (!tenantId || !startDate || !endDate) {
                return (0, helper_1.customError)('tenantId, startDate, and endDate are required', 400, res);
            }
            const analytics = new ExpenseAnalyticsQueries_1.ExpenseAnalyticsQueries(parseInt(tenantId));
            const result = await analytics.getTopExpenseCategories(startDate, endDate, branchid ? parseInt(branchid) : undefined);
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Top expense categories retrieved successfully',
                data: result[0]
            });
        }
        catch (error) {
            console.error('Error in getTopExpenseCategories:', error);
            (0, helper_1.customError)('Failed to retrieve top expense categories', 500, res);
        }
    }
    static async getExpensePaymentStatusAnalytics(req, res) {
        try {
            const { tenantId, startDate, endDate } = req.query;
            if (!tenantId || !startDate || !endDate) {
                return (0, helper_1.customError)('tenantId, startDate, and endDate are required', 400, res);
            }
            const analytics = new ExpenseAnalyticsQueries_1.ExpenseAnalyticsQueries(parseInt(tenantId));
            const result = await analytics.getExpensePaymentStatusAnalytics(startDate, endDate);
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Expense payment status analytics retrieved successfully',
                data: result[0]
            });
        }
        catch (error) {
            console.error('Error in getExpensePaymentStatusAnalytics:', error);
            (0, helper_1.customError)('Failed to retrieve expense payment status analytics', 500, res);
        }
    }
    static async getExpenseBuckets(req, res) {
        try {
            const { tenantId, startDate, endDate, branchid } = req.query;
            if (!tenantId || !startDate || !endDate) {
                return (0, helper_1.customError)('tenantId, startDate, and endDate are required', 400, res);
            }
            const analytics = new ExpenseAnalyticsQueries_1.ExpenseAnalyticsQueries(parseInt(tenantId));
            const result = await analytics.getExpenseBuckets(startDate, endDate, branchid ? parseInt(branchid) : undefined);
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Expense buckets analytics retrieved successfully',
                data: result[0]
            });
        }
        catch (error) {
            console.error('Error in getExpenseBuckets:', error);
            (0, helper_1.customError)('Failed to retrieve expense buckets analytics', 500, res);
        }
    }
    static async getExpenseGrowthRateAnalytics(req, res) {
        try {
            const { tenantId, year, branchid } = req.query;
            if (!tenantId || !year) {
                return (0, helper_1.customError)('tenantId and year are required', 400, res);
            }
            const analytics = new ExpenseAnalyticsQueries_1.ExpenseAnalyticsQueries(parseInt(tenantId));
            const result = await analytics.getExpenseGrowthRateAnalytics(parseInt(year), branchid ? parseInt(branchid) : undefined);
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Expense growth rate analytics retrieved successfully',
                data: result[0]
            });
        }
        catch (error) {
            console.error('Error in getExpenseGrowthRateAnalytics:', error);
            (0, helper_1.customError)('Failed to retrieve expense growth rate analytics', 500, res);
        }
    }
    static async getExpenseApprovalTimelineAnalytics(req, res) {
        try {
            const { tenantId, startDate, endDate, branchid } = req.query;
            if (!tenantId || !startDate || !endDate) {
                return (0, helper_1.customError)('tenantId, startDate, and endDate are required', 400, res);
            }
            const analytics = new ExpenseAnalyticsQueries_1.ExpenseAnalyticsQueries(parseInt(tenantId));
            const result = await analytics.getExpenseApprovalTimelineAnalytics(startDate, endDate, branchid ? parseInt(branchid) : undefined);
            res.status(200).json({
                status: 'success',
                statusCode: 200,
                message: 'Expense approval timeline analytics retrieved successfully',
                data: result[0]
            });
        }
        catch (error) {
            console.error('Error in getExpenseApprovalTimelineAnalytics:', error);
            (0, helper_1.customError)('Failed to retrieve expense approval timeline analytics', 500, res);
        }
    }
}
exports.ExpenseAnalyticsController = ExpenseAnalyticsController;
