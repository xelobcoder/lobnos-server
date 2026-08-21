import { Request, Response } from 'express';
import { ICommissionConfig, CommissionValidator, CommissionServiceFactory } from '../commissionConfigutationRepo';

export class CommissionConfigController {
     /**
      * Create a new commission configuration
      * POST /api/v1/commission/configs
      */
     static async createConfig(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               if (!tenantId || isNaN(tenantId)) {
                    res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId' });
                    return;
               }

               const {
                    name,
                    commission_type,
                    quota_target,
                    volume_period,
                    percentage_rate,
                    sliding_max_percentage,
                    fixed_component,
                    min_commission,
                    max_commission,
                    period_cap,
                    period_cap_reset,
                    effective_from,
                    effective_to,
                    is_active = true,
                    tiers,
               } = req.body;

               if (!name || !commission_type) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: 'Missing required fields: name, commission_type',
                    });
                    return;
               }

               const config = {
                    name,
                    commission_type,
                    quota_target: quota_target || null,
                    volume_period: volume_period || null,
                    percentage_rate: percentage_rate || null,
                    sliding_max_percentage: sliding_max_percentage || null,
                    fixed_component: fixed_component || null,
                    min_commission: min_commission || 0,
                    max_commission: max_commission || 999999,
                    period_cap: period_cap || null,
                    period_cap_reset: period_cap_reset || null,
                    effective_from: effective_from ? new Date(effective_from) : new Date(),
                    effective_to: effective_to ? new Date(effective_to) : null,
                    is_active,
               };

               // Validate configuration
               try {
                    CommissionValidator.validateConfig(config as any);
               } catch (validationError: any) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: 'Invalid commission configuration',
                         errors: validationError.errors || [validationError.message],
                    });
                    return;
               }

               // Create the configuration
               const repository = CommissionServiceFactory.createConfigRepository(tenantId);
               const createdConfig = await repository.create(config as any);

               // Create tiers for tiered, volume, quota, or accelerating commission
               if (['tiered', 'volume', 'quota', 'accelerating'].includes(commission_type) && Array.isArray(tiers) && tiers.length > 0) {
                    try {
                         CommissionValidator.validateTiers(commission_type, tiers);
                    } catch (validationError: any) {
                         res.status(400).json({
                              status: 'error',
                              statusCode: 400,
                              message: 'Invalid tier configuration',
                              errors: validationError.errors || [validationError.message],
                         });
                         return;
                    }
                    const tierRepository = CommissionServiceFactory.createTierRepository(tenantId);
                    await tierRepository.createMultiple(tiers, createdConfig.id);
               }

               res.status(201).json({
                    status: 'success',
                    statusCode: 201,
                    message: 'Commission configuration created successfully',
                    result: createdConfig,
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to create commission configuration',
               });
          }
     }

     /**
      * Get commission configuration by ID
      * GET /api/v1/commission/configs/:id
      */
     static async getConfig(req: Request<{ id: number | string }>, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const configId = parseInt(req.params.id.toString());

               if (!tenantId || !configId || isNaN(tenantId) || isNaN(configId)) {
                    res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId or configId' });
                    return;
               }

               const repository = CommissionServiceFactory.createConfigRepository(tenantId);
               const config = await repository.getByIdOrThrow(configId);

               // Get tiers if tiered type
               let tiers = [] as any[];
               if (['tiered', 'volume', 'quota', 'accelerating'].includes(config.commission_type)) {
                    const tierRepository = CommissionServiceFactory.createTierRepository(tenantId);
                    tiers = await tierRepository.findByConfigId(configId);
               }

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result: { ...config, tiers },
               });
          } catch (error: any) {
               const statusCode = error.statusCode || 500;
               res.status(statusCode).json({
                    status: 'error',
                    statusCode,
                    message: error.message || 'Failed to retrieve configuration',
               });
          }
     }

     /**
      * Get all active commission configurations for a date
      * GET /api/v1/commission/configs
      */
     static async getConfigs(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const onDate = req.query.onDate ? new Date(req.query.onDate as string) : new Date();

               if (!tenantId || isNaN(tenantId)) {
                    res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId' });
                    return;
               }

               const repository = CommissionServiceFactory.createConfigRepository(tenantId);
               const configs = await repository.findActive(onDate);

               res.json({
                    status: 'success',
                    statusCode: 200,
                    result: configs,
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to retrieve configurations',
               });
          }
     }

     /**
      * Update commission configuration (soft delete old, create new version)
      * PUT /api/v1/commission/configs/:id
      */
     static async updateConfig(req: Request<{ id: number | string }>, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const configId = parseInt(req.params.id.toString());

               if (!tenantId || !configId || isNaN(tenantId) || isNaN(configId)) {
                    res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId or configId' });
                    return;
               }

               // Soft delete the old config
               const repository = CommissionServiceFactory.createConfigRepository(tenantId);
               await repository.softDelete(configId);

               // Create new version with updated fields
               const {
                    name,
                    commission_type,
                    percentage_rate,
                    sliding_max_percentage,
                    quota_target,
                    volume_period,
                    fixed_component,
                    min_commission,
                    max_commission,
                    period_cap,
                    period_cap_reset,
                    effective_from,
                    effective_to,
                    is_active = true,
               } = req.body;

               const newConfig = {
                    name,
                    commission_type,
                    quota_target: quota_target || null,
                    volume_period: volume_period || null,
                    percentage_rate: percentage_rate || null,
                    sliding_max_percentage: sliding_max_percentage || null,
                    fixed_component: fixed_component || null,
                    min_commission: min_commission || 0,
                    max_commission: max_commission || 999999,
                    period_cap: period_cap || null,
                    period_cap_reset: period_cap_reset || null,
                    effective_from: effective_from ? new Date(effective_from) : new Date(),
                    effective_to: effective_to ? new Date(effective_to) : null,
                    is_active,
               };

               try {
                    CommissionValidator.validateConfig(newConfig as any);
               } catch (validationError: any) {
                    res.status(400).json({
                         status: 'error',
                         statusCode: 400,
                         message: 'Invalid commission configuration',
                         errors: validationError.errors || [validationError.message],
                    });
                    return;
               }

               const createdConfig = await repository.create(newConfig as any);

               res.json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Commission configuration updated successfully',
                    result: createdConfig,
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to update configuration',
               });
          }
     }

     /**
      * Deactivate commission configuration
      * DELETE /api/v1/commission/configs/:id
      */
     static async deleteConfig(req: Request<{ id: number | string }>, res: Response): Promise<void> {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const configId = parseInt(req.params.id.toString());

               if (!tenantId || !configId || isNaN(tenantId) || isNaN(configId)) {
                    res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId or configId' });
                    return;
               }

               const repository = CommissionServiceFactory.createConfigRepository(tenantId);
               await repository.softDelete(configId);

               res.json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Commission configuration deactivated successfully',
               });
          } catch (error: any) {
               res.status(500).json({
                    status: 'error',
                    statusCode: 500,
                    message: error.message || 'Failed to delete configuration',
               });
          }
     }
}
