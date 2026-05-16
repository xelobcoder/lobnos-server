import { promisifyQuery } from '../../../hooks/helper';
import { BillingAnalytics, BillingAnalyticsWithDate } from '../billingAnalqueries';

export default class FinancialAnalyticsPrimeLabSystem {
	readonly branchid: number | null;
	private tenantId: number


	constructor(branchid: number, tenantId: number) {
		this.branchid = branchid;
		this.tenantId = tenantId;
	}
}


export async function UtilityFinancial(tenantId: number, key: string, branchid: number | null, startdate: string | Date | null, enddate: string | Date | null) {
	const isDateKey = ['dailySalesTrend'].includes(key);
	const year = startdate ? new Date(startdate).getFullYear() : new Date().getFullYear();
	if (key === 'monthlySalesTrend') {
		return await promisifyQuery(tenantId, BillingAnalyticsWithDate[key], [year, year]);
	} else if (key === 'yearlySalesTrend') {
		return await promisifyQuery(tenantId, BillingAnalyticsWithDate[key], [year, year]);
	} else if (key === 'weeklySalesTrend') {
		return await promisifyQuery(tenantId, BillingAnalytics[key], [year, year]);
	} else if (startdate && enddate && isDateKey) {
		const params = [startdate, enddate, startdate, enddate];
		return await promisifyQuery(tenantId, BillingAnalyticsWithDate[key], params);
	}
	return await promisifyQuery(tenantId, BillingAnalytics[key], [year])
}