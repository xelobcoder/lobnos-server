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


          let sqlQuery = this.facts(connection)
               .select(
                    connection.raw(`${this.periodExpression(query.period)} as period`),
                    connection.raw(`${this.periodStart(query.period)} as period_start`),
                    connection.raw(`${this.periodEnd(query.period)} as period_end`),
                    connection.raw('CAST(SUM(payment_amount) AS DECIMAL(12,2)) as total_paid'),
                    connection.raw('CAST(AVG(NULLIF(payment_amount, 0)) AS DECIMAL(12,2)) as average_paid'),
                    connection.raw('CAST(SUM(waived_amount) AS DECIMAL(12,2)) as total_waived'),
                    connection.raw('COUNT(DISTINCT facts.id) as batch_count'),
                    connection.raw('CAST(SUM(total_commission_amount) AS DECIMAL(12,2)) as total_due')
               )
               .whereRaw('COALESCE(payment_date, created_at) >= ? AND COALESCE(payment_date, created_at) < DATE_ADD(DATE(?), INTERVAL 1 DAY)', [query.startDate, query.endDate])
               .groupByRaw(`${this.periodExpression(query.period)}`);

          if (query.recipientType) {
               sqlQuery = sqlQuery
                    .where('recipient_type', query.recipientType)
                    .modify(builder => { if (query.recipientId) builder.where('recipient_id', query.recipientId); });
          }

          if (query.status) {
               sqlQuery = sqlQuery.where('status', query.status);
          }

          sqlQuery = sqlQuery.orderBy('period', 'asc');

          return await sqlQuery as unknown as PeriodAnalytics[];
     }

     async getCommissionsByRecipient(query: CommissionAnalyticsQuery): Promise<RecipientAnalytics[]> {
          const connection = await this.connection;


          const recipientType = query.recipientType || 'clinician';

          let sqlQuery = this.facts(connection)
               .select(
                    'recipient_id',
                    'recipient_type',
                    connection.raw(`${this.periodExpression(query.period)} as period`),
                    connection.raw(`${this.periodStart(query.period)} as period_start`),
                    connection.raw(`${this.periodEnd(query.period)} as period_end`),
                    connection.raw('CAST(SUM(payment_amount) AS DECIMAL(12,2)) as total_paid'),
                    connection.raw('CAST(AVG(NULLIF(payment_amount, 0)) AS DECIMAL(12,2)) as average_paid'),
                    connection.raw('CAST(SUM(waived_amount) AS DECIMAL(12,2)) as total_waived'),
                    connection.raw('COUNT(DISTINCT facts.id) as batch_count'),
                    connection.raw('CAST(SUM(total_commission_amount) AS DECIMAL(12,2)) as total_due')
               )
               .whereRaw('COALESCE(payment_date, created_at) >= ? AND COALESCE(payment_date, created_at) < DATE_ADD(DATE(?), INTERVAL 1 DAY)', [query.startDate, query.endDate])
               .where('recipient_type', recipientType)
               .groupByRaw(`recipient_id, recipient_type, ${this.periodExpression(query.period)}`);

          if (query.status) {
               sqlQuery = sqlQuery.where('status', query.status);
          }

          sqlQuery = sqlQuery
               .orderBy('recipient_id', 'asc')
               .orderBy('period', 'asc');

          return await sqlQuery as RecipientAnalytics[];
     }

     async getRecipientCommissionsByPeriod(query: CommissionAnalyticsQuery): Promise<PeriodAnalytics[]> {
          if (!query.recipientType || !query.recipientId) {
               throw new Error('recipientType and recipientId are required');
          }

          const connection = await this.connection;


          let sqlQuery = this.facts(connection)
               .select(
                    connection.raw(`${this.periodExpression(query.period)} as period`),
                    connection.raw(`${this.periodStart(query.period)} as period_start`),
                    connection.raw(`${this.periodEnd(query.period)} as period_end`),
                    connection.raw('CAST(SUM(payment_amount) AS DECIMAL(12,2)) as total_paid'),
                    connection.raw('CAST(AVG(NULLIF(payment_amount, 0)) AS DECIMAL(12,2)) as average_paid'),
                    connection.raw('CAST(SUM(waived_amount) AS DECIMAL(12,2)) as total_waived'),
                    connection.raw('COUNT(DISTINCT facts.id) as batch_count'),
                    connection.raw('CAST(SUM(total_commission_amount) AS DECIMAL(12,2)) as total_due')
               )
               .whereRaw('COALESCE(payment_date, created_at) >= ? AND COALESCE(payment_date, created_at) < DATE_ADD(DATE(?), INTERVAL 1 DAY)', [query.startDate, query.endDate])
               .where('recipient_type', query.recipientType)
               .where('recipient_id', query.recipientId)
               .groupByRaw(`${this.periodExpression(query.period)}`);

          if (query.status) {
               sqlQuery = sqlQuery.where('status', query.status);
          }

          sqlQuery = sqlQuery.orderBy('period', 'asc');

          return await sqlQuery as unknown as PeriodAnalytics[];
     }

     async getPeriodStatistics(query: CommissionAnalyticsQuery): Promise<any> {
          const connection = await this.connection;

          let sqlQuery = this.facts(connection)
               .select(
                    connection.raw('CAST(SUM(payment_amount) AS DECIMAL(12,2)) as total_paid'),
                    connection.raw('CAST(AVG(NULLIF(payment_amount, 0)) AS DECIMAL(12,2)) as average_paid'),
                    connection.raw('CAST(MIN(payment_amount) AS DECIMAL(12,2)) as min_paid'),
                    connection.raw('CAST(MAX(payment_amount) AS DECIMAL(12,2)) as max_paid'),
                    connection.raw('COUNT(DISTINCT facts.id) as batch_count'),
                    connection.raw('COUNT(DISTINCT recipient_type, recipient_id) as unique_recipients'),
                    connection.raw('CAST(SUM(total_commission_amount) AS DECIMAL(12,2)) as total_due'),
                    connection.raw('CAST(SUM(waived_amount) AS DECIMAL(12,2)) as total_waived')
               )
               .whereRaw('COALESCE(payment_date, created_at) >= ? AND COALESCE(payment_date, created_at) < DATE_ADD(DATE(?), INTERVAL 1 DAY)', [query.startDate, query.endDate]);

          if (query.recipientType) {
               sqlQuery = sqlQuery
                    .where('recipient_type', query.recipientType)
                    .modify(builder => { if (query.recipientId) builder.where('recipient_id', query.recipientId); });
          }

          if (query.status) {
               sqlQuery = sqlQuery.where('status', query.status);
          }

          return await sqlQuery.first();
     }

     async getCommissionsByStatus(query: CommissionAnalyticsQuery): Promise<any[]> {
          const connection = await this.connection;

          let sqlQuery = this.facts(connection)
               .select(
                    'status',
                    connection.raw('CAST(SUM(payment_amount) AS DECIMAL(12,2)) as total_paid'),
                    connection.raw('COUNT(DISTINCT facts.id) as count'),
                    connection.raw('CAST(AVG(NULLIF(payment_amount, 0)) AS DECIMAL(12,2)) as average_paid')
               )
               .whereRaw('COALESCE(payment_date, created_at) >= ? AND COALESCE(payment_date, created_at) < DATE_ADD(DATE(?), INTERVAL 1 DAY)', [query.startDate, query.endDate])
               .groupBy('status');

          if (query.recipientType) {
               sqlQuery = sqlQuery
                    .where('recipient_type', query.recipientType)
                    .modify(builder => { if (query.recipientId) builder.where('recipient_id', query.recipientId); });
          }

          sqlQuery = sqlQuery.orderBy('total_paid', 'desc');

          return await sqlQuery;
     }

     async getRecipientPaymentEfficiency(query: CommissionAnalyticsQuery): Promise<any[]> {
          const connection = await this.connection;

          let sqlQuery = this.facts(connection)
               .leftJoin('organization', function () {
                    this.on('facts.recipient_id', '=', 'organization.id')
                         .andOn('facts.recipient_type', '=', connection.raw('?', ['organization']));
               })
               .leftJoin('clinicianbasicinfo', function () {
                    this.on('facts.recipient_id', '=', 'clinicianbasicinfo.id')
                         .andOn('facts.recipient_type', '=', connection.raw('?', ['clinician']));
               })
               .select(
                    'recipient_id',
                    'recipient_type',
                    connection.raw('MAX(COALESCE(organization.name, clinicianbasicinfo.name)) as recipient_name'),
                    connection.raw('CAST(SUM(payment_amount) AS DECIMAL(12,2)) as total_paid'),
                    connection.raw('CAST(SUM(total_commission_amount) AS DECIMAL(12,2)) as total_due'),
                    connection.raw('CAST(SUM(waived_amount) AS DECIMAL(12,2)) as total_waived'),
                    connection.raw('COUNT(DISTINCT facts.id) as payment_batches'),
                    connection.raw('ROUND((SUM(payment_amount) / NULLIF(SUM(total_commission_amount), 0)) * 100, 2) as payment_percentage')
               )
               .whereRaw('COALESCE(payment_date, created_at) >= ? AND COALESCE(payment_date, created_at) < DATE_ADD(DATE(?), INTERVAL 1 DAY)', [query.startDate, query.endDate])
               .groupBy('recipient_id', 'recipient_type');

          if (query.recipientType) {
               sqlQuery = sqlQuery.where('recipient_type', query.recipientType);
               if (query.recipientId) sqlQuery.where('recipient_id', query.recipientId);
          }

          if (query.status) {
               sqlQuery = sqlQuery.where('status', query.status);
          }

          sqlQuery = sqlQuery.orderBy('total_paid', 'desc');

          return await sqlQuery;
     }

     /** Earned obligations and cash events retain their own dates and recorded beneficiaries. */
     private facts(connection: Knex): Knex.QueryBuilder {
          return connection.from(connection.raw(`(
               SELECT NULL AS id, recipient_id, recipient_type,
                    CASE WHEN status = 'paid' THEN 'completed' ELSE 'pending' END AS status,
                    calculated_at AS payment_date, calculated_at AS created_at,
                    0 AS payment_amount, 0 AS waived_amount, final_commission AS total_commission_amount
               FROM commission_tracking WHERE status NOT IN ('voided', 'adjusted')
               UNION ALL
               SELECT b.id, b.recipient_id, b.recipient_type, b.status,
                    b.created_at, b.created_at, 0, 0, b.total_commission_amount
               FROM commission_batch_payments b WHERE b.status <> 'cancelled'
                    AND NOT EXISTS (SELECT 1 FROM commission_batch_payment_services service
                         JOIN commission_tracking tracking ON tracking.service_id = service.serviceid
                         WHERE service.batch_payment_id = b.id AND tracking.status NOT IN ('voided','adjusted'))
               UNION ALL
               SELECT b.id, b.recipient_id, b.recipient_type, b.status,
                    p.payment_date, p.payment_date, p.amount, 0, 0
               FROM expense_payments p JOIN commission_batch_payments b ON b.expense_id = p.expense_id
               WHERE p.status = 'Paid'
               UNION ALL
               SELECT b.id, b.recipient_id, b.recipient_type, b.status,
                    r.reversed_on, r.reversed_on, -r.reversed_amount, 0, 0
               FROM expense_payment_reversals r JOIN expense_payments p ON p.id = r.payment_id
               JOIN commission_batch_payments b ON b.expense_id = p.expense_id
               UNION ALL
               SELECT b.id, b.recipient_id, b.recipient_type, b.status,
                    COALESCE(b.payment_date, b.created_at), b.created_at, b.payment_amount, 0, 0
               FROM commission_batch_payments b
               WHERE b.expense_id IS NULL AND b.status <> 'cancelled'
               UNION ALL
               SELECT b.id, b.recipient_id, b.recipient_type, b.status,
                    b.created_at, b.created_at, 0, b.waived_amount, 0
               FROM commission_batch_payments b WHERE b.status <> 'cancelled'
          ) AS facts`));
     }

     private periodStart(period: PeriodType): string {
          const date = 'COALESCE(payment_date, created_at)';
          const expressions: Record<PeriodType, string> = {
               daily: `DATE(${date})`,
               weekly: `DATE_SUB(DATE(${date}), INTERVAL WEEKDAY(${date}) DAY)`,
               monthly: `CAST(DATE_FORMAT(${date}, '%Y-%m-01') AS DATE)`,
               quarterly: `DATE_ADD(MAKEDATE(YEAR(${date}), 1), INTERVAL ((QUARTER(${date}) - 1) * 3) MONTH)`,
               yearly: `MAKEDATE(YEAR(${date}), 1)`
          };
          return `MIN(${expressions[period]})`;
     }

     private periodEnd(period: PeriodType): string {
          const units: Record<PeriodType, string> = {daily: 'DAY', weekly: 'WEEK', monthly: 'MONTH', quarterly: 'QUARTER', yearly: 'YEAR'};
          return `DATE_SUB(DATE_ADD(${this.periodStart(period)}, INTERVAL 1 ${units[period]}), INTERVAL 1 DAY)`;
     }

     private periodExpression(period: PeriodType): string {
          if (period === 'quarterly') return "CONCAT(YEAR(COALESCE(payment_date, created_at)), '-Q', QUARTER(COALESCE(payment_date, created_at)))";
          return `DATE_FORMAT(COALESCE(payment_date, created_at), '${this.getPeriodFormat(period)}')`;
     }

     private getPeriodFormat(period: PeriodType): string {
          const formats: Record<PeriodType, string> = {
               daily: '%Y-%m-%d',
               weekly: '%x-W%v',
               monthly: '%Y-%m',
               quarterly: 'Q%q-%Y',
               yearly: '%Y',
          };
          return formats[period];
     }
}
