"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryItemModel = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class InventoryItemModel {
    constructor(tenantId) {
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    generateItemId() {
        const timestamp = Date.now().toString();
        return `INV-${timestamp}`;
    }
    calculateItemStatus(currentStock, minStock) {
        if (currentStock === 0) {
            return 'out_of_stock';
        }
        if (currentStock <= minStock) {
            return 'low_stock';
        }
        return 'in_stock';
    }
    async create(request) {
        const connection = await this.connection;
        // Validate SKU uniqueness
        const existingSKU = await connection('inv_inventory_items')
            .where('sku', request.sku)
            .first();
        if (existingSKU) {
            throw new Error('Stock Keeping Unit already exists');
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
            unit: request.unit || 'pieces',
            current_stock: currentStock,
            min_stock: minStock,
            max_stock: maxStock,
            location_id: request.location_id || null,
            status: status,
            is_active: true,
            last_updated: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        await connection('inv_inventory_items').insert(itemData);
        // Update category item counts
        if (request.category_id) {
            await connection('inv_categories')
                .where('id', request.category_id)
                .increment('item_count', 1);
        }
        return await this.findById(itemData.id);
    }
    async findById(id) {
        const connection = await this.connection;
        const result = await connection('inv_inventory_items')
            .leftJoin('inv_categories', 'inv_inventory_items.category_id', 'inv_categories.id')
            .leftJoin('inv_storage_locations', 'inv_inventory_items.location_id', 'inv_storage_locations.id')
            .select('inv_inventory_items.*', 'inv_categories.name as category_name', 'inv_storage_locations.name as location_name')
            .where('inv_inventory_items.id', id)
            .first();
        if (!result)
            return null;
        return {
            id: result.id,
            name: result.name,
            sku: result.sku,
            description: result.description,
            category_id: result.category_id,
            unit: result.unit,
            current_stock: result.current_stock,
            min_stock: result.min_stock,
            max_stock: result.max_stock,
            location_id: result.location_id,
            status: result.status,
            is_active: result.is_active,
            last_updated: result.last_updated,
            created_at: result.created_at,
            updated_at: result.updated_at,
            category_name: result.category_name,
            location_name: result.location_name
        };
    }
    async findBySKU(sku) {
        const connection = await this.connection;
        const result = await connection('inv_inventory_items')
            .leftJoin('inv_categories', 'inv_inventory_items.category_id', 'inv_categories.id')
            .leftJoin('inv_storage_locations', 'inv_inventory_items.location_id', 'inv_storage_locations.id')
            .select('inv_inventory_items.*', 'inv_categories.name as category_name', 'inv_storage_locations.name as location_name')
            .where('inv_inventory_items.sku', sku)
            .first();
        if (!result)
            return null;
        return {
            id: result.id,
            name: result.name,
            sku: result.sku,
            description: result.description,
            category_id: result.category_id,
            unit: result.unit,
            current_stock: result.current_stock,
            min_stock: result.min_stock,
            max_stock: result.max_stock,
            location_id: result.location_id,
            status: result.status,
            is_active: result.is_active,
            last_updated: result.last_updated,
            created_at: result.created_at,
            updated_at: result.updated_at,
            category_name: result.category_name,
            location_name: result.location_name
        };
    }
    async findMany(filters) {
        const connection = await this.connection;
        const { page = 1, count = 10, sortby = 'DESC', category_id, location_id, status, search, low_stock_only, startDate, endDate } = filters;
        let query = connection('inv_inventory_items')
            .leftJoin('inv_categories', 'inv_inventory_items.category_id', 'inv_categories.id')
            .leftJoin('inv_storage_locations', 'inv_inventory_items.location_id', 'inv_storage_locations.id')
            .select('inv_inventory_items.*', 'inv_categories.name as category_name', 'inv_storage_locations.name as location_name')
            .where('inv_inventory_items.is_active', true)
            .orderBy('inv_inventory_items.created_at', sortby);
        // Apply filters
        if (category_id) {
            query = query.where('inv_inventory_items.category_id', category_id);
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
        const total = parseInt(totalResult === null || totalResult === void 0 ? void 0 : totalResult.count) || 0;
        const offset = (page - 1) * count;
        const rawData = await query.limit(count).offset(offset);
        const items = rawData.map((result) => ({
            id: result.id,
            name: result.name,
            sku: result.sku,
            description: result.description,
            category_id: result.category_id,
            unit: result.unit,
            current_stock: result.current_stock,
            min_stock: result.min_stock,
            max_stock: result.max_stock,
            location_id: result.location_id,
            status: result.status,
            is_active: result.is_active,
            last_updated: result.last_updated,
            created_at: result.created_at,
            updated_at: result.updated_at,
            category_name: result.category_name,
            location_name: result.location_name
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
    async update(id, updates) {
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
        const updateData = {
            updated_at: new Date().toISOString()
        };
        // Map camelCase to snake_case
        if (updates.name !== undefined)
            updateData.name = updates.name;
        if (updates.sku !== undefined)
            updateData.sku = updates.sku;
        if (updates.description !== undefined)
            updateData.description = updates.description;
        if (updates.category_id !== undefined)
            updateData.category_id = updates.category_id;
        if (updates.unit !== undefined)
            updateData.unit = updates.unit;
        if (updates.current_stock !== undefined)
            updateData.current_stock = updates.current_stock;
        if (updates.min_stock !== undefined)
            updateData.min_stock = updates.min_stock;
        if (updates.max_stock !== undefined)
            updateData.max_stock = updates.max_stock;
        if (updates.location_id !== undefined)
            updateData.location_id = updates.location_id;
        if (updates.is_active !== undefined)
            updateData.is_active = updates.is_active;
        // Recalculate status and total value
        const newStatus = this.calculateItemStatus(currentStock, minStock);
        updateData.status = newStatus;
        updateData.last_updated = new Date().toISOString();
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
    }
    async delete(id) {
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
    async getInventorySummary() {
        const connection = await this.connection;
        const summary = await connection('inv_inventory_items')
            .where('is_active', true)
            .select(connection.raw('COUNT(*) as total_items'), connection.raw('SUM(CASE WHEN status = "low_stock" THEN 1 ELSE 0 END) as low_stock_items'), connection.raw('SUM(CASE WHEN status = "out_of_stock" THEN 1 ELSE 0 END) as out_of_stock_items'))
            .first();
        const categoriesCount = await connection('inv_categories').count('* as count').first();
        const suppliersCount = await connection('inv_suppliers').count('* as count').first();
        return {
            total_items: parseInt((summary === null || summary === void 0 ? void 0 : summary.total_items) || 0),
            low_stock_items: parseInt((summary === null || summary === void 0 ? void 0 : summary.low_stock_items) || 0),
            expired_items: 0, // No longer tracked since expiry_date removed
            out_of_stock_items: parseInt((summary === null || summary === void 0 ? void 0 : summary.out_of_stock_items) || 0),
            categories_count: parseInt((categoriesCount === null || categoriesCount === void 0 ? void 0 : categoriesCount.count) || 0),
            suppliers_count: parseInt((suppliersCount === null || suppliersCount === void 0 ? void 0 : suppliersCount.count) || 0),
            pending_orders: 0 // TODO: Calculate from purchase orders
        };
    }
    async getLowStockAlerts() {
        const connection = await this.connection;
        const results = await connection('inv_inventory_items')
            .select('inv_inventory_items.id', 'inv_inventory_items.name', 'inv_inventory_items.sku', 'inv_inventory_items.current_stock', 'inv_inventory_items.min_stock', 'inv_inventory_items.last_updated')
            .where('inv_inventory_items.is_active', true)
            .whereRaw('inv_inventory_items.current_stock <= inv_inventory_items.min_stock')
            .where('inv_inventory_items.current_stock', '>', 0)
            .orderBy('inv_inventory_items.last_updated', 'DESC');
        return results.map((result) => ({
            item_id: result.id,
            item_name: result.name,
            sku: result.sku,
            current_stock: result.current_stock,
            min_stock: result.min_stock,
            last_updated: result.last_updated
        }));
    }
}
exports.InventoryItemModel = InventoryItemModel;
