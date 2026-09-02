export type PharmacyPaymentMethod = 'cash' | 'mobile_money' | 'card';

export interface CreatePharmacySaleInput {
     idempotencyKey: string;
     customerName?: string;
     patientId?: number | null;
     paymentMethod: PharmacyPaymentMethod;
     paymentReference?: string;
     lines: Array<{ inventoryItemId: string; quantity: number }>;
}

export interface PharmacySaleReceipt {
     id: string;
     receiptNumber: string;
     total: number;
     paymentMethod: PharmacyPaymentMethod;
     completedAt: Date;
}

export type PharmacySaleReversalType = 'refund' | 'void' | 'cancel';

export interface ReversePharmacySaleInput {
     type: PharmacySaleReversalType;
     reason: string;
}

export interface PharmacySaleReversal {
     id: string;
     receiptNumber: string;
     status: string;
     reversalType: PharmacySaleReversalType;
     reason: string;
     reversedBy: number;
     reversedAt: Date;
     restockedItems: Array<{ inventoryItemId: string; name: string; quantity: number }>;
}

export interface PharmacySaleHistoryItem {
     id: string;
     receiptNumber: string;
     customerName: string;
     paymentMethod: PharmacyPaymentMethod;
     total: number;
     status: string;
     completedAt: Date | null;
     cashierId: number;
     reversalType: PharmacySaleReversalType | null;
     reversalReason: string | null;
     reversedAt: Date | null;
}

export interface PharmacySaleHistory {
     sales: PharmacySaleHistoryItem[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
}

export interface PharmacySaleHistoryRequest {
     page: number;
     count: number;
     search?: string;
     /** Restricts the listing to these sale statuses. Defaults to every status. */
     statuses?: string[];
     reversalType?: PharmacySaleReversalType;
}

export interface PharmacySaleLine {
     id: string;
     inventoryItemId: string;
     name: string;
     sku: string;
     quantity: number;
     unitPrice: number;
     lineTotal: number;
}

export interface PharmacySaleDetail extends PharmacySaleHistoryItem {
     paymentReference: string | null;
     patientId: number | null;
     reversedBy: number | null;
     lines: PharmacySaleLine[];
}

export interface IPharmacySaleService {
     /** Completes an idempotent sale and atomically records the resulting inventory issue. */
     completeSale(input: CreatePharmacySaleInput, cashierId: number): Promise<PharmacySaleReceipt>;
     /** Lists pharmacy sales, optionally narrowed to particular statuses. */
     getSalesHistory(request: PharmacySaleHistoryRequest): Promise<PharmacySaleHistory>;
     /** Returns one sale with the item lines captured at the time of sale. */
     getSaleDetail(saleId: string): Promise<PharmacySaleDetail>;
     /** Refunds, voids or cancels a completed sale and atomically returns its stock. */
     reverseSale(saleId: string, input: ReversePharmacySaleInput, actorId: number): Promise<PharmacySaleReversal>;
}