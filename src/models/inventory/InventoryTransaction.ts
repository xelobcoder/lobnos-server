import { Knex } from 'knex';
import {
     InventoryTransaction,
     CreateInventoryTransactionRequest,
     InventoryTransactionListResponse,
     InventoryTransactionFilters,
     TransactionType
} from './types';
import KnexConnection from '../../database/KnexConnections';

export class InventoryTransactionModel {
     private connection: Promise<Knex<any, any[]>>;

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     private generateTransactionId(): string {
          const timestamp = Date.now().toString();
          return `TXN-${timestamp}`;
     }

     async create(request: CreateInventoryTransactionRequest): Promise<InventoryTransaction> {
          const connection = await this.connection;

          // Validate inventory item exists
          const inventoryItem = await connection('inv_inventory_items')
               .where('id', request.item_id)
               .where('is_active', true)
               .first();

          if (!inventoryItem) {
               throw new Error('Inventory item not found or inactive');
          }

          // Get current stock before transaction
          const previousStock = inventoryItem.current_stock;

          // Calculate new stock based on transaction type
          let newStock: number;
          switch (request.transaction_type) {
               case 'addition':
                    newStock = previousStock + request.quantity;
                    break;
               case 'consumption':
               case 'adjustment':
               case 'transfer':
                    newStock = previousStock - request.quantity;
                    break;
               default:
                    throw new Error('Invalid transaction type');
          }

          if (newStock < 0) {
               throw new Error('Transaction would result in negative stock');
          }

          const totalCost = request.unit_cost && request.quantity
               ? request.unit_cost * request.quantity
               : null;

          const transactionData = {
               id: this.generateTransactionId(),
               item_id: request.item_id,
               transaction_type: request.transaction_type,
               quantity: request.quantity,
               previous_stock: previousStock,
               new_stock: newStock,
               batch_number: request.batch_number || null,
               expiry_date: request.expiry_date || null,
               unit_cost: request.unit_cost || null,
               total_cost: totalCost,
               brand_name: request.brand_name || null,
               reason: request.reason || null,
               reference_id: request.reference_id || null,
               patient_id: request.patient_id || null,
               ascension_id: request.ascension_id || null,
               performed_by: request.performed_by || null,
               transaction_date: new Date().toISOString(),
               notes: request.notes || null,
               created_at: new Date().toISOString()
          };

          // Start transaction to ensure data consistency
          const trx = await connection.transaction();

          try {
               console.log(`Creating transaction for item ${request.item_id}:`, {
                    transaction_type: request.transaction_type,
                    quantity: request.quantity,
                    batch_number: request.batch_number,
                    previous_stock: previousStock,
                    new_stock: newStock
               });

               // Insert transaction record
               await trx('inv_inventory_transactions').insert(transactionData);
               console.log(`Transaction inserted with ID: ${transactionData.id}`);

               // Update inventory item stock
               const updateResult = await trx('inv_inventory_items')
                    .where('id', request.item_id)
                    .update({
                         current_stock: newStock,
                         last_updated: new Date().toISOString(),
                         updated_at: new Date().toISOString()
                    });

               console.log(`Stock update result for item ${request.item_id}:`, {
                    rowsAffected: updateResult,
                    newStock: newStock
               });

               await trx.commit();
               console.log(`Transaction committed successfully for item ${request.item_id}`);

               return await this.findById(transactionData.id) as InventoryTransaction;
          } catch (error) {
               console.error(`Transaction failed for item ${request.item_id}:`, error);
               await trx.rollback();
               throw error;
          }
     }

