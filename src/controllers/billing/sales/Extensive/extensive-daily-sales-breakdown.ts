import KnexConnection from "../../../../database/KnexConnections";
import { QUERY_DAILY_CEO_SNAPSHOT, QUERY_NIGHT_ADJUSTMENT_IMPACT, QUERY_TEST_TRANSACTION_SNAPSHOT, QUERY_TOP_PERFORMING_BRANCHES, QUERY_AUDIT_TRAIL_ACTIONS, QUERY_MISMATCHED_PAYMENT_HISTORY, QUERY_BREAK_DOWN_PAYMENT_MODES, QUERY_EMPLOYEES_COLLECTED_CASH, CLINCIAN_SALES_PAYMENT } from "./queries";

interface DashboardSnapshot {
  dailyCeoSnapshot: any[];
  dailyNightAdjustmentImpact: any[];
  dailyTestTransactionSnapshot: any[];
  topPerformingBranches: any[];
  auditTrailActions: any[];
  mismatchedPaymentHistory: any[];
  breakDownPaymentModes: any[];
  employeesWhoCollectedCash: any[];
    cliniciansalesdailyData: any[];
}

export async function getDailyAnalyticsDashboard(
  tenantId: number,
  targetDate: string,
  fromDate: string = targetDate,
  toDate: string = targetDate
): Promise<DashboardSnapshot> {
  const db = await KnexConnection(tenantId);

  const [
    dailyCeoSnapshot,
    dailyNightAdjustmentImpact,
    dailyTestTransactionSnapshot,
    topPerformingBranches,
    auditTrailActions,
    mismatchedPaymentHistory,
    breakDownPaymentModes,
    employeesWhoCollectedCash,
    cliniciansalesdailyData
  ] = await Promise.all([
    db.raw(QUERY_DAILY_CEO_SNAPSHOT, [fromDate, toDate]),
    db.raw(QUERY_NIGHT_ADJUSTMENT_IMPACT, [fromDate, toDate]),
    db.raw(QUERY_TEST_TRANSACTION_SNAPSHOT, [fromDate, toDate]),
    db.raw(QUERY_TOP_PERFORMING_BRANCHES, [fromDate,toDate]),
    db.raw(QUERY_AUDIT_TRAIL_ACTIONS, [fromDate,toDate]),
    db.raw(QUERY_MISMATCHED_PAYMENT_HISTORY, [fromDate,toDate]),
    db.raw(QUERY_BREAK_DOWN_PAYMENT_MODES, [fromDate,toDate]),
    db.raw(QUERY_EMPLOYEES_COLLECTED_CASH, [fromDate,toDate]),
    db.raw(CLINCIAN_SALES_PAYMENT,[fromDate,toDate])
  ]);

  return {
    dailyCeoSnapshot: dailyCeoSnapshot[0],
    dailyNightAdjustmentImpact: dailyNightAdjustmentImpact[0],
    dailyTestTransactionSnapshot: dailyTestTransactionSnapshot[0],
    topPerformingBranches: topPerformingBranches[0],
    auditTrailActions: auditTrailActions[0],
    mismatchedPaymentHistory: mismatchedPaymentHistory[0],
    breakDownPaymentModes: breakDownPaymentModes[0],
    employeesWhoCollectedCash: employeesWhoCollectedCash[0],
    cliniciansalesdailyData:cliniciansalesdailyData[0]
  };
}
