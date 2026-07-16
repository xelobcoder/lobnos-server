import { Request, Response } from 'express';
import KnexConnection from '../../../../database/KnexConnections';

export class CommissionDefaultController {
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

               const connection = await KnexConnection(tenantId);

               // Check if config exists
               const config = await connection('commission_configs').where({ id: commission_config_id }).first();
               if (!config) {
                    res.status(404).json({
                         status: 'error',
                         statusCode: 404,
                         message: `Commission configuration with ID ${commission_config_id} not found`,
                    });
                    return;
               }

               // Check if default already exists for this recipient type
               const existing = await connection('commission_default')
                    .where({ recipient_type, is_active: true })
                    .first();

               if (existing) {
                    res.status(409).json({
                         status: 'error',
                         statusCode: 409,
                         message: `Default commission for ${recipient_type} already exists. Only one default per recipient type is allowed.`,
                    });
                    return;
               }

               // Insert default
               const [id] = await connection('commission_default').insert({
                    recipient_type,
                    commission_config_id,
                    is_active,
                    created_at: new Date(),
               });

               const created = await connection('commission_default').where({ id }).first();

               res.status(201).json({
                    status: 'success',
                    statusCode: 201,
                    message: 'Default commission created successfully',
                    result: created,
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to create default commission',
               });
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

               const connection = await KnexConnection(tenantId);
               const defaults = await connection('commission_default')
                    .where({ recipient_type: recipientType, is_active: true })
                    .first();

               if (!defaults) {
                    res.status(404).json({
                         status: 'error',
                         statusCode: 404,
                         message: `No default commission found for ${recipientType}`,
                    });
                    return;
               }
               const config = await connection('commission_configs')
                    .where({ id: defaults.commission_config_id })
                    .first();

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result: {
                         ...defaults,
                         config: config
                    },
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to retrieve default commission',
               });
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

               const connection = await KnexConnection(tenantId);
               const defaults = await connection('commission_default')
                    .where({ is_active: true })
                    .select('*');

               // Get config details for each default
               const defaultsWithConfig = await Promise.all(
                    defaults.map(async (def: any) => {
                         const config = await connection('commission_configs')
                              .where({ id: def.commission_config_id })
                              .first();
                         return {
                              ...def,
                              config: config
                         };
                    })
               );

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result: defaultsWithConfig,
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to retrieve commission defaults',
               });
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

               const connection = await KnexConnection(tenantId);

               // Get specific assignments for this recipient
               const assignments = await connection('commission_assignments')
                    .where('scope_type', recipientType)
                    .where('scope_id', recipientId)
                    .orderBy('priority', 'desc')
                    .orderBy('assigned_from', 'desc');

               // Get assignments with config details
               const assignmentsWithConfig = await Promise.all(
                    assignments.map(async (assignment: any) => {
                         const config = await connection('commission_configs')
                              .where({ id: assignment.commission_config_id })
                              .first();
                         return {
                              type: 'assignment',
                              assignment: assignment,
                              config: config
                         };
                    })
               );

               // Get default for this recipient type
               const defaultConfig = await connection('commission_default')
                    .where({ recipient_type: recipientType, is_active: true })
                    .first();

               let defaultWithConfig = null;
               if (defaultConfig) {
                    const config = await connection('commission_configs')
                         .where({ id: defaultConfig.commission_config_id })
                         .first();
                    defaultWithConfig = {
                         type: 'default',
                         default: defaultConfig,
                         config: config
                    };
               }

               // Combine results
               const routes = [
                    ...assignmentsWithConfig,
                    ...(defaultWithConfig ? [defaultWithConfig] : [])
               ];

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result: {
                         recipient_type: recipientType,
                         recipient_id: recipientId,
                         routes: routes,
                         total_routes: routes.length
                    },
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to retrieve recipient routes',
               });
          }
     }

     /**
      * Update default commission
      * PUT /api/v1/commission/defaults/:id
      */
     static async updateDefault(req: Request<{id: string}>, res: Response): Promise<void> {
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

               const connection = await KnexConnection(tenantId);

               if (commission_config_id) {
                    // Verify config exists
                    const config = await connection('commission_configs').where({ id: commission_config_id }).first();
                    if (!config) {
                         res.status(404).json({
                              status: 'error',
                              statusCode: 404,
                              message: `Commission configuration with ID ${commission_config_id} not found`,
                         });
                         return;
                    }
               }

               const updateData: any = {};
               if (commission_config_id) updateData.commission_config_id = commission_config_id;
               if (is_active !== undefined) updateData.is_active = is_active;

               await connection('commission_default').where({ id: defaultId }).update(updateData);

               const updated = await connection('commission_default').where({ id: defaultId }).first();

               res.json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Default commission updated successfully',
                    result: updated,
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to update default commission',
               });
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

               const connection = await KnexConnection(tenantId);
               await connection('commission_default').where({ id: defaultId }).update({ is_active: false });

               res.json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Default commission deactivated successfully',
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to delete default commission',
               });
          }
     }
}
