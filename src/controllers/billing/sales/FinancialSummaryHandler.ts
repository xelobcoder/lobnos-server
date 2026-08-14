import { Request, Response } from "express";
import { TiifuWorkingClass } from "../../../database/TiifuWorkingClass";
import { UtilityFinancial } from "../../../models/billing/sales/AnalyticsBilling";
import { OutsourcingAnalytics, OutsourcingAnalyticsWithDate } from "../../../models/billing/outsourcingAnalqueries";
import { getDailyAnalyticsDashboard } from "./Extensive/extensive-daily-sales-breakdown";
import { promisifyQuery } from '../../../hooks/helper';
import { BillingAnalytics, BillingAnalyticsWithDate } from "../../../models/billing/billingAnalqueries";

export async function UtilityOutsourcing(tenantId: number, key: string, branchid: number | null, startdate: string | Date, enddate: string | Date, year?: number | null, outsourceId?: number | null) {
	// Special handling for hourly analytics - uses single target date
	if (key === 'hourlyOutsourcingPattern') {
		const params = [startdate, branchid, branchid, outsourceId, outsourceId];
		return await promisifyQuery(tenantId, OutsourcingAnalytics[key], params);
	}

	// Special handling for monthly analytics - uses year parameter if provided, otherwise startdate as year, otherwise current year
	if (key === 'monthlyOutsourcedAmountLast12Months') {
		const yearValue = year || (startdate ? startdate.toString() : new Date().getFullYear().toString());
		const params = [yearValue, branchid, branchid, outsourceId, outsourceId];
		return await promisifyQuery(tenantId, OutsourcingAnalytics[key], params);
	}

	if (year && !startdate && !enddate) {
		if (['dailyOutsourcedAmountLast30Days', 'weeklyOutsourcedTrend', 'quarterlyOutsourcedTrend',
			'top20OutsourcedFacilities', 'topFacilityPerMonth', 'grandSummaryDashboard'].includes(key)) {
	
			const startOfYear = `${year}-01-01`;
			const endOfYear = `${year}-12-31`;
			const params = [startOfYear, endOfYear, branchid, branchid, outsourceId, outsourceId];

			const dateRangeKey = key === 'top20OutsourcedFacilities' ? 'topFacilitiesByAmount' :
				key === 'grandSummaryDashboard' ? 'summaryDashboard' : key;
			return await promisifyQuery(tenantId, OutsourcingAnalyticsWithDate[dateRangeKey], params);
		}

		if (key === 'yearlySummaryByFacility') {
			const params = [branchid, branchid, outsourceId, outsourceId];
			return await promisifyQuery(tenantId, OutsourcingAnalytics[key], params);
		}
	}

	if (startdate && enddate) {
		const params = [startdate, enddate, branchid, branchid, outsourceId, outsourceId];
		return await promisifyQuery(tenantId, OutsourcingAnalyticsWithDate[key], params);
	}
	const params = [branchid, branchid, outsourceId, outsourceId];
	return await promisifyQuery(tenantId, OutsourcingAnalytics[key], params);
}

