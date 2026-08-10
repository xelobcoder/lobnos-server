import { Request, Response } from 'express';
import { InventoryItemModel } from '../../models/inventory';
import {
     CreateInventoryItemRequest,
     UpdateInventoryItemRequest,
     InventoryItemListResponse,
     ApiResponse,
     ValidationError,
     InventoryFilters
} from '../../models/inventory/types';

export class InventoryItemController {
     private getTenantId(req: Request): number {
          const tenantId = parseInt(req.query.tenantId as string);
          if (!tenantId || isNaN(tenantId)) {
               throw new Error('Tenant ID is required');
          }
          return tenantId;
     }

     private validateCreateInventoryItemRequest(data: any): { isValid: boolean; errors: ValidationError[] } {
          const errors: ValidationError[] = [];

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

          if (data.category_id && typeof data.category_id !== 'string') {
               errors.push({
                    field: 'category_id',
                    message: 'Category ID must be a string if provided',
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

          if (data.description && data.description.length > 1000) {
               errors.push({
                    field: 'description',
                    message: 'Description must be less than 1000 characters',
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

          return {
               isValid: errors.length === 0,
               errors
          };
     }

     private validateUpdateInventoryItemRequest(data: any): { isValid: boolean; errors: ValidationError[] } {
          const errors: ValidationError[] = [];

          if (data.name !== undefined) {
               if (typeof data.name !== 'string' || data.name.trim().length === 0) {
                    errors.push({
                         field: 'name',
                         message: 'Item name must be a non-empty string',
                         value: data.name
                    });
               } else if (data.name.length > 100) {
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

          return {
               isValid: errors.length === 0,
               errors
          };
     }

     async createInventoryItem(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const requestData: CreateInventoryItemRequest = req.body;

               const validation = this.validateCreateInventoryItemRequest(requestData);
               if (!validation.isValid) {
                    const response: ApiResponse = {
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

               const inventoryItemModel = new InventoryItemModel(tenantId);
               const inventoryItem = await inventoryItemModel.create(requestData);

               const response: ApiResponse = {
                    success: true,
                    data: inventoryItem
               };

               res.status(201).json(response);
          } catch (error: any) {
               console.error('Error creating inventory item:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to create inventory item'
                    }
               };

               res.status(500).json(response);
          }
     }

     async getInventoryItemById(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const { id } = req.params;

               const inventoryItemModel = new InventoryItemModel(tenantId);
               const inventoryItem = await inventoryItemModel.findById(id as any);

               if (!inventoryItem) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'NOT_FOUND',
                              message: 'Inventory item not found'
                         }
                    };
                    res.status(404).json(response);
                    return;
               }

               const response: ApiResponse = {
                    success: true,
                    data: inventoryItem
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error fetching inventory item:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to fetch inventory item'
                    }
               };

               res.status(500).json(response);
          }
     }

     async getInventoryItems(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const {
                    page ,
                    count ,
                    category_id,
                    location_id,
                    status,
                    search,
                    sortby = 'ASC'
               } = req.query;

               const filters: InventoryFilters = {
                    page: parseInt(page as string, 10),
                    count: parseInt(count as string, 10),
                    category_id: category_id as string,
                    location_id: location_id as string,
                    status: status as any,
                    search: search as string,
                    sortby: (sortby as string).toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
               };

               const inventoryItemModel = new InventoryItemModel(tenantId);
               const result: InventoryItemListResponse = await inventoryItemModel.findMany(filters);

               const response: ApiResponse = {
                    success: true,
                    data: result.items,
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
               console.error('Error fetching inventory items:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to fetch inventory items'
                    }
               };

               res.status(500).json(response);
          }
     }

     async updateInventoryItem(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const { id } = req.params;
               const requestData: UpdateInventoryItemRequest = req.body;

               const validation = this.validateUpdateInventoryItemRequest(requestData);
               if (!validation.isValid) {
                    const response: ApiResponse = {
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

               const inventoryItemModel = new InventoryItemModel(tenantId);
               const inventoryItem = await inventoryItemModel.update(id as any, requestData);

               if (!inventoryItem) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'NOT_FOUND',
                              message: 'Inventory item not found'
                         }
                    };
                    res.status(404).json(response);
                    return;
               }

               const response: ApiResponse = {
                    success: true,
                    data: inventoryItem
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error updating inventory item:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to update inventory item'
                    }
               };

               res.status(500).json(response);
          }
     }

     async deleteInventoryItem(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const { id } = req.params;

               const inventoryItemModel = new InventoryItemModel(tenantId);
               const deleted = await inventoryItemModel.delete(id as any);

               if (!deleted) {
                    const response: ApiResponse = {
                         success: false,
                         error: {
                              code: 'NOT_FOUND',
                              message: 'Inventory item not found'
                         }
                    };
                    res.status(404).json(response);
                    return;
               }

               const response: ApiResponse = {
                    success: true,
                    data: { message: 'Inventory item deleted successfully' }
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error deleting inventory item:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to delete inventory item'
                    }
               };

               res.status(500).json(response);
          }
     }

     async getLowStockItems(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);

               const inventoryItemModel = new InventoryItemModel(tenantId);
               const lowStockItems = await inventoryItemModel.findMany({ low_stock_only: true });

               const response: ApiResponse = {
                    success: true,
                    data: lowStockItems.items
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error fetching low stock items:', error);

               const response: ApiResponse = {
                    success: false,
                    error: {
                         code: 'INTERNAL_ERROR',
                         message: error.message || 'Failed to fetch low stock items'
                    }
               };

               res.status(500).json(response);
          }
     }

     async getInventorySummary(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);

               const inventoryItemModel = new InventoryItemModel(tenantId);
               const summary = await inventoryItemModel.getInventorySummary();

               const response: ApiResponse = {
                    success: true,
                    data: summary
               };

               res.json(response);
          } catch (error: any) {
               console.error('Error fetching inventory summary:', error);

               const response: ApiResponse = {
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