import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
     authority: vi.fn(), setStatus: vi.fn(), getSubscription: vi.fn(), setPlan: vi.fn(), recordPayment: vi.fn(), voidPayment: vi.fn(), listAudit: vi.fn(),
     list: vi.fn(), options: vi.fn(), provision: vi.fn(), retry: vi.fn(), logError: vi.fn(), deleteTenant: vi.fn(),
     getPublicProfile: vi.fn(), putPublicProfile: vi.fn(), getSmsProvider: vi.fn(), setSmsProvider: vi.fn(), setModuleConfiguration: vi.fn(),
     getModulePricing: vi.fn(), getAllModulePricing: vi.fn(), putModulePricing: vi.fn(),
     listPlans: vi.fn(), upsertPlan: vi.fn(), platformUpgradeRequests: vi.fn(), decideUpgradeRequest: vi.fn(), assignPlan: vi.fn(),
}));
vi.mock('../../middleware/platformFacilityAuthority', () => ({ requirePlatformFacilityAuthority: mocks.authority }));
vi.mock('../../hooks/logger', () => ({ default: { error: mocks.logError, info: vi.fn(), warn: vi.fn() } }));
vi.mock('../../models/Tenancy/FacilityProvisioningService', () => ({
     FacilityProvisioningService: class { list = mocks.list; options = mocks.options; provision = mocks.provision; retry = mocks.retry; },
}));
vi.mock('../../models/Tenancy/FacilityManagementService', () => ({
     FacilityManagementService:      class {
          setStatus = mocks.setStatus; getSubscription = mocks.getSubscription; setPlan = mocks.setPlan;
          recordPayment = mocks.recordPayment; voidPayment = mocks.voidPayment; listAudit = mocks.listAudit;
          deleteTenant = mocks.deleteTenant;
          getSmsProvider = mocks.getSmsProvider; setSmsProvider = mocks.setSmsProvider;
          setModuleConfiguration = mocks.setModuleConfiguration;
     },
}));
vi.mock('../../models/public/PublicFacilityRegistry', () => ({
     PublicFacilityRegistry: class { get = mocks.getPublicProfile; put = mocks.putPublicProfile; },
}));
vi.mock('../../models/Tenancy/FacilityModulePricingCatalog', () => ({
     FacilityModulePricingCatalog: class {
          get = mocks.getModulePricing; getAll = mocks.getAllModulePricing; put = mocks.putModulePricing;
     },
}));
vi.mock('../../models/Tenancy/FacilitySubscriptionTiers', () => ({
     FacilitySubscriptionTierService: class {
          listPlans = mocks.listPlans; upsertPlan = mocks.upsertPlan;
          platformUpgradeRequests = mocks.platformUpgradeRequests; decideUpgradeRequest = mocks.decideUpgradeRequest;
          assignPlan = mocks.assignPlan;
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
               'get /api/v1/platform/facilities/options', 'get /api/v1/platform/facilities',
               'get /api/v1/platform/facilities/module-pricing', 'put /api/v1/platform/facilities/module-pricing',
               'get /api/v1/platform/facilities/plans', 'put /api/v1/platform/facilities/plans/:code',
               'get /api/v1/platform/facilities/upgrade-requests',
               'post /api/v1/platform/facilities/upgrade-requests/:id/approve',
               'post /api/v1/platform/facilities/upgrade-requests/:id/reject',
               'put /api/v1/platform/facilities/:tenantId/plan',
               'post /api/v1/platform/facilities',
               'post /api/v1/platform/facilities/:tenantId/retry',
               'get /api/v1/platform/facilities/:tenantId/public-profile', 'put /api/v1/platform/facilities/:tenantId/public-profile',
               'delete /api/v1/platform/facilities/:tenantId',
               'patch /api/v1/platform/facilities/:tenantId/status', 'get /api/v1/platform/facilities/:tenantId/subscription',
               'put /api/v1/platform/facilities/:tenantId/subscription', 'put /api/v1/platform/facilities/:tenantId/modules',
               'post /api/v1/platform/facilities/:tenantId/payments',
               'get /api/v1/platform/facilities/:tenantId/audit',
               'get /api/v1/platform/facilities/:tenantId/sms-provider', 'put /api/v1/platform/facilities/:tenantId/sms-provider',
               'delete /api/v1/platform/facilities/:tenantId/payments/:paymentId',
          ]);
          for (const route of routes) {
               expect(route.stack).toHaveLength(2);
               expect(route.stack[0].handle).toBe(mocks.authority);
          }
     });

     it('serves and updates the platform pricing catalog through its authorized routes', async () => {
          const catalog = { currency: 'GHS', modules: { pharmacy: '1.00' } };
          mocks.getModulePricing.mockResolvedValue(catalog);
          const defaultRead = await invoke('get', '/api/v1/platform/facilities/module-pricing', {});
          expect(mocks.getModulePricing).toHaveBeenCalledWith(undefined);
          expect(defaultRead.json).toHaveBeenCalledWith({ status: 'success', result: catalog });

          const read = await invoke('get', '/api/v1/platform/facilities/module-pricing', {
               query: { currency: 'GHS' },
          });
          expect(mocks.getModulePricing).toHaveBeenCalledWith('GHS');
          expect(read.json).toHaveBeenCalledWith({ status: 'success', result: catalog });

          mocks.putModulePricing.mockResolvedValue(catalog);
          const saved = await invoke('put', '/api/v1/platform/facilities/module-pricing', { body: catalog });
          expect(mocks.putModulePricing).toHaveBeenCalledWith(catalog);
          expect(saved.json).toHaveBeenCalledWith({ status: 'success', result: catalog });

          const allCatalogs = [catalog, { currency: 'USD', modules: { pharmacy: '2.00' } }];
          mocks.getAllModulePricing.mockResolvedValue(allCatalogs);
          const all = await invoke('get', '/api/v1/platform/facilities/module-pricing', {
               query: { all: 'true' },
          });
          expect(mocks.getAllModulePricing).toHaveBeenCalledOnce();
          expect(mocks.getModulePricing).toHaveBeenCalledTimes(2);
          expect(all.json).toHaveBeenCalledWith({ status: 'success', result: allCatalogs });
     });

     it('routes tier edits, facility assignment and upgrade decisions with the authenticated platform actor', async () => {
          const actor = { tenantId: 123456, employeeId: 9 };
          const tier = { code: 'basic', name: 'Basic', monthlyPrice: '10.00' };
          mocks.listPlans.mockResolvedValue([tier]);
          const listed = await invoke('get', '/api/v1/platform/facilities/plans', {});
          expect(listed.json).toHaveBeenCalledWith({ status: 'success', result: [tier] });

          mocks.upsertPlan.mockResolvedValue(tier);
          const saved = await invoke('put', '/api/v1/platform/facilities/plans/:code', {
               params: { code: 'basic' }, body: { name: 'Basic' },
          });
          expect(mocks.upsertPlan).toHaveBeenCalledWith('basic', { name: 'Basic' }, actor);
          expect(saved.json).toHaveBeenCalledWith({ status: 'success', result: tier });

          mocks.assignPlan.mockResolvedValue({ tenantId: 654321, plan: { code: 'basic', name: 'Basic' } });
          const assigned = await invoke('put', '/api/v1/platform/facilities/:tenantId/plan', {
               params: { tenantId: '654321' }, body: { planCode: 'basic' },
          });
          expect(mocks.assignPlan).toHaveBeenCalledWith(654321, 'basic', actor);
          expect(assigned.json).toHaveBeenCalledWith({ status: 'success', result: {
               tenantId: 654321, plan: { code: 'basic', name: 'Basic' },
          } });

          mocks.decideUpgradeRequest.mockResolvedValue({ id: 17, status: 'approved' });
          const approved = await invoke('post', '/api/v1/platform/facilities/upgrade-requests/:id/approve', {
               params: { id: '17' },
          });
          expect(mocks.decideUpgradeRequest).toHaveBeenCalledWith('17', 'approve', actor);
          expect(approved.json).toHaveBeenCalledWith({ status: 'success', result: { id: 17, status: 'approved' } });
          mocks.decideUpgradeRequest.mockResolvedValue({ id: 17, status: 'rejected' });
          const rejected = await invoke('post', '/api/v1/platform/facilities/upgrade-requests/:id/reject', {
               params: { id: '17' }, body: { reason: 'Not eligible' },
          });
          expect(mocks.decideUpgradeRequest).toHaveBeenLastCalledWith('17', 'reject', actor, 'Not eligible');
          expect(rejected.json).toHaveBeenCalledWith({ status: 'success', result: { id: 17, status: 'rejected' } });
     });


     it('validates and retries a failed facility using the path tenant and authenticated actor', async () => {
          const body = {
               companyName: 'Example Lab', email: 'lab@example.test', phone: '0201234567', address: 'Example Street',
               countryId: 1, stateId: 2, districtId: 3, adminName: 'Administrator',
               adminEmail: 'admin@example.test', adminPassword: 'a-long-test-password',
          };
          mocks.retry.mockResolvedValue({ tenantId: 654321, organizationIdentifier: 'NRAM1' });
          const res = await invoke('post', '/api/v1/platform/facilities/:tenantId/retry', {
               params: { tenantId: '654321' }, body,
          });
          expect(mocks.retry).toHaveBeenCalledWith(654321, expect.objectContaining({
               ...body, licenseDays: 365, street: '', gpsAddress: '', moduleConfiguration: null,
          }), res.locals.facilityActor);
          expect(res.json).toHaveBeenCalledWith({
               status: 'success', result: { tenantId: 654321, organizationIdentifier: 'NRAM1' },
          });
     });

     it('uses the validated path tenant and authenticated actor for public profile writes', async () => {
          const body = { slug: 'synthetic-lab', published: false, catalogPublished: false };
          mocks.putPublicProfile.mockResolvedValue({ profile: body });
          const res = await invoke('put', '/api/v1/platform/facilities/:tenantId/public-profile', { params: { tenantId: '654321' }, body });
          expect(mocks.putPublicProfile).toHaveBeenCalledWith(654321, body, res.locals.facilityActor);
          expect(res.json).toHaveBeenCalledWith({ status: 'success', result: { profile: body } });
     });

     it.each([true, false])('validates deletion reason and returns databasePreserved=%s with the authenticated actor', async databasePreserved => {
          mocks.deleteTenant.mockResolvedValue({ deleted: true, databasePreserved });
          const res = await invoke('delete', '/api/v1/platform/facilities/:tenantId', {
               params: { tenantId: '654321' }, body: { confirmation: 'NRAM11', reason: ' Test cleanup ', employeeid: 1 },
          });
          expect(mocks.deleteTenant).toHaveBeenCalledWith(654321, 'NRAM11', 'Test cleanup', { tenantId: 123456, employeeId: 9 });
          expect(res.json).toHaveBeenCalledWith({ status: 'success', result: { deleted: true, databasePreserved } });
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

     it('validates module configuration and uses the path tenant plus authenticated actor', async () => {
          const body = {
               branchMode: 'multiple', currency: 'GHS', modules: {
                    pharmacy: { enabled: true, monthlyPrice: '100.25' },
                    email: { enabled: true, monthlyPrice: '20.25' },
                    sms: { enabled: false, monthlyPrice: '50.00' },
                    inventory: { enabled: true, monthlyPrice: '10.00' },
                    deviceInterfacing: { enabled: false, monthlyPrice: '0.00' },
               },
          };
          const result = { tenantId: 654321, moduleConfiguration: { ...body, monthlyTotal: '130.50' }, monthlyTotal: '130.50' };
          mocks.setModuleConfiguration.mockResolvedValue(result);
          const saved = await invoke('put', '/api/v1/platform/facilities/:tenantId/modules', {
               params: { tenantId: '654321' }, body,
          });
          expect(mocks.setModuleConfiguration).toHaveBeenCalledWith(654321,
               expect.objectContaining({
                    ...body, modules: expect.objectContaining(body.modules), monthlyTotal: '130.50',
               }), saved.locals.facilityActor);
          expect(saved.json).toHaveBeenCalledWith({ status: 'success', result });

          const invalid = await invoke('put', '/api/v1/platform/facilities/:tenantId/modules', {
               params: { tenantId: '654321' }, body: { ...body, branchMode: 'unlimited' },
          });
          expect(invalid.status).toHaveBeenCalledWith(400);
          expect(mocks.setModuleConfiguration).toHaveBeenCalledOnce();
          const invalidTenant = await invoke('put', '/api/v1/platform/facilities/:tenantId/modules', {
               params: { tenantId: '12' }, body,
          });
          expect(invalidTenant.status).toHaveBeenCalledWith(400);
          expect(mocks.setModuleConfiguration).toHaveBeenCalledOnce();
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

     it('reads and writes per-facility SMS provider settings using the path tenant and authenticated actor', async () => {
          const settings = { configured: true, providerType: 'arkesel', apiKey: '********3456', senderId: 'PRIMELAB' };
          mocks.getSmsProvider.mockResolvedValue({ tenantId: 654321, settings });
          const read = await invoke('get', '/api/v1/platform/facilities/:tenantId/sms-provider', { params: { tenantId: '654321' } });
          expect(mocks.getSmsProvider).toHaveBeenCalledWith(654321);
          expect(read.json).toHaveBeenCalledWith({ status: 'success', result: { tenantId: 654321, settings } });

          mocks.setSmsProvider.mockResolvedValue({ tenantId: 654321, settings });
          const body = { senderId: 'PRIMELAB', baseUrl: 'https://sms.arkesel.com/api/v2', apiKey: 'secret-key', isActive: true };
          const saved = await invoke('put', '/api/v1/platform/facilities/:tenantId/sms-provider', { params: { tenantId: '654321' }, body });
          expect(mocks.setSmsProvider).toHaveBeenCalledWith(654321,
               { providerType: 'arkesel', senderId: 'PRIMELAB', baseUrl: 'https://sms.arkesel.com/api/v2', apiKey: 'secret-key', isActive: true },
               { tenantId: 123456, employeeId: 9 });
          expect(saved.json).toHaveBeenCalledWith({ status: 'success', result: { tenantId: 654321, settings } });

          for (const invalid of [{ senderId: '', baseUrl: 'https://sms.arkesel.com' }, { senderId: 'A', baseUrl: 'http://sms.arkesel.com' },
               { senderId: 'A', baseUrl: 'https://sms.attacker.test' }, { senderId: 'A' }]) {
               const bad = await invoke('put', '/api/v1/platform/facilities/:tenantId/sms-provider', { params: { tenantId: '654321' }, body: invalid });
               expect(bad.status).toHaveBeenCalledWith(400);
          }
          expect(mocks.setSmsProvider).toHaveBeenCalledTimes(1);
     });
});