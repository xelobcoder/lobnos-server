import { CommissionServiceFactory } from "../commissionConfigutationRepo";
import { Request, Response } from "express";
export class CommissionTrackingController {
     /**
      * Get tracking record by ID
      * GET /api/v1/commission/tracking/:id
      */
     static async getTracking(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const trackingId = parseInt(req.params.id);

               if (!tenantId || !trackingId || isNaN(tenantId) || isNaN(trackingId)) {
                    res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId or trackingId' });
                    return;
               }

               const repository = CommissionServiceFactory.createTrackingRepository(tenantId);
               const tracking = await repository.findById(trackingId);

               if (!tracking) {
                    res.status(404).json({
                         status: 'error',
                         statusCode: 404,
                         message: 'Tracking record not found',
                    });
                    return;
               }

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result: tracking,
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to retrieve tracking record',
               });
          }
     }

     /**
      * Get all tracking records for a service
      * GET /api/v1/commission/tracking/service/:serviceId
      */
     static async getServiceTracking(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const serviceId = parseInt(req.params.serviceId);

               if (!tenantId || !serviceId || isNaN(tenantId) || isNaN(serviceId)) {
                    res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId or serviceId' });
                    return;
               }

               const repository = CommissionServiceFactory.createTrackingRepository(tenantId);
               const trackings = await repository.findByServiceId(serviceId);

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result: trackings,
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to retrieve tracking records',
               });
          }
     }

     /**
      * Get all unpaid commissions for a recipient
      * GET /api/v1/commission/tracking/unpaid
      */
     static async getUnpaidTracking(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const recipientType = req.query.recipientType as string;
               const recipientId = parseInt(req.query.recipientId as string);
               const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

               if (!tenantId || !recipientType || !recipientId || isNaN(tenantId) || isNaN(recipientId)) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: 'Invalid tenantId, recipientType, or recipientId',
                    });
                    return;
               }

               const validTypes = ['clinician', 'organization'];
               if (!validTypes.includes(recipientType)) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: `Invalid recipientType. Must be one of: ${validTypes.join(', ')}`,
                    });
                    return;
               }

               const repository = CommissionServiceFactory.createTrackingRepository(tenantId);
               const unpaid = await repository.findByRecipient(
                    recipientType as 'clinician' | 'organization',
                    recipientId,
                    limit
               );

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result: unpaid,
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to retrieve unpaid commissions',
               });
          }
     }

     /**
      * Get commission summary for a recipient
      * GET /api/v1/commission/tracking/summary
      */
     static async getSummary(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const recipientType = req.query.recipientType as string;
               const recipientId = parseInt(req.query.recipientId as string);

               if (!tenantId || !recipientType || !recipientId || isNaN(tenantId) || isNaN(recipientId)) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: 'Invalid tenantId, recipientType, or recipientId',
                    });
                    return;
               }

               const validTypes = ['clinician', 'organization'];
               if (!validTypes.includes(recipientType)) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: `Invalid recipientType. Must be one of: ${validTypes.join(', ')}`,
                    });
                    return;
               }

               const repository = CommissionServiceFactory.createTrackingRepository(tenantId);
               const summary = await repository.getSummary(recipientType as 'clinician' | 'organization');

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result: summary,
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to retrieve summary',
               });
          }
     }

     /**
      * Get tracking records by status
      * GET /api/v1/commission/tracking/status/:status
      */
     static async getByStatus(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const status = req.params.status;

               if (!tenantId || !status || isNaN(tenantId)) {
                    res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId or status' });
                    return;
               }

               const validStatuses = ['pending', 'approved', 'paid', 'voided', 'adjusted'];
               if (!validStatuses.includes(status)) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
                    });
                    return;
               }

               const repository = CommissionServiceFactory.createTrackingRepository(tenantId);
               const trackings = await repository.findByStatus(status as any);

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result: trackings,
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to retrieve tracking records',
               });
          }
     }

     /**
      * Get tracking records for a recipient
      * GET /api/v1/commission/tracking/recipient
      */
     static async getByRecipient(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const recipientType = req.query.recipientType as string;
               const recipientId = parseInt(req.query.recipientId as string);

               if (!tenantId || !recipientType || !recipientId || isNaN(tenantId) || isNaN(recipientId)) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: 'Invalid tenantId, recipientType, or recipientId',
                    });
                    return;
               }

               const repository = CommissionServiceFactory.createTrackingRepository(tenantId);
               const trackings = await repository.findByRecipient(recipientType as any, recipientId);

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result: trackings,
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to retrieve tracking records',
               });
          }
     }

     /**
      * Get period total for a recipient
      * GET /api/v1/commission/tracking/period-total
      */
     static async getPeriodTotal(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const recipientType = req.query.recipientType as string;
               const recipientId = parseInt(req.query.recipientId as string);
               const periodRef = req.query.periodRef as string;

               if (!tenantId || !recipientType || !recipientId || !periodRef || isNaN(tenantId) || isNaN(recipientId)) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: 'Invalid tenantId, recipientType, recipientId, or periodRef',
                    });
                    return;
               }

               const statuses = (req.query.statuses as string)?.split(',') || ['pending', 'approved', 'paid'];

               const repository = CommissionServiceFactory.createTrackingRepository(tenantId);
               const total = await repository.getPeriodTotal(
                    recipientType as any,
                    recipientId,
                    new Date(periodRef),
                    statuses as any
               );

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result: { total, period: periodRef },
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to retrieve period total',
               });
          }
     }

     /**
      * Update tracking status (mark as paid, approved, voided, etc.)
      * PUT /api/v1/commission/tracking/:id/status
      */
     static async updateStatus(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const trackingId = parseInt(req.params.id);
               const { status } = req.body;

               if (!tenantId || !trackingId || !status || isNaN(tenantId) || isNaN(trackingId)) {
                    res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId, trackingId, or status' });
                    return;
               }

               const validStatuses = ['pending', 'approved', 'paid', 'voided', 'adjusted'];
               if (!validStatuses.includes(status)) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
                    });
                    return;
               }

               const repository = CommissionServiceFactory.createTrackingRepository(tenantId);
               await repository.updateStatus(trackingId, status);

               res.json({
                    status: 'success',
                    statusCode: 200,
                    message: `Commission status updated to ${status}`,
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to update status',
               });
          }
     }
}
