import Decimal from 'decimal.js';
import {pharmacySettlement} from '../PharmacySettlement';
import { money, quantity, pharmacyUnitPrice, saleRequestHash, validateSaleInput, pharmacyTender, pharmacyTransactionPriceType } from '../PharmacyRules';
import { createHash, randomUUID } from 'crypto';
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
     CompleteHeldPharmacySaleInput,
     CreatePharmacySaleInput,
     HoldPharmacySaleInput,
     PharmacyHeldSale,
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
     constructor(private readonly saleRepository: IPharmacySaleRepository, private readonly branchId: number | null = null) { }

     async completeSale(input: CreatePharmacySaleInput, cashierId: number, trx?: PharmacyUnitOfWork, prescriptionId?: string): Promise<PharmacySaleReceipt> {
          if(trx)return this.completeSaleInTransaction(input,cashierId,trx,prescriptionId);
          return this.saleRepository.withTransaction((unitOfWork) => this.completeSaleInTransaction(input, cashierId, unitOfWork));
     }

     async holdSale(input: HoldPharmacySaleInput, cashierId: number): Promise<PharmacyHeldSale> {
          if(!this.branchId)throw new Error('Select an operating branch before holding a sale');
          if (!input.lines?.length) throw new Error('A held sale requires at least one line');
          if (new Set(input.lines.map((line) => line.inventoryItemId)).size !== input.lines.length) throw new Error('Duplicate inventory items are not allowed');
          const selectedType=pharmacyTransactionPriceType(input);
          if(input.lines.length>100||input.lines.some(line=>!Number.isFinite(line.quantity)||line.quantity<=0||quantity(line.quantity)!==line.quantity))throw new Error('Select up to 100 items with valid quantities');
          if(input.idempotencyKey&&!/^[A-Za-z0-9:_-]{8,128}$/.test(input.idempotencyKey))throw new Error('Invalid suspension request key');
          const hash=createHash('sha256').update(JSON.stringify({branch:this.branchId,actor:cashierId,input})).digest('hex');

          return this.saleRepository.withTransaction(async (unitOfWork) => {
               if(input.idempotencyKey){const previous=await this.saleRepository.findSuspension(input.idempotencyKey,unitOfWork);if(previous){if(previous.hash!==hash)throw new Error('Suspension retry does not match the original request');return previous.result;}}
               const original=input.heldSaleId?await this.saleRepository.lockHeldSale(input.heldSaleId,unitOfWork):null;
               if(input.heldSaleId&&!original)throw new Error('This suspended sale is no longer available. Refresh suspended sales');
               const itemIds = input.lines.map((line) => line.inventoryItemId);
               const items = await this.saleRepository.lockSellableItems(itemIds, unitOfWork);
               if (items.length !== itemIds.length) throw new Error('One or more pharmacy items are unavailable');

               const itemsById = new Map(items.map((item) => [item.id, item]));
               const now = new Date();
               const heldSaleId = original?.id||randomUUID();
               let total = 0;
               const lines: PharmacySaleLineRow[] = input.lines.map((requested) => {
                    const item = itemsById.get(requested.inventoryItemId)!;
                    if (!Number.isFinite(requested.quantity) || requested.quantity <= 0) throw new Error('Sale quantities must be positive');
                    const unitPrice=pharmacyUnitPrice(item,selectedType);
                    const lineTotal = money(new Decimal(unitPrice).mul(requested.quantity));
                    const lineCost = money(new Decimal(item.costPrice).mul(requested.quantity));
                    total += lineTotal;
                    return { id: randomUUID(), saleId: heldSaleId, inventoryItemId: item.id, name: item.name, sku: item.sku, quantity: requested.quantity, unitPrice, priceType:selectedType, lineTotal, unitCost: item.costPrice, lineCost, grossProfit: lineTotal - lineCost };
               });
               const sale = {
                    id: heldSaleId,
                    holdNumber: original?.holdNumber||`HOLD-${heldSaleId}`,
                    customerName: input.customerName?.trim() || 'Walk-in customer',
                    patientId: input.patientId || null,
                    totalAmount: money(total),
                    cashierId,
                    createdAt: original?.createdAt||now,
                    updatedAt: now
               };
               if(original)await this.saleRepository.replaceHeldSale(sale,lines,unitOfWork);
               else await this.saleRepository.insertHeldSale(sale, lines, unitOfWork);
               const result=this.toHeldSale(sale,lines);
               if(input.idempotencyKey)await this.saleRepository.recordSuspension(input.idempotencyKey,hash,result,cashierId,unitOfWork);
               return result;
          });
     }

     async getHeldSales(page: number, count: number, search?: string) {
          const safePage = Math.max(1, page);
          const safeCount = Math.min(100, Math.max(1, count));
          const result = await this.saleRepository.listHeldSales(safePage, safeCount, search);
          const sales = await Promise.all(result.sales.map(async (sale) => this.toHeldSale(sale, await this.saleRepository.findHeldSaleLines(sale.id))));
          return { sales, total: result.total, page: safePage, count: safeCount, totalPages: Math.max(1, Math.ceil(result.total / safeCount)) };
     }

     async getHeldSale(heldSaleId: string): Promise<PharmacyHeldSale> {
          const result = await this.saleRepository.listHeldSales(1, 1, heldSaleId);
          const sale = result.sales.find((candidate) => candidate.id === heldSaleId || candidate.holdNumber === heldSaleId);
          if (!sale) throw new Error('Held sale not found');
          return this.toHeldSale(sale, await this.saleRepository.findHeldSaleLines(sale.id));
     }

     async completeHeldSale(heldSaleId: string, input: CompleteHeldPharmacySaleInput, cashierId: number): Promise<PharmacySaleReceipt> {
          validateSaleInput(input);
          return this.saleRepository.withTransaction(async (unitOfWork) => {
               const existing=await this.saleRepository.findSaleByIdempotencyKey(input.idempotencyKey,unitOfWork);
               if(existing) {
                    if(existing.branchid!==this.branchId || existing.heldSaleId!==heldSaleId || existing.requestHash!==saleRequestHash(input,cashierId))throw new Error('Checkout retry does not match the original request');
                    return this.toReceipt(existing,unitOfWork);
               }
               const heldSale = await this.saleRepository.lockHeldSale(heldSaleId, unitOfWork);
               if (!heldSale) throw new Error('Held sale not found');
               const heldLines = await this.saleRepository.findHeldSaleLines(heldSaleId, unitOfWork);
               const receipt = await this.completeSaleInTransaction({
                    ...input,
                    customerName: input.customerName || heldSale.customerName,
                    patientId: input.patientId ?? heldSale.patientId,
                    lines: input.lines?.length ? input.lines : heldLines.map((line) => ({ inventoryItemId: line.inventoryItemId, quantity: line.quantity,priceType:line.priceType }))
               }, cashierId, unitOfWork, undefined, heldSaleId);
               await this.saleRepository.deleteHeldSale(heldSaleId, unitOfWork);
               return receipt;
          });
     }

     async deleteHeldSale(heldSaleId: string): Promise<void> {
          await this.saleRepository.withTransaction(async (unitOfWork) => {
               const heldSale = await this.saleRepository.lockHeldSale(heldSaleId, unitOfWork);
               if (!heldSale) throw new Error('Held sale not found');
               await this.saleRepository.deleteHeldSale(heldSaleId, unitOfWork);
          });
     }

     private async completeSaleInTransaction(input: CreatePharmacySaleInput, cashierId: number, unitOfWork: PharmacyUnitOfWork, prescriptionId?: string, heldSaleId?: string): Promise<PharmacySaleReceipt> {
          validateSaleInput(input);
          if (!Number.isInteger(this.branchId) || Number(this.branchId)<=0)throw new Error('Select an operating branch before checkout');
          const requestHash=saleRequestHash(input,cashierId,prescriptionId);
          if (!input.idempotencyKey || !input.lines?.length) throw new Error('A sale requires an idempotency key and at least one line');
          if (new Set(input.lines.map((line) => line.inventoryItemId)).size !== input.lines.length) throw new Error('Duplicate inventory items are not allowed');

          const existing = await this.saleRepository.findSaleByIdempotencyKey(input.idempotencyKey, unitOfWork);
          if (existing) {
               if(existing.requestHash!==requestHash || existing.branchid!==this.branchId)throw new Error('Checkout retry does not match the original request');
               return this.toReceipt(existing,unitOfWork);
          }

          const itemIds = input.lines.map((line) => line.inventoryItemId);
          const items = await this.saleRepository.lockSellableItems(itemIds, unitOfWork);
          if (items.length !== itemIds.length) throw new Error('One or more pharmacy items are unavailable');

          const itemsById = new Map(items.map((item) => [item.id, item]));
          const now = new Date();
          const saleId = randomUUID();
          const lines: PharmacySaleLineRow[] = [];
          let total = 0;
          let totalCost = 0;

          for (const requested of input.lines) {
               const item = itemsById.get(requested.inventoryItemId)!;
               if (!Number.isFinite(requested.quantity) || requested.quantity <= 0) throw new Error('Sale quantities must be positive');
               const unitPrice=pharmacyUnitPrice(item,requested.priceType??input.priceType);
               if(item.requiresPrescription && !prescriptionId)throw new Error(`${item.name} requires a prescription; dispense it from the prescription queue`);
               if (item.currentStock < requested.quantity) throw new Error(`${item.name} has insufficient stock`);

               const lineTotal = money(new Decimal(unitPrice).mul(requested.quantity));
               const lineCost = money(new Decimal(item.costPrice).mul(requested.quantity));
               total += lineTotal;
               totalCost += lineCost;
               lines.push({
                    id: randomUUID(),
                    saleId,
                    inventoryItemId: item.id,
                    name: item.name,
                    sku: item.sku,
                    quantity: requested.quantity,
                    unitPrice, priceType:requested.priceType??input.priceType??'retail',
                    lineTotal,
                    unitCost: item.costPrice,
                    lineCost,
                    grossProfit: lineTotal - lineCost
               });
          }

          if(input.expectedTotal!=null && (!Number.isFinite(input.expectedTotal)||money(total)!==input.expectedTotal))throw new Error('Prices changed. Refresh the item prices and review the total before paying');
          if (money(total) <= 0) throw new Error('A sale must have a positive total');
          const composite=['split','credit'].includes(input.paymentMethod),tender=composite?pharmacySettlement(money(total),input):pharmacyTender(money(total), input.paymentMethod, input.amountTendered);
          const sale: PharmacySaleRow = {
               id: saleId,
               receiptNumber: `PHM-${saleId}`,
               requestHash, prescriptionId, heldSaleId, branchid:this.branchId, accountingVersion:composite?3:2, ...tender,settlementJson:composite?JSON.stringify(tender):null,customerAccountId:input.customerAccountId||null,
               idempotencyKey: input.idempotencyKey,
               customerName: input.customerName?.trim() || 'Walk-in customer',
               patientId: input.patientId || null,
               paymentMethod: input.paymentMethod,
               paymentReference: input.paymentReference?.trim() || null,
               totalAmount: money(total),
               totalCost: money(totalCost),
               grossProfit: money(new Decimal(total).minus(totalCost)),
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

          await this.saleRepository.collectPayment(sale,unitOfWork);
          return this.toReceipt(sale,unitOfWork);
     }

     async getSalesHistory(request: PharmacySaleHistoryRequest): Promise<PharmacySaleHistory> {
          const safePage = Math.max(1, request.page);
          const safeCount = Math.min(100, Math.max(1, request.count));
          const { sales, total } = await this.saleRepository.listSales({
               page: safePage,
               count: safeCount,
               search: request.search,
               statuses: request.statuses,
               reversalType: request.reversalType, dateFrom:request.dateFrom,dateTo:request.dateTo,paymentMethod:request.paymentMethod,minTotal:request.minTotal,maxTotal:request.maxTotal
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
               paymentAccountId:Number(sale.accountingVersion)>=2?sale.paymentAccountId:undefined,branchid:sale.branchid,
               amountTendered: sale.amountTendered, change: sale.changeAmount, paidAmount:sale.paidAmount??sale.totalAmount,outstandingAmount:sale.outstandingAmount||0,
               paymentReference: sale.paymentReference,
               patientId: sale.patientId,
               reversedBy: sale.reversedBy,
               lines: lines.map((line) => ({
                    id: line.id,
                    inventoryItemId: line.inventoryItemId,
                    name: line.name,
                    sku: line.sku,
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,priceType:line.priceType,
                    lineTotal: line.lineTotal,
                    unitCost: line.unitCost,
                    lineCost: line.lineCost,
                    grossProfit: line.grossProfit
               }))
          };
     }

     async reverseSale(saleId: string, input: ReversePharmacySaleInput, actorId: number): Promise<PharmacySaleReversal> {
          if(!['restock','quarantine','not_returned'].includes(input?.disposition))throw new Error('Choose what happened to the goods: restock, quarantine or not returned');
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

               for (const line of [...lines].sort((a,b)=>a.inventoryItemId.localeCompare(b.inventoryItemId))) {
                    if(input.disposition!=='restock')continue;
                    await this.saleRepository.assertReturnable(sale,line.inventoryItemId,unitOfWork);
                    const item = await this.saleRepository.lockItem(line.inventoryItemId, unitOfWork);
                    if (!item)throw new Error('Original inventory item is missing; quarantine the return');
                    if (item) {
                         await this.applyStockChange(item, line.quantity, {
                              direction: 'return',
                              reason: `Pharmacy sale ${input.type}: ${reason}`,
                              sale,
                              performedBy: actorId,
                              occurredAt: now,
                              unitCost:line.unitCost,
                              unitOfWork
                         });
                    }
                    restockedItems.push({ inventoryItemId: line.inventoryItemId, name: line.name, quantity: line.quantity });
               }

               await this.saleRepository.reversePayment(sale,actorId,reason,input.disposition,unitOfWork);
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
          item: { id: string; currentStock: number; minimumStock: number; costPrice: number },
          delta: number,
          context: {
               direction: 'issue' | 'return';
               reason: string;
               sale: PharmacySaleRow;
               performedBy: number;
               occurredAt: Date;
               unitOfWork: PharmacyUnitOfWork;
               unitCost?: number;
          }
     ): Promise<void> {
          const previousStock = item.currentStock;
          const newStock = quantity(previousStock + delta);

          await this.saleRepository.applyStockLevel(
               item.id,
               newStock,
               resolveStockStatus(newStock, item.minimumStock),
               context.occurredAt,
               context.unitOfWork,
               delta>0&&newStock>0 ? new Decimal(previousStock).mul(item.costPrice).plus(new Decimal(delta).mul(context.unitCost??item.costPrice)).div(newStock).toDecimalPlaces(6).toNumber() : undefined
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
               occurredAt: context.occurredAt,
               unitCost: context.unitCost ?? item.costPrice,
               totalCost: money(new Decimal(context.unitCost ?? item.costPrice).mul(Math.abs(delta)))
          }, context.unitOfWork);
     }

     private toHistoryItem(sale: PharmacySaleRow): PharmacySaleHistoryItem {
          return {
               accountingVersion: sale.accountingVersion || 1,
               id: sale.id,
               receiptNumber: sale.receiptNumber,
               customerName: sale.customerName,
               paymentMethod: sale.paymentMethod as PharmacyPaymentMethod,
               total: sale.totalAmount,
               totalCost: sale.totalCost,
               grossProfit: sale.grossProfit,
               status: sale.status,
               completedAt: sale.completedAt,
               cashierId: sale.cashierId,
               reversalType: (sale.reversalType as PharmacySaleReversalType) || null,
               reversalReason: sale.reversalReason,
               reversedAt: sale.reversedAt
          };
     }

     private async toReceipt(sale: PharmacySaleRow, unitOfWork?: PharmacyUnitOfWork): Promise<PharmacySaleReceipt> {
          return {
               id: sale.id,
               branchId: sale.branchid ?? undefined, cashierId: sale.cashierId,
               receiptNumber: sale.receiptNumber,
               total: sale.totalAmount,
               amountTendered:sale.amountTendered, change:sale.changeAmount, paymentReference:sale.paymentReference,paidAmount:sale.paidAmount??sale.totalAmount,outstandingAmount:sale.outstandingAmount||0,
               customerName:sale.customerName,
               lines:await this.saleRepository.findSaleLines(sale.id,unitOfWork),
               paymentMethod: sale.paymentMethod as PharmacyPaymentMethod,
               completedAt: sale.completedAt as Date
          };
     }

     private toHeldSale(sale: { id: string; holdNumber: string; customerName: string; patientId: number | null; totalAmount: number; cashierId: number; createdAt: Date }, lines: PharmacySaleLineRow[]): PharmacyHeldSale {
          return {
               id: sale.id,
               holdNumber: sale.holdNumber,
               customerName: sale.customerName,
               patientId: sale.patientId,
               total: sale.totalAmount,
               cashierId: sale.cashierId,
               createdAt: sale.createdAt,
               lines: lines.map((line) => ({ id: line.id, inventoryItemId: line.inventoryItemId, name: line.name, sku: line.sku, quantity: line.quantity, priceType:line.priceType, retailPrice:line.retailPrice,wholesalePrice:line.wholesalePrice,availableStock:line.availableStock,dispensableStock:line.dispensableStock, unitPrice: line.unitPrice, lineTotal: line.lineTotal, unitCost: line.unitCost, lineCost: line.lineCost, grossProfit: line.grossProfit }))
          };
     }
}
