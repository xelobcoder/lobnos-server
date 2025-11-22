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


export async function UtilityFinancial(tenantId: number, key: string, branchid: number | null, startdate: string | Date, enddate: string | Date) {
	if (startdate && enddate) return await promisifyQuery(tenantId, BillingAnalyticsWithDate[key], [startdate, enddate])
	return await promisifyQuery(tenantId, BillingAnalytics[key])
}