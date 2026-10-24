import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Request, Response } from 'express';
const mocks = vi.hoisted(() => ({
     connection: vi.fn(), platform: vi.fn(), error: vi.fn(), responseError: vi.fn(), log: vi.fn(),
     multiTenant: { value: true }, platformConfiguration: { value: null as string | null },
}));
vi.mock('../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('../database/connection', () => ({
     systemConfigConnection: (...args: unknown[]) => mocks.platform(...args),
}));
vi.mock('../hooks/configuration', () => ({
     configuration: { get isMultiTenant() { return mocks.multiTenant.value; } },
}));
vi.mock('../hooks/helper', () => ({ customError: mocks.error, responseError: mocks.responseError }));
vi.mock('../hooks/logger', () => ({ default: { error: mocks.log } }));
const tokens = vi.hoisted(() => ({ role: null as string | null, clientType: undefined as string | undefined }));
vi.mock('../models/settings/users/TokenValidator', () => ({
     default: class {
          async validateAccessToken() { return { expired: false }; }
          async decodeAccessToken() { return { role: tokens.role, clientType: tokens.clientType }; }
     },
}));
import { facilityModuleAccess, moduleForApiPath } from './facilityModuleAccess';

const config = { branchMode: 'single', currency: 'GHS', modules: {
     pharmacy: { enabled: false, monthlyPrice: '0' }, email: { enabled: false, monthlyPrice: '0' },
     sms: { enabled: false, monthlyPrice: '0' }, inventory: { enabled: false, monthlyPrice: '0' },
     deviceInterfacing: { enabled: false, monthlyPrice: '0' },
     commissions: { enabled: false, monthlyPrice: '0' }, analytics: { enabled: false, monthlyPrice: '0' },
     appointments: { enabled: false, monthlyPrice: '0' }, expenses: { enabled: false, monthlyPrice: '0' },
     consultations: { enabled: false, monthlyPrice: '0' }, imaging: { enabled: false, monthlyPrice: '0' },
} };
describe('facility activation enforcement', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          tokens.role = null;
          tokens.clientType = undefined;
          mocks.multiTenant.value = true;
          mocks.platformConfiguration.value = JSON.stringify(config);
          mocks.platform.mockReturnValue({
               where: () => ({ first: async () => mocks.platformConfiguration.value
                    ? { configuration: mocks.platformConfiguration.value } : null }),
          });
     });
     const invoke = async (path: string, settings: unknown = JSON.stringify(config), method = 'GET', smsActivated = 1) => {
          mocks.connection.mockResolvedValue(() => ({ where: () => ({ first: async () => ({ moduleConfiguration: settings, smsActivated }) }) }));
          const next = vi.fn();
          await facilityModuleAccess({ path, method, query: { tenantId: '654321' } } as unknown as Request, {} as Response, next);
          return next;
     };
     it.each(['/api/v1/pharmacy/sales', '/api/v1/inventory/items', '/api/v1/email/queue',
          '/api/v1/sms/events', '/api/v1/prime/sms-analytics/job-status-counts',
          '/api/v1/interfacing/devices', '/api/v1/devices/interfacing/verified/devices',
          '/API/V1/Pharmacy/sales', '/api/v1/EMAIL/queue'])('blocks disabled module %s', async path => {
          const next = await invoke(path);
          expect(mocks.error).toHaveBeenCalledWith(expect.stringMatching(/not (?:activated|authorized)/), 403, expect.anything());
          expect(next).not.toHaveBeenCalled();
     });
     it('lets a super admin use a module that is not activated, but not an admin', async () => {
          const call = async (role: string, withToken = true) => {
               tokens.role = role;
               mocks.connection.mockResolvedValue(() => ({ where: () => ({ first: async () => ({ moduleConfiguration: JSON.stringify(config), smsActivated: 1 }) }) }));
               const next = vi.fn();
               const headers = withToken ? { 'pls-prime-tenant-session': 'token' } : {};
               await facilityModuleAccess({ path: '/api/v1/operations/imaging/ultrasound', method: 'GET', headers, query: { tenantId: '654321' } } as unknown as Request, {} as Response, next);
               return next;
          };
          expect(await call('Super Admin')).toHaveBeenCalledOnce();
          expect(await call('admin')).not.toHaveBeenCalled();
          expect(await call('Super Admin', false)).not.toHaveBeenCalled();
     });
     it('allows enabled modules and preserves legacy facilities with no explicit config', async () => {
          const enabled = { ...config, modules: { ...config.modules, inventory: { enabled: true, monthlyPrice: '1' } } };
          expect(await invoke('/api/v1/inventory/items', JSON.stringify(enabled))).toHaveBeenCalledOnce();
          expect(await invoke('/api/v1/pharmacy/sales', null)).toHaveBeenCalledOnce();
     });
     it('does not activate lab inventory through pharmacy activation', async () => {
          const pharmacyOnly = { ...config, modules: { ...config.modules, pharmacy: { enabled: true, monthlyPrice: '1' }, inventory: { enabled: false, monthlyPrice: '0' } } };
          expect(await invoke('/api/v1/pharmacy/sales', JSON.stringify(pharmacyOnly))).toHaveBeenCalledOnce();
          expect(await invoke('/api/v1/inventory/items', JSON.stringify(pharmacyOnly))).not.toHaveBeenCalled();
     });
     it('does not let Device Manager borrow the super-admin module override', async () => {
          tokens.role = 'super-admin';
          tokens.clientType = 'device-manager';
          mocks.connection.mockResolvedValue(() => ({ where: () => ({ first: async () => ({ moduleConfiguration: JSON.stringify(config) }) }) }));
          const next = vi.fn();
          await facilityModuleAccess({
               path: '/api/v1/interfacing/devices', method: 'GET',
               headers: { 'pls-prime-tenant-session': 'manager-token' }, query: { tenantId: '654321' },
          } as unknown as Request, {} as Response, next);
          expect(next).not.toHaveBeenCalled();
          expect(mocks.error).toHaveBeenCalledWith(expect.stringMatching(/not (?:activated|authorized)/), 403, expect.anything());
     });
     it('uses the application setting as the operational SMS switch', async () => {
          const enabled = { ...config, modules: { ...config.modules, sms: { enabled: true, monthlyPrice: '1' } } };
          mocks.platformConfiguration.value = JSON.stringify(enabled);
          expect(await invoke('/api/v1/sms/events', JSON.stringify(enabled), 'GET', 0)).not.toHaveBeenCalled();
          expect(mocks.error).toHaveBeenCalledWith('sms module is not activated for this facility', 403, expect.anything());
          expect(await invoke('/api/v1/sms/events', JSON.stringify(enabled), 'GET', 1)).toHaveBeenCalledOnce();
          expect(await invoke('/api/v1/sms/events', null, 'GET', 0)).not.toHaveBeenCalled();
          expect(await invoke('/api/v1/sms/events', null, 'GET', 1)).toHaveBeenCalledOnce();
     });
     it('requires master-control SMS authorization even when the tenant enables its own flags', async () => {
          const enabled = { ...config, modules: { ...config.modules, sms: { enabled: true, monthlyPrice: '1' } } };
          mocks.platformConfiguration.value = JSON.stringify(config);
          expect(await invoke('/api/v1/sms/events', JSON.stringify(enabled), 'GET', 1)).not.toHaveBeenCalled();
          expect(mocks.error).toHaveBeenCalledWith('sms module is not authorized for this tenant', 403, expect.anything());
          mocks.platformConfiguration.value = null;
          expect(await invoke('/api/v1/sms/events', JSON.stringify(enabled), 'GET', 1)).not.toHaveBeenCalled();
     });
     it('uses local entitlement in single-tenant mode', async () => {
          mocks.multiTenant.value = false;
          const enabled = { ...config, modules: { ...config.modules, sms: { enabled: true, monthlyPrice: '1' } } };
          expect(await invoke('/api/v1/sms/events', JSON.stringify(enabled), 'GET', 1)).toHaveBeenCalledOnce();
          expect(await invoke('/api/v1/sms/events', JSON.stringify(config), 'GET', 1)).not.toHaveBeenCalled();
          expect(mocks.platform).not.toHaveBeenCalled();
     });
     it('prevents adding a branch in single mode but allows it in multiple mode', async () => {
          expect(await invoke('/api/v1/branches', JSON.stringify(config), 'POST')).not.toHaveBeenCalled();
          expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('single branch'), 403, expect.anything());
          expect(await invoke('/API/V1/Branches/', JSON.stringify(config), 'POST')).not.toHaveBeenCalled();
          expect(await invoke('/api/v1/branches', JSON.stringify({ ...config, branchMode: 'multiple' }), 'POST')).toHaveBeenCalledOnce();
          expect(await invoke('/api/v1/branches')).toHaveBeenCalledOnce();
     });
     it('fails explicitly on corrupt stored configuration and ignores unrelated endpoints', async () => {
          expect(await invoke('/api/v1/inventory/items', '{')).not.toHaveBeenCalled();
          expect(mocks.responseError).toHaveBeenCalledOnce();
          expect(moduleForApiPath('/api/v1/prime/login')).toBeNull();
          expect(await invoke('/api/v1/patients')).toHaveBeenCalledOnce();
     });
     it.each([
          ['/api/v1/commission-payments/tracking/12', 'commissions'],
          ['/api/v1/commission/configs', 'commissions'],
          ['/api/v1/patient-analytics/dashboards', 'analytics'],
          ['/api/v1/clinician/anal/monthly/15', 'analytics'],
          ['/api/v1/appointments/month', 'appointments'],
          ['/api/v1/appointment/reminder', 'appointments'],
          ['/api/v1/expenses/analytics/daily', 'expenses'],
          ['/api/v1/expense/merchant', 'expenses'],
          ['/api/v1/records/consulation', 'consultations'],
          ['/api/v1/records/consultation/get/consultation', 'consultations'],
          ['/api/v1/operations/imaging/audit', 'imaging'],
          ['/api/v1/ultrasound/images/upload', 'imaging'],
     ])('maps %s to %s entitlement', (path, module) => {
          expect(moduleForApiPath(path)).toBe(module);
     });
     it.each([
          ['/api/v1/commission-payments/tracking/12', 'commissions'],
          ['/api/v1/patient-analytics/dashboards', 'analytics'],
          ['/api/v1/appointments/month', 'appointments'],
          ['/api/v1/expenses/records', 'expenses'],
          ['/api/v1/records/consulation', 'consultations'],
          ['/api/v1/operations/imaging/audit', 'imaging'],
     ] as const)('enforces the %s %s entitlement in both configuration stores', async (path, module) => {
          const enabledModules = { ...config.modules, [module]: { enabled: true, monthlyPrice: '1.00' } };
          const enabled = { ...config, modules: enabledModules };
          mocks.platformConfiguration.value = JSON.stringify(enabled);
          expect(await invoke(path, JSON.stringify(enabled))).toHaveBeenCalledOnce();

          mocks.platformConfiguration.value = JSON.stringify(config);
          expect(await invoke(path, JSON.stringify(enabled))).not.toHaveBeenCalled();
          expect(mocks.error).toHaveBeenCalledWith(expect.stringMatching(/not authorized/), 403, expect.anything());
     });
     it('fails closed for additional modules on missing or legacy tenant configuration', async () => {
          const oldModules = Object.fromEntries(Object.entries(config.modules).filter(([key]) =>
               !['commissions', 'analytics', 'appointments', 'expenses', 'consultations', 'imaging'].includes(key)));
          const legacy = { ...config, modules: oldModules };
          const platformEnabled = { ...config, modules: {
               ...config.modules, appointments: { enabled: true, monthlyPrice: '1.00' },
          } };
          mocks.platformConfiguration.value = JSON.stringify(platformEnabled);
          expect(await invoke('/api/v1/appointments', null)).not.toHaveBeenCalled();
          expect(mocks.error).toHaveBeenCalledWith(expect.stringMatching(/not activated/), 403, expect.anything());
          mocks.platformConfiguration.value = JSON.stringify(legacy);
          expect(await invoke('/api/v1/appointments', JSON.stringify(legacy))).not.toHaveBeenCalled();
     });
     it('keeps legacy access behavior for existing modules when no module config exists', async () => {
          expect(await invoke('/api/v1/pharmacy/sales', null)).toHaveBeenCalledOnce();
          expect(await invoke('/api/v1/inventory/items', null)).toHaveBeenCalledOnce();
     });
});
