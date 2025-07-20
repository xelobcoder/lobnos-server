"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDailyAnalyticsDashboard = void 0;
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
const queries_1 = require("./queries");
async function getDailyAnalyticsDashboard(tenantId, targetDate, fromDate = targetDate, toDate = targetDate) {
    if (!fromDate || !toDate || new Date(fromDate) > new Date(toDate))
        return "Invalid date range provided." /* OperationsFailures.invalidDateRange */;
    const db = await (0, KnexConnections_1.default)(tenantId);
    const [dailyCeoSnapshot, serviceStatusCounts, OrganizationCommissions, dailyUniqueClientsSummary, dailyNightAdjustmentImpact, dailyTestTransactionSnapshot, topPerformingBranches, mismatchedPaymentHistory, breakDownPaymentModes, employeesWhoCollectedCash, cliniciansalesdailyData] = await Promise.all([
        db.raw(queries_1.QUERY_DAILY_CEO_SNAPSHOT, [fromDate, toDate]),
        db.raw(queries_1.ss_service_status_counts, [fromDate, toDate]),
        db.raw(queries_1.ORGANIZATIONCOMMISSIONS, [fromDate, toDate]),
        db.raw(queries_1.query_daily_unique_clients_summary, [fromDate, toDate]),
        db.raw(queries_1.QUERY_NIGHT_ADJUSTMENT_IMPACT, [fromDate, toDate]),
        db.raw(queries_1.QUERY_TEST_TRANSACTION_SNAPSHOT, [fromDate, toDate]),
        db.raw(queries_1.QUERY_TOP_PERFORMING_BRANCHES, [fromDate, toDate]),
        db.raw(queries_1.QUERY_MISMATCHED_PAYMENT_HISTORY, [fromDate, toDate]),
        db.raw(queries_1.QUERY_BREAK_DOWN_PAYMENT_MODES, [fromDate, toDate]),
        db.raw(queries_1.QUERY_EMPLOYEES_COLLECTED_CASH, [fromDate, toDate]),
        db.raw(queries_1.CLINCIAN_SALES_PAYMENT, [fromDate, toDate])
    ]);
    return {
        dailyCeoSnapshot: dailyCeoSnapshot[0][0],
        serviceStatusCounts: serviceStatusCounts[0][0],
        OrganizationCommissions: OrganizationCommissions[0][0],
        dailyUniqueClientsSummary: dailyUniqueClientsSummary[0][0],
        dailyNightAdjustmentImpact: dailyNightAdjustmentImpact[0][0],
        dailyTestTransactionSnapshot: dailyTestTransactionSnapshot[0][0],
        topPerformingBranches: topPerformingBranches[0][0],
        mismatchedPaymentHistory: mismatchedPaymentHistory[0][0],
        breakDownPaymentModes: breakDownPaymentModes[0][0],
        employeesWhoCollectedCash: employeesWhoCollectedCash[0][0],
        cliniciansalesdailyData: cliniciansalesdailyData[0][0]
    };
}
exports.getDailyAnalyticsDashboard = getDailyAnalyticsDashboard;
