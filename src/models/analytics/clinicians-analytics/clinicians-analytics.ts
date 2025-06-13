import { paginationQuery, promisifyQuery } from "../../../hooks/helper";
import {
     q_can_overallTotals,
     q_can_monthlyTotals,
     q_can_yearlyTotals,
     q_can_caseSummaryOverall,
     q_can_caseSummaryMonthly,
     q_can_caseSummaryYearly,
     q_can_caseSummaryDailyRecent,
     q_can_caseSummaryDailyAll,
     q_can_dailyCaseChange,
     q_can_monthlyCaseChange,
     q_can_yearlyCaseChange,
     q_can_yearlyCaseComparison,
     q_can_casesByDayOfWeek,
     q_can_clinicianRevenueVsTotal,
     q_can_paymentTypeSummary,
     q_can_casesByShift,
     q_can_casesByOutsourced,
     q_can_yearlyGrowthStats,
     q_can_monthlyTestBreakdown,
     q_can_topOutsourcedTests
} from "./clinicians-analtyics-qs";

class ClinicianAnalytics {
     public static async getOverallTotal(tenantId: number, clinicianId: number) {
          return await promisifyQuery(tenantId, q_can_overallTotals, [clinicianId]);
     }

     public static async getMonthlyTotals(tenantId: number, clinicianId: number, year: number) {
          return await promisifyQuery(tenantId, q_can_monthlyTotals, [clinicianId, year]);
     }

     public static async getYearlyTotals(tenantId: number, clinicianId: number) {
          return await promisifyQuery(tenantId, q_can_yearlyTotals, [clinicianId]);
     }

     public static async getCaseSummaryOverall(tenantId: number, clinicianId: number) {
          return await promisifyQuery(tenantId, q_can_caseSummaryOverall, [clinicianId, clinicianId]);
     }

     public static async getCaseSummaryMonthly(tenantId: number, clinicianId: number, year: number) {
          return await promisifyQuery(tenantId, q_can_caseSummaryMonthly, [clinicianId, clinicianId, year]);
     }

     public static async getCaseSummaryYearly(tenantId: number, clinicianId: number) {
          return await promisifyQuery(tenantId, q_can_caseSummaryYearly, [clinicianId, clinicianId]);
     }

     public static async getCaseSummaryDailyRecent(tenantId: number, clinicianId: number, year: number) {
          return await promisifyQuery(tenantId, q_can_caseSummaryDailyRecent, [clinicianId, clinicianId, year]);
     }

     public static async getCaseSummaryDailyAll(tenantId: number, clinicianId: number) {
          return await promisifyQuery(tenantId, q_can_caseSummaryDailyAll, [clinicianId, clinicianId]);
     }

     public static async getDailyCaseChange(tenantId: number, clinicianId: number, count: number, page: number) {
          return await paginationQuery({ count, page }, q_can_dailyCaseChange, [clinicianId], tenantId);
     }

     public static async getMonthlyCaseChange(tenantId: number, clinicianId: number) {
          return await promisifyQuery(tenantId, q_can_monthlyCaseChange, [clinicianId]);
     }

     public static async getYearlyCaseChange(tenantId: number, clinicianId: number) {
          return await promisifyQuery(tenantId, q_can_yearlyCaseChange, [clinicianId]);
     }

     public static async getYearlyCaseComparison(tenantId: number, clinicianId: number) {
          return await promisifyQuery(tenantId, q_can_yearlyCaseComparison, [clinicianId]);
     }

     public static async getCasesByDayOfWeek(tenantId: number, clinicianId: number) {
          return await promisifyQuery(tenantId, q_can_casesByDayOfWeek, [clinicianId]);
     }

     public static async getClinicianRevenueVsTotal(tenantId: number, clinicianId: number) {
          return await promisifyQuery(tenantId, q_can_clinicianRevenueVsTotal, [clinicianId]);
     }

     public static async getPaymentTypeSummary(tenantId: number, clinicianId: number) {
          return await promisifyQuery(tenantId, q_can_paymentTypeSummary, [clinicianId]);
     }

     public static async getCasesByShift(tenantId: number, clinicianId: number) {
          return await promisifyQuery(tenantId, q_can_casesByShift, [clinicianId]);
     }

     public static async getCasesByOutsourced(tenantId: number, clinicianId: number) {
          return await promisifyQuery(tenantId, q_can_casesByOutsourced, [clinicianId]);
     }

     public static async getYearlyGrowthStats(tenantId: number, clinicianId: number) {
          return await promisifyQuery(tenantId, q_can_yearlyGrowthStats, [clinicianId]);
     }

     public static async getMonthlyTestBreakdown(tenantId: number, clinicianId: number) {
          return await promisifyQuery(tenantId, q_can_monthlyTestBreakdown, [clinicianId]);
     }

     public static async getTopOutsourcedTests(tenantId: number, clinicianId: number) {
          return await promisifyQuery(tenantId, q_can_topOutsourcedTests, [clinicianId]);
     }
}

export default ClinicianAnalytics;