"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionConfigController = void 0;
const commissionConfigutationRepo_1 = require("../commissionConfigutationRepo");
class CommissionConfigController {
    /**
     * Create a new commission configuration
     * POST /api/v1/commission/configs
     */
    static async createConfig(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            if (!tenantId || isNaN(tenantId)) {
                res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId' });
                return;
            }
            const { name, commission_type, percentage_rate, sliding_max_percentage, fixed_component, min_commission, max_commission, period_cap, period_cap_reset, effective_from, effective_to, is_active = true, tiers, } = req.body;
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
                commissionConfigutationRepo_1.CommissionValidator.validateConfig(config);
            }
            catch (validationError) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Invalid commission configuration',
                    errors: validationError.errors || [validationError.message],
                });
                return;
            }
            // Create the configuration
            const repository = commissionConfigutationRepo_1.CommissionServiceFactory.createConfigRepository(tenantId);
            const createdConfig = await repository.create(config);
            // Create tiers if provided for tiered commission
            if (commission_type === 'tiered' && Array.isArray(tiers) && tiers.length > 0) {
                try {
                    commissionConfigutationRepo_1.CommissionValidator.validateTiers(commission_type, tiers);
                }
                catch (validationError) {
                    res.status(400).json({
                        status: 'error',
                        statusCode: 400,
                        message: 'Invalid tier configuration',
                        errors: validationError.errors || [validationError.message],
                    });
                    return;
                }
                const tierRepository = commissionConfigutationRepo_1.CommissionServiceFactory.createTierRepository(tenantId);
                await tierRepository.createMultiple(tiers, createdConfig.id);
            }
            res.status(201).json({
                status: 'success',
                statusCode: 201,
                message: 'Commission configuration created successfully',
                result: createdConfig,
            });
        }
        catch (error) {
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
    static async getConfig(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const configId = parseInt(req.params.id.toString());
            if (!tenantId || !configId || isNaN(tenantId) || isNaN(configId)) {
                res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId or configId' });
                return;
            }
            const repository = commissionConfigutationRepo_1.CommissionServiceFactory.createConfigRepository(tenantId);
            const config = await repository.getByIdOrThrow(configId);
            // Get tiers if tiered type
            let tiers = [];
            if (config.commission_type === 'tiered') {
                const tierRepository = commissionConfigutationRepo_1.CommissionServiceFactory.createTierRepository(tenantId);
                tiers = await tierRepository.findByConfigId(configId);
            }
            res.json({
                status: 'success',
                statusCode: 200,
                result: Object.assign(Object.assign({}, config), { tiers }),
            });
        }
        catch (error) {
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
    static async getConfigs(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const onDate = req.query.onDate ? new Date(req.query.onDate) : new Date();
            if (!tenantId || isNaN(tenantId)) {
                res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId' });
                return;
            }
            const repository = commissionConfigutationRepo_1.CommissionServiceFactory.createConfigRepository(tenantId);
            const configs = await repository.findActive(onDate);
            res.json({
                status: 'success',
                statusCode: 200,
                result: configs,
            });
        }
        catch (error) {
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
    static async updateConfig(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const configId = parseInt(req.params.id.toString());
            if (!tenantId || !configId || isNaN(tenantId) || isNaN(configId)) {
                res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId or configId' });
                return;
            }
            // Soft delete the old config
            const repository = commissionConfigutationRepo_1.CommissionServiceFactory.createConfigRepository(tenantId);
            await repository.softDelete(configId);
            // Create new version with updated fields
            const { name, commission_type, percentage_rate, sliding_max_percentage, fixed_component, min_commission, max_commission, period_cap, period_cap_reset, effective_from, effective_to, is_active = true, } = req.body;
            const newConfig = {
                name,
                commission_type,
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
                commissionConfigutationRepo_1.CommissionValidator.validateConfig(newConfig);
            }
            catch (validationError) {
                res.status(400).json({
                    status: 'error',
                    statusCode: 400,
                    message: 'Invalid commission configuration',
                    errors: validationError.errors || [validationError.message],
                });
                return;
            }
            const createdConfig = await repository.create(newConfig);
            res.json({
                status: 'success',
                statusCode: 200,
                message: 'Commission configuration updated successfully',
                result: createdConfig,
            });
        }
        catch (error) {
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
    static async deleteConfig(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const configId = parseInt(req.params.id.toString());
            if (!tenantId || !configId || isNaN(tenantId) || isNaN(configId)) {
                res.status(400).json({ status: 'error', statusCode: 400, message: 'Invalid tenantId or configId' });
                return;
            }
            const repository = commissionConfigutationRepo_1.CommissionServiceFactory.createConfigRepository(tenantId);
            await repository.softDelete(configId);
            res.json({
                status: 'success',
                statusCode: 200,
                message: 'Commission configuration deactivated successfully',
            });
        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                statusCode: 500,
                message: error.message || 'Failed to delete configuration',
            });
        }
    }
}
exports.CommissionConfigController = CommissionConfigController;
