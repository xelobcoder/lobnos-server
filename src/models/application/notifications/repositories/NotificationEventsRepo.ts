import KnexConnection from '../../../../database/KnexConnections';
import { NotificationEventRecord } from '../types/NotificationModels';
import { NOTIFICATION_EVENT_CATALOG } from '../context/providers/NotificationEventCatalog';

export class NotificationEventsRepo {
     private connection;
     private tableName = 'notification_events';

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async ensureCatalogEvents(): Promise<void> {
          const connection = await this.connection;
          const events = NOTIFICATION_EVENT_CATALOG.map(event => ({
               event_code: event.eventCode,
               event_name: event.title,
               description: event.intro,
               module: event.module,
               is_system: true,
               is_active: true,
          }));
          await connection(this.tableName).insert(events).onConflict('event_code').ignore();
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
