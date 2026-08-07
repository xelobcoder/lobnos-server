"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierController = void 0;
const inventory_1 = require("../../models/inventory");
const NotificationDispatcher_1 = require("../../models/application/notifications/services/NotificationDispatcher");
class SupplierController {
    getTenantId(req) {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId || isNaN(tenantId)) {
            throw new Error('Tenant ID is required');
        }
        return tenantId;
    }
    validateCreateSupplierRequest(data) {
        const errors = [];
        if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
            errors.push({
                field: 'name',
                message: 'Supplier name is required and must be a non-empty string',
                value: data.name
            });
        }
        if (data.name && data.name.length > 100) {
            errors.push({
                field: 'name',
                message: 'Supplier name must be less than 100 characters',
                value: data.name
            });
        }
        if (data.contact_person && data.contact_person.length > 100) {
            errors.push({
                field: 'contact_person',
                message: 'Contact person name must be less than 100 characters',
                value: data.contact_person
            });
        }
        if (data.email && (!data.email.includes('@') || data.email.length > 100)) {
            errors.push({
                field: 'email',
                message: 'Email must be valid and less than 100 characters',
                value: data.email
            });
        }
        if (data.phone && data.phone.length > 20) {
            errors.push({
                field: 'phone',
                message: 'Phone number must be less than 20 characters',
                value: data.phone
            });
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    validateUpdateSupplierRequest(data) {
        const errors = [];
        if (data.name !== undefined) {
            if (typeof data.name !== 'string' || data.name.trim().length === 0) {
                errors.push({
                    field: 'name',
                    message: 'Supplier name must be a non-empty string',
                    value: data.name
                });
            }
            else if (data.name.length > 100) {
                errors.push({
                    field: 'name',
                    message: 'Supplier name must be less than 100 characters',
                    value: data.name
                });
            }
        }
        if (data.contact_person !== undefined && data.contact_person.length > 100) {
            errors.push({
                field: 'contact_person',
                message: 'Contact person name must be less than 100 characters',
                value: data.contact_person
            });
        }
        if (data.email !== undefined && (!data.email.includes('@') || data.email.length > 100)) {
            errors.push({
                field: 'email',
                message: 'Email must be valid and less than 100 characters',
                value: data.email
            });
        }
        if (data.phone !== undefined && data.phone.length > 20) {
            errors.push({
                field: 'phone',
                message: 'Phone number must be less than 20 characters',
                value: data.phone
            });
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    async createSupplier(req, res) {
        var _a;
        try {
            const tenantId = this.getTenantId(req);
            const requestData = req.body;
            const validation = this.validateCreateSupplierRequest(requestData);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid supplier data',
                        details: validation.errors
                    }
                };
                res.status(400).json(response);
                return;
            }
            const supplierModel = new inventory_1.SupplierModel(tenantId);
            const supplier = await supplierModel.create(requestData);
            if (supplier && supplier.id) {
                const createdBy = Number(req.query.employeeid || ((_a = req.body) === null || _a === void 0 ? void 0 : _a.created_by) || 0) || undefined;
                NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantId, 'SUPPLIER_CREATED', { supplierId: supplier.id }, createdBy).catch(() => { });
            }
            const response = {
                success: true,
                data: supplier
            };
            res.status(201).json(response);
        }
        catch (error) {
            console.error('Error creating supplier:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to create supplier'
                }
            };
            res.status(500).json(response);
        }
    }
    async getSupplierById(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const id = req.params.id;
            const supplierModel = new inventory_1.SupplierModel(tenantId);
            const supplier = await supplierModel.findById(id);
            if (!supplier) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Supplier not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: supplier
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error fetching supplier:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch supplier'
                }
            };
            res.status(500).json(response);
        }
    }
    async getSuppliers(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { page = '1', count = '10', search, sortby = 'ASC' } = req.query;
            const pageNum = parseInt(page, 10);
            const countNum = parseInt(count, 10);
            const sortDirection = sortby.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            const supplierModel = new inventory_1.SupplierModel(tenantId);
            const result = await supplierModel.findMany(pageNum, countNum, search, sortDirection);
            const response = {
                success: true,
                data: result.suppliers,
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
            console.error('Error fetching suppliers:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch suppliers'
                }
            };
            res.status(500).json(response);
        }
    }
    async updateSupplier(req, res) {
        var _a;
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const requestData = req.body;
            const validation = this.validateUpdateSupplierRequest(requestData);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid supplier data',
                        details: validation.errors
                    }
                };
                res.status(400).json(response);
                return;
            }
            const supplierModel = new inventory_1.SupplierModel(tenantId);
            const supplier = await supplierModel.update(id, requestData);
            if (!supplier) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Supplier not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const updatedBy = Number(req.query.employeeid || ((_a = req.body) === null || _a === void 0 ? void 0 : _a.updated_by) || 0) || undefined;
            NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantId, 'SUPPLIER_UPDATED', { supplierId: supplier.id }, updatedBy).catch(() => { });
            const supplierStatus = String((supplier === null || supplier === void 0 ? void 0 : supplier.status) || (requestData === null || requestData === void 0 ? void 0 : requestData.status) || '').toLowerCase();
            if (supplierStatus === 'active' || supplierStatus === 'activated') {
                NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantId, 'SUPPLIER_ACTIVATED', { supplierId: supplier.id }, updatedBy).catch(() => { });
            }
            else if (supplierStatus === 'inactive' || supplierStatus === 'deactivated' || supplierStatus === 'disabled') {
                NotificationDispatcher_1.NotificationDispatcher.dispatch(tenantId, 'SUPPLIER_DEACTIVATED', { supplierId: supplier.id }, updatedBy).catch(() => { });
            }
            const response = {
                success: true,
                data: supplier
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error updating supplier:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to update supplier'
                }
            };
            res.status(500).json(response);
        }
    }
    async deleteSupplier(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const supplierModel = new inventory_1.SupplierModel(tenantId);
            const deleted = await supplierModel.delete(id);
            if (!deleted) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Supplier not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: { message: 'Supplier deleted successfully' }
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error deleting supplier:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to delete supplier'
                }
            };
            res.status(500).json(response);
        }
    }
}
exports.SupplierController = SupplierController;
