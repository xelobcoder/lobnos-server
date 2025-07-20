import KnexConnection from "../../../../database/KnexConnections";
import { OperationsFailures } from "../../../../models/operations/types";
import { QUERY_DAILY_CEO_SNAPSHOT, QUERY_NIGHT_ADJUSTMENT_IMPACT, QUERY_TEST_TRANSACTION_SNAPSHOT, QUERY_TOP_PERFORMING_BRANCHES, QUERY_MISMATCHED_PAYMENT_HISTORY, QUERY_BREAK_DOWN_PAYMENT_MODES, QUERY_EMPLOYEES_COLLECTED_CASH, CLINCIAN_SALES_PAYMENT, query_daily_unique_clients_summary, ss_service_status_counts, ORGANIZATIONCOMMISSIONS } from "./queries";

interface DashboardSnapshot {
	dailyCeoSnapshot: any[];
	dailyUniqueClientsSummary: any[];
	serviceStatusCounts: any[];
	dailyNightAdjustmentImpact: any[];
	dailyTestTransactionSnapshot: any[];
	topPerformingBranches: any[];
	mismatchedPaymentHistory: any[];
	breakDownPaymentModes: any[];
	employeesWhoCollectedCash: any[];
	cliniciansalesdailyData: any[];
	OrganizationCommissions: any[];
}

export async function getDailyAnalyticsDashboard(
	tenantId: number,
	targetDate: string,
	fromDate: string = targetDate,
	toDate: string = targetDate
): Promise<DashboardSnapshot | OperationsFailures> {
	if (!fromDate || !toDate || new Date(fromDate) > new Date(toDate)) return OperationsFailures.invalidDateRange;

	const db = await KnexConnection(tenantId);
	const [
		dailyCeoSnapshot,
		serviceStatusCounts,
		OrganizationCommissions,
		dailyUniqueClientsSummary,
		dailyNightAdjustmentImpact,
		dailyTestTransactionSnapshot,
		topPerformingBranches,
		mismatchedPaymentHistory,
		breakDownPaymentModes,
		employeesWhoCollectedCash,
		cliniciansalesdailyData
	] = await Promise.all([
		db.raw(QUERY_DAILY_CEO_SNAPSHOT, [fromDate, toDate]),
		db.raw(ss_service_status_counts, [fromDate, toDate]),
		db.raw(ORGANIZATIONCOMMISSIONS, [fromDate, toDate]),
		db.raw(query_daily_unique_clients_summary, [fromDate, toDate]),
		db.raw(QUERY_NIGHT_ADJUSTMENT_IMPACT, [fromDate, toDate]),
		db.raw(QUERY_TEST_TRANSACTION_SNAPSHOT, [fromDate, toDate]),
		db.raw(QUERY_TOP_PERFORMING_BRANCHES, [fromDate, toDate]),
		db.raw(QUERY_MISMATCHED_PAYMENT_HISTORY, [fromDate, toDate]),
		db.raw(QUERY_BREAK_DOWN_PAYMENT_MODES, [fromDate, toDate]),
		db.raw(QUERY_EMPLOYEES_COLLECTED_CASH, [fromDate, toDate]),
		db.raw(CLINCIAN_SALES_PAYMENT, [fromDate, toDate])
	]);

	return {
		dailyCeoSnapshot: dailyCeoSnapshot[0][0],
		serviceStatusCounts: serviceStatusCounts[0][0],
		OrganizationCommissions: OrganizationCommissions[0][0],
		dailyUniqueClientsSummary: dailyUniqueClientsSummary[0][0],
		dailyNightAdjustmentImpact: dailyNightAdjustmentImpact[0][0],
		dailyTestTransactionSnapshot: dailyTestTransactionSnapshot[0][0],
		topPerformingBranches: topPerformingBranches[0][0],
		mismatchedPaymentHistory: mismatchedPaymentHistory[0][0],
		breakDownPaymentModes: breakDownPaymentModes[0][0],
		employeesWhoCollectedCash: employeesWhoCollectedCash[0][0],
		cliniciansalesdailyData: cliniciansalesdailyData[0][0]
	};
}
