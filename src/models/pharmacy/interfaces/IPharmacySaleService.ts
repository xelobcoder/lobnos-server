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

export interface PharmacySaleHistoryItem {
     id: string;
     receiptNumber: string;
     customerName: string;
     paymentMethod: PharmacyPaymentMethod;
     total: number;
     status: string;
     completedAt: Date | null;
     cashierId: number;
}

export interface PharmacySaleHistory {
     sales: PharmacySaleHistoryItem[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
}

export interface IPharmacySaleService {
     /** Completes an idempotent sale and atomically records the resulting inventory issue. */
     completeSale(input: CreatePharmacySaleInput, cashierId: number): Promise<PharmacySaleReceipt>;
     /** Lists completed pharmacy sales without exposing mutable inventory state. */
     getSalesHistory(page: number, count: number, search?: string): Promise<PharmacySaleHistory>;
}