import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ settings: vi.fn() }));
vi.mock('../../appsettings/appset', () => ({ default: class { getAllAppSettings = mocks.settings; } }));
import { isEmailModuleActivated } from './emailModuleActivation';

const config = (enabled: boolean) => JSON.stringify({
     branchMode: 'single', currency: 'GHS', modules: {
          pharmacy: { enabled: false, monthlyPrice: '0' }, email: { enabled, monthlyPrice: '10' },
          sms: { enabled: false, monthlyPrice: '0' }, inventory: { enabled: false, monthlyPrice: '0' },
          deviceInterfacing: { enabled: false, monthlyPrice: '0' },
     },
});
describe('provisioned email activation', () => {
     beforeEach(() => vi.clearAllMocks());
     it('honors explicit disabled entitlement even if legacy flags are subsequently enabled', async () => {
          mocks.settings.mockResolvedValue({ emailModuleActivated: 1, services: { isEmailServicesConnected: 1 }, moduleConfiguration: config(false) });
          expect(await isEmailModuleActivated(654321)).toBe(false);
     });
     it('allows enabled email and retains legacy behavior without a module configuration', async () => {
          mocks.settings.mockResolvedValue({ moduleConfiguration: config(true) });
          expect(await isEmailModuleActivated(654321)).toBe(true);
          mocks.settings.mockResolvedValue({ emailModuleActivated: 1 });
          expect(await isEmailModuleActivated(654321)).toBe(true);
     });
     it('surfaces malformed entitlement configuration', async () => {
          mocks.settings.mockResolvedValue({ moduleConfiguration: '{' });
          await expect(isEmailModuleActivated(654321)).rejects.toThrow();
     });
});
