"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSalesSummaryDailyBreakDown = exports.handleFinancialAnalyticsGetKeys = exports.handleFinancialAnalytics = exports.UtilityOutsourcing = void 0;
const TiifuWorkingClass_1 = require("../../../database/TiifuWorkingClass");
const AnalyticsBilling_1 = require("../../../models/billing/sales/AnalyticsBilling");
const outsourcingAnalqueries_1 = require("../../../models/billing/outsourcingAnalqueries");
const extensive_daily_sales_breakdown_1 = require("./Extensive/extensive-daily-sales-breakdown");
const helper_1 = require("../../../hooks/helper");
const billingAnalqueries_1 = require("../../../models/billing/billingAnalqueries");
async function UtilityOutsourcing(tenantId, key, branchid, startdate, enddate, year, outsourceId) {
    // Special handling for hourly analytics - uses single target date
    if (key === 'hourlyOutsourcingPattern') {
        const params = [startdate, branchid, branchid, outsourceId, outsourceId];
        return await (0, helper_1.promisifyQuery)(tenantId, outsourcingAnalqueries_1.OutsourcingAnalytics[key], params);
    }
    // Special handling for monthly analytics - uses year parameter if provided, otherwise startdate as year, otherwise current year
    if (key === 'monthlyOutsourcedAmountLast12Months') {
        const yearValue = year || (startdate ? startdate.toString() : new Date().getFullYear().toString());
        const params = [yearValue, branchid, branchid, outsourceId, outsourceId];
        return await (0, helper_1.promisifyQuery)(tenantId, outsourcingAnalqueries_1.OutsourcingAnalytics[key], params);
    }
    // For queries that support year parameter and year is provided, use date range for the specific year
    if (year && !startdate && !enddate) {
        if (['dailyOutsourcedAmountLast30Days', 'weeklyOutsourcedTrend', 'quarterlyOutsourcedTrend',
            'top20OutsourcedFacilities', 'topFacilityPerMonth', 'grandSummaryDashboard'].includes(key)) {
            // Convert year to date range for the entire year
            const startOfYear = `${year}-01-01`;
            const endOfYear = `${year}-12-31`;
            const params = [startOfYear, endOfYear, branchid, branchid, outsourceId, outsourceId];
            // Map keys to their date range equivalents
            const dateRangeKey = key === 'top20OutsourcedFacilities' ? 'topFacilitiesByAmount' :
                key === 'grandSummaryDashboard' ? 'summaryDashboard' : key;
            return await (0, helper_1.promisifyQuery)(tenantId, outsourcingAnalqueries_1.OutsourcingAnalyticsWithDate[dateRangeKey], params);
        }
        // For yearlySummaryByFacility, keep using current year logic since it's specifically yearly
        if (key === 'yearlySummaryByFacility') {
            const params = [branchid, branchid, outsourceId, outsourceId];
            return await (0, helper_1.promisifyQuery)(tenantId, outsourcingAnalqueries_1.OutsourcingAnalytics[key], params);
        }
    }
    if (startdate && enddate) {
        const params = [startdate, enddate, branchid, branchid, outsourceId, outsourceId];
        return await (0, helper_1.promisifyQuery)(tenantId, outsourcingAnalqueries_1.OutsourcingAnalyticsWithDate[key], params);
    }
    const params = [branchid, branchid, outsourceId, outsourceId];
    return await (0, helper_1.promisifyQuery)(tenantId, outsourcingAnalqueries_1.OutsourcingAnalytics[key], params);
}
exports.UtilityOutsourcing = UtilityOutsourcing;
const analyticsFunctions = {
    totalSalesByBranch: async (tenantId, branchid, startdate, enddate, year, outsourceId) => {
        return await (0, helper_1.promisifyQuery)(tenantId, billingAnalqueries_1.BillingAnalyticsWithDate['totalSalesByBranch'], [startdate, enddate]);
    },
    totalSalesByClinician: (tenantId, branchid, startdate, enddate, year, outsourceId) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesByClinician', branchid, startdate, enddate),
    totalSalesByOrganization: async (tenantId, branchid, startdate, enddate, year, outsourceId) => {
        return await (0, helper_1.promisifyQuery)(tenantId, billingAnalqueries_1.BillingAnalyticsWithDate['totalSalesByOrganization'], [startdate, enddate]);
    },
    totalSalesByOutsourcedStatus: (tenantId, branchid, startdate, enddate, year, outsourceId) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesByOutsourcedStatus', branchid, startdate, enddate),
    totalSalesByBranchAndCategory: async (tenantId, branchid, startdate, enddate, year, outsourceId) => {
        return await (0, helper_1.promisifyQuery)(tenantId, billingAnalqueries_1.BillingAnalyticsWithDate['totalSalesByBranchAndCategory'], [startdate, enddate]);
    },
    totalSalesByEmployee: async (tenantId, branchid, startdate, enddate, year, outsourceId) => {
        return await (0, helper_1.promisifyQuery)(tenantId, billingAnalqueries_1.BillingAnalyticsWithDate['totalSalesByEmployee'], [startdate, enddate]);
    },
    monthlySalesTrend: async (tenantId, branchid, startdate, enddate, year) => {
        return await (0, helper_1.promisifyQuery)(tenantId, billingAnalqueries_1.BillingAnalyticsWithDate['monthlySalesTrend'], [year, year]);
    },
    dailySalesTrend: (tenantId, branchid, startdate, enddate, year, outsourceId) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'dailySalesTrend', branchid, startdate, enddate),
    weeklySalesTrend: async (tenantId, branchid, startdate, enddate, year, outsourceId) => {
        return await (0, helper_1.promisifyQuery)(tenantId, billingAnalqueries_1.BillingAnalytics['weeklySalesTrend'], [year, year]);
    },
    salesByWeekAndBranch: (tenantId, branchid, startdate, enddate, year, outsourceId) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'salesByWeekAndBranch', branchid, startdate, enddate),
    yearlySalesTrend: async (tenantId, branchid, startdate, enddate, year) => {
        return await (0, helper_1.promisifyQuery)(tenantId, billingAnalqueries_1.BillingAnalyticsWithDate['yearlySalesTrend'], [year, year]);
    },
    totalAmountRefunded: (tenantId, branchid, startdate, enddate, year, outsourceId) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalAmountRefunded', branchid, startdate, enddate),
    // Outsourcing Analytics
    dailyOutsourcedAmountLast30Days: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'dailyOutsourcedAmountLast30Days', branchid, startdate, enddate, year, outsourceId),
    monthlyOutsourcedAmountLast12Months: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'monthlyOutsourcedAmountLast12Months', branchid, startdate, enddate, year, outsourceId),
    yearlySummaryByFacility: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'yearlySummaryByFacility', branchid, startdate, enddate, year, outsourceId),
    top20OutsourcedFacilities: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'top20OutsourcedFacilities', branchid, startdate, enddate, year, outsourceId),
    hourlyOutsourcingPattern: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'hourlyOutsourcingPattern', branchid, startdate, enddate, year, outsourceId),
    topFacilityPerMonth: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'topFacilityPerMonth', branchid, startdate, enddate, year, outsourceId),
    grandSummaryDashboard: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'grandSummaryDashboard', branchid, startdate, enddate, year, outsourceId),
    weeklyOutsourcedTrend: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'weeklyOutsourcedTrend', branchid, startdate, enddate, year, outsourceId),
    quarterlyOutsourcedTrend: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'quarterlyOutsourcedTrend', branchid, startdate, enddate, year, outsourceId),
    // Current Year Outsourcing Analytics
    dailyOutsourcedAmountCurrentYear: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'dailyOutsourcedAmountLast30Days', branchid, startdate, enddate, year, outsourceId),
    monthlyOutsourcedAmountCurrentYear: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'monthlyOutsourcedAmountLast12Months', branchid, startdate, enddate, year, outsourceId),
    topFacilitiesCurrentYear: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'top20OutsourcedFacilities', branchid, startdate, enddate, year, outsourceId),
    hourlyOutsourcingPatternCurrentYear: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'hourlyOutsourcingPattern', branchid, startdate, enddate, year, outsourceId),
    weeklyOutsourcedTrendCurrentYear: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'weeklyOutsourcedTrend', branchid, startdate, enddate, year, outsourceId),
    quarterlyOutsourcedTrendCurrentYear: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'quarterlyOutsourcedTrend', branchid, startdate, enddate, year, outsourceId),
    // Date-Range Outsourcing Analytics
    dailyOutsourcedAmount: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'dailyOutsourcedAmount', branchid, startdate, enddate, year, outsourceId),
    monthlyOutsourcedAmount: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'monthlyOutsourcedAmount', branchid, startdate, enddate, year, outsourceId),
    yearlySummaryByFacilityDateRange: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'yearlySummaryByFacility', branchid, startdate, enddate, year, outsourceId),
    topFacilitiesByAmount: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'top20OutsourcedFacilities', branchid, startdate, enddate, year, outsourceId),
    hourlyOutsourcingPatternDateRange: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'hourlyOutsourcingPattern', branchid, startdate, enddate, year, outsourceId),
    topFacilityPerMonthDateRange: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'topFacilityPerMonth', branchid, startdate, enddate, year, outsourceId),
    summaryDashboardDateRange: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'grandSummaryDashboard', branchid, startdate, enddate, year, outsourceId),
    weeklyOutsourcedTrendDateRange: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'weeklyOutsourcedTrend', branchid, startdate, enddate, year, outsourceId),
    quarterlyOutsourcedTrendDateRange: (tenantId, branchid, startdate, enddate, year, outsourceId) => UtilityOutsourcing(tenantId, 'quarterlyOutsourcedTrend', branchid, startdate, enddate, year, outsourceId),
};
const handleFinancialAnalytics = async function (request, response) {
    const { key, startDate = null, endDate = null, branchid, tenantId, targetDate, year, outsourceId } = request.query;
    const tenantIdP = parseInt(tenantId.toString(), 10);
    const analyticsKey = key === null || key === void 0 ? void 0 : key.toString();
    const branchIdNum = branchid ? parseInt(branchid.toString(), 10) : null;
    const yearNum = year ? parseInt(year.toString(), 10) : null;
    // Convert outsourceId to number or null
    const outsourceIdNum = outsourceId ? parseInt(outsourceId.toString(), 10) : null;
    if (analyticsKey === 'all') {
        try {
            const allResults = {};
            for (const funcKey in analyticsFunctions) {
                if (analyticsFunctions.hasOwnProperty(funcKey)) {
                    const result = await analyticsFunctions[funcKey](tenantId, branchIdNum, startDate, endDate, yearNum, outsourceIdNum);
                    allResults[funcKey] = result;
                }
            }
            return response.json(allResults);
        }
        catch (error) {
            return response.status(500).json({
                error: "Failed to fetch analytics data",
                details: error.message
            });
        }
    }
    if (analyticsFunctions[analyticsKey]) {
        try {
            // Special handling for hourly analytics - use targetDate if provided
            const dateParam = (analyticsKey.includes('hourlyOutsourcingPattern') && targetDate) ? targetDate : startDate;
            const result = await analyticsFunctions[analyticsKey](tenantId, branchIdNum, dateParam, endDate, yearNum, outsourceIdNum);
            return response.json(result);
        }
        catch (error) {
            return response.status(500).json({
                error: "Failed to fetch analytics data",
                details: error.message
            });
        }
    }
    return response.status(404).json({
        error: "Analytics key not found"
    });
};
exports.handleFinancialAnalytics = handleFinancialAnalytics;
const handleFinancialAnalyticsGetKeys = async function (request, response) {
    try {
        const functionKeys = Object.keys(analyticsFunctions).map((item, index) => {
            return { key: item, label: TiifuWorkingClass_1.TiifuWorkingClass.splitByCapitalLetters(item).join(" ") };
        });
        return response.json(functionKeys);
    }
    catch (error) {
        return response.status(500).json({
            error: "Failed to retrieve function keys",
            details: error.message
        });
    }
};
exports.handleFinancialAnalyticsGetKeys = handleFinancialAnalyticsGetKeys;
const handleSalesSummaryDailyBreakDown = async function (request, response) {
    try {
        const { tenantId, targetDate, fromDate, toDate } = request.query;
        const tennatId = parseInt(tenantId.toString());
        const responseData = await (0, extensive_daily_sales_breakdown_1.getDailyAnalyticsDashboard)(tennatId, targetDate, fromDate, toDate);
        response.send(responseData);
    }
    catch (error) {
        console.log(error);
        response.status(500).json({
            error: "Failed to retrieve function keys",
            details: error.message
        });
    }
};
exports.handleSalesSummaryDailyBreakDown = handleSalesSummaryDailyBreakDown;
