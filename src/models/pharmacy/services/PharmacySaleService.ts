import { randomUUID } from 'crypto';
import {
     PHARMACY_REVERSAL_MAX_REASON_LENGTH,
     PHARMACY_REVERSAL_MIN_REASON_LENGTH,
     PHARMACY_REVERSAL_STATUSES,
     PHARMACY_SALE_STATUS_COMPLETED
} from '../constants/pharmacy.constants';
import { resolveStockStatus } from '../entities/PharmacyStock';
import {
     IPharmacySaleRepository,
     PharmacySaleLineRow,
     PharmacySaleRow,
     PharmacyUnitOfWork
} from '../interfaces/IPharmacySaleRepository';
import {
     IPharmacySaleService,
     CreatePharmacySaleInput,
     PharmacyPaymentMethod,
     PharmacySaleDetail,
     PharmacySaleHistory,
     PharmacySaleHistoryItem,
     PharmacySaleHistoryRequest,
     PharmacySaleReceipt,
     PharmacySaleReversal,
     PharmacySaleReversalType,
     ReversePharmacySaleInput
} from '../interfaces/IPharmacySaleService';

export class PharmacySaleService implements IPharmacySaleService {
     constructor(private readonly saleRepository: IPharmacySaleRepository) { }

     async completeSale(input: CreatePharmacySaleInput, cashierId: number): Promise<PharmacySaleReceipt> {
          if (!input.idempotencyKey || !input.lines?.length) throw new Error('A sale requires an idempotency key and at least one line');
          if (new Set(input.lines.map((line) => line.inventoryItemId)).size !== input.lines.length) throw new Error('Duplicate inventory items are not allowed');

          return this.saleRepository.withTransaction(async (unitOfWork) => {
               const existing = await this.saleRepository.findSaleByIdempotencyKey(input.idempotencyKey, unitOfWork);
               if (existing) return this.toReceipt(existing);

               const itemIds = input.lines.map((line) => line.inventoryItemId);
               const items = await this.saleRepository.lockSellableItems(itemIds, unitOfWork);
               if (items.length !== itemIds.length) throw new Error('One or more pharmacy items are unavailable');

               const itemsById = new Map(items.map((item) => [item.id, item]));
               const now = new Date();
               const saleId = randomUUID();
               const lines: PharmacySaleLineRow[] = [];
               let total = 0;

               for (const requested of input.lines) {
                    const item = itemsById.get(requested.inventoryItemId)!;
                    if (!Number.isFinite(requested.quantity) || requested.quantity <= 0) throw new Error('Sale quantities must be positive');
                    if (item.salePrice <= 0) throw new Error(`${item.name} has no active pharmacy sale price`);
                    if (item.currentStock < requested.quantity) throw new Error(`${item.name} has insufficient stock`);

                    const lineTotal = item.salePrice * requested.quantity;
                    total += lineTotal;
                    lines.push({
                         id: randomUUID(),
                         saleId,
                         inventoryItemId: item.id,
                         name: item.name,
                         sku: item.sku,
                         quantity: requested.quantity,
                         unitPrice: item.salePrice,
                         lineTotal
                    });
               }

               const sale: PharmacySaleRow = {
                    id: saleId,
                    receiptNumber: `PHM-${Date.now()}`,
                    idempotencyKey: input.idempotencyKey,
                    customerName: input.customerName?.trim() || 'Walk-in customer',
                    patientId: input.patientId || null,
                    paymentMethod: input.paymentMethod,
                    paymentReference: input.paymentReference?.trim() || null,
                    totalAmount: total,
                    cashierId,
                    status: PHARMACY_SALE_STATUS_COMPLETED,
                    completedAt: now,
                    reversalType: null,
                    reversalReason: null,
                    reversedBy: null,
                    reversedAt: null
               };

               await this.saleRepository.insertSale(sale, unitOfWork);
               await this.saleRepository.insertSaleLines(lines, unitOfWork);

               for (const line of lines) {
                    await this.applyStockChange(itemsById.get(line.inventoryItemId)!, -line.quantity, {
                         direction: 'issue',
                         reason: 'Pharmacy POS sale',
                         sale,
                         performedBy: cashierId,
                         occurredAt: now,
                         unitOfWork
                    });
               }

               return this.toReceipt(sale);
          });
     }

     async getSalesHistory(request: PharmacySaleHistoryRequest): Promise<PharmacySaleHistory> {
          const safePage = Math.max(1, request.page);
          const safeCount = Math.min(100, Math.max(1, request.count));
          const { sales, total } = await this.saleRepository.listSales({
               page: safePage,
               count: safeCount,
               search: request.search,
               statuses: request.statuses,
               reversalType: request.reversalType
          });

          return {
               sales: sales.map((sale) => this.toHistoryItem(sale)),
               total,
               page: safePage,
               count: safeCount,
               totalPages: Math.max(1, Math.ceil(total / safeCount))
          };
     }

