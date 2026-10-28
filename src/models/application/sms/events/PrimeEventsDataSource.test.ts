import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ connection: vi.fn(), send: vi.fn(), event: vi.fn(), info: vi.fn() }));
vi.mock('../../../../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('../../../../hooks/configuration', () => ({ configuration: { isMultiTenant: false } }));
vi.mock('../../../clincians/clinicianClass', () => ({ default: class {} }));
vi.mock('../../../organization/organization', () => ({ default: class {} }));
vi.mock('../../../registration/registration', () => ({ default: class {} }));
vi.mock('../../../settings/companyProfile', () => ({ getAllCompanyProfiles: vi.fn() }));
vi.mock('../../integrations/Arkesel', () => ({ SmsService: class { sendSms = mocks.send; } }));
vi.mock('../PrimeSms/SmsMessageParser', () => ({ SmsMessageParser: class {} }));
vi.mock('./PrimesmsEventsRepository', () => ({ PrimesmsEventsRepository: class { findByCode = mocks.event; } }));
vi.mock('../../../../hooks/logger', () => ({ default: { info: mocks.info } }));
import { PrimeEventsSMSDataSource } from './PrimeEventsDataSource';

const config = (enabled: boolean) => JSON.stringify({
     branchMode: 'single', currency: 'GHS', modules: {
          pharmacy: { enabled: false, monthlyPrice: '0' }, email: { enabled: false, monthlyPrice: '0' },
          sms: { enabled, monthlyPrice: '10' }, inventory: { enabled: false, monthlyPrice: '0' },
          deviceInterfacing: { enabled: false, monthlyPrice: '0' },
     },
});
describe('facility SMS event activation', () => {
     beforeEach(() => vi.clearAllMocks());
     const settings = (moduleConfiguration?: string, smsActivated = 1) =>
          mocks.connection.mockResolvedValue(() => ({ where: () => ({ first: async () => ({ moduleConfiguration, smsActivated }) }) }));
     it('does not send automatic SMS for a disabled facility and logs the skip', async () => {
          settings(config(false));
          const source = new PrimeEventsSMSDataSource(654321);
          expect(await source.isEventActive('registration')).toBe(false);
          expect(await source.sendSMSMessage('message', '0201234567', 'registration', 1, true, 1)).toEqual({ status: false });
          expect(mocks.send).not.toHaveBeenCalled();
          expect(mocks.info).toHaveBeenCalled();
     });
     it('preserves legacy event behavior and permits activated SMS', async () => {
          mocks.event.mockResolvedValue({ active: 1 });
          settings();
          expect(await new PrimeEventsSMSDataSource(654321).isEventActive('registration')).toBe(true);
          settings(config(true));
          expect(await new PrimeEventsSMSDataSource(654321).isEventActive('registration')).toBe(true);
     });
     it('surfaces corrupt configuration before any provider call', async () => {
          settings('{');
          await expect(new PrimeEventsSMSDataSource(654321).sendSMSMessage('message', '0201234567', 'registration', 1, true, 1)).rejects.toThrow();
          expect(mocks.send).not.toHaveBeenCalled();
     });
     it('honours the SMS activation switch even for legacy facilities without module configuration', async () => {
          settings(undefined, 0);
          expect(await new PrimeEventsSMSDataSource(654321).isEventActive('registration')).toBe(false);
          expect(mocks.send).not.toHaveBeenCalled();
     });
});
