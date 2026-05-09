import { Knex } from 'knex';
import KnexConnection from '../../../../database/KnexConnections';

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface CommissionAnalyticsQuery {
     tenantId: number;
     startDate: Date;
     endDate: Date;
     period: PeriodType;
     recipientType?: 'clinician' | 'organization';
     recipientId?: number;
     status?: 'pending' | 'completed' | 'cancelled';
}

export interface IPeriodAnalytics {
     /** Formatted period label (e.g., '2024-05', 'Q2-2024') */
     period: string;
     /** Start date of the period */
     period_start: Date;
     /** End date of the period */
     period_end: Date;
     /** Total amount paid in this period */
     total_paid: number;
     /** Average payment amount */
     average_paid: number;
     /** Total amount waived */
     total_waived: number;
     /** Number of payment batches */
     batch_count: number;
     /** Total amount due (before payments/waivers) */
     total_due: number;
}

export interface IRecipientAnalytics extends IPeriodAnalytics {
     /** Recipient identifier */
     recipient_id: number;
     /** Type of recipient: clinician or organization */
     recipient_type: string;
}

// Export non-interface versions for backward compatibility
export type PeriodAnalytics = IPeriodAnalytics;
export type RecipientAnalytics = IRecipientAnalytics;

export class CommissionAnalyticsWithDate {
     private connection: Promise<Knex>;

     constructor(private tenantId: number) {
          this.connection = KnexConnection(this.tenantId);
     }

     async getCommissionsByPeriod(query: CommissionAnalyticsQuery): Promise<PeriodAnalytics[]> {
          const connection = await this.connection;
          const periodFormat = this.getPeriodFormat(query.period);

          let sqlQuery = connection('commission_batch_payments')
               .select(
                    connection.raw(`DATE_FORMAT(COALESCE(payment_date, created_at), '${periodFormat}') as period`),
                    connection.raw('DATE(COALESCE(payment_date, created_at)) as period_start'),
                    connection.raw('LAST_DAY(DATE(COALESCE(payment_date, created_at))) as period_end'),
                    connection.raw('CAST(SUM(payment_amount) AS DECIMAL(12,2)) as total_paid'),
                    connection.raw('CAST(AVG(payment_amount) AS DECIMAL(12,2)) as average_paid'),
                    connection.raw('CAST(SUM(waived_amount) AS DECIMAL(12,2)) as total_waived'),
                    connection.raw('COUNT(*) as batch_count'),
                    connection.raw('CAST(SUM(total_commission_amount) AS DECIMAL(12,2)) as total_due')
               )
               .whereRaw('COALESCE(payment_date, created_at) BETWEEN ? AND ?', [query.startDate, query.endDate])
               .groupByRaw(`DATE_FORMAT(COALESCE(payment_date, created_at), '${periodFormat}')`);

          if (query.recipientType && query.recipientId) {
               sqlQuery = sqlQuery
                    .where('recipient_type', query.recipientType)
                    .where('recipient_id', query.recipientId);
          }

          if (query.status) {
               sqlQuery = sqlQuery.where('status', query.status);
          }

          sqlQuery = sqlQuery.orderBy('period', 'asc');

          return await sqlQuery;
     }

     async getCommissionsByRecipient(query: CommissionAnalyticsQuery): Promise<RecipientAnalytics[]> {
          const connection = await this.connection;
          const periodFormat = this.getPeriodFormat(query.period);

          const recipientType = query.recipientType || 'clinician';

          let sqlQuery = connection('commission_batch_payments')
               .select(
                    'recipient_id',
                    'recipient_type',
                    connection.raw(`DATE_FORMAT(COALESCE(payment_date, created_at), '${periodFormat}') as period`),
                    connection.raw('DATE(COALESCE(payment_date, created_at)) as period_start'),
                    connection.raw('LAST_DAY(DATE(COALESCE(payment_date, created_at))) as period_end'),
                    connection.raw('CAST(SUM(payment_amount) AS DECIMAL(12,2)) as total_paid'),
                    connection.raw('CAST(AVG(payment_amount) AS DECIMAL(12,2)) as average_paid'),
                    connection.raw('CAST(SUM(waived_amount) AS DECIMAL(12,2)) as total_waived'),
                    connection.raw('COUNT(*) as batch_count'),
                    connection.raw('CAST(SUM(total_commission_amount) AS DECIMAL(12,2)) as total_due')
               )
               .whereRaw('COALESCE(payment_date, created_at) BETWEEN ? AND ?', [query.startDate, query.endDate])
               .where('recipient_type', recipientType)
               .groupByRaw('recipient_id, DATE_FORMAT(COALESCE(payment_date, created_at), ?)', [periodFormat]);

          if (query.status) {
               sqlQuery = sqlQuery.where('status', query.status);
          }

          sqlQuery = sqlQuery
               .orderBy('recipient_id', 'asc')
               .orderBy('period', 'asc');

          return await sqlQuery;
     }

