import KnexConnection from '../../../database/KnexConnections';
import { salesClosurePredicate } from './SalesClosure';
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


export async function UtilityFinancial(tenantId: number, key: Exclude<keyof typeof BillingAnalytics & keyof typeof BillingAnalyticsWithDate, 'prototype'>, branchid: number | null, startdate: string | Date | null, enddate: string | Date | null) {
	const isDateKey = ['dailySalesTrend', 'totalSalesByOutsourcedStatus', 'salesByWeekAndBranch'].includes(key);
	const year = startdate ? new Date(startdate).getFullYear() : new Date().getFullYear();
	if (key === 'monthlySalesTrend') {
		return await promisifyQuery(tenantId, await scopeClosedFinancialQuery(tenantId, BillingAnalyticsWithDate[key], branchid), [year, year]);
	} else if (key === 'yearlySalesTrend') {
		return await promisifyQuery(tenantId, await scopeClosedFinancialQuery(tenantId, BillingAnalyticsWithDate[key], branchid), [year, year]);
	} else if (key === 'weeklySalesTrend') {
		return await promisifyQuery(tenantId, await scopeClosedFinancialQuery(tenantId, BillingAnalytics[key], branchid), [year, year]);
	} else if (startdate && enddate && isDateKey) {
		const params = key === 'dailySalesTrend' ? [startdate, enddate, startdate, enddate] : [startdate, enddate];
		return await promisifyQuery(tenantId, await scopeClosedFinancialQuery(tenantId, BillingAnalyticsWithDate[key], branchid), params);
	}
	return await promisifyQuery(tenantId, await scopeClosedFinancialQuery(tenantId, BillingAnalytics[key], branchid), [year])
}
/** Apply the authenticated branch to legacy SQL without accepting identifiers from request text. */
export function scopeFinancialQuery(sql: string, branchid: number | null, closure = '1=1'): string {
     if (branchid !== null && (!Number.isSafeInteger(branchid) || branchid <= 0)) throw new Error('Invalid financial report branch');
     const branch = branchid === null ? '1=1' : 'branchid = ' + branchid;
     const bills = `SELECT bill.billingid FROM billing bill WHERE ${branchid === null ? '1=1' : 'bill.branchid = ' + branchid} AND ${closure}`;
     return sql.replace(/FROM dboservices(?: AS (\w+))?(?=\s)/g, (_match, alias) =>
          `FROM (SELECT * FROM dboservices WHERE ${branch} AND billingid IN (${bills})) AS ` + (alias || 'dboservices'))
          .replace(/FROM billing AS bill/g, `FROM (SELECT * FROM billing WHERE billingid IN (${bills})) AS bill`)
          .replace(/FROM expense_payments(?=\s)/g, `FROM (SELECT * FROM expense_payments WHERE expense_id IN (SELECT id FROM expensesrecord WHERE ${branch})) AS expense_payments`)
          .replace(/FROM billinghx AS receipt/g, `FROM (SELECT * FROM billinghx WHERE Billingid IN (${bills})) AS receipt`);
}

export async function scopeClosedFinancialQuery(tenantId: number, sql: string, branchid: number | null): Promise<string> {
     const db = await KnexConnection(tenantId);
     return scopeFinancialQuery(sql, branchid, await salesClosurePredicate(db));
}

export function financialTrendQuery(period: 'daily' | 'weekly' | 'monthly' | 'yearly', organizationPayments = false): string {
     const formats = { daily: '%Y-%m-%d', weekly: '%x-W%v', monthly: '%Y-%m', yearly: '%Y' };
     const label = { daily: 'date', weekly: 'week', monthly: 'month', yearly: 'year' };
     const receiptDate = organizationPayments
          ? 'COALESCE((SELECT MIN(payment.payment_date) FROM org_invoice_payment_allocations allocation JOIN org_invoice_payments payment ON payment.id = allocation.payment_id WHERE allocation.billinghx_id = receipt.KeyID), receipt.Date)'
          : 'receipt.Date';
     const format = formats[period];
     return `WITH sales AS (
          SELECT DATE_FORMAT(bill.billedon, '${format}') AS period,
               SUM(ROUND(bill.totalcost, 2)) AS gross_revenue, SUM(ROUND(bill.payable, 2)) AS earned_revenue,
               SUM(ROUND(bill.discount, 2)) AS discount, SUM(ROUND(bill.outstanding, 2)) AS outstanding
          FROM billing AS bill
          WHERE bill.billedon >= ? AND bill.billedon < DATE_ADD(DATE(?), INTERVAL 1 DAY)
               AND (bill.status IS NULL OR bill.status NOT IN ('voided','corrected','written-off'))
               AND (NOT EXISTS (SELECT 1 FROM \`dboservices\` AS any_service WHERE any_service.billingid = bill.billingid)
                    OR EXISTS (SELECT 1 FROM \`dboservices\` AS live_service WHERE live_service.billingid = bill.billingid
                         AND live_service.status IN ('active','refunded','written-off') AND COALESCE(live_service.isDeleted,0) = 0))
          GROUP BY period
     ), receipts AS (
          SELECT DATE_FORMAT(${receiptDate}, '${format}') AS period,
               SUM(CASE WHEN receipt.type = 'credit' THEN ROUND(receipt.Amount, 2) ELSE -ROUND(receipt.Amount, 2) END) AS cash_collected,
               SUM(CASE WHEN receipt.type = 'debit' THEN ROUND(receipt.Amount, 2) ELSE 0 END) AS total_refunded
          FROM billinghx AS receipt
          WHERE ${receiptDate} >= ? AND ${receiptDate} < DATE_ADD(DATE(?), INTERVAL 1 DAY)
               AND (receipt.isVoided = 0 OR receipt.isVoided IS NULL) AND receipt.type IN ('credit','debit')
          GROUP BY period
     ), expenses AS (
          SELECT DATE_FORMAT(payment_date, '${format}') AS period, SUM(ROUND(amount, 2)) AS expenses_paid
          FROM expense_payments WHERE payment_date >= ? AND payment_date < DATE_ADD(DATE(?), INTERVAL 1 DAY)
               AND status = 'Paid' AND is_reversed = 0 GROUP BY period
     ), periods AS (SELECT period FROM sales UNION SELECT period FROM receipts UNION SELECT period FROM expenses)
     SELECT p.period AS ${label[period]}, COALESCE(s.gross_revenue, 0) AS gross_revenue,
          COALESCE(s.earned_revenue, 0) AS earned_revenue, COALESCE(s.discount, 0) AS discount,
          COALESCE(s.outstanding, 0) AS outstanding, COALESCE(r.cash_collected, 0) AS cash_collected,
          COALESCE(r.total_refunded, 0) AS total_refunded, COALESCE(e.expenses_paid, 0) AS expenses_paid,
          COALESCE(r.cash_collected, 0) - COALESCE(e.expenses_paid, 0) AS net_operating_cash
     FROM periods p LEFT JOIN sales s ON s.period = p.period
     LEFT JOIN receipts r ON r.period = p.period LEFT JOIN expenses e ON e.period = p.period ORDER BY p.period DESC`;
}
