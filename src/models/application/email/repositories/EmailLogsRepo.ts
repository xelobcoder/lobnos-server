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

     async findAll(page?: number, count?: number): Promise<EmailLogRecord[]> {
          const connection = await this.connection;
          const query = connection(this.tableName)
               .select('*')
               .orderBy('id', 'desc');

          if (page && count) {
               query.offset((page - 1) * count).limit(count);
          }

          return query;
     }

     async getOverview(days = 30) {
          const connection = await this.connection;
          return connection(this.tableName)
               .select(
                    connection.raw('COUNT(*) AS total'),
                    connection.raw("SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent"),
                    connection.raw("SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed"),
                    connection.raw("SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled"),
                    connection.raw('ROUND(AVG(duration_ms), 2) AS avg_processing_ms'),
               )
               .whereRaw('created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)', [days])
               .first();
     }

     async getStatusBreakdown(days = 30) {
          const connection = await this.connection;
          return connection(this.tableName)
               .select('status')
               .count('* AS total')
               .whereRaw('created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)', [days])
               .groupBy('status');
     }

     async getEventBreakdown(days = 30, page?: number, count?: number) {
          const connection = await this.connection;
          const query = connection('email_logs as el')
               .leftJoin('email_queue as eq', 'eq.id', 'el.queue_id')
               .leftJoin('notification_queue as nq', 'nq.id', connection.raw('CAST(eq.reference_id AS UNSIGNED)'))
               .select(connection.raw('COALESCE(nq.event_code, eq.reference_type, "UNKNOWN") AS event_code'))
               .count('* AS total')
               .sum({ sent: connection.raw("CASE WHEN el.status = 'sent' THEN 1 ELSE 0 END") })
               .sum({ failed: connection.raw("CASE WHEN el.status = 'failed' THEN 1 ELSE 0 END") })
               .whereRaw('el.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)', [days])
               .groupByRaw('COALESCE(nq.event_code, eq.reference_type, "UNKNOWN")')
               .orderBy('total', 'desc');

          if (page && count) {
               query.offset((page - 1) * count).limit(count);
          }

          return query;
     }

     async getProviderPerformance(days = 30) {
          const connection = await this.connection;
          return connection('email_logs as el')
               .leftJoin('email_providers as ep', 'ep.id', 'el.provider_id')
               .select(connection.raw('COALESCE(ep.name, "Unknown") AS provider'))
               .count('* AS total')
               .sum({ sent: connection.raw("CASE WHEN el.status = 'sent' THEN 1 ELSE 0 END") })
               .sum({ failed: connection.raw("CASE WHEN el.status = 'failed' THEN 1 ELSE 0 END") })
               .select(connection.raw('ROUND(AVG(el.duration_ms), 2) AS avg_processing_ms'))
               .whereRaw('el.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)', [days])
               .groupByRaw('COALESCE(ep.name, "Unknown")')
               .orderBy('total', 'desc');
     }

     async getDailyTrend(days = 30) {
          const connection = await this.connection;
          return connection(this.tableName)
               .select(connection.raw('DATE(created_at) AS day'))
               .count('* AS total')
               .sum({ sent: connection.raw("CASE WHEN status = 'sent' THEN 1 ELSE 0 END") })
               .sum({ failed: connection.raw("CASE WHEN status = 'failed' THEN 1 ELSE 0 END") })
               .whereRaw('created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)', [days])
               .groupByRaw('DATE(created_at)')
               .orderBy('day', 'asc');
     }

     async getFailureReasons(days = 30, page?: number, count?: number) {
          const connection = await this.connection;
          const query = connection(this.tableName)
               .select('failure_reason')
               .count('* AS total')
               .whereRaw('created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)', [days])
               .andWhereNotNull('failure_reason')
               .groupBy('failure_reason')
               .orderBy('total', 'desc');

          if (page && count) {
               query.offset((page - 1) * count).limit(count);
          }

          return query;
     }
}
