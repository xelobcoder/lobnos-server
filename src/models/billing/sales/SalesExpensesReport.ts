import Decimal from 'decimal.js';
import { Knex } from 'knex';
import KnexConnection from '../../../database/KnexConnections';

export class SalesReportError extends Error {
     constructor(public readonly statusCode: number, message: string) { super(message); }
}

export interface SalesReportFilters {
     branchid: number;
     from: string;
     to: string;
     start: string;
     end: string;
}

/** Calendar dates in the database's local calendar, not JavaScript/server timezone boundaries. */
export function parseSalesReportFilters(query: Record<string, unknown>): SalesReportFilters {
     const date = (value: unknown): string => {
          if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
               throw new SalesReportError(400, 'from and to must be valid YYYY-MM-DD dates');
          }
          const parsed = new Date(`${value}T00:00:00Z`);
          // MySQL DATETIME supports years 1000 through 9999. Reserve a representable next-day bound.
          if (value < '1000-01-01' || value >= '9999-12-31' || !Number.isFinite(parsed.getTime()) ||
               parsed.toISOString().slice(0, 10) !== value) {
               throw new SalesReportError(400, 'from and to must be valid YYYY-MM-DD dates');
          }
          return value;
     };
     const from = date(query.from);
     const to = date(query.to);
     if (from > to) throw new SalesReportError(400, 'from must not exceed to');
     if (typeof query.branchid !== 'string' || !/^[1-9]\d*$/.test(query.branchid) ||
          !Number.isSafeInteger(Number(query.branchid))) {
          throw new SalesReportError(400, 'branchid must be a positive integer');
     }
     const next = new Date(`${to}T00:00:00Z`);
     next.setUTCDate(next.getUTCDate() + 1);
     return { branchid: Number(query.branchid), from, to, start: `${from} 00:00:00`, end: `${next.toISOString().slice(0, 10)} 00:00:00` };
}

export interface ReportTransaction {
     billingId: number; date: string; patientId: number; patientName: string; source: string;
     gross: number; discount: number; net: number; paid: number; outstanding: number;
}
export interface ReportReceipt {
     id: number | string; date: string; billingId: number; patientName: string; method: string; amount: number;
     cashier?: string;
     type?: 'receipt' | 'refund';
     source?: 'billinghx' | 'organization_invoice';
}
export interface ReportExpense {
     id: number | string; date: string; description: string; category: string; payee: string; method: string; amount: number;
}
export interface SalesExpensesReport {
     from: string; to: string; generatedAt: string;
     branch: { id: number | string; name: string };
     company: {
          name?: string; motto?: string; address?: string; street?: string; email?: string; website?: string;
          phonenumber?: string | number; alternativenumber?: string | number;
     };
     summary: {
          clients: number; transactions: number; grossSales: number; discounts: number; netSales: number;
          receipts: number; expensePayments: number; netCashMovement: number; outstanding: number;
          receiptCredits?: number; receiptRefunds?: number;
     };
     inlineServices?: Array<{billingId:number;serviceId:number;name:string;department:string;amount:number;paid:number;outstanding:number}>;
     transactions: ReportTransaction[];
     receipts: ReportReceipt[];
     expenses: ReportExpense[];
     outstanding: Array<{ billingId: number; date: string; patientName: string; source: string; organizationName: string; amount: number }>;
     paymentMethods: Array<{ method: string; amount: number }>;
     outstandingBySource: Array<{ source: string; amount: number }>;
     notes: string[];
}

const patientName = "TRIM(CONCAT_WS(' ', patient.firstname, patient.middlename, patient.lastname))";
const sourceLabels: Record<string, string> = {
     self: 'Self', organization: 'Organization', clinician: 'Clinician', phis: 'PHIS', nhis: 'NHIS',
};

function validService(query: Knex.QueryBuilder, alias: string) {
     query.where(function () { this.where(`${alias}.isDeleted`, 0).orWhereNull(`${alias}.isDeleted`); })
          .whereIn(`${alias}.status`, ['active', 'refunded', 'written-off']);
}

function periodBills(query: Knex.QueryBuilder, filters: SalesReportFilters) {
     query.where('bill.branchid', filters.branchid)
          .where('bill.billedon', '>=', filters.start).where('bill.billedon', '<', filters.end)
          .where(function () { this.whereNull('bill.status').orWhereNotIn('bill.status', ['voided', 'corrected', 'written-off']); })
          .where(function () {
               // Header-only legacy bills remain visible; bills whose services are ALL deleted/void/cancelled do not.
               this.whereNotExists(function () {
                    this.select('any_service.serviceid').from('dboservices as any_service')
                         .whereRaw('any_service.billingid = bill.billingid');
               }).orWhereExists(function () {
                    this.select('live_service.serviceid').from('dboservices as live_service')
                         .whereRaw('live_service.billingid = bill.billingid');
                    validService(this, 'live_service');
               });
          });
     return query;
}

