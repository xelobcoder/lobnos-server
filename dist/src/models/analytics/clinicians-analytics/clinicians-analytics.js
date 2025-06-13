"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../../hooks/helper");
const clinicians_analtyics_qs_1 = require("./clinicians-analtyics-qs");
class ClinicianAnalytics {
    static async getOverallTotal(tenantId, clinicianId) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_overallTotals, [clinicianId]);
    }
    static async getMonthlyTotals(tenantId, clinicianId, year) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_monthlyTotals, [clinicianId, year]);
    }
    static async getYearlyTotals(tenantId, clinicianId) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_yearlyTotals, [clinicianId]);
    }
    static async getCaseSummaryOverall(tenantId, clinicianId) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_caseSummaryOverall, [clinicianId, clinicianId]);
    }
    static async getCaseSummaryMonthly(tenantId, clinicianId, year) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_caseSummaryMonthly, [clinicianId, clinicianId, year]);
    }
    static async getCaseSummaryYearly(tenantId, clinicianId) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_caseSummaryYearly, [clinicianId, clinicianId]);
    }
    static async getCaseSummaryDailyRecent(tenantId, clinicianId, year) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_caseSummaryDailyRecent, [clinicianId, clinicianId, year]);
    }
    static async getCaseSummaryDailyAll(tenantId, clinicianId) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_caseSummaryDailyAll, [clinicianId, clinicianId]);
    }
    static async getDailyCaseChange(tenantId, clinicianId, count, page) {
        return await (0, helper_1.paginationQuery)({ count, page }, clinicians_analtyics_qs_1.q_can_dailyCaseChange, [clinicianId], tenantId);
    }
    static async getMonthlyCaseChange(tenantId, clinicianId) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_monthlyCaseChange, [clinicianId]);
    }
    static async getYearlyCaseChange(tenantId, clinicianId) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_yearlyCaseChange, [clinicianId]);
    }
    static async getYearlyCaseComparison(tenantId, clinicianId) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_yearlyCaseComparison, [clinicianId]);
    }
    static async getCasesByDayOfWeek(tenantId, clinicianId) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_casesByDayOfWeek, [clinicianId]);
    }
    static async getClinicianRevenueVsTotal(tenantId, clinicianId) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_clinicianRevenueVsTotal, [clinicianId]);
    }
    static async getPaymentTypeSummary(tenantId, clinicianId) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_paymentTypeSummary, [clinicianId]);
    }
    static async getCasesByShift(tenantId, clinicianId) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_casesByShift, [clinicianId]);
    }
    static async getCasesByOutsourced(tenantId, clinicianId) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_casesByOutsourced, [clinicianId]);
    }
    static async getYearlyGrowthStats(tenantId, clinicianId) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_yearlyGrowthStats, [clinicianId]);
    }
    static async getMonthlyTestBreakdown(tenantId, clinicianId) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_monthlyTestBreakdown, [clinicianId]);
    }
    static async getTopOutsourcedTests(tenantId, clinicianId) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_topOutsourcedTests, [clinicianId]);
    }
}
exports.default = ClinicianAnalytics;
