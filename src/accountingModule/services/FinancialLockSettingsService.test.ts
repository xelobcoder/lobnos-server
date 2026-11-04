import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import { ensureFinancialLockSchema } from '../init/financialLockSchema';
import { FinancialLockSettingsService } from './FinancialLockSettingsService';
import { FinancialFinalizationGuard } from './FinancialFinalizationGuard';
import { withBillingClosure } from '../../models/billing/BillingFinancialGuard';
import { FinancialDayLimitService } from './FinancialDayLimitService';
import settingsRouter from '../../middleware/financialLockSettings';
import KnexConnection from '../../database/KnexConnections';
import type { AuthUser } from '../../middleware/authority';

vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../../hooks/logger', () => ({ default: { error: vi.fn() } }));
const databases: ReturnType<typeof accountingSqlDatabase>[] = [];
const now = new Date('2026-11-04T08:00:00Z');
const range = { startDate: '2024-01-01', endDate: '2026-11-03', reason: 'Reviewed historical migration', confirm: true };
const actor: AuthUser = { tenantId: 17, branch: 2, employeeid: 8, role: 'admin', email: 'synthetic@example.test' };

async function fixture() {
     const f = accountingSqlDatabase();
     databases.push(f);
     await ensureFinancialLockSchema(f.db);
     f.native.exec(`
       CREATE TABLE billing(billingid INTEGER PRIMARY KEY,branchid INTEGER,billedon TEXT,record_validated_and_signed_off INTEGER);
       CREATE TABLE dboservices(serviceid INTEGER PRIMARY KEY,branchid INTEGER,serviceAddedOn TEXT);
       CREATE TABLE billinghx(Billingid INTEGER,Date TEXT);
       CREATE TABLE acc_nhis_events(id INTEGER PRIMARY KEY,branchid INTEGER,event_date TEXT);
       CREATE TABLE dbobillingrefundtable(serviceid INTEGER,isRefundCompleted INTEGER,approvalDate TEXT);
       CREATE TABLE expensesrecord(branchid INTEGER,date TEXT);
       CREATE TABLE expense_payments(branchid INTEGER,payment_date TEXT);
       CREATE TABLE finance_ledger(branchid INTEGER,occurred_at TEXT);
       CREATE TABLE acc_journal_entries(id INTEGER PRIMARY KEY,occurred_at TEXT);
       CREATE TABLE acc_journal_lines(journal_entry_id INTEGER,branchid INTEGER);
       CREATE TABLE financial_day_closures(id INTEGER PRIMARY KEY,branchid INTEGER,financial_date TEXT,status TEXT);
       CREATE TABLE financial_record_locks(source_table TEXT,source_ref TEXT);
       CREATE TABLE acc_control_audit(id INTEGER PRIMARY KEY,action TEXT,entity_id INTEGER,employee_id INTEGER,before_state TEXT,after_state TEXT,created_at TEXT);
     `);
     vi.mocked(KnexConnection).mockResolvedValue(f.db);
     return { ...f, service: new FinancialLockSettingsService(17, f.db), limit: new FinancialDayLimitService(17, f.db) };
}
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now); });
afterEach(async () => { vi.useRealTimers(); await Promise.all(databases.splice(0).map(f => f.db.destroy())); });