/** Separate detail queries: never join service, receipt and expense details into one aggregate. */
export function salesReportQueries(db: Knex, filters: SalesReportFilters, organizationPayments: boolean) {
     const bills = periodBills(db('billing as bill'), filters)
          .leftJoin('new_patients as patient', 'patient.patientid', 'bill.patientid')
          .select('bill.billingid', 'bill.patientid', 'bill.totalcost', 'bill.discount', 'bill.payable', 'bill.paid', 'bill.outstanding',
               db.raw("DATE_FORMAT(bill.billedon, '%Y-%m-%d') as date"), db.raw(`${patientName} as patientName`))
          .orderBy('bill.billedon').orderBy('bill.billingid');
     const services = periodBills(db('billing as bill'), filters)
          .join('dboservices as service', 'service.billingid', 'bill.billingid')
          .leftJoin('organization as organization', 'organization.id', 'service.organizationId')
          .select('bill.billingid', 'service.registrationType', 'organization.name as organizationName').distinct();
     validService(services, 'service');

     const receipts = db('billinghx as receipt')
          .join('billing as bill', 'bill.billingid', 'receipt.Billingid')
          .leftJoin('new_patients as patient', 'patient.patientid', 'bill.patientid')
          .leftJoin('paymentmodes as mode', 'mode.KeyID', 'receipt.PaymentMode')
          .where('bill.branchid', filters.branchid)
          .where(function () { this.where('receipt.isVoided', 0).orWhereNull('receipt.isVoided'); })
          .whereIn('receipt.type', ['credit', 'debit'])
          .select('receipt.KeyID as id', 'bill.billingid', 'receipt.type', 'receipt.Amount as amount',
               'mode.PaymentMode as method', db.raw(`${patientName} as patientName`));
     // Invoice allocations can have multiple service lines per history row. Collapse BEFORE joining.
     // billinghx.Date is recording time for this workflow, NOT the supplied actual payment date.
     if (organizationPayments) {
          const dates = db('org_invoice_payment_allocations as allocation')
               .join('org_invoice_payments as payment', 'payment.id', 'allocation.payment_id')
               .whereNotNull('allocation.billinghx_id')
               .select('allocation.billinghx_id').min('payment.payment_date as paymentDate')
               .groupBy('allocation.billinghx_id').as('invoice_payment');
          receipts.leftJoin(dates, 'invoice_payment.billinghx_id', 'receipt.KeyID');
     }
     const receiptDate = organizationPayments ? 'COALESCE(invoice_payment.paymentDate, receipt.Date)' : 'receipt.Date';
     receipts.whereRaw(`${receiptDate} >= ?`, [filters.start]).whereRaw(`${receiptDate} < ?`, [filters.end])
          .select(db.raw(`DATE_FORMAT(${receiptDate}, '%Y-%m-%d') as date`),
               db.raw(organizationPayments
                    ? "CASE WHEN invoice_payment.billinghx_id IS NULL THEN 'billinghx' ELSE 'organization_invoice' END as source"
                    : "'billinghx' as source"))
          .orderByRaw(`${receiptDate} ASC`).orderBy('receipt.KeyID');
     // Do not exclude a real receipt/refund because its BILL is now voided, corrected or written off.
     // In particular, a void writes a debit that must offset its original credit.
     const expenses = db('expense_payments as payment')
          .join('expensesrecord as expense', 'expense.id', 'payment.expense_id')
          .leftJoin('dboexpensecategory as category', 'category.id', 'expense.category')
          // merchant is a legacy VARCHAR; avoid MySQL's coercion matching "12foo" to merchant 12.
          .leftJoin('expense_merchants as merchant', function () {
               this.on(db.raw('CAST(merchant.id AS CHAR) = ??', ['expense.merchant']));
          })
          .where('expense.branchid', filters.branchid)
          .where('payment.payment_date', '>=', filters.start).where('payment.payment_date', '<', filters.end)
          .where('payment.status', 'Paid').where('payment.is_reversed', 0)
          .select('payment.id', 'payment.amount', 'payment.method', 'expense.description', 'expense.name',
               'category.category', db.raw("COALESCE(merchant.name, expense.merchant, '') as payee"),
               db.raw("DATE_FORMAT(payment.payment_date, '%Y-%m-%d') as date"))
          .orderBy('payment.payment_date').orderBy('payment.id');
     return { bills, services, receipts, expenses };
}

