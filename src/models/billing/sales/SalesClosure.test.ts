import { describe, it, expect, vi } from 'vitest';
import knex from 'knex';
import mysql from 'mysql2/promise';
vi.mock('../../../hooks/helper', () => ({ promisifyQuery: vi.fn() }));
vi.mock('../../../database/KnexConnections', () => ({default: vi.fn()}));
import { salesClosurePredicate } from './SalesClosure';
import { financialTrendQuery, scopeFinancialQuery } from './AnalyticsBilling';
import { salesReportQueries, parseSalesReportFilters } from './SalesExpensesReport';
import OutstandingClass from '../outstanding/outstanding_class';
const capabilities = (signed = true, tables: string[] = []) => ({schema: {
    hasColumn: async () => signed, hasTable: async (table: string) => tables.includes(table),
}});

describe('closed sales reporting', () => {
    it('falls back only when no closure infrastructure exists', async () => {
        expect(await salesClosurePredicate(capabilities(false))).toBe('1=1');
        expect(await salesClosurePredicate(capabilities())).toBe('(bill.record_validated_and_signed_off = 1)');
        const sql = await salesClosurePredicate(capabilities(false, ['financial_day_closures']));
        expect(sql).toContain("closure.status = 'finalized'");
        expect(sql).not.toBe('1=1');
        await expect(salesClosurePredicate(capabilities(), 'bill;drop')).rejects.toThrow();
    });
    it('applies the same closure evidence to daily report sales, receipts and service details', async () => {
        const db = knex({client:'mysql2'});
        try {
            const closure = await salesClosurePredicate(capabilities());
            const queries = salesReportQueries(db, parseSalesReportFilters({branchid:'1',from:'2026-11-12',to:'2026-11-12'}), false, closure);
            for (const key of ['bills','services','receipts'] as const) expect(queries[key].toSQL().sql).toContain(closure);
            const trend = scopeFinancialQuery(financialTrendQuery('daily'), 1, closure);
            expect(trend).toContain('SUM(ROUND(bill.payable, 2))');
            expect(trend).toContain('DATE_FORMAT(bill.billedon');
            expect(trend).toContain(closure);
        } finally { await db.destroy(); }
    });
});