describe('historical financial lock migration and configurable policy', () => {
     it('creates idempotent schema and reports migration-safe defaults and empty bounds', async () => {
          const f = await fixture();
          await ensureFinancialLockSchema(f.db);
          expect(await f.service.get(2, now)).toEqual({
               policy: { enabled: false, graceHours: 48 },
               bounds: { earliestDate: null, latestDate: null, currentDate: '2026-11-04' }, ranges: [],
          });
     });
     it('finds true historical and latest dates across activity sources, scoped to the branch', async () => {
          const f = await fixture();
          await f.db('billing').insert([
               { billingid: 1, branchid: 2, billedon: '2024-01-01 12:00:00' },
               { billingid: 2, branchid: 3, billedon: '2020-01-01' },
          ]);
          await f.db('expense_payments').insert({ branchid: 2, payment_date: '2026-11-02' });
          await f.db('billinghx').insert({ Billingid: 1, Date: '2026-11-04' });
          expect((await f.service.get(2, now)).bounds).toEqual({
               earliestDate: '2024-01-01', latestDate: '2026-11-04', currentDate: '2026-11-04',
          });
     });
     it('locks a range once without fabricating finalization or implicitly activating enforcement', async () => {
          const f = await fixture();
          await f.db('billing').insert({ billingid: 1, branchid: 2, billedon: '2024-01-01' });
          expect(await f.service.preview(2, range, now)).toEqual({ financialDayCount: 1, eligibleDayCount: 1, alreadyLockedDayCount: 0 });
          const result = await f.service.migrate(2, 8, range, now);
          expect(result.policy).toEqual({ enabled: false, graceHours: 48 });
          expect(result.ranges).toEqual([expect.objectContaining({ startDate: range.startDate, endDate: range.endDate, createdBy: 8 })]);
          await f.service.migrate(2, 8, range, now);
          expect(await f.db('financial_historical_locks')).toHaveLength(1);
          expect(await f.db('financial_day_closures')).toHaveLength(0);
          expect(await f.db('acc_control_audit')).toHaveLength(1);
          expect(await f.service.preview(2, range, now)).toEqual({ financialDayCount: 1, eligibleDayCount: 0, alreadyLockedDayCount: 1 });
          expect((await f.limit.status(2, now)).oldestFinancialDate).toBeNull();
     });
     it('counts distinct dates, including overlapping locks, without counting multiple transactions twice', async () => {
          const f = await fixture();
          await f.db('billing').insert([
               { billingid: 1, branchid: 2, billedon: '2024-01-01' },
               { billingid: 2, branchid: 2, billedon: '2024-01-01' },
               { billingid: 3, branchid: 2, billedon: '2025-01-01' },
          ]);
          await f.service.migrate(2, 8, { ...range, endDate: '2024-12-31' }, now);
          await f.service.migrate(2, 8, { ...range, endDate: '2025-06-30' }, now);
          expect(await f.service.preview(2, range, now)).toEqual({ financialDayCount: 2, eligibleDayCount: 0, alreadyLockedDayCount: 2 });
     });
     it('counts normally finalized dates as already locked without altering their closure evidence', async () => {
          const f = await fixture();
          await f.db('financial_day_closures').insert({ branchid: 2, financial_date: '2024-01-01', status: 'finalized' });
          expect(await f.service.preview(2, range, now)).toEqual({ financialDayCount: 1, eligibleDayCount: 0, alreadyLockedDayCount: 1 });
          await f.service.migrate(2, 8, range, now);
          expect(await f.db('financial_day_closures')).toEqual([expect.objectContaining({ status: 'finalized' })]);
     });
     it('keeps both endpoints and empty days immutable even with enforcement off', async () => {
          const f = await fixture();
          await f.service.migrate(2, 8, range, now);
          const guard = new FinancialFinalizationGuard(17, f.db);
          for (const date of [range.startDate, '2025-03-04', range.endDate])
               await expect(guard.assertDateOpen(2, date)).rejects.toMatchObject({ code: 'FINANCIAL_RECORD_FINALIZED' });
          await expect(guard.assertDateOpen(3, range.startDate)).resolves.toBeUndefined();
          await expect(guard.assertDateOpen(2, '2026-11-04')).resolves.toBeUndefined();
          await expect(guard.assertDateOpen(2, '2023-12-31')).resolves.toBeUndefined();
     });
     it('shows migrated sales as CLOSED with distinct migration evidence, not a signed finalization', async () => {
          const f = await fixture();
          await f.service.migrate(2, 8, range, now);
          const bills = await withBillingClosure(f.db, [
               { billingid: 1, branchid: 2, billedon: '2024-01-01' },
               { billingid: 2, branchid: 2, billedon: '2026-11-04' },
          ]);
          expect(bills[0]).toMatchObject({ closed_status: 'CLOSED', closure_evidence: {
               closure_type: 'historical_migration', historical_lock_id: 1, closed_by: 8, signed_off: false, closure_id: null,
          } });
          expect(bills[1]).toMatchObject({ closed_status: 'OPEN', closure_evidence: null });
     });
     it('saves interval and activation with the actor and reason in the same audit transaction', async () => {
          const f = await fixture();
          await f.service.migrate(2, 8, range, now);
          const result = await f.service.save(2, 8, { enabled: true, graceHours: 168, reason: 'Activate weekly closing' });
          expect(result.policy).toEqual({ enabled: true, graceHours: 168 });
          const audit = await f.db('acc_control_audit').where({ action: 'financial_lock_policy' }).first();
          expect(audit).toMatchObject({ employee_id: 8, entity_id: 2 });
          expect(JSON.parse(audit.after_state)).toEqual({ enabled: true, graceHours: 168, reason: 'Activate weekly closing' });
          await f.service.save(2, 8, { enabled: false, graceHours: 24, reason: 'Temporarily suspend enforcement' });
          expect((await f.service.get(2)).ranges).toHaveLength(1);
     });
     it('rolls back migration and policy changes if their audit cannot be written', async () => {
          const f = await fixture();
          f.native.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON acc_control_audit BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END");
          await expect(f.service.migrate(2, 8, range, now)).rejects.toThrow('synthetic audit failure');
          expect(await f.db('financial_historical_locks')).toHaveLength(0);
          expect(await f.db('financial_lock_settings')).toHaveLength(0);
          await expect(f.service.save(2, 8, { enabled: true, graceHours: 24, reason: 'Enable closing' })).rejects.toThrow();
          expect(await f.db('financial_lock_settings')).toHaveLength(0);
     });
     it.each([0, -1, 1.5, 8761, '48', null, Infinity])('rejects invalid interval %s without writes', async graceHours => {
          const f = await fixture();
          await expect(f.service.save(2, 8, { enabled: true, graceHours, reason: 'Set closing policy' })).rejects.toMatchObject({ code: 'INVALID_FINANCIAL_INTERVAL' });
          expect(await f.db('financial_lock_settings')).toHaveLength(0);
     });
     it.each([
          { startDate: '2025-02-29' }, { startDate: '2026-11-04' },
          { endDate: '2026-11-04' }, { endDate: '2027-01-01' },
          { startDate: '2026-11-03', endDate: '2026-11-02' },
          { startDate: '2024-1-1' }, { reason: '' }, { confirm: 'true' },
     ])('rejects invalid migration %j without writes', async extra => {
          const f = await fixture();
          await expect(f.service.migrate(2, 8, { ...range, ...extra }, now)).rejects.toBeDefined();
          expect(await f.db('financial_historical_locks')).toHaveLength(0);
     });
     it('fails explicitly when policy schema is unavailable', async () => {
          const f = await fixture();
          await f.db.schema.dropTable('financial_lock_settings');
          await expect(f.limit.status(2, now)).rejects.toThrow('financial_lock_settings');
     });
     it('does not silently disable enforcement when the stored policy is invalid', async () => {
          const f = await fixture();
          await f.db('financial_lock_settings').insert({ branchid: 2, enabled: 2, grace_hours: 48 });
          await expect(f.limit.status(2, now)).rejects.toMatchObject({ code: 'INVALID_FINANCIAL_POLICY' });
     });
});

