import { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';

export interface PaymentTimeSeriesData {
     period: string;
     payment_count: number;
     total_amount: number;
     average_amount: number;
     unique_suppliers: number;
}

export interface PaymentAnalyticsSummary {
     total_payments_all_time: number;
     total_amount_all_time: number;
     average_payment_amount: number;
     payments_in_date_range: number;
     amount_in_date_range: number;
}

export class InventoryPaymentAnalyticsModel {
     private connection: Promise<Knex<any, any[]>>;

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async getMonthlyPayments(startDate?: string, endDate?: string): Promise<PaymentTimeSeriesData[]> {
          const connection = await this.connection;

          const result = await connection.raw(`
               SELECT
                    DATE_FORMAT(payment_date, '%Y-%m') as period,
                    COUNT(*) as payment_count,
                    SUM(payment_amount) as total_amount,
                    AVG(payment_amount) as average_amount,
                    COUNT(DISTINCT supplier_id) as unique_suppliers
               FROM inv_supplier_payments
               WHERE payment_status = 'completed'
               ${startDate ? `AND payment_date >= '${startDate}'` : 'AND payment_date >= DATE_SUB(CURDATE(), INTERVAL 24 MONTH)'}
               ${endDate ? `AND payment_date <= '${endDate}'` : ''}
               GROUP BY period
               ORDER BY period DESC
               LIMIT 24
          `);
          return result[0]?.map((row: any) => ({
               period: row.period,
               payment_count: parseInt(row.payment_count) || 0,
               total_amount: parseFloat(row.total_amount) || 0,
               average_amount: parseFloat(row.average_amount) || 0,
               unique_suppliers: parseInt(row.unique_suppliers) || 0
          })) || [];
     }

     async getYearlyPayments(startDate?: string, endDate?: string): Promise<PaymentTimeSeriesData[]> {
          const connection = await this.connection;

          const result = await connection.raw(`
               SELECT
                    YEAR(payment_date) as period,
                    COUNT(*) as payment_count,
                    SUM(payment_amount) as total_amount,
                    AVG(payment_amount) as average_amount,
                    COUNT(DISTINCT supplier_id) as unique_suppliers
               FROM inv_supplier_payments
               WHERE payment_status = 'completed'
               ${startDate ? `AND payment_date >= '${startDate}'` : 'AND payment_date >= DATE_SUB(CURDATE(), INTERVAL 5 YEAR)'}
               ${endDate ? `AND payment_date <= '${endDate}'` : ''}
               GROUP BY period
               ORDER BY period DESC
               LIMIT 5
          `);
          return result[0]?.map((row: any) => ({
               period: row.period.toString(),
               payment_count: parseInt(row.payment_count) || 0,
               total_amount: parseFloat(row.total_amount) || 0,
               average_amount: parseFloat(row.average_amount) || 0,
               unique_suppliers: parseInt(row.unique_suppliers) || 0
          })) || [];
     }

     async getDailyPayments(startDate?: string, endDate?: string): Promise<PaymentTimeSeriesData[]> {
          const connection = await this.connection;

          const result = await connection.raw(`
               SELECT
                    DATE(payment_date) as period,
                    COUNT(*) as payment_count,
                    SUM(payment_amount) as total_amount,
                    AVG(payment_amount) as average_amount,
                    COUNT(DISTINCT supplier_id) as unique_suppliers
               FROM inv_supplier_payments
               WHERE payment_status = 'completed'
               AND payment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
               ${startDate ? `AND payment_date >= '${startDate}'` : ''}
               ${endDate ? `AND payment_date <= '${endDate}'` : ''}
               GROUP BY period
               ORDER BY period DESC
          `);
          return result[0]?.map((row: any) => ({
               period: row.period,
               payment_count: parseInt(row.payment_count) || 0,
               total_amount: parseFloat(row.total_amount) || 0,
               average_amount: parseFloat(row.average_amount) || 0,
               unique_suppliers: parseInt(row.unique_suppliers) || 0
          })) || [];
     }

     async getHourlyPayments(startDate?: string, endDate?: string): Promise<PaymentTimeSeriesData[]> {
          const connection = await this.connection;

          const result = await connection.raw(`
               SELECT
                    DATE_FORMAT(payment_date, '%Y-%m-%d %H:00') as period,
                    COUNT(*) as payment_count,
                    SUM(payment_amount) as total_amount,
                    AVG(payment_amount) as average_amount,
                    COUNT(DISTINCT supplier_id) as unique_suppliers
               FROM inv_supplier_payments
               WHERE payment_status = 'completed'
               AND payment_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
               ${startDate ? `AND payment_date >= '${startDate}'` : ''}
               ${endDate ? `AND payment_date <= '${endDate}'` : ''}
               GROUP BY period
               ORDER BY period DESC
          `);
          return result[0]?.map((row: any) => ({
               period: row.period,
               payment_count: parseInt(row.payment_count) || 0,
               total_amount: parseFloat(row.total_amount) || 0,
               average_amount: parseFloat(row.average_amount) || 0,
               unique_suppliers: parseInt(row.unique_suppliers) || 0
          })) || [];
     }

     async getPaymentSummary(startDate?: string, endDate?: string): Promise<PaymentAnalyticsSummary> {
          const connection = await this.connection;

          let query = connection('inv_supplier_payments')
               .select(
                    connection.raw('COUNT(*) as total_payments_all_time'),
                    connection.raw('SUM(payment_amount) as total_amount_all_time'),
                    connection.raw('AVG(payment_amount) as average_payment_amount'),
                    connection.raw(`SUM(CASE WHEN payment_date >= ${startDate ? `'${startDate}'` : 'DATE_SUB(CURDATE(), INTERVAL 30 DAY)'} THEN 1 ELSE 0 END) as payments_in_range`),
                    connection.raw(`SUM(CASE WHEN payment_date >= ${startDate ? `'${startDate}'` : 'DATE_SUB(CURDATE(), INTERVAL 30 DAY)'} AND payment_date <= ${endDate ? `'${endDate}'` : 'CURDATE()'} THEN payment_amount ELSE 0 END) as amount_in_range`)
               )
               .where('payment_status', 'completed');

          const result = await query.first() as any;

          return {
               total_payments_all_time: parseInt(result?.total_payments_all_time) || 0,
               total_amount_all_time: parseFloat(result?.total_amount_all_time) || 0,
               average_payment_amount: parseFloat(result?.average_payment_amount) || 0,
               payments_in_date_range: parseInt(result?.payments_in_range) || 0,
               amount_in_date_range: parseFloat(result?.amount_in_range) || 0
          };
     }
}