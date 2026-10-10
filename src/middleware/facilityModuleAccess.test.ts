import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Request, Response } from 'express';
const mocks = vi.hoisted(() => ({ connection: vi.fn(), error: vi.fn(), responseError: vi.fn(), log: vi.fn() }));
vi.mock('../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('../hooks/helper', () => ({ customError: mocks.error, responseError: mocks.responseError }));
vi.mock('../hooks/logger', () => ({ default: { error: mocks.log } }));
import { facilityModuleAccess, moduleForApiPath } from './facilityModuleAccess';

const config = { branchMode: 'single', currency: 'GHS', modules: {
     pharmacy: { enabled: false, monthlyPrice: '0' }, email: { enabled: false, monthlyPrice: '0' },
     sms: { enabled: false, monthlyPrice: '0' }, inventory: { enabled: false, monthlyPrice: '0' },
     deviceInterfacing: { enabled: false, monthlyPrice: '0' },
} };
describe('facility activation enforcement', () => {
     beforeEach(() => vi.clearAllMocks());
     const invoke = async (path: string, settings: unknown = JSON.stringify(config), method = 'GET') => {
          mocks.connection.mockResolvedValue(() => ({ where: () => ({ first: async () => ({ moduleConfiguration: settings }) }) }));
          const next = vi.fn();
          await facilityModuleAccess({ path, method, query: { tenantId: '654321' } } as unknown as Request, {} as Response, next);
          return next;
     };
     it.each(['/api/v1/pharmacy/sales', '/api/v1/inventory/items', '/api/v1/email/queue',
          '/api/v1/sms/events', '/api/v1/prime/sms-analytics/job-status-counts',
          '/api/v1/interfacing/devices', '/api/v1/devices/interfacing/verified/devices',
          '/API/V1/Pharmacy/sales', '/api/v1/EMAIL/queue'])('blocks disabled module %s', async path => {
          const next = await invoke(path);
          expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('not activated'), 403, expect.anything());
          expect(next).not.toHaveBeenCalled();
     });
     it('allows enabled modules and preserves legacy facilities with no explicit config', async () => {
          const enabled = { ...config, modules: { ...config.modules, inventory: { enabled: true, monthlyPrice: '1' } } };
          expect(await invoke('/api/v1/inventory/items', JSON.stringify(enabled))).toHaveBeenCalledOnce();
          expect(await invoke('/api/v1/pharmacy/sales', null)).toHaveBeenCalledOnce();
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
