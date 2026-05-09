import { Request, Response } from 'express';
import { CommissionAnalytics } from '../services/CommissionAnalytics';
import { CommissionAnalyticsQuery } from '../repositories/CommissionAnalyticsWithDate';

export class CommissionAnalyticsController {
     /**
      * Get commission payments grouped by time period
      * GET /api/v1/commission/analytics/by-period
      * Query params: startDate, endDate, period (daily|weekly|monthly|quarterly|yearly), recipientType?, recipientId?, status?
      */
     static async getCommissionsByPeriod(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const startDate = new Date(req.query.startDate as string);
               const endDate = new Date(req.query.endDate as string);
               const period = (req.query.period as string) || 'monthly';

               if (!tenantId || isNaN(tenantId) || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: 'Invalid tenantId, startDate, or endDate',
                    });
                    return;
               }

               const recipientType = req.query.recipientType as string | undefined;
               const recipientId = req.query.recipientId ? parseInt(req.query.recipientId as string) : undefined;
               const status = req.query.status as string | undefined;

               const query: CommissionAnalyticsQuery = {
                    tenantId,
                    startDate,
                    endDate,
                    period: period as any,
                    recipientType: recipientType as any,
                    recipientId,
                    status: status as any,
               };

               const analytics = new CommissionAnalytics(tenantId);
               const result = await analytics.getCommissionsByPeriod(query);

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result,
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to retrieve period analytics',
               });
          }
     }

     /**
      * Get commission payments by recipient
      * GET /api/v1/commission/analytics/by-recipient
      * Query params: startDate, endDate, period, recipientType, status?
      */
     static async getCommissionsByRecipient(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const startDate = new Date(req.query.startDate as string);
               const endDate = new Date(req.query.endDate as string);
               const period = (req.query.period as string) || 'monthly';
               const recipientType = req.query.recipientType as string;

               if (!tenantId || isNaN(tenantId) || isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || !recipientType) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: 'Invalid parameters: tenantId, startDate, endDate, and recipientType are required',
                    });
                    return;
               }

               const status = req.query.status as string | undefined;

               const query: CommissionAnalyticsQuery = {
                    tenantId,
                    startDate,
                    endDate,
                    period: period as any,
                    recipientType: recipientType as any,
                    status: status as any,
               };

               const analytics = new CommissionAnalytics(tenantId);
               const result = await analytics.getCommissionsByRecipient(query);

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result,
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to retrieve recipient analytics',
               });
          }
     }

     /**
      * Get commission payments for a specific recipient across periods
      * GET /api/v1/commission/analytics/recipient/:recipientId
      * Query params: startDate, endDate, period, recipientType, status?
      */
     static async getRecipientCommissionsByPeriod(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const recipientId = parseInt(req.params.recipientId);
               const startDate = new Date(req.query.startDate as string);
               const endDate = new Date(req.query.endDate as string);
               const period = (req.query.period as string) || 'monthly';
               const recipientType = req.query.recipientType as string;

               if (!tenantId || !recipientId || isNaN(tenantId) || isNaN(recipientId) ||
                    isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || !recipientType) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: 'Invalid parameters: tenantId, recipientId, startDate, endDate, and recipientType are required',
                    });
                    return;
               }

               const status = req.query.status as string | undefined;

               const query: CommissionAnalyticsQuery = {
                    tenantId,
                    startDate,
                    endDate,
                    period: period as any,
                    recipientType: recipientType as any,
                    recipientId,
                    status: status as any,
               };

               const analytics = new CommissionAnalytics(tenantId);
               const result = await analytics.getRecipientCommissionsByPeriod(query);

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result,
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to retrieve recipient analytics',
               });
          }
     }

     /**
      * Get commission payment summary
      * GET /api/v1/commission/analytics/summary
      * Query params: startDate, endDate, recipientType?, recipientId?, status?
      */
     static async getPaymentSummary(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const startDate = new Date(req.query.startDate as string);
               const endDate = new Date(req.query.endDate as string);

               if (!tenantId || isNaN(tenantId) || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: 'Invalid tenantId, startDate, or endDate',
                    });
                    return;
               }

               const recipientType = req.query.recipientType as string | undefined;
               const recipientId = req.query.recipientId ? parseInt(req.query.recipientId as string) : undefined;
               const status = req.query.status as string | undefined;

               const query: CommissionAnalyticsQuery = {
                    tenantId,
                    startDate,
                    endDate,
                    period: 'monthly', // Not used for summary
                    recipientType: recipientType as any,
                    recipientId,
                    status: status as any,
               };

               const analytics = new CommissionAnalytics(tenantId);
               const result = await analytics.getPaymentSummary(query);

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result,
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to retrieve payment summary',
               });
          }
     }

     /**
      * Get commission payments by status breakdown
      * GET /api/v1/commission/analytics/by-status
      * Query params: startDate, endDate, recipientType?, recipientId?
      */
     static async getPaymentsByStatus(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const startDate = new Date(req.query.startDate as string);
               const endDate = new Date(req.query.endDate as string);

               if (!tenantId || isNaN(tenantId) || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: 'Invalid tenantId, startDate, or endDate',
                    });
                    return;
               }

               const recipientType = req.query.recipientType as string | undefined;
               const recipientId = req.query.recipientId ? parseInt(req.query.recipientId as string) : undefined;

               const query: CommissionAnalyticsQuery = {
                    tenantId,
                    startDate,
                    endDate,
                    period: 'monthly',
                    recipientType: recipientType as any,
                    recipientId,
               };

               const analytics = new CommissionAnalytics(tenantId);
               const result = await analytics.getPaymentsByStatus(query);

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result,
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to retrieve status breakdown',
               });
          }
     }

     /**
      * Get recipient payment efficiency
      * GET /api/v1/commission/analytics/efficiency
      * Query params: startDate, endDate, status?
      */
     static async getRecipientPaymentEfficiency(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const startDate = new Date(req.query.startDate as string);
               const endDate = new Date(req.query.endDate as string);

               if (!tenantId || isNaN(tenantId) || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: 'Invalid tenantId, startDate, or endDate',
                    });
                    return;
               }

               const status = req.query.status as string | undefined;

               const query: CommissionAnalyticsQuery = {
                    tenantId,
                    startDate,
                    endDate,
                    period: 'monthly',
                    status: status as any,
               };

               const analytics = new CommissionAnalytics(tenantId);
               const result = await analytics.getRecipientPaymentEfficiency(query);

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result,
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to retrieve efficiency data',
               });
          }
     }

     /**
      * Get comprehensive analytics dashboard
      * GET /api/v1/commission/analytics/dashboard
      * Query params: startDate, endDate, period (daily|weekly|monthly|quarterly|yearly), recipientType?, recipientId?, status?
      */
     static async getComprehensiveDashboard(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const startDate = new Date(req.query.startDate as string);
               const endDate = new Date(req.query.endDate as string);
               const period = (req.query.period as string) || 'monthly';

               if (!tenantId || isNaN(tenantId) || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: 'Invalid tenantId, startDate, or endDate',
                    });
                    return;
               }

               const recipientType = req.query.recipientType as string | undefined;
               const recipientId = req.query.recipientId ? parseInt(req.query.recipientId as string) : undefined;
               const status = req.query.status as string | undefined;

               const query: CommissionAnalyticsQuery = {
                    tenantId,
                    startDate,
                    endDate,
                    period: period as any,
                    recipientType: recipientType as any,
                    recipientId,
                    status: status as any,
               };

               const analytics = new CommissionAnalytics(tenantId);
               const result = await analytics.getComprehensiveDashboard(query);

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result,
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to retrieve dashboard data',
               });
          }
     }
}