     async createBulk(transactions: CreateInventoryTransactionRequest[]): Promise<InventoryTransaction[]> {
          const connection = await this.connection;
          const trx = await connection.transaction();
          const createdTransactions: InventoryTransaction[] = [];

          try {
               for (const request of transactions) {
                    // Validate inventory item exists
                    const inventoryItem = await trx('inv_inventory_items')
                         .where('id', request.item_id)
                         .where('is_active', true)
                         .first();

                    if (!inventoryItem) {
                         throw new Error(`Inventory item ${request.item_id} not found or inactive`);
                    }

                    const previousStock = inventoryItem.current_stock;

                    // Calculate new stock
                    let newStock: number;
                    switch (request.transaction_type) {
                         case 'addition':
                              newStock = previousStock + request.quantity;
                              break;
                         case 'consumption':
                         case 'adjustment':
                         case 'transfer':
                              newStock = previousStock - request.quantity;
                              break;
                         default:
                              throw new Error('Invalid transaction type');
                    }

                    if (newStock < 0) {
                         throw new Error(`Transaction for item ${request.item_id} would result in negative stock`);
                    }

                    const totalCost = request.unit_cost && request.quantity
                         ? request.unit_cost * request.quantity
                         : null;

                    const transactionData = {
                         id: this.generateTransactionId(),
                         item_id: request.item_id,
                         transaction_type: request.transaction_type,
                         quantity: request.quantity,
                         previous_stock: previousStock,
                         new_stock: newStock,
                         batch_number: request.batch_number || null,
                         expiry_date: request.expiry_date || null,
                         unit_cost: request.unit_cost || null,
                         total_cost: totalCost,
                         brand_name: request.brand_name || null,
                         reason: request.reason || null,
                         reference_id: request.reference_id || null,
                         patient_id: request.patient_id || null,
                         ascension_id: request.ascension_id || null,
                         performed_by: request.performed_by || null,
                         transaction_date: new Date().toISOString(),
                         notes: request.notes || null,
                         created_at: new Date().toISOString()
                    };

                    // Insert transaction record
                    await trx('inv_inventory_transactions').insert(transactionData);

                    // Update inventory item stock
                    await trx('inv_inventory_items')
                         .where('id', request.item_id)
                         .update({
                              current_stock: newStock,
                              last_updated: new Date().toISOString(),
                              updated_at: new Date().toISOString()
                         });

                    createdTransactions.push(await this.findById(transactionData.id) as InventoryTransaction);
               }

               await trx.commit();
               return createdTransactions;
          } catch (error) {
               console.error('Bulk transaction failed:', error);
               await trx.rollback();
               throw error;
          }
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
               previous_stock: result.previous_stock,
               new_stock: result.new_stock,
               batch_number: result.batch_number,
               expiry_date: result.expiry_date,
               unit_cost: result.unit_cost ? parseFloat(result.unit_cost) : null,
               total_cost: result.total_cost ? parseFloat(result.total_cost) : null,
               brand_name: result.brand_name,
               reason: result.reason,
               reference_id: result.reference_id,
               patient_id: result.patient_id,
               ascension_id: result.ascension_id,
               performed_by: result.performed_by,
               transaction_date: result.transaction_date,
               notes: result.notes,
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

          // Apply filters
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
               patient_id: result.patient_id,
               ascension_id: result.ascension_id,
               performed_by: result.performed_by,
               transaction_date: result.transaction_date,
               notes: result.notes,
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

          // Apply filters
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
               patient_id: result.patient_id,
               ascension_id: result.ascension_id,
               performed_by: result.performed_by,
               transaction_date: result.transaction_date,
               notes: result.notes,
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

     async getItemStockHistory(itemId: string, days: number = 30): Promise<InventoryTransaction[]> {
          const connection = await this.connection;

          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);

          const results = await connection('inv_inventory_transactions')
               .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
               .select(
                    'inv_inventory_transactions.*',
                    'inv_inventory_items.name as item_name',
                    'inv_inventory_items.sku as item_sku'
               )
               .where('inv_inventory_transactions.item_id', itemId)
               .where('inv_inventory_transactions.transaction_date', '>=', startDate.toISOString())
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
               patient_id: result.patient_id,
               ascension_id: result.ascension_id,
               performed_by: result.performed_by,
               transaction_date: result.transaction_date,
               notes: result.notes,
               created_at: result.created_at,
               item_name: result.item_name,
               item_sku: result.item_sku
          }));
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
               patient_id: result.patient_id,
               ascension_id: result.ascension_id,
               performed_by: result.performed_by,
               transaction_date: result.transaction_date,
               notes: result.notes,
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
                    connection.raw('SUM(CASE WHEN transaction_type = "addition" THEN quantity ELSE 0 END) as total_additions'),
                    connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) as total_consumptions'),
                    connection.raw('SUM(CASE WHEN transaction_type = "adjustment" THEN quantity ELSE 0 END) as total_adjustments'),
                    connection.raw('SUM(CASE WHEN transaction_type = "transfer" THEN quantity ELSE 0 END) as total_transfers'),
                    connection.raw('SUM(CASE WHEN transaction_type = "addition" THEN quantity WHEN transaction_type IN ("consumption", "adjustment", "transfer") THEN -quantity ELSE 0 END) as net_change')
               );

          // Apply filters
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
               total_additions: parseInt(result?.total_additions || 0),
               total_consumptions: parseInt(result?.total_consumptions || 0),
               total_adjustments: parseInt(result?.total_adjustments || 0),
               total_transfers: parseInt(result?.total_transfers || 0),
               net_change: parseInt(result?.net_change || 0)
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

          console.log(`Getting available stock details for item ${itemId}`);

          // Get item details
          const item = await connection('inv_inventory_items')
               .where('id', itemId)
               .where('is_active', true)
               .first();

          if (!item) {
               throw new Error('Inventory item not found or inactive');
          }

          // Get batch-wise stock details - calculate properly by batch entry
          const batchDetails = await connection('inv_inventory_transactions')
               .select(
                    'batch_number',
                    'brand_name',
                    'expiry_date',
                    connection.raw('SUM(CASE WHEN transaction_type = "addition" THEN quantity ELSE 0 END) as total_received'),
                    connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) as total_consumed'),
                    connection.raw('MAX(CASE WHEN transaction_type = "addition" THEN transaction_date END) as last_received')
               )
               .where('item_id', itemId)
               .whereNotNull('batch_number')
               .groupBy('batch_number', 'brand_name', 'expiry_date')
               .havingRaw('SUM(CASE WHEN transaction_type = "addition" THEN quantity ELSE 0 END) > 0') // Only batches that have received stock
               .orderBy('last_received', 'ASC'); // FIFO order

          const all_batches = batchDetails.map((batch: any) => ({
               batch_number: batch.batch_number,
               brand_name: batch.brand_name,
               total_received: parseInt(batch.total_received || 0),
               total_consumed: parseInt(batch.total_consumed || 0),
               available_quantity: parseInt(batch.total_received || 0) - parseInt(batch.total_consumed || 0),
               expiry_date: batch.expiry_date,
               last_received: batch.last_received
          }));

          console.log(`All batches for item ${itemId}:`, all_batches);

          const available_batches = all_batches.filter(batch => batch.available_quantity > 0); // Only include batches with remaining stock

          console.log(`Available batches for item ${itemId}:`, available_batches);

          // Get FIFO batch (oldest received batch with available stock)
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
     }
}