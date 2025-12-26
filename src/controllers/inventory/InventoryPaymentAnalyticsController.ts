import { Request, Response } from 'express';
import { InventoryPaymentAnalyticsModel } from '../../models/inventory/InventoryPaymentAnalytics';
import { ApiResponse } from '../../models/inventory';


export interface PaymentTimeAnalytics {
     period: string;
     payment_count: number;
     total_amount: number;
     average_amount: number;
     unique_suppliers: number;
}

export interface InventoryPaymentAnalyticsData {
     monthly_payments: PaymentTimeAnalytics[];
     yearly_payments: PaymentTimeAnalytics[];
     daily_payments: PaymentTimeAnalytics[];
     hourly_payments: PaymentTimeAnalytics[];
     summary: {
          total_payments_all_time: number;
          total_amount_all_time: number;
          average_payment_amount: number;
          payments_in_date_range: number;
          amount_in_date_range: number;
     };
}

export class InventoryPaymentAnalyticsController {
     private getTenantId(req: Request): number {
          return parseInt(req.query.tenantId as string) || 1;
     }

     async getPaymentTimeAnalytics(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const { start_date, end_date } = req.query;

               const analyticsModel = new InventoryPaymentAnalyticsModel(tenantId);

               // Get all analytics data in parallel
               const [
                    monthlyPayments,
                    yearlyPayments,
                    dailyPayments,
                    hourlyPayments,
                    summary
               ] = await Promise.all([
                    analyticsModel.getMonthlyPayments(start_date as string, end_date as string),
                    analyticsModel.getYearlyPayments(start_date as string, end_date as string),
                    analyticsModel.getDailyPayments(start_date as string, end_date as string),
                    analyticsModel.getHourlyPayments(start_date as string, end_date as string),
                    analyticsModel.getPaymentSummary(start_date as string, end_date as string)
               ]);

               const analytics: InventoryPaymentAnalyticsData = {
                    monthly_payments: monthlyPayments,
                    yearly_payments: yearlyPayments,
                    daily_payments: dailyPayments,
                    hourly_payments: hourlyPayments,
                    summary
               };

               const response: ApiResponse<InventoryPaymentAnalyticsData> = {
                    success: true,
                    message: 'Inventory payment time analytics retrieved successfully',
                    data: analytics
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error retrieving inventory payment analytics:', error);
               const response: ApiResponse<null> = {
                    success: false,
                    message: error.message || 'Failed to retrieve inventory payment analytics',
                    data: null
               };
               res.status(500).json(response);
          }
     }
}