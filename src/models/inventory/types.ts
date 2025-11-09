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

export type PurchaseOrderStatus = 'draft' | 'pending_approval' | 'approved' | 'sent' | 'confirmed' | 'partially_received' | 'received' | 'cancelled';

export type PurchaseOrderItemStatus = 'pending' | 'partially_received' | 'received' | 'cancelled' | 'backordered';

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
     inventory_item_id: string;
     created_date: string;
     item_count: number;
}

export interface CreateBrandRequest {
     name: string;
     inventory_item_id: string;
}

export interface UpdateBrandRequest {
     name?: string;
     inventory_item_id?: string;
}

export interface BrandListResponse {
     brands: Brand[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
     sortby: 'ASC' | 'DESC';
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
     sortby: 'ASC' | 'DESC';
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
     sortby: 'ASC' | 'DESC';
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
     sortby: 'ASC' | 'DESC';
}

// Inventory Item interfaces
export interface InventoryItem extends BaseEntity {
     name: string;
     sku: string;
     description?: string;
     category_id?: string;
     unit: InventoryUnit;
     current_stock: number;
     min_stock: number;
     max_stock: number;
     location_id?: string;
     status: InventoryStatus;
     is_active: boolean;
     last_updated: string;

     // Joined data
     category_name?: string;
     location_name?: string;
}

export interface CreateInventoryItemRequest {
     name: string;
     sku: string;
     description?: string;
     category_id?: string;
     unit?: InventoryUnit;
     current_stock?: number;
     min_stock?: number;
     max_stock?: number;
     location_id?: string;
}

export interface UpdateInventoryItemRequest {
     name?: string;
     sku?: string;
     description?: string;
     category_id?: string;
     unit?: InventoryUnit;
     current_stock?: number;
     min_stock?: number;
     max_stock?: number;
     location_id?: string;
     is_active?: boolean;
}

export interface InventoryItemListResponse {
     items: InventoryItem[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
     sortby: 'ASC' | 'DESC';
     summary: {
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
     tax_amount: number;
     discount_amount: number;
     shipping_cost: number;
     final_amount: number;
     currency: string;
     payment_terms?: string;
     notes?: string;
     created_by?: string;
     approved_by?: string;
     approved_at?: string;
     sent_at?: string;

     // Joined data
     supplier_name?: string;
     items_count?: number;
     received_items_count?: number;
}

export interface CreatePurchaseOrderRequest {
     supplier_id: string;
     order_date?: string;
     expected_delivery_date?: string;
     payment_terms?: string;
     tax_amount?: number;
     discount_amount?: number;
     shipping_cost?: number;
     currency?: string;
     notes?: string;
     items: CreatePurchaseOrderItemRequest[];
}

export interface UpdatePurchaseOrderRequest {
     supplier_id?: string;
     order_date?: string;
     expected_delivery_date?: string;
     actual_delivery_date?: string;
     status?: PurchaseOrderStatus;
     payment_terms?: string;
     tax_amount?: number;
     discount_amount?: number;
     shipping_cost?: number;
     currency?: string;
     notes?: string;
     approved_by?: string;
     sent_at?: string;
}

export interface PurchaseOrderListResponse {
     orders: PurchaseOrder[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
     sortby: 'ASC' | 'DESC';
}

export interface PurchaseOrderFilters {
     page?: number;
     count?: number;
     sortby?: 'ASC' | 'DESC';
     supplier_id?: string;
     status?: PurchaseOrderStatus | PurchaseOrderStatus[];
     startDate?: string;
     endDate?: string;
     search?: string;
}

// Purchase Order Item interfaces
export interface PurchaseOrderItem extends BaseEntity {
     order_id: string;
     inventory_item_id?: string;
     item_name: string;
     item_description?: string;
     sku?: string;
     category_name?: string;
     brand_name?: string;
     supplier_sku?: string;
     quantity_ordered: number;
     quantity_received: number;
     quantity_rejected: number;
     unit_price: number;
     tax_rate: number;
     discount_rate: number;
     line_total: number;
     unit: string;
     batch_number?: string;
     expiry_date?: string;
     status: PurchaseOrderItemStatus;
     received_at?: string;
     notes?: string;
}

export interface CreatePurchaseOrderItemRequest {
     item_id: string;
     quantity: number;
     unit_price?: number;
     tax_rate?: number;
     discount_rate?: number;
     notes?: string;
}

export interface UpdatePurchaseOrderItemRequest {
     inventory_item_id?: string;
     item_name?: string;
     item_description?: string;
     sku?: string;
     category_name?: string;
     brand_name?: string;
     supplier_sku?: string;
     quantity_ordered?: number;
     unit_price?: number;
     tax_rate?: number;
     discount_rate?: number;
     unit?: string;
     batch_number?: string;
     expiry_date?: string;
     notes?: string;
}

export interface PurchaseOrderItemListResponse {
     items: PurchaseOrderItem[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
     sortby: 'ASC' | 'DESC';
}

// Purchase Order Receipt interfaces
export interface PurchaseOrderReceipt extends BaseEntity {
     order_id: string;
     order_item_id: string;
     receipt_number: string;
     received_date: string;
     received_by: string;
     quantity_received: number;
     batch_number?: string;
     expiry_date?: string;
     condition_status: 'good' | 'damaged' | 'expired' | 'incorrect_item';
     quality_check_passed: boolean;
     storage_location_id?: string;
     notes?: string;
}

export interface CreatePurchaseOrderReceiptRequest {
     order_item_id: string;
     quantity_received: number;
     batch_number?: string;
     expiry_date?: string;
     condition_status?: 'good' | 'damaged' | 'expired' | 'incorrect_item';
     quality_check_passed?: boolean;
     storage_location_id?: string;
     notes?: string;
}

export interface PurchaseOrderReceiptListResponse {
     receipts: PurchaseOrderReceipt[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
     sortby: 'ASC' | 'DESC';
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
     sortby: 'ASC' | 'DESC';
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
     quantity_received: number;
     batch_number?: string;
     expiry_date?: string;
     condition_status?: 'good' | 'damaged' | 'expired' | 'incorrect_item';
     quality_check_passed?: boolean;
     storage_location_id?: string;
     notes?: string;
}

export interface ReceiveOrderRequest {
     order_id: string;
     receipts: CreatePurchaseOrderReceiptRequest[];
     received_by: string;
     received_date?: string;
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
          sortby: 'ASC' | 'DESC';
     };
}

// Dashboard/Summary interfaces
export interface InventorySummary {
     total_items: number;
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

// Report interfaces
export interface InventoryReportFilters {
     category_id?: string;
     supplier_id?: string;
     location_id?: string;
     status?: InventoryStatus;
     startDate?: string;
     endDate?: string;
}

export interface InventoryValueReport {
     category_name: string;
     item_count: number;
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
     'draft', 'pending_approval', 'approved', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled'
];

export const PURCHASE_ORDER_ITEM_STATUSES: PurchaseOrderItemStatus[] = [
     'pending', 'partially_received', 'received', 'cancelled', 'backordered'
];

export const TRANSACTION_TYPES: TransactionType[] = [
     'consumption', 'addition', 'adjustment', 'transfer'
];