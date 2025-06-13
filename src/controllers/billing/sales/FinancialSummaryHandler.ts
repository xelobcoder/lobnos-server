import { Request, Response } from "express";
import { TiifuWorkingClass } from "../../../database/TiifuWorkingClass";
import { UtilityFinancial } from "../../../models/billing/sales/AnalyticsBilling";
import { getDailyAnalyticsDashboard } from "./Extensive/extensive-daily-sales-breakdown";

const analyticsFunctions: { [key: string]: Function } = {
	totalSalesByServiceCategory: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalSalesByServiceCategory', branchid, startdate, enddate),

	averageCostPerService: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'averageCostPerService', branchid, startdate, enddate),

	totalSalesByBranch: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalSalesByBranch', branchid, startdate, enddate),

	totalSalesByClinician: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalSalesByClinician', branchid, startdate, enddate),

	totalSalesByOrganization: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalSalesByOrganization', branchid, startdate, enddate),

	totalSalesByRegistrationType: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalSalesByRegistrationType', branchid, startdate, enddate),

	totalSalesByOutsourcedStatus: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalSalesByOutsourcedStatus', branchid, startdate, enddate),

	salesTrendByDate: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'salesTrendByDate', branchid, startdate, enddate),

	numberOfServicesByCategory: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'numberOfServicesByCategory', branchid, startdate, enddate),

	salesByTaxStatus: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'salesByTaxStatus', branchid, startdate, enddate),

	salesByDiscountStatus: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'salesByDiscountStatus', branchid, startdate, enddate),

	totalSalesByBranchAndCategory: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalSalesByBranchAndCategory', branchid, startdate, enddate),

	totalSalesByEmployee: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalSalesByEmployee', branchid, startdate, enddate),

	salesByOutsourceId: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'salesByOutsourceId', branchid, startdate, enddate),

	top10HighestCostServices: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'top10HighestCostServices', branchid, startdate, enddate),

	totalTaxByServiceCategory: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalTaxByServiceCategory', branchid, startdate, enddate),

	totalSalesAndTaxValue: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalSalesAndTaxValue', branchid, startdate, enddate),

	averageTaxByBranch: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'averageTaxByBranch', branchid, startdate, enddate),

	salesWithHighestTaxIncluded: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'salesWithHighestTaxIncluded', branchid, startdate, enddate),

	totalTaxByClinician: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalTaxByClinician', branchid, startdate, enddate),

	totalDiscountByBranch: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalDiscountByBranch', branchid, startdate, enddate),

	averageDiscountPerService: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'averageDiscountPerService', branchid, startdate, enddate),

	totalDiscountByClinician: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalDiscountByClinician', branchid, startdate, enddate),

	totalDiscountByRegistrationType: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalDiscountByRegistrationType', branchid, startdate, enddate),

	top10ServicesWithMaxDiscount: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'top10ServicesWithMaxDiscount', branchid, startdate, enddate),

	mostPopularServiceBySales: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'mostPopularServiceBySales', branchid, startdate, enddate),

	averageServiceCostByCategory: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'averageServiceCostByCategory', branchid, startdate, enddate),

	totalSalesByBillingid: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalSalesBySalesBillingid', branchid, startdate, enddate),

	numberOfServicesByEmployee: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'numberOfServicesByEmployee', branchid, startdate, enddate),

	totalSalesByCategoryAndRegistration: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalSalesByCategoryAndRegistration', branchid, startdate, enddate),

	monthlySalesTrend: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'monthlySalesTrend', branchid, startdate, enddate),

	dailySalesTrend: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'dailySalesTrend', branchid, startdate, enddate),

	weeklySalesTrend: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'weeklySalesTrend', branchid, startdate, enddate),

	salesByMonthAndCategory: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'salesByMonthAndCategory', branchid, startdate, enddate),

	salesByWeekAndBranch: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'salesByWeekAndBranch', branchid, startdate, enddate),

	yearlySalesTrend: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'yearlySalesTrend', branchid, startdate, enddate),

	salesByHourOfDay: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'salesByHourOfDay', branchid, startdate, enddate),

	totalSalesFromOutsourcedServices: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalSalesFromOutsourcedServices', branchid, startdate, enddate),

	salesFromOutsourcedByBranch: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'salesFromOutsourcedByBranch', branchid, startdate, enddate),

	numberOfOutsourcedServicesByOrg: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'numberOfOutsourcedServicesByOrg', branchid, startdate, enddate),

	maxAndMinServiceCosts: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'maxAndMinServiceCosts', branchid, startdate, enddate),

	serviceCostByCategory: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'serviceCostByCategory', branchid, startdate, enddate),

	costBreakdownByClinician: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'costBreakdownByClinician', branchid, startdate, enddate),

	costPerServiceByCategory: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'costPerServiceByCategory', branchid, startdate, enddate),

	numberOfTransactionsByBranch: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'numberOfTransactionsByBranch', branchid, startdate, enddate),

	totalSalesByTransactionId: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalSalesByTransactionId', branchid, startdate, enddate),

	transactionCountByEmployee: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'transactionCountByEmployee', branchid, startdate, enddate),

	totalSalesAndTransactionsByDate: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalSalesAndTransactionsByDate', branchid, startdate, enddate),

	taxCollectedByTransaction: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'taxCollectedByTransaction', branchid, startdate, enddate),

	taxValueByBranch: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'taxValueByBranch', branchid, startdate, enddate),

	totalSalesByTaxValueAndIncluded: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalSalesByTaxValueAndIncluded', branchid, startdate, enddate),

	averageSalesPerDay: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'averageSalesPerDay', branchid, startdate, enddate),

	salesByTaxableStatus: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'salesByTaxableStatus', branchid, startdate, enddate),

	totalSalesByEmployeeAndBranch: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalSalesByEmployeeAndBranch', branchid, startdate, enddate),

	numberOfServicesByEmployeeAndDate: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'numberOfServicesByEmployeeAndDate', branchid, startdate, enddate),

	salesAndTaxValueByRegistrationType: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'salesAndTaxValueByRegistrationType', branchid, startdate, enddate),

	totalDiscountByServiceCategory: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalDiscountByServiceCategory', branchid, startdate, enddate),

	salesAndDiscountByClinician: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'salesAndDiscountByClinician', branchid, startdate, enddate),

	totalSalesByTaxValue: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalSalesByTaxValue', branchid, startdate, enddate),

	taxValueByClinician: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'taxValueByClinician', branchid, startdate, enddate),

	totalSalesByOutsourceIdAndDate: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalSalesByOutsourceIdAndDate', branchid, startdate, enddate),

	salesByEmployeeAndClinician: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'salesByEmployeeAndClinician', branchid, startdate, enddate),

	salesAndDiscountByMonth: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'salesAndDiscountByMonth', branchid, startdate, enddate),

	salesByEmployeeAndService: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'salesByEmployeeAndService', branchid, startdate, enddate),

	totalTaxValueByOutsourceStatus: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalTaxValueByOutsourceStatus', branchid, startdate, enddate),

	totalSalesFromOutsourcedServicesByCategory: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalSalesFromOutsourcedServicesByCategory', branchid, startdate, enddate),

	totalSalesForAllCategories: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null) =>
		UtilityFinancial(tenantId, 'totalSalesForAllCategories', branchid, startdate, enddate),
};