const analyticsFunctions: { [key: string]: Function } = {
	totalSalesByBranch: async (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) => {
		return await promisifyQuery(tenantId, BillingAnalyticsWithDate['totalSalesByBranch'], [startdate, enddate]);
	},

	totalSalesByClinician: async (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) => {
		return await promisifyQuery(tenantId, BillingAnalyticsWithDate['totalSalesByClinician'], [startdate, enddate]);
	},

	totalSalesByOrganization: async (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) => {
		return await promisifyQuery(tenantId, BillingAnalyticsWithDate['totalSalesByOrganization'], [startdate, enddate]);
	},

	totalSalesByOutsourcedStatus: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityFinancial(tenantId, 'totalSalesByOutsourcedStatus', branchid, startdate, enddate),

	totalSalesByBranchAndCategory: async (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) => {
		return await promisifyQuery(tenantId, BillingAnalyticsWithDate['totalSalesByBranchAndCategory'], [startdate, enddate]);
	},

	totalSalesByEmployee: async (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) => {
		return await promisifyQuery(tenantId, BillingAnalyticsWithDate['totalSalesByEmployee'], [startdate, enddate]);
	},

	monthlySalesTrend: async (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year: number) => {
		return await promisifyQuery(tenantId, BillingAnalyticsWithDate['monthlySalesTrend'], [year, year]);
	},

	dailySalesTrend: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityFinancial(tenantId, 'dailySalesTrend', branchid, startdate, enddate),

	weeklySalesTrend: async (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) => {
		return await promisifyQuery(tenantId, BillingAnalytics['weeklySalesTrend'], [year, year]);
	},

	salesByWeekAndBranch: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityFinancial(tenantId, 'salesByWeekAndBranch', branchid, startdate, enddate),

	yearlySalesTrend: async (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year: number) => {
		return await promisifyQuery(tenantId, BillingAnalyticsWithDate['yearlySalesTrend'], [year, year]);
	},

	totalAmountRefunded: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityFinancial(tenantId, 'totalAmountRefunded', branchid, startdate, enddate),

	// Outsourcing Analytics
	dailyOutsourcedAmountLast30Days: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'dailyOutsourcedAmountLast30Days', branchid, startdate, enddate, year, outsourceId),

	monthlyOutsourcedAmountLast12Months: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'monthlyOutsourcedAmountLast12Months', branchid, startdate, enddate, year, outsourceId),

	yearlySummaryByFacility: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'yearlySummaryByFacility', branchid, startdate, enddate, year, outsourceId),

	top20OutsourcedFacilities: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'top20OutsourcedFacilities', branchid, startdate, enddate, year, outsourceId),

	hourlyOutsourcingPattern: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'hourlyOutsourcingPattern', branchid, startdate, enddate, year, outsourceId),

	topFacilityPerMonth: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'topFacilityPerMonth', branchid, startdate, enddate, year, outsourceId),

	grandSummaryDashboard: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'grandSummaryDashboard', branchid, startdate, enddate, year, outsourceId),

	weeklyOutsourcedTrend: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'weeklyOutsourcedTrend', branchid, startdate, enddate, year, outsourceId),

	quarterlyOutsourcedTrend: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'quarterlyOutsourcedTrend', branchid, startdate, enddate, year, outsourceId),

	// Current Year Outsourcing Analytics
	dailyOutsourcedAmountCurrentYear: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'dailyOutsourcedAmountLast30Days', branchid, startdate, enddate, year, outsourceId),

	monthlyOutsourcedAmountCurrentYear: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'monthlyOutsourcedAmountLast12Months', branchid, startdate, enddate, year, outsourceId),

	topFacilitiesCurrentYear: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'top20OutsourcedFacilities', branchid, startdate, enddate, year, outsourceId),

	hourlyOutsourcingPatternCurrentYear: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'hourlyOutsourcingPattern', branchid, startdate, enddate, year, outsourceId),

	weeklyOutsourcedTrendCurrentYear: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'weeklyOutsourcedTrend', branchid, startdate, enddate, year, outsourceId),

	quarterlyOutsourcedTrendCurrentYear: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'quarterlyOutsourcedTrend', branchid, startdate, enddate, year, outsourceId),

	// Date-Range Outsourcing Analytics
	dailyOutsourcedAmount: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'dailyOutsourcedAmount', branchid, startdate, enddate, year, outsourceId),


	monthlyOutsourcedAmount: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'monthlyOutsourcedAmount', branchid, startdate, enddate, year, outsourceId),

	yearlySummaryByFacilityDateRange: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'yearlySummaryByFacility', branchid, startdate, enddate, year, outsourceId),

	topFacilitiesByAmount: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'top20OutsourcedFacilities', branchid, startdate, enddate, year, outsourceId),

	hourlyOutsourcingPatternDateRange: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'hourlyOutsourcingPattern', branchid, startdate, enddate, year, outsourceId),

	topFacilityPerMonthDateRange: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'topFacilityPerMonth', branchid, startdate, enddate, year, outsourceId),

	summaryDashboardDateRange: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'grandSummaryDashboard', branchid, startdate, enddate, year, outsourceId),

	weeklyOutsourcedTrendDateRange: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'weeklyOutsourcedTrend', branchid, startdate, enddate, year, outsourceId),

	quarterlyOutsourcedTrendDateRange: (tenantId: number, branchid: number, startdate: string | null, enddate: string | null, year?: number, outsourceId?: number) =>
		UtilityOutsourcing(tenantId, 'quarterlyOutsourcedTrend', branchid, startdate, enddate, year, outsourceId),
};


export const handleFinancialAnalytics = async function (request: Request<{}, {}, {}, {
	key: string,
	startDate: string,
	tenantId: number,
	endDate: string,
	branchid: number,
	targetDate: string,
	year: number,
	outsourceId: number
}>, response: Response): Promise<Response> {
	const { key, startDate = null, endDate = null, branchid, tenantId, targetDate, year, outsourceId } = request.query;
	const tenantIdP = parseInt(tenantId.toString(), 10);
	const analyticsKey = key?.toString();
	const branchIdNum = branchid ? parseInt(branchid.toString(), 10) : null;
	const yearNum = year ? parseInt(year.toString(), 10) : null;

	// Convert outsourceId to number or null
	const outsourceIdNum = outsourceId ? parseInt(outsourceId.toString(), 10) : null;


	if (analyticsKey === 'all') {
		try {
			const allResults: { [key: string]: any } = {};
			for (const funcKey in analyticsFunctions) {
				if (analyticsFunctions.hasOwnProperty(funcKey)) {
					const result = await analyticsFunctions[funcKey](tenantId, branchIdNum, startDate, endDate, yearNum, outsourceIdNum);
					allResults[funcKey] = result;
				}
			}
			return response.json(allResults);

		} catch (error: any) {
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
		} catch (error: any) {
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
	} catch (error: any) {
		return response.status(500).json({
			error: "Failed to retrieve function keys",
			details: error.message
		});
	}
}



export const handleSalesSummaryDailyBreakDown = async function (request: Request<{}, {}, {}, {
	tenantId: number,
	targetDate: string,
	fromDate: string,
	toDate: string
}>, response: Response): Promise<void> {
	try {
		const { tenantId, targetDate, fromDate, toDate } = request.query;
		const tennatId = parseInt(tenantId.toString());
		const responseData = await getDailyAnalyticsDashboard(tennatId, targetDate as string, fromDate as string, toDate as string);
		response.send(responseData);

	} catch (error: any) {
		response.status(500).json({
			error: "Failed to retrieve function keys",
			details: error.message
		});
	}
}