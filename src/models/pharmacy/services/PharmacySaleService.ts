import { randomUUID } from 'crypto';
import { Knex } from 'knex';
import KnexConnection from '../../../database/KnexConnections';
import { PHARMACY_CATEGORY_NAME } from '../constants/pharmacy.constants';
import { IPharmacySaleService, CreatePharmacySaleInput, PharmacySaleHistory, PharmacySaleReceipt } from '../interfaces/IPharmacySaleService';

export class PharmacySaleService implements IPharmacySaleService {
     private readonly connection: Promise<Knex>;

     constructor(tenantId: number) { this.connection = KnexConnection(tenantId); }

     async completeSale(input: CreatePharmacySaleInput, cashierId: number): Promise<PharmacySaleReceipt> {
          if (!input.idempotencyKey || !input.lines?.length) throw new Error('A sale requires an idempotency key and at least one line');
          if (new Set(input.lines.map((line) => line.inventoryItemId)).size !== input.lines.length) throw new Error('Duplicate inventory items are not allowed');
          const connection = await this.connection;
          return connection.transaction(async (trx) => {
               const existing = await trx('pharmacy_sales').where({ idempotency_key: input.idempotencyKey }).first();
               if (existing) return this.toReceipt(existing);
               const itemIds = input.lines.map((line) => line.inventoryItemId).sort();
               const catalogue = await trx('inv_inventory_items as item')
                    .join('inv_categories as category', 'category.id', 'item.category_id')
                    .select('item.id', 'item.name', 'item.sku', 'item.current_stock', 'item.sale_price')
                    .whereIn('item.id', itemIds).where('item.is_active', true).where('category.name', PHARMACY_CATEGORY_NAME).orderBy('item.id').forUpdate();
               if (catalogue.length !== itemIds.length) throw new Error('One or more pharmacy items are unavailable');
               const catalogueById = new Map(catalogue.map((item: any) => [item.id, item]));
               const total = input.lines.reduce((sum, line) => {
                    if (!Number.isFinite(line.quantity) || line.quantity <= 0) throw new Error('Sale quantities must be positive');
                    const item = catalogueById.get(line.inventoryItemId);
                    if (!Number.isFinite(Number(item.sale_price)) || Number(item.sale_price) <= 0) throw new Error(`${item.name} has no active pharmacy sale price`);
                    if (Number(item.current_stock) < line.quantity) throw new Error(`${item.name} has insufficient stock`);
                    return sum + Number(item.sale_price) * line.quantity;
               }, 0);
               const now = new Date();
               const sale = { id: randomUUID(), receipt_number: `PHM-${Date.now()}`, idempotency_key: input.idempotencyKey, customer_name: input.customerName?.trim() || 'Walk-in customer', patient_id: input.patientId || null, payment_method: input.paymentMethod, payment_reference: input.paymentReference?.trim() || null, total_amount: total, cashier_id: cashierId, status: 'completed', completed_at: now, created_at: now, updated_at: now };
               await trx('pharmacy_sales').insert(sale);
               for (const line of input.lines) {
                    const item: any = catalogueById.get(line.inventoryItemId);
                    const newStock = Number(item.current_stock) - line.quantity;
                    const saleLine = { id: randomUUID(), sale_id: sale.id, inventory_item_id: item.id, item_name_snapshot: item.name, sku_snapshot: item.sku, quantity: line.quantity, unit_price: Number(item.sale_price), line_total: Number(item.sale_price) * line.quantity, created_at: now };
                    await trx('pharmacy_sale_lines').insert(saleLine);
                    await trx('inv_inventory_items').where({ id: item.id }).update({ current_stock: newStock, last_updated: now, updated_at: now });
                    await trx('inv_inventory_transactions').insert({ id: `PHM-TXN-${randomUUID()}`, item_id: item.id, transaction_type: 'consumption', quantity: line.quantity, unit_type: 'consumption', previous_stock: item.current_stock, new_stock: newStock, total_cost: null, reason: 'Pharmacy POS sale', reference_id: sale.id, patientid: sale.patient_id, performed_by: cashierId, transaction_date: now, notes: sale.receipt_number, created_at: now });
               }
               return this.toReceipt(sale);
          });
     }

     async getSalesHistory(page: number, count: number, search?: string): Promise<PharmacySaleHistory> {
          const connection = await this.connection;
          const safePage = Math.max(1, page);
          const safeCount = Math.min(100, Math.max(1, count));
          let query = connection('pharmacy_sales')
               .select('id', 'receipt_number', 'customer_name', 'payment_method', 'total_amount', 'status', 'completed_at', 'cashier_id')
               .orderBy('completed_at', 'desc');
          if (search?.trim()) {
               const term = `%${search.trim()}%`;
               query = query.where((builder) => builder.where('receipt_number', 'like', term).orWhere('customer_name', 'like', term));
          }
          const totalResult = await query.clone().clearSelect().clearOrder().count('* as count').first();
          const total = Number(totalResult?.count || 0);
          const rows = await query.limit(safeCount).offset((safePage - 1) * safeCount);
          return {
               sales: rows.map((sale: any) => ({ id: sale.id, receiptNumber: sale.receipt_number, customerName: sale.customer_name, paymentMethod: sale.payment_method, total: Number(sale.total_amount), status: sale.status, completedAt: sale.completed_at, cashierId: Number(sale.cashier_id) })),
               total,
               page: safePage,
               count: safeCount,
               totalPages: Math.ceil(total / safeCount)
          };
     }

     private toReceipt(sale: any): PharmacySaleReceipt {
          return { id: sale.id, receiptNumber: sale.receipt_number, total: Number(sale.total_amount), paymentMethod: sale.payment_method, completedAt: sale.completed_at };
     }
}