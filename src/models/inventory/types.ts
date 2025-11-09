// Inventory Management System Types and Interfaces

export type InventoryUnit =
     | 'pieces'
     | 'boxes'
     | 'bottles'
     | 'packs'
     | 'liters'
     | 'kg'
     | 'mg'
     | 'ml'
     | 'units'
     | 'vials'
     | 'tubes'
     | 'plates'
     | 'strips'
     | 'kits';

export type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'expired';

export type PurchaseOrderStatus = 'draft' | 'sent' | 'confirmed' | 'partially_received' | 'received' | 'cancelled';

export type PurchaseOrderItemStatus = 'pending' | 'partially_received' | 'received' | 'cancelled';

export type TransactionType = 'consumption' | 'addition' | 'adjustment' | 'transfer';

// Base entity interface
export interface BaseEntity {
     id: string;
     created_at: string;
     updated_at: string;
}

// Brand interfaces
export interface Brand extends BaseEntity {
     name: string;
     created_date: string;
     item_count: number;
}

export interface CreateBrandRequest {
     name: string;
}

export interface UpdateBrandRequest {
     name?: string;
}

export interface BrandListResponse {
     brands: Brand[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
}

// Category interfaces
export interface Category extends BaseEntity {
     name: string;
     description?: string;
     item_count: number;
}

export interface CreateCategoryRequest {
     name: string;
     description?: string;
}

export interface UpdateCategoryRequest {
     name?: string;
     description?: string;
}

export interface CategoryListResponse {
     categories: Category[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
}

// Supplier interfaces
export interface Supplier extends BaseEntity {
     name: string;
     contact?: string;
     email?: string;
     phone?: string;
     address?: string;
     is_active: boolean;
}

export interface CreateSupplierRequest {
     name: string;
     contact?: string;
     email?: string;
     phone?: string;
     address?: string;
     is_active?: boolean;
}

export interface UpdateSupplierRequest {
     name?: string;
     contact?: string;
     email?: string;
     phone?: string;
     address?: string;
     is_active?: boolean;
}

export interface SupplierListResponse {
     suppliers: Supplier[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
}

// Storage Location interfaces
export interface StorageLocation extends BaseEntity {
     name: string;
     description?: string;
     capacity?: number;
     temperature_controlled: boolean;
     temperature_range?: string;
     hazardous_materials: boolean;
     is_active: boolean;
}

export interface CreateStorageLocationRequest {
     name: string;
     description?: string;
     capacity?: number;
     temperature_controlled?: boolean;
     temperature_range?: string;
     hazardous_materials?: boolean;
     is_active?: boolean;
}

export interface UpdateStorageLocationRequest {
     name?: string;
     description?: string;
     capacity?: number;
     temperature_controlled?: boolean;
     temperature_range?: string;
     hazardous_materials?: boolean;
     is_active?: boolean;
}

export interface StorageLocationListResponse {
     locations: StorageLocation[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
}

// Inventory Item interfaces
export interface InventoryItem extends BaseEntity {
     name: string;
     sku: string;
     description?: string;
     category_id?: string;
     brand_id?: string;
     unit: InventoryUnit;
     current_stock: number;
     min_stock: number;
     max_stock: number;
     unit_price: number;
     total_value: number;
     location_id?: string;
     expiry_date?: string;
     batch_number?: string;
     status: InventoryStatus;
     is_active: boolean;
     last_updated: string;

     // Joined data
     category_name?: string;
     brand_name?: string;
     location_name?: string;
}

export interface CreateInventoryItemRequest {
     name: string;
     sku: string;
     description?: string;
     category_id?: string;
     brand_id?: string;
     unit?: InventoryUnit;
     current_stock?: number;
     min_stock?: number;
     max_stock?: number;
     unit_price?: number;
     location_id?: string;
     expiry_date?: string;
     batch_number?: string;
}

export interface UpdateInventoryItemRequest {
     name?: string;
     sku?: string;
     description?: string;
     category_id?: string;
     brand_id?: string;
     unit?: InventoryUnit;
     current_stock?: number;
     min_stock?: number;
     max_stock?: number;
     unit_price?: number;
     location_id?: string;
     expiry_date?: string;
     batch_number?: string;
     is_active?: boolean;
}

export interface InventoryItemListResponse {
     items: InventoryItem[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
     summary: {
          total_value: number;
          low_stock_count: number;
          expired_count: number;
          total_items: number;
          out_of_stock_count: number;
     };
}

export interface InventoryFilters {
     page?: number;
     count?: number;
     sortby?: 'ASC' | 'DESC';
     category_id?: string;
     brand_id?: string;
     location_id?: string;
     status?: InventoryStatus;
     search?: string;
     low_stock_only?: boolean;
     expired_only?: boolean;
     startDate?: string;
     endDate?: string;
}

// Purchase Order interfaces
export interface PurchaseOrder extends BaseEntity {
     order_number: string;
     supplier_id: string;
     order_date: string;
     expected_delivery_date?: string;
     actual_delivery_date?: string;
     status: PurchaseOrderStatus;
     total_amount: number;
     notes?: string;
     created_by?: string;
     approved_by?: string;

