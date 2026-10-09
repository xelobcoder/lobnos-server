import test from 'node:test';
import assert from 'node:assert/strict';
import { EmailQueueService } from '../services/EmailQueueService';
import { ProviderFactory } from '../services/ProviderFactory';
import { TemplateRenderer } from '../services/TemplateRenderer';

function createQueueService(overrides: Partial<{
     queueRepo: any;
     logsRepo: any;
     templatesRepo: any;
     providersRepo: any;
     settingsRepo: any;
     providerFactory: any;
     templateRenderer: any;
}> = {}) {
     const queueRepo = overrides.queueRepo ?? {
          create: async () => 1,
          findById: async (id: number) => ({
               id,
               template_id: null,
               provider_id: 2,
               status: 'pending',
               priority: 'normal',
               recipients_json: JSON.stringify(['patient@example.com']),
               cc_json: JSON.stringify([]),
               bcc_json: JSON.stringify([]),
               subject: 'Ready',
               html_body: '<p>Ready</p>',
               plain_text_body: 'Ready',
               variables_json: JSON.stringify({}),
               attachments_json: JSON.stringify([]),
               retry_count: 0,
               next_retry_at: null,
          }),
          findAll: async () => [],
          findProcessable: async () => [],
          update: async () => 1,
     };
     const logsRepo = overrides.logsRepo ?? { create: async () => 1, findAll: async () => [] };
     const templatesRepo = overrides.templatesRepo ?? { findById: async () => null };
     const providersRepo = overrides.providersRepo ?? {
          findById: async () => ({
               id: 2,
               provider_type: 'smtp',
               host: 'smtp.example.com',
               port: 587,
               secure: false,
               username: 'user',
               password: 'pass',
               from_email: 'lab@example.com',
               from_name: 'Prime Lab',
               is_active: true,
          }),
          findDefault: async () => ({ id: 2 }),
     };
     const settingsRepo = overrides.settingsRepo ?? {
          get: async () => ({
               default_provider_id: 2,
               max_retries: 3,
               retry_backoff_minutes_json: JSON.stringify([2, 10, 30]),
          }),
     };
     const providerFactory = overrides.providerFactory ?? {
          create: () => ({
               send: async () => ({ success: true, providerMessageId: 'msg-1', responsePayload: { ok: true } }),
          }),
     };
     const templateRenderer = overrides.templateRenderer ?? new TemplateRenderer();

     return new EmailQueueService(
          { getTenantId: () => 1, ...queueRepo },
          logsRepo,
          templatesRepo,
          providersRepo,
          settingsRepo,
          providerFactory,
          templateRenderer,
          async () => undefined,
     );
}

test('EmailQueueService.queueEmail renders template-backed jobs before queuing', async () => {
     let captured: any;
     const service = createQueueService({
          templatesRepo: {
               findById: async () => ({
                    id: 10,
                    subject: 'Hello {{PatientName}}',
                    html_body: '<p>{{PatientName}}</p>',
                    plain_text_body: '{{PatientName}}',
               }),
          },
          queueRepo: {
               create: async (payload: any) => {
                    captured = payload;
                    return 5;
               },
               findById: async (id: number) => ({ id, ...captured }),
          },
     });

     const result = await service.queueEmail({
          templateId: 10,
          providerId: 2,
          to: ['patient@example.com'],
          cc: [],
          bcc: [],
          variables: { PatientName: 'Adjoa' },
          attachments: [],
          priority: 'normal',
          createdBy: 7,
     });

     assert.equal(captured.subject, 'Hello Adjoa');
     assert.equal(captured.html_body, '<p>Adjoa</p>');
     assert.equal(captured.plain_text_body, 'Adjoa');
     assert.equal(result?.id, 5);
});

test('EmailQueueService.queueEmail rejects jobs without subject or html body', async () => {
     const service = createQueueService();

     await assert.rejects(
          () => service.queueEmail({
               to: ['patient@example.com'],
               cc: [],
               bcc: [],
               variables: {},
               attachments: [],
               priority: 'normal',
               createdBy: 1,
          }),
          /Email subject and HTML body are required/,
     );
});

test('EmailQueueService.retryEmail resets failed jobs to pending', async () => {
     const updates: any[] = [];
     const service = createQueueService({
          queueRepo: {
               findById: async (id: number) => ({ id, next_retry_at: null }),
               update: async (_id: number, payload: any) => {
                    updates.push(payload);
                    return 1;
               },
          },
     });

     await service.retryEmail({ queueId: 4, forceImmediate: false });

     assert.equal(updates[0].status, 'pending');
     assert.equal(updates[0].failure_reason, null);
});

test('EmailQueueService.processSingle marks successful dispatches as sent', async () => {
     const updates: any[] = [];
     let logPayload: any;
     const queueRecord = {
          id: 9,
          template_id: null,
          provider_id: 2,
          status: 'pending',
          priority: 'normal',
          recipients_json: JSON.stringify(['patient@example.com']),
          cc_json: JSON.stringify([]),
          bcc_json: JSON.stringify([]),
          subject: 'Ready',
          html_body: '<p>Ready</p>',
          plain_text_body: 'Ready',
          variables_json: JSON.stringify({}),
          attachments_json: JSON.stringify([]),
          retry_count: 0,
          next_retry_at: null,
     };
     const service = createQueueService({
          queueRepo: {
               findById: async () => queueRecord,
               update: async (_id: number, payload: any) => {
                    updates.push(payload);
                    return 1;
               },
          },
          logsRepo: {
               create: async (payload: any) => {
                    logPayload = payload;
                    return 1;
               },
          },
     });

     const result = await service.processSingle(9);

     assert.equal(updates[0].status, 'processing');
     assert.equal(updates[1].status, 'sent');
     assert.equal(logPayload.status, 'sent');
     assert.equal(result?.id, 9);
});

test('EmailQueueService.processSingle schedules retry after failed dispatch', async () => {
     const updates: any[] = [];
     const queueRecord = {
          id: 12,
          template_id: null,
          provider_id: 2,
          status: 'pending',
          priority: 'normal',
          recipients_json: JSON.stringify(['patient@example.com']),
          cc_json: JSON.stringify([]),
          bcc_json: JSON.stringify([]),
          subject: 'Ready',
          html_body: '<p>Ready</p>',
          plain_text_body: 'Ready',
          variables_json: JSON.stringify({}),
          attachments_json: JSON.stringify([]),
          retry_count: 0,
          next_retry_at: null,
     };
     const service = createQueueService({
          queueRepo: {
               findById: async () => queueRecord,
               update: async (_id: number, payload: any) => {
                    updates.push(payload);
                    return 1;
               },
          },
          providerFactory: {
               create: () => ({
                    send: async () => ({ success: false, failureReason: 'SMTP unavailable' }),
               }),
          },
     });

     await service.processSingle(12);

     assert.equal(updates[1].status, 'failed');
     assert.equal(updates[1].retry_count, 1);
     assert.equal(updates[1].failure_reason, 'SMTP unavailable');
     assert.ok(updates[1].next_retry_at instanceof Date);
});
