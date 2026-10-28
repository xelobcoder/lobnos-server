import knex from 'knex';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { connectionMock } = vi.hoisted(() => ({ connectionMock: vi.fn() }));
vi.mock('../../../database/KnexConnections', () => ({ default: connectionMock }));
import { assembleSalesReport, parseSalesReportFilters, salesReportQueries, SalesExpensesReportService } from './SalesExpensesReport';

const query = { branchid: '2', from: '2026-10-01', to: '2026-10-19' };
const filters = parseSalesReportFilters(query);
const branch = { branchid: 2, name: 'Main' };
const bills = [
     { billingid: 1, patientid: 7, patientName: 'Test Patient', date: '2026-10-01', totalcost: '100.00', discount: '10.00', payable: '99.00', paid: '40.00', outstanding: '59.00' },
     { billingid: 2, patientid: 7, patientName: 'Test Patient', date: '2026-10-19', totalcost: '0.30', discount: '0.00', payable: '0.30', paid: '0.10', outstanding: '0.20' },
];
const services = [
     { billingid: 1, registrationType: 'self' },
     { billingid: 1, registrationType: 'self' },
     { billingid: 2, registrationType: 'organization', organizationName: 'Test Organization' },
];
const receiptRows = [
     { id: 11, billingid: 1, patientName: 'Test Patient', date: '2026-10-01', type: 'credit', amount: '40.00', method: 'Cash', source: 'billinghx' },
     { id: 12, billingid: 99, patientName: 'Older Bill', date: '2026-10-19', type: 'credit', amount: '70.00', method: 'Mobile Money', source: 'organization_invoice' },
     { id: 13, billingid: 99, patientName: 'Older Bill', date: '2026-10-19', type: 'debit', amount: '10.00', method: 'Cash', source: 'billinghx' },
];
const expenseRows = [
     { id: 21, date: '2026-10-01', description: 'Supplies', category: 'Consumables', payee: 'Vendor', method: 'cash', amount: '25.10' },
     { id: 22, date: '2026-10-19', description: 'Supplies', category: 'Consumables', payee: 'Vendor', method: 'cash', amount: '0.20' },
];

describe('sales report calendar validation', () => {
     beforeEach(() => vi.clearAllMocks());
     it.each([
          ['2024-02-29', '2024-03-01 00:00:00'],
          ['2026-12-31', '2027-01-01 00:00:00'],
          ['2026-10-19', '2026-10-20 00:00:00'],
     ])('includes the entire end day %s using an exclusive next-day bound', (to, end) => {
          expect(parseSalesReportFilters({ branchid: '2', from: to, to })).toMatchObject({ start: `${to} 00:00:00`, end });
     });
     it.each([
          { from: '2026-02-29' }, { to: '2026-04-31' }, { from: '2026-1-01' },
          { to: '2026-10-19T00:00:00Z' }, { from: ['2026-10-01'] }, { to: undefined },
          { from: '2026-10-20' }, { to: '9999-12-31' }, { from: '0000-01-01' },
          { branchid: 'all' }, { branchid: '0' }, { branchid: '-2' }, { branchid: '2.5' },
          { branchid: '2 OR 1=1' }, { branchid: ['2'] }, { branchid: '9007199254740992' },
     ])('rejects malformed/overflow dates, reversed ranges and branches before DB access: %j', async override => {
          await expect(new SalesExpensesReportService(3).generate({ ...query, ...override })).rejects.toMatchObject({ statusCode: 400 });
          expect(connectionMock).not.toHaveBeenCalled();
     });
});

