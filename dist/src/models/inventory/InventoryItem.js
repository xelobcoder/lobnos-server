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
    calculateItemStatus(currentStock, minStock, expiryDate) {
        if (expiryDate) {
            const expiry = new Date(expiryDate);
            const today = new Date();
            if (expiry < today) {
                return 'expired';
            }
        }
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
        // Validate expiry date is not in the past
        if (request.expiry_date) {
            const expiryDate = new Date(request.expiry_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (expiryDate < today) {
                throw new Error('Cannot add item with past expiry date');
            }
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
        if (request.unit_price < 0) {
            throw new Error('Unit price cannot be negative');
        }
        const status = this.calculateItemStatus(currentStock, minStock, request.expiry_date);
        const totalValue = currentStock * (request.unit_price || 0);
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
            unit_price: request.unit_price || 0,
            total_value: totalValue,
            location_id: request.location_id || null,
            expiry_date: request.expiry_date || null,
            batch_number: request.batch_number || null,
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
            unit_price: result.unit_price,
            total_value: result.total_value,
            location_id: result.location_id,
            expiry_date: result.expiry_date,
            batch_number: result.batch_number,
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
            unit_price: result.unit_price,
            total_value: result.total_value,
            location_id: result.location_id,
            expiry_date: result.expiry_date,
            batch_number: result.batch_number,
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
        const { page = 1, count = 10, sortby = 'DESC', category_id, location_id, status, search, low_stock_only, expired_only, startDate, endDate } = filters;
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
        if (expired_only) {
            query = query.where('inv_inventory_items.expiry_date', '<', new Date().toISOString().split('T')[0]);
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
            unit_price: result.unit_price,
            total_value: result.total_value,
            location_id: result.location_id,
            expiry_date: result.expiry_date,
            batch_number: result.batch_number,
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
            summary: {
                total_value: summary.total_value || 0,
                low_stock_count: summary.low_stock_items || 0,
                expired_count: summary.expired_items || 0,
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
        // Validate expiry date
        if (updates.expiry_date) {
            const expiryDate = new Date(updates.expiry_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (expiryDate < today) {
                throw new Error('Cannot set past expiry date');
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
        if (updates.unit_price !== undefined && updates.unit_price < 0) {
            throw new Error('Unit price cannot be negative');
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
        if (updates.unit_price !== undefined)
            updateData.unit_price = updates.unit_price;
        if (updates.location_id !== undefined)
            updateData.location_id = updates.location_id;
        if (updates.expiry_date !== undefined)
            updateData.expiry_date = updates.expiry_date;
        if (updates.batch_number !== undefined)
            updateData.batch_number = updates.batch_number;
        if (updates.is_active !== undefined)
            updateData.is_active = updates.is_active;
        // Recalculate status and total value
        const newStatus = this.calculateItemStatus(currentStock, minStock, updates.expiry_date || currentItem.expiry_date);
        const unitPrice = updates.unit_price !== undefined ? updates.unit_price : currentItem.unit_price;
        updateData.status = newStatus;
        updateData.total_value = currentStock * unitPrice;
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
    async processTransaction(transaction) {
        const connection = await this.connection;
        const item = await this.findById(transaction.item_id);
        if (!item) {
            throw new Error('Inventory item not found');
        }
        let newStock;
        switch (transaction.transaction_type) {
            case 'consumption':
                if (item.current_stock < transaction.quantity) {
                    throw new Error('Insufficient stock for consumption');
                }
                newStock = item.current_stock - transaction.quantity;
                break;
            case 'addition':
                newStock = item.current_stock + transaction.quantity;
                break;
            case 'adjustment':
                newStock = transaction.quantity; // Absolute adjustment
                break;
            case 'transfer':
                if (item.current_stock < transaction.quantity) {
                    throw new Error('Insufficient stock for transfer');
                }
                newStock = item.current_stock - transaction.quantity;
                break;
            default:
                throw new Error('Invalid transaction type');
        }
        const transactionData = {
            id: `TRX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            item_id: transaction.item_id,
            transaction_type: transaction.transaction_type,
            quantity: transaction.quantity,
            previous_stock: item.current_stock,
            new_stock: newStock,
            batch_number: transaction.batch_number || null,
            brand_name: transaction.brand_name || null,
            reason: transaction.reason || null,
            reference_id: transaction.reference_id || null,
            performed_by: transaction.performed_by || null,
            transaction_date: new Date().toISOString(),
            notes: transaction.notes || null,
            created_at: new Date().toISOString()
        };
        await connection('inv_inventory_transactions').insert(transactionData);
        // Update item stock
        await connection('inv_inventory_items')
            .where('id', transaction.item_id)
            .update({
            current_stock: newStock,
            last_updated: new Date().toISOString()
        });
        return {
            id: transactionData.id,
            item_id: transactionData.item_id,
            transaction_type: transactionData.transaction_type,
            quantity: transactionData.quantity,
            previous_stock: transactionData.previous_stock,
            new_stock: transactionData.new_stock,
            batch_number: transactionData.batch_number,
            brand_name: transactionData.brand_name,
            reason: transactionData.reason,
            reference_id: transactionData.reference_id,
            performed_by: transactionData.performed_by,
            transaction_date: transactionData.transaction_date,
            notes: transactionData.notes,
            created_at: transactionData.created_at,
            updated_at: transactionData.created_at // Transactions don't have separate updated_at
        };
    }
    async getInventorySummary() {
        const connection = await this.connection;
        const summary = await connection('inv_inventory_items')
            .where('is_active', true)
            .select(connection.raw('COUNT(*) as total_items'), connection.raw('SUM(total_value) as total_value'), connection.raw('SUM(CASE WHEN status = "low_stock" THEN 1 ELSE 0 END) as low_stock_items'), connection.raw('SUM(CASE WHEN status = "expired" THEN 1 ELSE 0 END) as expired_items'), connection.raw('SUM(CASE WHEN status = "out_of_stock" THEN 1 ELSE 0 END) as out_of_stock_items'))
            .first();
        const categoriesCount = await connection('inv_categories').count('* as count').first();
        const suppliersCount = await connection('inv_suppliers').count('* as count').first();
        return {
            total_items: parseInt((summary === null || summary === void 0 ? void 0 : summary.total_items) || 0),
            total_value: parseFloat((summary === null || summary === void 0 ? void 0 : summary.total_value) || 0),
            low_stock_items: parseInt((summary === null || summary === void 0 ? void 0 : summary.low_stock_items) || 0),
            expired_items: parseInt((summary === null || summary === void 0 ? void 0 : summary.expired_items) || 0),
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
    async getExpiringItems(daysAhead = 30) {
        const connection = await this.connection;
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);
        const results = await connection('inv_inventory_items')
            .select('id', 'name', 'sku', 'expiry_date', 'current_stock')
            .where('is_active', true)
            .whereNotNull('expiry_date')
            .where('expiry_date', '>=', new Date().toISOString().split('T')[0])
            .where('expiry_date', '<=', futureDate.toISOString().split('T')[0])
            .orderBy('expiry_date', 'ASC');
        return results.map((result) => {
            const expiryDate = new Date(result.expiry_date);
            const today = new Date();
            const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return {
                item_id: result.id,
                item_name: result.name,
                sku: result.sku,
                expiry_date: result.expiry_date,
                days_until_expiry: daysUntilExpiry,
                current_stock: result.current_stock
            };
        });
    }
}
exports.InventoryItemModel = InventoryItemModel;
