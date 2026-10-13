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
import { facilityModuleAccess, moduleForApiPath } from './facilityModuleAccess';

const config = { branchMode: 'single', currency: 'GHS', modules: {
     pharmacy: { enabled: false, monthlyPrice: '0' }, email: { enabled: false, monthlyPrice: '0' },
     sms: { enabled: false, monthlyPrice: '0' }, inventory: { enabled: false, monthlyPrice: '0' },
     deviceInterfacing: { enabled: false, monthlyPrice: '0' },
} };
describe('facility activation enforcement', () => {
     beforeEach(() => {
          vi.clearAllMocks();
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
     it('allows enabled modules and preserves legacy facilities with no explicit config', async () => {
          const enabled = { ...config, modules: { ...config.modules, inventory: { enabled: true, monthlyPrice: '1' } } };
          expect(await invoke('/api/v1/inventory/items', JSON.stringify(enabled))).toHaveBeenCalledOnce();
          expect(await invoke('/api/v1/pharmacy/sales', null)).toHaveBeenCalledOnce();
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
});
