import KnexConnection from '../../../../database/KnexConnections';
import { EmailQueueRecord } from '../types/EmailModels';

export class EmailQueueRepo {
     private connection;
     private tableName = 'email_queue';

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     getTenantId(): number {
          return this.tenantId;
     }

     async create(data: EmailQueueRecord): Promise<number> {
          const connection = await this.connection;
          const result = await connection(this.tableName).insert(data);
          return Array.isArray(result) ? Number(result[0]) : Number(result);
     }

     async update(id: number, data: Partial<EmailQueueRecord>): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ id }).update(data);
     }

     async findById(id: number): Promise<EmailQueueRecord | null> {
          const connection = await this.connection;
          const record = await connection(this.tableName).where({ id }).first();
          return record || null;
     }

     async findAll(limit = 50): Promise<EmailQueueRecord[]> {
          const connection = await this.connection;
          return connection(this.tableName).select('*').orderBy('id', 'desc').limit(limit);
     }

     async findProcessable(limit = 20): Promise<EmailQueueRecord[]> {
          const connection = await this.connection;
          const now = new Date();
          return connection(this.tableName)
               .whereIn('status', ['pending', 'scheduled', 'failed'])
               .andWhere((builder) => {
                    builder.whereNull('scheduled_at').orWhere('scheduled_at', '<=', now);
               })
               .andWhere((builder) => {
                    builder.whereNull('next_retry_at').orWhere('next_retry_at', '<=', now);
               })
               .orderByRaw("FIELD(priority, 'high', 'normal', 'low')")
               .orderBy('id', 'asc')
               .limit(limit);
     }

     async getQueueMetrics() {
          const connection = await this.connection;
          const row = await connection(this.tableName)
               .select(
                    connection.raw('COUNT(*) AS total'),
                    connection.raw("SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending"),
                    connection.raw("SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing"),
                    connection.raw("SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed"),
                    connection.raw("SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled"),
                    connection.raw("SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent"),
                    connection.raw('ROUND(AVG(CASE WHEN sent_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, created_at, sent_at) END), 2) AS avg_wait_seconds'),
               )
               .first();

          return row || {};
     }
}
