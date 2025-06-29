import KnexConnection from '../../../../database/KnexConnections';

export class PrimeSmsAnalytics {
     private tenantId: number;
     private db: any;
     private primejobs: string;
     private primejobrecipients: string;
     private connection: any;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
          this.primejobs = 'primesmsjobs';
          this.primejobrecipients = 'primesmsjobrecipients';
     }

     async getJobStatusCounts() {
          try {
               const connection = await this.connection
               const rows = await connection(this.primejobs)
                    .select('status')
                    .count('* as count')
                    .groupBy('status');
               const result: Record<string, number> = {};
               for (const row of rows) {
                    result[row.status] = Number(row.count);
               }
               return result;
          } catch (error) {
               throw error;
          }
     }

     async getRecipientDeliveryCounts() {
          try {
               const connection = await this.connection;
               const rows = await connection(this.primejobrecipients)
                    .select('deliverystatus')
                    .count('* as count')
                    .groupBy('deliverystatus');
               const result: Record<string, number> = {};
               for (const row of rows) {
                    result[row.deliverystatus] = Number(row.count);
               }
               return result;
          } catch (error) {
               throw error;
          }
     }

     async getTotals() {
          try {
               const connection = await this.connection;
               const [jobs] = await connection(this.primejobs).count('* as count');
               const [recipients] = await connection(this.primejobrecipients).count('* as count');
               const result = {
                    totalJobs: Number(jobs.count),
                    totalRecipients: Number(recipients.count),
               };
               return result;
          } catch (error) {
               throw error;
          }
     }

     async getJobCountsByCategory() {
          try {
               const connection = await this.connection;
               const rows = await connection(this.primejobs)
                    .select('category')
                    .count('* as count')
                    .groupBy('category');
               const result: Record<string, number> = {};
               for (const row of rows) {
                    result[row.category || 'uncategorized'] = Number(row.count);
               }
               return result;
          } catch (error) {
               throw error;
          }
     }

     async getJobTrendsByDay(days: number = 30) {
          try {
               const connection = await this.connection;
               const rows = await connection(this.primejobs)
                    .select(connection.raw('DATE(createdat) as day, status'))
                    .count('* as count')
                    .where('createdat', '>=', connection.raw(`CURDATE() - INTERVAL ? DAY`, [days]))
                    .groupByRaw('DATE(createdat), status')
                    .orderBy('day', 'asc');
               const result: Record<string, Record<string, number>> = {};
               for (const row of rows) {
                    if (!result[row.day]) result[row.day] = {};
                    result[row.day][row.status] = Number(row.count);
               }
               return result;
          } catch (error) {
               throw error;
          }
     }

     async getDeliveryTrendsByDay(days: number = 30) {
          try {
               const connection = await this.connection;
               const rows = await connection(this.primejobrecipients)
                    .select(connection.raw('DATE(createdat) as day, deliverystatus'))
                    .count('* as count')
                    .where('createdat', '>=', connection.raw(`CURDATE() - INTERVAL ? DAY`, [days]))
                    .groupByRaw('DATE(createdat), deliverystatus')
                    .orderBy('day', 'asc');
               const result: Record<string, Record<string, number>> = {};
               for (const row of rows) {
                    if (!result[row.day]) result[row.day] = {};
                    result[row.day][row.deliverystatus] = Number(row.count);
               }
               return result;
          } catch (error) {
               throw error;
          }
     }
}
