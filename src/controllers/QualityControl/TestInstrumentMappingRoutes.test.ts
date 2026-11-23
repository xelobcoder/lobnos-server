import express from 'express';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import KnexConnection from '../../database/KnexConnections';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import router from './testInstrumentMappingRoutes';

vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
let fixture: ReturnType<typeof accountingSqlDatabase>, server: any, base: string;
beforeEach(async () => {
     fixture = accountingSqlDatabase();
     fixture.native.exec(`
          CREATE TABLE test_panels(id INTEGER PRIMARY KEY, name TEXT);
          CREATE TABLE devices(id TEXT PRIMARY KEY, deviceName TEXT, status TEXT);
          CREATE TABLE pls_test_instrument_config(testid INTEGER PRIMARY KEY, mode TEXT, version INTEGER);
          CREATE TABLE pls_test_instruments(testid INTEGER, device_id TEXT, PRIMARY KEY(testid,device_id));
          CREATE TABLE pls_test_instrument_history(id INTEGER PRIMARY KEY, testid INTEGER, actor_id INTEGER, reason TEXT, before_data TEXT, after_data TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
          INSERT INTO test_panels VALUES(1,'Test'); INSERT INTO devices VALUES('a','Analyzer','active');
     `);
     vi.mocked(KnexConnection).mockResolvedValue(fixture.db);
     const app = express(); app.use(express.json());
     app.use((req, _res, next) => {
          if (req.headers['x-role']) (req as any).authUser = { employeeid: 7, tenantId: 1, role: req.headers['x-role'] };
          next();
     });
     app.use(router);
     server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
     base = `http://127.0.0.1:${server.address().port}/api/v1/test-instrument-mappings`;
});
afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await fixture.db.destroy(); vi.clearAllMocks(); });
it('enforces session role and tenant on real routes, and records the session actor', async () => {
     const url = `${base}/1?tenantId=1`;
     const body = JSON.stringify({ mode: 'instrument', deviceIds: ['a'], version: 0, reason: 'Validated', actor_id: 999 });
     const request = (role?: string, target = url) => fetch(target, { method: 'PUT', headers: { 'content-type': 'application/json', ...(role ? { 'x-role': role } : {}) }, body });
     expect((await request()).status).toBe(401);
     expect((await request('scientist')).status).toBe(403);
     expect((await request('manager', `${base}/1?tenantId=2`)).status).toBe(403);
     expect((await request('manager')).status).toBe(200);
     const response = await fetch(`${base}/1/history?tenantId=1`, { headers: { 'x-role': 'scientist' } });
     expect(response.status).toBe(200);
     const data: any = await response.json();
     expect(data.data[0].actor_id).toBe(7);
     expect(vi.mocked(KnexConnection)).toHaveBeenCalledWith(1);
});