const money = (value: unknown) => new Decimal(value == null ? 0 : String(value)).toDecimalPlaces(2);
const sum = (rows: any[], field: string) => rows.reduce((total: Decimal, row) => total.plus(money(row[field])), new Decimal(0));
const number = (value: Decimal) => {
     // The wire contract uses JSON numbers. Fail closed rather than silently lose integer cents.
     if (!value.isFinite() || value.abs().times(100).gt(Number.MAX_SAFE_INTEGER)) throw new Error('Report amount exceeds supported precision');
     return value.toNumber();
};

function breakdown(rows: any[], key: string) {
     const groups = new Map<string, Decimal>();
     for (const row of rows) groups.set(row[key], (groups.get(row[key]) || new Decimal(0)).plus(money(row.amount)));
     return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, amount]) => ({ [key]: label, amount: number(amount) }));
}

export function assembleSalesReport(
     filters: SalesReportFilters, branch: any, company: SalesExpensesReport['company'],
     bills: any[], services: any[], receiptRows: any[], expenseRows: any[],
): SalesExpensesReport {
     const metadata = new Map<number, { sources: Set<string>; organizations: Set<string> }>();
     for (const service of services) {
          const id = Number(service.billingid);
          const item = metadata.get(id) || { sources: new Set<string>(), organizations: new Set<string>() };
          item.sources.add(sourceLabels[service.registrationType] || 'Unknown');
          if (service.organizationName) item.organizations.add(service.organizationName);
          metadata.set(id, item);
     }
     const transactions = bills.map((bill): ReportTransaction => {
          const sources = [...(metadata.get(Number(bill.billingid))?.sources || [])].sort();
          return {
               billingId: Number(bill.billingid), date: bill.date, patientId: Number(bill.patientid),
               patientName: bill.patientName || '', source: sources.length > 1 ? `Mixed (${sources.join(', ')})` : sources[0] || 'Unknown',
               gross: number(money(bill.totalcost)), discount: number(money(bill.discount)), net: number(money(bill.payable)),
               paid: number(money(bill.paid)), outstanding: number(Decimal.max(0, money(bill.outstanding))),
          };
     });
     const receipts: ReportReceipt[] = receiptRows.map(row => ({
          id: row.id, date: row.date, billingId: Number(row.billingid), patientName: row.patientName || '',
          method: row.method || 'Unknown', amount: number(row.type === 'debit' ? money(row.amount).negated() : money(row.amount)),
          type: row.type === 'debit' ? 'refund' : 'receipt', source: row.source,
          ...(row.cashier!==undefined?{cashier:String(row.cashier||'Unassigned')}:{}),
     }));
     const expenses: ReportExpense[] = expenseRows.map(row => ({
          id: row.id, date: row.date, description: row.description || row.name || '', category: row.category || 'Uncategorized',
          payee: row.payee || '', method: row.method || 'Unknown', amount: number(money(row.amount)),
     }));
     const outstanding = transactions.filter(row => row.outstanding > 0).map(row => ({
          billingId: row.billingId, date: row.date, patientName: row.patientName, source: row.source, amount: row.outstanding,
          organizationName: [...(metadata.get(row.billingId)?.organizations || [])].sort().join(', '),
     }));
     const receiptTotal = sum(receipts, 'amount');
     const expenseTotal = sum(expenses, 'amount');
     return {
          from: filters.from, to: filters.to, generatedAt: new Date().toISOString(),
          branch: { id: branch.branchid, name: branch.name }, company: company || {},
          summary: {
               clients: new Set(transactions.map(row => row.patientId)).size, transactions: transactions.length,
               grossSales: number(sum(bills, 'totalcost')), discounts: number(sum(bills, 'discount')), netSales: number(sum(bills, 'payable')),
               receipts: number(receiptTotal), expensePayments: number(expenseTotal), netCashMovement: number(receiptTotal.minus(expenseTotal)),
               outstanding: number(sum(outstanding, 'amount')),
               receiptCredits: number(sum(receipts.filter(row => row.type === 'receipt'), 'amount')),
               receiptRefunds: number(sum(receipts.filter(row => row.type === 'refund'), 'amount').negated()),
          },
          transactions, receipts, expenses, outstanding,
          paymentMethods: breakdown(receipts, 'method') as SalesExpensesReport['paymentMethods'],
          outstandingBySource: breakdown(outstanding, 'source') as SalesExpensesReport['outstandingBySource'],
          notes: [
               'Dates are inclusive database-local calendar dates; generatedAt is UTC. Detail arrays are complete, not paginated.',
               'Sales and unique clients use bills created in the period. Gross, discounts and net are stored bill totals; net includes stored tax, adjustments and completed refund reductions, so gross minus discounts need not equal net.',
               'Voided, corrected and written-off bills and bills with only deleted/cancelled/voided services are excluded from sales. Refunded services retain their persisted remaining values; refunds are not deducted from sales a second time.',
               'Paid and outstanding are CURRENT balances on period bills, not balances as of the end date. Overpayment credits are not negative outstanding.',
               'Source is derived from non-deleted active/refunded/written-off services. Mixed-source bills remain one transaction and one outstanding item; their balances are not arbitrarily allocated between sources.',
               'Receipts use non-voided billinghx credits minus debits by payment date, including older bills and cash movements on subsequently voided bills. Linked organization invoice receipts use org_invoice_payments.payment_date, not history recording time; allocations and refund tracking are never counted again.',
               'receiptCredits minus receiptRefunds equals receipts. Refund rows have negative amounts; paymentMethods is the signed receipt breakdown, not the expense-method breakdown.',
               'Expenses are actual Paid, non-reversed expense_payments by payment_date and expense branch, including payments for older expenses. Expense creation/approval dates and unpaid expense amounts are not included. Reversals are excluded on current status, not reconstructed historically.',
               'Expense branch ownership is expensesrecord.branchid (required by the schema), not the nullable expense_payments.branchid or a shared payment account. Legacy payments with no payment branch are included only when their parent expense belongs to this branch. Other-branch expenses, orphan payments and any legacy expense without an assigned branch are excluded; facility-wide/unallocated expenses are not apportioned to this branch.',
               'Net cash movement is receipts minus expense payments, not accounting profit or an opening/closing cash balance. No currency conversion is performed.',
          ],
     };
}