export const handleFinancialAnalytics = async function (request: Request<{}, {}, {}, {
	key: string,
	startDate: string,
	tenantId: number,
	endDate: string,
	branchid: number
}>, response: Response): Promise<Response> {
	const { key, startDate = null, endDate = null, branchid, tenantId } = request.query;
	const tenantIdP = parseInt(tenantId.toString(), 10);
	const analyticsKey = key?.toString();


	if (analyticsKey === 'all') {
		try {
			const allResults: { [key: string]: any } = {};
			for (const funcKey in analyticsFunctions) {
				if (analyticsFunctions.hasOwnProperty(funcKey)) {
					const result = await analyticsFunctions[funcKey](tenantId, null, startDate, endDate);
					allResults[funcKey] = result;
				}
			}
			return response.json(allResults);

		} catch (error) {
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
		} catch (error) {
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


export const handleFinancialAnalyticsGetKeys = async function (request: Request, response: Response): Promise<Response> {
	try {
		const functionKeys = Object.keys(analyticsFunctions).map((item, index) => {
			return { key: item, label: TiifuWorkingClass.splitByCapitalLetters(item).join(" ") }
		});
		return response.json(functionKeys);
	} catch (error) {
		return response.status(500).json({
			error: "Failed to retrieve function keys",
			details: error.message
		});
	}
}



export const handleSalesSummaryDailyBreakDown = async function (request: Request<{}, {}, {
	tenantId: number,
	targetDate: string,
	fromDate: string,
	toDate: string
}>, response: Response): Promise<void> {
	try {
		const { tenantId, targetDate, fromDate, toDate } = request.query;
		const responseData = await getDailyAnalyticsDashboard(parseInt(tenantId.toString()), targetDate as string, fromDate as string, toDate as string);
		response.send(responseData);
	} catch (error) {
		response.status(500).json({
			error: "Failed to retrieve function keys",
			details: error.message
		});
	}
}