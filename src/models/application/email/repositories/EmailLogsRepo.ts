import KnexConnection from '../../../../database/KnexConnections';
import { EmailLogRecord } from '../types/EmailModels';

export class EmailLogsRepo {
     private connection;
     private tableName = 'email_logs';

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: EmailLogRecord): Promise<number> {
          const connection = await this.connection;
          const result = await connection(this.tableName).insert(data);
          return Array.isArray(result) ? Number(result[0]) : Number(result);
     }

     async findAll(limit = 100): Promise<EmailLogRecord[]> {
          const connection = await this.connection;
          return connection(this.tableName).select('*').orderBy('id', 'desc').limit(limit);
     }
}
