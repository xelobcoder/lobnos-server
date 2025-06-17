"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const expenses_analytics_1 = __importDefault(require("./expenses-analytics"));
const router = (0, express_1.Router)();
const controller = new expenses_analytics_1.default();
router.get('/api/v1/expenses-analytics/branch-monthly-expenses', controller.getBranchMonthlyExpensesHandler);
router.get('/api/v1/expenses-analytics/employee-category-expenses', controller.getEmployeeCategoryExpensesHandler);
router.get('/api/v1/expenses-analytics/approval-status-by-branch', controller.getApprovalStatusByBranchExpensesHandler);
router.get('/api/v1/expenses-analytics/service-linked-expenses', controller.getServiceLinkedExpensesHandler);
router.get('/api/v1/expenses-analytics/expense-details', controller.getExpenseDetailsExpensesHandler);
router.get('/api/v1/expenses-analytics/monthly-expense-summary', controller.getMonthlyExpenseSummaryExpensesHandler);
router.get('/api/v1/expenses-analytics/total-expenses-by-category', controller.getTotalExpensesByCategoryHandler);
router.get('/api/v1/expenses-analytics/daily-expense-summary', controller.getDailyExpenseSummaryExpensesHandler);
router.get('/api/v1/expenses-analytics/weekly-expense-summary', controller.getWeeklyExpenseSummaryExpensesHandler);
router.get('/api/v1/expenses-analytics/yearly-expense-summary', controller.getYearlyExpenseSummaryExpensesHandler);
router.get('/api/v1/expenses-analytics/hourly-expense-summary', controller.getHourlyExpenseSummaryForDateExpensesHandler);
router.get('/api/v1/expenses-analytics/top-expense-categories', controller.getTopExpenseCategoriesExpensesHandler);
router.get('/api/v1/expenses-analytics/employee-top-expenses', controller.getEmployeeTopExpensesHandler);
router.get('/api/v1/expenses-analytics/expense-trend-by-category', controller.getExpenseTrendByCategoryExpensesHandler);
router.get('/api/v1/expenses-analytics/pending-expenses-list', controller.getPendingExpensesListHandler);
router.get('/api/v1/expenses-analytics/expense-count-by-status', controller.getExpenseCountByStatusExpensesHandler);
router.get('/api/v1/expenses-analytics/routes', (req, res) => {
    const routes = [
        { endpoint: '/api/v1/expenses-analytics/branch-monthly-expenses', description: 'Get branch monthly expenses.' },
        { endpoint: '/api/v1/expenses-analytics/employee-category-expenses', description: 'Get employee category expenses.' },
        { endpoint: '/api/v1/expenses-analytics/approval-status-by-branch', description: 'Get approval status by branch.' },
        { endpoint: '/api/v1/expenses-analytics/service-linked-expenses', description: 'Get service linked expenses.' },
        { endpoint: '/api/v1/expenses-analytics/expense-details', description: 'Get expense details.' },
        { endpoint: '/api/v1/expenses-analytics/monthly-expense-summary', description: 'Get monthly expense summary.' },
        { endpoint: '/api/v1/expenses-analytics/total-expenses-by-category', description: 'Get total expenses by category.' },
        { endpoint: '/api/v1/expenses-analytics/daily-expense-summary', description: 'Get daily expense summary.' },
        { endpoint: '/api/v1/expenses-analytics/weekly-expense-summary', description: 'Get weekly expense summary.' },
        { endpoint: '/api/v1/expenses-analytics/yearly-expense-summary', description: 'Get yearly expense summary.' },
        { endpoint: '/api/v1/expenses-analytics/hourly-expense-summary', description: 'Get hourly expense summary for a date.' },
        { endpoint: '/api/v1/expenses-analytics/top-expense-categories', description: 'Get top expense categories.' },
        { endpoint: '/api/v1/expenses-analytics/employee-top-expenses', description: 'Get employee top expenses.' },
        { endpoint: '/api/v1/expenses-analytics/expense-trend-by-category', description: 'Get expense trend by category.' },
        { endpoint: '/api/v1/expenses-analytics/pending-expenses-list', description: 'Get pending expenses list.' },
        { endpoint: '/api/v1/expenses-analytics/expense-count-by-status', description: 'Get expense count by status.' },
    ];
    res.status(200).json(routes);
});
exports.default = router;
