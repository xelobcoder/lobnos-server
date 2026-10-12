import ApplicationSettings from '../../appsettings/appset';
import { validateModuleConfiguration } from '../../../Tenancy/FacilityModules';
import { EmailQueueRepo } from '../../email/repositories/EmailQueueRepo';
import { EmailLogsRepo } from '../../email/repositories/EmailLogsRepo';
import { EmailProvidersRepo } from '../../email/repositories/EmailProvidersRepo';
import { EmailTemplatesRepo } from '../../email/repositories/EmailTemplatesRepo';
import { EmailSettingsRepo } from '../../email/repositories/EmailSettingsRepo';
import { EmailQueueService } from '../../email/services/EmailQueueService';
import { ProviderFactory } from '../../email/services/ProviderFactory';
import { TemplateRenderer } from '../../email/services/TemplateRenderer';
import { PrimeSmsJobsRepo } from '../../sms/repositories/PrimeSmsJobsRepo';
import { PrimeSmsJobRecipientsRepo } from '../../sms/repositories/PrimeSmsJobRecipientsRepo';
import { SmsJobsService } from '../../sms/services/SmsJobsService';
import { NotificationEventsRepo } from '../repositories/NotificationEventsRepo';
import { NotificationEventSettingsRepo } from '../repositories/NotificationEventSettingsRepo';
import { NotificationTemplatesRepo } from '../repositories/NotificationTemplatesRepo';
import { NotificationTemplateVariablesRepo } from '../repositories/NotificationTemplateVariablesRepo';
import { NotificationTemplateVersionsRepo } from '../repositories/NotificationTemplateVersionsRepo';
import { NotificationEventRecipientsRepo } from '../repositories/NotificationEventRecipientsRepo';
import { NotificationQueueRepo } from '../repositories/NotificationQueueRepo';
import { NotificationEventContextService } from './NotificationEventContextService';
import { NotificationTemplateRenderer } from './NotificationTemplateRenderer';
import { NotificationService } from './NotificationService';
import { RecipientResolver } from './RecipientResolver';
import { AppointmentNotificationService } from './AppointmentNotificationService';

export function buildAppointmentNotificationService(tenantId: number): AppointmentNotificationService {
     const events = new NotificationEventsRepo(tenantId);
     const settings = new NotificationEventSettingsRepo(tenantId);
     const templates = new NotificationTemplatesRepo(tenantId);
     const context = new NotificationEventContextService(events, templates,
          new NotificationTemplateVariablesRepo(tenantId), new NotificationTemplateVersionsRepo(tenantId), tenantId);
     const emailQueue = new EmailQueueRepo(tenantId);
     const processor = new EmailQueueService(emailQueue, new EmailLogsRepo(tenantId),
          new EmailTemplatesRepo(tenantId), new EmailProvidersRepo(tenantId), new EmailSettingsRepo(tenantId),
          new ProviderFactory(), new TemplateRenderer());
     const email = new NotificationService(events, templates, settings, new NotificationEventRecipientsRepo(tenantId),
          new NotificationQueueRepo(tenantId), emailQueue, processor, new NotificationTemplateRenderer(),
          new RecipientResolver(), context, tenantId);
     const sms = new SmsJobsService(new PrimeSmsJobsRepo(tenantId), new PrimeSmsJobRecipientsRepo(tenantId));
     return new AppointmentNotificationService(events, settings, templates, context, email, sms, tenantId, async () => {
          const appSettings = await new ApplicationSettings().getAllAppSettings(tenantId);
          if (!appSettings) return false;
          // Match the legacy SMS event activation policy, including pre-module configuration tenants.
          if (!appSettings.moduleConfiguration) return true;
          const config = validateModuleConfiguration(JSON.parse(appSettings.moduleConfiguration));
          if (!config) throw new Error('Invalid stored module configuration');
          return config.modules.sms.enabled;
     });
}
