import { CreateEmailJobDto } from '../dtos/CreateEmailJobDto';
import { RetryEmailDto } from '../dtos/RetryEmailDto';
import { EMAIL_STATUSES } from '../constants/EmailStatus';
import { EmailLogsRepo } from '../repositories/EmailLogsRepo';
import { EmailProvidersRepo } from '../repositories/EmailProvidersRepo';
import { EmailQueueRepo } from '../repositories/EmailQueueRepo';
import { EmailSettingsRepo } from '../repositories/EmailSettingsRepo';
import { EmailTemplatesRepo } from '../repositories/EmailTemplatesRepo';
import { EmailDispatchResult, ResolvedEmailJob } from '../types/EmailModels';
import { ensureEmailModuleActivated } from '../helpers/emailModuleActivation';
import { ProviderFactory } from './ProviderFactory';
import { TemplateRenderer } from './TemplateRenderer';

export class EmailQueueService {
     constructor(
          private queueRepo: EmailQueueRepo,
          private logsRepo: EmailLogsRepo,
          private templatesRepo: EmailTemplatesRepo,
          private providersRepo: EmailProvidersRepo,
          private settingsRepo: EmailSettingsRepo,
          private providerFactory: ProviderFactory,
          private templateRenderer: TemplateRenderer,
     ) { }

     private async ensureActivated() {
          await ensureEmailModuleActivated(this.queueRepo.getTenantId());
     }

     async queueEmail(dto: CreateEmailJobDto) {
          await this.ensureActivated();
          let subject = dto.subject || '';
          let htmlBody = dto.htmlBody || '';
          let plainTextBody = dto.plainTextBody || '';

          if (dto.templateId) {
               const template = await this.templatesRepo.findById(dto.templateId);
               if (!template) {
                    throw new Error('Template not found');
               }

               const rendered = this.templateRenderer.render(
                    template.subject,
                    template.html_body,
                    template.plain_text_body,
                    dto.variables,
               );

               subject = rendered.subject;
               htmlBody = rendered.htmlBody;
               plainTextBody = rendered.plainTextBody;
          }

          if (!subject || !htmlBody) {
               throw new Error('Email subject and HTML body are required');
          }

          const queueId = await this.queueRepo.create({
               template_id: dto.templateId ?? null,
               provider_id: dto.providerId ?? null,
               status: dto.scheduledAt ? EMAIL_STATUSES[5] : EMAIL_STATUSES[0],
               priority: dto.priority,
               recipients_json: JSON.stringify(dto.to),
               cc_json: JSON.stringify(dto.cc),
               bcc_json: JSON.stringify(dto.bcc),
               subject,
               html_body: htmlBody,
               plain_text_body: plainTextBody,
               variables_json: JSON.stringify(dto.variables),
               attachments_json: JSON.stringify(dto.attachments),
               scheduled_at: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
               retry_count: 0,
               next_retry_at: null,
               reference_type: dto.referenceType ?? null,
               reference_id: dto.referenceId ?? null,
               created_by: dto.createdBy ?? null,
          });

          return this.queueRepo.findById(queueId);
     }

     async getQueue(limit = 50) {
          return this.queueRepo.findAll(limit);
     }

     async getLogs(limit = 100) {
          return this.logsRepo.findAll(limit);
     }

     async getAnalytics(days = 30) {
          await this.ensureActivated();

          const [overview, statusBreakdown, eventBreakdown, providerPerformance, queueMetrics, dailyTrend, failureReasons] = await Promise.all([
               this.logsRepo.getOverview(days),
               this.logsRepo.getStatusBreakdown(days),
               this.logsRepo.getEventBreakdown(days),
               this.logsRepo.getProviderPerformance(days),
               this.queueRepo.getQueueMetrics(),
               this.logsRepo.getDailyTrend(days),
               this.logsRepo.getFailureReasons(days),
          ]);

          return {
               periodDays: days,
               overview,
               statusBreakdown,
               eventBreakdown,
               providerPerformance,
               queueMetrics,
               dailyTrend,
               failureReasons,
          };
     }

     async processQueue(limit = 20) {
          await this.ensureActivated();
          const jobs = await this.queueRepo.findProcessable(limit);
          const results = [];

          for (const job of jobs) {
               results.push(await this.processSingle(job.id as number));
          }

          return results;
     }

