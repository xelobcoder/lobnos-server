"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryTransactionModel = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class InventoryTransactionModel {
    constructor(tenantId) {
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    generateTransactionId() {
        const timestamp = Date.now().toString();
        return `TXN-${timestamp}`;
    }
    async create(request) {
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
        let newStock;
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
            performed_by: request.performed_by || null,
            transaction_date: new Date().toISOString(),
            notes: request.notes || null,
            created_at: new Date().toISOString()
        };
        // Start transaction to ensure data consistency
        const trx = await connection.transaction();
        try {
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
            await trx.commit();
            return await this.findById(transactionData.id);
        }
        catch (error) {
            await trx.rollback();
            throw error;
        }
    }
    async createBulk(transactions) {
        const connection = await this.connection;
        const trx = await connection.transaction();
        const createdTransactions = [];
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
                let newStock;
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
                createdTransactions.push(await this.findById(transactionData.id));
            }
            await trx.commit();
            return createdTransactions;
        }
        catch (error) {
            await trx.rollback();
            throw error;
        }
    }
    async findById(id) {
        const connection = await this.connection;
        const result = await connection('inv_inventory_transactions')
            .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
            .select('inv_inventory_transactions.*', 'inv_inventory_items.name as item_name', 'inv_inventory_items.sku as item_sku')
            .where('inv_inventory_transactions.id', id)
            .first();
        if (!result)
            return null;
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
            performed_by: result.performed_by,
            transaction_date: result.transaction_date,
            notes: result.notes,
            created_at: result.created_at,
            item_name: result.item_name,
            item_sku: result.item_sku
        };
    }
    async findByItemId(itemId, filters) {
        const connection = await this.connection;
        const { page = 1, count = 10, sortby = 'DESC', transaction_type, startDate, endDate, performed_by, batch_number } = filters || {};
        let query = connection('inv_inventory_transactions')
            .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
            .select('inv_inventory_transactions.*', 'inv_inventory_items.name as item_name', 'inv_inventory_items.sku as item_sku')
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
        const total = parseInt(totalResult === null || totalResult === void 0 ? void 0 : totalResult.count) || 0;
        const offset = (page - 1) * count;
        const rawData = await query.limit(count).offset(offset);
        const transactions = rawData.map((result) => ({
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
    async findMany(filters) {
        const connection = await this.connection;
        const { page = 1, count = 10, sortby = 'DESC', item_id, transaction_type, startDate, endDate, performed_by, batch_number } = filters;
        let query = connection('inv_inventory_transactions')
            .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
            .select('inv_inventory_transactions.*', 'inv_inventory_items.name as item_name', 'inv_inventory_items.sku as item_sku')
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
        const total = parseInt(totalResult === null || totalResult === void 0 ? void 0 : totalResult.count) || 0;
        const offset = (page - 1) * count;
        const rawData = await query.limit(count).offset(offset);
        const transactions = rawData.map((result) => ({
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
    async getItemStockHistory(itemId, days = 30) {
        const connection = await this.connection;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const results = await connection('inv_inventory_transactions')
            .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
            .select('inv_inventory_transactions.*', 'inv_inventory_items.name as item_name', 'inv_inventory_items.sku as item_sku')
            .where('inv_inventory_transactions.item_id', itemId)
            .where('inv_inventory_transactions.transaction_date', '>=', startDate.toISOString())
            .orderBy('inv_inventory_transactions.transaction_date', 'ASC');
        return results.map((result) => ({
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
            performed_by: result.performed_by,
            transaction_date: result.transaction_date,
            notes: result.notes,
            created_at: result.created_at,
            item_name: result.item_name,
            item_sku: result.item_sku
        }));
    }
    async getBatchTransactions(batchNumber) {
        const connection = await this.connection;
        const results = await connection('inv_inventory_transactions')
            .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
            .select('inv_inventory_transactions.*', 'inv_inventory_items.name as item_name', 'inv_inventory_items.sku as item_sku')
            .where('inv_inventory_transactions.batch_number', batchNumber)
            .orderBy('inv_inventory_transactions.transaction_date', 'ASC');
        return results.map((result) => ({
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
            performed_by: result.performed_by,
            transaction_date: result.transaction_date,
            notes: result.notes,
            created_at: result.created_at,
            item_name: result.item_name,
            item_sku: result.item_sku
        }));
    }
    async getTransactionSummary(filters) {
        const connection = await this.connection;
        let query = connection('inv_inventory_transactions')
            .select(connection.raw('SUM(CASE WHEN transaction_type = "addition" THEN quantity ELSE 0 END) as total_additions'), connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) as total_consumptions'), connection.raw('SUM(CASE WHEN transaction_type = "adjustment" THEN quantity ELSE 0 END) as total_adjustments'), connection.raw('SUM(CASE WHEN transaction_type = "transfer" THEN quantity ELSE 0 END) as total_transfers'), connection.raw('SUM(CASE WHEN transaction_type = "addition" THEN quantity WHEN transaction_type IN ("consumption", "adjustment", "transfer") THEN -quantity ELSE 0 END) as net_change'));
        // Apply filters
        if (filters === null || filters === void 0 ? void 0 : filters.item_id) {
            query = query.where('item_id', filters.item_id);
        }
        if (filters === null || filters === void 0 ? void 0 : filters.startDate) {
            query = query.where('transaction_date', '>=', filters.startDate);
        }
        if (filters === null || filters === void 0 ? void 0 : filters.endDate) {
            query = query.where('transaction_date', '<=', filters.endDate);
        }
        if (filters === null || filters === void 0 ? void 0 : filters.performed_by) {
            query = query.where('performed_by', filters.performed_by);
        }
        if (filters === null || filters === void 0 ? void 0 : filters.batch_number) {
            query = query.where('batch_number', filters.batch_number);
        }
        const result = await query.first();
        return {
            total_additions: parseInt((result === null || result === void 0 ? void 0 : result.total_additions) || 0),
            total_consumptions: parseInt((result === null || result === void 0 ? void 0 : result.total_consumptions) || 0),
            total_adjustments: parseInt((result === null || result === void 0 ? void 0 : result.total_adjustments) || 0),
            total_transfers: parseInt((result === null || result === void 0 ? void 0 : result.total_transfers) || 0),
            net_change: parseInt((result === null || result === void 0 ? void 0 : result.net_change) || 0)
        };
    }
}
exports.InventoryTransactionModel = InventoryTransactionModel;
