import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import KnexConnection from '../../database/KnexConnections';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import { assertTestInstrumentEligible, TestInstrumentMapping } from './TestInstrumentMapping';
import { requireBusinessConfigurationRole, requireQcConfigurationRole } from '../../middleware/businessConfigurationAuthority';

vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
let a: ReturnType<typeof accountingSqlDatabase>, b: ReturnType<typeof accountingSqlDatabase>;
function seed(fixture: ReturnType<typeof accountingSqlDatabase>) {
     fixture.native.exec(`
          CREATE TABLE test_panels(id INTEGER PRIMARY KEY, name TEXT);
          CREATE TABLE devices(id TEXT PRIMARY KEY, deviceName TEXT, status TEXT);
          CREATE TABLE test_ascension(id INTEGER PRIMARY KEY, testid INTEGER);
          CREATE TABLE lab_work_assignments(ascensionid INTEGER PRIMARY KEY, device_id TEXT);
          CREATE TABLE pls_test_instrument_config(testid INTEGER PRIMARY KEY, mode TEXT, version INTEGER);
          CREATE TABLE pls_test_instruments(testid INTEGER, device_id TEXT, PRIMARY KEY(testid,device_id));
          CREATE TABLE pls_test_instrument_history(id INTEGER PRIMARY KEY, testid INTEGER, actor_id INTEGER, reason TEXT, before_data TEXT, after_data TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
          INSERT INTO test_panels VALUES(1,'Blood count');
          INSERT INTO devices VALUES('a','Analyzer A','active'),('b','Analyzer B','active'),('c','Inactive','inactive');
          INSERT INTO test_ascension VALUES(10,1);
     `);
}
beforeEach(() => {
     a = accountingSqlDatabase(); b = accountingSqlDatabase(); seed(a); seed(b);
     vi.mocked(KnexConnection).mockImplementation(async tenant => tenant === 1 ? a.db : b.db);
});
afterEach(async () => { await a.db.destroy(); await b.db.destroy(); vi.clearAllMocks(); });
const save = (version: number, mode = 'instrument', deviceIds = ['a']) =>
     new TestInstrumentMapping(1).save(1, 7, { version, mode, deviceIds, reason: 'Validated method' });
const guard = () => a.db.transaction(trx => assertTestInstrumentEligible(trx, 10));

describe('test instrument mapping', () => {
     it('isolates tenants and records before and after snapshots with actor and reason', async () => {
          await save(0);
          await save(1, 'instrument', ['b']);
          const events = await new TestInstrumentMapping(1).history(1, 1, 20);
          expect(events.total).toBe(2);
          expect(events.data[0]).toMatchObject({ actor_id: 7, reason: 'Validated method' });
          expect(JSON.parse(events.data[0].before_data)).toMatchObject({ mode: 'instrument', deviceIds: ['a'] });
          expect(JSON.parse(events.data[0].after_data)).toMatchObject({ mode: 'instrument', deviceIds: ['b'] });
          expect((await new TestInstrumentMapping(2).list(1, 20, '')).data[0].mode).toBeNull();
          expect((await new TestInstrumentMapping(2).history(1, 1, 20)).total).toBe(0);
     });
     it('rejects invalid mappings and stale versions without modifying the audit or mapping', async () => {
          await save(0);
          await expect(save(0, 'instrument', ['b'])).rejects.toMatchObject({ statusCode: 409 });
          await expect(save(1, 'instrument', ['c'])).rejects.toMatchObject({ statusCode: 400 });
          await expect(save(1, 'manual', ['a'])).rejects.toMatchObject({ statusCode: 400 });
          expect(await a.db('pls_test_instruments').pluck('device_id')).toEqual(['a']);
          expect(await a.db('pls_test_instrument_history')).toHaveLength(1);
     });
     it('permits unmapped tests and enforces explicit, active, mapped selection and manual-only mode', async () => {
          await expect(guard()).resolves.toBeUndefined();
          await expect(assertTestInstrumentEligible(a.db, 10)).resolves.toBeUndefined();
          await save(0);
          await expect(assertTestInstrumentEligible(a.db, 10)).rejects.toMatchObject({ statusCode: 409 });
          await expect(guard()).rejects.toMatchObject({ statusCode: 409 });
          await a.db('lab_work_assignments').insert({ ascensionid: 10, device_id: 'b' });
          await expect(guard()).rejects.toMatchObject({ statusCode: 409 });
          await a.db('lab_work_assignments').update({ device_id: 'a' });
          await expect(guard()).resolves.toBeUndefined();
          await a.db('devices').where({ id: 'a' }).update({ status: 'inactive' });
          await expect(guard()).rejects.toMatchObject({ statusCode: 409 });
          await save(1, 'manual', []);
          await expect(guard()).rejects.toMatchObject({ statusCode: 409 });
          await a.db('lab_work_assignments').update({ device_id: null });
          await expect(guard()).resolves.toBeUndefined();
     });
     it('fails closed for missing orders and unknown configuration modes', async () => {
          await expect(a.db.transaction(trx => assertTestInstrumentEligible(trx, 999))).rejects.toMatchObject({ statusCode: 404 });
          await a.db('pls_test_instrument_config').insert({ testid: 1, mode: 'invalid', version: 1 });
          await expect(guard()).rejects.toMatchObject({ statusCode: 409 });
     });
     it('restricts reads to QC roles, writes to supervisors, and rejects tenant mismatch', () => {
          const response = () => { const r: any = { status: vi.fn(), json: vi.fn() }; r.status.mockReturnValue(r); return r; };
          for (const [role, tenant, allowed] of [['scientist', 1, true], ['scientist', 2, false], ['cashier', 1, false]] as const) {
               const next = vi.fn(), res = response();
               requireQcConfigurationRole({ authUser: { role, tenantId: 1, employeeid: 7 }, query: { tenantId: String(tenant) } } as any, res, next);
               expect(next).toHaveBeenCalledTimes(allowed ? 1 : 0);
          }
          const next = vi.fn();
          requireBusinessConfigurationRole(['admin', 'manager'])({ authUser: { role: 'scientist', tenantId: 1 }, query: { tenantId: '1' } } as any, response(), next);
          expect(next).not.toHaveBeenCalled();
     });
});
