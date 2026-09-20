import { randomUUID } from 'crypto';
import { Knex } from 'knex';
import KnexConnection from '../../../database/KnexConnections';
import { PharmacyStockStatus } from '../entities/PharmacyStock';
import {
     IPharmacySaleRepository,
     PharmacyHeldSaleRow,
     PharmacySaleLineRow,
     PharmacySaleListFilters,
     PharmacySaleRow,
     PharmacySellableItemRow,
     PharmacyStockMovement,
     PharmacyUnitOfWork
} from '../interfaces/IPharmacySaleRepository';

export class PharmacySaleRepository implements IPharmacySaleRepository {
     private readonly connection: Promise<Knex>;

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async withTransaction<T>(work: (unitOfWork: PharmacyUnitOfWork) => Promise<T>): Promise<T> {
          const connection = await this.connection;
          return connection.transaction(async (trx) => work(trx));
     }

     async findSaleByIdempotencyKey(idempotencyKey: string, unitOfWork: PharmacyUnitOfWork): Promise<PharmacySaleRow | null> {
          const row = await this.scope(unitOfWork)('pharmacy_sales').where({ idempotency_key: idempotencyKey }).first();
          return row ? this.toSaleRow(row) : null;
     }

     async lockSellableItems(itemIds: string[], unitOfWork: PharmacyUnitOfWork): Promise<PharmacySellableItemRow[]> {
          const rows = await this.scope(unitOfWork)('inv_inventory_items as item')
               .select('item.id', 'item.name', 'item.sku', 'item.current_stock', 'item.min_stock', 'item.sale_price', 'item.cost_price')
               .whereIn('item.id', itemIds)
               .where('item.is_active', true)
               .where('item.inventory_domain', 'pharmacy')
               .orderBy('item.id')
               .forUpdate();
          return rows.map((row: any) => this.toItemRow(row));
     }

     async lockItem(itemId: string, unitOfWork: PharmacyUnitOfWork): Promise<PharmacySellableItemRow | null> {
          const row = await this.scope(unitOfWork)('inv_inventory_items')
               .select('id', 'name', 'sku', 'current_stock', 'min_stock', 'sale_price', 'cost_price')
               .where({ id: itemId })
               .forUpdate()
               .first();
          return row ? this.toItemRow(row) : null;
     }

     async lockSale(saleId: string, unitOfWork: PharmacyUnitOfWork): Promise<PharmacySaleRow | null> {
          const row = await this.scope(unitOfWork)('pharmacy_sales').where({ id: saleId }).forUpdate().first();
          return row ? this.toSaleRow(row) : null;
     }

     async insertSale(sale: PharmacySaleRow, unitOfWork: PharmacyUnitOfWork): Promise<void> {
          await this.scope(unitOfWork)('pharmacy_sales').insert({
               id: sale.id,
               receipt_number: sale.receiptNumber,
               idempotency_key: sale.idempotencyKey,
               customer_name: sale.customerName,
               patient_id: sale.patientId,
               payment_method: sale.paymentMethod,
               payment_reference: sale.paymentReference,
               total_amount: sale.totalAmount,
               total_cost: sale.totalCost,
               gross_profit: sale.grossProfit,
               cashier_id: sale.cashierId,
               status: sale.status,
               completed_at: sale.completedAt,
               created_at: sale.completedAt,
               updated_at: sale.completedAt
          });
     }

     async insertSaleLines(lines: PharmacySaleLineRow[], unitOfWork: PharmacyUnitOfWork): Promise<void> {
          if (!lines.length) return;
          await this.scope(unitOfWork)('pharmacy_sale_lines').insert(lines.map((line) => ({
               id: line.id,
               sale_id: line.saleId,
               inventory_item_id: line.inventoryItemId,
               item_name_snapshot: line.name,
               sku_snapshot: line.sku,
               quantity: line.quantity,
               unit_price: line.unitPrice,
               line_total: line.lineTotal,
               unit_cost: line.unitCost,
               line_cost: line.lineCost,
               gross_profit: line.grossProfit,
               created_at: new Date()
          })));
     }

