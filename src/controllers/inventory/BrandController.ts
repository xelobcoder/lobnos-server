import { Request, Response } from 'express';
import { BrandModel } from '../../models/inventory';
import {
     CreateBrandRequest,
     UpdateBrandRequest,
     BrandListResponse,
     ApiResponse,
     ValidationError
} from '../../models/inventory/types';

export class BrandController {
     private getTenantId(req: Request): number {
          // Extract tenant ID from request (could be from JWT token, headers, etc.)
          return req.body.tenantId || parseInt(req.headers['x-tenant-id'] as string) || 1;
     }

     private validateCreateBrandRequest(data: any): { isValid: boolean; errors: ValidationError[] } {
          const errors: ValidationError[] = [];

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

          return {
               isValid: errors.length === 0,
               errors
          };
     }

     private validateUpdateBrandRequest(data: any): { isValid: boolean; errors: ValidationError[] } {
          const errors: ValidationError[] = [];

          if (data.name !== undefined) {
               if (typeof data.name !== 'string' || data.name.trim().length === 0) {
                    errors.push({
                         field: 'name',
                         message: 'Brand name must be a non-empty string',
                         value: data.name
                    });
               } else if (data.name.length > 100) {
                    errors.push({
                         field: 'name',
                         message: 'Brand name must be less than 100 characters',
                         value: data.name
                    });
               }
          }

          return {
               isValid: errors.length === 0,
               errors
          };
     }

     async createBrand(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const requestData: CreateBrandRequest = req.body;

               // Validate request
               const validation = this.validateCreateBrandRequest(requestData);
               if (!validation.isValid) {
                    const response: ApiResponse = {
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

               const brandModel = new BrandModel(tenantId);
               const brand = await brandModel.create(requestData);

               const response: ApiResponse = {
                    success: true,
                    data: brand
               };

               res.status(201).json(response);
          } catch (error: any) {
               console.error('Error creating brand:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to create brand'
                    }
               };

               res.status(500).json(response);
          }
     }

     async getBrandById(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const { id } = req.params;

               const brandModel = new BrandModel(tenantId);
               const brand = await brandModel.findById(id);

               if (!brand) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'NOT_FOUND',
                              message: 'Brand not found'
                         }
                    };
                    res.status(404).json(response);
                    return;
               }

               const response: ApiResponse = {
                    success: true,
                    data: brand
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error fetching brand:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to fetch brand'
                    }
               };

               res.status(500).json(response);
          }
     }

     async getBrands(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const {
                    page = '1',
                    count = '10',
                    search
               } = req.query;

               const pageNum = parseInt(page as string, 10);
               const countNum = parseInt(count as string, 10);

               const brandModel = new BrandModel(tenantId);
               const result: BrandListResponse = await brandModel.findMany(pageNum, countNum, search as string);

               const response: ApiResponse = {
                    success: true,
                    data: result.brands,
                    pagination: {
                         page: result.page,
                         count: result.count,
                         total: result.total,
                         totalPages: result.totalPages
                    }
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error fetching brands:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to fetch brands'
                    }
               };

               res.status(500).json(response);
          }
     }

     async updateBrand(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const { id } = req.params;
               const requestData: UpdateBrandRequest = req.body;

               // Validate request
               const validation = this.validateUpdateBrandRequest(requestData);
               if (!validation.isValid) {
                    const response: ApiResponse = {
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

               const brandModel = new BrandModel(tenantId);
               const brand = await brandModel.update(id, requestData);

               if (!brand) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'NOT_FOUND',
                              message: 'Brand not found'
                         }
                    };
                    res.status(404).json(response);
                    return;
               }

               const response: ApiResponse = {
                    success: true,
                    data: brand
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error updating brand:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to update brand'
                    }
               };

               res.status(500).json(response);
          }
     }

     async deleteBrand(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const { id } = req.params;

               const brandModel = new BrandModel(tenantId);
               const deleted = await brandModel.delete(id);

               if (!deleted) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'NOT_FOUND',
                              message: 'Brand not found'
                         }
                    };
                    res.status(404).json(response);
                    return;
               }

               const response: ApiResponse = {
                    success: true,
                    data: { message: 'Brand deleted successfully' }
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error deleting brand:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to delete brand'
                    }
               };

               res.status(500).json(response);
          }
     }

     async getBrandStats(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);

               const brandModel = new BrandModel(tenantId);
               const stats = await brandModel.getStats();

               const response: ApiResponse = {
                    success: true,
                    data: stats
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error fetching brand stats:', error);

               const response: ApiResponse = {
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