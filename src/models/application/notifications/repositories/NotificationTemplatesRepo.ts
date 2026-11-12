import KnexConnection from '../../../../database/KnexConnections';
import { NotificationTemplateRecord } from '../types/NotificationModels';

export class NotificationTemplatesRepo {
     private connection;
     private tableName = 'notification_templates';

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: NotificationTemplateRecord): Promise<number> {
          const connection = await this.connection;
          const result = await connection(this.tableName).insert(data);
          return Array.isArray(result) ? Number(result[0]) : Number(result);
     }

     async update(id: number, data: Partial<NotificationTemplateRecord>): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ id }).update(data);
     }

     async findById(id: number): Promise<NotificationTemplateRecord | null> {
          const connection = await this.connection;
          const row = await connection(this.tableName).where({ id }).first();
          return row || null;
     }

     async findAll(page?: number, count?: number, includeInactive = false): Promise<NotificationTemplateRecord[]> {
          const connection = await this.connection;
          const query = connection(this.tableName)
               .orderBy('event_id', 'asc')
               .orderBy('is_system', 'desc')
               .orderBy('id', 'desc');
          if (!includeInactive) query.where({ is_active: true });

          if (page && count) {
               query.offset((page - 1) * count).limit(count);
          }

          return query;
     }

     async findActiveForEvent(eventId: number): Promise<NotificationTemplateRecord | null> {
          const connection = await this.connection;

          const systemDefault = await connection(this.tableName)
               .where({ event_id: eventId, is_system: true, is_active: true })
               .orderBy('is_default', 'desc')
               .orderBy('updated_at', 'desc')
               .first();

          if (systemDefault) return systemDefault;

          const fallback = await connection(this.tableName)
               .where({ event_id: eventId, is_active: true })
               .orderBy('is_default', 'desc')
               .orderBy('updated_at', 'desc')
               .first();

          return fallback || null;
     }

     async findSystemDefaultForEvent(eventId: number): Promise<NotificationTemplateRecord | null> {
          const connection = await this.connection;
          const row = await connection(this.tableName)
               .where({ event_id: eventId, is_system: true, is_default: true })
               .orderBy('updated_at', 'desc')
               .first();

          return row || null;
     }

     async delete(id: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ id }).del();
     }
}
