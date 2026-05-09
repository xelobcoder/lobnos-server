import { CommissionAnalyticsWithDate, CommissionAnalyticsQuery, PeriodAnalytics, RecipientAnalytics } from '../repositories/CommissionAnalyticsWithDate';

/** Commission payment analytics grouped by time period */
export interface CommissionAnalyticsResult {
     period: string;
     startDate: Date;
     endDate: Date;
     data: PeriodAnalytics[];
}

/** Commission payment analytics grouped by recipient */
export interface RecipientCommissionAnalyticsResult {
     period: string;
     startDate: Date;
     endDate: Date;
     recipientType: string;
     data: RecipientAnalytics[];
}

/** Summary statistics for commission payments */
export interface CommissionPaymentSummaryResult {
     totalPaid: number;
     totalDue: number;
     totalWaived: number;
     averagePaid: number;
     batchCount: number;
     uniqueRecipients: number;
     paymentPercentage: number;
     period: string;
}

/** Commission payment breakdown by status (pending, completed, cancelled) */
export interface CommissionStatusBreakdown {
     status: string;
     totalPaid: number;
     count: number;
     averagePaid: number;
}

/** Payment efficiency metrics for a recipient showing what % of due was paid */
export interface PaymentEfficiency {
     recipientId: number;
     recipientType: string;
     totalPaid: number;
     totalDue: number;
     totalWaived: number;
     paymentBatches: number;
     paymentPercentage: number;
}

export class CommissionAnalytics {
     private analyticsWithDate: CommissionAnalyticsWithDate;

     constructor(private tenantId: number) {
          this.analyticsWithDate = new CommissionAnalyticsWithDate(tenantId);
     }

     async getCommissionsByPeriod(query: CommissionAnalyticsQuery): Promise<CommissionAnalyticsResult> {
          const data = await this.analyticsWithDate.getCommissionsByPeriod(query);

          return {
               period: query.period,
               startDate: query.startDate,
               endDate: query.endDate,
               data: data as PeriodAnalytics[],
          };
     }

     async getCommissionsByRecipient(query: CommissionAnalyticsQuery): Promise<RecipientCommissionAnalyticsResult> {
          const data = await this.analyticsWithDate.getCommissionsByRecipient(query);

          return {
               period: query.period,
               startDate: query.startDate,
               endDate: query.endDate,
               recipientType: query.recipientType || 'clinician',
               data: data as RecipientAnalytics[],
          };
     }

     async getRecipientCommissionsByPeriod(query: CommissionAnalyticsQuery): Promise<CommissionAnalyticsResult> {
          if (!query.recipientType || !query.recipientId) {
               throw new Error('recipientType and recipientId are required for recipient-specific analytics');
          }

          const data = await this.analyticsWithDate.getRecipientCommissionsByPeriod(query);

          return {
               period: query.period,
               startDate: query.startDate,
               endDate: query.endDate,
               data: data as PeriodAnalytics[],
          };
     }

     async getPaymentSummary(query: CommissionAnalyticsQuery): Promise<CommissionPaymentSummaryResult> {
          const stats = await this.analyticsWithDate.getPeriodStatistics(query);

          const totalPaid = stats?.total_paid || 0;
          const totalDue = stats?.total_due || 0;
          const paymentPercentage = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100 * 100) / 100 : 0;

          return {
               totalPaid,
               totalDue,
               totalWaived: stats?.total_waived || 0,
               averagePaid: stats?.average_paid || 0,
               batchCount: stats?.batch_count || 0,
               uniqueRecipients: stats?.unique_recipients || 0,
               paymentPercentage,
               period: `${query.startDate.toISOString().split('T')[0]} to ${query.endDate.toISOString().split('T')[0]}`,
          };
     }

     async getPaymentsByStatus(query: CommissionAnalyticsQuery): Promise<CommissionStatusBreakdown[]> {
          const data = await this.analyticsWithDate.getCommissionsByStatus(query);

          return data.map((item: any) => ({
               status: item.status,
               totalPaid: item.total_paid || 0,
               count: item.count || 0,
               averagePaid: item.average_paid || 0,
          }));
     }

     async getRecipientPaymentEfficiency(query: CommissionAnalyticsQuery): Promise<PaymentEfficiency[]> {
          const data = await this.analyticsWithDate.getRecipientPaymentEfficiency(query);

          return data.map((item: any) => ({
               recipientId: item.recipient_id,
               recipientType: item.recipient_type,
               totalPaid: item.total_paid || 0,
               totalDue: item.total_due || 0,
               totalWaived: item.total_waived || 0,
               paymentBatches: item.payment_batches || 0,
               paymentPercentage: item.payment_percentage || 0,
          }));
     }

     async getComprehensiveDashboard(query: CommissionAnalyticsQuery): Promise<any> {
          const [periodData, statusData, efficiencyData, summary] = await Promise.all([
               this.analyticsWithDate.getCommissionsByPeriod(query),
               this.analyticsWithDate.getCommissionsByStatus(query),
               this.analyticsWithDate.getRecipientPaymentEfficiency(query),
               this.analyticsWithDate.getPeriodStatistics(query),
          ]);

          const totalPaid = summary?.total_paid || 0;
          const totalDue = summary?.total_due || 0;
          const paymentPercentage = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100 * 100) / 100 : 0;

          return {
               summary: {
                    totalPaid,
                    totalDue,
                    totalWaived: summary?.total_waived || 0,
                    averagePaid: summary?.average_paid || 0,
                    batchCount: summary?.batch_count || 0,
                    uniqueRecipients: summary?.unique_recipients || 0,
                    paymentPercentage,
                    period: `${query.startDate.toISOString().split('T')[0]} to ${query.endDate.toISOString().split('T')[0]}`,
               },
               byPeriod: {
                    period: query.period,
                    data: periodData,
               },
               byStatus: statusData.map((item: any) => ({
                    status: item.status,
                    totalPaid: item.total_paid || 0,
                    count: item.count || 0,
                    averagePaid: item.average_paid || 0,
               })),
               recipientEfficiency: efficiencyData.map((item: any) => ({
                    recipientId: item.recipient_id,
                    recipientType: item.recipient_type,
                    totalPaid: item.total_paid || 0,
                    totalDue: item.total_due || 0,
                    paymentPercentage: item.payment_percentage || 0,
                    paymentBatches: item.payment_batches || 0,
               })),
          };
     }

     private formatDateRange(startDate: Date, endDate: Date): string {
          const start = startDate.toISOString().split('T')[0];
          const end = endDate.toISOString().split('T')[0];
          return `${start} to ${end}`;
     }
}
