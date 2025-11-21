"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const expenses_analytics_1 = __importDefault(require("./expenses-analytics"));
const router = (0, express_1.Router)();
const controller = new expenses_analytics_1.default();
// Daily Analytics
router.get('/api/v1/expenses-analytics/daily', controller.getDailyExpenseAnalyticsHandler);
// Hourly Analytics
router.get('/api/v1/expenses-analytics/hourly', controller.getHourlyExpenseAnalyticsHandler);
// Weekly Analytics
router.get('/api/v1/expenses-analytics/weekly', controller.getWeeklyExpenseAnalyticsHandler);
// Monthly Analytics
router.get('/api/v1/expenses-analytics/monthly', controller.getMonthlyExpenseAnalyticsHandler);
// Quarterly Analytics
router.get('/api/v1/expenses-analytics/quarterly', controller.getQuarterlyExpenseAnalyticsHandler);
// Yearly Analytics
router.get('/api/v1/expenses-analytics/yearly', controller.getYearlyExpenseAnalyticsHandler);
// Top Analytics
router.get('/api/v1/expenses-analytics/top-categories', controller.getTopExpenseCategoriesHandler);
router.get('/api/v1/expenses-analytics/top-merchants', controller.getTopExpenseMerchantsHandler);
router.get('/api/v1/expenses-analytics/top-employees', controller.getTopExpenseEmployeesHandler);
// Trends and Comparisons
router.get('/api/v1/expenses-analytics/trends-by-category', controller.getExpenseTrendsByCategoryHandler);
router.get('/api/v1/expenses-analytics/comparison-by-period', controller.getExpenseComparisonByPeriodHandler);
// API Documentation
router.get('/api/v1/expenses-analytics/routes', (req, res) => {
    const routes = [
        { endpoint: '/api/v1/expenses-analytics/daily', description: 'Get daily expense analytics within date range', params: 'startDate, endDate' },
        { endpoint: '/api/v1/expenses-analytics/hourly', description: 'Get hourly expense analytics for a specific date', params: 'targetDate (required)' },
        { endpoint: '/api/v1/expenses-analytics/weekly', description: 'Get weekly expense analytics within date range', params: 'startDate, endDate' },
        { endpoint: '/api/v1/expenses-analytics/monthly', description: 'Get monthly expense analytics within date range', params: 'startDate, endDate' },
        { endpoint: '/api/v1/expenses-analytics/quarterly', description: 'Get quarterly expense analytics within date range', params: 'startDate, endDate' },
        { endpoint: '/api/v1/expenses-analytics/yearly', description: 'Get yearly expense analytics', params: 'startYear, endYear (optional)' },
        { endpoint: '/api/v1/expenses-analytics/top-categories', description: 'Get top expense categories by total amount', params: 'limitCount (optional, default: 10)' },
        { endpoint: '/api/v1/expenses-analytics/top-merchants', description: 'Get top expense merchants by total amount', params: 'limitCount (optional, default: 10)' },
        { endpoint: '/api/v1/expenses-analytics/top-employees', description: 'Get top expense employees by total amount', params: 'limitCount (optional, default: 10)' },
        { endpoint: '/api/v1/expenses-analytics/trends-by-category', description: 'Get expense trends by category over time', params: 'categoryId (optional)' },
        { endpoint: '/api/v1/expenses-analytics/comparison-by-period', description: 'Compare expenses between two periods', params: 'currentStartDate, currentEndDate, previousStartDate, previousEndDate (all required)' },
    ];
    res.status(200).json({
        message: "Expense Analytics API Endpoints",
        commonParams: "branchid (required), startDate (required for time-based analytics), endDate (required for time-based analytics)",
        routes: routes
    });
});
exports.default = router;