     async insertHeldSale(sale: PharmacyHeldSaleRow, lines: PharmacySaleLineRow[], unitOfWork: PharmacyUnitOfWork): Promise<void> {
          await this.scope(unitOfWork)('pharmacy_held_sales').insert({
               id: sale.id,
               hold_number: sale.holdNumber,
               customer_name: sale.customerName,
               patient_id: sale.patientId,
               total_amount: sale.totalAmount,
               cashier_id: sale.cashierId,
               created_at: sale.createdAt,
               updated_at: sale.updatedAt
          });
          await this.scope(unitOfWork)('pharmacy_held_sale_lines').insert(lines.map((line) => ({
               id: line.id,
               held_sale_id: sale.id,
               inventory_item_id: line.inventoryItemId,
               item_name_snapshot: line.name,
               sku_snapshot: line.sku,
               quantity: line.quantity,
               unit_price: line.unitPrice,
               line_total: line.lineTotal,
               created_at: sale.createdAt
          })));
     }

     async lockHeldSale(heldSaleId: string, unitOfWork: PharmacyUnitOfWork): Promise<PharmacyHeldSaleRow | null> {
          const row = await this.scope(unitOfWork)('pharmacy_held_sales').where({ id: heldSaleId }).forUpdate().first();
          return row ? this.toHeldSaleRow(row) : null;
     }

     async findHeldSaleLines(heldSaleId: string, unitOfWork?: PharmacyUnitOfWork): Promise<PharmacySaleLineRow[]> {
          const scope = unitOfWork ? this.scope(unitOfWork) : await this.connection;
          const rows = await scope('pharmacy_held_sale_lines').where({ held_sale_id: heldSaleId }).orderBy('item_name_snapshot', 'asc');
          return rows.map((row: any) => ({
               id: row.id,
               saleId: row.held_sale_id,
               inventoryItemId: row.inventory_item_id,
               name: row.item_name_snapshot,
               sku: row.sku_snapshot,
               quantity: Number(row.quantity),
               unitPrice: Number(row.unit_price),
               lineTotal: Number(row.line_total),
               unitCost: 0,
               lineCost: 0,
               grossProfit: 0
          }));
     }

     async listHeldSales(page: number, count: number, search?: string): Promise<{ sales: PharmacyHeldSaleRow[]; total: number }> {
          const connection = await this.connection;
          let query = connection('pharmacy_held_sales').orderBy('created_at', 'desc');
          if (search?.trim()) {
               const term = `%${search.trim()}%`;
               query = query.where((builder) => builder.where('id', search.trim()).orWhere('hold_number', 'like', term).orWhere('customer_name', 'like', term));
          }
          const [rows, totalResult] = await Promise.all([
               query.clone().select('*').limit(count).offset((page - 1) * count),
               query.clone().clearOrder().count('* as total').first()
          ]);
          return { sales: rows.map((row: any) => this.toHeldSaleRow(row)), total: Number((totalResult as any)?.total || 0) };
     }

     async deleteHeldSale(heldSaleId: string, unitOfWork?: PharmacyUnitOfWork): Promise<void> {
          const scope = unitOfWork ? this.scope(unitOfWork) : await this.connection;
          await scope('pharmacy_held_sales').where({ id: heldSaleId }).delete();
     }

     async applyStockLevel(itemId: string, newStock: number, status: PharmacyStockStatus, occurredAt: Date, unitOfWork: PharmacyUnitOfWork): Promise<void> {
          await this.scope(unitOfWork)('inv_inventory_items')
               .where({ id: itemId })
               .update({ current_stock: newStock, status, last_updated: occurredAt, updated_at: occurredAt });
     }

     async recordStockMovement(movement: PharmacyStockMovement, unitOfWork: PharmacyUnitOfWork): Promise<void> {
          const isReturn = movement.direction === 'return';
          await this.scope(unitOfWork)('inv_inventory_transactions').insert({
               id: `${isReturn ? 'PHM-REV' : 'PHM-TXN'}-${randomUUID()}`,
               item_id: movement.itemId,
               transaction_type: isReturn ? 'addition' : 'consumption',
               quantity: movement.quantity,
               unit_type: 'consumption',
               previous_stock: movement.previousStock,
               new_stock: movement.newStock,
               unit_cost: movement.unitCost,
               total_cost: movement.totalCost,
               reason: movement.reason,
               reference_id: movement.referenceId,
               patientid: movement.patientId,
               performed_by: movement.performedBy,
               transaction_date: movement.occurredAt,
               notes: movement.receiptNumber,
               created_at: movement.occurredAt
          });
     }