export class SalesExpensesReportService {
     constructor(private readonly tenantId: number) { }

     async generate(query: Record<string, unknown>): Promise<SalesExpensesReport> {
          const filters = parseSalesReportFilters(query);
          if (!Number.isSafeInteger(this.tenantId) || this.tenantId <= 0) throw new SalesReportError(403, 'Invalid session organization');
          const db = await KnexConnection(this.tenantId);
          // One connection and a repeatable-read snapshot for all financial/detail/branding reads.
          // No bootstrap helpers: this endpoint must never create, migrate or update anything.
          return db.transaction(async trx => {
               const branch = await trx('branch').select('branchid', 'name').where('branchid', filters.branchid).first();
               if (!branch) throw new SalesReportError(404, 'Branch not found');
               const company = await trx('companyprofile').select(
                    'NAME as name', 'MOTTO as motto', 'ADDRESS as address', 'STREET as street', 'EMAIL as email',
                    'WEBSITE as website', 'PHONENUMBER as phonenumber', 'ALTERNATIVENUMBER as alternativenumber',
               ).orderBy('ID').first();
               const organizationPayments = await trx.schema.hasTable('org_invoice_payment_allocations') &&
                    await trx.schema.hasTable('org_invoice_payments');
               const queries = salesReportQueries(trx, filters, organizationPayments);
               // Sequential reads intentionally use the same transaction connection.
               const bills = await queries.bills;
               const services = await queries.services;
               if(query.inlineDetails==='true')queries.receipts.leftJoin('roles as cashier','cashier.employeeid','receipt.employeeid').select('cashier.username as cashier');
               const receipts = await queries.receipts;
               const expenses = await queries.expenses;
               const report=assembleSalesReport(filters, branch, company, bills, services, receipts, expenses);
               if(query.inlineDetails==='true'){
                    const serviceQuery=periodBills(trx('billing as bill'),filters).join('dboservices as service','service.billingid','bill.billingid')
                         .leftJoin('test_panels as panel',function(){this.on('panel.id','=','service.trackId').andOnVal('service.serviceCategory','<>','SERVICES');})
                         .leftJoin('additionalservices as additional',function(){this.on('additional.keyid','=','service.trackId').andOnVal('service.serviceCategory','=','SERVICES');})
                         .leftJoin('departments as department','department.id','panel.category')
                         .select('bill.billingid','service.serviceid','service.totalpayable','service.paidamount','service.outstanding','panel.name as panelName','additional.serviceName','department.department');
                    validService(serviceQuery,'service');
                    report.inlineServices=(await serviceQuery).map((row:any)=>({billingId:Number(row.billingid),serviceId:Number(row.serviceid),name:row.serviceName||row.panelName||'Unnamed service',department:row.department||'Other services',amount:number(money(row.totalpayable)),paid:number(money(row.paidamount)),outstanding:number(money(row.outstanding))}));
               }
               return report;
          // MariaDB rejects Knex's combined "ISOLATION LEVEL ... READ ONLY" statement; this service only reads.
          }, { isolationLevel: 'repeatable read' });
     }
}
