import { Request, Response } from 'express';
import ClinicianAnalytics from '../../../models/analytics/clinicians-analytics/clinicians-analytics';

interface BaseAnalyticsRequest extends Request {
     params: {
          clinicianId: string;
     };
     query: {
          year?: string;
          count?: string;
          page?: string
          tenantId: string
     };
}

interface DashboardResponse {
     overallTotals: any;
     monthlyTotals: any;
     yearlyTotals: any;
     caseSummary: {
          overall: any;
          monthly: any;
          yearly: any;
          dailyRecent: any;
     };
     caseChanges: {
          daily: any;
          monthly: any;
          yearly: any;
     };
     revenue: {
          comparison: any;
          paymentTypes: any;
     };
     distributions: {
          shift: any;
          outsourced: any;
     };
     tests: {
          monthlyBreakdown: any;
          topOutsourced: any;
     };
     growth: any;
}

interface ApiEndpoint {
     label: string;
     endpoint: string;
     description: string;
     parameters: {
          required: string[];
          optional?: string[];
     };
}

const analyticsEndpoints: ApiEndpoint[] = [
     {
          label: "Overall Totals",
          endpoint: "/api/v1/clinician/anal/overall/:clinicianId",
          description: "Get overall totals for clinician analytics",
          parameters: {
               required: ["clinicianId"]
          }
     },
     {
          label: "Monthly Analytics",
          endpoint: "/api/v1/clinician/anal/monthly/:clinicianId",
          description: "Get monthly analytics breakdown",
          parameters: {
               required: ["clinicianId"],
               optional: ["year"]
          }
     },
     {
          label: "Yearly Analytics",
          endpoint: "/api/v1/clinician/anal/yearly/:clinicianId",
          description: "Get yearly analytics summary",
          parameters: {
               required: ["clinicianId"]
          }
     },
     {
          label: "Case Summary - Overall",
          endpoint: "/api/v1/clinician/anal/case-summary/overall/:clinicianId",
          description: "Get overall case summary statistics",
          parameters: {
               required: ["clinicianId"]
          }
     },
     {
          label: "Case Summary - Monthly",
          endpoint: "/api/v1/clinician/anal/case-summary/monthly/:clinicianId",
          description: "Get monthly case summary breakdown",
          parameters: {
               required: ["clinicianId"],
               optional: ["year"]
          }
     },
     {
          label: "Case Summary - Yearly",
          endpoint: "/api/v1/clinician/anal/case-summary/yearly/:clinicianId",
          description: "Get yearly case summary",
          parameters: {
               required: ["clinicianId"]
          }
     },
     {
          label: "Daily Recent Cases",
          endpoint: "/api/v1/clinician/anal/case-summary/daily/:clinicianId",
          description: "Get recent daily case summary",
          parameters: {
               required: ["clinicianId"]
          }
     },
     {
          label: "Daily Case Changes",
          endpoint: "/api/v1/clinician/anal/case-change/daily/:clinicianId",
          description: "Get daily case change analysis",
          parameters: {
               required: ["clinicianId"]
          }
     },
     {
          label: "Monthly Case Changes",
          endpoint: "/api/v1/clinician/anal/case-change/monthly/:clinicianId",
          description: "Get monthly case change trends",
          parameters: {
               required: ["clinicianId"]
          }
     },
     {
          label: "Yearly Case Changes",
          endpoint: "/api/v1/clinician/anal/case-change/yearly/:clinicianId",
          description: "Get yearly case change analysis",
          parameters: {
               required: ["clinicianId"]
          }
     },
     {
          label: "Revenue Comparison",
          endpoint: "/api/v1/clinician/anal/revenue/:clinicianId",
          description: "Compare clinician revenue against total",
          parameters: {
               required: ["clinicianId"]
          }
     },
     {
          label: "Payment Type Summary",
          endpoint: "/api/v1/clinician/anal/payment-summary/:clinicianId",
          description: "Get summary of payment types",
          parameters: {
               required: ["clinicianId"]
          }
     },
     {
          label: "Shift Distribution",
          endpoint: "/api/v1/clinician/anal/shift-distribution/:clinicianId",
          description: "Analyze case distribution across shifts",
          parameters: {
               required: ["clinicianId"]
          }
     },
     {
          label: "Outsourced Cases",
          endpoint: "/api/v1/clinician/anal/outsourced/:clinicianId",
          description: "Get outsourced cases analysis",
          parameters: {
               required: ["clinicianId"]
          }
     },
     {
          label: "Growth Statistics",
          endpoint: "/api/v1/clinician/anal/growth/:clinicianId",
          description: "Get yearly growth statistics",
          parameters: {
               required: ["clinicianId"]
          }
     },
     {
          label: "Test Breakdown",
          endpoint: "/api/v1/clinician/anal/test-breakdown/:clinicianId",
          description: "Get monthly test type breakdown",
          parameters: {
               required: ["clinicianId"]
          }
     },
     {
          label: "Top Outsourced Tests",
          endpoint: "/api/v1/clinician/anal/top-outsourced/:clinicianId",
          description: "Get most frequently outsourced tests",
          parameters: {
               required: ["clinicianId"]
          }
     },
     {
          label: "Complete Dashboard",
          endpoint: "/api/v1/clinician/anal/dashboard/:clinicianId",
          description: "Get all analytics data in one request",
          parameters: {
               required: ["clinicianId"],
               optional: ["year"]
          }
     }
];

