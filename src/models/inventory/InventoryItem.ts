import { Knex } from 'knex';
import { randomUUID } from 'crypto';
import {
     InventoryItem,
     CreateInventoryItemRequest,
     UpdateInventoryItemRequest,
     InventoryItemListResponse,
     InventoryFilters,
     InventoryStatus,
     InventorySummary,
     LowStockAlert,
     InventoryUnitInfo,
     StockUpInventoryItemRequest
} from './types';
import KnexConnection from '../../database/KnexConnections';
import { UnitValidationService } from '../../services/UnitValidationService';
import { enqueueGoodsReceipt } from '../../accountingModule/integrations/InventoryAccounting';
import { validatePharmacyReceipt } from '../pharmacy/PharmacyRules';

export class InventoryItemModel {
     private connection: Promise<Knex<any, any[]>>;
     private readonly tenantId: number;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
     }

     private generateItemId(): string {
          const timestamp = Date.now().toString();
          return `INV-${timestamp}`;
     }

     private calculateItemStatus(currentStock: number, minStock: number): InventoryStatus {
          if (currentStock === 0) {
               return 'out_of_stock';
          }

          if (currentStock <= minStock) {
               return 'low_stock';
          }

          return 'in_stock';
     }

     async stockUp(id: string, request: StockUpInventoryItemRequest): Promise<InventoryItem> {
          const connection = await this.connection;
          const quantity = Number(request.quantity);
          const packSize = Number(request.units_per_purchase_unit || 1);
          const packCost = Number(request.unit_price);
          if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Stock quantity must be a whole number greater than zero');
          if (!Number.isInteger(packSize) || packSize <= 0) throw new Error('Pack size must be a whole number greater than zero');
          if (!Number.isFinite(packCost) || packCost < 0) throw new Error('Incoming cost must be zero or greater');
          if (!Number.isInteger(Number(request.received_by)) || Number(request.received_by) <= 0) throw new Error('Receiving employee is required');

          const supplierId = request.supplier_id || 'SUP-GENERAL';
          const now = new Date();
          const reference = randomUUID();
          const orderId = `PO-STOCK-${reference}`;
          const orderItemId = `POI-STOCK-${reference}`;
          const receiptId = `REC-STOCK-${reference}`;
          const batchNumber = request.batch_number?.trim() || `AUTO-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${reference.slice(0, 8).toUpperCase()}`;

          await connection.transaction(async (trx) => {
               const item = await trx('inv_inventory_items').where({ id, is_active: true }).forUpdate().first();
               if (!item) throw new Error('Inventory item not found');
               validatePharmacyReceipt(item,request);
               if(item.inventory_domain==='pharmacy'&&request.batch_number) {
                    const prior=await trx('inv_inventory_transactions').where({item_id:id,batch_number:request.batch_number.trim()}).whereNotNull('expiry_date').first();
                    if(prior&&request.expiry_date&&new Date(prior.expiry_date).toISOString().slice(0,10)!==request.expiry_date)throw new Error('This batch already has a different expiry date');
               }
               const supplier = await trx('inv_suppliers').where({ id: supplierId, is_active: true }).first();
               if (!supplier) throw new Error('Supplier not found or inactive');

               const stockAdded = quantity * packSize;
               const previousStock = Number(item.current_stock || 0);
               const newStock = previousStock + stockAdded;
               const incomingUnitCost = packCost / packSize;
               const previousCost = Number(item.cost_price || 0);
               const weightedCost = newStock > 0
                    ? ((previousStock * previousCost) + (stockAdded * incomingUnitCost)) / newStock
                    : incomingUnitCost;
               const totalCost = quantity * packCost;

               await trx('inv_purchase_orders').insert({
                    id: orderId,
                    order_number: `STOCK-${now.getTime()}-${reference.slice(0, 6).toUpperCase()}`,
                    supplier_id: supplierId,
                    order_date: now,
                    expected_delivery_date: now,
                    status: 'received',
                    total_amount: totalCost,
                    notes: 'Direct stock up from inventory items',
                    created_by: String(request.received_by),
                    created_at: now,
                    updated_at: now
               });
               await trx('inv_purchase_order_items').insert({
                    id: orderItemId,
                    order_id: orderId,
                    inventory_item_id: id,
                    quantity_ordered: quantity,
                    quantity_received: quantity,
                    unit_price: packCost,
                    tax_rate: 0,
                    discount_rate: 0,
                    line_total: totalCost,
                    status: 'received',
                    notes: 'Direct stock up',
                    created_at: now,
                    updated_at: now
               });
               const receipt = {
                    id: receiptId,
                    order_id: orderId,
                    order_item_id: orderItemId,
                    receipt_number: receiptId,
                    received_date: now,
                    received_by: request.received_by,
                    quantity_received: quantity,
                    batch_number: batchNumber,
                    expiry_date: request.expiry_date || null,
                    unit_price: packCost,
                    tax_rate: 0,
                    discount_rate: 0,
                    condition_status: 'good',
                    quality_check_passed: true,
                    notes: 'Direct stock up',
                    purchase_unit: null,
                    units_per_purchase_unit: packSize,
                    price_policy: request.change_pricing ? request.price_policy || 'replace' : 'maintain',
                    resulting_wholesale_price: request.change_pricing ? request.new_wholesale_price ?? null : null,
                    resulting_sale_price: request.change_pricing ? request.new_sale_price ?? null : null,
                    created_at: now
               };
               await trx('inv_purchase_order_receipts').insert(receipt);

               await trx('inv_inventory_items').where({ id }).update({
                    current_stock: newStock,
                    cost_price: Number(weightedCost.toFixed(2)),
                    wholesale_price: request.change_pricing ? request.new_wholesale_price ?? item.wholesale_price : item.wholesale_price,
                    sale_price: request.change_pricing ? request.new_sale_price ?? item.sale_price : item.sale_price,
                    units_per_purchase_unit: packSize,
                    status: this.calculateItemStatus(newStock, Number(item.min_stock || 0)),
                    last_updated: now,
                    updated_at: now
               });
               await trx('inv_inventory_transactions').insert({
                    id: `TXN-STOCK-${reference}`,
                    item_id: id,
                    transaction_type: 'addition',
                    unit_type: packSize > 1 ? 'purchase' : 'consumption',
                    quantity: stockAdded,
                    purchase_unit: null,
                    units_per_purchase_unit: packSize,
                    previous_stock: previousStock,
                    new_stock: newStock,
                    batch_number: batchNumber,
                    expiry_date: request.expiry_date || null,
                    unit_cost: incomingUnitCost,
                    total_cost: totalCost,
                    reason: 'Direct inventory stock up',
                    reference_id: receiptId,
                    performed_by: request.received_by,
                    transaction_date: now,
                    created_at: now
               });
               await enqueueGoodsReceipt(this.tenantId, receipt, trx);
          });

          return await this.findById(id) as InventoryItem;
     }

     async create(request: CreateInventoryItemRequest): Promise<InventoryItem> {
          const connection = await this.connection;

          // Validate SKU uniqueness
          const existingSKU = await connection('inv_inventory_items')
               .where('sku', request.sku)
               .first();

          if (existingSKU) {
               throw new Error('Stock Keeping Unit already exists');
          }

          // Validate consumption unit exists
          const consumptionUnitExists = await connection('inv_units')
               .where('id', request.consumption_unit || 'pieces')
               .first();

          if (!consumptionUnitExists) {
               throw new Error('Invalid consumption unit specified');
          }

          // Validate stock levels
          const currentStock = request.current_stock || 0;
          const minStock = request.min_stock || 0;
          const maxStock = request.max_stock || 0;

          if (currentStock < 0) {
               throw new Error('Current stock cannot be negative');
          }
          if (minStock < 0) {
               throw new Error('Minimum stock cannot be negative');
          }
          if (maxStock > 0 && maxStock < minStock) {
               throw new Error('Maximum stock must be greater than minimum stock');
          }

          const status = this.calculateItemStatus(currentStock, minStock);

          const itemData = {
               id: this.generateItemId(),
               name: request.name,
               sku: request.sku,
               description: request.description || null,
               category_id: request.category_id || null,
               inventory_domain: request.inventory_domain || (request.category_id === 'CAT-PHARMACY' ? 'pharmacy' : 'lab'),
               consumption_unit: request.consumption_unit || 'pieces',
               current_stock: currentStock,
               min_stock: minStock,
               max_stock: maxStock,
               cost_price: request.cost_price || 0,
               wholesale_price: request.wholesale_price || 0,
               sale_price: request.sale_price || 0,
               preferred_purchase_unit: request.preferred_purchase_unit || null,
               units_per_purchase_unit: request.units_per_purchase_unit || 1,
               location_id: request.location_id || null,
               status: status,
               is_active: true,
               last_updated: new Date(),
               created_at: new Date(),
               updated_at: new Date()
          };

          await connection('inv_inventory_items').insert(itemData);

          await connection('inv_brands').insert({
               id: `BRD-${randomUUID()}`,
               name: `Default brand - ${itemData.sku}`,
               inventory_item_id: itemData.id,
               created_date: new Date(),
               item_count: 1,
               created_at: new Date(),
               updated_at: new Date()
          });

          // Update category item counts
          if (request.category_id) {
               await connection('inv_categories')
                    .where('id', request.category_id)
                    .increment('item_count', 1);
          }

          return await this.findById(itemData.id) as InventoryItem;
     }

     async findById(id: string): Promise<InventoryItem | null> {
          const connection = await this.connection;
          const result = await connection('inv_inventory_items')
               .leftJoin('inv_categories', 'inv_inventory_items.category_id', 'inv_categories.id')
               .leftJoin('inv_storage_locations', 'inv_inventory_items.location_id', 'inv_storage_locations.id')
               .leftJoin('inv_units as cu', 'inv_inventory_items.consumption_unit', 'cu.id')
               .select(
                    'inv_inventory_items.*',
                    'inv_categories.name as category_name',
                    'inv_storage_locations.name as location_name',
                    'cu.name as consumption_unit_name'
               )
               .where('inv_inventory_items.id', id)
               .first();

          if (!result) return null;

          return {
               id: result.id,
               name: result.name,
               sku: result.sku,
               description: result.description,
               category_id: result.category_id,
               inventory_domain: result.inventory_domain,
               consumption_unit: result.consumption_unit,
               current_stock: result.current_stock,
               min_stock: result.min_stock,
               max_stock: result.max_stock,
               cost_price: Number(result.cost_price || 0),
               wholesale_price: Number(result.wholesale_price || 0),
               sale_price: Number(result.sale_price || 0),
               preferred_purchase_unit: result.preferred_purchase_unit,
               units_per_purchase_unit: Number(result.units_per_purchase_unit || 1),
               location_id: result.location_id,
               status: result.status,
               is_active: result.is_active,
               last_updated: result.last_updated,
               created_at: result.created_at,
               updated_at: result.updated_at,
               category_name: result.category_name,
               location_name: result.location_name,
               consumption_unit_name: result.consumption_unit_name
          };
     }

     async findBySKU(sku: string): Promise<InventoryItem | null> {
          const connection = await this.connection;
          const result = await connection('inv_inventory_items')
               .leftJoin('inv_categories', 'inv_inventory_items.category_id', 'inv_categories.id')
               .leftJoin('inv_storage_locations', 'inv_inventory_items.location_id', 'inv_storage_locations.id')
               .leftJoin('inv_units as cu', 'inv_inventory_items.consumption_unit', 'cu.id')
               .select(
                    'inv_inventory_items.*',
                    'inv_categories.name as category_name',
                    'inv_storage_locations.name as location_name',
                    'cu.name as consumption_unit_name'
               )
               .where('inv_inventory_items.sku', sku)
               .first();

          if (!result) return null;

          return {
               id: result.id,
               name: result.name,
               sku: result.sku,
               description: result.description,
               category_id: result.category_id,
               inventory_domain: result.inventory_domain,
               consumption_unit: result.consumption_unit,
               current_stock: result.current_stock,
               min_stock: result.min_stock,
               max_stock: result.max_stock,
               cost_price: Number(result.cost_price || 0),
               wholesale_price: Number(result.wholesale_price || 0),
               sale_price: Number(result.sale_price || 0),
               preferred_purchase_unit: result.preferred_purchase_unit,
               units_per_purchase_unit: Number(result.units_per_purchase_unit || 1),
               location_id: result.location_id,
               status: result.status,
               is_active: result.is_active,
               last_updated: result.last_updated,
               created_at: result.created_at,
               updated_at: result.updated_at,
               category_name: result.category_name,
               location_name: result.location_name,
               consumption_unit_name: result.consumption_unit_name
          };
     }

     async findMany(filters: InventoryFilters): Promise<InventoryItemListResponse> {
          const connection = await this.connection;
          const {
               page = 1,
               count = 10,
               sortby = 'DESC',
               category_id,
               inventory_domain,
               location_id,
               status,
               search,
               low_stock_only,
               startDate,
               endDate
          } = filters;

          let query = connection('inv_inventory_items')
               .leftJoin('inv_categories', 'inv_inventory_items.category_id', 'inv_categories.id')
               .leftJoin('inv_storage_locations', 'inv_inventory_items.location_id', 'inv_storage_locations.id')
               .leftJoin('inv_units as cu', 'inv_inventory_items.consumption_unit', 'cu.id')
               .select(
                    'inv_inventory_items.*',
                    'inv_categories.name as category_name',
                    'inv_storage_locations.name as location_name',
                    'cu.name as consumption_unit_name'
               )
               .where('inv_inventory_items.is_active', true)
               .orderBy('inv_inventory_items.created_at', sortby);

          // Apply filters
          if (category_id) {
               query = query.where('inv_inventory_items.category_id', category_id);
          }
          if (inventory_domain) {
               query = query.where('inv_inventory_items.inventory_domain', inventory_domain);
          }
          if (location_id) {
               query = query.where('inv_inventory_items.location_id', location_id);
          }
          if (status) {
               query = query.where('inv_inventory_items.status', status);
          }
          if (low_stock_only) {
               query = query.whereRaw('inv_inventory_items.current_stock <= inv_inventory_items.min_stock')
                    .where('inv_inventory_items.current_stock', '>', 0);
          }
          if (search) {
               query = query.where((qb) => {
                    qb.where('inv_inventory_items.name', 'like', `%${search}%`)
                         .orWhere('inv_inventory_items.sku', 'like', `%${search}%`)
                         .orWhere('inv_inventory_items.description', 'like', `%${search}%`);
               });
          }
          if (startDate) {
               query = query.where('inv_inventory_items.created_at', '>=', startDate);
          }
          if (endDate) {
               query = query.where('inv_inventory_items.created_at', '<=', endDate);
          }

          const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
          const totalResult = await totalQuery;
          const total = parseInt(totalResult?.count as string) || 0;

          const offset = (page - 1) * count;
          const rawData = await query.limit(count).offset(offset);

          const items = rawData.map((result: any) => ({
               id: result.id,
               name: result.name,
               sku: result.sku,
               description: result.description,
               category_id: result.category_id,
               inventory_domain: result.inventory_domain,
               consumption_unit: result.consumption_unit,
               current_stock: result.current_stock,
               min_stock: result.min_stock,
               max_stock: result.max_stock,
               cost_price: Number(result.cost_price || 0),
               wholesale_price: Number(result.wholesale_price || 0),
               sale_price: Number(result.sale_price || 0),
               preferred_purchase_unit: result.preferred_purchase_unit,
               units_per_purchase_unit: Number(result.units_per_purchase_unit || 1),
               location_id: result.location_id,
               status: result.status,
               is_active: result.is_active,
               last_updated: result.last_updated,
               created_at: result.created_at,
               updated_at: result.updated_at,
               category_name: result.category_name,
               location_name: result.location_name,
               consumption_unit_name: result.consumption_unit_name
          }));

          // Calculate summary
          const summary = await this.getInventorySummary();

          return {
               items,
               total,
               page,
               count,
               totalPages: Math.ceil(total / count),
               sortby,
               summary: {
                    low_stock_count: summary.low_stock_items || 0,
                    expired_count: 0, // No longer tracked since expiry_date removed
                    total_items: summary.total_items || 0,
                    out_of_stock_count: summary.out_of_stock_items || 0
               }
          };
     }

     async update(id: string, updates: UpdateInventoryItemRequest): Promise<InventoryItem | null> {
          try {
               const connection = await this.connection;

               const currentItem = await this.findById(id);
               if (!currentItem) {
                    throw new Error('Inventory item not found');
               }

               // Validate SKU uniqueness if changing
               if (updates.sku && updates.sku !== currentItem.sku) {
                    const existingSKU = await connection('inv_inventory_items')
                         .where('sku', updates.sku)
                         .whereNot('id', id)
                         .first();

                    if (existingSKU) {
                         throw new Error('Stock Keeping Unit already exists');
                    }
               }

               // Validate units if changing
               if (updates.consumption_unit) {
                    const consumptionUnitExists = await connection('inv_units')
                         .where('id', updates.consumption_unit)
                         .first();

                    if (!consumptionUnitExists) {
                         throw new Error('Invalid consumption unit specified');
                    }
               }

               // Validate stock levels
               const currentStock = updates.current_stock !== undefined ? updates.current_stock : currentItem.current_stock;
               const minStock = updates.min_stock !== undefined ? updates.min_stock : currentItem.min_stock;
               const maxStock = updates.max_stock !== undefined ? updates.max_stock : currentItem.max_stock;

               if (currentStock < 0) {
                    throw new Error('Current stock cannot be negative');
               }
               if (minStock < 0) {
                    throw new Error('Minimum stock cannot be negative');
               }
               if (maxStock > 0 && maxStock < minStock) {
                    throw new Error('Maximum stock must be greater than minimum stock');
               }

               const updateData: any = {
                    // updated_at: new Date()
               };

               // Map camelCase to snake_case
               if (updates.name !== undefined) updateData.name = updates.name;
               if (updates.sku !== undefined) updateData.sku = updates.sku;
               if (updates.description !== undefined) updateData.description = updates.description;
               if (updates.category_id !== undefined) updateData.category_id = updates.category_id;
               if (updates.inventory_domain !== undefined) updateData.inventory_domain = updates.inventory_domain;
               if (updates.consumption_unit !== undefined) updateData.consumption_unit = updates.consumption_unit;
               if (updates.current_stock !== undefined) updateData.current_stock = updates.current_stock;
               if (updates.min_stock !== undefined) updateData.min_stock = updates.min_stock;
               if (updates.max_stock !== undefined) updateData.max_stock = updates.max_stock;
               if (updates.cost_price !== undefined) updateData.cost_price = updates.cost_price;
               if (updates.wholesale_price !== undefined) updateData.wholesale_price = updates.wholesale_price;
               if (updates.sale_price !== undefined) updateData.sale_price = updates.sale_price;
               if (updates.preferred_purchase_unit !== undefined) updateData.preferred_purchase_unit = updates.preferred_purchase_unit;
               if (updates.units_per_purchase_unit !== undefined) updateData.units_per_purchase_unit = updates.units_per_purchase_unit;
               if (updates.location_id !== undefined) updateData.location_id = updates.location_id;
               if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

               // Recalculate status and total value
               const newStatus = this.calculateItemStatus(currentStock, minStock);
               updateData.status = newStatus;
               updateData.last_updated = new Date()

               // Handle category count updates
               if (updates.category_id !== undefined && updates.category_id !== currentItem.category_id) {
                    // Remove from old category
                    if (currentItem.category_id) {
                         await connection('inv_categories')
                              .where('id', currentItem.category_id)
                              .decrement('item_count', 1);
                    }
                    // Add to new category
                    if (updates.category_id) {
                         await connection('inv_categories')
                              .where('id', updates.category_id)
                              .increment('item_count', 1);
                    }
               }

               await connection('inv_inventory_items')
                    .where({ id })
                    .update(updateData);

               return await this.findById(id);
          } catch (err: any) {
               throw err;
          }
     }

     async delete(id: string): Promise<boolean> {
          const connection = await this.connection;

          const item = await this.findById(id);
          if (!item) {
               return false;
          }

          // Update category counts
          if (item.category_id) {
               await connection('inv_categories')
                    .where('id', item.category_id)
                    .decrement('item_count', 1);
          }

          const result = await connection('inv_inventory_items')
               .where({ id })
               .del();

          return result > 0;
     }

     async getInventorySummary(): Promise<InventorySummary> {
          const connection = await this.connection;

          const summary = await connection('inv_inventory_items')
               .where('is_active', true)
               .select(
                    connection.raw('COUNT(*) as total_items'),
                    connection.raw('SUM(CASE WHEN status = "low_stock" THEN 1 ELSE 0 END) as low_stock_items'),
                    connection.raw('SUM(CASE WHEN status = "out_of_stock" THEN 1 ELSE 0 END) as out_of_stock_items')
               )
               .first();

          const categoriesCount = await connection('inv_categories').count('* as count').first();
          const suppliersCount = await connection('inv_suppliers').count('* as count').first();

          return {
               total_items: parseInt((summary as any)?.total_items || 0),
               low_stock_items: parseInt((summary as any)?.low_stock_items || 0),
               expired_items: 0, // No longer tracked since expiry_date removed
               out_of_stock_items: parseInt((summary as any)?.out_of_stock_items || 0),
               categories_count: parseInt((categoriesCount as any)?.count || 0),
               suppliers_count: parseInt((suppliersCount as any)?.count || 0),
               pending_orders: 0 // TODO: Calculate from purchase orders
          };
     }

     async getAvailableUnits(page: number = 1, count: number = 10, sortBy: "DESC" | "ASC" = "ASC"): Promise<{ units: InventoryUnitInfo[], total: number }> {
          const connection = await this.connection;

          try {
               // Get total count
               const totalResult = await connection('inv_units')
                    .count('* as total')
                    .first();
               const total = parseInt(totalResult?.total as string || '0');

               // Build query with sorting
               let query = connection('inv_units').select('*');

               query = query.orderBy('name', sortBy.toLowerCase() as 'asc' | 'desc');

               // Apply pagination
               const offset = (page - 1) * count;
               query = query.limit(count).offset(offset);

               const results = await query;

               const units = results.map((result: any) => ({
                    id: result.id.toString(),
                    name: result.name,
                    description: result.description,
                    // category: result.category, // Not available in current schema
                    is_standard: result.is_standard
               }));

               return { units, total };
          } catch (error: any) {
               // If table doesn't exist, return mock data for testing
               if (error.message && error.message.includes('no such table')) {
                    console.log('inv_units table not found, returning mock data for testing');
                    const mockUnits = [
                         { id: 'pieces', name: 'Pieces', description: 'Individual pieces or items', category: 'count', is_standard: true },
                         { id: 'boxes', name: 'Boxes', description: 'Standard cardboard boxes', category: 'count', is_standard: true },
                         { id: 'bottles', name: 'Bottles', description: 'Glass or plastic bottles', category: 'count', is_standard: true },
                         { id: 'packs', name: 'Packs', description: 'Pre-packaged units', category: 'count', is_standard: true },
                         { id: 'liters', name: 'Liters', description: 'Volume in liters', category: 'volume', is_standard: true },
                         { id: 'kg', name: 'Kilograms', description: 'Weight in kilograms', category: 'weight', is_standard: true },
                         { id: 'mg', name: 'Milligrams', description: 'Weight in milligrams', category: 'weight', is_standard: true },
                         { id: 'ml', name: 'Milliliters', description: 'Volume in milliliters', category: 'volume', is_standard: true },
                         { id: 'units', name: 'Units', description: 'Generic units', category: 'count', is_standard: true },
                         { id: 'vials', name: 'Vials', description: 'Small containers', category: 'count', is_standard: true },
                         { id: 'tubes', name: 'Tubes', description: 'Test tubes or containers', category: 'count', is_standard: true },
                         { id: 'plates', name: 'Plates', description: 'Culture plates or similar', category: 'count', is_standard: true },
                         { id: 'strips', name: 'Strips', description: 'Test strips', category: 'count', is_standard: true },
                         { id: 'kits', name: 'Kits', description: 'Complete kits', category: 'count', is_standard: true }
                    ];

                    // Apply pagination to mock data
                    const offset = (page - 1) * count;
                    const paginatedMockUnits = mockUnits.slice(offset, offset + count);

                    return {
                         units: paginatedMockUnits.map(unit => ({
                              id: unit.id,
                              name: unit.name,
                              description: unit.description,
                              is_standard: unit.is_standard
                         })),
                         total: mockUnits.length
                    };
               }
               throw error;
          }
     }

     async createCustomUnit(unitData: {
          name: string;
          description?: string;
     }): Promise<InventoryUnitInfo> {
          const connection = await this.connection;

          const insertData = {
               name: unitData.name,
               description: unitData.description || null,
               is_standard: false
          };

          const [insertedId] = await connection('inv_units').insert(insertData);
          const newUnit = await connection('inv_units')
               .where('id', insertedId)
               .first();

          return {
               id: newUnit.id.toString(),
               name: newUnit.name,
               description: newUnit.description,
               is_standard: newUnit.is_standard
          };
     }
}
