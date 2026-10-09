import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
     authority: vi.fn(), setStatus: vi.fn(), getSubscription: vi.fn(), setPlan: vi.fn(), recordPayment: vi.fn(), voidPayment: vi.fn(), listAudit: vi.fn(),
     list: vi.fn(), options: vi.fn(), provision: vi.fn(), logError: vi.fn(), deleteTenant: vi.fn(),
}));
vi.mock('../../middleware/platformFacilityAuthority', () => ({ requirePlatformFacilityAuthority: mocks.authority }));
vi.mock('../../hooks/logger', () => ({ default: { error: mocks.logError, info: vi.fn(), warn: vi.fn() } }));
vi.mock('../../models/Tenancy/FacilityProvisioningService', () => ({
     FacilityProvisioningService: class { list = mocks.list; options = mocks.options; provision = mocks.provision; },
}));
vi.mock('../../models/Tenancy/FacilityManagementService', () => ({
     FacilityManagementService: class {
          setStatus = mocks.setStatus; getSubscription = mocks.getSubscription; setPlan = mocks.setPlan;
          recordPayment = mocks.recordPayment; voidPayment = mocks.voidPayment; listAudit = mocks.listAudit;
          deleteTenant = mocks.deleteTenant;
     },
}));

import router, { facilityDiagnosticCode } from './facilities';
import { FacilityError } from '../../models/Tenancy/FacilityInput';

const routes = (router as any).stack.filter((layer: any) => layer.route).map((layer: any) => ({
     path: layer.route.path, method: Object.keys(layer.route.methods)[0], stack: layer.route.stack,
}));
const find = (method: string, path: string) => routes.find((r: any) => r.method === method && r.path === path)!;
const response = () => {
     const res: any = { locals: { facilityActor: { tenantId: 123456, employeeId: 9 } } };
     res.status = vi.fn().mockReturnValue(res); res.send = vi.fn().mockReturnValue(res); res.json = vi.fn().mockReturnValue(res);
     return res;
};
const invoke = async (method: string, path: string, req: any) => {
     const res = response();
     await find(method, path).stack[1].handle({ params: {}, query: {}, body: {}, method, route: { path }, ...req }, res);
     return res;
};

