import KnexConnection from '../../../../database/KnexConnections';
import { NotificationEventRecipientRecord } from '../types/NotificationModels';

export class NotificationEventRecipientsRepo {
     private connection;
     private tableName = 'notification_event_recipients';

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async findByEventId(eventId: number): Promise<NotificationEventRecipientRecord[]> {
          const connection = await this.connection;
          return connection(this.tableName).where({ event_id: eventId, is_active: true }).orderBy('id', 'asc');
     }
}