export default class ClinicianAnalyticsHandlers {

     private validateClinicianId(clinicianId: string): number {
          const id = parseInt(clinicianId);
          if (isNaN(id) || id <= 0) {
               throw new Error('Invalid clinician ID');
          }
          return id;
     }

     private validateYear(year?: string): number {
          if (!year) {
               return new Date().getFullYear();
          }
          const parsedYear = parseInt(year);
          if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > new Date().getFullYear()) {
               throw new Error('Invalid year');
          }
          return parsedYear;
     }

     private async handleRequest(res: Response, action: () => Promise<any>) {
          try {
               const result = await action();
               return res.status(200).json({
                    success: true,
                    data: result
               });
          } catch (error: any) {
               return res.status(400).json({
                    success: false,
                    error: error.message
               });
          }
     }

     public async getOverallTotal(req: BaseAnalyticsRequest, res: Response) {
          const { tenantId } = req.query
          return this.handleRequest(res, async () => {
               const clinicianId = this.validateClinicianId(req.params.clinicianId);
               return await ClinicianAnalytics.getOverallTotal(parseInt(tenantId), clinicianId);
          });
     }

     public async getMonthlyTotals(req: BaseAnalyticsRequest, res: Response) {
          const { tenantId } = req.query
          return this.handleRequest(res, async () => {
               const clinicianId = this.validateClinicianId(req.params.clinicianId);
               const year = this.validateYear(req.query.year);
               return await ClinicianAnalytics.getMonthlyTotals(parseInt(tenantId), clinicianId, year);
          });
     }

     public async getYearlyTotals(req: BaseAnalyticsRequest, res: Response) {
          const { tenantId } = req.query
          return this.handleRequest(res, async () => {
               const clinicianId = this.validateClinicianId(req.params.clinicianId);
               return await ClinicianAnalytics.getYearlyTotals(parseInt(tenantId), clinicianId);
          });
     }

     public async getCaseSummaryOverall(req: BaseAnalyticsRequest, res: Response) {
          const { tenantId } = req.query
          return this.handleRequest(res, async () => {
               const clinicianId = this.validateClinicianId(req.params.clinicianId);
               return await ClinicianAnalytics.getCaseSummaryOverall(parseInt(tenantId), clinicianId);
          });
     }

     public async getCaseSummaryMonthly(req: BaseAnalyticsRequest, res: Response) {
          const { tenantId } = req.query
          return this.handleRequest(res, async () => {
               const clinicianId = this.validateClinicianId(req.params.clinicianId);
               const year = this.validateYear(req.query.year);
               return await ClinicianAnalytics.getCaseSummaryMonthly(parseInt(tenantId), clinicianId, year);
          });
     }

     public async getCaseSummaryYearly(req: BaseAnalyticsRequest, res: Response) {
          const { tenantId } = req.query
          return this.handleRequest(res, async () => {
               const clinicianId = this.validateClinicianId(req.params.clinicianId);
               return await ClinicianAnalytics.getCaseSummaryYearly(parseInt(tenantId), clinicianId);
          });
     }

     public async getCaseSummaryDailyRecent(req: BaseAnalyticsRequest, res: Response) {
          const { tenantId } = req.query
          return this.handleRequest(res, async () => {
               const clinicianId = this.validateClinicianId(req.params.clinicianId);
               const year = this.validateYear(req.query.year);
               return await ClinicianAnalytics.getCaseSummaryDailyRecent(parseInt(tenantId), clinicianId, year);
          });
     }

     public async getDailyCaseChange(req: BaseAnalyticsRequest, res: Response) {
          const { tenantId } = req.query
          return this.handleRequest(res, async () => {
               const clinicianId = this.validateClinicianId(req.params.clinicianId);
               const page = parseInt(req.query.page) || 1
               const count = parseInt(req.query.count) || 10
               return await ClinicianAnalytics.getDailyCaseChange(parseInt(tenantId), clinicianId, count, page);
          });
     }

     public async getMonthlyCaseChange(req: BaseAnalyticsRequest, res: Response) {
          const { tenantId } = req.query
          return this.handleRequest(res, async () => {
               const clinicianId = this.validateClinicianId(req.params.clinicianId);
               return await ClinicianAnalytics.getMonthlyCaseChange(parseInt(tenantId), clinicianId);
          });
     }

     public async getYearlyCaseChange(req: BaseAnalyticsRequest, res: Response) {
          const { tenantId } = req.query
          return this.handleRequest(res, async () => {
               const clinicianId = this.validateClinicianId(req.params.clinicianId);
               return await ClinicianAnalytics.getYearlyCaseChange(parseInt(tenantId), clinicianId);
          });
     }

     public async getClinicianRevenueVsTotal(req: BaseAnalyticsRequest, res: Response) {
          const { tenantId } = req.query
          return this.handleRequest(res, async () => {
               const clinicianId = this.validateClinicianId(req.params.clinicianId);
               return await ClinicianAnalytics.getClinicianRevenueVsTotal(parseInt(tenantId), clinicianId);
          });
     }

     public async getPaymentTypeSummary(req: BaseAnalyticsRequest, res: Response) {
          const { tenantId } = req.query
          return this.handleRequest(res, async () => {
               const clinicianId = this.validateClinicianId(req.params.clinicianId);
               return await ClinicianAnalytics.getPaymentTypeSummary(parseInt(tenantId), clinicianId);
          });
     }

     public async getCasesByShift(req: BaseAnalyticsRequest, res: Response) {
          const { tenantId } = req.query
          return this.handleRequest(res, async () => {
               const clinicianId = this.validateClinicianId(req.params.clinicianId);
               return await ClinicianAnalytics.getCasesByShift(parseInt(tenantId), clinicianId);
          });
     }

     public async getCasesByOutsourced(req: BaseAnalyticsRequest, res: Response) {
          const { tenantId } = req.query
          return this.handleRequest(res, async () => {
               const clinicianId = this.validateClinicianId(req.params.clinicianId);
               return await ClinicianAnalytics.getCasesByOutsourced(parseInt(tenantId), clinicianId);
          });
     }

     public async getYearlyGrowthStats(req: BaseAnalyticsRequest, res: Response) {
          const { tenantId } = req.query
          return this.handleRequest(res, async () => {
               const clinicianId = this.validateClinicianId(req.params.clinicianId);
               return await ClinicianAnalytics.getYearlyGrowthStats(parseInt(tenantId), clinicianId);
          });
     }

     public async getMonthlyTestBreakdown(req: BaseAnalyticsRequest, res: Response) {
          const { tenantId } = req.query
          return this.handleRequest(res, async () => {
               const clinicianId = this.validateClinicianId(req.params.clinicianId);
               return await ClinicianAnalytics.getMonthlyTestBreakdown(parseInt(tenantId), clinicianId);
          });
     }

     public async getTopOutsourcedTests(req: BaseAnalyticsRequest, res: Response) {
          const { tenantId } = req.query
          return this.handleRequest(res, async () => {
               const clinicianId = this.validateClinicianId(req.params.clinicianId);
               return await ClinicianAnalytics.getTopOutsourcedTests(parseInt(tenantId), clinicianId);
          });
     }

     public async getEndpoints(req: Request, res: Response) {
          const { tenantId } = req.query
          try {
               return res.status(200).json({
                    success: true,
                    data: analyticsEndpoints
               });
          } catch (error: any) {
               return res.status(400).json({
                    success: false,
                    error: error.message
               });
          }
     }

     public async getAllAnalytics(req: BaseAnalyticsRequest, res: Response) {
          const { tenantId } = req.query
          return this.handleRequest(res, async () => {
               const clinicianId = this.validateClinicianId(req.params.clinicianId);
               const year = this.validateYear(req.query.year);
               const page = parseInt(req.query.page) || 1
               const count = parseInt(req.query.count) || 10
               let tenantId = req.query.tenantId;
               const parsedTenantId = parseInt(tenantId)

               const [
                    overallTotals,
                    monthlyTotals,
                    yearlyTotals,
                    caseSummaryOverall,
                    caseSummaryMonthly,
                    caseSummaryYearly,
                    caseSummaryDailyRecent,
                    dailyCaseChange,
                    monthlyCaseChange,
                    yearlyCaseChange,
                    revenueComparison,
                    paymentTypes,
                    shiftDistribution,
                    outsourcedCases,
                    growthStats,
                    monthlyTestBreakdown,
                    topOutsourced
               ] = await Promise.all([
                    ClinicianAnalytics.getOverallTotal(parsedTenantId, clinicianId),
                    ClinicianAnalytics.getMonthlyTotals(parsedTenantId, clinicianId, year),
                    ClinicianAnalytics.getYearlyTotals(parsedTenantId, clinicianId),
                    ClinicianAnalytics.getCaseSummaryOverall(parsedTenantId, clinicianId),
                    ClinicianAnalytics.getCaseSummaryMonthly(parsedTenantId, clinicianId, year),
                    ClinicianAnalytics.getCaseSummaryYearly(parsedTenantId, clinicianId),
                    ClinicianAnalytics.getCaseSummaryDailyRecent(parsedTenantId, clinicianId, year),
                    ClinicianAnalytics.getDailyCaseChange(parsedTenantId, clinicianId, count, page),
                    ClinicianAnalytics.getMonthlyCaseChange(parsedTenantId, clinicianId),
                    ClinicianAnalytics.getYearlyCaseChange(parsedTenantId, clinicianId),
                    ClinicianAnalytics.getClinicianRevenueVsTotal(parsedTenantId, clinicianId),
                    ClinicianAnalytics.getPaymentTypeSummary(parsedTenantId, clinicianId),
                    ClinicianAnalytics.getCasesByShift(parsedTenantId, clinicianId),
                    ClinicianAnalytics.getCasesByOutsourced(parsedTenantId, clinicianId),
                    ClinicianAnalytics.getYearlyGrowthStats(parsedTenantId, clinicianId),
                    ClinicianAnalytics.getMonthlyTestBreakdown(parsedTenantId, clinicianId),
                    ClinicianAnalytics.getTopOutsourcedTests(parsedTenantId, clinicianId)
               ]);

               const dashboard: DashboardResponse = {
                    overallTotals,
                    monthlyTotals,
                    yearlyTotals,
                    caseSummary: {
                         overall: caseSummaryOverall,
                         monthly: caseSummaryMonthly,
                         yearly: caseSummaryYearly,
                         dailyRecent: caseSummaryDailyRecent
                    },
                    caseChanges: {
                         daily: dailyCaseChange,
                         monthly: monthlyCaseChange,
                         yearly: yearlyCaseChange
                    },
                    revenue: {
                         comparison: revenueComparison,
                         paymentTypes
                    },
                    distributions: {
                         shift: shiftDistribution,
                         outsourced: outsourcedCases
                    },
                    tests: {
                         monthlyBreakdown: monthlyTestBreakdown,
                         topOutsourced
                    },
                    growth: growthStats
               };

               return dashboard;
          });
     }
}