     async markSaleReversed(
          saleId: string,
          reversal: { status: string; type: string; reason: string; actorId: number; occurredAt: Date },
          unitOfWork: PharmacyUnitOfWork
     ): Promise<void> {
          await this.scope(unitOfWork)('pharmacy_sales').where({ id: saleId }).update({
               status: reversal.status,
               reversal_type: reversal.type,
               reversal_reason: reversal.reason,
               reversed_by: reversal.actorId,
               reversed_at: reversal.occurredAt,
               updated_at: reversal.occurredAt
          });
     }

     async findSaleById(saleId: string): Promise<PharmacySaleRow | null> {
          const connection = await this.connection;
          const row = await connection('pharmacy_sales').where({ id: saleId }).first();
          return row ? this.toSaleRow(row) : null;
     }

     async findSaleLines(saleId: string, unitOfWork?: PharmacyUnitOfWork): Promise<PharmacySaleLineRow[]> {
          const scope = unitOfWork ? this.scope(unitOfWork) : await this.connection;
          const rows = await scope('pharmacy_sale_lines').where({ sale_id: saleId }).orderBy('item_name_snapshot', 'asc');
          return rows.map((row: any) => ({
               id: row.id,
               saleId: row.sale_id,
               inventoryItemId: row.inventory_item_id,
               name: row.item_name_snapshot,
               sku: row.sku_snapshot,
               quantity: Number(row.quantity),
               unitPrice: Number(row.unit_price),
               lineTotal: Number(row.line_total),
               unitCost: Number(row.unit_cost || 0),
               lineCost: Number(row.line_cost || 0),
               grossProfit: Number(row.gross_profit || 0)
          }));
     }

     async listSales(filters: PharmacySaleListFilters): Promise<{ sales: PharmacySaleRow[]; total: number }> {
          const connection = await this.connection;
          let query = connection('pharmacy_sales').orderBy('completed_at', 'desc');
          if (filters.statuses?.length) {
               query = query.whereIn('status', filters.statuses);
          }
          if (filters.reversalType) {
               query = query.where('reversal_type', filters.reversalType);
          }
          if (filters.search?.trim()) {
               const term = `%${filters.search.trim()}%`;
               query = query.where((builder) => builder.where('receipt_number', 'like', term).orWhere('customer_name', 'like', term));
          }

          const [rows, totalResult] = await Promise.all([
               query.clone().select('*').limit(filters.count).offset((filters.page - 1) * filters.count),
               query.clone().clearOrder().count('* as total').first()
          ]);

          return { sales: rows.map((row: any) => this.toSaleRow(row)), total: Number((totalResult as any)?.total || 0) };
     }

     private scope(unitOfWork: PharmacyUnitOfWork): Knex.Transaction {
          return unitOfWork as Knex.Transaction;
     }

     private toItemRow(row: any): PharmacySellableItemRow {
          return {
               id: row.id,
               name: row.name,
               sku: row.sku,
               currentStock: Number(row.current_stock || 0),
               minimumStock: Number(row.min_stock || 0),
               salePrice: Number(row.sale_price || 0),
               costPrice: Number(row.cost_price || 0)
          };
     }

     private toSaleRow(row: any): PharmacySaleRow {
          return {
               id: row.id,
               receiptNumber: row.receipt_number,
               idempotencyKey: row.idempotency_key,
               customerName: row.customer_name,
               patientId: row.patient_id ?? null,
               paymentMethod: row.payment_method,
               paymentReference: row.payment_reference || null,
               totalAmount: Number(row.total_amount),
               totalCost: Number(row.total_cost || 0),
               grossProfit: Number(row.gross_profit || 0),
               cashierId: Number(row.cashier_id),
               status: row.status,
               completedAt: row.completed_at || null,
               reversalType: row.reversal_type || null,
               reversalReason: row.reversal_reason || null,
               reversedBy: row.reversed_by ?? null,
               reversedAt: row.reversed_at || null
          };
     }

     private toHeldSaleRow(row: any): PharmacyHeldSaleRow {
          return {
               id: row.id,
               holdNumber: row.hold_number,
               customerName: row.customer_name,
               patientId: row.patient_id ?? null,
               totalAmount: Number(row.total_amount),
               cashierId: Number(row.cashier_id),
               createdAt: row.created_at,
               updatedAt: row.updated_at
          };
     }
}
