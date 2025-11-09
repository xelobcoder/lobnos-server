"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageLocationController = void 0;
const inventory_1 = require("../../models/inventory");
class StorageLocationController {
    getTenantId(req) {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId || isNaN(tenantId)) {
            throw new Error('Tenant ID is required');
        }
        return tenantId;
    }
    validateCreateStorageLocationRequest(data) {
        const errors = [];
        if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
            errors.push({
                field: 'name',
                message: 'Storage location name is required and must be a non-empty string',
                value: data.name
            });
        }
        if (data.name && data.name.length > 100) {
            errors.push({
                field: 'name',
                message: 'Storage location name must be less than 100 characters',
                value: data.name
            });
        }
        if (data.description && data.description.length > 500) {
            errors.push({
                field: 'description',
                message: 'Description must be less than 500 characters',
                value: data.description
            });
        }
        if (data.capacity !== undefined && (typeof data.capacity !== 'number' || data.capacity < 0)) {
            errors.push({
                field: 'capacity',
                message: 'Capacity must be a non-negative number',
                value: data.capacity
            });
        }
        if (data.temperature_range !== undefined && typeof data.temperature_range !== 'string') {
            errors.push({
                field: 'temperature_range',
                message: 'Temperature range must be a string',
                value: data.temperature_range
            });
        }
        if (data.temperature_range && data.temperature_range.length > 100) {
            errors.push({
                field: 'temperature_range',
                message: 'Temperature range must be less than 100 characters',
                value: data.temperature_range
            });
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    validateUpdateStorageLocationRequest(data) {
        const errors = [];
        if (data.name !== undefined) {
            if (typeof data.name !== 'string' || data.name.trim().length === 0) {
                errors.push({
                    field: 'name',
                    message: 'Storage location name must be a non-empty string',
                    value: data.name
                });
            }
            else if (data.name.length > 100) {
                errors.push({
                    field: 'name',
                    message: 'Storage location name must be less than 100 characters',
                    value: data.name
                });
            }
        }
        if (data.description !== undefined && data.description.length > 500) {
            errors.push({
                field: 'description',
                message: 'Description must be less than 500 characters',
                value: data.description
            });
        }
        if (data.capacity !== undefined && (typeof data.capacity !== 'number' || data.capacity < 0)) {
            errors.push({
                field: 'capacity',
                message: 'Capacity must be a non-negative number',
                value: data.capacity
            });
        }
        if (data.temperature_range !== undefined && typeof data.temperature_range !== 'string') {
            errors.push({
                field: 'temperature_range',
                message: 'Temperature range must be a string',
                value: data.temperature_range
            });
        }
        if (data.temperature_range !== undefined && data.temperature_range.length > 100) {
            errors.push({
                field: 'temperature_range',
                message: 'Temperature range must be less than 100 characters',
                value: data.temperature_range
            });
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    async createStorageLocation(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const requestData = req.body;
            const validation = this.validateCreateStorageLocationRequest(requestData);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid storage location data',
                        details: validation.errors
                    }
                };
                res.status(400).json(response);
                return;
            }
            const storageLocationModel = new inventory_1.StorageLocationModel(tenantId);
            const storageLocation = await storageLocationModel.create(requestData);
            const response = {
                success: true,
                data: storageLocation
            };
            res.status(201).json(response);
        }
        catch (error) {
            console.error('Error creating storage location:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to create storage location'
                }
            };
            res.status(500).json(response);
        }
    }
    async getStorageLocationById(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const storageLocationModel = new inventory_1.StorageLocationModel(tenantId);
            const storageLocation = await storageLocationModel.findById(id);
            if (!storageLocation) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Storage location not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: storageLocation
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error fetching storage location:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch storage location'
                }
            };
            res.status(500).json(response);
        }
    }
    async getStorageLocations(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { page = '1', count = '10', search, sortby = 'ASC' } = req.query;
            const pageNum = parseInt(page, 10);
            const countNum = parseInt(count, 10);
            const sortDirection = sortby.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            const storageLocationModel = new inventory_1.StorageLocationModel(tenantId);
            const result = await storageLocationModel.findMany(pageNum, countNum, search, sortDirection);
            const response = {
                success: true,
                data: result.locations,
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
            console.error('Error fetching storage locations:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch storage locations'
                }
            };
            res.status(500).json(response);
        }
    }
    async updateStorageLocation(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const requestData = req.body;
            const validation = this.validateUpdateStorageLocationRequest(requestData);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid storage location data',
                        details: validation.errors
                    }
                };
                res.status(400).json(response);
                return;
            }
            const storageLocationModel = new inventory_1.StorageLocationModel(tenantId);
            const storageLocation = await storageLocationModel.update(id, requestData);
            if (!storageLocation) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Storage location not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: storageLocation
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error updating storage location:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to update storage location'
                }
            };
            res.status(500).json(response);
        }
    }
    async deleteStorageLocation(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const storageLocationModel = new inventory_1.StorageLocationModel(tenantId);
            const deleted = await storageLocationModel.delete(id);
            if (!deleted) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Storage location not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: { message: 'Storage location deleted successfully' }
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error deleting storage location:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to delete storage location'
                }
            };
            res.status(500).json(response);
        }
    }
}
exports.StorageLocationController = StorageLocationController;
