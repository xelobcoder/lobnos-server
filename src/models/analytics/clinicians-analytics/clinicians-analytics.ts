
import { paginationQuery, promisifyQuery } from "../../../hooks/helper";
import ClinicianClass from "../../clincians/clinicianClass";
import {
     q_can_overallTotals,
     q_can_monthlyTotals,
     q_can_yearlyTotals,
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
     q_can_topOutsourcedTests,
     q_get_clinician_commission,
     q_get_clinicians_commission_by_date
} from "./clinicians-analtyics-qs";


type monthly_case_summary_rate = {
     period: string;
     total_clinician_cases: number;
     clinicians_total_cases: number;
     earned_revenue: string;
     clinician_earned_revenue: string;
}

class ClinicianAnalytics {
     public static async getClinicianCommission(tenantId: number, clinicianId: number, startDate: string, endDate: string) {
          const result = await promisifyQuery(tenantId, q_get_clinician_commission, [clinicianId, startDate, endDate]);
          return Array.isArray(result) ? result : [];
     }

     public static async getClinicianCommissionByDate(tenantId: number, {startDate, endDate, page, count, sortby}: {startDate: string, endDate: string, page: number, sortby:'ASC' | 'DESC', count: number}) {
          const result = await paginationQuery({count,page}, q_get_clinicians_commission_by_date, [startDate, endDate, sortby],tenantId);
          return Array.isArray(result) && result.length > 0 ? result : [];
     }

     private static percentage_of_revenue_by_clinician(clinician_total_payable: number, total_payable: number) {
          if (!total_payable || total_payable === 0) return "0.00";
          return ((clinician_total_payable / total_payable) * 100).toFixed(2);
     }

     private static async getClinicianInfo(tenantId: number, clinicianId: number) {
          return await new ClinicianClass().getClinicianBasicInfo(tenantId, clinicianId);
     }

     public static async getOverallTotal(tenantId: number, clinicianId: number) {
          return await promisifyQuery(tenantId, q_can_overallTotals, [clinicianId]);
     }

     public static async getMonthlyTotals(tenantId: number, clinicianId: number, year: number) {
          return await promisifyQuery(tenantId, q_can_monthlyTotals, [clinicianId, year]);
     }

     public static async getYearlyTotals(tenantId: number, clinicianId: number) {
          return await promisifyQuery(tenantId, q_can_yearlyTotals, [clinicianId]);
     }



     public static async getCaseSummaryMonthly(tenantId: number, clinicianId: number, year: number) {


          const clinicianDetails = await this.getClinicianInfo(tenantId, clinicianId);
          const monthlyCaseSummary = await promisifyQuery(tenantId, q_can_caseSummaryMonthly, [clinicianId, clinicianId, year]);
          return {
               clinicianDetails,
               monthlyCaseSummary: monthlyCaseSummary.map((item: monthly_case_summary_rate) => {
                    return {
                         ...item,
                         percentage_revenue: this.percentage_of_revenue_by_clinician(
                              Number(item.clinician_earned_revenue),
                              Number(item.earned_revenue)
                         )
                    };
               })
          }
     }

     public static async getCaseSummaryYearly(tenantId: number, clinicianId: number) {
          return await promisifyQuery(tenantId, q_can_caseSummaryYearly, [clinicianId,clinicianId, clinicianId,clinicianId,clinicianId,clinicianId]);
     }

     public static async getCaseSummaryDailyRecent(tenantId: number, clinicianId: number, year: number) {
          const clinicianDetails = await this.getClinicianInfo(tenantId, clinicianId);
          const dailyCaseSummary = await promisifyQuery(tenantId, q_can_caseSummaryDailyRecent, [clinicianId, clinicianId, year]);
          return {
               clinicianDetails,
               dailyCaseSummary: dailyCaseSummary.map((item: any) => {
                    return {
                         ...item,
                         percentage_revenue: this.percentage_of_revenue_by_clinician(
                              Number(item.clinician_total_payable || item.clinician_revenue_generated),
                              Number(item.total_payable || item.clinicians_revenue_generated)
                         )
                    };
               })
          }
     }

     public static async getCaseSummaryDailyAll(tenantId: number, clinicianId: number) {
          return await promisifyQuery(tenantId, q_can_caseSummaryDailyAll, [clinicianId, clinicianId]);
     }

     public static async getDailyCaseChange(tenantId: number, clinicianId: number,year:number) {
          return await promisifyQuery(tenantId, q_can_dailyCaseChange, [clinicianId, clinicianId, clinicianId,year]);
     }

     public static async getMonthlyCaseChange(tenantId: number, clinicianId: number,year:number) {
          return await promisifyQuery(tenantId, q_can_monthlyCaseChange, [clinicianId, clinicianId, clinicianId, year]);
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
