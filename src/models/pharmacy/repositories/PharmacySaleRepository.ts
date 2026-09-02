import { randomUUID } from 'crypto';
import { Knex } from 'knex';
import KnexConnection from '../../../database/KnexConnections';
import { PHARMACY_CATEGORY_NAME } from '../constants/pharmacy.constants';
import { PharmacyStockStatus } from '../entities/PharmacyStock';
import {
     IPharmacySaleRepository,
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
               .join('inv_categories as category', 'category.id', 'item.category_id')
               .select('item.id', 'item.name', 'item.sku', 'item.current_stock', 'item.min_stock', 'item.sale_price')
               .whereIn('item.id', itemIds)
               .where('item.is_active', true)
               .where('category.name', PHARMACY_CATEGORY_NAME)
               .orderBy('item.id')
               .forUpdate();
          return rows.map((row: any) => this.toItemRow(row));
     }

     async lockItem(itemId: string, unitOfWork: PharmacyUnitOfWork): Promise<PharmacySellableItemRow | null> {
          const row = await this.scope(unitOfWork)('inv_inventory_items')
               .select('id', 'name', 'sku', 'current_stock', 'min_stock', 'sale_price')
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
               created_at: new Date()
          })));
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
               total_cost: null,
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
               lineTotal: Number(row.line_total)
          }));
     }

     async listSales(filters: PharmacySaleListFilters): Promise<{ sales: PharmacySaleRow[]; total: number }> {
          const connection = await this.connection;
          let query = connection('pharmacy_sales').orderBy('completed_at', 'desc');
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
               salePrice: Number(row.sale_price || 0)
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
               cashierId: Number(row.cashier_id),
               status: row.status,
               completedAt: row.completed_at || null,
               reversalType: row.reversal_type || null,
               reversalReason: row.reversal_reason || null,
               reversedBy: row.reversed_by ?? null,
               reversedAt: row.reversed_at || null
          };
     }
}