describe('platform facility routes', () => {
     beforeEach(() => vi.clearAllMocks());

     it('guards every facility route, existing and new, with the platform authority as the first handler', () => {
          expect(routes.map((r: any) => `${r.method} ${r.path}`)).toEqual([
               'get /api/v1/platform/facilities/options', 'get /api/v1/platform/facilities', 'post /api/v1/platform/facilities',
               'delete /api/v1/platform/facilities/:tenantId',
               'patch /api/v1/platform/facilities/:tenantId/status', 'get /api/v1/platform/facilities/:tenantId/subscription',
               'put /api/v1/platform/facilities/:tenantId/subscription', 'post /api/v1/platform/facilities/:tenantId/payments',
               'get /api/v1/platform/facilities/:tenantId/audit',
               'delete /api/v1/platform/facilities/:tenantId/payments/:paymentId',
          ]);
          for (const route of routes) {
               expect(route.stack).toHaveLength(2);
               expect(route.stack[0].handle).toBe(mocks.authority);
          }
     });

     it('validates deletion reason and passes confirmation with the authenticated actor', async () => {
          mocks.deleteTenant.mockResolvedValue({ deleted: true, databasePreserved: true });
          await invoke('delete', '/api/v1/platform/facilities/:tenantId', {
               params: { tenantId: '654321' }, body: { confirmation: 'NRAM11', reason: ' Test cleanup ', employeeid: 1 },
          });
          expect(mocks.deleteTenant).toHaveBeenCalledWith(654321, 'NRAM11', 'Test cleanup', { tenantId: 123456, employeeId: 9 });
          mocks.deleteTenant.mockClear();
          const bad = await invoke('delete', '/api/v1/platform/facilities/:tenantId', {
               params: { tenantId: '654321' }, body: { confirmation: 'NRAM11', reason: '' },
          });
          expect(bad.status).toHaveBeenCalledWith(400);
          expect(mocks.deleteTenant).not.toHaveBeenCalled();
     });

     it('uses the authenticated actor, never a body-supplied one', async () => {
          mocks.setStatus.mockResolvedValue({ changed: true });
          const res = await invoke('patch', '/api/v1/platform/facilities/:tenantId/status', {
               params: { tenantId: '654321' }, body: { status: 'suspended', reason: 'Unpaid', actor: { tenantId: 1, employeeId: 1 }, employeeid: 1 },
          });
          expect(mocks.setStatus).toHaveBeenCalledWith(654321, { status: 'suspended', reason: 'Unpaid' }, { tenantId: 123456, employeeId: 9 });
          expect(res.json).toHaveBeenCalledWith({ status: 'success', result: { changed: true } });
     });

     it('validates input before calling services', async () => {
          const res = await invoke('patch', '/api/v1/platform/facilities/:tenantId/status', {
               params: { tenantId: '654321' }, body: { status: 'failed', reason: 'xxx' },
          });
          expect(res.status).toHaveBeenCalledWith(400);
          expect(mocks.setStatus).not.toHaveBeenCalled();
          const bad = await invoke('put', '/api/v1/platform/facilities/:tenantId/subscription', {
               params: { tenantId: '654321' }, body: { frequency: 'monthly', amount: 150.5, currency: 'GHS', startDate: '2026-01-31' },
          });
          expect(bad.status).toHaveBeenCalledWith(400);
          const id = await invoke('delete', '/api/v1/platform/facilities/:tenantId/payments/:paymentId', {
               params: { tenantId: '654321', paymentId: 'abc' }, body: { reason: 'dup' },
          });
          expect(id.status).toHaveBeenCalledWith(400);
          expect(mocks.voidPayment).not.toHaveBeenCalled();
     });

     it('passes asOf through and maps explicit errors; hides internal errors', async () => {
          mocks.getSubscription.mockRejectedValueOnce(new FacilityError('Facility not found', 404));
          const missing = await invoke('get', '/api/v1/platform/facilities/:tenantId/subscription', { params: { tenantId: '654321' }, query: { asOf: '2026-01-01' } });
          expect(mocks.getSubscription).toHaveBeenCalledWith(654321, '2026-01-01');
          expect(missing.status).toHaveBeenCalledWith(404);
          mocks.recordPayment.mockRejectedValueOnce(Object.assign(new Error("ER_NO_SUCH_TABLE: SELECT * FROM secret WHERE reference='X'"), { code: 'ER_NO_SUCH_TABLE' }));
          const failed = await invoke('post', '/api/v1/platform/facilities/:tenantId/payments', { params: { tenantId: '654321' }, body: {} });
          expect(failed.status).toHaveBeenCalledWith(503);
          expect(JSON.stringify(failed.send.mock.calls)).not.toMatch(/SELECT|secret/);
          expect(JSON.stringify(mocks.logError.mock.calls)).not.toMatch(/SELECT|secret/);
     });

     it('returns a safe diagnostic code and a reference that matches the log line on unexpected failures', async () => {
          mocks.getSubscription.mockRejectedValueOnce(Object.assign(
               new Error("ER_BAD_FIELD_ERROR: Unknown column 'is_effective' in 'where clause' password=hunter2"), { code: 'ER_BAD_FIELD_ERROR' }));
          const res = await invoke('get', '/api/v1/platform/facilities/:tenantId/subscription', { params: { tenantId: '654321' } });
          expect(res.status).toHaveBeenCalledWith(503);
          const body = res.send.mock.calls[0][0];
          expect(body).toMatchObject({ status: 'error', statusCode: 503, code: 'FACILITY_SCHEMA_MISMATCH', reference: expect.stringMatching(/^FAC-[0-9A-F]{8}$/) });
          expect(body.message).toContain(body.reference);
          const logged = JSON.stringify(mocks.logError.mock.calls);
          expect(logged).toContain(body.reference);
          expect(logged).toContain('ER_BAD_FIELD_ERROR');
          expect(JSON.stringify(body) + logged).not.toMatch(/is_effective|hunter2|where clause/);
     });

     it('maps driver failures to stable diagnostic codes', () => {
          expect(facilityDiagnosticCode({ code: 'ER_NO_SUCH_TABLE' })).toBe('FACILITY_SCHEMA_MISMATCH');
          expect(facilityDiagnosticCode({ code: 'ECONNREFUSED' })).toBe('FACILITY_DATABASE_UNAVAILABLE');
          expect(facilityDiagnosticCode({ code: 'ER_ACCESS_DENIED_ERROR' })).toBe('FACILITY_DATABASE_UNAVAILABLE');
          expect(facilityDiagnosticCode({ name: 'KnexTimeoutError' })).toBe('FACILITY_DATABASE_UNAVAILABLE');
          expect(facilityDiagnosticCode({ code: 'ER_LOCK_DEADLOCK' })).toBe('FACILITY_DATABASE_BUSY');
          expect(facilityDiagnosticCode(new Error('x'))).toBe('FACILITY_INTERNAL_ERROR');
          expect(facilityDiagnosticCode(undefined)).toBe('FACILITY_INTERNAL_ERROR');
     });

     it('serves the audit trail with strict pagination', async () => {
          mocks.listAudit.mockResolvedValue({ events: [], page: 2, pageSize: 50, total: 0 });
          const ok = await invoke('get', '/api/v1/platform/facilities/:tenantId/audit', { params: { tenantId: '654321' }, query: { page: '2', pageSize: '50' } });
          expect(mocks.listAudit).toHaveBeenCalledWith(654321, { page: 2, pageSize: 50 });
          expect(ok.json).toHaveBeenCalledWith({ status: 'success', result: { events: [], page: 2, pageSize: 50, total: 0 } });
          for (const query of [{ pageSize: '101' }, { pageSize: '0' }, { page: '1.5' }, { page: ['1', '2'] }, { sort: 'id' }, { pageSize: ' 5' }]) {
               const bad = await invoke('get', '/api/v1/platform/facilities/:tenantId/audit', { params: { tenantId: '654321' }, query });
               expect(bad.status).toHaveBeenCalledWith(400);
          }
          const badId = await invoke('get', '/api/v1/platform/facilities/:tenantId/audit', { params: { tenantId: '12' } });
          expect(badId.status).toHaveBeenCalledWith(400);
          expect(mocks.listAudit).toHaveBeenCalledTimes(1);
     });
});