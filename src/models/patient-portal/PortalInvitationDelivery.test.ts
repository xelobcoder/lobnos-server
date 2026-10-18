import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Knex } from 'knex';
const mocks = vi.hoisted(() => ({
     provider: vi.fn(), emailSend: vi.fn(), smsConfig: vi.fn(), smsSend: vi.fn(), platform: vi.fn(),
     multi: false,
}));
vi.mock('../../hooks/configuration', () => ({ configuration: { get isMultiTenant() { return mocks.multi; } } }));
vi.mock('../../database/connection', () => ({ systemConfigConnection: mocks.platform }));
vi.mock('../application/email/repositories/EmailProvidersRepo', () => ({ EmailProvidersRepo: class { findDefault = mocks.provider; } }));
vi.mock('../application/email/services/ProviderFactory', () => ({ ProviderFactory: class { create() { return { send: mocks.emailSend }; } } }));
vi.mock('../application/integrations/Arkesel', () => ({ SmsService: class { sendSms = mocks.smsSend; } }));
vi.mock('../application/sms/repositories/SmsProviderSettingsRepo', () => ({ SmsProviderSettingsRepo: class {} }));
vi.mock('../application/sms/services/SmsProviderSettingsService', () => ({ SmsProviderSettingsService: class { getActiveConfiguration = mocks.smsConfig; } }));
import { invitationPhone, PortalInvitationDelivery } from './PortalInvitationDelivery';

const patient = { email: 'patient@example.test', mobile_number: '+233 24 123 4567' };
const config = (email = true, sms = true) => JSON.stringify({
     branchMode: 'single', currency: 'GHS',
     modules: Object.fromEntries(['pharmacy', 'email', 'sms', 'inventory', 'deviceInterfacing', 'commissions',
          'analytics', 'appointments', 'expenses', 'consultations', 'imaging'].map(name =>
          [name, { enabled: name === 'email' ? email : name === 'sms' ? sms : false, monthlyPrice: '0' }])),
});
const db = (settings: unknown = { smsActivated: 1 }) =>
     (() => ({ where: () => ({ first: async () => settings }) })) as unknown as Knex;
const url = 'https://portal.example.test';
const service = () => new PortalInvitationDelivery(4);