describe('sales report SQL source and filter contracts', () => {
     const db = knex({ client: 'mysql2' });
     const sql = (org = true) => {
          const queries = salesReportQueries(db, filters, org);
          return Object.fromEntries(Object.entries(queries).map(([key, builder]) => [key, builder.toSQL()])) as Record<string, { sql: string; bindings: readonly any[] }>;
     };
     it('binds branch and inclusive calendar range in all independent detail queries without pagination', () => {
          for (const compiled of Object.values(sql())) {
               expect(compiled.bindings).toEqual(expect.arrayContaining([2, filters.start, filters.end]));
               expect(compiled.sql).toContain('>= ?');
               expect(compiled.sql).toContain('< ?');
               expect(compiled.sql).not.toMatch(/\blimit\b|\boffset\b|\btenant_id\b/i);
               expect(compiled.sql).not.toContain('2026-10-01');
          }
     });
     it('counts bill headers once, excludes invalid bills/services and keeps header-only legacy bills', () => {
          const { bills: billQuery, services: serviceQuery } = sql();
          expect(billQuery.sql).toContain('`bill`.`billedon` >= ?');
          expect(billQuery.sql).toContain('`bill`.`billedon` < ?');
          expect(billQuery.sql).toContain('`bill`.`status` is null or `bill`.`status` not in');
          expect(billQuery.bindings).toEqual(expect.arrayContaining(['voided', 'corrected', 'written-off']));
          expect(billQuery.sql).toContain('not exists');
          expect(billQuery.sql).toContain('or exists');
          expect(billQuery.sql).toContain('`live_service`.`isDeleted` = ? or `live_service`.`isDeleted` is null');
          expect(billQuery.sql).not.toContain('join `dboservices`');
          expect(billQuery.sql).not.toContain('billinghx');
          expect(serviceQuery.sql).toContain('select distinct');
          expect(serviceQuery.sql).toContain('`service`.`isDeleted`');
          expect(serviceQuery.bindings).toEqual(expect.arrayContaining(['active', 'refunded', 'written-off']));
     });
     it('includes older-bill receipts and actual refunds even for voided bills, without counting tracking tables again', () => {
          const receiptQuery = sql().receipts;
          expect(receiptQuery.sql).toContain('COALESCE(invoice_payment.paymentDate, receipt.Date) >= ?');
          expect(receiptQuery.sql).toContain('COALESCE(invoice_payment.paymentDate, receipt.Date) < ?');
          expect(receiptQuery.sql).toContain('`receipt`.`isVoided` = ? or `receipt`.`isVoided` is null');
          expect(receiptQuery.bindings).toEqual(expect.arrayContaining(['credit', 'debit']));
          expect(receiptQuery.sql).not.toMatch(/bill`\.`(billedon|status)/);
          expect(receiptQuery.sql).not.toContain('dboservices');
          expect(receiptQuery.sql).not.toContain('dbobillingrefundtable');
          expect(receiptQuery.sql).toContain('min(`payment`.`payment_date`)');
          expect(receiptQuery.sql).toContain('group by `allocation`.`billinghx_id`');
     });
     it('supports tenants without the optional organizational invoice migration without bootstrapping it', () => {
          const receiptQuery = sql(false).receipts;
          expect(receiptQuery.sql).toContain('receipt.Date >= ?');
          expect(receiptQuery.sql).not.toContain('org_invoice');
          expect(receiptQuery.sql).not.toMatch(/create|insert|update|delete/i);
     });
     it('uses actual paid non-reversed expense payments and the expense branch, never expense creation dates or invoice joins', () => {
          const expenseQuery = sql().expenses;
          expect(expenseQuery.sql).toContain('`expense`.`branchid` = ?');
          expect(expenseQuery.sql).not.toContain('`payment`.`branchid`');
          expect(expenseQuery.sql).not.toContain('payment_accounts');
          expect(expenseQuery.sql).toContain('`payment`.`payment_date` >= ?');
          expect(expenseQuery.sql).toContain('`payment`.`payment_date` < ?');
          expect(expenseQuery.sql).toContain('`payment`.`status` = ?');
          expect(expenseQuery.sql).toContain('`payment`.`is_reversed` = ?');
          expect(expenseQuery.bindings).toEqual(expect.arrayContaining(['Paid', 0]));
          expect(expenseQuery.sql).not.toMatch(/expense`\.`(date|createdon|approvedon)/);
          expect(expenseQuery.sql).not.toContain('invoice_expenses');
          expect(expenseQuery.sql).toContain('CAST(merchant.id AS CHAR)');
     });
});

describe('sales report decimal totals and response', () => {
     const report = () => assembleSalesReport(filters, branch, { name: 'Facility' }, bills, services, receiptRows, expenseRows);
     it('reconciles tax-inclusive stored sales, unique clients, current balances, older-bill receipts, refunds and expenses', () => {
          const result = report();
          expect(result.summary).toEqual({
               clients: 1, transactions: 2, grossSales: 100.3, discounts: 10, netSales: 99.3,
               receipts: 100, receiptCredits: 110, receiptRefunds: 10, expensePayments: 25.3,
               netCashMovement: 74.7, outstanding: 59.2,
          });
          expect(result.transactions[0]).toMatchObject({ billingId: 1, source: 'Self', net: 99, paid: 40, outstanding: 59 });
          expect(result.receipts[1]).toMatchObject({ billingId: 99, source: 'organization_invoice', amount: 70 });
          expect(result.receipts[2]).toMatchObject({ billingId: 99, type: 'refund', amount: -10 });
          expect(result.outstanding[1]).toMatchObject({ organizationName: 'Test Organization', source: 'Organization', amount: 0.2 });
          expect(result.paymentMethods).toEqual([{ method: 'Cash', amount: 30 }, { method: 'Mobile Money', amount: 70 }]);
          expect(result.outstandingBySource).toEqual([{ source: 'Organization', amount: 0.2 }, { source: 'Self', amount: 59 }]);
          expect(result.generatedAt).toMatch(/Z$/);
          expect(result.notes.join(' ')).toContain('CURRENT');
          expect(result.notes.join(' ')).toContain('payment_date');
     });
     it('does not allocate mixed-source header balances or multiply transactions by service count', () => {
          const result = assembleSalesReport(filters, branch, {}, bills, [
               ...services, { billingid: 1, registrationType: 'organization', organizationName: 'Another Organization' },
          ], [], []);
          expect(result.transactions).toHaveLength(2);
          expect(result.transactions[0].source).toBe('Mixed (Organization, Self)');
          expect(result.outstanding[0]).toMatchObject({ amount: 59, organizationName: 'Another Organization' });
     });
     it('returns complete arrays beyond typical page limits and sums 0.1 plus 0.2 exactly', () => {
          const many = Array.from({ length: 601 }, (_, id) => ({ ...receiptRows[0], id, amount: id % 2 ? '0.10' : '0.20' }));
          const result = assembleSalesReport(filters, branch, {}, [], [], many, []);
          expect(result.receipts).toHaveLength(601);
          expect(result.summary.receipts).toBe(90.2);
          expect(result.paymentMethods).toEqual([{ method: 'Cash', amount: 90.2 }]);
     });
     it('returns zero totals, empty details, missing branding and no negative outstanding for overpayments', () => {
          const empty = assembleSalesReport(filters, branch, undefined, [], [], [], []);
          expect(empty.company).toEqual({});
          expect(Object.values(empty.summary)).toEqual(expect.arrayContaining([0]));
          expect(Object.values(empty.summary).every(value => value === 0)).toBe(true);
          for (const key of ['transactions', 'receipts', 'expenses', 'outstanding', 'paymentMethods', 'outstandingBySource']) expect(empty[key]).toEqual([]);
          const overpaid = assembleSalesReport(filters, branch, {}, [{ ...bills[0], outstanding: '-2.00' }], [], [], []);
          expect(overpaid.summary.outstanding).toBe(0);
          expect(overpaid.outstanding).toEqual([]);
     });
     it('fails rather than emitting amounts whose integer cents cannot safely fit the JSON-number contract', () => {
          expect(() => assembleSalesReport(filters, branch, {}, [{ ...bills[0], totalcost: '90071992547409.92' }], [], [], [])).toThrow('precision');
     });
});

