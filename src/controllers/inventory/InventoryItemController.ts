import { Request, Response } from 'express';
import { InventoryItemModel } from '../../models/inventory';
import {
     CreateInventoryItemRequest,
     UpdateInventoryItemRequest,
     InventoryItemListResponse,
     ApiResponse,
     ValidationError,
     InventoryFilters,
     StockUpInventoryItemRequest
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

          if (data.inventory_domain && !['lab', 'pharmacy'].includes(data.inventory_domain)) {
               errors.push({ field: 'inventory_domain', message: 'Inventory domain must be lab or pharmacy', value: data.inventory_domain });
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
          if (data.sale_price !== undefined && (typeof data.sale_price !== 'number' || data.sale_price < 0)) {
               errors.push({ field: 'sale_price', message: 'Sale price must be a non-negative number', value: data.sale_price });
          }
          if (data.cost_price !== undefined && (typeof data.cost_price !== 'number' || data.cost_price < 0)) {
               errors.push({ field: 'cost_price', message: 'Cost price must be a non-negative number', value: data.cost_price });
          }
          if (data.wholesale_price !== undefined && (typeof data.wholesale_price !== 'number' || data.wholesale_price < 0)) {
               errors.push({ field: 'wholesale_price', message: 'Wholesale price must be a non-negative number', value: data.wholesale_price });
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

          if (data.inventory_domain !== undefined && !['lab', 'pharmacy'].includes(data.inventory_domain)) {
               errors.push({ field: 'inventory_domain', message: 'Inventory domain must be lab or pharmacy', value: data.inventory_domain });
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
          if (data.sale_price !== undefined && (typeof data.sale_price !== 'number' || data.sale_price < 0)) {
               errors.push({ field: 'sale_price', message: 'Sale price must be a non-negative number', value: data.sale_price });
          }
          if (data.cost_price !== undefined && (typeof data.cost_price !== 'number' || data.cost_price < 0)) {
               errors.push({ field: 'cost_price', message: 'Cost price must be a non-negative number', value: data.cost_price });
          }
          if (data.wholesale_price !== undefined && (typeof data.wholesale_price !== 'number' || data.wholesale_price < 0)) {
               errors.push({ field: 'wholesale_price', message: 'Wholesale price must be a non-negative number', value: data.wholesale_price });
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

     async stockUpInventoryItem(req: Request, res: Response): Promise<void> {
          try {
               const tenantId = this.getTenantId(req);
               const requestData: StockUpInventoryItemRequest = req.body;
               const quantity = Number(requestData.quantity);
               const packSize = Number(requestData.units_per_purchase_unit || 1);
               const unitPrice = Number(requestData.unit_price);
               if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isInteger(packSize) || packSize <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isInteger(Number(requestData.received_by)) || Number(requestData.received_by) <= 0) {
                    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Quantity and pack size must be whole numbers greater than zero, incoming cost cannot be negative, and receiving employee is required' } });
                    return;
               }
               if (requestData.change_pricing) {
                    if (!Number.isFinite(requestData.new_sale_price) || Number(requestData.new_sale_price) < 0 || !Number.isFinite(requestData.new_wholesale_price) || Number(requestData.new_wholesale_price) < 0) {
                         res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Retail and wholesale prices must be zero or greater when pricing changes' } });
                         return;
                    }
               }

               const inventoryItem = await new InventoryItemModel(tenantId).stockUp(String(req.params.id), requestData);
               res.status(201).json({ success: true, data: inventoryItem });
          } catch (error: any) {
               const status = /not found|inactive/i.test(error.message) ? 404 : 400;
               res.status(status).json({ success: false, error: { code: 'STOCK_UP_REJECTED', message: error.message || 'Failed to stock up inventory item' } });
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
                    page,
                    count,
                    category_id,
                    inventory_domain,
                    location_id,
                    status,
                    search,
                    sortby = 'ASC'
               } = req.query;

               const filters: InventoryFilters = {
                    page: parseInt(page as string, 10),
                    count: parseInt(count as string, 10),
                    category_id: category_id as string,
                    inventory_domain: inventory_domain as any,
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