     async getRecipientCommissionsByPeriod(query: CommissionAnalyticsQuery): Promise<PeriodAnalytics[]> {
          if (!query.recipientType || !query.recipientId) {
               throw new Error('recipientType and recipientId are required');
          }

          const connection = await this.connection;
          const periodFormat = this.getPeriodFormat(query.period);

          let sqlQuery = connection('commission_batch_payments')
               .select(
                    connection.raw(`DATE_FORMAT(COALESCE(payment_date, created_at), '${periodFormat}') as period`),
                    connection.raw('DATE(COALESCE(payment_date, created_at)) as period_start'),
                    connection.raw('LAST_DAY(DATE(COALESCE(payment_date, created_at))) as period_end'),
                    connection.raw('CAST(SUM(payment_amount) AS DECIMAL(12,2)) as total_paid'),
                    connection.raw('CAST(AVG(payment_amount) AS DECIMAL(12,2)) as average_paid'),
                    connection.raw('CAST(SUM(waived_amount) AS DECIMAL(12,2)) as total_waived'),
                    connection.raw('COUNT(*) as batch_count'),
                    connection.raw('CAST(SUM(total_commission_amount) AS DECIMAL(12,2)) as total_due')
               )
               .whereRaw('COALESCE(payment_date, created_at) BETWEEN ? AND ?', [query.startDate, query.endDate])
               .where('recipient_type', query.recipientType)
               .where('recipient_id', query.recipientId)
               .groupByRaw(`DATE_FORMAT(COALESCE(payment_date, created_at), '${periodFormat}')`);

          if (query.status) {
               sqlQuery = sqlQuery.where('status', query.status);
          }

          sqlQuery = sqlQuery.orderBy('period', 'asc');

          return await sqlQuery;
     }

     async getPeriodStatistics(query: CommissionAnalyticsQuery): Promise<any> {
          const connection = await this.connection;

          let sqlQuery = connection('commission_batch_payments')
               .select(
                    connection.raw('CAST(SUM(payment_amount) AS DECIMAL(12,2)) as total_paid'),
                    connection.raw('CAST(AVG(payment_amount) AS DECIMAL(12,2)) as average_paid'),
                    connection.raw('CAST(MIN(payment_amount) AS DECIMAL(12,2)) as min_paid'),
                    connection.raw('CAST(MAX(payment_amount) AS DECIMAL(12,2)) as max_paid'),
                    connection.raw('COUNT(*) as batch_count'),
                    connection.raw('COUNT(DISTINCT recipient_id) as unique_recipients'),
                    connection.raw('CAST(SUM(total_commission_amount) AS DECIMAL(12,2)) as total_due'),
                    connection.raw('CAST(SUM(waived_amount) AS DECIMAL(12,2)) as total_waived')
               )
               .whereRaw('COALESCE(payment_date, created_at) BETWEEN ? AND ?', [query.startDate, query.endDate]);

          if (query.recipientType && query.recipientId) {
               sqlQuery = sqlQuery
                    .where('recipient_type', query.recipientType)
                    .where('recipient_id', query.recipientId);
          }

          if (query.status) {
               sqlQuery = sqlQuery.where('status', query.status);
          }

          return await sqlQuery.first();
     }

     async getCommissionsByStatus(query: CommissionAnalyticsQuery): Promise<any[]> {
          const connection = await this.connection;

          let sqlQuery = connection('commission_batch_payments')
               .select(
                    'status',
                    connection.raw('CAST(SUM(payment_amount) AS DECIMAL(12,2)) as total_paid'),
                    connection.raw('COUNT(*) as count'),
                    connection.raw('CAST(AVG(payment_amount) AS DECIMAL(12,2)) as average_paid')
               )
               .whereRaw('COALESCE(payment_date, created_at) BETWEEN ? AND ?', [query.startDate, query.endDate])
               .groupBy('status');

          if (query.recipientType && query.recipientId) {
               sqlQuery = sqlQuery
                    .where('recipient_type', query.recipientType)
                    .where('recipient_id', query.recipientId);
          }

          sqlQuery = sqlQuery.orderBy('total_paid', 'desc');

          return await sqlQuery;
     }

     async getRecipientPaymentEfficiency(query: CommissionAnalyticsQuery): Promise<any[]> {
          const connection = await this.connection;

          let sqlQuery = connection('commission_batch_payments')
               .select(
                    'recipient_id',
                    'recipient_type',
                    connection.raw('CAST(SUM(payment_amount) AS DECIMAL(12,2)) as total_paid'),
                    connection.raw('CAST(SUM(total_commission_amount) AS DECIMAL(12,2)) as total_due'),
                    connection.raw('CAST(SUM(waived_amount) AS DECIMAL(12,2)) as total_waived'),
                    connection.raw('COUNT(*) as payment_batches'),
                    connection.raw('ROUND((SUM(payment_amount) / SUM(total_commission_amount)) * 100, 2) as payment_percentage')
               )
               .whereRaw('COALESCE(payment_date, created_at) BETWEEN ? AND ?', [query.startDate, query.endDate])
               .groupBy('recipient_id', 'recipient_type');

          if (query.status) {
               sqlQuery = sqlQuery.where('status', query.status);
          }

          sqlQuery = sqlQuery.orderBy('total_paid', 'desc');

          return await sqlQuery;
     }

     private getPeriodFormat(period: PeriodType): string {
          const formats: Record<PeriodType, string> = {
               daily: '%Y-%m-%d',
               weekly: '%Y-W%u',
               monthly: '%Y-%m',
               quarterly: 'Q%q-%Y',
               yearly: '%Y',
          };
          return formats[period];
     }
}
