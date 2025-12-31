"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnitsController = void 0;
const inventory_1 = require("../../models/inventory");
const utility_1 = require("../../hooks/utility");
class UnitsController {
    getTenantId(req) {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId || isNaN(tenantId)) {
            throw new Error('Tenant ID is required');
        }
        return tenantId;
    }
    validateCreateUnitRequest(data) {
        const errors = [];
        // Note: ID validation removed - database auto-generates integer IDs
        // if (!data.id || typeof data.id !== 'string' || data.id.trim().length === 0) {
        //      errors.push({
        //           field: 'id',
        //           message: 'Unit ID is required and must be a non-empty string',
        //           value: data.id
        //      });
        // }
        // if (data.id && data.id.length > 50) {
        //      errors.push({
        //           field: 'id',
        //           message: 'Unit ID must be less than 50 characters',
        //           value: data.id
        //      });
        // }
        if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
            errors.push({
                field: 'name',
                message: 'Unit name is required and must be a non-empty string',
                value: data.name
            });
        }
        if (data.name && data.name.length > 100) {
            errors.push({
                field: 'name',
                message: 'Unit name must be less than 100 characters',
                value: data.name
            });
        }
        // Note: Category validation removed temporarily until migration is applied
        // if (!data.category || !['count', 'weight', 'volume', 'custom'].includes(data.category)) {
        //      errors.push({
        //           field: 'category',
        //           message: 'Category must be one of: count, weight, volume, custom',
        //           value: data.category
        //      });
        // }
        if (data.description && data.description.length > 1000) {
            errors.push({
                field: 'description',
                message: 'Description must be less than 1000 characters',
                value: data.description
            });
        }
        return { isValid: errors.length === 0, errors };
    }
    async getAvailableUnits(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const inventoryModel = new inventory_1.InventoryItemModel(tenantId);
            // Parse pagination and sorting parameters
            const page = parseInt(req.query.page) || 1;
            const count = parseInt(req.query.count) || 10;
            const sortBy = req.query.sortby || "ASC";
            // Validate parameters
            if (page < 1) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Page must be greater than 0'
                    }
                };
                res.status(400).json(response);
                return;
            }
            if (count < 1 || count > 10000) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Count must be between 1 and 10000'
                    }
                };
                res.status(400).json(response);
                return;
            }
            const result = await inventoryModel.getAvailableUnits(page, count, sortBy);
            const response = {
                success: true,
                data: {
                    units: result.units,
                    pagination: {
                        page: page,
                        count: count,
                        total: result.total,
                        totalPages: Math.ceil(result.total / count)
                    }
                }
            };
            res.status(200).json(response);
        }
        catch (error) {
            utility_1.PrimeSqlErrorHandler.handleError(error, res);
        }
    }
    async createCustomUnit(req, res) {
        var _a;
        try {
            const tenantId = this.getTenantId(req);
            const inventoryModel = new inventory_1.InventoryItemModel(tenantId);
            const validation = this.validateCreateUnitRequest(req.body);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid unit data',
                        details: validation.errors
                    }
                };
                res.status(400).json(response);
                return;
            }
            const unitData = {
                name: req.body.name.trim(),
                description: (_a = req.body.description) === null || _a === void 0 ? void 0 : _a.trim()
                // Note: id and category removed - database auto-generates ID, category not in current schema
                // id: req.body.id.trim(),
                // category: req.body.category
            };
            const newUnit = await inventoryModel.createCustomUnit(unitData);
            const response = {
                success: true,
                data: newUnit,
                message: 'Custom unit created successfully'
            };
            res.status(201).json(response);
        }
        catch (error) {
            if (error.message === 'Unit ID already exists') {
                const response = {
                    success: false,
                    error: {
                        code: 'DUPLICATE_ERROR',
                        message: 'Unit ID already exists'
                    }
                };
                res.status(409).json(response);
            }
            else {
                utility_1.PrimeSqlErrorHandler.handleError(error, res);
            }
        }
    }
    async validateUnit(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { unitId } = req.params;
            if (!unitId || typeof unitId !== 'string') {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Unit ID is required'
                    }
                };
                res.status(400).json(response);
                return;
            }
            const inventoryModel = new inventory_1.InventoryItemModel(tenantId);
            const result = await inventoryModel.getAvailableUnits(1, 1000); // Get all units for existence check
            const units = result.units;
            const unitExists = units.some(unit => unit.id === unitId);
            const response = {
                success: true,
                data: {
                    exists: unitExists,
                    unit: unitExists ? units.find(unit => unit.id === unitId) : undefined
                }
            };
            res.status(200).json(response);
        }
        catch (error) {
            utility_1.PrimeSqlErrorHandler.handleError(error, res);
        }
    }
}
exports.UnitsController = UnitsController;
