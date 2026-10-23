// SUPPLIER PAYMENT TYPES
// Types and interfaces for supplier payment tracking system

export interface SupplierPayment {
     payment_account_id?: number | null;
     payment_account_name?: string | null;
     payment_account_gl_code?: string | null;
     branchid?: number | null;
     id: string;
     payment_id: string;
     supplier_id: string;
     purchase_order_id: string;
     payment_amount: number;
     payment_date: string;
     payment_method: 'cash' | 'check' | 'bank_transfer' | 'credit_card' | 'wire_transfer' | 'mobile_money' | 'cheque' | 'other';
     payment_status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded';
     reference_number?: string;
     payment_notes?: string;
     total_allocated: number;
     created_by?: string;
     approved_by?: string;
     approved_at?: string;
     processed_at?: string;
     created_at: string;
     updated_at: string;
     expense_synced?: boolean;

     // Relations
     supplier?: {
          id: string;
          name: string;
          contact?: string;
          email?: string;
     };
     purchase_order?: {
          id: string;
          order_number: string;
          total_amount: number;
          status: string;
     };
     allocations?: SupplierPaymentAllocation[];
}

export interface SupplierPaymentListItem extends SupplierPayment {
     supplier_name?: string;
     po_order_number?: string;
     expense_synced?: boolean;
}

export interface SupplierPaymentAllocation {
     id: string;
     payment_id: string;
     purchase_order_id: string;
     order_item_id?: string;
     allocated_amount: number;
     allocation_notes?: string;
     created_at: string;

     // Relations
     purchase_order?: {
          id: string;
          order_number: string;
     };
     order_item?: {
          id: string;
          quantity_ordered: number;
          unit_price: number;
          line_total: number;
     };
}

export interface CreateSupplierPaymentRequest {
     payment_account_id: number;
     supplier_id: string;
     purchase_order_id: string;
     payment_amount: number;
     payment_date: string;
     payment_method?: 'cash' | 'check' | 'bank_transfer' | 'credit_card' | 'wire_transfer' | 'mobile_money' | 'cheque' | 'other';
     reference_number?: string;
     payment_notes?: string;
     created_by: string;
     allocations?: CreateSupplierPaymentAllocationRequest[];
}

export interface CreateSupplierPaymentAllocationRequest {
     purchase_order_id: string;
     order_item_id?: string;
     allocated_amount: number;
     allocation_notes?: string;
}

export interface UpdateSupplierPaymentRequest {
     payment_account_id?: number;
     payment_amount?: number;
     payment_date?: string;
     payment_method?: 'cash' | 'check' | 'bank_transfer' | 'credit_card' | 'wire_transfer' | 'mobile_money' | 'cheque' | 'other';
     payment_status?: 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded';
     reference_number?: string;
     payment_notes?: string;
     approved_by?: string;
     processed_at?: string;
}

export interface SupplierPaymentFilters {
     page?: number;
     count?: number;
     supplier_id?: string;
     purchase_order_id?: string;
     payment_status?: 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded';
     payment_method?: 'cash' | 'check' | 'bank_transfer' | 'credit_card' | 'wire_transfer' | 'mobile_money' | 'cheque' | 'other';
     startDate?: string;
     endDate?: string;
     search?: string;
     sortby?: 'ASC' | 'DESC';
}

export interface SupplierPaymentListResponse {
     payments: SupplierPaymentListItem[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
     sortby: 'ASC' | 'DESC';
}

export interface SupplierPaymentGroupedResponse {
     purchase_orders: SupplierPaymentPurchaseOrderGroup[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
     sortby: 'ASC' | 'DESC';
}

export interface SupplierPaymentPurchaseOrderGroup {
     purchase_order_id: string;
     purchase_order?: {
          id: string;
          order_number: string;
          total_amount: number;
          status: string;
          supplier_name?: string;
     };
     payments: SupplierPayment[];
     total_payment_amount: number;
     pending_amount: number;
     completed_amount: number;
     payment_count: number;
}

export interface SupplierPaymentSummary {
     total_payments: number;
     total_amount: number;
     pending_payments: number;
     completed_payments: number;
     failed_payments: number;
     payment_methods_breakdown: Record<string, number>;
     period_start: string;
     period_end: string;
}
