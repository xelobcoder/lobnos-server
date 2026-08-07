import assert from 'node:assert/strict';
import { TemplateRenderer } from '../services/TemplateRenderer';
import { EmailTemplatesService } from '../services/EmailTemplatesService';
import { EmailProvidersService } from '../services/EmailProvidersService';
import { EmailSettingsService } from '../services/EmailSettingsService';
import { EmailQueueService } from '../services/EmailQueueService';

type TestCase = { name: string; run: () => Promise<void> | void };

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
          queueRepo,
          logsRepo,
          templatesRepo,
          providersRepo,
          settingsRepo,
          providerFactory,
          templateRenderer,
     );
}

const tests: TestCase[] = [
     {
          name: 'TemplateRenderer replaces placeholders',
          run: () => {
               const renderer = new TemplateRenderer();
               const result = renderer.render('Hello {{PatientName}}', '<p>{{PatientName}}</p>', '{{PatientName}}', { PatientName: 'Ama' });
               assert.equal(result.subject, 'Hello Ama');
               assert.equal(result.htmlBody, '<p>Ama</p>');
               assert.equal(result.plainTextBody, 'Ama');
          },
     },
     {
          name: 'EmailTemplatesService.preview throws on missing template',
          run: async () => {
               const service = new EmailTemplatesService({ findById: async () => null } as any, new TemplateRenderer());
               await assert.rejects(() => service.preview(10, {}), /Template not found/);
          },
     },
     {
          name: 'EmailProvidersService.testProvider delegates to factory',
          run: async () => {
               let tested = false;
               const provider = {
                    id: 2,
                    name: 'SMTP',
                    provider_type: 'smtp',
                    host: 'smtp.example.com',
                    port: 465,
                    secure: true,
                    username: 'u',
                    password: 'p',
                    from_email: 'lab@example.com',
                    from_name: 'Prime Lab',
                    is_default: true,
                    is_active: true,
               };
               const service = new EmailProvidersService(
                    { findById: async () => provider } as any,
                    {
                         create: () => ({
                              testConnection: async () => {
                                   tested = true;
                                   return true;
                              },
                         }),
                    } as any,
               );
               const ok = await service.testProvider(2);
               assert.equal(ok, true);
               assert.equal(tested, true);
          },
     },
     {
          name: 'EmailSettingsService updates mapped payload',
          run: async () => {
               let captured: any;
               const repo = {
                    upsert: async (payload: any) => {
                         captured = payload;
                    },
                    get: async () => ({ id: 1, default_provider_id: 1, max_retries: 3, max_attachment_size_mb: 10, retry_backoff_minutes_json: '[2,10,30]', allow_marketing_emails: true }),
               };
               const service = new EmailSettingsService(repo as any);
               await service.updateSettings({ maxRetries: 4, retryBackoffMinutes: [1, 3], allowMarketingEmails: false });
               assert.equal(captured.max_retries, 4);
               assert.equal(captured.retry_backoff_minutes_json, JSON.stringify([1, 3]));
               assert.equal(captured.allow_marketing_emails, false);
          },
     },
     {
          name: 'EmailQueueService queueEmail rejects empty subject/html',
          run: async () => {
               const service = createQueueService();
               await assert.rejects(
                    () => service.queueEmail({ to: ['p@example.com'], cc: [], bcc: [], variables: {}, attachments: [], priority: 'normal' }),
                    /Email subject and HTML body are required/,
               );
          },
     },
     {
          name: 'EmailQueueService marks success as sent',
          run: async () => {
               const updates: any[] = [];
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
               });

               await service.processSingle(9);
               assert.equal(updates[0].status, 'processing');
               assert.equal(updates[1].status, 'sent');
          },
     },
];

async function runAll() {
     let failed = 0;

     for (const t of tests) {
          try {
               await t.run();
               console.log(`PASS ${t.name}`);
          } catch (error: any) {
               failed += 1;
               console.error(`FAIL ${t.name}`);
               console.error(error?.stack || error?.message || error);
          }
     }

     console.log(`\nEmail tests complete: ${tests.length - failed}/${tests.length} passed`);
     if (failed > 0) process.exit(1);
}

runAll();
