"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../../hooks/helper");
const clinicianClass_1 = __importDefault(require("../../clincians/clinicianClass"));
const clinicians_analtyics_qs_1 = require("./clinicians-analtyics-qs");
class ClinicianAnalytics {
    static async getClinicianCommission(tenantId, clinicianId, startDate, endDate) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_get_clinician_commission, [clinicianId, startDate, endDate]);
        return Array.isArray(result) && result.length > 0 ? result : {};
    }
    static async getClinicianCommissionByDate(tenantId, startDate, endDate) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_get_clinicians_commission_by_date, [startDate, endDate]);
        return Array.isArray(result) && result.length > 0 ? result : [];
    }
    static percentage_of_revenue_by_clinician(clinician_total_payable, total_payable) {
        if (!total_payable || total_payable === 0)
            return "0.00";
        return ((clinician_total_payable / total_payable) * 100).toFixed(2);
    }
    static async getClinicianInfo(tenantId, clinicianId) {
        return await new clinicianClass_1.default().getClinicianBasicInfo(tenantId, clinicianId);
    }
    static async getOverallTotal(tenantId, clinicianId) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_overallTotals, [clinicianId]);
    }
    static async getMonthlyTotals(tenantId, clinicianId, year) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_monthlyTotals, [clinicianId, year]);
    }
    static async getYearlyTotals(tenantId, clinicianId) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_yearlyTotals, [clinicianId]);
    }
    static async getCaseSummaryMonthly(tenantId, clinicianId, year) {
        const clinicianDetails = await this.getClinicianInfo(tenantId, clinicianId);
        const monthlyCaseSummary = await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_caseSummaryMonthly, [clinicianId, clinicianId, year]);
        return {
            clinicianDetails,
            monthlyCaseSummary: monthlyCaseSummary.map((item) => {
                return Object.assign(Object.assign({}, item), { percentage_revenue: this.percentage_of_revenue_by_clinician(Number(item.clinician_revenue_generated), Number(item.clinicians_revenue_generated)) });
            })
        };
    }
    static async getCaseSummaryYearly(tenantId, clinicianId) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_caseSummaryYearly, [clinicianId, clinicianId]);
    }
    static async getCaseSummaryDailyRecent(tenantId, clinicianId, year) {
        const clinicianDetails = await this.getClinicianInfo(tenantId, clinicianId);
        const dailyCaseSummary = await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_caseSummaryDailyRecent, [clinicianId, clinicianId, year]);
        return {
            clinicianDetails,
            dailyCaseSummary: dailyCaseSummary.map((item) => {
                return Object.assign(Object.assign({}, item), { percentage_revenue: this.percentage_of_revenue_by_clinician(Number(item.clinician_total_payable || item.clinician_revenue_generated), Number(item.total_payable || item.clinicians_revenue_generated)) });
            })
        };
    }
    static async getCaseSummaryDailyAll(tenantId, clinicianId) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_caseSummaryDailyAll, [clinicianId, clinicianId]);
    }
    static async getDailyCaseChange(tenantId, clinicianId, year) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_dailyCaseChange, [clinicianId, clinicianId, clinicianId, year]);
    }
    static async getMonthlyCaseChange(tenantId, clinicianId, year) {
        return await (0, helper_1.promisifyQuery)(tenantId, clinicians_analtyics_qs_1.q_can_monthlyCaseChange, [clinicianId, clinicianId, clinicianId, year]);
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
