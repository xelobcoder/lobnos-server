import { Request, Response } from 'express';
import { CommissionDefaultService } from '../services/CommissionDefaultService';

export class CommissionDefaultController {
     private static handleError(res: Response, error: any, fallbackMessage: string): void {
          const statusCode = error?.statusCode || 500;
          res.status(statusCode).json({
               status: 'error',
               statusCode,
               message: error?.message || fallbackMessage,
          });
     }

     static async createDefault(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               if (!tenantId || isNaN(tenantId)) {
                    res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId' });
                    return;
               }

               const { recipient_type, commission_config_id, is_active = true } = req.body;

               if (!recipient_type || !commission_config_id) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: 'Missing required fields: recipient_type, commission_config_id',
                    });
                    return;
               }

               const validTypes = ['clinician', 'organization'];
               if (!validTypes.includes(recipient_type)) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: `Invalid recipient_type. Must be one of: ${validTypes.join(', ')}`,
                    });
                    return;
               }

               const service = new CommissionDefaultService(tenantId);
               const created = await service.createDefault({
                    recipient_type,
                    commission_config_id,
                    is_active,
               });

               res.status(201).json({
                    status: 'success',
                    statusCode: 201,
                    message: 'Default commission created successfully',
                    result: created,
               });
          } catch (error: any) {
               CommissionDefaultController.handleError(res, error, 'Failed to create default commission');
          }
     }

     /**
      * Get default commission for a recipient type (global fallback)
      * GET /api/v1/commission/defaults?recipient_type={type}
      */
     static async getDefault(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const recipientType = req.query.recipient_type as string;

               if (!tenantId || !recipientType || isNaN(tenantId)) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: 'Invalid tenantId or recipient_type',
                    });
                    return;
               }

               const validTypes = ['clinician', 'organization'];
               if (!validTypes.includes(recipientType)) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: `Invalid recipient_type. Must be one of: ${validTypes.join(', ')}`,
                    });
                    return;
               }

               const service = new CommissionDefaultService(tenantId);
               const defaults = await service.getDefault(recipientType as 'clinician' | 'organization');

               if (!defaults) {
                    res.status(404).json({
                         status: 'error',
                         statusCode: 404,
                         message: `No default commission found for ${recipientType}`,
                    });
                    return;
               }

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result: defaults,
               });
          } catch (error: any) {
               CommissionDefaultController.handleError(res, error, 'Failed to retrieve default commission');
          }
     }

     /**
      * Get all commission defaults
      * GET /api/v1/commission/defaults/all
      */
     static async getAllDefaults(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);

               if (!tenantId || isNaN(tenantId)) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: 'Invalid tenantId',
                    });
                    return;
               }

               const service = new CommissionDefaultService(tenantId);
               const defaultsWithConfig = await service.getAllDefaults();

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result: defaultsWithConfig,
               });
          } catch (error: any) {
               CommissionDefaultController.handleError(res, error, 'Failed to retrieve commission defaults');
          }
     }

     /**
      * Get all commission routes/configurations for a recipient
      * GET /api/v1/commission/defaults/recipient-routes?recipient_type={type}&recipient_id={id}
      */
     static async getRecipientRoutes(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const recipientType = req.query.recipient_type as string;
               const recipientId = parseInt(req.query.recipient_id as string);

               if (!tenantId || !recipientType || !recipientId || isNaN(tenantId) || isNaN(recipientId)) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: 'Invalid tenantId, recipient_type, or recipient_id',
                    });
                    return;
               }

               const validTypes = ['clinician', 'organization'];
               if (!validTypes.includes(recipientType)) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: `Invalid recipient_type. Must be one of: ${validTypes.join(', ')}`,
                    });
                    return;
               }

               const service = new CommissionDefaultService(tenantId);
               const routes = await service.getRecipientRoutes(
                    recipientType as 'clinician' | 'organization',
                    recipientId
               );

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result: routes,
               });
          } catch (error: any) {
               CommissionDefaultController.handleError(res, error, 'Failed to retrieve recipient routes');
          }
     }

     /**
      * Update default commission
      * PUT /api/v1/commission/defaults/:id
      */
     static async updateDefault(req: Request<{ id: string }>, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const defaultId = parseInt(req.params.id);
               const { commission_config_id, is_active } = req.body;

               if (!tenantId || !defaultId || isNaN(tenantId) || isNaN(defaultId)) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: 'Invalid tenantId or defaultId',
                    });
                    return;
               }

               const updateData: any = {};
               if (commission_config_id) updateData.commission_config_id = commission_config_id;
               if (is_active !== undefined) updateData.is_active = is_active;

               const service = new CommissionDefaultService(tenantId);
               const updated = await service.updateDefault(defaultId, updateData);

               res.json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Default commission updated successfully',
                    result: updated,
               });
          } catch (error: any) {
               CommissionDefaultController.handleError(res, error, 'Failed to update default commission');
          }
     }

     /**
      * Delete (deactivate) default commission
      * DELETE /api/v1/commission/defaults/:id
      */
     static async deleteDefault(req: Request<{ id: number | string }>, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const defaultId = parseInt(req.params.id.toString());

               if (!tenantId || !defaultId || isNaN(tenantId) || isNaN(defaultId)) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: 'Invalid tenantId or defaultId',
                    });
                    return;
               }

               const service = new CommissionDefaultService(tenantId);
               await service.deactivateDefault(defaultId);

               res.json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Default commission deactivated successfully',
               });
          } catch (error: any) {
               CommissionDefaultController.handleError(res, error, 'Failed to delete default commission');
          }
     }
}
