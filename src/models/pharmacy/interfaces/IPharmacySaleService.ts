import { PharmacyUnitOfWork } from './IPharmacySaleRepository';
export type PharmacyPaymentMethod = 'cash' | 'mobile_money' | 'card';

export interface CreatePharmacySaleInput {
     idempotencyKey: string;
     customerName?: string;
     patientId?: number | null;
     paymentMethod: PharmacyPaymentMethod;
     paymentReference?: string;
     paymentAccountId: number;
     expectedTotal?: number;
     lines: Array<{ inventoryItemId: string; quantity: number }>;
}

export interface HoldPharmacySaleInput {
     customerName?: string;
     patientId?: number | null;
     lines: Array<{ inventoryItemId: string; quantity: number }>;
}

export interface CompleteHeldPharmacySaleInput extends CreatePharmacySaleInput { }

export interface PharmacySaleReceipt {
     id: string;
     receiptNumber: string;
     total: number;
     paymentMethod: PharmacyPaymentMethod;
     completedAt: Date;
     customerName?: string;
     lines?: PharmacySaleLine[];
}

export type PharmacySaleReversalType = 'refund' | 'void' | 'cancel';

export interface ReversePharmacySaleInput {
     type: PharmacySaleReversalType;
     reason: string;
     disposition: 'restock' | 'quarantine' | 'not_returned';
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
     totalCost: number;
     grossProfit: number;
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
     unitCost: number;
     lineCost: number;
     grossProfit: number;
}

export interface PharmacyHeldSale {
     id: string;
     holdNumber: string;
     customerName: string;
     patientId: number | null;
     total: number;
     cashierId: number;
     createdAt: Date;
     lines: PharmacySaleLine[];
}

export interface PharmacySaleDetail extends PharmacySaleHistoryItem {
     paymentAccountId?:number;
     branchid?:number|null;
     paymentReference: string | null;
     patientId: number | null;
     reversedBy: number | null;
     lines: PharmacySaleLine[];
}

export interface IPharmacySaleService {
     /** Completes an idempotent sale and atomically records the resulting inventory issue. */
     completeSale(input: CreatePharmacySaleInput, cashierId: number, unitOfWork?: PharmacyUnitOfWork, prescriptionId?: string): Promise<PharmacySaleReceipt>;
     holdSale(input: HoldPharmacySaleInput, cashierId: number): Promise<PharmacyHeldSale>;
     getHeldSales(page: number, count: number, search?: string): Promise<{ sales: PharmacyHeldSale[]; total: number; page: number; count: number; totalPages: number }>;
     getHeldSale(heldSaleId: string): Promise<PharmacyHeldSale>;
     completeHeldSale(heldSaleId: string, input: CompleteHeldPharmacySaleInput, cashierId: number): Promise<PharmacySaleReceipt>;
     deleteHeldSale(heldSaleId: string): Promise<void>;
     /** Lists pharmacy sales, optionally narrowed to particular statuses. */
     getSalesHistory(request: PharmacySaleHistoryRequest): Promise<PharmacySaleHistory>;
     /** Returns one sale with the item lines captured at the time of sale. */
     getSaleDetail(saleId: string): Promise<PharmacySaleDetail>;
     /** Refunds, voids or cancels a completed sale and atomically returns its stock. */
     reverseSale(saleId: string, input: ReversePharmacySaleInput, actorId: number): Promise<PharmacySaleReversal>;
}
