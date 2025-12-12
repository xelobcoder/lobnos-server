"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TATAnalytics = void 0;
const helper_1 = require("../../hooks/helper");
const queries_1 = require("./queries");
class TATAnalytics {
    /**
     * Get TAT performance summary for OKRs
     * @param tenantId - Tenant ID
     * @param days - Number of days to analyze (default: 30)
     */
    async getTATPerformanceSummary(tenantId, days = 30) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_tat_okr_performance_summary, [days]);
    }
    /**
     * Get TAT performance by test type for OKRs
     * @param tenantId - Tenant ID
     * @param days - Number of days to analyze (default: 30)
     */
    async getTATByTestType(tenantId, days = 30) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_tat_okr_by_test_type, [days]);
    }
    /**
     * Get TAT trends over time for OKRs
     * @param tenantId - Tenant ID
     * @param days - Number of days to analyze (default: 30)
     */
    async getTATTrendsOverTime(tenantId, days = 30) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_tat_okr_trends_over_time, [days]);
    }
    /**
     * Get critical TAT violations for OKRs
     * @param tenantId - Tenant ID
     * @param days - Number of days to analyze (default: 30)
     * @param limit - Maximum number of violations to return (default: 50)
     */
    async getCriticalTATViolations(tenantId, days = 30, limit = 50) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_tat_okr_critical_violations, [days, limit]);
    }
    /**
     * Get TAT performance by hour of day for OKRs
     * @param tenantId - Tenant ID
     * @param days - Number of days to analyze (default: 30)
     */
    async getTATPerformanceByHour(tenantId, days = 30) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_tat_okr_performance_by_hour, [days]);
    }
    /**
     * Get TAT efficiency metrics for OKRs
     * @param tenantId - Tenant ID
     * @param days - Number of days to analyze (default: 30)
     */
    async getTATEfficiencyMetrics(tenantId, days = 30) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_tat_okr_efficiency_metrics, [days]);
    }
    /**
     * Get TAT OKR dashboard summary
     * @param tenantId - Tenant ID
     */
    async getTATDashboardSummary(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_tat_okr_dashboard_summary, []);
    }
}
exports.TATAnalytics = TATAnalytics;
