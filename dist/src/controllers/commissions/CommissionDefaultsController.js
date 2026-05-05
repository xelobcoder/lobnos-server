"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionDefaultsController = void 0;
const CommissionDefaultsRepository_1 = require("../../models/commissions/CommissionDefaultsRepository");
const helper_1 = require("../../hooks/helper");
class CommissionDefaultsController {
    /**
     * Get all commission defaults
     */
    static validateRequestBody(body) {
        if (!Array.isArray(body)) {
            return { valid: false, message: 'Invalid request body. Expected an array of commission defaults.' };
        }
        for (const item of body) {
            const { target_type, commission_type, commission_value } = item;
            if (!target_type || !commission_type || commission_value === undefined) {
                return { valid: false, message: 'Missing required fields: target_type, commission_type, and commission_value are required for each item.' };
            }
            if (commission_type && !['PERCENTAGE', 'FIXED'].includes(commission_type.toUpperCase())) {
                return { valid: false, message: 'Invalid commission_type. Must be PERCENTAGE or FIXED' };
            }
            if (commission_value !== undefined && (isNaN(commission_value) || parseInt(commission_value) < 0)) {
                return { valid: false, message: 'Commission value must be a non-negative number' };
            }
        }
        return { valid: true };
    }
    static async getAll(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const repository = new CommissionDefaultsRepository_1.CommissionDefaultsRepository(tenantId);
            const defaults = await repository.getAll();
            res.status(200).json({
                statusCode: 200,
                status: 'success',
                result: defaults,
            });
        }
        catch (error) {
            (0, helper_1.customError)((error === null || error === void 0 ? void 0 : error.message) || 'Error fetching commission defaults', 500, res);
        }
    }
    /**
     * Create commission defaults
     */
    static async create(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const body = req.body;
            const validation = CommissionDefaultsController.validateRequestBody(body);
            if (!validation.valid) {
                return (0, helper_1.customError)(validation.message || 'Invalid request body', 400, res);
            }
            const repository = new CommissionDefaultsRepository_1.CommissionDefaultsRepository(tenantId);
            for (const item of body) {
                const { target_type, commission_type, commission_value } = item;
                await repository.create({
                    target_type,
                    commission_type,
                    commission_value,
                });
            }
            res.status(201).json({
                statusCode: 201,
                status: 'success',
                message: 'Commission defaults created successfully',
            });
        }
        catch (error) {
            (0, helper_1.customError)((error === null || error === void 0 ? void 0 : error.message) || 'Error creating commission defaults', 500, res);
        }
    }
    /**
     * Update commission defaults by ID
     */
    static async updateById(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                return (0, helper_1.customError)('Invalid commission defaults ID', 400, res);
            }
            // Validate commission type if provided
            if (req.body.commission_type && !['PERCENTAGE', 'FIXED'].includes(req.body.commission_type)) {
                return (0, helper_1.customError)('Invalid commission_type. Must be PERCENTAGE or FIXED', 400, res);
            }
            // Validate commission value if provided
            if (req.body.commission_value !== undefined && (typeof req.body.commission_value !== 'number' || req.body.commission_value < 0)) {
                return (0, helper_1.customError)('Commission value must be a non-negative number', 400, res);
            }
            const repository = new CommissionDefaultsRepository_1.CommissionDefaultsRepository(tenantId);
            const updated = await repository.updateById(id, req.body);
            if (!updated) {
                return (0, helper_1.customError)('Commission defaults not found', 404, res);
            }
            res.status(200).json({
                statusCode: 200,
                status: 'success',
                message: 'Commission defaults updated successfully',
            });
        }
        catch (error) {
            (0, helper_1.customError)((error === null || error === void 0 ? void 0 : error.message) || 'Error updating commission defaults', 500, res);
        }
    }
}
exports.CommissionDefaultsController = CommissionDefaultsController;
