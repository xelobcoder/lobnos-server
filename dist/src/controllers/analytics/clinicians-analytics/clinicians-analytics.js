"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const clinicians_analytics_1 = __importDefault(require("../../../models/analytics/clinicians-analytics/clinicians-analytics"));
const helper_1 = require("../../../hooks/helper");
const analyticsEndpoints = [
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
class ClinicianAnalyticsHandlers {
    validateClinicianId(clinicianId) {
        const id = parseInt(clinicianId);
        if (isNaN(id) || id <= 0) {
            throw new Error('Invalid clinician ID');
        }
        return id;
    }
    validateYear(year) {
        if (!year) {
            return new Date().getFullYear();
        }
        const parsedYear = parseInt(year);
        if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > new Date().getFullYear()) {
            throw new Error('Invalid year');
        }
        return parsedYear;
    }
    async handleRequest(res, action) {
        try {
            const result = await action();
            return res.status(200).json({
                success: true,
                data: result
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
    async getOverallTotal(req, res) {
        const { tenantId } = req.query;
        return this.handleRequest(res, async () => {
            const clinicianId = this.validateClinicianId(req.params.clinicianId);
            return await clinicians_analytics_1.default.getOverallTotal(parseInt(tenantId), clinicianId);
        });
    }
    async getMonthlyTotals(req, res) {
        const { tenantId } = req.query;
        return this.handleRequest(res, async () => {
            const clinicianId = this.validateClinicianId(req.params.clinicianId);
            const year = this.validateYear(req.query.year);
            return await clinicians_analytics_1.default.getMonthlyTotals(parseInt(tenantId), clinicianId, year);
        });
    }
    async getYearlyTotals(req, res) {
        const { tenantId } = req.query;
        return this.handleRequest(res, async () => {
            const clinicianId = this.validateClinicianId(req.params.clinicianId);
            return await clinicians_analytics_1.default.getYearlyTotals(parseInt(tenantId), clinicianId);
        });
    }
    async getCaseSummaryOverall(req, res) {
        const { tenantId } = req.query;
        return this.handleRequest(res, async () => {
            const clinicianId = this.validateClinicianId(req.params.clinicianId);
            return await clinicians_analytics_1.default.getCaseSummaryOverall(parseInt(tenantId), clinicianId);
        });
    }
    async getCaseSummaryMonthly(req, res) {
        const { tenantId } = req.query;
        return this.handleRequest(res, async () => {
            const clinicianId = this.validateClinicianId(req.params.clinicianId);
            const year = this.validateYear(req.query.year);
            return await clinicians_analytics_1.default.getCaseSummaryMonthly(parseInt(tenantId), clinicianId, year);
        });
    }
    async getCaseSummaryYearly(req, res) {
        const { tenantId } = req.query;
        return this.handleRequest(res, async () => {
            const clinicianId = this.validateClinicianId(req.params.clinicianId);
            return await clinicians_analytics_1.default.getCaseSummaryYearly(parseInt(tenantId), clinicianId);
        });
    }
    async getCaseSummaryDailyRecent(req, res) {
        const { tenantId } = req.query;
        return this.handleRequest(res, async () => {
            const clinicianId = this.validateClinicianId(req.params.clinicianId);
            const year = this.validateYear(req.query.year);
            return await clinicians_analytics_1.default.getCaseSummaryDailyRecent(parseInt(tenantId), clinicianId, year);
        });
    }
    async getDailyCaseChange(req, res) {
        const { tenantId } = req.query;
        return this.handleRequest(res, async () => {
            const clinicianId = this.validateClinicianId(req.params.clinicianId);
            const page = parseInt(req.query.page) || 1;
            const count = parseInt(req.query.count) || 10;
            return await clinicians_analytics_1.default.getDailyCaseChange(parseInt(tenantId), clinicianId, count, page);
        });
    }
    async getMonthlyCaseChange(req, res) {
        const { tenantId } = req.query;
        return this.handleRequest(res, async () => {
            const clinicianId = this.validateClinicianId(req.params.clinicianId);
            return await clinicians_analytics_1.default.getMonthlyCaseChange(parseInt(tenantId), clinicianId);
        });
    }
    async getYearlyCaseChange(req, res) {
        const { tenantId } = req.query;
        return this.handleRequest(res, async () => {
            const clinicianId = this.validateClinicianId(req.params.clinicianId);
            return await clinicians_analytics_1.default.getYearlyCaseChange(parseInt(tenantId), clinicianId);
        });
    }
    async getClinicianRevenueVsTotal(req, res) {
        const { tenantId } = req.query;
        return this.handleRequest(res, async () => {
            const clinicianId = this.validateClinicianId(req.params.clinicianId);
            return await clinicians_analytics_1.default.getClinicianRevenueVsTotal(parseInt(tenantId), clinicianId);
        });
    }
    async getPaymentTypeSummary(req, res) {
        const { tenantId } = req.query;
        return this.handleRequest(res, async () => {
            const clinicianId = this.validateClinicianId(req.params.clinicianId);
            return await clinicians_analytics_1.default.getPaymentTypeSummary(parseInt(tenantId), clinicianId);
        });
    }
    async getCasesByShift(req, res) {
        const { tenantId } = req.query;
        return this.handleRequest(res, async () => {
            const clinicianId = this.validateClinicianId(req.params.clinicianId);
            return await clinicians_analytics_1.default.getCasesByShift(parseInt(tenantId), clinicianId);
        });
    }
    async getCasesByOutsourced(req, res) {
        const { tenantId } = req.query;
        return this.handleRequest(res, async () => {
            const clinicianId = this.validateClinicianId(req.params.clinicianId);
            return await clinicians_analytics_1.default.getCasesByOutsourced(parseInt(tenantId), clinicianId);
        });
    }
    async getYearlyGrowthStats(req, res) {
        const { tenantId } = req.query;
        return this.handleRequest(res, async () => {
            const clinicianId = this.validateClinicianId(req.params.clinicianId);
            return await clinicians_analytics_1.default.getYearlyGrowthStats(parseInt(tenantId), clinicianId);
        });
    }
    async getMonthlyTestBreakdown(req, res) {
        const { tenantId } = req.query;
        return this.handleRequest(res, async () => {
            const clinicianId = this.validateClinicianId(req.params.clinicianId);
            return await clinicians_analytics_1.default.getMonthlyTestBreakdown(parseInt(tenantId), clinicianId);
        });
    }
    async getCliniciansCommissionbyDate(request, response) {
        const { tenantId, startDate, endDate } = request.query;
        if (!startDate || !endDate) {
            return response.status(400).json({
                success: false,
                error: "Start date and end date are required"
            });
        }
        const result = await clinicians_analytics_1.default.getClinicianCommissionByDate(parseInt(tenantId.toString()), startDate, endDate);
        response.status(200).json({
            success: true,
            data: result
        });
    }
    async getClinicianCommissionHandler(request, response) {
        const { tenantId, clinicianId, startDate, endDate } = request.query;
        if (!startDate || !endDate) {
            return response.status(400).json({
                success: false,
                error: "Start date and end date are required"
            });
        }
        if (clinicianId === undefined || clinicianId === null) {
            return (0, helper_1.customError)('Clinician ID is required', 400, response);
        }
        const result = await clinicians_analytics_1.default.getClinicianCommission(parseInt(tenantId.toString()), parseInt(clinicianId.toString()), startDate, endDate);
        response.status(200).json({
            success: true,
            data: result
        });
    }
    async getTopOutsourcedTests(req, res) {
        const { tenantId } = req.query;
        return this.handleRequest(res, async () => {
            const clinicianId = this.validateClinicianId(req.params.clinicianId);
            return await clinicians_analytics_1.default.getTopOutsourcedTests(parseInt(tenantId), clinicianId);
        });
    }
    async getEndpoints(req, res) {
        const { tenantId } = req.query;
        try {
            return res.status(200).json({
                success: true,
                data: analyticsEndpoints
            });
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
    async getAllAnalytics(req, res) {
        const { tenantId } = req.query;
        return this.handleRequest(res, async () => {
            const clinicianId = this.validateClinicianId(req.params.clinicianId);
            const year = this.validateYear(req.query.year);
            const page = parseInt(req.query.page) || 1;
            const count = parseInt(req.query.count) || 10;
            let tenantId = req.query.tenantId;
            const parsedTenantId = parseInt(tenantId);
            const [overallTotals, monthlyTotals, yearlyTotals, caseSummaryOverall, caseSummaryMonthly, caseSummaryYearly, caseSummaryDailyRecent, dailyCaseChange, monthlyCaseChange, yearlyCaseChange, revenueComparison, paymentTypes, shiftDistribution, outsourcedCases, growthStats, monthlyTestBreakdown, topOutsourced] = await Promise.all([
                clinicians_analytics_1.default.getOverallTotal(parsedTenantId, clinicianId),
                clinicians_analytics_1.default.getMonthlyTotals(parsedTenantId, clinicianId, year),
                clinicians_analytics_1.default.getYearlyTotals(parsedTenantId, clinicianId),
                clinicians_analytics_1.default.getCaseSummaryOverall(parsedTenantId, clinicianId),
                clinicians_analytics_1.default.getCaseSummaryMonthly(parsedTenantId, clinicianId, year),
                clinicians_analytics_1.default.getCaseSummaryYearly(parsedTenantId, clinicianId),
                clinicians_analytics_1.default.getCaseSummaryDailyRecent(parsedTenantId, clinicianId, year),
                clinicians_analytics_1.default.getDailyCaseChange(parsedTenantId, clinicianId, count, page),
                clinicians_analytics_1.default.getMonthlyCaseChange(parsedTenantId, clinicianId),
                clinicians_analytics_1.default.getYearlyCaseChange(parsedTenantId, clinicianId),
                clinicians_analytics_1.default.getClinicianRevenueVsTotal(parsedTenantId, clinicianId),
                clinicians_analytics_1.default.getPaymentTypeSummary(parsedTenantId, clinicianId),
                clinicians_analytics_1.default.getCasesByShift(parsedTenantId, clinicianId),
                clinicians_analytics_1.default.getCasesByOutsourced(parsedTenantId, clinicianId),
                clinicians_analytics_1.default.getYearlyGrowthStats(parsedTenantId, clinicianId),
                clinicians_analytics_1.default.getMonthlyTestBreakdown(parsedTenantId, clinicianId),
                clinicians_analytics_1.default.getTopOutsourcedTests(parsedTenantId, clinicianId)
            ]);
            const dashboard = {
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
exports.default = ClinicianAnalyticsHandlers;
