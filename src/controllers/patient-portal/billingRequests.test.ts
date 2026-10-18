import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { once } from 'node:events';

const mocks = vi.hoisted(() => ({
     tenants: [] as number[], list: vi.fn(), catalog: vi.fn(), create: vi.fn(), detail: vi.fn(),
     convert: vi.fn(), reject: vi.fn(), session: vi.fn(),
}));
vi.mock('../../models/patient-portal/PatientBillingRequestService', () => ({
     PatientBillingRequestService: class {
          constructor(tenant: number) { mocks.tenants.push(tenant); }
          list = mocks.list; catalog = mocks.catalog; create = mocks.create;
          detail = mocks.detail; convert = mocks.convert; reject = mocks.reject;
     },
}));
vi.mock('../../models/patient-portal/PatientPortalAccountService', async importOriginal => {
     const actual: any = await importOriginal();
     return { ...actual, PatientPortalAccountService: class { isSessionValid = mocks.session; } };
});

import { BILLING_REQUEST_ROLES, createBillingRequestsRouter } from './billingRequests';
import { requirePatientSession, requireStaff } from './route';

describe('patient billing request HTTP authorization and identity', () => {
     let server: ReturnType<express.Express['listen']>;
     let base: string;
     const identities: any = {
          patient: { role: 'patient', patientid: 101, tenantId: 3, sessionVersion: 1 },
          admin: { role: 'admin', employeeid: 12, tenantId: 3, branch: 4 },
          frontdesk: { role: 'customer service representative', employeeid: 13, tenantId: 3, branch: 4 },
          clinician: { role: 'clinician', employeeid: 14, tenantId: 3, branch: 4 },
     };
     beforeEach(async () => {
          vi.clearAllMocks();
          mocks.tenants.length = 0;
          mocks.session.mockResolvedValue(true);
          mocks.create.mockResolvedValue({ id: 1, status: 'submitted' });
          mocks.list.mockResolvedValue([]);
          mocks.catalog.mockResolvedValue([]);
          mocks.convert.mockResolvedValue({ status: true, billingid: 9000 });
          const app = express();
          app.use(express.json());
          app.use((req, _res, next) => { (req as any).authUser = identities[String(req.headers['test-actor'])]; next(); });
          app.use('/api/v1/patient-portal', createBillingRequestsRouter(requirePatientSession, requireStaff(BILLING_REQUEST_ROLES)));
          server = app.listen(0, '127.0.0.1');
          await once(server, 'listening');
          base = `http://127.0.0.1:${(server.address() as any).port}/api/v1/patient-portal`;
     });
     afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
     const request = (path: string, actor: string, body?: unknown) => fetch(base + path, {
          method: body ? 'POST' : 'GET', headers: { 'test-actor': actor, 'content-type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
     });

     it('uses session patient and tenant even when query/body claim another identity', async () => {
          const response = await request('/billing-requests?tenantId=999', 'patient', { patientid: 999, testIds: [1] });
          expect(response.status).toBe(200);
          expect(response.headers.get('cache-control')).toBe('no-store');
          expect(mocks.tenants).toEqual([3]);
          expect(mocks.create).toHaveBeenCalledWith(101, expect.anything());
          await request('/billing-requests?patientid=999&tenantId=999', 'patient');
          expect(mocks.list).toHaveBeenCalledWith(101, 1);
     });
     it('denies anonymous, staff on patient endpoints, and expired patient sessions', async () => {
          expect((await request('/billing-requests', 'anonymous')).status).toBe(403);
          expect((await request('/billing-requests', 'admin')).status).toBe(403);
          mocks.session.mockResolvedValue(false);
          expect((await request('/billing-requests', 'patient')).status).toBe(401);
          expect(mocks.list).not.toHaveBeenCalled();
     });
     it('denies patients and clinicians staff list/review/conversion access', async () => {
          for (const actor of ['patient', 'clinician']) {
               expect((await request('/admin/billing-requests', actor)).status).toBe(403);
               expect((await request('/admin/billing-requests/1/convert', actor, {})).status).toBe(403);
          }
          expect(mocks.convert).not.toHaveBeenCalled();
     });
     it.each(['admin', 'frontdesk'])('permits authorized %s and binds conversion actor/branch to session', async actor => {
          const response = await request('/admin/billing-requests/1/convert?tenantId=999', actor, { employeeid: 999, branchid: 999 });
          expect(await response.json()).toMatchObject({ status: true, billingid: 9000 });
          expect(mocks.convert).toHaveBeenCalledWith(1, identities[actor].employeeid, 4, expect.anything());
          expect(mocks.tenants).toEqual([3]);
     });
     it('rejects invalid ids and masks unexpected internal failures', async () => {
          expect((await request('/admin/billing-requests/NaN', 'admin')).status).toBe(400);
          mocks.list.mockRejectedValue(new Error('SQL private provider details'));
          const response = await request('/admin/billing-requests', 'admin');
          expect(response.status).toBe(500);
          expect(JSON.stringify(await response.json())).not.toContain('SQL');
     });
});
