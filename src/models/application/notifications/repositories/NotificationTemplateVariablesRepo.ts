import KnexConnection from '../../../../database/KnexConnections';
import { NotificationTemplateVariableRecord } from '../types/NotificationModels';

export class NotificationTemplateVariablesRepo {
     private connection;
     private tableName = 'notification_template_variables';

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async findByEventId(eventId: number, page?: number, count?: number): Promise<NotificationTemplateVariableRecord[]> {
          const connection = await this.connection;
          const query = connection(this.tableName)
               .where({ event_id: eventId })
               .orderBy('variable_name', 'asc');

          if (page && count) {
               query.offset((page - 1) * count).limit(count);
          }

          return query;
     }

     async create(data: NotificationTemplateVariableRecord): Promise<number> {
          const connection = await this.connection;
          try {
               const result = await connection(this.tableName).insert(data);
               return Array.isArray(result) ? Number(result[0]) : Number(result);
          } catch (error: any) {
               if (error?.code === 'ER_DUP_ENTRY') {
                    return 0;
               }
               throw error;
          }
     }
}
