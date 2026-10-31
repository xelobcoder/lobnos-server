import { expiredInventoryBatchQuery } from './InventoryBatchQuery';
import { Knex } from 'knex';
import { randomUUID } from 'crypto';
import { z } from 'zod';

export const inventoryTransactionSchema = z.object({
     item_id: z.string().trim().min(1),
     transaction_type: z.enum(['addition', 'consumption', 'adjustment', 'transfer', 'wastage']),
     quantity: z.number().finite().positive(),
     unit_type: z.enum(['consumption', 'purchase']).default('consumption'),
     units_per_purchase_unit: z.number().finite().positive().optional(),
     unit_cost: z.number().finite().nonnegative().optional(),
}).passthrough();
import {
     InventoryTransaction,
     CreateInventoryTransactionRequest,
     InventoryTransactionListResponse,
     InventoryTransactionFilters
} from './types';
import KnexConnection from '../../database/KnexConnections';
import { UnitValidationService } from '../../services/UnitValidationService';
import { NotificationDispatcher } from '../application/notifications/services/NotificationDispatcher';
import { enqueueStockMovement } from '../../accountingModule/integrations/InventoryAccounting';

export class InventoryTransactionModel {
     private connection: Promise<Knex<any, any[]>>;
     private tenantId: number;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
     }

     private dispatchStockThresholdAlerts(
          itemId: string,
          newStock: number,
          minStock: number,
          previousStock: number,
          performedBy?: number | null,
     ) {
          const actor = performedBy ? Number(performedBy) : undefined;
          const refs = { inventoryId: itemId };
          if (newStock <= 0) {
               NotificationDispatcher.dispatch(this.tenantId, 'STOCK_OUT_OF_STOCK', refs, actor).catch(() => { });
               return;
          }
          if (typeof minStock === 'number' && minStock > 0 && newStock <= minStock) {
               // Treat half of min as critical when possible.
               if (newStock <= Math.max(1, Math.floor(minStock / 2))) {
                    NotificationDispatcher.dispatch(this.tenantId, 'STOCK_CRITICAL', refs, actor).catch(() => { });
               } else {
                    NotificationDispatcher.dispatch(this.tenantId, 'STOCK_LOW', refs, actor).catch(() => { });
               }
          }
          if (previousStock <= (minStock || 0) && newStock > (minStock || 0)) {
               NotificationDispatcher.dispatch(this.tenantId, 'STOCK_RESTOCKED', refs, actor).catch(() => { });
          }
     }

     private dispatchTransactionLifecycle(
          request: CreateInventoryTransactionRequest,
          itemId: string,
     ) {
          const actor = request.performed_by ? Number(request.performed_by) : undefined;
          const refs = { inventoryId: itemId };
          const type = String(request.transaction_type || '').toLowerCase();
          if (type === 'adjustment') {
               NotificationDispatcher.dispatch(this.tenantId, 'STOCK_ADJUSTED', refs, actor).catch(() => { });
          } else if (type === 'transfer') {
               NotificationDispatcher.dispatch(this.tenantId, 'STOCK_TRANSFER_COMPLETED', refs, actor).catch(() => { });
          } else if (type === 'addition') {
               NotificationDispatcher.dispatch(this.tenantId, 'STOCK_RECEIPT_COMPLETED', refs, actor).catch(() => { });
          } else if (type === 'consumption') {
               NotificationDispatcher.dispatch(this.tenantId, 'STOCK_ISSUED', refs, actor).catch(() => { });
          } else if (type === 'wastage' || type === 'return') {
               NotificationDispatcher.dispatch(this.tenantId, type === 'return' ? 'STOCK_RETURNED' : 'STOCK_ADJUSTED', refs, actor).catch(() => { });
          }
     }

     async create(request: CreateInventoryTransactionRequest): Promise<InventoryTransaction> {
          const [transaction] = await this.createBulk([request]);
          return transaction;
     }

     async createBulk(requests: CreateInventoryTransactionRequest[], parentTransaction?: Knex.Transaction): Promise<InventoryTransaction[]> {
          if (!Array.isArray(requests) || requests.length === 0) throw new Error('At least one transaction is required');
          const transactions = requests.map(request => inventoryTransactionSchema.parse(request) as CreateInventoryTransactionRequest);
          const connection = await this.connection;
          const alerts: Array<{ request: CreateInventoryTransactionRequest; previous: number; next: number; minimum: number }> = [];
          const created = await (parentTransaction || connection).transaction(async trx => {
               // Lock in a stable order so overlapping bulk requests do not deadlock.
               const items = await trx('inv_inventory_items').whereIn('id', [...new Set(transactions.map(r => r.item_id))].sort())
                    .where('is_active', true).orderBy('id').forUpdate();
               const byId = new Map<string, any>(items.map(item => [item.id, item]));
               const results: InventoryTransaction[] = [];
               for (const request of transactions) {
                    const item = byId.get(request.item_id);
                    if (!item) throw new Error('Inventory item not found or inactive: ' + request.item_id);
                    if (item.inventory_domain === 'pharmacy') throw new Error('Legacy pharmacy stock is read-only; use pharmacy inventory');
                    const validation = UnitValidationService.validateTransactionUnitConversion(
                         request.unit_type, request.purchase_unit || null, item.consumption_unit,
                         request.units_per_purchase_unit ?? null
                    );
                    if (!validation.isValid) throw new Error(validation.error);
                    const quantity = request.quantity * (request.unit_type === 'purchase' ? request.units_per_purchase_unit! : 1);
                    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Invalid converted quantity');
                    const previous = Number(item.current_stock);
                    if(['consumption','wastage','transfer','adjustment'].includes(request.transaction_type) && quantity>previous-Number(item.department_reserved_qty||0))throw new Error('Stock is allocated to a department; record usage from departmental stock');
                    const next = previous + (request.transaction_type === 'addition' ? quantity : -quantity);
                    if (!Number.isFinite(previous) || !Number.isFinite(next) || next < 0) throw new Error('Transaction would result in invalid or negative stock: ' + request.item_id);
                    const totalCost = request.unit_cost !== undefined
                         ? request.unit_cost * request.quantity : Number(item.cost_price || 0) * quantity;
                    if (!Number.isFinite(totalCost) || totalCost < 0) throw new Error('Invalid transaction cost');
                    const now = new Date();
                    const data = {
                         id: 'TXN-' + randomUUID(), item_id: request.item_id,
                         transaction_type: request.transaction_type, quantity: request.quantity,
                         unit_type: request.unit_type, purchase_unit: request.purchase_unit || null,
                         units_per_purchase_unit: request.units_per_purchase_unit ?? null,
                         previous_stock: previous, new_stock: next,
                         batch_number: request.batch_number || null, expiry_date: request.expiry_date || null,
                         unit_cost: request.unit_cost ?? null, total_cost: totalCost,
                         brand_name: request.brand_name || null, reason: request.reason || null,
                         reference_id: request.reference_id || null, patientid: request.patientid || null,
                         ascensionid: request.ascensionid || null, performed_by: request.performed_by || null,
                         transaction_date: now, notes: request.notes || null,
                         wastage_type: request.wastage_type || null, created_at: now
                    };
                    await trx('inv_inventory_transactions').insert(data);
                    await trx('inv_inventory_items').where('id', request.item_id).update({
                         current_stock: next, status: next === 0 ? 'out_of_stock' : next <= Number(item.min_stock || 0) ? 'low_stock' : 'in_stock',
                         last_updated: now, updated_at: now
                    });
                    await enqueueStockMovement(this.tenantId, data, trx);
                    item.current_stock = next;
                    results.push({ ...data, item_name: item.name, item_sku: item.sku } as any);
                    alerts.push({ request, previous, next, minimum: Number(item.min_stock || 0) });
               }
               return results;
          });
          const dispatchAlerts = () => {
               for (const alert of alerts) {
                    this.dispatchTransactionLifecycle(alert.request, alert.request.item_id);
                    this.dispatchStockThresholdAlerts(alert.request.item_id, alert.next, alert.minimum, alert.previous, alert.request.performed_by);
               }
          };
          if (parentTransaction) void parentTransaction.executionPromise.then(dispatchAlerts, () => undefined);
          else dispatchAlerts();
          return created;
     }

     async findById(id: string): Promise<InventoryTransaction | null> {
          const connection = await this.connection;

          const result = await connection('inv_inventory_transactions')
               .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
               .select(
                    'inv_inventory_transactions.*',
                    'inv_inventory_items.name as item_name',
                    'inv_inventory_items.sku as item_sku'
               )
               .where('inv_inventory_transactions.id', id)
               .first();

          if (!result) return null;

          return {
               id: result.id,
               item_id: result.item_id,
               transaction_type: result.transaction_type,
               quantity: result.quantity,
               unit_type: result.unit_type,
               previous_stock: result.previous_stock,
               new_stock: result.new_stock,
               batch_number: result.batch_number,
               expiry_date: result.expiry_date,
               unit_cost: result.unit_cost ? parseFloat(result.unit_cost) : null,
               total_cost: result.total_cost ? parseFloat(result.total_cost) : null,
               brand_name: result.brand_name,
               reason: result.reason,
               reference_id: result.reference_id,
               patientid: result.patientid,
               ascensionid: result.ascensionid,
               performed_by: result.performed_by,
               transaction_date: result.transaction_date,
               notes: result.notes,
               wastage_type: result.wastage_type,
               created_at: result.created_at,
               item_name: result.item_name,
               item_sku: result.item_sku
          };
     }

     async findByItemId(itemId: string, filters?: InventoryTransactionFilters): Promise<InventoryTransactionListResponse> {
          const connection = await this.connection;
          const {
               page = 1,
               count = 10,
               sortby = 'DESC',
               transaction_type,
               startDate,
               endDate,
               performed_by,
               batch_number
          } = filters || {};

          let query = connection('inv_inventory_transactions')
               .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
               .select(
                    'inv_inventory_transactions.*',
                    'inv_inventory_items.name as item_name',
                    'inv_inventory_items.sku as item_sku'
               )
               .where('inv_inventory_transactions.item_id', itemId)
               .orderBy('inv_inventory_transactions.transaction_date', sortby);

          if (transaction_type) {
               query = query.where('inv_inventory_transactions.transaction_type', transaction_type);
          }
          if (performed_by) {
               query = query.where('inv_inventory_transactions.performed_by', performed_by);
          }
          if (batch_number) {
               query = query.where('inv_inventory_transactions.batch_number', batch_number);
          }
          if (startDate) {
               query = query.where('inv_inventory_transactions.transaction_date', '>=', startDate);
          }
          if (endDate) {
               query = query.where('inv_inventory_transactions.transaction_date', '<=', endDate);
          }

          const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
          const totalResult = await totalQuery;
          const total = parseInt(totalResult?.count as string) || 0;

          const offset = (page - 1) * count;
          const rawData = await query.limit(count).offset(offset);

          const transactions = rawData.map((result: any) => ({
               id: result.id,
               item_id: result.item_id,
               transaction_type: result.transaction_type,
               quantity: result.quantity,
               previous_stock: result.previous_stock,
               new_stock: result.new_stock,
               batch_number: result.batch_number,
               expiry_date: result.expiry_date,
               unit_cost: result.unit_cost ? parseFloat(result.unit_cost) : null,
               total_cost: result.total_cost ? parseFloat(result.total_cost) : null,
               brand_name: result.brand_name,
               reason: result.reason,
               reference_id: result.reference_id,
               patientid: result.patientid,
               ascensionid: result.ascensionid,
               performed_by: result.performed_by,
               transaction_date: result.transaction_date,
               notes: result.notes,
               wastage_type: result.wastage_type,
               created_at: result.created_at,
               item_name: result.item_name,
               item_sku: result.item_sku
          }));

          return {
               transactions,
               total,
               page,
               count,
               totalPages: Math.ceil(total / count),
               sortby
          };
     }

     async findMany(filters: InventoryTransactionFilters): Promise<InventoryTransactionListResponse> {
          const connection = await this.connection;
          const {
               page = 1,
               count = 10,
               sortby = 'DESC',
               item_id,
               transaction_type,
               startDate,
               endDate,
               performed_by,
               batch_number
          } = filters;

          let query = connection('inv_inventory_transactions')
               .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
               .select(
                    'inv_inventory_transactions.*',
                    'inv_inventory_items.name as item_name',
                    'inv_inventory_items.sku as item_sku'
               )
               .orderBy('inv_inventory_transactions.transaction_date', sortby);

          if (item_id) {
               query = query.where('inv_inventory_transactions.item_id', item_id);
          }
          if (transaction_type) {
               query = query.where('inv_inventory_transactions.transaction_type', transaction_type);
          }
          if (performed_by) {
               query = query.where('inv_inventory_transactions.performed_by', performed_by);
          }
          if (batch_number) {
               query = query.where('inv_inventory_transactions.batch_number', batch_number);
          }
          if (startDate) {
               query = query.where('inv_inventory_transactions.transaction_date', '>=', startDate);
          }
          if (endDate) {
               query = query.where('inv_inventory_transactions.transaction_date', '<=', endDate);
          }

          const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
          const totalResult = await totalQuery;
          const total = parseInt(totalResult?.count as string) || 0;

          const offset = (page - 1) * count;
          const rawData = await query.limit(count).offset(offset);

          const transactions = rawData.map((result: any) => ({
               id: result.id,
               item_id: result.item_id,
               transaction_type: result.transaction_type,
               quantity: result.quantity,
               previous_stock: result.previous_stock,
               new_stock: result.new_stock,
               batch_number: result.batch_number,
               expiry_date: result.expiry_date,
               unit_cost: result.unit_cost ? parseFloat(result.unit_cost) : null,
               total_cost: result.total_cost ? parseFloat(result.total_cost) : null,
               brand_name: result.brand_name,
               reason: result.reason,
               reference_id: result.reference_id,
               patientid: result.patientid,
               ascensionid: result.ascensionid,
               performed_by: result.performed_by,
               transaction_date: result.transaction_date,
               notes: result.notes,
               wastage_type: result.wastage_type,
               created_at: result.created_at,
               item_name: result.item_name,
               item_sku: result.item_sku
          }));

          return {
               transactions,
               total,
               page,
               count,
               totalPages: Math.ceil(total / count),
               sortby
          };
     }

     async getItemStockHistory(itemId: string, options: { days?: number; startDate?: string; endDate?: string; type?: string; page?: number; count?: number } = {}): Promise<{ transactions: InventoryTransaction[], total: number }> {
          const connection = await this.connection;
          const { days = 30, startDate, endDate, type, page = 1, count = 10 } = options;

          // Get total count first
          let countQuery = connection('inv_inventory_transactions')
               .where('inv_inventory_transactions.item_id', itemId);

          // Apply date filtering to count query
          if (startDate && endDate) {
               countQuery = countQuery.whereBetween('inv_inventory_transactions.transaction_date', [startDate, endDate + ' 23:59:59']);
          } else if (startDate) {
               countQuery = countQuery.where('inv_inventory_transactions.transaction_date', '>=', startDate);
          } else if (endDate) {
               countQuery = countQuery.where('inv_inventory_transactions.transaction_date', '<=', endDate + ' 23:59:59');
          } else {
               // Default to days filter if no specific dates provided
               const defaultStartDate = new Date();
               defaultStartDate.setDate(defaultStartDate.getDate() - days);
               countQuery = countQuery.where('inv_inventory_transactions.transaction_date', '>=', defaultStartDate.toISOString());
          }

          // Apply type filtering to count query
          if (type) {
               countQuery = countQuery.where('inv_inventory_transactions.transaction_type', type);
          }

          const totalResult = await countQuery.count('* as count').first();
          const total = parseInt(totalResult?.count as string) || 0;
          let query = connection('inv_inventory_transactions')
               .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
               .leftJoin('roles', 'inv_inventory_transactions.performed_by', 'roles.employeeid')
               .select(
                    'inv_inventory_transactions.*',
                    'inv_inventory_items.name as item_name',
                    'inv_inventory_items.sku as item_sku',
                    'roles.username as employee_username',
                    'roles.email as employee_email',
                    'roles.role as employee_role'
               )
               .where('inv_inventory_transactions.item_id', itemId);

          // Apply date filtering
          if (startDate && endDate) {
               query = query.whereBetween('inv_inventory_transactions.transaction_date', [startDate, endDate + ' 23:59:59']);
          } else if (startDate) {
               query = query.where('inv_inventory_transactions.transaction_date', '>=', startDate);
          } else if (endDate) {
               query = query.where('inv_inventory_transactions.transaction_date', '<=', endDate + ' 23:59:59');
          } else {
               // Default to days filter if no specific dates provided
               const defaultStartDate = new Date();
               defaultStartDate.setDate(defaultStartDate.getDate() - days);
               query = query.where('inv_inventory_transactions.transaction_date', '>=', defaultStartDate.toISOString());
          }

          // Apply type filtering
          if (type) {
               query = query.where('inv_inventory_transactions.transaction_type', type);
          }

          // Apply pagination
          const offset = (page - 1) * count;
          query = query.limit(count).offset(offset);

          const results = await query.orderBy('inv_inventory_transactions.transaction_date', 'ASC');

          const transactions = results.map((result: any) => ({
               id: result.id,
               item_id: result.item_id,
               transaction_type: result.transaction_type,
               quantity: result.quantity,
               previous_stock: result.previous_stock,
               new_stock: result.new_stock,
               batch_number: result.batch_number,
               expiry_date: result.expiry_date,
               unit_cost: result.unit_cost ? parseFloat(result.unit_cost) : null,
               total_cost: result.total_cost ? parseFloat(result.total_cost) : null,
               brand_name: result.brand_name,
               reason: result.reason,
               reference_id: result.reference_id,
               patientid: result.patientid,
               ascensionid: result.ascensionid,
               performed_by: result.performed_by,
               transaction_date: result.transaction_date,
               notes: result.notes,
               wastage_type: result.wastage_type,
               created_at: result.created_at,
               item_name: result.item_name,
               item_sku: result.item_sku,
               employee_username: result.employee_username,
               employee_email: result.employee_email,
               employee_role: result.employee_role
          }));

          return { transactions, total };
     }

     async getBatchTransactions(batchNumber: string): Promise<InventoryTransaction[]> {
          const connection = await this.connection;

          const results = await connection('inv_inventory_transactions')
               .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
               .select(
                    'inv_inventory_transactions.*',
                    'inv_inventory_items.name as item_name',
                    'inv_inventory_items.sku as item_sku'
               )
               .where('inv_inventory_transactions.batch_number', batchNumber)
               .orderBy('inv_inventory_transactions.transaction_date', 'ASC');

          return results.map((result: any) => ({
               id: result.id,
               item_id: result.item_id,
               transaction_type: result.transaction_type,
               quantity: result.quantity,
               previous_stock: result.previous_stock,
               new_stock: result.new_stock,
               batch_number: result.batch_number,
               expiry_date: result.expiry_date,
               unit_cost: result.unit_cost ? parseFloat(result.unit_cost) : null,
               total_cost: result.total_cost ? parseFloat(result.total_cost) : null,
               brand_name: result.brand_name,
               reason: result.reason,
               reference_id: result.reference_id,
               patientid: result.patientid,
               ascensionid: result.ascensionid,
               performed_by: result.performed_by,
               transaction_date: result.transaction_date,
               notes: result.notes,
               wastage_type: result.wastage_type,
               created_at: result.created_at,
               item_name: result.item_name,
               item_sku: result.item_sku
          }));
     }

     async getTransactionSummary(filters?: InventoryTransactionFilters): Promise<{
          total_additions: number;
          total_consumptions: number;
          total_adjustments: number;
          total_transfers: number;
          net_change: number;
     }> {
          const connection = await this.connection;

          let query = connection('inv_inventory_transactions')
               .select(
                    connection.raw('SUM(CASE WHEN transaction_type = "addition" THEN (CAST(new_stock AS DECIMAL(20, 6)) - CAST(previous_stock AS DECIMAL(20, 6))) ELSE 0 END) as total_additions'),
                    connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN (CAST(previous_stock AS DECIMAL(20, 6)) - CAST(new_stock AS DECIMAL(20, 6))) ELSE 0 END) as total_consumptions'),
                    connection.raw('SUM(CASE WHEN transaction_type = "adjustment" THEN (CAST(previous_stock AS DECIMAL(20, 6)) - CAST(new_stock AS DECIMAL(20, 6))) ELSE 0 END) as total_adjustments'),
                    connection.raw('SUM(CASE WHEN transaction_type = "transfer" THEN (CAST(previous_stock AS DECIMAL(20, 6)) - CAST(new_stock AS DECIMAL(20, 6))) ELSE 0 END) as total_transfers'),
                    connection.raw('SUM(CAST(new_stock AS DECIMAL(20, 6)) - CAST(previous_stock AS DECIMAL(20, 6))) as net_change')
               );

          if (filters?.item_id) {
               query = query.where('item_id', filters.item_id);
          }
          if (filters?.startDate) {
               query = query.where('transaction_date', '>=', filters.startDate);
          }
          if (filters?.endDate) {
               query = query.where('transaction_date', '<=', filters.endDate);
          }
          if (filters?.performed_by) {
               query = query.where('performed_by', filters.performed_by);
          }
          if (filters?.batch_number) {
               query = query.where('batch_number', filters.batch_number);
          }

          const result = await query.first() as any;

          return {
               total_additions: Number(result?.total_additions || 0),
               total_consumptions: Number(result?.total_consumptions || 0),
               total_adjustments: Number(result?.total_adjustments || 0),
               total_transfers: Number(result?.total_transfers || 0),
               net_change: Number(result?.net_change || 0)
          };
     }

     async getAvailableStockDetails(itemId: string): Promise<{
          item: any;
          available_batches: Array<{
               batch_number: string;
               brand_name?: string;
               total_received: number;
               total_consumed: number;
               available_quantity: number;
               expiry_date?: string;
               last_received: string;
          }>;
          fifo_batch?: {
               batch_number: string;
               brand_name?: string;
               available_quantity: number;
               expiry_date?: string;
          };
     }> {
          const connection = await this.connection;

          const item = await connection('inv_inventory_items')
               .where('id', itemId)
               .where('is_active', true)
               .first();

          if (!item) {
               throw new Error('Inventory item not found or inactive');
          }

          const batchDetails = await connection('inv_inventory_transactions')
               .select(
                    'batch_number',
                    connection.raw('MAX(brand_name) as brand_name'),
                    connection.raw('MIN(expiry_date) as expiry_date'),
                    connection.raw('SUM(GREATEST(CAST(new_stock AS DECIMAL(20, 6)) - CAST(previous_stock AS DECIMAL(20, 6)), 0)) as total_received'),
                    connection.raw('SUM(GREATEST(CAST(previous_stock AS DECIMAL(20, 6)) - CAST(new_stock AS DECIMAL(20, 6)), 0)) as total_consumed'),
                    connection.raw('MAX(CASE WHEN transaction_type = "addition" THEN transaction_date END) as last_received')
               )
               .where('item_id', itemId)
               .whereNotNull('batch_number')
               .groupBy('batch_number')
               .havingRaw('SUM(GREATEST(CAST(new_stock AS DECIMAL(20, 6)) - CAST(previous_stock AS DECIMAL(20, 6)), 0)) > 0')
               .orderByRaw('MIN(expiry_date) IS NULL ASC').orderByRaw('MIN(expiry_date) ASC').orderBy('last_received', 'ASC');

          const all_batches = batchDetails.map((batch: any) => ({
               batch_number: batch.batch_number,
               brand_name: batch.brand_name,
               total_received: Number(batch.total_received || 0),
               total_consumed: Number(batch.total_consumed || 0),
               available_quantity: Number(batch.total_received || 0) - Number(batch.total_consumed || 0),
               expiry_date: batch.expiry_date,
               last_received: batch.last_received
          }));

          const today = new Date().toISOString().slice(0, 10);
          const available_batches = all_batches.filter(batch => batch.available_quantity > 0 && (!batch.expiry_date || new Date(batch.expiry_date).toISOString().slice(0, 10) >= today));

          const fifo_batch = available_batches.length > 0 ? {
               batch_number: available_batches[0].batch_number,
               brand_name: available_batches[0].brand_name,
               available_quantity: available_batches[0].available_quantity,
               expiry_date: available_batches[0].expiry_date
          } : undefined;

          return {
               item: {
                    id: item.id,
                    name: item.name,
                    sku: item.sku,
                    current_stock: item.current_stock,
                    unit: item.unit
               },
               available_batches,
               fifo_batch
          };
     } async getExpiredBatches(): Promise<Array<{
          item_id: string;
          item_name: string;
          item_sku: string;
          batch_number: string;
          brand_name?: string;
          expiry_date: string;
          available_quantity: number;
          last_received: string;
     }>> {
          const connection = await this.connection;

          const batches = await expiredInventoryBatchQuery(connection).orderBy('expiry_date', 'asc');
          return batches.map((batch: any) => ({
               item_id: batch.item_id, item_name: batch.item_name, item_sku: batch.item_sku,
               batch_number: batch.batch_number, brand_name: batch.brand_name,
               expiry_date: batch.expiry_date, available_quantity: Number(batch.available_quantity), last_received: batch.last_received
          }));
     }
}