     async retryEmail(dto: RetryEmailDto) {
          const queueItem = await this.queueRepo.findById(dto.queueId);
          if (!queueItem) {
               throw new Error('Queued email not found');
          }

          await this.queueRepo.update(dto.queueId, {
               status: 'pending',
               next_retry_at: dto.forceImmediate ? new Date() : queueItem.next_retry_at ?? new Date(),
               failure_reason: null,
          });

          return this.queueRepo.findById(dto.queueId);
     }

     async processSingle(queueId: number) {
          await this.ensureActivated();
          const queueItem = await this.queueRepo.findById(queueId);
          if (!queueItem) {
               throw new Error('Queued email not found');
          }

          const resolved = await this.resolveJob(queueItem.id as number);
          const startedAt = Date.now();

          await this.queueRepo.update(queueId, {
               status: 'processing',
               failure_reason: null,
          });

          const provider = await this.providersRepo.findById(resolved.providerId);
          if (!provider) {
               throw new Error('Provider not found');
          }

          const driver = this.providerFactory.create(provider);
          const result = await driver.send(resolved);
          return this.finalizeDispatch(queueItem.id as number, provider.id as number, result, Date.now() - startedAt, queueItem.retry_count);
     }

     private async resolveJob(queueId: number): Promise<ResolvedEmailJob> {
          const queueItem = await this.queueRepo.findById(queueId);
          if (!queueItem) {
               throw new Error('Queued email not found');
          }

          const settings = await this.settingsRepo.get();
          const providerId = queueItem.provider_id
               ?? settings?.default_provider_id
               ?? (await this.providersRepo.findDefault())?.id;

          if (!providerId) {
               throw new Error('No active email provider configured');
          }

          const provider = await this.providersRepo.findById(providerId);
          if (!provider || !provider.is_active) {
               throw new Error('Configured provider is unavailable');
          }

          return {
               queueId,
               providerId,
               fromEmail: provider.from_email,
               fromName: provider.from_name,
               to: JSON.parse(queueItem.recipients_json || '[]'),
               cc: JSON.parse(queueItem.cc_json || '[]'),
               bcc: JSON.parse(queueItem.bcc_json || '[]'),
               subject: queueItem.subject,
               htmlBody: queueItem.html_body,
               plainTextBody: queueItem.plain_text_body,
               attachments: JSON.parse(queueItem.attachments_json || '[]'),
          };
     }

     private async finalizeDispatch(
          queueId: number,
          providerId: number,
          result: EmailDispatchResult,
          durationMs: number,
          retryCount: number,
     ) {
          const settings = await this.settingsRepo.get();
          const maxRetries = settings?.max_retries ?? 3;
          const retryBackoff = JSON.parse(settings?.retry_backoff_minutes_json || '[2,10,30]') as number[];

          if (result.success) {
               await this.queueRepo.update(queueId, {
                    status: 'sent',
                    provider_id: providerId,
                    sent_at: new Date(),
                    failure_reason: null,
                    provider_message_id: result.providerMessageId ?? null,
               });
          } else {
               const nextCount = retryCount + 1;
               const shouldRetry = nextCount <= maxRetries;
               const retryMinutes = retryBackoff[Math.min(nextCount - 1, retryBackoff.length - 1)] ?? 30;
               await this.queueRepo.update(queueId, {
                    status: shouldRetry ? 'failed' : 'cancelled',
                    provider_id: providerId,
                    failure_reason: result.failureReason ?? 'Email send failed',
                    retry_count: nextCount,
                    next_retry_at: shouldRetry ? new Date(Date.now() + retryMinutes * 60 * 1000) : null,
               });
          }

          await this.logsRepo.create({
               queue_id: queueId,
               provider_id: providerId,
               status: result.success ? 'sent' : (retryCount + 1 <= maxRetries ? 'failed' : 'cancelled'),
               recipients_json: JSON.stringify((await this.queueRepo.findById(queueId))?.recipients_json || '[]'),
               subject: (await this.queueRepo.findById(queueId))?.subject || '',
               response_payload_json: result.responsePayload ? JSON.stringify(result.responsePayload) : null,
               failure_reason: result.failureReason ?? null,
               duration_ms: durationMs,
          });

          return this.queueRepo.findById(queueId);
     }
}
