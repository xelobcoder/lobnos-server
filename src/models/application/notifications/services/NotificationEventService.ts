import { NotificationEventSettingsRepo } from '../repositories/NotificationEventSettingsRepo';
import { NotificationEventsRepo } from '../repositories/NotificationEventsRepo';
import { NotificationTemplateVariablesRepo } from '../repositories/NotificationTemplateVariablesRepo';
import { NotificationEventContextService } from './NotificationEventContextService';

export class NotificationEventService {
     constructor(
          private eventsRepo: NotificationEventsRepo,
          private settingsRepo: NotificationEventSettingsRepo,
          private variablesRepo: NotificationTemplateVariablesRepo,
          private eventContextService: NotificationEventContextService,
          private tenantId: number,
     ) { }

     async getEvents() {
          return this.eventsRepo.findAll();
     }

     async getEventByCode(eventCode: string) {
          return this.eventsRepo.findByCode(eventCode);
     }

     async getEventVariables(eventCode: string) {
          const event = await this.eventsRepo.findByCode(eventCode);
          if (!event) throw new Error('Notification event not found');
          return this.variablesRepo.findByEventId(event.id as number);
     }

     async getEventSettings(eventCode: string) {
          const event = await this.eventsRepo.findByCode(eventCode);
          if (!event) throw new Error('Notification event not found');

          return this.settingsRepo.findByEventId(event.id as number);
     }

     async updateEventSettings(eventCode: string, data: {
          emailEnabled?: boolean;
          smsEnabled?: boolean;
          whatsappEnabled?: boolean;
          inAppEnabled?: boolean;
          defaultTemplateId?: number | null;
     }) {
          const event = await this.eventsRepo.findByCode(eventCode);
          if (!event) throw new Error('Notification event not found');

          await this.settingsRepo.upsert(event.id as number, {
               ...(data.emailEnabled !== undefined ? { email_enabled: data.emailEnabled } : {}),
               ...(data.smsEnabled !== undefined ? { sms_enabled: data.smsEnabled } : {}),
               ...(data.whatsappEnabled !== undefined ? { whatsapp_enabled: data.whatsappEnabled } : {}),
               ...(data.inAppEnabled !== undefined ? { in_app_enabled: data.inAppEnabled } : {}),
               ...(data.defaultTemplateId !== undefined ? { default_template_id: data.defaultTemplateId } : {}),
          });

          return this.settingsRepo.findByEventId(event.id as number);
     }

     async getEventCatalog(eventCode?: string) {
          return this.eventContextService.getEventCatalog(eventCode);
     }

     async syncEventCatalog() {
          return this.eventContextService.ensureSystemDefinitions();
     }
}
