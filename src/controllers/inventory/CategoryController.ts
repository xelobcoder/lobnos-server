import { Request, Response } from 'express';
import { CategoryModel } from '../../models/inventory';
import {
     CreateCategoryRequest,
     UpdateCategoryRequest,
     CategoryListResponse,
     ApiResponse,
     ValidationError
} from '../../models/inventory/types';

export class CategoryController {
     private getTenantId(req: Request): number {
          const tenantId = parseInt(req.query.tenantId as string);
          if (!tenantId || isNaN(tenantId)) {
               throw new Error('Tenant ID is required');
          }
          return tenantId;
     }

     private validateCreateCategoryRequest(data: any): { isValid: boolean; errors: ValidationError[] } {
          const errors: ValidationError[] = [];

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

     private validateUpdateCategoryRequest(data: any): { isValid: boolean; errors: ValidationError[] } {
          const errors: ValidationError[] = [];

          if (data.name !== undefined) {
               if (typeof data.name !== 'string' || data.name.trim().length === 0) {
                    errors.push({
                         field: 'name',
                         message: 'Category name must be a non-empty string',
                         value: data.name
                    });
               } else if (data.name.length > 100) {
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

     async createCategory(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const requestData: CreateCategoryRequest = req.body;

               const validation = this.validateCreateCategoryRequest(requestData);
               if (!validation.isValid) {
                    const response: ApiResponse = {
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

               const categoryModel = new CategoryModel(tenantId);
               const category = await categoryModel.create(requestData);

               const response: ApiResponse = {
                    success: true,
                    data: category
               };

               res.status(201).json(response);
          } catch (error: any) {
               console.error('Error creating category:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to create category'
                    }
               };

               res.status(500).json(response);
          }
     }

     async getCategoryById(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const { id } = req.params;

               const categoryModel = new CategoryModel(tenantId);
               const category = await categoryModel.findById(id as any);

               if (!category) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'NOT_FOUND',
                              message: 'Category not found'
                         }
                    };
                    res.status(404).json(response);
                    return;
               }

               const response: ApiResponse = {
                    success: true,
                    data: category
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error fetching category:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to fetch category'
                    }
               };

               res.status(500).json(response);
          }
     }

     async getCategories(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const {
                    page = '1',
                    count = '10',
                    search,
                    sortby = 'ASC'
               } = req.query;

               const pageNum = parseInt(page as string, 10);
               const countNum = parseInt(count as string, 10);
               const sortDirection = (sortby as string).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

               const categoryModel = new CategoryModel(tenantId);
               const result: CategoryListResponse = await categoryModel.findMany(pageNum, countNum, search as string, sortDirection);

               const response: ApiResponse = {
                    success: true,
                    data: result.categories,
                    pagination: {
                         page: result.page,
                         count: result.count,
                         total: result.total,
                         totalPages: result.totalPages,
                         sortby: result.sortby
                    }
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error fetching categories:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to fetch categories'
                    }
               };

               res.status(500).json(response);
          }
     }

     async updateCategory(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const { id } = req.params;
               const requestData: UpdateCategoryRequest = req.body;

               const validation = this.validateUpdateCategoryRequest(requestData);
               if (!validation.isValid) {
                    const response: ApiResponse = {
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

               const categoryModel = new CategoryModel(tenantId);
               const category = await categoryModel.update(id as any, requestData);

               if (!category) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'NOT_FOUND',
                              message: 'Category not found'
                         }
                    };
                    res.status(404).json(response);
                    return;
               }

               const response: ApiResponse = {
                    success: true,
                    data: category
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error updating category:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to update category'
                    }
               };

               res.status(500).json(response);
          }
     }

     async deleteCategory(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const { id } = req.params;

               const categoryModel = new CategoryModel(tenantId);
               const deleted = await categoryModel.delete(id as any);

               if (!deleted) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'NOT_FOUND',
                              message: 'Category not found'
                         }
                    };
                    res.status(404).json(response);
                    return;
               }

               const response: ApiResponse = {
                    success: true,
                    data: { message: 'Category deleted successfully' }
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error deleting category:', error);

               const response: ApiResponse = {
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