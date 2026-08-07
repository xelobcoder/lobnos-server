import KnexConnection from '../../../../database/KnexConnections';
import { NotificationQueueRecord } from '../types/NotificationModels';

export class NotificationQueueRepo {
     private connection;
     private tableName = 'notification_queue';

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: NotificationQueueRecord): Promise<number> {
          const connection = await this.connection;
          const result = await connection(this.tableName).insert(data);
          return Array.isArray(result) ? Number(result[0]) : Number(result);
     }

     async update(id: number, data: Partial<NotificationQueueRecord>): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ id }).update(data);
     }

     async findAll(page?: number, count?: number): Promise<NotificationQueueRecord[]> {
          const connection = await this.connection;
          const query = connection(this.tableName)
               .select('*')
               .orderBy('id', 'desc');

          if (page && count) {
               query.offset((page - 1) * count).limit(count);
          }

          return query;
     }

     async findById(id: number): Promise<NotificationQueueRecord | null> {
          const connection = await this.connection;
          const row = await connection(this.tableName).where({ id }).first();
          return row || null;
     }

     async markForRetry(id: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName)
               .where({ id })
               .update({
                    status: 'pending',
                    last_error: null,
                    processing_started_at: null,
                    processed_at: null,
                    updated_at: connection.fn.now(),
               });
     }

     async cancel(id: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName)
               .where({ id })
               .update({
                    status: 'cancelled',
                    processed_at: connection.fn.now(),
                    updated_at: connection.fn.now(),
               });
     }

     async findLogs(page?: number, count?: number) {
          const connection = await this.connection;
          const query = connection('email_logs as el')
               .leftJoin('notification_queue as nq', 'nq.email_queue_id', 'el.queue_id')
               .select(
                    'el.id',
                    'el.queue_id as email_queue_id',
                    'nq.id as notification_queue_id',
                    'nq.event_code',
                    'el.status',
                    'el.subject',
                    'el.recipients_json',
                    'el.failure_reason',
                    'el.response_payload_json',
                    'el.duration_ms',
                    'el.created_at',
               )
               .orderBy('el.id', 'desc');

          if (page && count) {
               query.offset((page - 1) * count).limit(count);
          }

          return query;
     }
}
