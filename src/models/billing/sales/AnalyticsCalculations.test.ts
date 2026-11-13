import { describe, it, expect, vi } from 'vitest';
import mysql from 'mysql2/promise';
import knex from 'knex';
vi.mock('../../../hooks/helper', () => ({ promisifyQuery: vi.fn() }));
import { financialTrendQuery, scopeFinancialQuery } from './AnalyticsBilling';
const state = vi.hoisted(() => ({db: null as any}));
vi.mock('../../../database/KnexConnections', () => ({ default: async () => state.db }));
import { CommissionAnalyticsWithDate } from '../../commissions/commission-configurations/repositories/CommissionAnalyticsWithDate';
const enabled = process.env.RUN_ANALYTICS_DB_TESTS === '1';

describe.skipIf(!enabled)('read-only MySQL analytics calculations', () => {
    it('calculates commission instalments, reversals and typed recipient counts', async () => {
        const connection = await mysql.createConnection({host: process.env.DB_HOST, user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DATABASE, port: Number(process.env.DB_PORT) || 3306});
        const client = knex({client:'mysql2'});
        try {
            const fixture = client.raw(`(SELECT NULL id, 12 recipient_id, 'organization' recipient_type, 'pending' status,
                CAST('2026-10-01 12:00:00' AS DATETIME) payment_date, CAST('2026-10-01 12:00:00' AS DATETIME) created_at, 0 payment_amount, 0 waived_amount, 100 total_commission_amount
                UNION ALL SELECT 1,12,'organization','completed','2026-10-31 23:59:59','2026-10-31 12:00:00',40,0,0
                UNION ALL SELECT 1,12,'organization','completed','2026-11-12 12:00:00','2026-11-12 12:00:00',60,0,0
                UNION ALL SELECT 1,12,'organization','completed','2026-11-20 12:00:00','2026-11-20 12:00:00',-20,0,0
                UNION ALL SELECT NULL,12,'clinician','pending','2026-10-01 12:00:00','2026-10-01 12:00:00',0,0,50) facts`);
            state.db = {
                raw: client.raw.bind(client),
                from: (source: any) => {
                    const query: any = client.from(source);
                    query.then = (resolve: any, reject: any) => {
                        const compiled = query.toSQL();
                        return connection.query(compiled.sql, compiled.bindings).then(([rows]: any) => query._method === 'first' ? rows[0] : rows).then(resolve,reject);
                    };
                    return query;
                }
            };
            const repo: any = new CommissionAnalyticsWithDate(1);
            repo.facts = () => state.db.from(fixture);
            const filters = {tenantId:1, startDate:new Date('2026-10-01'), endDate:new Date('2026-10-31'),period:'quarterly',recipientType:'organization'};
            const october = await repo.getCommissionsByPeriod(filters);
            expect(Number(october[0].total_paid)).toBe(40);
            expect(Number(october[0].total_due)).toBe(100);
            expect(october[0].period).toBe('2026-Q4');
            const november = await repo.getCommissionsByPeriod({...filters,startDate:new Date('2026-11-01'),endDate:new Date('2026-11-30')});
            expect(Number(november[0].total_paid)).toBe(40);
            const endDay = await repo.getCommissionsByPeriod({...filters,startDate:new Date('2026-11-01'),endDate:new Date('2026-11-12')});
            expect(Number(endDay[0].total_paid)).toBe(60);
            const stats = await repo.getPeriodStatistics({...filters,recipientType:undefined});
            expect(Number(stats.unique_recipients)).toBe(2);
        } finally { await connection.end(); await client.destroy(); }
    });
    it('attributes receipts to their payment day and retains expense-only days', async () => {
        const connection = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DATABASE, port: Number(process.env.DB_PORT) || 3306 });
        try {
            const fixtures = `WITH billing AS (
                SELECT 1 billingid, CAST('2026-10-01 12:00:00' AS DATETIME) billedon, 100 totalcost, 90 payable, 10 discount, 0 outstanding, 'active' status
            ), dboservices AS (
                SELECT 1 billingid, CAST('2026-10-01 12:00:00' AS DATETIME) serviceAddedOn, 100 totalcost, 90 totalpayable, 10 discount, 0 outstanding, 'active' status, 0 isDeleted
            ), billinghx AS (
                SELECT CAST('2026-11-12 23:59:59' AS DATETIME) Date, 'credit' type, 60 Amount, 0 isVoided
                UNION ALL SELECT '2026-11-12 12:00:00', 'debit', 10, 0
            ), expense_payments AS (
                SELECT CAST('2026-11-13' AS DATETIME) payment_date, 20 amount, 'Paid' status, 0 is_reversed
            ), `;
            const sql = fixtures + financialTrendQuery('daily').replace(/^WITH /, '');
            const [rows]: any = await connection.query(sql, ['2026-11-01','2026-11-13','2026-11-01','2026-11-13','2026-11-01','2026-11-13']);
            expect(rows).toHaveLength(2);
            expect(Number(rows.find((row: any) => row.date === '2026-11-12').cash_collected)).toBe(50);
            expect(Number(rows.find((row: any) => row.date === '2026-11-13').net_operating_cash)).toBe(-20);
        } finally { await connection.end(); }
    });
});

describe('financial SQL branch contracts', () => {
    it('scopes service, receipt and expense sources using a validated branch', () => {
        const query = scopeFinancialQuery(financialTrendQuery('monthly'), 4);
        expect(query).toContain('WHERE branchid = 4');
        expect(query).toContain('Billingid IN (SELECT bill.billingid FROM billing bill WHERE bill.branchid = 4');
        expect(query).toContain('expense_id IN (SELECT id FROM expensesrecord WHERE branchid = 4)');
        expect(() => scopeFinancialQuery(financialTrendQuery('daily'), Number.NaN)).toThrow();
    });
});
