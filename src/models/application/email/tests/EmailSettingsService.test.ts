import test from 'node:test';
import assert from 'node:assert/strict';
import { EmailSettingsService } from '../services/EmailSettingsService';

test('EmailSettingsService.getSettings seeds defaults when none exist', async () => {
     let current: any = null;
     let upsertCalled = false;
     const repo = {
          get: async () => current,
          upsert: async () => {
               upsertCalled = true;
               current = {
                    id: 1,
                    default_provider_id: null,
                    max_attachment_size_mb: 10,
                    max_retries: 3,
                    retry_backoff_minutes_json: JSON.stringify([2, 10, 30]),
                    allow_marketing_emails: true,
               };
          },
     };

     const service = new EmailSettingsService(repo as any);
     const result = await service.getSettings();

     assert.equal(upsertCalled, true);
     assert.equal(result?.max_retries, 3);
});

test('EmailSettingsService.updateSettings maps DTO fields for persistence', async () => {
     let captured: any;
     const repo = {
          get: async () => ({
               id: 1,
               default_provider_id: 5,
               max_attachment_size_mb: 15,
               max_retries: 2,
               retry_backoff_minutes_json: JSON.stringify([3, 6]),
               allow_marketing_emails: false,
          }),
          upsert: async (payload: any) => {
               captured = payload;
          },
     };

     const service = new EmailSettingsService(repo as any);
     const result = await service.updateSettings({
          defaultProviderId: 8,
          maxAttachmentSizeMb: 25,
          maxRetries: 4,
          retryBackoffMinutes: [1, 5, 15],
          allowMarketingEmails: true,
          updatedBy: 99,
     });

     assert.deepEqual(captured, {
          default_provider_id: 8,
          max_attachment_size_mb: 25,
          max_retries: 4,
          retry_backoff_minutes_json: JSON.stringify([1, 5, 15]),
          allow_marketing_emails: true,
          updated_by: 99,
     });
     assert.equal(result?.default_provider_id, 5);
});
