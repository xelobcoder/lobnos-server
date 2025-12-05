"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryTemplateController = void 0;
const inventory_1 = require("../../models/inventory");
class InventoryTemplateController {
    getTenantId(req) {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId || isNaN(tenantId)) {
            throw new Error('Tenant ID is required');
        }
        return tenantId;
    }
    getUserId(req) {
        const userId = parseInt(req.query.employeeid);
        if (!userId || isNaN(userId)) {
            throw new Error('User ID is required');
        }
        return userId;
    }
    validateCreateInventoryTemplateRequest(data) {
        const errors = [];
        if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
            errors.push({
                field: 'name',
                message: 'Template name is required and must be a non-empty string',
                value: data.name
            });
        }
        if (data.name && data.name.length > 255) {
            errors.push({
                field: 'name',
                message: 'Template name must be less than 255 characters',
                value: data.name
            });
        }
        if (!data.testId || typeof data.testId !== 'string' || data.testId.trim().length === 0) {
            errors.push({
                field: 'testId',
                message: 'Test ID is required and must be a non-empty string',
                value: data.testId
            });
        }
        if (data.description && data.description.length > 1000) {
            errors.push({
                field: 'description',
                message: 'Description must be less than 1000 characters',
                value: data.description
            });
        }
        if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
            errors.push({
                field: 'items',
                message: 'At least one item is required',
                value: data.items
            });
        }
        else {
            data.items.forEach((item, index) => {
                if (!item.itemId || typeof item.itemId !== 'string') {
                    errors.push({
                        field: `items[${index}].itemId`,
                        message: 'Item ID is required and must be a string',
                        value: item.itemId
                    });
                }
                if (item.quantity === undefined || typeof item.quantity !== 'number' || item.quantity <= 0) {
                    errors.push({
                        field: `items[${index}].quantity`,
                        message: 'Quantity must be a positive number',
                        value: item.quantity
                    });
                }
            });
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    validateUpdateInventoryTemplateRequest(data) {
        const errors = [];
        if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim().length === 0)) {
            errors.push({
                field: 'name',
                message: 'Template name must be a non-empty string',
                value: data.name
            });
        }
        if (data.name && data.name.length > 255) {
            errors.push({
                field: 'name',
                message: 'Template name must be less than 255 characters',
                value: data.name
            });
        }
        if (data.testId !== undefined && (typeof data.testId !== 'string' || data.testId.trim().length === 0)) {
            errors.push({
                field: 'testId',
                message: 'Test ID must be a non-empty string',
                value: data.testId
            });
        }
        if (data.description !== undefined && data.description.length > 1000) {
            errors.push({
                field: 'description',
                message: 'Description must be less than 1000 characters',
                value: data.description
            });
        }
        if (data.items !== undefined) {
            if (!Array.isArray(data.items)) {
                errors.push({
                    field: 'items',
                    message: 'Items must be an array',
                    value: data.items
                });
            }
            else {
                data.items.forEach((item, index) => {
                    if (item.itemId !== undefined && typeof item.itemId !== 'string') {
                        errors.push({
                            field: `items[${index}].itemId`,
                            message: 'Item ID must be a string',
                            value: item.itemId
                        });
                    }
                    if (item.quantity !== undefined && (typeof item.quantity !== 'number' || item.quantity <= 0)) {
                        errors.push({
                            field: `items[${index}].quantity`,
                            message: 'Quantity must be a positive number',
                            value: item.quantity
                        });
                    }
                });
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    async createInventoryTemplate(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const requestData = req.body;
            const validation = this.validateCreateInventoryTemplateRequest(requestData);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid inventory template data',
                        details: validation.errors
                    }
                };
                res.status(400).json(response);
                return;
            }
            const inventoryTemplateModel = new inventory_1.InventoryTemplateModel(tenantId);
            const inventoryTemplate = await inventoryTemplateModel.create(requestData, requestData.employeeid);
            const response = {
                success: true,
                data: inventoryTemplate
            };
            res.status(201).json(response);
        }
        catch (error) {
            console.error('Error creating inventory template:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to create inventory template'
                }
            };
            res.status(500).json(response);
        }
    }
    async getInventoryTemplateById(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const templateId = parseInt(id);
            if (isNaN(templateId)) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid template ID'
                    }
                };
                res.status(400).json(response);
                return;
            }
            const inventoryTemplateModel = new inventory_1.InventoryTemplateModel(tenantId);
            const inventoryTemplate = await inventoryTemplateModel.findById(templateId);
            if (!inventoryTemplate) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Inventory template not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: inventoryTemplate
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error fetching inventory template:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch inventory template'
                }
            };
            res.status(500).json(response);
        }
    }
    async getInventoryTemplateByTestId(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { testId } = req.params;
            const { includeItems, ascensionid } = req.query;
            if (isNaN(parseInt(ascensionid)) || parseInt(ascensionid) <= 0) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid ascension ID'
                    }
                };
                res.status(400).json(response);
                return;
            }
            const inventoryTemplateModel = new inventory_1.InventoryTemplateModel(tenantId);
            const inventoryTemplate = await inventoryTemplateModel.findByTestId(testId, includeItems === 'true', parseInt(ascensionid));
            if (!inventoryTemplate) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Inventory template not found for this test'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: inventoryTemplate
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error fetching inventory template by test ID:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch inventory template'
                }
            };
            res.status(500).json(response);
        }
    }
    async getInventoryTemplates(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { page = '1', count = '10', testId, search, createby, sortby = 'DESC' } = req.query;
            const filters = {
                page: parseInt(page, 10),
                count: parseInt(count, 10),
                testId: testId,
                search: search,
                createby: createby ? parseInt(createby) : undefined,
                sortby: sortby.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
            };
            const inventoryTemplateModel = new inventory_1.InventoryTemplateModel(tenantId);
            const result = await inventoryTemplateModel.findMany(filters);
            const response = {
                success: true,
                data: result.templates,
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
            console.error('Error fetching inventory templates:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch inventory templates'
                }
            };
            res.status(500).json(response);
        }
    }
    async updateInventoryTemplate(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const templateId = parseInt(id);
            const requestData = req.body;
            if (isNaN(templateId)) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid template ID'
                    }
                };
                res.status(400).json(response);
                return;
            }
            const validation = this.validateUpdateInventoryTemplateRequest(requestData);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid inventory template data',
                        details: validation.errors
                    }
                };
                res.status(400).json(response);
                return;
            }
            const inventoryTemplateModel = new inventory_1.InventoryTemplateModel(tenantId);
            const inventoryTemplate = await inventoryTemplateModel.update(templateId, requestData);
            if (!inventoryTemplate) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Inventory template not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: inventoryTemplate
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error updating inventory template:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to update inventory template'
                }
            };
            res.status(500).json(response);
        }
    }
    async deleteInventoryTemplate(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const templateId = parseInt(id);
            if (isNaN(templateId)) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid template ID'
                    }
                };
                res.status(400).json(response);
                return;
            }
            const inventoryTemplateModel = new inventory_1.InventoryTemplateModel(tenantId);
            const deleted = await inventoryTemplateModel.delete(templateId);
            if (!deleted) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Inventory template not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: { message: 'Inventory template deleted successfully' }
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error deleting inventory template:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to delete inventory template'
                }
            };
            res.status(500).json(response);
        }
    }
    async getTemplateItems(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const templateId = parseInt(id);
            if (isNaN(templateId)) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid template ID'
                    }
                };
                res.status(400).json(response);
                return;
            }
            const inventoryTemplateModel = new inventory_1.InventoryTemplateModel(tenantId);
            const templateItems = await inventoryTemplateModel.getTemplateItems(templateId);
            const response = {
                success: true,
                data: templateItems
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error fetching template items:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch template items'
                }
            };
            res.status(500).json(response);
        }
    }
    async addTemplateItem(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const templateId = parseInt(id);
            const itemData = req.body;
            if (isNaN(templateId)) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid template ID'
                    }
                };
                res.status(400).json(response);
                return;
            }
            if (!itemData.itemId || typeof itemData.itemId !== 'string') {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Item ID is required'
                    }
                };
                res.status(400).json(response);
                return;
            }
            if (!itemData.quantity || typeof itemData.quantity !== 'number' || itemData.quantity <= 0) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Valid quantity is required'
                    }
                };
                res.status(400).json(response);
                return;
            }
            const inventoryTemplateModel = new inventory_1.InventoryTemplateModel(tenantId);
            const templateItem = await inventoryTemplateModel.addTemplateItem(templateId, itemData);
            const response = {
                success: true,
                data: templateItem
            };
            res.status(201).json(response);
        }
        catch (error) {
            console.error('Error adding template item:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to add template item'
                }
            };
            res.status(500).json(response);
        }
    }
    async updateTemplateItem(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id, itemId } = req.params;
            const templateId = parseInt(id);
            const itemIdNum = parseInt(itemId);
            const updateData = req.body;
            if (isNaN(templateId) || isNaN(itemIdNum)) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid template ID or item ID'
                    }
                };
                res.status(400).json(response);
                return;
            }
            const inventoryTemplateModel = new inventory_1.InventoryTemplateModel(tenantId);
            const templateItem = await inventoryTemplateModel.updateTemplateItem(templateId, itemIdNum, updateData);
            if (!templateItem) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Template item not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: templateItem
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error updating template item:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to update template item'
                }
            };
            res.status(500).json(response);
        }
    }
    async removeTemplateItem(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id, itemId } = req.params;
            const templateId = parseInt(id);
            const itemIdNum = parseInt(itemId);
            if (isNaN(templateId) || isNaN(itemIdNum)) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid template ID or item ID'
                    }
                };
                res.status(400).json(response);
                return;
            }
            const inventoryTemplateModel = new inventory_1.InventoryTemplateModel(tenantId);
            const removed = await inventoryTemplateModel.removeTemplateItem(templateId, itemIdNum);
            if (!removed) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Template item not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: { message: 'Template item removed successfully' }
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error removing template item:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to remove template item'
                }
            };
            res.status(500).json(response);
        }
    }
    async getTemplatesByTestIds(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { testIds } = req.body;
            if (!testIds || !Array.isArray(testIds) || testIds.length === 0) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Test IDs array is required'
                    }
                };
                res.status(400).json(response);
                return;
            }
            const inventoryTemplateModel = new inventory_1.InventoryTemplateModel(tenantId);
            const templates = await inventoryTemplateModel.getTemplatesByTestIds(testIds);
            const response = {
                success: true,
                data: templates
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error fetching templates by test IDs:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch templates'
                }
            };
            res.status(500).json(response);
        }
    }
}
exports.InventoryTemplateController = InventoryTemplateController;