async function request(method: string, path: string, body: object = {}, user: AuthUser | null = actor) {
     const app = express();
     app.use(express.json());
     app.use((req, _res, next) => { Object.assign(req, { authUser: user }); next(); });
     app.use(settingsRouter);
     const server = createServer(app);
     try {
          await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
          const address = server.address();
          if (!address || typeof address === 'string') throw new Error('Settings test server did not start');
          const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/financial-day/${path}`, {
               method, headers: { 'Content-Type': 'application/json' },
               ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
          });
          return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
     } finally {
          server.closeAllConnections();
          await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
     }
}

describe('financial lock settings authenticated HTTP contract', () => {
     it('restricts reads, preview and mutations to administrators', async () => {
          await fixture();
          for (const [method, path] of [['GET', 'settings'], ['PUT', 'settings'], ['POST', 'historical-locks/preview'], ['POST', 'historical-locks']]) {
               expect((await request(method, path, {}, null)).status).toBe(401);
               expect((await request(method, path, {}, { ...actor, role: 'accountant' })).status).toBe(403);
          }
     });
     it('uses only session tenant/branch/actor and returns no-store state', async () => {
          const f = await fixture();
          const response = await request('PUT', 'settings?tenantId=99&branchid=99', {
               enabled: true, graceHours: 73, reason: 'Approved custom closing interval', branchid: 99, employeeid: 99,
          });
          expect(response.status).toBe(200);
          expect(response.cache).toBe('private, no-store');
          expect(response.body.result.policy).toEqual({ enabled: true, graceHours: 73 });
          expect(KnexConnection).toHaveBeenCalledWith(17);
          expect(await f.db('financial_lock_settings')).toEqual([expect.objectContaining({ branchid: 2, updated_by: 8 })]);
          expect((await request('GET', 'settings')).body.result.policy).toEqual({ enabled: true, graceHours: 73 });
     });
     it('previews and migrates an old period without enabling the policy', async () => {
          const f = await fixture();
          await f.db('billing').insert({ billingid: 1, branchid: 2, billedon: '2024-01-01' });
          expect((await request('POST', 'historical-locks/preview', range)).body.result.financialDayCount).toBe(1);
          const response = await request('POST', 'historical-locks', range);
          expect(response.status).toBe(200);
          expect(response.body.result.ranges).toHaveLength(1);
          expect(response.body.result.policy.enabled).toBe(false);
     });
     it('rejects missing active branches and invalid policy bodies', async () => {
          await fixture();
          expect((await request('GET', 'settings', {}, { ...actor, branch: null })).status).toBe(400);
          expect((await request('PUT', 'settings', { enabled: 'true', graceHours: 48, reason: 'Configure closing' })).status).toBe(400);
     });
     it('surfaces database failures without leaking internals or claiming nothing was committed', async () => {
          await fixture();
          vi.mocked(KnexConnection).mockRejectedValue(new Error('synthetic private SQL'));
          const response = await request('GET', 'settings');
          expect(response.status).toBe(503);
          expect(response.body.code).toBe('FINANCIAL_LOCK_SETTINGS_FAILED');
          expect(JSON.stringify(response.body)).not.toContain('synthetic private SQL');
     });
});
