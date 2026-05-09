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
     status?: string;
}

export interface PeriodAnalytics {
     period: string;
     period_start: Date;
     period_end: Date;
     total_commission: number;
     average_commission: number;
     commission_count: number;
     service_amount_total: number;
}

export interface RecipientAnalytics extends PeriodAnalytics {
     recipient_id: number;
     recipient_type: string;
}

/**
 * Query builder for commission analytics
 * Fetches and groups commission data by various time periods
 */
export class CommissionAnalyticsWithDate {
     private connection: Promise<Knex>;

     constructor(private tenantId: number) {
          this.connection = KnexConnection(this.tenantId);
     }

     /**
      * Get commission analytics grouped by period
      * Returns aggregated commission data for each period
      */
     async getCommissionsByPeriod(query: CommissionAnalyticsQuery): Promise<PeriodAnalytics[]> {
          const connection = await this.connection;
          const periodFormat = this.getPeriodFormat(query.period);

          let sqlQuery = connection('commission_tracking')
               .select(
                    connection.raw(`DATE_FORMAT(calculated_at, '${periodFormat}') as period`),
                    connection.raw('DATE(calculated_at) as period_start'),
                    connection.raw('LAST_DAY(DATE(calculated_at)) as period_end'),
                    connection.raw('CAST(SUM(final_commission) AS DECIMAL(12,2)) as total_commission'),
                    connection.raw('CAST(AVG(final_commission) AS DECIMAL(12,2)) as average_commission'),
                    connection.raw('COUNT(*) as commission_count'),
                    connection.raw('CAST(SUM(service_amount) AS DECIMAL(12,2)) as service_amount_total')
               )
               .whereBetween('calculated_at', [query.startDate, query.endDate])
               .groupByRaw(`DATE_FORMAT(calculated_at, '${periodFormat}')`);

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

     /**
      * Get commission analytics by recipient for a period
      * Returns breakdown by clinician or organization
      */
     async getCommissionsByRecipient(query: CommissionAnalyticsQuery): Promise<RecipientAnalytics[]> {
          const connection = await this.connection;
          const periodFormat = this.getPeriodFormat(query.period);

          const recipientType = query.recipientType || 'clinician';

          let sqlQuery = connection('commission_tracking')
               .select(
                    'recipient_id',
                    'recipient_type',
                    connection.raw(`DATE_FORMAT(calculated_at, '${periodFormat}') as period`),
                    connection.raw('DATE(calculated_at) as period_start'),
                    connection.raw('LAST_DAY(DATE(calculated_at)) as period_end'),
                    connection.raw('CAST(SUM(final_commission) AS DECIMAL(12,2)) as total_commission'),
                    connection.raw('CAST(AVG(final_commission) AS DECIMAL(12,2)) as average_commission'),
                    connection.raw('COUNT(*) as commission_count'),
                    connection.raw('CAST(SUM(service_amount) AS DECIMAL(12,2)) as service_amount_total')
               )
               .whereBetween('calculated_at', [query.startDate, query.endDate])
               .where('recipient_type', recipientType)
               .groupByRaw('recipient_id, DATE_FORMAT(calculated_at, ?)', [periodFormat]);

          if (query.status) {
               sqlQuery = sqlQuery.where('status', query.status);
          }

          sqlQuery = sqlQuery
               .orderBy('recipient_id', 'asc')
               .orderBy('period', 'asc');

          return await sqlQuery;
     }

     /**
      * Get specific recipient analytics across periods
      * Returns commission breakdown for a specific clinician or organization across periods
      */
     async getRecipientCommissionsByPeriod(query: CommissionAnalyticsQuery): Promise<PeriodAnalytics[]> {
          if (!query.recipientType || !query.recipientId) {
               throw new Error('recipientType and recipientId are required');
          }

          const connection = await this.connection;
          const periodFormat = this.getPeriodFormat(query.period);

          let sqlQuery = connection('commission_tracking')
               .select(
                    connection.raw(`DATE_FORMAT(calculated_at, '${periodFormat}') as period`),
                    connection.raw('DATE(calculated_at) as period_start'),
                    connection.raw('LAST_DAY(DATE(calculated_at)) as period_end'),
                    connection.raw('CAST(SUM(final_commission) AS DECIMAL(12,2)) as total_commission'),
                    connection.raw('CAST(AVG(final_commission) AS DECIMAL(12,2)) as average_commission'),
                    connection.raw('COUNT(*) as commission_count'),
                    connection.raw('CAST(SUM(service_amount) AS DECIMAL(12,2)) as service_amount_total')
               )
               .whereBetween('calculated_at', [query.startDate, query.endDate])
               .where('recipient_type', query.recipientType)
               .where('recipient_id', query.recipientId)
               .groupByRaw(`DATE_FORMAT(calculated_at, '${periodFormat}')`);

          if (query.status) {
               sqlQuery = sqlQuery.where('status', query.status);
          }

          sqlQuery = sqlQuery.orderBy('period', 'asc');

          return await sqlQuery;
     }

     /**
      * Get commission statistics for the entire period
      * Returns summary statistics
      */
     async getPeriodStatistics(query: CommissionAnalyticsQuery): Promise<any> {
          const connection = await this.connection;

          let sqlQuery = connection('commission_tracking')
               .select(
                    connection.raw('CAST(SUM(final_commission) AS DECIMAL(12,2)) as total_commission'),
                    connection.raw('CAST(AVG(final_commission) AS DECIMAL(12,2)) as average_commission'),
                    connection.raw('CAST(MIN(final_commission) AS DECIMAL(12,2)) as min_commission'),
                    connection.raw('CAST(MAX(final_commission) AS DECIMAL(12,2)) as max_commission'),
                    connection.raw('COUNT(*) as transaction_count'),
                    connection.raw('COUNT(DISTINCT recipient_id) as unique_recipients'),
                    connection.raw('CAST(SUM(service_amount) AS DECIMAL(12,2)) as service_amount_total')
               )
               .whereBetween('calculated_at', [query.startDate, query.endDate]);

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

     /**
      * Get commission by status breakdown
      */
     async getCommissionsByStatus(query: CommissionAnalyticsQuery): Promise<any[]> {
          const connection = await this.connection;

          let sqlQuery = connection('commission_tracking')
               .select(
                    'status',
                    connection.raw('CAST(SUM(final_commission) AS DECIMAL(12,2)) as total_commission'),
                    connection.raw('COUNT(*) as count'),
                    connection.raw('CAST(AVG(final_commission) AS DECIMAL(12,2)) as average_commission')
               )
               .whereBetween('calculated_at', [query.startDate, query.endDate])
               .groupBy('status');

          if (query.recipientType && query.recipientId) {
               sqlQuery = sqlQuery
                    .where('recipient_type', query.recipientType)
                    .where('recipient_id', query.recipientId);
          }

          sqlQuery = sqlQuery.orderBy('total_commission', 'desc');

          return await sqlQuery;
     }

     /**
      * Get commission by type breakdown
      */
     async getCommissionsByType(query: CommissionAnalyticsQuery): Promise<any[]> {
          const connection = await this.connection;

          let sqlQuery = connection('commission_tracking')
               .select(
                    'commission_type',
                    connection.raw('CAST(SUM(final_commission) AS DECIMAL(12,2)) as total_commission'),
                    connection.raw('COUNT(*) as count'),
                    connection.raw('CAST(AVG(final_commission) AS DECIMAL(12,2)) as average_commission')
               )
               .whereBetween('calculated_at', [query.startDate, query.endDate])
               .groupBy('commission_type');

          if (query.recipientType && query.recipientId) {
               sqlQuery = sqlQuery
                    .where('recipient_type', query.recipientType)
                    .where('recipient_id', query.recipientId);
          }

          sqlQuery = sqlQuery.orderBy('total_commission', 'desc');

          return await sqlQuery;
     }

     /**
      * Helper to get SQL date format based on period type
      */
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
