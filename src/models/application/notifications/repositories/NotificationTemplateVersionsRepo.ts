import KnexConnection from '../../../../database/KnexConnections';
import { NotificationTemplateVersionRecord } from '../types/NotificationModels';

export class NotificationTemplateVersionsRepo {
     private connection;
     private tableName = 'notification_template_versions';

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: NotificationTemplateVersionRecord): Promise<number> {
          const connection = await this.connection;
          const result = await connection(this.tableName).insert(data);
          return Array.isArray(result) ? Number(result[0]) : Number(result);
     }

     async findLatestVersion(templateId: number): Promise<number> {
          const connection = await this.connection;
          const row = await connection(this.tableName)
               .where({ template_id: templateId })
               .orderBy('version', 'desc')
               .first();

          return row ? Number(row.version) : 0;
     }

     async findAllByTemplate(templateId: number, page?: number, count?: number): Promise<NotificationTemplateVersionRecord[]> {
          const connection = await this.connection;
          const query = connection(this.tableName)
               .where({ template_id: templateId })
               .orderBy('version', 'desc');

          if (page && count) {
               query.offset((page - 1) * count).limit(count);
          }

          return query;
     }
}
