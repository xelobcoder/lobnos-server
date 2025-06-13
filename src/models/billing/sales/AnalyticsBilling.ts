import { promisifyQuery } from '../../../hooks/helper';
import { BillingAnalytics, BillingAnalyticsWithDate } from '../billingAnalqueries';

export default class FinancialAnalyticsPrimeLabSystem {
	readonly branchid: number | null;
	private tenantId: number


	constructor(branchid: number, tenantId: number) {
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

	// 	static async weeklySalesTrend() {
	// 		return await promisifyQuery(BillingAnalytics.weeklySalesTrend);
	// 	}

	// 	static async salesByMonthAndCategory() {
	// 		return await promisifyQuery(BillingAnalytics.salesByMonthAndCategory);
	// 	}

	// 	static async salesByWeekAndBranch() {
	// 		return await promisifyQuery(BillingAnalytics.salesByWeekAndBranch);
	// 	}

	// 	static async yearlySalesTrend() {
	// 		return await promisifyQuery(BillingAnalytics.yearlySalesTrend);
	// 	}

	// 	static async salesByHourOfDay() {
	// 		return await promisifyQuery(BillingAnalytics.salesByHourOfDay);
	// 	}

	// 	static async totalSalesFromOutsourcedServices() {
	// 		return await promisifyQuery(BillingAnalytics.totalSalesFromOutsourcedServices);
	// 	}

	// 	static async salesFromOutsourcedByBranch() {
	// 		return await promisifyQuery(BillingAnalytics.salesFromOutsourcedByBranch);
	// 	}

	// 	static async numberOfOutsourcedServicesByOrg() {
	// 		return await promisifyQuery(BillingAnalytics.numberOfOutsourcedServicesByOrg);
	// 	}

	// 	static async maxAndMinServiceCosts() {
	// 		return await promisifyQuery(BillingAnalytics.maxAndMinServiceCosts);
	// 	}

	// 	static async serviceCostByCategory() {
	// 		return await promisifyQuery(BillingAnalytics.serviceCostByCategory);
	// 	}

	// 	static async costBreakdownByClinician() {
	// 		return await promisifyQuery(BillingAnalytics.costBreakdownByClinician);
	// 	}

	// 	static async costPerServiceByCategory() {
	// 		return await promisifyQuery(BillingAnalytics.costPerServiceByCategory);
	// 	}

	// 	static async numberOfTransactionsByBranch() {
	// 		return await promisifyQuery(BillingAnalytics.numberOfTransactionsByBranch);
	// 	}

	// 	static async totalSalesByTransactionId() {
	// 		return await promisifyQuery(BillingAnalytics.totalSalesByTransactionId);
	// 	}

	// 	static async transactionCountByEmployee() {
	// 		return await promisifyQuery(BillingAnalytics.transactionCountByEmployee);
	// 	}

	// 	static async totalSalesAndTransactionsByDate() {
	// 		return await promisifyQuery(BillingAnalytics.totalSalesAndTransactionsByDate);
	// 	}

	// 	static async taxCollectedByTransaction() {
	// 		return await promisifyQuery(BillingAnalytics.taxCollectedByTransaction);
	// 	}

	// 	static async taxValueByBranch() {
	// 		return await promisifyQuery(BillingAnalytics.taxValueByBranch);
	// 	}

	// 	static async totalSalesByTaxValueAndIncluded() {
	// 		return await promisifyQuery(BillingAnalytics.totalSalesByTaxValueAndIncluded);
	// 	}

	// 	static async averageSalesPerDay() {
	// 		return await promisifyQuery(BillingAnalytics.averageSalesPerDay);
	// 	}

	// 	static async salesByTaxableStatus() {
	// 		return await promisifyQuery(BillingAnalytics.salesByTaxableStatus);
	// 	}

	// 	static async totalSalesByEmployeeAndBranch() {
	// 		return await promisifyQuery(BillingAnalytics.totalSalesByEmployeeAndBranch);
	// 	}

	// 	static async numberOfServicesByEmployeeAndDate() {
	// 		return await promisifyQuery(BillingAnalytics.numberOfServicesByEmployeeAndDate);
	// 	}

	// 	static async salesAndTaxValueByRegistrationType() {
	// 		return await promisifyQuery(BillingAnalytics.salesAndTaxValueByRegistrationType);
	// 	}

	// 	static async totalDiscountByServiceCategory() {
	// 		return await promisifyQuery(BillingAnalytics.totalDiscountByServiceCategory);
	// 	}

	// 	static async salesAndDiscountByClinician() {
	// 		return await promisifyQuery(BillingAnalytics.salesAndDiscountByClinician);
	// 	}

	// 	static async totalSalesByTaxValue() {
	// 		return await promisifyQuery(BillingAnalytics.totalSalesByTaxValue);
	// 	}

	// 	static async taxValueByClinician() {
	// 		return await promisifyQuery(BillingAnalytics.taxValueByClinician);
	// 	}

	// 	static async totalSalesByOutsourceIdAndDate() {
	// 		return await promisifyQuery(BillingAnalytics.totalSalesByOutsourceIdAndDate);
	// 	}

	// 	static async salesByEmployeeAndClinician() {
	// 		return await promisifyQuery(BillingAnalytics.salesByEmployeeAndClinician);
	// 	}

	// 	static async salesAndDiscountByMonth() {
	// 		return await promisifyQuery(BillingAnalytics.salesAndDiscountByMonth);
	// 	}

	// 	static async salesByEmployeeAndService() {
	// 		return await promisifyQuery(BillingAnalytics.salesByEmployeeAndService);
	// 	}

	// 	static async totalTaxValueByOutsourceStatus() {
	// 		return await promisifyQuery(BillingAnalytics.totalTaxValueByOutsourceStatus);
	// 	}

	// 	static async totalSalesFromOutsourcedServicesByCategory() {
	// 		return await promisifyQuery(BillingAnalytics.totalSalesFromOutsourcedServicesByCategory);
	// 	}

	// 	static async totalSalesForAllCategories() {
	// 		return await promisifyQuery(BillingAnalytics.totalSalesForAllCategories);
	// 	}
}


export async function UtilityFinancial(tenantId: number, key: string, branchid: number | null, startdate: string | Date, enddate: string | Date) {
	if (startdate && enddate) return await promisifyQuery(tenantId, BillingAnalyticsWithDate[key], [startdate, enddate])
	return await promisifyQuery(tenantId, BillingAnalytics[key])
}