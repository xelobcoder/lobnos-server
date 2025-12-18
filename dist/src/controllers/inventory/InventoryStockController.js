"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryStockController = void 0;
const InventoryTransaction_1 = require("../../models/inventory/InventoryTransaction");
class InventoryStockController {
    getTenantId(req) {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId || isNaN(tenantId)) {
            throw new Error('Tenant ID is required');
        }
        return tenantId;
    }
    getModel(req) {
        const tenantId = this.getTenantId(req);
        return new InventoryTransaction_1.InventoryTransactionModel(tenantId);
    }
    async getAvailableStockDetails(req, res) {
        try {
            const model = this.getModel(req);
            const { item_id } = req.params;
            if (!item_id) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Item ID is required'
                    }
                };
                res.status(400).json(response);
                return;
            }
            const stockDetails = await model.getAvailableStockDetails(item_id);
            const response = {
                success: true,
                data: stockDetails
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error getting available stock details:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to get available stock details'
                }
            };
            res.status(500).json(response);
        }
    }
    async getExpiredBatches(req, res) {
        try {
            const model = this.getModel(req);
            const tenantId = this.getTenantId(req);
            const { page = 1, count = 10, sortby = 'DESC', item_id, batch_number, days_to_expiry = 30 } = req.query;
            const connection = await model.connection;
            const sortOrder = sortby.toUpperCase() === 'ASC' ? 'asc' : 'desc';
            // Calculate expiry threshold date
            const expiryThreshold = new Date();
            expiryThreshold.setDate(expiryThreshold.getDate() + parseInt(days_to_expiry));
            let query = connection('inv_purchase_order_receipts')
                .join('inv_purchase_order_items', 'inv_purchase_order_receipts.order_item_id', 'inv_purchase_order_items.id')
                .join('inv_inventory_items', 'inv_purchase_order_items.inventory_item_id', 'inv_inventory_items.id')
                .leftJoin('inv_inventory_transactions', function () {
                this.on('inv_inventory_transactions.batch_number', '=', 'inv_purchase_order_receipts.batch_number')
                    .andOn('inv_inventory_transactions.item_id', '=', 'inv_inventory_items.id');
            })
                .select('inv_inventory_items.id as item_id', 'inv_inventory_items.name as item_name', 'inv_inventory_items.sku as item_sku', 'inv_purchase_order_receipts.batch_number', 'inv_purchase_order_receipts.brand_name', 'inv_purchase_order_receipts.expiry_date', 'inv_purchase_order_receipts.unit_price', connection.raw('COALESCE(SUM(inv_purchase_order_receipts.quantity_received), 0) as total_received'), connection.raw('COALESCE(SUM(inv_inventory_transactions.quantity), 0) as total_consumed'))
                .where('inv_purchase_order_receipts.expiry_date', '<=', expiryThreshold.toISOString().split('T')[0])
                .andWhere('inv_purchase_order_receipts.expiry_date', '>=', new Date().toISOString().split('T')[0])
                .groupBy('inv_inventory_items.id', 'inv_inventory_items.name', 'inv_inventory_items.sku', 'inv_purchase_order_receipts.batch_number', 'inv_purchase_order_receipts.brand_name', 'inv_purchase_order_receipts.expiry_date', 'inv_purchase_order_receipts.unit_price')
                .havingRaw('COALESCE(SUM(inv_purchase_order_receipts.quantity_received), 0) > COALESCE(SUM(inv_inventory_transactions.quantity), 0)')
                .orderBy('inv_purchase_order_receipts.expiry_date', sortOrder);
            if (item_id) {
                query = query.where('inv_inventory_items.id', item_id);
            }
            if (batch_number) {
                query = query.where('inv_purchase_order_receipts.batch_number', batch_number);
            }
            // Get total count
            const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
            const totalResult = await totalQuery;
            const total = parseInt(totalResult === null || totalResult === void 0 ? void 0 : totalResult.count) || 0;
            // Apply pagination
            const offset = (parseInt(page) - 1) * parseInt(count);
            const rawData = await query.limit(parseInt(count)).offset(offset);
            const expiredBatches = rawData.map((batch) => ({
                item_id: batch.item_id,
                item_name: batch.item_name,
                item_sku: batch.item_sku,
                batch_number: batch.batch_number,
                brand_name: batch.brand_name,
                expiry_date: batch.expiry_date,
                unit_price: parseFloat(batch.unit_price),
                total_received: parseInt(batch.total_received),
                total_consumed: Math.abs(parseInt(batch.total_consumed)),
                available_quantity: parseInt(batch.total_received) - Math.abs(parseInt(batch.total_consumed)),
                total_value: (parseInt(batch.total_received) - Math.abs(parseInt(batch.total_consumed))) * parseFloat(batch.unit_price),
                days_to_expiry: Math.ceil((new Date(batch.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
            }));
            // Calculate summary
            const totalExpiredQuantity = expiredBatches.reduce((sum, batch) => sum + batch.available_quantity, 0);
            const totalExpiredValue = expiredBatches.reduce((sum, batch) => sum + batch.total_value, 0);
            const uniqueItems = new Set(expiredBatches.map(batch => batch.item_id)).size;
            const uniqueBatches = expiredBatches.length;
            const expiredBatchesResponse = {
                expired_batches: expiredBatches,
                total,
                page: parseInt(page),
                count: parseInt(count),
                totalPages: Math.ceil(total / parseInt(count)),
                sortby: sortby.toUpperCase(),
                summary: {
                    total_expired_batches: uniqueBatches,
                    total_expired_quantity: totalExpiredQuantity,
                    total_expired_value: totalExpiredValue,
                    unique_items_affected: uniqueItems,
                    expiry_threshold_days: parseInt(days_to_expiry),
                    expiry_threshold_date: expiryThreshold.toISOString().split('T')[0]
                }
            };
            const response = {
                success: true,
                data: expiredBatchesResponse,
                pagination: {
                    page: parseInt(page),
                    count: parseInt(count),
                    total,
                    totalPages: Math.ceil(total / parseInt(count)),
                    sortby: sortby.toUpperCase()
                }
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error getting expired batches:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to get expired batches'
                }
            };
            res.status(500).json(response);
        }
    }
    async getExpiredBatchesForItem(req, res) {
        try {
            const model = this.getModel(req);
            const tenantId = this.getTenantId(req);
            const { item_id } = req.params;
            const { page = 1, count = 10, sortby = 'DESC', batch_number, days_to_expiry = 30 } = req.query;
            if (!item_id) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Item ID is required'
                    }
                };
                res.status(400).json(response);
                return;
            }
            const connection = await model.connection;
            const sortOrder = sortby.toUpperCase() === 'ASC' ? 'asc' : 'desc';
            // Calculate expiry threshold date
            const expiryThreshold = new Date();
            expiryThreshold.setDate(expiryThreshold.getDate() + parseInt(days_to_expiry));
            let query = connection('inv_purchase_order_receipts')
                .join('inv_purchase_order_items', 'inv_purchase_order_receipts.order_item_id', 'inv_purchase_order_items.id')
                .join('inv_inventory_items', 'inv_purchase_order_items.inventory_item_id', 'inv_inventory_items.id')
                .leftJoin('inv_inventory_transactions', function () {
                this.on('inv_inventory_transactions.batch_number', '=', 'inv_purchase_order_receipts.batch_number')
                    .andOn('inv_inventory_transactions.item_id', '=', 'inv_inventory_items.id');
            })
                .select('inv_inventory_items.id as item_id', 'inv_inventory_items.name as item_name', 'inv_inventory_items.sku as item_sku', 'inv_purchase_order_receipts.batch_number', 'inv_purchase_order_receipts.brand_name', 'inv_purchase_order_receipts.expiry_date', 'inv_purchase_order_receipts.unit_price', connection.raw('COALESCE(SUM(inv_purchase_order_receipts.quantity_received), 0) as total_received'), connection.raw('COALESCE(SUM(inv_inventory_transactions.quantity), 0) as total_consumed'))
                .where('inv_inventory_items.id', item_id)
                .andWhere('inv_purchase_order_receipts.expiry_date', '<=', expiryThreshold.toISOString().split('T')[0])
                .andWhere('inv_purchase_order_receipts.expiry_date', '>=', new Date().toISOString().split('T')[0])
                .groupBy('inv_inventory_items.id', 'inv_inventory_items.name', 'inv_inventory_items.sku', 'inv_purchase_order_receipts.batch_number', 'inv_purchase_order_receipts.brand_name', 'inv_purchase_order_receipts.expiry_date', 'inv_purchase_order_receipts.unit_price')
                .havingRaw('COALESCE(SUM(inv_purchase_order_receipts.quantity_received), 0) > COALESCE(SUM(inv_inventory_transactions.quantity), 0)')
                .orderBy('inv_purchase_order_receipts.expiry_date', sortOrder);
            if (batch_number) {
                query = query.where('inv_purchase_order_receipts.batch_number', batch_number);
            }
            // Get total count
            const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
            const totalResult = await totalQuery;
            const total = parseInt(totalResult === null || totalResult === void 0 ? void 0 : totalResult.count) || 0;
            // Apply pagination
            const offset = (parseInt(page) - 1) * parseInt(count);
            const rawData = await query.limit(parseInt(count)).offset(offset);
            const expiredBatches = rawData.map((batch) => ({
                item_id: batch.item_id,
                item_name: batch.item_name,
                item_sku: batch.item_sku,
                batch_number: batch.batch_number,
                brand_name: batch.brand_name,
                expiry_date: batch.expiry_date,
                unit_price: parseFloat(batch.unit_price),
                total_received: parseInt(batch.total_received),
                total_consumed: Math.abs(parseInt(batch.total_consumed)),
                available_quantity: parseInt(batch.total_received) - Math.abs(parseInt(batch.total_consumed)),
                total_value: (parseInt(batch.total_received) - Math.abs(parseInt(batch.total_consumed))) * parseFloat(batch.unit_price),
                days_to_expiry: Math.ceil((new Date(batch.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
            }));
            // Calculate summary for this specific item
            const totalExpiredQuantity = expiredBatches.reduce((sum, batch) => sum + batch.available_quantity, 0);
            const totalExpiredValue = expiredBatches.reduce((sum, batch) => sum + batch.total_value, 0);
            const uniqueBatches = expiredBatches.length;
            const expiredBatchesResponse = {
                expired_batches: expiredBatches,
                total,
                page: parseInt(page),
                count: parseInt(count),
                totalPages: Math.ceil(total / parseInt(count)),
                sortby: sortby.toUpperCase(),
                summary: {
                    total_expired_batches: uniqueBatches,
                    total_expired_quantity: totalExpiredQuantity,
                    total_expired_value: totalExpiredValue,
                    unique_items_affected: 1, // Since we're filtering by specific item
                    expiry_threshold_days: parseInt(days_to_expiry),
                    expiry_threshold_date: expiryThreshold.toISOString().split('T')[0]
                }
            };
            const response = {
                success: true,
                data: expiredBatchesResponse,
                pagination: {
                    page: parseInt(page),
                    count: parseInt(count),
                    total,
                    totalPages: Math.ceil(total / parseInt(count)),
                    sortby: sortby.toUpperCase()
                }
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error getting expired batches for item:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to get expired batches for item'
                }
            };
            res.status(500).json(response);
        }
    }
    async getItemTransactions(req, res) {
        try {
            const model = this.getModel(req);
            const { item_id } = req.params;
            const { days = 30, startDate, endDate, type, page = 1, count = 10 } = req.query;
            if (!item_id) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Item ID is required'
                    }
                };
                res.status(400).json(response);
                return;
            }
            // Validate pagination parameters
            const pageNum = parseInt(page);
            const countNum = parseInt(count);
            if (pageNum < 1) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Page must be greater than 0'
                    }
                };
                res.status(400).json(response);
                return;
            }
            if (countNum < 1 || countNum > 100) {
                const response = {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Count must be between 1 and 100'
                    }
                };
                res.status(400).json(response);
                return;
            }
            const result = await model.getItemStockHistory(item_id, {
                days: parseInt(days) || 30,
                startDate: startDate,
                endDate: endDate,
                type: type,
                page: pageNum,
                count: countNum
            });
            const response = {
                success: true,
                data: {
                    transactions: result.transactions,
                    pagination: {
                        page: pageNum,
                        count: countNum,
                        total: result.total,
                        totalPages: Math.ceil(result.total / countNum)
                    }
                }
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error getting item transactions:', error);
            const response = {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: error.message || 'Failed to get item transactions'
                }
            };
            res.status(500).json(response);
        }
    }
}
exports.InventoryStockController = InventoryStockController;
