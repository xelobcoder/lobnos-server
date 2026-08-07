import KnexConnection from '../../../../database/KnexConnections';
import { NotificationEventRecord } from '../types/NotificationModels';

export class NotificationEventsRepo {
     private connection;
     private tableName = 'notification_events';

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async findAll(page?: number, count?: number): Promise<NotificationEventRecord[]> {
          const connection = await this.connection;
          const query = connection(this.tableName)
               .select('*')
               .orderBy('event_code', 'asc');

          if (page && count) {
               query.offset((page - 1) * count).limit(count);
          }

          return query;
     }

     async findByCode(eventCode: string): Promise<NotificationEventRecord | null> {
          const connection = await this.connection;
          const event = await connection(this.tableName).where({ event_code: eventCode }).first();
          return event || null;
     }
}
