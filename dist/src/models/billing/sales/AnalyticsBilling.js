"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UtilityFinancial = void 0;
const helper_1 = require("../../../hooks/helper");
const billingAnalqueries_1 = require("../billingAnalqueries");
class FinancialAnalyticsPrimeLabSystem {
    constructor(branchid, tenantId) {
        this.branchid = branchid;
        this.tenantId = tenantId;
    }
    // 	static async totalSalesByServiceCategory() {
    // 		return await promisifyQuery(BillingAnalytics.totalSalesByServiceCategory);
    // 	}
    // 	static async averageCostPerService() {
    // 		return await promisifyQuery(BillingAnalytics.averageCostPerService);
    // 	}
    // 	static async totalSalesByBranch() {
    // 		return await promisifyQuery(BillingAnalytics.totalSalesByBranch);
    // 	}
    // 	static async totalSalesByClinician() {
    // 		return await promisifyQuery(BillingAnalytics.totalSalesByClinician);
    // 	}
    // 	static async totalSalesByOrganization() {
    // 		return await promisifyQuery(BillingAnalytics.totalSalesByOrganization);
    // 	}
    // 	static async totalSalesByRegistrationType() {
    // 		return await promisifyQuery(BillingAnalytics.totalSalesByRegistrationType);
    // 	}
    // 	static async totalSalesByOutsourcedStatus() {
    // 		return await promisifyQuery(BillingAnalytics.totalSalesByOutsourcedStatus);
    // 	}
    // 	static async salesTrendByDate() {
    // 		return await promisifyQuery(BillingAnalytics.salesTrendByDate);
    // 	}
    // 	static async numberOfServicesByCategory() {
    // 		return await promisifyQuery(BillingAnalytics.numberOfServicesByCategory);
    // 	}
    // 	static async salesByTaxStatus() {
    // 		return await promisifyQuery(BillingAnalytics.salesByTaxStatus);
    // 	}
    // 	static async salesByDiscountStatus() {
    // 		return await promisifyQuery(BillingAnalytics.salesByDiscountStatus);
    // 	}
    // 	static async totalSalesByBranchAndCategory() {
    // 		return await promisifyQuery(BillingAnalytics.totalSalesByBranchAndCategory);
    // 	}
    // 	static async totalSalesByEmployee() {
    // 		return await promisifyQuery(BillingAnalytics.totalSalesByEmployee);
    // 	}
    // 	static async salesByOutsourceId() {
    // 		return await promisifyQuery(BillingAnalytics.salesByOutsourceId);
    // 	}
    // 	static async top10HighestCostServices() {
    // 		return await promisifyQuery(BillingAnalytics.top10HighestCostServices);
    // 	}
    // 	static async totalTaxByServiceCategory() {
    // 		return await promisifyQuery(BillingAnalytics.totalTaxByServiceCategory);
    // 	}
    // 	static async totalSalesAndTaxValue() {
    // 		return await promisifyQuery(BillingAnalytics.totalSalesAndTaxValue);
    // 	}
    // 	static async averageTaxByBranch() {
    // 		return await promisifyQuery(BillingAnalytics.averageTaxByBranch);
    // 	}
    // 	static async salesWithHighestTaxIncluded() {
    // 		return await promisifyQuery(BillingAnalytics.salesWithHighestTaxIncluded);
    // 	}
    // 	static async totalTaxByClinician() {
    // 		return await promisifyQuery(BillingAnalytics.totalTaxByClinician);
    // 	}
    // 	static async totalDiscountByBranch() {
    // 		return await promisifyQuery(BillingAnalytics.totalDiscountByBranch);
    // 	}
    // 	static async averageDiscountPerService() {
    // 		return await promisifyQuery(BillingAnalytics.averageDiscountPerService);
    // 	}
    // 	static async totalDiscountByClinician() {
    // 		return await promisifyQuery(BillingAnalytics.totalDiscountByClinician);
    // 	}
    // 	static async totalDiscountByRegistrationType() {
    // 		return await promisifyQuery(BillingAnalytics.totalDiscountByRegistrationType);
    // 	}
    // 	static async top10ServicesWithMaxDiscount() {
    // 		return await promisifyQuery(BillingAnalytics.top10ServicesWithMaxDiscount);
    // 	}
    // 	static async mostPopularServiceBySales() {
    // 		return await promisifyQuery(BillingAnalytics.mostPopularServiceBySales);
    // 	}
    // 	static async averageServiceCostByCategory() {
    // 		return await promisifyQuery(BillingAnalytics.averageServiceCostByCategory);
    // 	}
    // 	static async totalSalesBySalesBillingid() {
    // 		return await promisifyQuery(BillingAnalytics.totalSalesByBillingid);
    // 	}
    // 	static async numberOfServicesByEmployee() {
    // 		return await promisifyQuery(BillingAnalytics.numberOfServicesByEmployee);
    // 	}
    // 	static async totalSalesByCategoryAndRegistration() {
    // 		return await promisifyQuery(BillingAnalytics.totalSalesByCategoryAndRegistration);
    // 	}
    // 	static async monthlySalesTrend() {
    // 		return await promisifyQuery(BillingAnalytics.monthlySalesTrend);
    // 	}
    static async dailySalesTrend() {
        // return await promisifyQuery(BillingAnalytics.dailySalesTrend);
    }
}
exports.default = FinancialAnalyticsPrimeLabSystem;
async function UtilityFinancial(tenantId, key, branchid, startdate, enddate) {
    if (startdate && enddate)
        return await (0, helper_1.promisifyQuery)(tenantId, billingAnalqueries_1.BillingAnalyticsWithDate[key], [startdate, enddate]);
    return await (0, helper_1.promisifyQuery)(tenantId, billingAnalqueries_1.BillingAnalytics[key]);
}
exports.UtilityFinancial = UtilityFinancial;
