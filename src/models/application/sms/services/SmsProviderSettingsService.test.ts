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

it('retains signing secrets and sandbox mode when an older settings client omits the new fields',async()=>{
 const repo=repository({api_key:'saved-key',webhook_secret:'saved-signing-secret',require_signed_webhooks:1,sandbox:1,low_credit_threshold:50});
 await new SmsProviderSettingsService(repo).save({providerType:'arkesel',senderId:'PrimeLab',baseUrl:'https://sms.arkesel.com',isActive:true},7);
 expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({webhook_secret:'saved-signing-secret',require_signed_webhooks:true,sandbox:true,low_credit_threshold:50}));
});
it('refuses required signatures until a secret exists and never returns the raw secret to administration',async()=>{
 const repo=repository({api_key:'saved-key'}),service=new SmsProviderSettingsService(repo);
 await expect(service.save({providerType:'arkesel',senderId:'PrimeLab',baseUrl:'https://sms.arkesel.com',isActive:true,requireSignedWebhooks:true},7)).rejects.toThrow('webhook secret');
 const result=await new SmsProviderSettingsService(repository({api_key:'saved-key',webhook_secret:'never-return-this'})).getForAdministration();
 expect(JSON.stringify(result)).not.toContain('never-return-this');expect(result).toMatchObject({webhookConfigured:true});
});
