import { EmailLogsRepo } from '../../email/repositories/EmailLogsRepo';
import { EmailProvidersRepo } from '../../email/repositories/EmailProvidersRepo';
import { EmailQueueRepo } from '../../email/repositories/EmailQueueRepo';
import { EmailSettingsRepo } from '../../email/repositories/EmailSettingsRepo';
import { EmailTemplatesRepo } from '../../email/repositories/EmailTemplatesRepo';
import { EmailQueueService } from '../../email/services/EmailQueueService';
import { ProviderFactory } from '../../email/services/ProviderFactory';
import { TemplateRenderer as EmailTemplateRenderer } from '../../email/services/TemplateRenderer';
import { NotificationEventRecipientsRepo } from '../repositories/NotificationEventRecipientsRepo';
import { NotificationEventSettingsRepo } from '../repositories/NotificationEventSettingsRepo';
import { NotificationEventsRepo } from '../repositories/NotificationEventsRepo';
import { NotificationQueueRepo } from '../repositories/NotificationQueueRepo';
import { NotificationTemplatesRepo } from '../repositories/NotificationTemplatesRepo';
import { NotificationTemplateVariablesRepo } from '../repositories/NotificationTemplateVariablesRepo';
import { NotificationTemplateVersionsRepo } from '../repositories/NotificationTemplateVersionsRepo';
import { NotificationEventContextService } from './NotificationEventContextService';
import { NotificationService } from './NotificationService';
import { NotificationTemplateRenderer } from './NotificationTemplateRenderer';
import { RecipientResolver } from './RecipientResolver';

export type NotificationDispatchResult = {
     success: boolean;
     eventCode: string;
     notificationQueueId?: number;
     emailQueueId?: number;
     reason?: string;
     error?: string;
};

export type NotificationDispatchReferences = {
     patientId?: number | string;
     appointmentId?: number | string;
     ascensionId?: number | string;
     billingId?: number | string;
     userId?: number | string;
     payrollId?: number | string;
     purchaseOrderId?: number | string;
     supplierId?: number | string;
     inventoryId?: number | string;
     doctorId?: number | string;
};

function buildNotificationService(tenantId: number) {
     const eventsRepo = new NotificationEventsRepo(tenantId);
     const templatesRepo = new NotificationTemplatesRepo(tenantId);
     const settingsRepo = new NotificationEventSettingsRepo(tenantId);
     const recipientsRepo = new NotificationEventRecipientsRepo(tenantId);
     const notificationQueueRepo = new NotificationQueueRepo(tenantId);
     const emailQueueRepo = new EmailQueueRepo(tenantId);
     const variablesRepo = new NotificationTemplateVariablesRepo(tenantId);
     const versionsRepo = new NotificationTemplateVersionsRepo(tenantId);

     const emailProvidersRepo = new EmailProvidersRepo(tenantId);
     const emailSettingsRepo = new EmailSettingsRepo(tenantId);
     const emailTemplatesRepo = new EmailTemplatesRepo(tenantId);
     const emailLogsRepo = new EmailLogsRepo(tenantId);

     const emailQueueService = new EmailQueueService(
          emailQueueRepo,
          emailLogsRepo,
          emailTemplatesRepo,
          emailProvidersRepo,
          emailSettingsRepo,
          new ProviderFactory(),
          new EmailTemplateRenderer(),
     );

     const renderer = new NotificationTemplateRenderer();
     const recipientResolver = new RecipientResolver();
     const contextService = new NotificationEventContextService(
          eventsRepo,
          templatesRepo,
          variablesRepo,
          versionsRepo,
          tenantId,
     );

     return new NotificationService(
          eventsRepo,
          templatesRepo,
          settingsRepo,
          recipientsRepo,
          notificationQueueRepo,
          emailQueueRepo,
          emailQueueService,
          renderer,
          recipientResolver,
          contextService,
          tenantId,
     );
}

export class NotificationDispatcher {
     static async dispatch(
          tenantId: number,
          eventCode: string,
          references: NotificationDispatchReferences,
          createdBy?: number,
          overrides?: { context?: Record<string, unknown>; recipients?: { to?: string[]; cc?: string[]; bcc?: string[] } },
     ): Promise<NotificationDispatchResult> {
          try {
               const service = buildNotificationService(tenantId);
               const result = await service.triggerByReference({
                    eventCode,
                    references,
                    priority: 'normal',
                    createdBy,
                    recipients: {
                         to: overrides?.recipients?.to ?? [],
                         cc: overrides?.recipients?.cc ?? [],
                         bcc: overrides?.recipients?.bcc ?? [],
                    },
                    context: overrides?.context ?? {},
               });

               if (!result.queued) {
                    return {
                         success: false,
                         eventCode,
                         reason: result.reason ?? 'Notification not queued',
                    };
               }

               return {
                    success: true,
                    eventCode,
                    notificationQueueId: result.notificationQueueId,
                    emailQueueId: result.emailQueueId,
               };
          } catch (error) {
               const message = error instanceof Error ? error.message : String(error);
               return {
                    success: false,
                    eventCode,
                    reason: 'Dispatch failed',
                    error: message,
               };
          }
     }

     static async dispatchByContext(
          tenantId: number,
          eventCode: string,
          context: Record<string, unknown>,
          createdBy?: number,
          recipients?: { to?: string[]; cc?: string[]; bcc?: string[] },
     ): Promise<NotificationDispatchResult> {
          try {
               const service = buildNotificationService(tenantId);
               const result = await service.trigger({
                    eventCode,
                    priority: 'normal',
                    createdBy,
                    recipients: {
                         to: recipients?.to ?? [],
                         cc: recipients?.cc ?? [],
                         bcc: recipients?.bcc ?? [],
                    },
                    context,
               });

               if (!result.queued) {
                    return {
                         success: false,
                         eventCode,
                         reason: result.reason ?? 'Notification not queued',
                    };
               }

               return {
                    success: true,
                    eventCode,
                    notificationQueueId: result.notificationQueueId,
                    emailQueueId: result.emailQueueId,
               };
          } catch (error) {
               const message = error instanceof Error ? error.message : String(error);
               return {
                    success: false,
                    eventCode,
                    reason: 'Dispatch failed',
                    error: message,
               };
          }
     }
}
