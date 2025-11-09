import { Request, Response } from 'express';
import { SupplierModel } from '../../models/inventory';
import {
     CreateSupplierRequest,
     UpdateSupplierRequest,
     SupplierListResponse,
     ApiResponse,
     ValidationError
} from '../../models/inventory/types';

export class SupplierController {
     private getTenantId(req: Request): number {
          return req.body.tenantId || parseInt(req.headers['x-tenant-id'] as string) || 1;
     }

     private validateCreateSupplierRequest(data: any): { isValid: boolean; errors: ValidationError[] } {
          const errors: ValidationError[] = [];

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

     private validateUpdateSupplierRequest(data: any): { isValid: boolean; errors: ValidationError[] } {
          const errors: ValidationError[] = [];

          if (data.name !== undefined) {
               if (typeof data.name !== 'string' || data.name.trim().length === 0) {
                    errors.push({
                         field: 'name',
                         message: 'Supplier name must be a non-empty string',
                         value: data.name
                    });
               } else if (data.name.length > 100) {
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

     async createSupplier(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const requestData: CreateSupplierRequest = req.body;

               const validation = this.validateCreateSupplierRequest(requestData);
               if (!validation.isValid) {
                    const response: ApiResponse = {
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

               const supplierModel = new SupplierModel(tenantId);
               const supplier = await supplierModel.create(requestData);

               const response: ApiResponse = {
                    success: true,
                    data: supplier
               };

               res.status(201).json(response);
          } catch (error: any) {
               console.error('Error creating supplier:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to create supplier'
                    }
               };

               res.status(500).json(response);
          }
     }

     async getSupplierById(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const { id } = req.params;

               const supplierModel = new SupplierModel(tenantId);
               const supplier = await supplierModel.findById(id);

               if (!supplier) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'NOT_FOUND',
                              message: 'Supplier not found'
                         }
                    };
                    res.status(404).json(response);
                    return;
               }

               const response: ApiResponse = {
                    success: true,
                    data: supplier
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error fetching supplier:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to fetch supplier'
                    }
               };

               res.status(500).json(response);
          }
     }

     async getSuppliers(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const {
                    page = '1',
                    count = '10',
                    search
               } = req.query;

               const pageNum = parseInt(page as string, 10);
               const countNum = parseInt(count as string, 10);

               const supplierModel = new SupplierModel(tenantId);
               const result: SupplierListResponse = await supplierModel.findMany(pageNum, countNum, search as string);

               const response: ApiResponse = {
                    success: true,
                    data: result.suppliers,
                    pagination: {
                         page: result.page,
                         count: result.count,
                         total: result.total,
                         totalPages: result.totalPages
                    }
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error fetching suppliers:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to fetch suppliers'
                    }
               };

               res.status(500).json(response);
          }
     }

     async updateSupplier(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const { id } = req.params;
               const requestData: UpdateSupplierRequest = req.body;

               const validation = this.validateUpdateSupplierRequest(requestData);
               if (!validation.isValid) {
                    const response: ApiResponse = {
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

               const supplierModel = new SupplierModel(tenantId);
               const supplier = await supplierModel.update(id, requestData);

               if (!supplier) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'NOT_FOUND',
                              message: 'Supplier not found'
                         }
                    };
                    res.status(404).json(response);
                    return;
               }

               const response: ApiResponse = {
                    success: true,
                    data: supplier
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error updating supplier:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to update supplier'
                    }
               };

               res.status(500).json(response);
          }
     }

     async deleteSupplier(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const { id } = req.params;

               const supplierModel = new SupplierModel(tenantId);
               const deleted = await supplierModel.delete(id);

               if (!deleted) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'NOT_FOUND',
                              message: 'Supplier not found'
                         }
                    };
                    res.status(404).json(response);
                    return;
               }

               const response: ApiResponse = {
                    success: true,
                    data: { message: 'Supplier deleted successfully' }
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error deleting supplier:', error);

               const response: ApiResponse = {
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