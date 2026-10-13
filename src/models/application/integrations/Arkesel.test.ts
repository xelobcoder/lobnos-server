import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmsService } from './Arkesel';

describe('SmsService', () => {
     afterEach(() => vi.unstubAllGlobals());

     it('uses the supplied tenant provider configuration when sending', async () => {
          const fetchMock = vi.fn().mockResolvedValue({
               ok: true,
               json: async () => ({ status: 'success', code: 200 }),
          });
          vi.stubGlobal('fetch', fetchMock);
          const service = new SmsService(123456, {
               apiKey: 'tenant-api-key',
               defaultSender: 'PrimeLab',
               baseUrl: 'https://sms.arkesel.com',
          });

          await service.sendSms(['0241234567'], 'Result ready');

          expect(fetchMock).toHaveBeenCalledWith('https://sms.arkesel.com/api/v2/sms/send', expect.objectContaining({
               headers: expect.objectContaining({ 'api-key': 'tenant-api-key' }),
               body: JSON.stringify({
                    sender: 'PrimeLab',
                    message: 'Result ready',
                    recipients: ['0241234567'],
               }),
          }));
     });
});
