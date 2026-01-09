import KnexConnection from "../../../../database/KnexConnections";
import { OperationsFailures } from "../../../../models/operations/types";
import {
	QUERY_DAILY_CEO_SNAPSHOT,
	QUERY_NIGHT_ADJUSTMENT_IMPACT,
	QUERY_TEST_TRANSACTION_SNAPSHOT,
	QUERY_TOP_PERFORMING_BRANCHES,
	QUERY_MISMATCHED_PAYMENT_HISTORY,
	QUERY_BREAK_DOWN_PAYMENT_MODES,
	QUERY_EMPLOYEES_COLLECTED_CASH,
	CLINCIAN_SALES_PAYMENT,
	QUERY_TOTAL_EXPENSES_PERIOD_COMPARISON,
	QUERY_ALL_EXPENSE_CATEGORIES,
	QUERY_EXPENSE_APPROVAL_STATUS_SUMMARY,
	QUERY_EXPENSE_PAYMENTS_SUMMARY,
	QUERY_EXPENSE_PAYMENTS_FULL_LIST,
	QUERY_BILLABLE_EXPENSES,
	QUERY_MONTHLY_EXPENSE_TREND,
	QUERY_ALL_INDIVIDUAL_EXPENSES,
	QUERY_UNAPPROVED_EXPENSES_PERIOD,
	QUERY_EXPENSES_BY_BRANCH,
	QUERY_CEO_EXPENSE_SUMMARY_SNAPSHOT
} from "./queries";

interface DashboardSnapshot {
	dailyCeoSnapshot: any[];
	dailyNightAdjustmentImpact: any[];
	dailyTestTransactionSnapshot: any[];
	topPerformingBranches: any[];
	mismatchedPaymentHistory: any[];
	breakDownPaymentModes: any[];
	employeesWhoCollectedCash: any[];
	cliniciansalesdailyData: any[];
	totalExpensesPeriodComparison: any[];
	allExpenseCategories: any[];
	expenseApprovalStatusSummary: any[];
	expensePaymentsSummary: any[];
	expensePaymentsFullList: any[];
	billableExpenses: any[];
	monthlyExpenseTrend: any[];
	allIndividualExpenses: any[];
	unapprovedExpensesPeriod: any[];
	expensesByBranch: any[];
	ceoExpenseSummarySnapshot: any[];
}

export async function getDailyAnalyticsDashboard(
	tenantId: number,
	targetDate: string,
	fromDate: string = targetDate,
	toDate: string = targetDate
): Promise<DashboardSnapshot | OperationsFailures> {
	try {
		console.log({ fromDate, toDate });
		if (!fromDate || !toDate || !(new Date(fromDate) <= new Date(toDate))) return OperationsFailures.invalidDateRange;
		const db = await KnexConnection(tenantId);
		const [
			dailyCeoSnapshot,
			dailyNightAdjustmentImpact,
			dailyTestTransactionSnapshot,
			topPerformingBranches,
			mismatchedPaymentHistory,
			breakDownPaymentModes,
			employeesWhoCollectedCash,
			cliniciansalesdailyData,
			totalExpensesPeriodComparison,
			allExpenseCategories,
			expenseApprovalStatusSummary,
			expensePaymentsSummary,
			expensePaymentsFullList,
			billableExpenses,
			monthlyExpenseTrend,
			allIndividualExpenses,
			unapprovedExpensesPeriod,
			expensesByBranch,
			ceoExpenseSummarySnapshot
		] = await Promise.all([
			db.raw(QUERY_DAILY_CEO_SNAPSHOT, [fromDate, toDate, fromDate, toDate, fromDate, toDate]),
			db.raw(QUERY_NIGHT_ADJUSTMENT_IMPACT, [fromDate, toDate]),
			db.raw(QUERY_TEST_TRANSACTION_SNAPSHOT, [fromDate, toDate]),
			db.raw(QUERY_TOP_PERFORMING_BRANCHES, [fromDate, toDate]),
			db.raw(QUERY_MISMATCHED_PAYMENT_HISTORY, [fromDate, toDate]),
			db.raw(QUERY_BREAK_DOWN_PAYMENT_MODES, [fromDate, toDate]),
			db.raw(QUERY_EMPLOYEES_COLLECTED_CASH, [fromDate, toDate]),
			db.raw(CLINCIAN_SALES_PAYMENT, [fromDate, toDate]),
			db.raw(QUERY_TOTAL_EXPENSES_PERIOD_COMPARISON, [fromDate, toDate, fromDate, toDate, fromDate, fromDate]),
			db.raw(QUERY_ALL_EXPENSE_CATEGORIES, [fromDate, toDate, fromDate, toDate]),
			db.raw(QUERY_EXPENSE_APPROVAL_STATUS_SUMMARY, [fromDate, toDate]),
			db.raw(QUERY_EXPENSE_PAYMENTS_SUMMARY, [fromDate, toDate]),
			db.raw(QUERY_EXPENSE_PAYMENTS_FULL_LIST, [fromDate, toDate]),
			db.raw(QUERY_BILLABLE_EXPENSES, [fromDate, toDate]),
			db.raw(QUERY_MONTHLY_EXPENSE_TREND, [fromDate, toDate]),
			db.raw(QUERY_ALL_INDIVIDUAL_EXPENSES, [fromDate, toDate]),
			db.raw(QUERY_UNAPPROVED_EXPENSES_PERIOD, [toDate, fromDate, toDate]),
			db.raw(QUERY_EXPENSES_BY_BRANCH, [fromDate, toDate, fromDate, toDate]),
			db.raw(QUERY_CEO_EXPENSE_SUMMARY_SNAPSHOT, [fromDate, toDate, fromDate, toDate, fromDate, toDate, fromDate, toDate, fromDate, toDate, fromDate, toDate, fromDate, toDate])
		]);

		return {
			dailyCeoSnapshot: dailyCeoSnapshot[0],
			dailyNightAdjustmentImpact: dailyNightAdjustmentImpact[0],
			dailyTestTransactionSnapshot: dailyTestTransactionSnapshot[0],
			topPerformingBranches: topPerformingBranches[0],
			mismatchedPaymentHistory: mismatchedPaymentHistory[0],
			breakDownPaymentModes: breakDownPaymentModes[0],
			employeesWhoCollectedCash: employeesWhoCollectedCash[0],
			cliniciansalesdailyData: cliniciansalesdailyData[0],
			totalExpensesPeriodComparison: totalExpensesPeriodComparison[0],
			allExpenseCategories: allExpenseCategories[0],
			expenseApprovalStatusSummary: expenseApprovalStatusSummary[0],
			expensePaymentsSummary: expensePaymentsSummary[0],
			expensePaymentsFullList: expensePaymentsFullList[0],
			billableExpenses: billableExpenses[0],
			monthlyExpenseTrend: monthlyExpenseTrend[0],
			allIndividualExpenses: allIndividualExpenses[0],
			unapprovedExpensesPeriod: unapprovedExpensesPeriod[0],
			expensesByBranch: expensesByBranch[0],
			ceoExpenseSummarySnapshot: ceoExpenseSummarySnapshot[0],
		};
	} catch (error) {
		console.error('Error in getDailyAnalyticsDashboard:', error);
		return { message: "Database query failed", statusCode: 500, status: "error" } as any;
	}
}
