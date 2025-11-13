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
        const inventoryItem = await connection('inv_inventory_items')
            .where('id', request.item_id)
            .where('is_active', true)
            .first();
        if (!inventoryItem) {
            throw new Error('Inventory item not found or inactive');
        }
        const previousStock = inventoryItem.current_stock;
        let newStock;
        switch (request.transaction_type) {
            case 'addition':
                newStock = previousStock + request.quantity;
                break;
            case 'consumption':
            case 'adjustment':
            case 'transfer':
            case 'wastage':
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
            wastage_type: request.wastage_type || null,
            created_at: new Date().toISOString()
        };
        const trx = await connection.transaction();
        try {
            await trx('inv_inventory_transactions').insert(transactionData);
            const updateResult = await trx('inv_inventory_items')
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
                const inventoryItem = await trx('inv_inventory_items')
                    .where('id', request.item_id)
                    .where('is_active', true)
                    .first();
                if (!inventoryItem) {
                    throw new Error(`Inventory item ${request.item_id} not found or inactive`);
                }
                const previousStock = inventoryItem.current_stock;
                let newStock;
                switch (request.transaction_type) {
                    case 'addition':
                        newStock = previousStock + request.quantity;
                        break;
                    case 'consumption':
                    case 'adjustment':
                    case 'transfer':
                    case 'wastage':
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
                    wastage_type: request.wastage_type || null,
                    created_at: new Date().toISOString()
                };
                await trx('inv_inventory_transactions').insert(transactionData);
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
            patient_id: result.patient_id,
            ascension_id: result.ascension_id,
            performed_by: result.performed_by,
            transaction_date: result.transaction_date,
            notes: result.notes,
            wastage_type: result.wastage_type,
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
            patient_id: result.patient_id,
            ascension_id: result.ascension_id,
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
    async findMany(filters) {
        const connection = await this.connection;
        const { page = 1, count = 10, sortby = 'DESC', item_id, transaction_type, startDate, endDate, performed_by, batch_number } = filters;
        let query = connection('inv_inventory_transactions')
            .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
            .select('inv_inventory_transactions.*', 'inv_inventory_items.name as item_name', 'inv_inventory_items.sku as item_sku')
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
            patient_id: result.patient_id,
            ascension_id: result.ascension_id,
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
            patient_id: result.patient_id,
            ascension_id: result.ascension_id,
            performed_by: result.performed_by,
            transaction_date: result.transaction_date,
            notes: result.notes,
            wastage_type: result.wastage_type,
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
            patient_id: result.patient_id,
            ascension_id: result.ascension_id,
            performed_by: result.performed_by,
            transaction_date: result.transaction_date,
            notes: result.notes,
            wastage_type: result.wastage_type,
            created_at: result.created_at,
            item_name: result.item_name,
            item_sku: result.item_sku
        }));
    }
    async getTransactionSummary(filters) {
        const connection = await this.connection;
        let query = connection('inv_inventory_transactions')
            .select(connection.raw('SUM(CASE WHEN transaction_type = "addition" THEN quantity ELSE 0 END) as total_additions'), connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) as total_consumptions'), connection.raw('SUM(CASE WHEN transaction_type = "adjustment" THEN quantity ELSE 0 END) as total_adjustments'), connection.raw('SUM(CASE WHEN transaction_type = "transfer" THEN quantity ELSE 0 END) as total_transfers'), connection.raw('SUM(CASE WHEN transaction_type = "addition" THEN quantity WHEN transaction_type IN ("consumption", "adjustment", "transfer") THEN -quantity ELSE 0 END) as net_change'));
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
    async getAvailableStockDetails(itemId) {
        const connection = await this.connection;
        const item = await connection('inv_inventory_items')
            .where('id', itemId)
            .where('is_active', true)
            .first();
        if (!item) {
            throw new Error('Inventory item not found or inactive');
        }
        const batchDetails = await connection('inv_inventory_transactions')
            .select('batch_number', connection.raw('MAX(brand_name) as brand_name'), connection.raw('MAX(expiry_date) as expiry_date'), connection.raw('SUM(CASE WHEN transaction_type = "addition" THEN quantity ELSE 0 END) as total_received'), connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) as total_consumed'), connection.raw('MAX(CASE WHEN transaction_type = "addition" THEN transaction_date END) as last_received'))
            .where('item_id', itemId)
            .whereNotNull('batch_number')
            .groupBy('batch_number')
            .havingRaw('SUM(CASE WHEN transaction_type = "addition" THEN quantity ELSE 0 END) > 0')
            .orderBy('last_received', 'ASC');
        const all_batches = batchDetails.map((batch) => ({
            batch_number: batch.batch_number,
            brand_name: batch.brand_name,
            total_received: parseInt(batch.total_received || 0),
            total_consumed: parseInt(batch.total_consumed || 0),
            available_quantity: parseInt(batch.total_received || 0) - parseInt(batch.total_consumed || 0),
            expiry_date: batch.expiry_date,
            last_received: batch.last_received
        }));
        const available_batches = all_batches.filter(batch => batch.available_quantity > 0);
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
    async getExpiredBatches() {
        const connection = await this.connection;
        const expiredBatches = await connection('inv_inventory_transactions')
            .select('inv_inventory_transactions.item_id', 'inv_inventory_items.name as item_name', 'inv_inventory_items.sku as item_sku', 'inv_inventory_transactions.batch_number', 'inv_inventory_transactions.brand_name', 'inv_inventory_transactions.expiry_date', connection.raw('SUM(CASE WHEN transaction_type = "addition" THEN quantity ELSE 0 END) as total_received'), connection.raw('SUM(CASE WHEN transaction_type IN ("consumption", "wastage") THEN quantity ELSE 0 END) as total_consumed'), connection.raw('SUM(CASE WHEN transaction_type = "wastage" AND (reason LIKE "%expired%" OR reason LIKE "%expiry%" OR wastage_type = "expired") THEN quantity ELSE 0 END) as expired_wastage_quantity'), connection.raw('MAX(CASE WHEN transaction_type = "addition" THEN transaction_date END) as last_received'))
            .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
            .whereNotNull('expiry_date')
            .where('expiry_date', '<', new Date().toISOString().split('T')[0])
            .groupBy('inv_inventory_transactions.item_id', 'inv_inventory_items.name', 'inv_inventory_items.sku', 'inv_inventory_transactions.batch_number', 'inv_inventory_transactions.brand_name', 'inv_inventory_transactions.expiry_date')
            .havingRaw('SUM(CASE WHEN transaction_type = "addition" THEN quantity ELSE 0 END) > 0')
            .orderBy('expiry_date', 'ASC');
        const filteredBatches = expiredBatches.filter((batch) => {
            const totalReceived = parseInt(batch.total_received || 0);
            const expiredWastageQuantity = parseInt(batch.expired_wastage_quantity || 0);
            return expiredWastageQuantity < totalReceived;
        });
        return filteredBatches.map((batch) => ({
            item_id: batch.item_id,
            item_name: batch.item_name,
            item_sku: batch.item_sku,
            batch_number: batch.batch_number,
            brand_name: batch.brand_name,
            expiry_date: batch.expiry_date,
            available_quantity: parseInt(batch.total_received || 0) - parseInt(batch.total_consumed || 0),
            last_received: batch.last_received
        }));
    }
}
exports.InventoryTransactionModel = InventoryTransactionModel;