const enabled = process.env.RUN_ANALYTICS_DB_TESTS === '1';
describe.skipIf(!enabled)('read-only database reconciliation', () => {
    it('recognizes sign-off, finalized days, record locks and historical locks without including pending or other-branch days', async () => {
        const connection = await mysql.createConnection({host:process.env.DB_HOST,user:process.env.DB_USERNAME,password:process.env.DB_PASSWORD,database:process.env.DATABASE,port:Number(process.env.DB_PORT)||3306});
        try {
            const closure = await salesClosurePredicate(capabilities(true,['financial_day_closures','financial_record_locks','financial_historical_locks']));
            const [rows]:any = await connection.query(`WITH billing AS (
                SELECT 1 billingid,1 branchid,CAST('2026-11-01' AS DATE) billedon,1 record_validated_and_signed_off
                UNION ALL SELECT 2,1,'2026-11-02',0 UNION ALL SELECT 3,1,'2026-11-03',0
                UNION ALL SELECT 4,1,'2026-11-04',0 UNION ALL SELECT 5,1,'2026-11-05',0
                UNION ALL SELECT 6,2,'2026-11-02',0
            ), financial_day_closures AS (
                SELECT 1 branchid,CAST('2026-11-02' AS DATE) financial_date,'finalized' status
                UNION ALL SELECT 1,'2026-11-05','pending'
            ), financial_record_locks AS (SELECT 'billing' source_table,'3' source_ref),
            financial_historical_locks AS (SELECT 1 branchid,CAST('2026-11-04' AS DATE) start_date,CAST('2026-11-04' AS DATE) end_date)
            SELECT bill.billingid FROM billing bill WHERE ${closure} ORDER BY bill.billingid`);
            expect(rows.map((row:any)=>row.billingid)).toEqual([1,2,3,4]);
        } finally {await connection.end();}
    });

    it('matches daily bills and receipts to analytics, excludes open sales and separates NHIS/mixed bills', async () => {
        const connection = await mysql.createConnection({host:process.env.DB_HOST,user:process.env.DB_USERNAME,password:process.env.DB_PASSWORD,database:process.env.DATABASE,port:Number(process.env.DB_PORT)||3306});
        const db = knex({client:'mysql2'});
        const fixture = `WITH billing AS (
            SELECT 1 billingid, 1 patientid, 1 branchid, CAST('2026-11-12 23:59:59' AS DATETIME) billedon, 100 totalcost, 10 discount, 90 payable, 60 paid, 30 outstanding, 'active' status, 1 record_validated_and_signed_off
            UNION ALL SELECT 2,1,1,'2026-11-12 12:00:00',1000,0,1000,0,1000,'active',0
            UNION ALL SELECT 3,1,1,'2026-11-12 10:00:00',70,0,70,0,70,'active',1
            UNION ALL SELECT 4,1,1,'2026-11-12 10:00:00',80,0,80,0,80,'active',1
        ), dboservices AS (
            SELECT 1 serviceid, 1 billingid, 1 branchid, CAST('2026-11-01' AS DATETIME) serviceAddedOn, 0 isDeleted, 0 isRefunded, 'active' status, 0 isNHIS, 'SELF' serviceCategory, 1 categoryTrackId, 'self' registrationType, 30 outstanding
            UNION ALL SELECT 2,2,1,'2026-11-12',0,0,'active',0,'SELF',1,'self',1000
            UNION ALL SELECT 3,3,1,'2026-11-12',0,0,'active',1,'NHIS',4,'nhis',70
            UNION ALL SELECT 4,4,1,'2026-11-12',0,0,'active',1,'NHIS',4,'nhis',40
            UNION ALL SELECT 5,4,1,'2026-11-12',0,0,'active',0,'SELF',1,'self',40
        ), billinghx AS (
            SELECT 1 KeyID, 1 Billingid, CAST('2026-11-12 23:59:59' AS DATETIME) Date, 'credit' type, 65 Amount, 0 isVoided, 1 PaymentMode
            UNION ALL SELECT 2,1,'2026-11-12 23:59:59','debit',5,0,1
            UNION ALL SELECT 3,2,'2026-11-12 23:59:59','credit',1000,0,1
        ), new_patients AS (SELECT 1 patientid, 'Test' firstname, '' middlename, 'Patient' lastname),
        paymentmodes AS (SELECT 1 KeyID, 'Cash' PaymentMode),
        expense_payments AS (SELECT CAST('2026-11-12' AS DATETIME) payment_date, 20 amount, 'Paid' status, 0 is_reversed, 1 expense_id),
        expensesrecord AS (SELECT 1 id, 1 branchid) `;
        try {
            const closure = await salesClosurePredicate(capabilities());
            const dates = ['2026-11-12','2026-11-12','2026-11-12','2026-11-12','2026-11-12','2026-11-12'];
            const [trend]: any = await connection.query(fixture + ', ' + scopeFinancialQuery(financialTrendQuery('daily'),1,closure).replace(/^WITH /,''), dates);
            const queries = salesReportQueries(db, parseSalesReportFilters({branchid:'1',from:'2026-11-12',to:'2026-11-12'}),false,closure);
            const execute = async (query: any) => {const sql=query.toSQL(); const [rows]:any=await connection.query(fixture + sql.sql,sql.bindings);return rows;};
            const bills = await execute(queries.bills), receipts = await execute(queries.receipts);
            expect(bills.map((bill:any)=>bill.billingid)).toEqual([3,4,1]);
            expect(Number(trend[0].gross_revenue)).toBe(bills.reduce((sum:number,bill:any)=>sum+Number(bill.totalcost),0));
            expect(Number(trend[0].earned_revenue)).toBe(240);
            expect(Number(trend[0].cash_collected)).toBe(receipts.reduce((sum:number,row:any)=>sum+(row.type==='credit'?1:-1)*Number(row.amount),0));
            expect(Number(trend[0].cash_collected)).toBe(60);
            expect(Number(trend[0].net_operating_cash)).toBe(40);
            const report:any = new OutstandingClass(1); report.closure=closure;
            const outstanding=report.applyCommonFilters(db('dboservices').select('dboservices.billingid'),'2026-11-01','2026-11-12');
            expect((await execute(outstanding)).map((row:any)=>row.billingid)).toEqual([1]);
        } finally {await connection.end();await db.destroy();}
    });
});
