"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDailyAnalyticsDashboard = getDailyAnalyticsDashboard;
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
const queries_1 = require("./queries");
async function getDailyAnalyticsDashboard(tenantId, targetDate, fromDate = targetDate, toDate = targetDate) {
    try {
        console.log({ fromDate, toDate });
        if (!fromDate || !toDate || !(new Date(fromDate) <= new Date(toDate)))
            return "Invalid date range provided." /* OperationsFailures.invalidDateRange */;
        const db = await (0, KnexConnections_1.default)(tenantId);
        const [dailyCeoSnapshot, dailyNightAdjustmentImpact, dailyTestTransactionSnapshot, topPerformingBranches, mismatchedPaymentHistory, breakDownPaymentModes, employeesWhoCollectedCash, cliniciansalesdailyData, totalExpensesPeriodComparison, allExpenseCategories, expenseApprovalStatusSummary, expensePaymentsSummary, expensePaymentsFullList, billableExpenses, monthlyExpenseTrend, allIndividualExpenses, unapprovedExpensesPeriod, expensesByBranch, ceoExpenseSummarySnapshot, reversedPaymentsList, dailySalesBySectionGrouped, ultrasoundDetailedSummary] = await Promise.all([
            db.raw(queries_1.QUERY_DAILY_CEO_SNAPSHOT, [fromDate, toDate, fromDate, toDate, fromDate, toDate]),
            db.raw(queries_1.QUERY_NIGHT_ADJUSTMENT_IMPACT, [fromDate, toDate]),
            db.raw(queries_1.QUERY_TEST_TRANSACTION_SNAPSHOT, [fromDate, toDate]),
            db.raw(queries_1.QUERY_TOP_PERFORMING_BRANCHES, [fromDate, toDate]),
            db.raw(queries_1.QUERY_MISMATCHED_PAYMENT_HISTORY, [fromDate, toDate]),
            db.raw(queries_1.QUERY_BREAK_DOWN_PAYMENT_MODES, [fromDate, toDate]),
            db.raw(queries_1.QUERY_EMPLOYEES_COLLECTED_CASH, [fromDate, toDate]),
            db.raw(queries_1.CLINCIAN_SALES_PAYMENT, [fromDate, toDate]),
            db.raw(queries_1.QUERY_TOTAL_EXPENSES_PERIOD_COMPARISON, [fromDate, toDate, fromDate, toDate, fromDate, fromDate]),
            db.raw(queries_1.QUERY_ALL_EXPENSE_CATEGORIES, [fromDate, toDate, fromDate, toDate]),
            db.raw(queries_1.QUERY_EXPENSE_APPROVAL_STATUS_SUMMARY, [fromDate, toDate]),
            db.raw(queries_1.QUERY_EXPENSE_PAYMENTS_SUMMARY, [fromDate, toDate]),
            db.raw(queries_1.QUERY_EXPENSE_PAYMENTS_FULL_LIST, [fromDate, toDate]),
            db.raw(queries_1.QUERY_BILLABLE_EXPENSES, [fromDate, toDate]),
            db.raw(queries_1.QUERY_MONTHLY_EXPENSE_TREND, [fromDate, toDate]),
            db.raw(queries_1.QUERY_ALL_INDIVIDUAL_EXPENSES, [fromDate, toDate]),
            db.raw(queries_1.QUERY_UNAPPROVED_EXPENSES_PERIOD, [toDate, fromDate, toDate]),
            db.raw(queries_1.QUERY_EXPENSES_BY_BRANCH, [fromDate, toDate, fromDate, toDate]),
            db.raw(queries_1.QUERY_CEO_EXPENSE_SUMMARY_SNAPSHOT, [fromDate, toDate, fromDate, toDate, fromDate, toDate, fromDate, toDate, fromDate, toDate, fromDate, toDate, fromDate, toDate]),
            db.raw(queries_1.QUERY_REVERSED_EXPENSE_PAYMENTS_LIST, [fromDate, toDate]),
            db.raw(queries_1.QUERY_DAILY_SALES_SUMMARY_BY_SECTION, [fromDate, toDate]),
            db.raw(queries_1.QUERY_ULTRASOUND_DETAILED_SUMMARY, [fromDate, toDate])
        ]);
        return {
            dailyCeoSnapshot: dailyCeoSnapshot[0],
            dailyNightAdjustmentImpact: dailyNightAdjustmentImpact[0],
            dailyTestTransactionSnapshot: dailyTestTransactionSnapshot[0],
            topPerformingBranches: topPerformingBranches[0],
            mismatchedPaymentHistory: mismatchedPaymentHistory[0],
            breakDownPaymentModes: breakDownPaymentModes[0],
            employeesWhoCollectedCash: employeesWhoCollectedCash[0],
            cliniciansalesdailyData: cliniciansalesdailyData[0],
            totalExpensesPeriodComparison: totalExpensesPeriodComparison[0],
            allExpenseCategories: allExpenseCategories[0],
            expenseApprovalStatusSummary: expenseApprovalStatusSummary[0],
            expensePaymentsSummary: expensePaymentsSummary[0],
            expensePaymentsFullList: expensePaymentsFullList[0],
            billableExpenses: billableExpenses[0],
            monthlyExpenseTrend: monthlyExpenseTrend[0],
            allIndividualExpenses: allIndividualExpenses[0],
            unapprovedExpensesPeriod: unapprovedExpensesPeriod[0],
            expensesByBranch: expensesByBranch[0],
            ceoExpenseSummarySnapshot: ceoExpenseSummarySnapshot[0],
            reversedPaymentsList: reversedPaymentsList[0],
            dailySalesBySectionGrouped: dailySalesBySectionGrouped[0],
            ultrasoundDetailedSummary: ultrasoundDetailedSummary[0]
        };
    }
    catch (error) {
        console.error('Error in getDailyAnalyticsDashboard:', error);
        return { message: "Database query failed", statusCode: 500, status: "error" };
    }
}
