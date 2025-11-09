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
    async create(request) {
        const connection = await this.connection;
        // Validate item exists
        const item = await connection('inv_inventory_items')
            .where('id', request.item_id)
            .first();
        if (!item) {
            throw new Error('Inventory item not found');
        }
        // Calculate new stock based on transaction type
        let newStock;
        const previousStock = item.current_stock;
        switch (request.transaction_type) {
            case 'addition':
                newStock = previousStock + request.quantity;
                break;
            case 'consumption':
                if (previousStock < request.quantity) {
                    throw new Error('Insufficient stock for consumption');
                }
                newStock = previousStock - request.quantity;
                break;
            case 'adjustment':
                newStock = request.quantity; // Direct adjustment to specified quantity
                break;
            case 'transfer':
                // For transfers, we assume the quantity is being moved out
                if (previousStock < request.quantity) {
                    throw new Error('Insufficient stock for transfer');
                }
                newStock = previousStock - request.quantity;
                break;
            default:
                throw new Error('Invalid transaction type');
        }
        const transactionData = {
            id: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            item_id: request.item_id,
            transaction_type: request.transaction_type,
            quantity: request.quantity,
            previous_stock: previousStock,
            new_stock: newStock,
            batch_number: request.batch_number || null,
            brand_name: request.brand_name || null,
            reason: request.reason || null,
            reference_id: request.reference_id || null,
            performed_by: request.performed_by || null,
            transaction_date: new Date().toISOString(),
            notes: request.notes || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        await connection('inv_inventory_transactions').insert(transactionData);
        // Update item stock
        await connection('inv_inventory_items')
            .where('id', request.item_id)
            .update({
            current_stock: newStock,
            updated_at: new Date().toISOString()
        });
        // Update item status based on new stock
        const updatedItem = await connection('inv_inventory_items')
            .where('id', request.item_id)
            .first();
        if (updatedItem) {
            let newStatus;
            if (newStock <= 0) {
                newStatus = 'out_of_stock';
            }
            else if (newStock <= updatedItem.min_stock) {
                newStatus = 'low_stock';
            }
            else {
                newStatus = 'in_stock';
            }
            await connection('inv_inventory_items')
                .where('id', request.item_id)
                .update({ status: newStatus });
        }
        return await this.findById(transactionData.id);
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
            brand_name: result.brand_name,
            reason: result.reason,
            reference_id: result.reference_id,
            performed_by: result.performed_by,
            transaction_date: result.transaction_date,
            notes: result.notes,
            created_at: result.created_at,
            updated_at: result.updated_at,
            item_name: result.item_name,
            item_sku: result.item_sku
        };
    }
    async findMany(filters) {
        const connection = await this.connection;
        const { page = 1, count = 10, sortby = 'DESC', item_id, transaction_type, performed_by, startDate, endDate, search } = filters;
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
        if (startDate) {
            query = query.where('inv_inventory_transactions.transaction_date', '>=', startDate);
        }
        if (endDate) {
            query = query.where('inv_inventory_transactions.transaction_date', '<=', endDate);
        }
        if (search) {
            query = query.where(function () {
                this.where('inv_inventory_items.name', 'like', `%${search}%`)
                    .orWhere('inv_inventory_transactions.reason', 'like', `%${search}%`)
                    .orWhere('inv_inventory_transactions.reference_id', 'like', `%${search}%`);
            });
        }
        const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
        const totalResult = await totalQuery;
        const total = parseInt((totalResult === null || totalResult === void 0 ? void 0 : totalResult.count) || 0);
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
            brand_name: result.brand_name,
            reason: result.reason,
            reference_id: result.reference_id,
            performed_by: result.performed_by,
            transaction_date: result.transaction_date,
            notes: result.notes,
            created_at: result.created_at,
            updated_at: result.updated_at,
            item_name: result.item_name,
            item_sku: result.item_sku
        }));
        return {
            transactions,
            total,
            page,
            count,
            totalPages: Math.ceil(total / count)
        };
    }
    async getItemTransactions(itemId, limit = 50) {
        const connection = await this.connection;
        const results = await connection('inv_inventory_transactions')
            .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
            .select('inv_inventory_transactions.*', 'inv_inventory_items.name as item_name', 'inv_inventory_items.sku as item_sku')
            .where('inv_inventory_transactions.item_id', itemId)
            .orderBy('inv_inventory_transactions.transaction_date', 'DESC')
            .limit(limit);
        return results.map((result) => ({
            id: result.id,
            item_id: result.item_id,
            transaction_type: result.transaction_type,
            quantity: result.quantity,
            previous_stock: result.previous_stock,
            new_stock: result.new_stock,
            batch_number: result.batch_number,
            brand_name: result.brand_name,
            reason: result.reason,
            reference_id: result.reference_id,
            performed_by: result.performed_by,
            transaction_date: result.transaction_date,
            notes: result.notes,
            created_at: result.created_at,
            updated_at: result.updated_at,
            item_name: result.item_name,
            item_sku: result.item_sku
        }));
    }
    async getTransactionSummary(itemId, startDate, endDate) {
        const connection = await this.connection;
        let query = connection('inv_inventory_transactions')
            .where('item_id', itemId);
        if (startDate) {
            query = query.where('transaction_date', '>=', startDate);
        }
        if (endDate) {
            query = query.where('transaction_date', '<=', endDate);
        }
        const results = await query.select('transaction_type', 'quantity');
        let total_additions = 0;
        let total_consumptions = 0;
        let total_adjustments = 0;
        let total_transfers = 0;
        results.forEach((result) => {
            switch (result.transaction_type) {
                case 'addition':
                    total_additions += result.quantity;
                    break;
                case 'consumption':
                    total_consumptions += result.quantity;
                    break;
                case 'adjustment':
                    total_adjustments += result.quantity;
                    break;
                case 'transfer':
                    total_transfers += result.quantity;
                    break;
            }
        });
        const net_change = total_additions - total_consumptions - total_adjustments - total_transfers;
        return {
            total_additions,
            total_consumptions,
            total_adjustments,
            total_transfers,
            net_change
        };
    }
    async delete(id) {
        const connection = await this.connection;
        // Get transaction details before deletion
        const transaction = await this.findById(id);
        if (!transaction) {
            return false;
        }
        // Reverse the stock change
        const reverseStock = transaction.previous_stock;
        // Update item stock back to previous value
        await connection('inv_inventory_items')
            .where('id', transaction.item_id)
            .update({
            current_stock: reverseStock,
            updated_at: new Date().toISOString()
        });
        // Delete the transaction
        const result = await connection('inv_inventory_transactions')
            .where({ id })
            .del();
        return result > 0;
    }
}
exports.InventoryTransactionModel = InventoryTransactionModel;
