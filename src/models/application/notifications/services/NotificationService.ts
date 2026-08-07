import { EmailQueueRepo } from '../../email/repositories/EmailQueueRepo';
import { TriggerNotificationByReferenceDto, TriggerNotificationDto } from '../dtos/NotificationDtos';
import { NotificationEventRecipientsRepo } from '../repositories/NotificationEventRecipientsRepo';
import { NotificationEventSettingsRepo } from '../repositories/NotificationEventSettingsRepo';
import { NotificationEventsRepo } from '../repositories/NotificationEventsRepo';
import { NotificationQueueRepo } from '../repositories/NotificationQueueRepo';
import { NotificationTemplatesRepo } from '../repositories/NotificationTemplatesRepo';
import { EmailQueueService } from '../../email/services/EmailQueueService';
import { isEmailModuleActivated } from '../../email/helpers/emailModuleActivation';
import { NotificationTemplateRenderer } from './NotificationTemplateRenderer';
import { NotificationEventContextService } from './NotificationEventContextService';
import { RecipientResolver } from './RecipientResolver';

export class NotificationService {
     constructor(
          private eventsRepo: NotificationEventsRepo,
          private templatesRepo: NotificationTemplatesRepo,
          private settingsRepo: NotificationEventSettingsRepo,
          private recipientsRepo: NotificationEventRecipientsRepo,
          private notificationQueueRepo: NotificationQueueRepo,
          private emailQueueRepo: EmailQueueRepo,
          private emailQueueService: EmailQueueService,
          private renderer: NotificationTemplateRenderer,
          private recipientResolver: RecipientResolver,
          private contextService: NotificationEventContextService,
          private tenantId: number,
     ) { }

     async trigger(dto: TriggerNotificationDto) {
          const emailModuleEnabled = await isEmailModuleActivated(this.tenantId);
          if (!emailModuleEnabled) {
               return {
                    queued: false,
                    reason: 'Email module is not activated.',
               };
          }

          const event = await this.eventsRepo.findByCode(dto.eventCode);
          if (!event || !event.is_active) throw new Error('Notification event not found');

          const settings = await this.settingsRepo.findByEventId(event.id as number);
          if (settings && !settings.email_enabled) {
               return {
                    queued: false,
                    reason: 'Email channel disabled for this event',
               };
          }

          const template = await this.templatesRepo.findActiveForEvent(event.id as number);
          if (!template) throw new Error('No active template found for event');

          const recipientRules = await this.recipientsRepo.findByEventId(event.id as number);
          const recipients = recipientRules.length > 0
               ? this.recipientResolver.resolve(recipientRules, dto.context as Record<string, unknown>, dto.recipients)
               : this.recipientResolver.resolveFallback(event.event_code, dto.context as Record<string, unknown>, dto.recipients);

          if (recipients.to.length === 0) {
               return {
                    queued: false,
                    reason: 'No valid recipients found for event',
               };
          }

          const rendered = this.renderer.render(
               template.subject,
               template.html_body || '',
               template.plain_body || '',
               dto.context as Record<string, unknown>,
          );

          const notificationQueueId = await this.notificationQueueRepo.create({
               event_id: event.id as number,
               event_code: event.event_code,
               channel: 'email',
               template_id: template.id as number,
               priority: dto.priority,
               status: 'pending',
               scheduled_at: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
               attempts: 0,
               max_attempts: 3,
               payload_json: JSON.stringify(dto.context || {}),
               created_by: dto.createdBy ?? null,
          });

          const emailQueueId = await this.emailQueueRepo.create({
               template_id: null,
               provider_id: null,
               status: dto.scheduledAt ? 'scheduled' : 'pending',
               priority: dto.priority,
               recipients_json: JSON.stringify(recipients.to),
               cc_json: JSON.stringify(recipients.cc),
               bcc_json: JSON.stringify(recipients.bcc),
               subject: rendered.subject,
               html_body: rendered.htmlBody,
               plain_text_body: rendered.plainBody,
               variables_json: JSON.stringify(dto.context || {}),
               attachments_json: JSON.stringify([]),
               scheduled_at: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
               retry_count: 0,
               next_retry_at: null,
               reference_type: 'notification_event',
               reference_id: String(notificationQueueId),
               created_by: dto.createdBy ?? null,
          });

          await this.notificationQueueRepo.update(notificationQueueId, {
               email_queue_id: emailQueueId,
          });

          if (!dto.scheduledAt) {
               try {
                    await this.emailQueueService.processSingle(emailQueueId);
               } catch (_error) {
                    // Keep notification queue item available for manual retry if immediate dispatch fails.
               }
          }

          return {
               queued: true,
               notificationQueueId,
               emailQueueId,
               recipients,
          };
     }

     async getQueue(limit = 100) {
          return this.notificationQueueRepo.findAll(limit);
     }

     async getQueueById(id: number) {
          return this.notificationQueueRepo.findById(id);
     }

     async retryQueueItem(id: number) {
          const queueItem = await this.notificationQueueRepo.findById(id);
          if (!queueItem) throw new Error('Notification queue item not found');

          await this.notificationQueueRepo.markForRetry(id);

          if (queueItem.email_queue_id) {
               await this.emailQueueRepo.update(queueItem.email_queue_id, {
                    status: 'pending',
                    failure_reason: null,
                    next_retry_at: null,
               });

               try {
                    await this.emailQueueService.processSingle(queueItem.email_queue_id);
               } catch (_error) {
                    // Leave in queue for further retries.
               }
          }

          return this.notificationQueueRepo.findById(id);
     }

     async cancelQueueItem(id: number) {
          const queueItem = await this.notificationQueueRepo.findById(id);
          if (!queueItem) throw new Error('Notification queue item not found');

          await this.notificationQueueRepo.cancel(id);

          if (queueItem.email_queue_id) {
               await this.emailQueueRepo.update(queueItem.email_queue_id, {
                    status: 'cancelled',
               });
          }

          return this.notificationQueueRepo.findById(id);
     }

     async getLogs(limit = 100) {
          return this.notificationQueueRepo.findLogs(limit);
     }

     async triggerByReference(dto: TriggerNotificationByReferenceDto) {
          const resolvedContext = await this.contextService.resolveEventContext(
               dto.eventCode,
               dto.references || {},
               dto.context as Record<string, unknown>,
          );

          return this.trigger({
               eventCode: dto.eventCode,
               context: resolvedContext,
               priority: dto.priority,
               scheduledAt: dto.scheduledAt,
               createdBy: dto.createdBy,
               recipients: dto.recipients,
          });
     }
}