describe('invitation channel eligibility and facility provider acceptance', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          mocks.multi = false;
          mocks.provider.mockResolvedValue({ id: 2, provider_type: 'smtp', host: 'smtp.example.test', port: 587,
               username: 'lab@example.test', password: 'synthetic', from_email: 'lab@example.test' });
          mocks.emailSend.mockResolvedValue({ success: true });
          mocks.smsSend.mockResolvedValue({ status: 'success' });
          mocks.smsConfig.mockResolvedValue({ apiKey: 'synthetic', defaultSender: 'Lab', baseUrl: 'https://sms.example.test' });
          mocks.platform.mockReturnValue({ where: () => ({ first: async () => ({ configuration: config() }) }) });
     });

     it.each(['0241234567', '241234567', '+233241234567', '00233241234567'])('normalizes supported facility phone %s', phone => {
          expect(invitationPhone(phone)).toBe('0241234567');
     });
     it.each(['', 'call 0241234567', '+14155552671', '123', '1111111111', '0241234567 ext 1'])('rejects malformed/unsupported phone %s', phone => {
          expect(invitationPhone(phone)).toBeNull();
     });
     it('returns available channels without secrets or raw destinations', async () => {
          const result = await service().availability(db(), patient, url);
          expect(result).toEqual({ email: { available: true, reason: null }, sms: { available: true, reason: null } });
          expect(JSON.stringify(result)).not.toMatch(/synthetic|024|patient@/);
          expect(mocks.emailSend).not.toHaveBeenCalled();
          expect(mocks.smsSend).not.toHaveBeenCalled();
     });
     it('requires valid contacts and configured public URL', async () => {
          const contacts = await service().availability(db(), { email: 'invalid', mobile_number: 'invalid' }, url);
          expect(contacts.email).toMatchObject({ available: false, reason: expect.stringContaining('email address') });
          expect(contacts.sms).toMatchObject({ available: false, reason: expect.stringContaining('mobile number') });
          const missingUrl = await service().availability(db(), patient, '');
          expect(missingUrl.email.available).toBe(false);
          expect(missingUrl.sms.reason).toContain('URL');
     });
     it('requires email module enablement, SMS activation and local authorization', async () => {
          const disabled = await service().availability(db({ smsActivated: 1, moduleConfiguration: config(false, false) }), patient, url);
          expect(disabled.email.available).toBe(false);
          expect(disabled.sms.available).toBe(false);
          expect(mocks.provider).not.toHaveBeenCalled();
          expect(mocks.smsConfig).not.toHaveBeenCalled();
          expect((await service().availability(db({ smsActivated: 0 }), patient, url)).sms.available).toBe(false);
     });
     it.each([null, { configuration: config(true, false) }])('fails closed without platform SMS entitlement (%j)', async platform => {
          mocks.multi = true;
          mocks.platform.mockReturnValue({ where: () => ({ first: async () => platform }) });
          const result = await service().availability(db(), patient, url);
          expect(result.sms.available).toBe(false);
          expect(mocks.platform).toHaveBeenCalled();
          expect(mocks.smsConfig).not.toHaveBeenCalled();
     });
     it('allows authorized multitenant SMS only with facility activation', async () => {
          mocks.multi = true;
          expect((await service().availability(db(), patient, url)).sms.available).toBe(true);
          expect((await service().availability(db({ smsActivated: 0 }), patient, url)).sms.available).toBe(false);
     });
     it('fails closed on malformed entitlement configuration', async () => {
          const result = await service().availability(db({ smsActivated: 1, moduleConfiguration: '{' }), patient, url);
          expect(result.email.available).toBe(false);
          expect(result.sms.available).toBe(false);
     });
     it('reports missing or disabled providers without exposing their errors', async () => {
          mocks.provider.mockResolvedValue(null);
          mocks.smsConfig.mockRejectedValue(new Error('synthetic secret'));
          const result = await service().availability(db(), patient, url);
          expect(result.email).toMatchObject({ available: false, reason: expect.stringContaining('not configured') });
          expect(result.sms).toMatchObject({ available: false, reason: expect.stringContaining('disabled') });
          expect(JSON.stringify(result)).not.toContain('synthetic secret');
     });
     it('disables incomplete email and SMS provider configuration', async () => {
          mocks.provider.mockResolvedValue({ id: 2 });
          mocks.smsConfig.mockResolvedValue({ apiKey: '', defaultSender: 'Lab', baseUrl: '' });
          const result = await service().availability(db(), patient, url);
          expect(result.email.available).toBe(false);
          expect(result.sms.available).toBe(false);
     });
     it.each(['email', 'sms'] as const)('reports %s provider acceptance, not delivery', async channel => {
          const result = await service().send(channel, patient, `${url}/invite?token=synthetic`, new Date());
          expect(result).toEqual({ channel, status: 'accepted', reason: null });
          if (channel === 'email') {
               expect(mocks.emailSend).toHaveBeenCalledWith(expect.objectContaining({ to: [patient.email], queueId: 0 }));
               expect(mocks.smsSend).not.toHaveBeenCalled();
          } else {
               expect(mocks.smsSend).toHaveBeenCalledWith(['0241234567'], expect.stringContaining('Single use'));
               expect(mocks.emailSend).not.toHaveBeenCalled();
          }
     });
     it.each(['email', 'sms'] as const)('reports %s provider rejection and exceptions as failed without secrets', async channel => {
          mocks.emailSend.mockResolvedValue({ success: false });
          mocks.smsSend.mockResolvedValue({ status: 'error', message: 'synthetic secret' });
          expect(await service().send(channel, patient, url, new Date())).toMatchObject({ channel, status: 'failed' });
          mocks.emailSend.mockRejectedValue(new Error('synthetic secret'));
          mocks.smsSend.mockRejectedValue(new Error('synthetic secret'));
          const result = await service().send(channel, patient, url, new Date());
          expect(result.status).toBe('failed');
          expect(JSON.stringify(result)).not.toContain('synthetic secret');
     });
});