     // Joined data
     supplier_name?: string;
     items_count?: number;
}

export interface CreatePurchaseOrderRequest {
     supplier_id: string;
     order_date?: string;
     expected_delivery_date?: string;
     notes?: string;
     items: CreatePurchaseOrderItemRequest[];
}

export interface UpdatePurchaseOrderRequest {
     supplier_id?: string;
     order_date?: string;
     expected_delivery_date?: string;
     actual_delivery_date?: string;
     status?: PurchaseOrderStatus;
     notes?: string;
     approved_by?: string;
}

export interface PurchaseOrderListResponse {
     orders: PurchaseOrder[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
}

export interface PurchaseOrderFilters {
     page?: number;
     count?: number;
     sortby?: 'ASC' | 'DESC';
     supplier_id?: string;
     status?: PurchaseOrderStatus;
     startDate?: string;
     endDate?: string;
     search?: string;
}

// Purchase Order Item interfaces
export interface PurchaseOrderItem extends BaseEntity {
     order_id: string;
     item_name: string;
     sku?: string;
     brand_name?: string;
     quantity_ordered: number;
     quantity_received: number;
     unit_price: number;
     total_price: number;
     status: PurchaseOrderItemStatus;
     notes?: string;
}

export interface CreatePurchaseOrderItemRequest {
     item_name: string;
     sku?: string;
     brand_name?: string;
     quantity_ordered: number;
     unit_price: number;
     notes?: string;
}

export interface UpdatePurchaseOrderItemRequest {
     quantity_ordered?: number;
     unit_price?: number;
     notes?: string;
}

export interface PurchaseOrderItemListResponse {
     items: PurchaseOrderItem[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
}

// Inventory Transaction interfaces
export interface InventoryTransaction extends BaseEntity {
     item_id: string;
     transaction_type: TransactionType;
     quantity: number;
     previous_stock: number;
     new_stock: number;
     batch_number?: string;
     brand_name?: string;
     reason?: string;
     reference_id?: string;
     performed_by?: string;
     transaction_date: string;
     notes?: string;

     // Joined data
     item_name?: string;
     item_sku?: string;
}

export interface CreateInventoryTransactionRequest {
     item_id: string;
     transaction_type: TransactionType;
     quantity: number;
     batch_number?: string;
     brand_name?: string;
     reason?: string;
     reference_id?: string;
     performed_by?: string;
     notes?: string;
}

export interface InventoryTransactionListResponse {
     transactions: InventoryTransaction[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
}

export interface InventoryTransactionFilters {
     page?: number;
     count?: number;
     sortby?: 'ASC' | 'DESC';
     item_id?: string;
     transaction_type?: TransactionType;
     performed_by?: string;
     startDate?: string;
     endDate?: string;
     search?: string;
}

// Receiving interfaces
export interface ReceiveOrderItemRequest {
     order_item_id: string;
     quantity: number;
     batch_number?: string;
     expiry_date?: string;
     location_id?: string;
}

export interface ReceiveOrderRequest {
     order_id: string;
     items: ReceiveOrderItemRequest[];
     received_by: string;
}

// Bulk operations
export interface BulkCreateBrandsRequest {
     brands: CreateBrandRequest[];
}

export interface BulkCreateBrandsResponse {
     success: boolean;
     brands: Brand[];
     errors: Array<{
          name: string;
          error: string;
     }>;
}

// Validation interfaces
export interface ValidationError {
     field: string;
     message: string;
     value?: any;
}

export interface ApiResponse<T = any> {
     success: boolean;
     data?: T;
     error?: {
          code: string;
          message: string;
          details?: ValidationError[];
     };
     pagination?: {
          page: number;
          count: number;
          total: number;
          totalPages: number;
     };
}

// Dashboard/Summary interfaces
export interface InventorySummary {
     total_items: number;
     total_value: number;
     low_stock_items: number;
     expired_items: number;
     out_of_stock_items: number;
     categories_count: number;
     suppliers_count: number;
     pending_orders: number;
}

export interface LowStockAlert {
     item_id: string;
     item_name: string;
     sku: string;
     current_stock: number;
     min_stock: number;
     last_updated: string;
}

export interface ExpiringItemAlert {
     item_id: string;
     item_name: string;
     sku: string;
     expiry_date: string;
     days_until_expiry: number;
     current_stock: number;
}

// Report interfaces
export interface InventoryReportFilters {
     category_id?: string;
     brand_id?: string;
     supplier_id?: string;
     location_id?: string;
     status?: InventoryStatus;
     startDate?: string;
     endDate?: string;
}

export interface InventoryValueReport {
     category_name: string;
     item_count: number;
     total_value: number;
     percentage: number;
}

export interface TransactionReport {
     date: string;
     additions: number;
     consumptions: number;
     adjustments: number;
     transfers: number;
     net_change: number;
}

// Constants and enums
export const INVENTORY_UNITS: InventoryUnit[] = [
     'pieces', 'boxes', 'bottles', 'packs', 'liters', 'kg', 'mg', 'ml',
     'units', 'vials', 'tubes', 'plates', 'strips', 'kits'
];

export const INVENTORY_STATUSES: InventoryStatus[] = [
     'in_stock', 'low_stock', 'out_of_stock', 'expired'
];

export const PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = [
     'draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled'
];

export const PURCHASE_ORDER_ITEM_STATUSES: PurchaseOrderItemStatus[] = [
     'pending', 'partially_received', 'received', 'cancelled'
];

export const TRANSACTION_TYPES: TransactionType[] = [
     'consumption', 'addition', 'adjustment', 'transfer'
];