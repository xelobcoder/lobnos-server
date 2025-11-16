// Inventory Management System Types and Interfaces

import { SupplierPayment } from './supplierPaymentTypes';

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
     message?: string;
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

// Purchase Order interfaces
export type PurchaseOrderStatus = 'ordered' | 'partially_received' | 'received' | 'cancelled';

export type PurchaseOrderItemStatus = 'pending' | 'partially_received' | 'received' | 'cancelled';

export type ConditionStatus = 'good' | 'acceptable' | 'damaged' | 'expired';

export type TransactionType = 'addition' | 'consumption' | 'adjustment' | 'transfer' | 'wastage';

export type WastageType = 'expired' | 'damaged' | 'broken' | 'contamination' | 'other';

export interface PurchaseOrder extends BaseEntity {
     id: string;
     order_number: string;
     supplier_id: string;
     order_date: string;
     expected_delivery_date?: string;
     status: PurchaseOrderStatus;
     total_amount: number;
     communication_method?: string;
     communication_notes?: string;
     notes?: string;
     created_by?: string;

     // Joined data
     supplier?: Supplier;
     items_count?: number;
     received_items_count?: number;
     items?: PurchaseOrderItem[];

     // Payment information
     payment_history?: SupplierPayment[];
     total_paid?: number;
     remaining_balance?: number;
     total_pending?: number;
}

export interface CreatePurchaseOrderRequest {
     supplier_id: string;
     order_date?: string;
     expected_delivery_date?: string;
     communication_method?: string;
     communication_notes?: string;
     items: CreatePurchaseOrderItemRequest[];
     notes?: string;
}

export interface UpdatePurchaseOrderRequest {
     supplier_id?: string;
     expected_delivery_date?: string;
     communication_method?: string;
     communication_notes?: string;
     status?: PurchaseOrderStatus;
     notes?: string;
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
     order_id?: string;
     status?: PurchaseOrderStatus | PurchaseOrderStatus[];
     start_date?: string;
     end_date?: string;
     search?: string;
}

export interface PurchaseOrderItem extends BaseEntity {
     id: string;
     order_id: string;
     inventory_item_id?: string;
     quantity_ordered: number;
     quantity_received: number;
     unit_price: number;
     tax_rate: number;
     discount_rate: number;
     line_total: number;
     status: PurchaseOrderItemStatus;
     notes?: string;

     // Joined data
     item_name?: string;
     item_sku?: string;
     unit?: InventoryUnit;
}

export interface CreatePurchaseOrderItemRequest {
     inventory_item_id: string;
     quantity_ordered: number;
     unit_price?: number;
     tax_rate?: number;
     discount_rate?: number;
     notes?: string;
}

export interface UpdatePurchaseOrderItemRequest {
     quantity_ordered?: number;
     unit_price?: number;
     tax_rate?: number;
     discount_rate?: number;
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

export interface PurchaseOrderReceipt extends BaseEntity {
     id: string;
     order_id: string;
     order_item_id: string;
     receipt_number: string;
     received_date: string;
     received_by?: number;
     quantity_received: number;
     batch_number?: string;
     expiry_date?: string;
     unit_price?: number;
     tax_rate?: number;
     discount_rate?: number;
     condition_status: ConditionStatus;
     quality_check_passed: boolean;
     notes?: string;
     image_url?: string;
}

export interface CreatePurchaseOrderReceiptRequest {
     order_item_id: string;
     quantity_received: number;
     received_date?: string;
     batch_number?: string;
     expiry_date?: string;
     unit_price?: number;
     tax_rate?: number;
     discount_rate?: number;
     condition_status?: ConditionStatus;
     quality_check_passed?: boolean;
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

export interface ReceiveOrderRequest {
     received_by: number;
     received_date?: string;
     receipts: CreatePurchaseOrderReceiptRequest[];
}

export interface InventoryTransaction {
     id: string;
     item_id: string;
     transaction_type: TransactionType;
     quantity: number;
     previous_stock: number;
     new_stock: number;
     batch_number?: string;
     expiry_date?: string;
     unit_cost?: number;
     total_cost?: number;
     brand_name?: string;
     reason?: string;
     reference_id?: string;
     patient_id?: number;
     ascension_id?: number;
     testid?: number;
     performed_by?: number;
     transaction_date: string;
     notes?: string;
     wastage_type?: WastageType;
     created_at: string;

