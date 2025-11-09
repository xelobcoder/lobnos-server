"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryItemController = void 0;
const inventory_1 = require("../../models/inventory");
class InventoryItemController {
    getTenantId(req) {
        return req.body.tenantId || parseInt(req.headers['x-tenant-id']) || 1;
    }
    validateCreateInventoryItemRequest(data) {
        const errors = [];
        if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
            errors.push({
                field: 'name',
                message: 'Item name is required and must be a non-empty string',
                value: data.name
            });
        }
        if (data.name && data.name.length > 100) {
            errors.push({
                field: 'name',
                message: 'Item name must be less than 100 characters',
                value: data.name
            });
        }
        if (!data.category_id || typeof data.category_id !== 'string') {
            errors.push({
                field: 'category_id',
                message: 'Category ID is required',
                value: data.category_id
            });
        }
        if (data.sku && data.sku.length > 50) {
            errors.push({
                field: 'sku',
                message: 'SKU must be less than 50 characters',
                value: data.sku
            });
        }
        if (data.description && data.description.length > 500) {
            errors.push({
                field: 'description',
                message: 'Description must be less than 500 characters',
                value: data.description
            });
        }
        if (data.unit && !['pieces', 'boxes', 'bottles', 'packs', 'liters', 'kg', 'mg', 'ml', 'units', 'vials', 'tubes', 'plates', 'strips', 'kits'].includes(data.unit)) {
            errors.push({
                field: 'unit',
                message: 'Invalid unit specified',
                value: data.unit
            });
        }
        if (data.min_stock !== undefined && (typeof data.min_stock !== 'number' || data.min_stock < 0)) {
            errors.push({
                field: 'min_stock',
                message: 'Minimum stock must be a non-negative number',
                value: data.min_stock
            });
        }
        if (data.max_stock !== undefined && (typeof data.max_stock !== 'number' || data.max_stock < 0)) {
            errors.push({
                field: 'max_stock',
                message: 'Maximum stock must be a non-negative number',
                value: data.max_stock
            });
        }
        if (data.unit_price !== undefined && (typeof data.unit_price !== 'number' || data.unit_price < 0)) {
            errors.push({
                field: 'unit_price',
                message: 'Unit price must be a non-negative number',
                value: data.unit_price
            });
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    validateUpdateInventoryItemRequest(data) {
        const errors = [];
        if (data.name !== undefined) {
            if (typeof data.name !== 'string' || data.name.trim().length === 0) {
                errors.push({
                    field: 'name',
                    message: 'Item name must be a non-empty string',
                    value: data.name
                });
            }
            else if (data.name.length > 100) {
                errors.push({
                    field: 'name',
                    message: 'Item name must be less than 100 characters',
                    value: data.name
                });
            }
        }
        if (data.category_id !== undefined && typeof data.category_id !== 'string') {
            errors.push({
                field: 'category_id',
                message: 'Category ID must be a string',
                value: data.category_id
            });
        }
        if (data.sku !== undefined && data.sku.length > 50) {
            errors.push({
                field: 'sku',
                message: 'SKU must be less than 50 characters',
                value: data.sku
            });
        }
        if (data.description !== undefined && data.description.length > 500) {
            errors.push({
                field: 'description',
                message: 'Description must be less than 500 characters',
                value: data.description
            });
        }
        if (data.unit !== undefined && !['pieces', 'boxes', 'bottles', 'packs', 'liters', 'kg', 'mg', 'ml', 'units', 'vials', 'tubes', 'plates', 'strips', 'kits'].includes(data.unit)) {
            errors.push({
                field: 'unit',
                message: 'Invalid unit specified',
                value: data.unit
            });
        }
        if (data.min_stock !== undefined && (typeof data.min_stock !== 'number' || data.min_stock < 0)) {
            errors.push({
                field: 'min_stock',
                message: 'Minimum stock must be a non-negative number',
                value: data.min_stock
            });
        }
        if (data.max_stock !== undefined && (typeof data.max_stock !== 'number' || data.max_stock < 0)) {
            errors.push({
                field: 'max_stock',
                message: 'Maximum stock must be a non-negative number',
                value: data.max_stock
            });
        }
        if (data.unit_price !== undefined && (typeof data.unit_price !== 'number' || data.unit_price < 0)) {
            errors.push({
                field: 'unit_price',
                message: 'Unit price must be a non-negative number',
                value: data.unit_price
            });
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    async createInventoryItem(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const requestData = req.body;
            const validation = this.validateCreateInventoryItemRequest(requestData);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid inventory item data',
                        details: validation.errors
                    }
                };
                res.status(400).json(response);
                return;
            }
            const inventoryItemModel = new inventory_1.InventoryItemModel(tenantId);
            const inventoryItem = await inventoryItemModel.create(requestData);
            const response = {
                success: true,
                data: inventoryItem
            };
            res.status(201).json(response);
        }
        catch (error) {
            console.error('Error creating inventory item:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to create inventory item'
                }
            };
            res.status(500).json(response);
        }
    }
    async getInventoryItemById(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const inventoryItemModel = new inventory_1.InventoryItemModel(tenantId);
            const inventoryItem = await inventoryItemModel.findById(id);
            if (!inventoryItem) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Inventory item not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: inventoryItem
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error fetching inventory item:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch inventory item'
                }
            };
            res.status(500).json(response);
        }
    }
    async getInventoryItems(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { page = '1', count = '10', category_id, location_id, status, search } = req.query;
            const filters = {
                page: parseInt(page, 10),
                count: parseInt(count, 10),
                category_id: category_id,
                location_id: location_id,
                status: status,
                search: search
            };
            const inventoryItemModel = new inventory_1.InventoryItemModel(tenantId);
            const result = await inventoryItemModel.findMany(filters);
            const response = {
                success: true,
                data: result.items,
                pagination: {
                    page: result.page,
                    count: result.count,
                    total: result.total,
                    totalPages: result.totalPages
                }
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error fetching inventory items:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch inventory items'
                }
            };
            res.status(500).json(response);
        }
    }
    async updateInventoryItem(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const requestData = req.body;
            const validation = this.validateUpdateInventoryItemRequest(requestData);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid inventory item data',
                        details: validation.errors
                    }
                };
                res.status(400).json(response);
                return;
            }
            const inventoryItemModel = new inventory_1.InventoryItemModel(tenantId);
            const inventoryItem = await inventoryItemModel.update(id, requestData);
            if (!inventoryItem) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Inventory item not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: inventoryItem
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error updating inventory item:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to update inventory item'
                }
            };
            res.status(500).json(response);
        }
    }
    async deleteInventoryItem(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const inventoryItemModel = new inventory_1.InventoryItemModel(tenantId);
            const deleted = await inventoryItemModel.delete(id);
            if (!deleted) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Inventory item not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: { message: 'Inventory item deleted successfully' }
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error deleting inventory item:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to delete inventory item'
                }
            };
            res.status(500).json(response);
        }
    }
    async getLowStockItems(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const inventoryItemModel = new inventory_1.InventoryItemModel(tenantId);
            const lowStockItems = await inventoryItemModel.getLowStockAlerts();
            const response = {
                success: true,
                data: lowStockItems
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error fetching low stock items:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch low stock items'
                }
            };
            res.status(500).json(response);
        }
    }
    async getExpiringItems(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { days = '30' } = req.query;
            const daysAhead = parseInt(days, 10);
            const inventoryItemModel = new inventory_1.InventoryItemModel(tenantId);
            const expiringItems = await inventoryItemModel.getExpiringItems(daysAhead);
            const response = {
                success: true,
                data: expiringItems
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error fetching expiring items:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch expiring items'
                }
            };
            res.status(500).json(response);
        }
    }
    async getInventorySummary(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const inventoryItemModel = new inventory_1.InventoryItemModel(tenantId);
            const summary = await inventoryItemModel.getInventorySummary();
            const response = {
                success: true,
                data: summary
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error fetching inventory summary:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch inventory summary'
                }
            };
            res.status(500).json(response);
        }
    }
}
exports.InventoryItemController = InventoryItemController;
