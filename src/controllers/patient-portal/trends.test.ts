import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { once } from 'node:events';

const mocks = vi.hoisted(() => ({ session: vi.fn(), list: vi.fn(), history: vi.fn(), audit: vi.fn(), tenants: [] as number[] }));
vi.mock('../../models/patient-portal/PatientPortalAccountService', () => ({
     PatientPortalAccountService: class {
          constructor(tenant: number) { mocks.tenants.push(tenant); }
          isSessionValid = mocks.session;
     },
     PatientPortalError: class extends Error {
          constructor(message: string, public statusCode = 400, public code = 'INVALID_REQUEST') { super(message); }
     },
}));
vi.mock('../../models/patient-portal/PatientPortalTrendService', () => ({
     PatientPortalTrendService: class {
          constructor(tenant: number) { mocks.tenants.push(tenant); }
          listTests = mocks.list;
          history = mocks.history;
     },
}));
vi.mock('../../models/patient-portal/PatientPortalAudit', () => ({ recordPortalAudit: mocks.audit }));
import { patientPortalTrendsRouter } from './trends';

const patient = { role: 'patient', tenantId: 4, patientid: 21, sessionVersion: 2 };
async function call(path: string, user: any = patient) {
     const app = express();
     // The real app supplies this only after JWT validation; test the router's second boundary.
     app.use((req, _res, next) => { (req as any).authUser = user; next(); });
     app.use(patientPortalTrendsRouter);
     const server = app.listen(0, '127.0.0.1');
     await once(server, 'listening');
     try {
          const address = server.address() as any;
          const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/patient-portal/trends/${path}`);
          return { status: response.status, cache: response.headers.get('cache-control'), body: await response.json() };
     } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

beforeEach(() => {
     vi.clearAllMocks();
     mocks.tenants.length = 0;
     mocks.session.mockResolvedValue(true);
     mocks.list.mockResolvedValue([]);
     mocks.history.mockResolvedValue({ rows: [], page: 1, count: 25, total: 0, totalPages: 0 });
});

describe('patient-only trend router', () => {
     it.each([undefined, { ...patient, role: 'admin' }, { ...patient, role: 'scientist' }, { ...patient, role: 'clinician' },
          { ...patient, role: 'phlebotomist' }, { ...patient, tenantId: undefined }, { ...patient, patientid: 0 }])('rejects non-patient or malformed sessions: %j', async user => {
          const response = await call('tests', user === undefined ? null : user);
          expect(response.status).toBe(403);
          expect(mocks.list).not.toHaveBeenCalled();
          expect(mocks.session).not.toHaveBeenCalled();
     });

     it('rejects disabled/revoked sessions before loading trend metadata', async () => {
          mocks.session.mockResolvedValue(false);
          expect((await call('tests')).status).toBe(401);
          expect(mocks.session).toHaveBeenCalledWith(21, 2);
          expect(mocks.list).not.toHaveBeenCalled();
     });

     it('uses only authenticated patient and facility, not caller-controlled identity parameters', async () => {
          const response = await call('8?page=2&count=10&patientid=999&tenantId=999');
          expect(response.status).toBe(200);
          expect(response.cache).toBe('no-store');
          expect(mocks.tenants).toEqual([4, 4]);
          expect(mocks.history).toHaveBeenCalledExactlyOnceWith(21, 8, 2, 10);
          expect(mocks.audit).toHaveBeenCalledWith(4, expect.objectContaining({ patientid: 21, actorId: 21, action: 'results.trends.view', resourceId: 8 }));
     });

     it('lists available tests without exposing staff endpoints', async () => {
          expect((await call('tests')).status).toBe(200);
          expect(mocks.list).toHaveBeenCalledExactlyOnceWith(21);
          expect(mocks.history).not.toHaveBeenCalled();
     });

     it.each(['0', '-1', '8junk', '8?page=0', '8?page=1.5', '8?count=101', '8?count=1&count=2', '8?page=99999999999999999999'])('rejects malformed identifiers/pagination: %s', async path => {
          expect((await call(path)).status).toBe(400);
          expect(mocks.history).not.toHaveBeenCalled();
     });

     it('returns a generic error without disclosing clinical or database details', async () => {
          mocks.history.mockRejectedValue(new Error('sensitive database/clinical detail'));
          const response = await call('8');
          expect(response.status).toBe(500);
          expect(JSON.stringify(response.body)).not.toContain('sensitive');
     });
});