describe('sales report tenant connection and snapshot', () => {
     let sql: string[];
     let transaction: ReturnType<typeof vi.spyOn>;
     let foundBranch: boolean;
     beforeEach(() => {
          vi.clearAllMocks();
          sql = [];
          foundBranch = true;
          const db = knex({ client: 'mysql2' });
          vi.spyOn(db.client, 'runner').mockImplementation((builder: any) => ({
               run: async () => {
                    const compiled = builder.toSQL();
                    if (Array.isArray(compiled)) return true; // read-only schema.hasTable probes
                    sql.push(compiled.sql);
                    if (compiled.sql.includes('from `branch`')) return foundBranch ? branch : undefined;
                    if (compiled.sql.includes('from `companyprofile`')) return { name: 'Facility' };
                    if (compiled.sql.includes('from `billinghx`')) return compiled.sql.includes('`cashier`')?receiptRows.map(row=>({...row,cashier:'Test Cashier'})):receiptRows;
                    if(compiled.sql.includes('as `panelName`'))return [{billingid:1,serviceid:11,panelName:'FBC',department:'Hematology',totalpayable:'99.00',paidamount:'40.00',outstanding:'59.00'}];
                    if (compiled.sql.includes('from `expense_payments`')) return expenseRows;
                    if (compiled.sql.includes('select distinct')) return services;
                    return bills;
               },
          }) as any);
          transaction = vi.spyOn(db, 'transaction').mockImplementation(async (callback: any) => callback(db)) as any;
          connectionMock.mockResolvedValue(db);
     });
     it('uses the verified tenant once and requests a repeatable-read transaction (no READ ONLY: MariaDB rejects it) for every read', async () => {
          const result = await new SalesExpensesReportService(17).generate(query);
          expect(connectionMock).toHaveBeenCalledExactlyOnceWith(17);
          expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'repeatable read' });
          expect(result.summary.netCashMovement).toBe(74.7);
          expect(sql).toHaveLength(6);
          expect(sql.every(statement => statement.startsWith('select '))).toBe(true);
     });
     it('adds cashier and service detail only when explicitly requested, in the same branch-scoped read snapshot',async()=>{
          const result=await new SalesExpensesReportService(17).generate({...query,inlineDetails:'true'});
          expect(result.receipts[0].cashier).toBe('Test Cashier');
          expect(result.inlineServices).toEqual([{billingId:1,serviceId:11,name:'FBC',department:'Hematology',amount:99,paid:40,outstanding:59}]);
          const detail=sql.find(statement=>statement.includes('as `panelName`'))!;expect(detail).toContain('`bill`.`branchid` = ?');expect(detail).toContain('`service`.`isDeleted`');expect(detail).toContain('`bill`.`billedon` >= ?');expect(sql.every(statement=>statement.startsWith('select '))).toBe(true);
     });
     it('returns 404 for nonexistent branches without reading any financial data', async () => {
          foundBranch = false;
          await expect(new SalesExpensesReportService(17).generate(query)).rejects.toMatchObject({ statusCode: 404 });
          expect(sql).toHaveLength(1);
     });
     it('rejects invalid tenant contexts before opening a connection', async () => {
          await expect(new SalesExpensesReportService(0).generate(query)).rejects.toMatchObject({ statusCode: 403 });
          expect(connectionMock).not.toHaveBeenCalled();
     });
});
