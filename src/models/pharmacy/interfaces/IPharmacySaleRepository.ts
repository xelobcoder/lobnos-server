import { PharmacyStockStatus } from '../entities/PharmacyStock';

/** Opaque unit-of-work handle. The service passes it around but never inspects it. */
export type PharmacyUnitOfWork = unknown;

export interface PharmacySellableItemRow {
     id: string;
     name: string;
     sku: string;
     currentStock: number;
     minimumStock: number;
     salePrice: number;
}

export interface PharmacySaleRow {
     id: string;
     receiptNumber: string;
     idempotencyKey: string;
     customerName: string;
     patientId: number | null;
     paymentMethod: string;
     paymentReference: string | null;
     totalAmount: number;
     cashierId: number;
     status: string;
     completedAt: Date | null;
     reversalType: string | null;
     reversalReason: string | null;
     reversedBy: number | null;
     reversedAt: Date | null;
}

export interface PharmacySaleLineRow {
     id: string;
     saleId: string;
     inventoryItemId: string;
     name: string;
     sku: string;
     quantity: number;
     unitPrice: number;
     lineTotal: number;
}

export interface PharmacyStockMovement {
     itemId: string;
     quantity: number;
     previousStock: number;
     newStock: number;
     direction: 'issue' | 'return';
     reason: string;
     referenceId: string;
     patientId: number | null;
     performedBy: number;
     receiptNumber: string;
     occurredAt: Date;
}

export interface PharmacySaleListFilters {
     page: number;
     count: number;
     search?: string;
}

export interface IPharmacySaleRepository {
     /** Runs the supplied work inside a single database transaction. */
     withTransaction<T>(work: (unitOfWork: PharmacyUnitOfWork) => Promise<T>): Promise<T>;

     findSaleByIdempotencyKey(idempotencyKey: string, unitOfWork: PharmacyUnitOfWork): Promise<PharmacySaleRow | null>;
     /** Locks the requested pharmacy items for update and returns only those that are sellable. */
     lockSellableItems(itemIds: string[], unitOfWork: PharmacyUnitOfWork): Promise<PharmacySellableItemRow[]>;
     lockItem(itemId: string, unitOfWork: PharmacyUnitOfWork): Promise<PharmacySellableItemRow | null>;
     /** Locks a sale row so concurrent reversals cannot both observe it as completed. */
     lockSale(saleId: string, unitOfWork: PharmacyUnitOfWork): Promise<PharmacySaleRow | null>;

     insertSale(sale: PharmacySaleRow, unitOfWork: PharmacyUnitOfWork): Promise<void>;
     insertSaleLines(lines: PharmacySaleLineRow[], unitOfWork: PharmacyUnitOfWork): Promise<void>;
     /** Writes the new stock level together with its recomputed status. */
     applyStockLevel(itemId: string, newStock: number, status: PharmacyStockStatus, occurredAt: Date, unitOfWork: PharmacyUnitOfWork): Promise<void>;
     recordStockMovement(movement: PharmacyStockMovement, unitOfWork: PharmacyUnitOfWork): Promise<void>;
     markSaleReversed(
          saleId: string,
          reversal: { status: string; type: string; reason: string; actorId: number; occurredAt: Date },
          unitOfWork: PharmacyUnitOfWork
     ): Promise<void>;

     findSaleById(saleId: string): Promise<PharmacySaleRow | null>;
     findSaleLines(saleId: string, unitOfWork?: PharmacyUnitOfWork): Promise<PharmacySaleLineRow[]>;
     listSales(filters: PharmacySaleListFilters): Promise<{ sales: PharmacySaleRow[]; total: number }>;
}
