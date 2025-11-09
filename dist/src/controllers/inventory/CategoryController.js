"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryController = void 0;
const inventory_1 = require("../../models/inventory");
class CategoryController {
    getTenantId(req) {
        return req.body.tenantId || parseInt(req.headers['x-tenant-id']) || 1;
    }
    validateCreateCategoryRequest(data) {
        const errors = [];
        if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
            errors.push({
                field: 'name',
                message: 'Category name is required and must be a non-empty string',
                value: data.name
            });
        }
        if (data.name && data.name.length > 100) {
            errors.push({
                field: 'name',
                message: 'Category name must be less than 100 characters',
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
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    validateUpdateCategoryRequest(data) {
        const errors = [];
        if (data.name !== undefined) {
            if (typeof data.name !== 'string' || data.name.trim().length === 0) {
                errors.push({
                    field: 'name',
                    message: 'Category name must be a non-empty string',
                    value: data.name
                });
            }
            else if (data.name.length > 100) {
                errors.push({
                    field: 'name',
                    message: 'Category name must be less than 100 characters',
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
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    async createCategory(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const requestData = req.body;
            const validation = this.validateCreateCategoryRequest(requestData);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid category data',
                        details: validation.errors
                    }
                };
                res.status(400).json(response);
                return;
            }
            const categoryModel = new inventory_1.CategoryModel(tenantId);
            const category = await categoryModel.create(requestData);
            const response = {
                success: true,
                data: category
            };
            res.status(201).json(response);
        }
        catch (error) {
            console.error('Error creating category:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to create category'
                }
            };
            res.status(500).json(response);
        }
    }
    async getCategoryById(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const categoryModel = new inventory_1.CategoryModel(tenantId);
            const category = await categoryModel.findById(id);
            if (!category) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Category not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: category
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error fetching category:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch category'
                }
            };
            res.status(500).json(response);
        }
    }
    async getCategories(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { page = '1', count = '10', search } = req.query;
            const pageNum = parseInt(page, 10);
            const countNum = parseInt(count, 10);
            const categoryModel = new inventory_1.CategoryModel(tenantId);
            const result = await categoryModel.findMany(pageNum, countNum, search);
            const response = {
                success: true,
                data: result.categories,
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
            console.error('Error fetching categories:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to fetch categories'
                }
            };
            res.status(500).json(response);
        }
    }
    async updateCategory(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const requestData = req.body;
            const validation = this.validateUpdateCategoryRequest(requestData);
            if (!validation.isValid) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid category data',
                        details: validation.errors
                    }
                };
                res.status(400).json(response);
                return;
            }
            const categoryModel = new inventory_1.CategoryModel(tenantId);
            const category = await categoryModel.update(id, requestData);
            if (!category) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Category not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: category
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error updating category:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to update category'
                }
            };
            res.status(500).json(response);
        }
    }
    async deleteCategory(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const { id } = req.params;
            const categoryModel = new inventory_1.CategoryModel(tenantId);
            const deleted = await categoryModel.delete(id);
            if (!deleted) {
                const response = {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Category not found'
                    }
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: { message: 'Category deleted successfully' }
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error deleting category:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to delete category'
                }
            };
            res.status(500).json(response);
        }
    }
}
exports.CategoryController = CategoryController;
