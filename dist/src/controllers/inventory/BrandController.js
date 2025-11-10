"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrandController = void 0;
const inventory_1 = require("../../models/inventory");
class BrandController {
    getTenantId(req) {
        // Extract tenant ID from request (could be from JWT token, headers, etc.)
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId || isNaN(tenantId)) {
            throw new Error('Tenant ID is required');
        }
        return tenantId;
    }
    validateCreateBrandRequest(data) {
        const errors = [];
        if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
            errors.push({
                field: 'name',
                message: 'Brand name is required and must be a non-empty string',
                value: data.name
            });
        }
        if (data.name && data.name.length > 100) {
            errors.push({
                field: 'name',
                message: 'Brand name must be less than 100 characters',
                value: data.name
            });
        }
        if (!data.inventory_item_id || typeof data.inventory_item_id !== 'string' || data.inventory_item_id.trim().length === 0) {
            errors.push({
                field: 'inventory_item_id',
                message: 'Inventory item ID is required and must be a non-empty string',
                value: data.inventory_item_id
            });
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    validateUpdateBrandRequest(data) {
        const errors = [];
        if (data.name !== undefined) {
            if (typeof data.name !== 'string' || data.name.trim().length === 0) {
                errors.push({
                    field: 'name',
                    message: 'Brand name must be a non-empty string',
                    value: data.name
                });
            }
            else if (data.name.length > 100) {
                errors.push({
                    field: 'name',
                    message: 'Brand name must be less than 100 characters',
                    value: data.name
                });
            }
        }
        if (data.inventory_item_id !== undefined) {
            if (typeof data.inventory_item_id !== 'string' || data.inventory_item_id.trim().length === 0) {
                errors.push({
                    field: 'inventory_item_id',
                    message: 'Inventory item ID must be a non-empty string',
                    value: data.inventory_item_id
                });
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    async createBrand(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const requestData = req.body;
            // Validate request
            const validation = this.validateCreateBrandRequest(requestData);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid brand data',
                        details: validation.errors
                    }
                };
                res.status(400).json(response);
                return;
            }
            const brandModel = new inventory_1.BrandModel(tenantId);
            const brand = await brandModel.create(requestData);
            const response = {
                success: true,
                data: brand
            };
            res.status(201).json(response);
        }
        catch (error) {
            console.error('Error creating brand:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to create brand'
                }
            };
            res.status(500).json(response);
        }
    }
    async getBrandById(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const brandModel = new inventory_1.BrandModel(tenantId);
            const brand = await brandModel.findById(id);
            if (!brand) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Brand not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: brand
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error fetching brand:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch brand'
                }
            };
            res.status(500).json(response);
        }
    }
    async getBrands(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { page = '1', count = '10', search, sortby = 'ASC', inventory_item_id } = req.query;
            const pageNum = parseInt(page, 10);
            const countNum = parseInt(count, 10);
            const sortDirection = sortby.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            const brandModel = new inventory_1.BrandModel(tenantId);
            const result = await brandModel.findMany(pageNum, countNum, search, sortDirection, inventory_item_id);
            const response = {
                success: true,
                data: result.brands,
                pagination: {
                    page: result.page,
                    count: result.count,
                    total: result.total,
                    totalPages: result.totalPages,
                    sortby: result.sortby
                }
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error fetching brands:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch brands'
                }
            };
            res.status(500).json(response);
        }
    }
    async updateBrand(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const requestData = req.body;
            // Validate request
            const validation = this.validateUpdateBrandRequest(requestData);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid brand data',
                        details: validation.errors
                    }
                };
                res.status(400).json(response);
                return;
            }
            const brandModel = new inventory_1.BrandModel(tenantId);
            const brand = await brandModel.update(id, requestData);
            if (!brand) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Brand not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: brand
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error updating brand:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to update brand'
                }
            };
            res.status(500).json(response);
        }
    }
    async deleteBrand(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const brandModel = new inventory_1.BrandModel(tenantId);
            const deleted = await brandModel.delete(id);
            if (!deleted) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Brand not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: { message: 'Brand deleted successfully' }
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error deleting brand:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to delete brand'
                }
            };
            res.status(500).json(response);
        }
    }
    async getBrandStats(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const brandModel = new inventory_1.BrandModel(tenantId);
            const stats = await brandModel.getStats();
            const response = {
                success: true,
                data: stats
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error fetching brand stats:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch brand statistics'
                }
            };
            res.status(500).json(response);
        }
    }
}
exports.BrandController = BrandController;
