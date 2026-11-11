import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { once } from 'node:events';

const mocks = vi.hoisted(() => ({ list: vi.fn(), results: vi.fn(), tenants: [] as number[] }));
vi.mock('../../models/clinician-portal/ClinicianPortalResultService', async (importOriginal) => {
     const actual: any = await importOriginal();
     return {
          ...actual,
          ClinicianPortalResultService: class {
               constructor(tenant: number) { mocks.tenants.push(tenant); }
               listRequests = mocks.list;
               getRequestResults = mocks.results;
          },
     };
});
import { clinicianPortalRouter } from './route';

const clinician = { role: 'clinician', clinicianid: 7, employeeid: 7, tenantId: 4 };
async function call(path: string, user: any = clinician, practitioner?: any) {
     const app = express();
     // The real app sets authUser in checkTokenExists; this exercises the router's own boundary.
     app.use((req, _res, next) => { (req as any).authUser = user; (req as any).practitioner = practitioner; next(); });
     app.use(clinicianPortalRouter);
     const server = app.listen(0, '127.0.0.1');
     await once(server, 'listening');
     try {
          const address = server.address() as any;
          const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/clinician-portal/${path}`);
          return { status: response.status, cache: response.headers.get('cache-control'), body: await response.json() };
     } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

beforeEach(() => {
     vi.clearAllMocks();
     mocks.tenants.length = 0;
     mocks.list.mockResolvedValue([]);
     mocks.results.mockResolvedValue({ tests: [], reports: [] });
});

describe('clinician portal results router', () => {
     it('uses the same linked practitioner scope for staff request lists and result details', async () => {
          const user={role:'doctor',employeeid:20,tenantId:4,branch:2};
          const access={clinicianid:7,staff_employeeid:20,branchid:2};
          expect((await call('requests?from=2026-11-01&to=2026-11-11',user,access)).status).toBe(200);
          expect((await call('results/900',user,access)).status).toBe(200);
          expect(mocks.results).toHaveBeenCalledWith(7,900,2);
          expect((await call('results/900?clinicianid=8',user,access)).status).toBe(403);
     });
     it('uses the session clinician and tenant', async () => {
          const response = await call('results/900?clinicianid=7&tenantId=99');
          expect(response.status).toBe(200);
          expect(response.cache).toBe('no-store');
          expect(mocks.tenants).toEqual([4]);
          expect(mocks.results).toHaveBeenCalledExactlyOnceWith(7, 900);
     });

     it('refuses a clinician reading another clinician\'s requests', async () => {
          expect((await call('results/900?clinicianid=8')).status).toBe(403);
          expect((await call('requests?clinicianid=8&from=2026-10-01&to=2026-10-02')).status).toBe(403);
          expect(mocks.results).not.toHaveBeenCalled();
          expect(mocks.list).not.toHaveBeenCalled();
     });

     it.each([null, { ...clinician, role: 'patient', patientid: 21 }, { ...clinician, role: 'organization' }])('refuses unauthenticated or external sessions: %j', async user => {
          const response = await call('results/900?clinicianid=7', user);
          expect([401, 403]).toContain(response.status);
          expect(mocks.results).not.toHaveBeenCalled();
     });

     it('surfaces ownership failures from the service as not found', async () => {
          const { ClinicianPortalError } = await import('../../models/clinician-portal/ClinicianPortalResultService');
          mocks.results.mockRejectedValue(new ClinicianPortalError('Request not found', 404, 'NOT_FOUND'));
          const response = await call('results/901');
          expect(response.status).toBe(404);
     });

     it.each(['results/0', 'results/abc', 'results/9.5', 'requests?from=2026-13-01&to=2026-10-02', 'requests?from=2026-10-05&to=2026-10-02'])('rejects malformed input: %s', async path => {
          expect((await call(path)).status).toBe(400);
     });

     it('lists only the session clinician\'s requests for the date range', async () => {
          const response = await call('requests?from=2026-10-01&to=2026-10-31');
          expect(response.status).toBe(200);
          expect(mocks.list).toHaveBeenCalledExactlyOnceWith(7, '2026-10-01', '2026-10-31');
     });

     it('returns a generic error without leaking internals', async () => {
          mocks.results.mockRejectedValue(new Error('sensitive SQL detail'));
          const response = await call('results/900');
          expect(response.status).toBe(500);
          expect(JSON.stringify(response.body)).not.toContain('sensitive');
     });
});
