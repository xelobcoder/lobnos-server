import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import { FinancialDayLimitService, financialDayReadiness } from './FinancialDayLimitService';

vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
const databases: ReturnType<typeof accountingSqlDatabase>[] = [];
afterEach(async () => { await Promise.all(databases.splice(0).map(f => f.db.destroy())); });
function fixture() {
     const f = accountingSqlDatabase();
     databases.push(f);
     f.native.exec(`
       CREATE TABLE billing(billingid INTEGER PRIMARY KEY, branchid INTEGER, billedon TEXT);
       CREATE TABLE dboservices(serviceid INTEGER PRIMARY KEY, branchid INTEGER, serviceAddedOn TEXT);
       CREATE TABLE billinghx(Billingid INTEGER, Date TEXT);
       CREATE TABLE dbobillingrefundtable(serviceid INTEGER, isRefundCompleted INTEGER, approvalDate TEXT);
       CREATE TABLE expensesrecord(branchid INTEGER, date TEXT);
       CREATE TABLE expense_payments(branchid INTEGER, payment_date TEXT);
       CREATE TABLE finance_ledger(branchid INTEGER, occurred_at TEXT);
       CREATE TABLE acc_journal_entries(id INTEGER PRIMARY KEY, occurred_at TEXT);
       CREATE TABLE acc_journal_lines(journal_entry_id INTEGER, branchid INTEGER);
       CREATE TABLE financial_day_closures(id INTEGER PRIMARY KEY, branchid INTEGER, financial_date TEXT, status TEXT);
       CREATE TABLE pharmacy_financial_days(branchid INTEGER, financial_date TEXT, status TEXT);
       CREATE TABLE pharmacy_accounting_settings(branchid INTEGER, tenant_id INTEGER, enabled INTEGER);
     `);
     return { ...f, service: new FinancialDayLimitService(1, f.db) };
}
const now = new Date('2026-11-04T00:00:00.000Z');
describe('48-hour financial day transaction limit', () => {
     it('allows 47:59:59.999 but blocks at exactly 48 hours for both ledgers', () => {
          for (const pharmacy of [false, true]) {
               expect(financialDayReadiness(2, '2026-11-02', new Date(now.getTime() - 1), pharmacy).blocked).toBe(false);
               expect(financialDayReadiness(2, '2026-11-02', now, pharmacy)).toMatchObject({
                    blocked: true, graceHours: 48, deadline: now.toISOString(), oldestFinancialDate: '2026-11-02',
               });
          }
     });
     it('allows a new branch with no activity, independently in each ledger', async () => {
          const f = fixture();
          expect(await f.service.status(2, now)).toMatchObject({ blocked: false, oldestFinancialDate: null });
          expect(await f.service.status(2, now, true)).toMatchObject({ blocked: false, oldestFinancialDate: null });
     });
     it('finds activity without any submitted close and resumes only after finalization', async () => {
          const f = fixture();
          await f.db('billing').insert({ billingid: 1, branchid: 2, billedon: '2026-11-02 23:59:59' });
          expect(await f.service.status(2, now)).toMatchObject({ blocked: true, oldestFinancialDate: '2026-11-02' });
          await f.db('financial_day_closures').insert({ id: 1, branchid: 2, financial_date: '2026-11-02', status: 'manager_approved' });
          expect((await f.service.status(2, now)).blocked).toBe(true);
          await f.db('financial_day_closures').where({ id: 1 }).update({ status: 'finalized' });
          expect((await f.service.status(2, now)).blocked).toBe(false);
     });
     it.each([
          ['dboservices', { branchid: 2, serviceAddedOn: '2026-11-02' }],
          ['expensesrecord', { branchid: 2, date: '2026-11-02' }],
          ['expense_payments', { branchid: 2, payment_date: '2026-11-02' }],
          ['finance_ledger', { branchid: 2, occurred_at: '2026-11-02' }],
          ['financial_day_closures', { branchid: 2, financial_date: '2026-11-02', status: 'draft' }],
     ])('includes overdue %s activity, not only bills', async (table, row) => {
          const f = fixture();
          await f.db(table).insert(row);
          expect((await f.service.status(2, now)).blocked).toBe(true);
     });
     it('checks receipt dates rather than just original sales dates', async () => {
          const f = fixture();
          await f.db('billing').insert({ billingid: 1, branchid: 2, billedon: '2026-11-01' });
          await f.db('financial_day_closures').insert({ branchid: 2, financial_date: '2026-11-01', status: 'finalized' });
          await f.db('billinghx').insert({ Billingid: 1, Date: '2026-11-02' });
          expect(await f.service.status(2, now)).toMatchObject({ blocked: true, oldestFinancialDate: '2026-11-02' });
     });
     it('includes shared journals and ignores another branch finalizing the same date', async () => {
          const f = fixture();
          await f.db('acc_journal_entries').insert({ id: 1, occurred_at: '2026-11-02' });
          await f.db('acc_journal_lines').insert({ journal_entry_id: 1, branchid: 2 });
          await f.db('financial_day_closures').insert({ branchid: 3, financial_date: '2026-11-02', status: 'finalized' });
          expect((await f.service.status(2, now)).blocked).toBe(true);
          expect((await f.service.status(3, now)).blocked).toBe(false);
     });
     it('includes completed legacy refunds even when their receipt history is missing', async () => {
          const f = fixture();
          await f.db('dboservices').insert({ serviceid: 1, branchid: 2, serviceAddedOn: '2026-11-01' });
          await f.db('financial_day_closures').insert({ branchid: 2, financial_date: '2026-11-01', status: 'finalized' });
          await f.db('dbobillingrefundtable').insert({ serviceid: 1, isRefundCompleted: 1, approvalDate: '2026-11-02' });
          expect(await f.service.status(2, now)).toMatchObject({ blocked: true, oldestFinancialDate: '2026-11-02' });
     });
     it('keeps laboratory and pharmacy closure states independent', async () => {
          const f = fixture();
          await f.db('pharmacy_financial_days').insert({ branchid: 2, financial_date: '2026-11-02', status: 'open' });
          await f.db('financial_day_closures').insert({ branchid: 2, financial_date: '2026-11-02', status: 'finalized' });
          expect((await f.service.status(2, now)).blocked).toBe(false);
          expect(await f.service.status(2, now, true)).toMatchObject({ blocked: true, closeUrl: '/pharmacy/finance' });
          await f.db('pharmacy_financial_days').where({ branchid: 2 }).update({ status: 'closed' });
          expect((await f.service.status(2, now, true)).blocked).toBe(false);
     });
     it('cannot let pharmacy closure clear an overdue laboratory day', async () => {
          const f = fixture();
          await f.db('billing').insert({ billingid: 1, branchid: 2, billedon: '2026-11-02' });
          await f.db('pharmacy_financial_days').insert({ branchid: 2, financial_date: '2026-11-02', status: 'closed' });
          expect((await f.service.status(2, now)).blocked).toBe(true);
          expect((await f.service.status(2, now, true)).blocked).toBe(false);
     });
     it('isolates tenant connections and detects old backlog beyond recent reporting filters', async () => {
          const first = fixture(), second = fixture();
          await first.db('billing').insert({ billingid: 1, branchid: 2, billedon: '2025-01-01' });
          expect((await first.service.status(2, now)).blocked).toBe(true);
          expect((await second.service.status(2, now)).blocked).toBe(false);
     });
     it('also checks the laboratory day only when pharmacy posts to the shared ledger', async () => {
          vi.useFakeTimers();
          vi.setSystemTime(now);
          try {
               const f = fixture();
               await f.db('billing').insert({ billingid: 1, branchid: 2, billedon: '2026-11-02' });
               await f.db('pharmacy_financial_days').insert({ branchid: 2, financial_date: '2026-11-04', status: 'open' });
               await f.db('pharmacy_accounting_settings').insert({ branchid: 2, tenant_id: 1, enabled: 0 });
               expect((await f.service.transactionStatus(2, true)).blocked).toBe(false);
               await f.db('pharmacy_accounting_settings').where({ branchid: 2 }).update({ enabled: 1 });
               expect(await f.service.transactionStatus(2, true)).toMatchObject({ blocked: true, closeUrl: '/accounting/daily-close?financialDate=2026-11-02' });
          } finally { vi.useRealTimers(); }
     });
     it('rejects missing branches and invalid stored dates instead of silently allowing transactions', () => {
          expect(() => financialDayReadiness(0, null, now)).toThrow('Select your active branch');
          expect(() => financialDayReadiness(2, '2026-02-31', now)).toThrow('Unable to verify');
     });
});