     // Joined data
     item_name?: string;
     item_sku?: string;
}

export interface CreateInventoryTransactionRequest {
     item_id: string;
     transaction_type: TransactionType;
     quantity: number;
     batch_number?: string;
     expiry_date?: string;
     unit_cost?: number;
     brand_name?: string;
     reason?: string;
     reference_id?: string;
     patient_id?: number;
     ascension_id?: number;
     testid?: number;
     performed_by?: number;
     notes?: string;
     wastage_type?: WastageType;
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
     startDate?: string;
     endDate?: string;
     performed_by?: number;
     batch_number?: string;
}

export interface AvailableBatchDetails {
     batch_number: string;
     brand_name?: string;
     total_received: number;
     total_consumed: number;
     available_quantity: number;
     expiry_date?: string;
     last_received: string;
}

export interface AvailableStockDetails {
     item: {
          id: string;
          name: string;
          sku: string;
          current_stock: number;
          unit: string;
     };
     available_batches: AvailableBatchDetails[];
     fifo_batch?: {
          batch_number: string;
          brand_name?: string;
          available_quantity: number;
          expiry_date?: string;
     };
}

// Consumption-specific interfaces
export type ConsumptionType = 'manual' | 'test' | 'wastage';

export interface ManualConsumptionRequest {
     item_id: string;
     quantity: number;
     transaction_type?: TransactionType;
     wastage_type?: WastageType;
     reason?: string;
     batch_number?: string;
     brand_name?: string;
     performed_by?: number;
     notes?: string;
}

export interface BulkConsumptionRequest {
     consumptions: ManualConsumptionRequest[];
}

export interface TestConsumptionRequest {
     test_id: string;
     item_id: string;
     quantity_used: number;
     test_type: string;
     patient_id: number;
     ascension_id: number;
     testid?: number;
     batch_number?: string;
     brand_name?: string;
     performed_by: number;
     notes?: string;
}

export interface WastageRecordRequest {
     item_id: string;
     quantity: number;
     reason: string;
     batch_number?: string;
     brand_name?: string;
     performed_by?: number;
     notes?: string;
}

export interface ConsumptionReportFilters {
     page?: number;
     count?: number;
     sortby?: 'ASC' | 'DESC';
     consumption_type?: ConsumptionType;
     item_id?: string;
     performed_by?: number;
     startDate?: string;
     endDate?: string;
     reason?: string;
}

export interface ConsumptionSummary {
     total_consumptions: number;
     manual_consumptions: number;
     test_consumptions: number;
     wastage_consumptions: number;
     total_quantity_consumed: number;
     period_start: string;
     period_end: string;
}

export interface ConsumptionReport {
     id: string;
     item_id: string;
     item_name: string;
     item_sku: string;
     consumption_type: ConsumptionType;
     quantity: number;
     reason?: string;
     batch_number?: string;
     patient_id?: number;
     ascension_id?: number;
     testid?: number;
     performed_by?: number;
     transaction_date: string;
     notes?: string;
}

export interface ConsumptionReportResponse {
     consumptions: ConsumptionReport[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
     sortby: 'ASC' | 'DESC';
     summary: ConsumptionSummary;
}

// Stock management interfaces
export interface ExpiredBatchDetails {
     item_id: string;
     item_name: string;
     item_sku: string;
     batch_number: string;
     brand_name?: string;
     expiry_date: string;
     unit_price: number;
     total_received: number;
     total_consumed: number;
     available_quantity: number;
     total_value: number;
     days_to_expiry: number;
}

export interface ExpiredBatchesSummary {
     total_expired_batches: number;
     total_expired_quantity: number;
     total_expired_value: number;
     unique_items_affected: number;
     expiry_threshold_days: number;
     expiry_threshold_date: string;
}

export interface ExpiredBatchesResponse {
     expired_batches: ExpiredBatchDetails[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
     sortby: 'ASC' | 'DESC';
     summary: ExpiredBatchesSummary;
}