import { describe, expect, it, vi } from 'vitest';
import { SmsProviderSettingsService } from './SmsProviderSettingsService';
import { SmsProviderSettingsRepo } from '../repositories/SmsProviderSettingsRepo';

function repository(record: any = null) {
     return {
          find: vi.fn().mockResolvedValue(record),
          save: vi.fn().mockResolvedValue(undefined),
     } as unknown as SmsProviderSettingsRepo;
}

describe('SmsProviderSettingsService', () => {
     it('requires an API key for the initial tenant configuration', async () => {
          const service = new SmsProviderSettingsService(repository());
          await expect(service.save({
               providerType: 'arkesel',
               senderId: 'PrimeLab',
               baseUrl: 'https://sms.arkesel.com',
               isActive: true,
          }, 7)).rejects.toThrow('SMS API key is required');
     });

     it('preserves the stored API key when an owner updates non-secret settings', async () => {
          const repo = repository({ api_key: 'tenant-secret' });
          const service = new SmsProviderSettingsService(repo);
          await service.save({
               providerType: 'arkesel',
               senderId: 'NewSender',
               baseUrl: 'https://sms.arkesel.com/',
               isActive: true,
          }, 7);
          expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
               api_key: 'tenant-secret',
               sender_id: 'NewSender',
               base_url: 'https://sms.arkesel.com',
          }));
     });

     it('masks credentials in administration responses', async () => {
          const service = new SmsProviderSettingsService(repository({
               provider_type: 'arkesel',
               api_key: 'tenant-secret',
               sender_id: 'PrimeLab',
               base_url: 'https://sms.example.test',
               is_active: 1,
               updated_by: 7,
          }));
          await expect(service.getForAdministration()).resolves.toMatchObject({
               configured: true,
               apiKey: '*********cret',
               senderId: 'PrimeLab',
          });
     });

     it('refuses sends when this tenant has no active provider', async () => {
          await expect(new SmsProviderSettingsService(repository()).getActiveConfiguration())
               .rejects.toThrow('not configured for this facility');
          await expect(new SmsProviderSettingsService(repository({ is_active: 0 })).getActiveConfiguration())
               .rejects.toThrow('disabled for this facility');
     });
});