     async getSaleDetail(saleId: string): Promise<PharmacySaleDetail> {
          const sale = await this.saleRepository.findSaleById(saleId);
          if (!sale) throw new Error('Sale not found');
          const lines = await this.saleRepository.findSaleLines(saleId);

          return {
               ...this.toHistoryItem(sale),
               paymentReference: sale.paymentReference,
               patientId: sale.patientId,
               reversedBy: sale.reversedBy,
               lines: lines.map((line) => ({
                    id: line.id,
                    inventoryItemId: line.inventoryItemId,
                    name: line.name,
                    sku: line.sku,
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                    lineTotal: line.lineTotal
               }))
          };
     }

     async reverseSale(saleId: string, input: ReversePharmacySaleInput, actorId: number): Promise<PharmacySaleReversal> {
          const status = PHARMACY_REVERSAL_STATUSES[input?.type as keyof typeof PHARMACY_REVERSAL_STATUSES];
          if (!status) throw new Error('Reversal type must be refund, void or cancel');
          const reason = input.reason?.trim() || '';
          if (reason.length < PHARMACY_REVERSAL_MIN_REASON_LENGTH) throw new Error('A reversal reason of at least 5 characters is required');
          if (reason.length > PHARMACY_REVERSAL_MAX_REASON_LENGTH) throw new Error('The reversal reason is too long');

          return this.saleRepository.withTransaction(async (unitOfWork) => {
               // Locked before the status check so two reviewers cannot both restock the same receipt.
               const sale = await this.saleRepository.lockSale(saleId, unitOfWork);
               if (!sale) throw new Error('Sale not found');
               if (sale.status !== PHARMACY_SALE_STATUS_COMPLETED) throw new Error(`This sale is already ${sale.status} and cannot be reversed again`);

               const lines = await this.saleRepository.findSaleLines(saleId, unitOfWork);
               if (!lines.length) throw new Error('This sale has no lines to reverse');

               const now = new Date();
               const restockedItems: PharmacySaleReversal['restockedItems'] = [];

               for (const line of lines) {
                    const item = await this.saleRepository.lockItem(line.inventoryItemId, unitOfWork);
                    if (item) {
                         await this.applyStockChange(item, line.quantity, {
                              direction: 'return',
                              reason: `Pharmacy sale ${input.type}: ${reason}`,
                              sale,
                              performedBy: actorId,
                              occurredAt: now,
                              unitOfWork
                         });
                    }
                    restockedItems.push({ inventoryItemId: line.inventoryItemId, name: line.name, quantity: line.quantity });
               }

               await this.saleRepository.markSaleReversed(sale.id, { status, type: input.type, reason, actorId, occurredAt: now }, unitOfWork);

               return {
                    id: sale.id,
                    receiptNumber: sale.receiptNumber,
                    status,
                    reversalType: input.type,
                    reason,
                    reversedBy: actorId,
                    reversedAt: now,
                    restockedItems
               };
          });
     }

     /** Moves stock by `delta` and keeps the stored status column in step, so inventory screens stay truthful. */
     private async applyStockChange(
          item: { id: string; currentStock: number; minimumStock: number },
          delta: number,
          context: {
               direction: 'issue' | 'return';
               reason: string;
               sale: PharmacySaleRow;
               performedBy: number;
               occurredAt: Date;
               unitOfWork: PharmacyUnitOfWork;
          }
     ): Promise<void> {
          const previousStock = item.currentStock;
          const newStock = previousStock + delta;

          await this.saleRepository.applyStockLevel(
               item.id,
               newStock,
               resolveStockStatus(newStock, item.minimumStock),
               context.occurredAt,
               context.unitOfWork
          );
          await this.saleRepository.recordStockMovement({
               itemId: item.id,
               quantity: Math.abs(delta),
               previousStock,
               newStock,
               direction: context.direction,
               reason: context.reason,
               referenceId: context.sale.id,
               patientId: context.sale.patientId,
               performedBy: context.performedBy,
               receiptNumber: context.sale.receiptNumber,
               occurredAt: context.occurredAt
          }, context.unitOfWork);
     }

     private toHistoryItem(sale: PharmacySaleRow): PharmacySaleHistoryItem {
          return {
               id: sale.id,
               receiptNumber: sale.receiptNumber,
               customerName: sale.customerName,
               paymentMethod: sale.paymentMethod as PharmacyPaymentMethod,
               total: sale.totalAmount,
               status: sale.status,
               completedAt: sale.completedAt,
               cashierId: sale.cashierId,
               reversalType: (sale.reversalType as PharmacySaleReversalType) || null,
               reversalReason: sale.reversalReason,
               reversedAt: sale.reversedAt
          };
     }

     private toReceipt(sale: PharmacySaleRow): PharmacySaleReceipt {
          return {
               id: sale.id,
               receiptNumber: sale.receiptNumber,
               total: sale.totalAmount,
               paymentMethod: sale.paymentMethod as PharmacyPaymentMethod,
               completedAt: sale.completedAt as Date
          };
     }
}