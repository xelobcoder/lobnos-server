import KnexConnection from '../../../../database/KnexConnections';
import { NotificationEventSettingRecord } from '../types/NotificationModels';

export class NotificationEventSettingsRepo {
     private connection;
     private tableName = 'notification_event_settings';

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async findByEventId(eventId: number): Promise<NotificationEventSettingRecord | null> {
          const connection = await this.connection;

          const row = await connection(this.tableName)
               .where({ event_id: eventId })
               .orderBy('updated_at', 'desc')
               .first();

          return row || null;
     }

     async upsert(eventId: number, data: Partial<NotificationEventSettingRecord>): Promise<void> {
          const connection = await this.connection;
          await connection(this.tableName).insert({
               event_id: eventId,
               email_enabled: data.email_enabled ?? true,
               sms_enabled: data.sms_enabled ?? false,
               whatsapp_enabled: data.whatsapp_enabled ?? false,
               in_app_enabled: data.in_app_enabled ?? true,
               default_template_id: data.default_template_id ?? null,
          }).onConflict('event_id').merge({ ...data, updated_at: connection.fn.now() });
     }
}
