import KnexConnection from '../../../../database/KnexConnections';
import { NotificationTemplateVariableRecord } from '../types/NotificationModels';

export class NotificationTemplateVariablesRepo {
     private connection;
     private tableName = 'notification_template_variables';

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async findByEventId(eventId: number): Promise<NotificationTemplateVariableRecord[]> {
          const connection = await this.connection;
          return connection(this.tableName).where({ event_id: eventId }).orderBy('variable_name', 'asc');
     }

     async create(data: NotificationTemplateVariableRecord): Promise<number> {
          const connection = await this.connection;
          const result = await connection(this.tableName).insert(data);
          return Array.isArray(result) ? Number(result[0]) : Number(result);
     }
}
