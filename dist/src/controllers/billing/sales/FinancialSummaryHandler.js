"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSalesSummaryDailyBreakDown = exports.handleFinancialAnalyticsGetKeys = exports.handleFinancialAnalytics = void 0;
const TiifuWorkingClass_1 = require("../../../database/TiifuWorkingClass");
const AnalyticsBilling_1 = require("../../../models/billing/sales/AnalyticsBilling");
const extensive_daily_sales_breakdown_1 = require("./Extensive/extensive-daily-sales-breakdown");
const analyticsFunctions = {
    totalSalesByServiceCategory: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesByServiceCategory', branchid, startdate, enddate),
    averageCostPerService: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'averageCostPerService', branchid, startdate, enddate),
    totalSalesByBranch: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesByBranch', branchid, startdate, enddate),
    totalSalesByClinician: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesByClinician', branchid, startdate, enddate),
    totalSalesByOrganization: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesByOrganization', branchid, startdate, enddate),
    totalSalesByRegistrationType: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesByRegistrationType', branchid, startdate, enddate),
    totalSalesByOutsourcedStatus: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesByOutsourcedStatus', branchid, startdate, enddate),
    salesTrendByDate: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'salesTrendByDate', branchid, startdate, enddate),
    numberOfServicesByCategory: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'numberOfServicesByCategory', branchid, startdate, enddate),
    salesByTaxStatus: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'salesByTaxStatus', branchid, startdate, enddate),
    salesByDiscountStatus: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'salesByDiscountStatus', branchid, startdate, enddate),
    totalSalesByBranchAndCategory: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesByBranchAndCategory', branchid, startdate, enddate),
    totalSalesByEmployee: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesByEmployee', branchid, startdate, enddate),
    salesByOutsourceId: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'salesByOutsourceId', branchid, startdate, enddate),
    top10HighestCostServices: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'top10HighestCostServices', branchid, startdate, enddate),
    totalTaxByServiceCategory: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalTaxByServiceCategory', branchid, startdate, enddate),
    totalSalesAndTaxValue: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesAndTaxValue', branchid, startdate, enddate),
    averageTaxByBranch: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'averageTaxByBranch', branchid, startdate, enddate),
    salesWithHighestTaxIncluded: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'salesWithHighestTaxIncluded', branchid, startdate, enddate),
    totalTaxByClinician: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalTaxByClinician', branchid, startdate, enddate),
    totalDiscountByBranch: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalDiscountByBranch', branchid, startdate, enddate),
    averageDiscountPerService: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'averageDiscountPerService', branchid, startdate, enddate),
    totalDiscountByClinician: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalDiscountByClinician', branchid, startdate, enddate),
    totalDiscountByRegistrationType: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalDiscountByRegistrationType', branchid, startdate, enddate),
    top10ServicesWithMaxDiscount: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'top10ServicesWithMaxDiscount', branchid, startdate, enddate),
    mostPopularServiceBySales: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'mostPopularServiceBySales', branchid, startdate, enddate),
    averageServiceCostByCategory: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'averageServiceCostByCategory', branchid, startdate, enddate),
    totalSalesByBillingid: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesBySalesBillingid', branchid, startdate, enddate),
    numberOfServicesByEmployee: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'numberOfServicesByEmployee', branchid, startdate, enddate),
    totalSalesByCategoryAndRegistration: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesByCategoryAndRegistration', branchid, startdate, enddate),
    monthlySalesTrend: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'monthlySalesTrend', branchid, startdate, enddate),
    dailySalesTrend: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'dailySalesTrend', branchid, startdate, enddate),
    weeklySalesTrend: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'weeklySalesTrend', branchid, startdate, enddate),
    salesByMonthAndCategory: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'salesByMonthAndCategory', branchid, startdate, enddate),
    salesByWeekAndBranch: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'salesByWeekAndBranch', branchid, startdate, enddate),
    yearlySalesTrend: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'yearlySalesTrend', branchid, startdate, enddate),
    salesByHourOfDay: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'salesByHourOfDay', branchid, startdate, enddate),
    totalSalesFromOutsourcedServices: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesFromOutsourcedServices', branchid, startdate, enddate),
    salesFromOutsourcedByBranch: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'salesFromOutsourcedByBranch', branchid, startdate, enddate),
    numberOfOutsourcedServicesByOrg: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'numberOfOutsourcedServicesByOrg', branchid, startdate, enddate),
    maxAndMinServiceCosts: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'maxAndMinServiceCosts', branchid, startdate, enddate),
    serviceCostByCategory: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'serviceCostByCategory', branchid, startdate, enddate),
    costBreakdownByClinician: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'costBreakdownByClinician', branchid, startdate, enddate),
    costPerServiceByCategory: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'costPerServiceByCategory', branchid, startdate, enddate),
    numberOfTransactionsByBranch: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'numberOfTransactionsByBranch', branchid, startdate, enddate),
    totalSalesByTransactionId: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesByTransactionId', branchid, startdate, enddate),
    transactionCountByEmployee: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'transactionCountByEmployee', branchid, startdate, enddate),
    totalSalesAndTransactionsByDate: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesAndTransactionsByDate', branchid, startdate, enddate),
    taxCollectedByTransaction: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'taxCollectedByTransaction', branchid, startdate, enddate),
    taxValueByBranch: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'taxValueByBranch', branchid, startdate, enddate),
    totalSalesByTaxValueAndIncluded: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesByTaxValueAndIncluded', branchid, startdate, enddate),
    averageSalesPerDay: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'averageSalesPerDay', branchid, startdate, enddate),
    salesByTaxableStatus: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'salesByTaxableStatus', branchid, startdate, enddate),
    totalSalesByEmployeeAndBranch: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesByEmployeeAndBranch', branchid, startdate, enddate),
    numberOfServicesByEmployeeAndDate: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'numberOfServicesByEmployeeAndDate', branchid, startdate, enddate),
    salesAndTaxValueByRegistrationType: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'salesAndTaxValueByRegistrationType', branchid, startdate, enddate),
    totalDiscountByServiceCategory: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalDiscountByServiceCategory', branchid, startdate, enddate),
    salesAndDiscountByClinician: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'salesAndDiscountByClinician', branchid, startdate, enddate),
    totalSalesByTaxValue: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesByTaxValue', branchid, startdate, enddate),
    taxValueByClinician: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'taxValueByClinician', branchid, startdate, enddate),
    totalSalesByOutsourceIdAndDate: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesByOutsourceIdAndDate', branchid, startdate, enddate),
    salesByEmployeeAndClinician: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'salesByEmployeeAndClinician', branchid, startdate, enddate),
    salesAndDiscountByMonth: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'salesAndDiscountByMonth', branchid, startdate, enddate),
    salesByEmployeeAndService: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'salesByEmployeeAndService', branchid, startdate, enddate),
    totalTaxValueByOutsourceStatus: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalTaxValueByOutsourceStatus', branchid, startdate, enddate),
    totalSalesFromOutsourcedServicesByCategory: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesFromOutsourcedServicesByCategory', branchid, startdate, enddate),
    totalSalesForAllCategories: (tenantId, branchid, startdate, enddate) => (0, AnalyticsBilling_1.UtilityFinancial)(tenantId, 'totalSalesForAllCategories', branchid, startdate, enddate),
};
const handleFinancialAnalytics = async function (request, response) {
    const { key, startDate = null, endDate = null, branchid, tenantId } = request.query;
    const tenantIdP = parseInt(tenantId.toString(), 10);
    const analyticsKey = key === null || key === void 0 ? void 0 : key.toString();
    if (analyticsKey === 'all') {
        try {
            const allResults = {};
            for (const funcKey in analyticsFunctions) {
                if (analyticsFunctions.hasOwnProperty(funcKey)) {
                    const result = await analyticsFunctions[funcKey](tenantId, null, startDate, endDate);
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
            const result = await analyticsFunctions[analyticsKey](tenantId, branchid, startDate, endDate);
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
        const responseData = await (0, extensive_daily_sales_breakdown_1.getDailyAnalyticsDashboard)(parseInt(tenantId.toString()), targetDate, fromDate, toDate);
        response.send(responseData);
    }
    catch (error) {
        response.status(500).json({
            error: "Failed to retrieve function keys",
            details: error.message
        });
    }
};
exports.handleSalesSummaryDailyBreakDown = handleSalesSummaryDailyBreakDown;
