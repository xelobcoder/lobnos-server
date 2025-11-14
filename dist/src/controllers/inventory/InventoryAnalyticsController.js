"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryAnalyticsController = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class InventoryAnalyticsController {
    getTenantId(req) {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId || isNaN(tenantId)) {
            throw new Error('Tenant ID is required');
        }
        return tenantId;
    }
    async getDashboardSummary(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const connection = await (0, KnexConnections_1.default)(tenantId);
            // Get inventory summary
            const inventorySummary = await connection('inv_inventory_items')
                .select(connection.raw('COUNT(*) as total_items'), connection.raw('SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_items'), connection.raw('SUM(CASE WHEN status = "low_stock" THEN 1 ELSE 0 END) as low_stock_items'), connection.raw('SUM(CASE WHEN status = "out_of_stock" THEN 1 ELSE 0 END) as out_of_stock_items'))
                .first();
            // Get total categories and suppliers
            const [categoryCount] = await connection('inv_categories').count('* as count');
            const [supplierCount] = await connection('inv_suppliers').count('* as count');
            const [locationCount] = await connection('inv_storage_locations').count('* as count');
            // Calculate total stock value (simplified - would need actual pricing)
            const totalStockValue = 0; // Placeholder - would need to calculate based on item costs
            const summary = {
                total_items: parseInt(inventorySummary.total_items) || 0,
                active_items: parseInt(inventorySummary.active_items) || 0,
                low_stock_items: parseInt(inventorySummary.low_stock_items) || 0,
                out_of_stock_items: parseInt(inventorySummary.out_of_stock_items) || 0,
                total_stock_value: totalStockValue,
                total_categories: parseInt(categoryCount.count) || 0,
                total_suppliers: parseInt(supplierCount.count) || 0,
                total_locations: parseInt(locationCount.count) || 0
            };
            const response = {
                success: true,
                message: 'Inventory dashboard summary retrieved successfully',
                data: summary
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error retrieving dashboard summary:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to retrieve dashboard summary',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async getStockStatusAnalytics(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const connection = await (0, KnexConnections_1.default)(tenantId);
            const stockStatus = await connection('inv_inventory_items')
                .select(connection.raw('SUM(CASE WHEN status = "in_stock" THEN 1 ELSE 0 END) as in_stock'), connection.raw('SUM(CASE WHEN status = "low_stock" THEN 1 ELSE 0 END) as low_stock'), connection.raw('SUM(CASE WHEN status = "out_of_stock" THEN 1 ELSE 0 END) as out_of_stock'), connection.raw('SUM(CASE WHEN status = "expired" THEN 1 ELSE 0 END) as expired'))
                .first();
            // Placeholder for stock value calculations - would need pricing data
            const stockValueByStatus = {
                in_stock: 0,
                low_stock: 0,
                out_of_stock: 0,
                expired: 0
            };
            const analytics = {
                in_stock: parseInt(stockStatus.in_stock) || 0,
                low_stock: parseInt(stockStatus.low_stock) || 0,
                out_of_stock: parseInt(stockStatus.out_of_stock) || 0,
                expired: parseInt(stockStatus.expired) || 0,
                stock_value_by_status: stockValueByStatus
            };
            const response = {
                success: true,
                message: 'Stock status analytics retrieved successfully',
                data: analytics
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error retrieving stock status analytics:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to retrieve stock status analytics',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async getPurchaseOrderAnalytics(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const connection = await (0, KnexConnections_1.default)(tenantId);
            // Get order summary
            const orderSummary = await connection('inv_purchase_orders')
                .select(connection.raw('COUNT(*) as total_orders'), connection.raw('SUM(CASE WHEN status = "ordered" THEN 1 ELSE 0 END) as pending_orders'), connection.raw('SUM(CASE WHEN status = "received" THEN 1 ELSE 0 END) as received_orders'), connection.raw('SUM(CASE WHEN status = "cancelled" THEN 1 ELSE 0 END) as cancelled_orders'), connection.raw('SUM(total_amount) as total_order_value'), connection.raw('AVG(total_amount) as average_order_value'))
                .first();
            // Get orders by month (last 12 months)
            const ordersByMonth = await connection('inv_purchase_orders')
                .select(connection.raw('DATE_FORMAT(order_date, "%Y-%m") as month'), connection.raw('COUNT(*) as count'), connection.raw('SUM(total_amount) as value'))
                .where('order_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 12 MONTH)'))
                .groupBy('month')
                .orderBy('month', 'desc');
            // Get top suppliers
            const topSuppliers = await connection('inv_purchase_orders')
                .leftJoin('inv_suppliers', 'inv_purchase_orders.supplier_id', 'inv_suppliers.id')
                .select('inv_purchase_orders.supplier_id', 'inv_suppliers.name as supplier_name', connection.raw('COUNT(*) as order_count'), connection.raw('SUM(inv_purchase_orders.total_amount) as total_value'))
                .groupBy('inv_purchase_orders.supplier_id', 'inv_suppliers.name')
                .orderBy('total_value', 'desc')
                .limit(10);
            const analytics = {
                total_orders: parseInt(orderSummary.total_orders) || 0,
                pending_orders: parseInt(orderSummary.pending_orders) || 0,
                received_orders: parseInt(orderSummary.received_orders) || 0,
                cancelled_orders: parseInt(orderSummary.cancelled_orders) || 0,
                total_order_value: parseFloat(orderSummary.total_order_value) || 0,
                average_order_value: parseFloat(orderSummary.average_order_value) || 0,
                orders_by_month: ordersByMonth.map(row => ({
                    month: row.month,
                    count: parseInt(row.count),
                    value: parseFloat(row.value)
                })),
                top_suppliers: topSuppliers.map(row => ({
                    supplier_id: row.supplier_id,
                    supplier_name: row.supplier_name,
                    order_count: parseInt(row.order_count),
                    total_value: parseFloat(row.total_value)
                }))
            };
            const response = {
                success: true,
                message: 'Purchase order analytics retrieved successfully',
                data: analytics
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error retrieving purchase order analytics:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to retrieve purchase order analytics',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async getTransactionAnalytics(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const connection = await (0, KnexConnections_1.default)(tenantId);
            const { itemid, supplierid, start_date, end_date } = req.query;
            // Get transaction summary
            const transactionSummary = await connection('inv_inventory_transactions')
                .select(connection.raw('COUNT(*) as total_transactions'), connection.raw('SUM(CASE WHEN transaction_type = "addition" THEN 1 ELSE 0 END) as additions'), connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN 1 ELSE 0 END) as consumptions'), connection.raw('SUM(CASE WHEN transaction_type = "adjustment" THEN 1 ELSE 0 END) as adjustments'), connection.raw('SUM(CASE WHEN transaction_type = "transfer" THEN 1 ELSE 0 END) as transfers'), connection.raw('SUM(CASE WHEN transaction_type = "wastage" THEN 1 ELSE 0 END) as wastage'))
                .first();
            // Get transaction trends (last 30 days)
            let transactionTrendsQuery = connection('inv_inventory_transactions')
                .select(connection.raw('DATE(transaction_date) as date'), connection.raw('SUM(CASE WHEN transaction_type = "addition" THEN 1 ELSE 0 END) as additions'), connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN 1 ELSE 0 END) as consumptions'), connection.raw('SUM(CASE WHEN transaction_type = "adjustment" THEN 1 ELSE 0 END) as adjustments'))
                .where('transaction_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 30 DAY)'));
            if (itemid) {
                transactionTrendsQuery = transactionTrendsQuery.andWhere('item_id', itemid);
            }
            if (start_date) {
                transactionTrendsQuery = transactionTrendsQuery.andWhere('transaction_date', '>=', start_date);
            }
            if (end_date) {
                transactionTrendsQuery = transactionTrendsQuery.andWhere('transaction_date', '<=', end_date);
            }
            const transactionTrends = await transactionTrendsQuery
                .groupBy('date')
                .orderBy('date', 'desc');
            // Get top consumed items
            const topConsumedItems = await connection('inv_inventory_transactions')
                .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
                .select('inv_inventory_transactions.item_id', 'inv_inventory_items.name as item_name', connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) as total_consumed'))
                .where('transaction_type', 'consumption')
                .groupBy('inv_inventory_transactions.item_id', 'inv_inventory_items.name')
                .orderBy('total_consumed', 'desc')
                .limit(10);
            const analytics = {
                total_transactions: parseInt(transactionSummary.total_transactions) || 0,
                additions: parseInt(transactionSummary.additions) || 0,
                consumptions: parseInt(transactionSummary.consumptions) || 0,
                adjustments: parseInt(transactionSummary.adjustments) || 0,
                transfers: parseInt(transactionSummary.transfers) || 0,
                wastage: parseInt(transactionSummary.wastage) || 0,
                transaction_trends: transactionTrends.map(row => ({
                    date: row.date,
                    additions: parseInt(row.additions),
                    consumptions: parseInt(row.consumptions),
                    adjustments: parseInt(row.adjustments)
                })),
                top_consumed_items: topConsumedItems.map(row => ({
                    item_id: row.item_id,
                    item_name: row.item_name,
                    total_consumed: parseInt(row.total_consumed)
                }))
            };
            const response = {
                success: true,
                message: 'Transaction analytics retrieved successfully',
                data: analytics
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error retrieving transaction analytics:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to retrieve transaction analytics',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async getPaymentAnalytics(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const connection = await (0, KnexConnections_1.default)(tenantId);
            // Get payment summary
            const paymentSummary = await connection('inv_supplier_payments')
                .select(connection.raw('COUNT(*) as total_payments'), connection.raw('SUM(CASE WHEN payment_status = "pending" THEN 1 ELSE 0 END) as pending_payments'), connection.raw('SUM(CASE WHEN payment_status = "completed" THEN 1 ELSE 0 END) as completed_payments'), connection.raw('SUM(CASE WHEN payment_status = "failed" THEN 1 ELSE 0 END) as failed_payments'), connection.raw('SUM(payment_amount) as total_payment_value'), connection.raw('AVG(payment_amount) as average_payment_value'))
                .first();
            // Get payments by method
            const paymentsByMethod = await connection('inv_supplier_payments')
                .select('payment_method')
                .select(connection.raw('COUNT(*) as count'))
                .groupBy('payment_method');
            const methodBreakdown = {};
            paymentsByMethod.forEach((row) => {
                methodBreakdown[row.payment_method] = parseInt(row.count);
            });
            // Get supplier payment summary
            const supplierPaymentSummary = await connection('inv_supplier_payments')
                .leftJoin('inv_suppliers', 'inv_supplier_payments.supplier_id', 'inv_suppliers.id')
                .select('inv_supplier_payments.supplier_id', 'inv_suppliers.name as supplier_name', connection.raw('COUNT(*) as payment_count'), connection.raw('SUM(inv_supplier_payments.payment_amount) as total_paid'), connection.raw('SUM(CASE WHEN payment_status = "pending" THEN payment_amount ELSE 0 END) as pending_amount'))
                .groupBy('inv_supplier_payments.supplier_id', 'inv_suppliers.name')
                .orderBy('total_paid', 'desc')
                .limit(10);
            const analytics = {
                total_payments: parseInt(paymentSummary.total_payments) || 0,
                pending_payments: parseInt(paymentSummary.pending_payments) || 0,
                completed_payments: parseInt(paymentSummary.completed_payments) || 0,
                failed_payments: parseInt(paymentSummary.failed_payments) || 0,
                total_payment_value: parseFloat(paymentSummary.total_payment_value) || 0,
                average_payment_value: parseFloat(paymentSummary.average_payment_value) || 0,
                payments_by_method: methodBreakdown,
                supplier_payment_summary: supplierPaymentSummary.map(row => ({
                    supplier_id: row.supplier_id,
                    supplier_name: row.supplier_name,
                    total_paid: parseFloat(row.total_paid),
                    pending_amount: parseFloat(row.pending_amount),
                    payment_count: parseInt(row.payment_count)
                }))
            };
            const response = {
                success: true,
                message: 'Payment analytics retrieved successfully',
                data: analytics
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error retrieving payment analytics:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to retrieve payment analytics',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async getCostAnalytics(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const connection = await (0, KnexConnections_1.default)(tenantId);
            // Get cost by category (simplified - would need actual pricing)
            const costByCategory = await connection('inv_inventory_items')
                .leftJoin('inv_categories', 'inv_inventory_items.category_id', 'inv_categories.id')
                .select('inv_inventory_items.category_id', 'inv_categories.name as category_name', connection.raw('COUNT(inv_inventory_items.id) as item_count'), connection.raw('SUM(inv_inventory_items.current_stock) as total_stock') // Placeholder for value
            )
                .where('inv_inventory_items.is_active', 1)
                .groupBy('inv_inventory_items.category_id', 'inv_categories.name')
                .orderBy('total_stock', 'desc');
            // Monthly cost trends (simplified)
            const monthlyTrends = await connection('inv_inventory_transactions')
                .select(connection.raw('DATE_FORMAT(transaction_date, "%Y-%m") as month'), connection.raw('SUM(CASE WHEN transaction_type = "addition" THEN COALESCE(total_cost, 0) ELSE 0 END) as additions_cost'), connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN COALESCE(total_cost, 0) ELSE 0 END) as consumption_cost'))
                .where('transaction_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 12 MONTH)'))
                .groupBy('month')
                .orderBy('month', 'desc');
            const analytics = {
                total_inventory_value: 0, // Placeholder
                average_item_cost: 0, // Placeholder
                cost_by_category: costByCategory.map(row => ({
                    category_id: row.category_id,
                    category_name: row.category_name,
                    total_value: 0, // Placeholder - would need pricing
                    item_count: parseInt(row.item_count)
                })),
                monthly_cost_trends: monthlyTrends.map(row => ({
                    month: row.month,
                    additions_cost: parseFloat(row.additions_cost),
                    consumption_cost: parseFloat(row.consumption_cost)
                }))
            };
            const response = {
                success: true,
                message: 'Cost analytics retrieved successfully',
                data: analytics
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error retrieving cost analytics:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to retrieve cost analytics',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async getSupplierAnalytics(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const connection = await (0, KnexConnections_1.default)(tenantId);
            // Get total and active suppliers
            const [totalSuppliers] = await connection('inv_suppliers').count('* as count');
            const [activeSuppliers] = await connection('inv_suppliers')
                .where('is_active', 1)
                .count('* as count');
            // Get supplier performance data
            const supplierPerformance = await connection('inv_purchase_orders')
                .leftJoin('inv_suppliers', 'inv_purchase_orders.supplier_id', 'inv_suppliers.id')
                .leftJoin('inv_supplier_payments', 'inv_purchase_orders.id', 'inv_supplier_payments.purchase_order_id')
                .select('inv_purchase_orders.supplier_id', 'inv_suppliers.name as supplier_name', 'inv_suppliers.payment_terms', connection.raw('COUNT(DISTINCT inv_purchase_orders.id) as total_orders'), connection.raw('SUM(inv_purchase_orders.total_amount) as total_value'), connection.raw('AVG(CASE WHEN inv_purchase_orders.status = "received" THEN DATEDIFF(inv_purchase_orders.received_date, inv_purchase_orders.order_date) END) as average_delivery_days'), connection.raw('SUM(CASE WHEN inv_purchase_orders.status = "received" AND DATEDIFF(inv_purchase_orders.received_date, inv_purchase_orders.order_date) <= 30 THEN 1 ELSE 0 END) / COUNT(CASE WHEN inv_purchase_orders.status = "received" THEN 1 END) * 100 as on_time_delivery_rate'))
                .whereNotNull('inv_purchase_orders.supplier_id')
                .groupBy('inv_purchase_orders.supplier_id', 'inv_suppliers.name', 'inv_suppliers.payment_terms')
                .orderBy('total_value', 'desc')
                .limit(20);
            const analytics = {
                total_suppliers: parseInt(totalSuppliers.count) || 0,
                active_suppliers: parseInt(activeSuppliers.count) || 0,
                supplier_performance: supplierPerformance.map(row => ({
                    supplier_id: row.supplier_id,
                    supplier_name: row.supplier_name || 'Unknown Supplier',
                    total_orders: parseInt(row.total_orders) || 0,
                    total_value: parseFloat(row.total_value) || 0,
                    on_time_delivery_rate: parseFloat(row.on_time_delivery_rate) || 0,
                    average_delivery_days: parseFloat(row.average_delivery_days) || 0,
                    payment_terms: row.payment_terms || 'Not specified'
                }))
            };
            const response = {
                success: true,
                message: 'Supplier analytics retrieved successfully',
                data: analytics
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error retrieving supplier analytics:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to retrieve supplier analytics',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async getStockLevelAnalytics(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const connection = await (0, KnexConnections_1.default)(tenantId);
            // Current stock on hand
            const [currentStockResult] = await connection('inv_inventory_items')
                .select(connection.raw('SUM(current_stock) as total_stock'))
                .where('is_active', 1);
            // Stock available for use (excluding allocated/reserved - simplified)
            const stockAvailableForUse = parseInt(currentStockResult === null || currentStockResult === void 0 ? void 0 : currentStockResult.total_stock) || 0;
            // Stock on order (from pending purchase orders)
            const [stockOnOrderResult] = await connection('inv_purchase_orders')
                .leftJoin('inv_purchase_order_items', 'inv_purchase_orders.id', 'inv_purchase_order_items.order_id')
                .select(connection.raw('SUM(inv_purchase_order_items.quantity_ordered - inv_purchase_order_items.quantity_received) as pending_quantity'))
                .where('inv_purchase_orders.status', 'ordered');
            // Allocated stock (simplified - would need allocation tracking)
            const allocatedStock = 0; // Placeholder
            // Stock threshold alerts
            const stockThresholdAlerts = await connection('inv_inventory_items')
                .select('id as item_id', 'name as item_name', 'current_stock', 'min_stock', 'max_stock', 'status')
                .where('is_active', 1)
                .andWhere(function () {
                this.where('current_stock', '<=', connection.raw('min_stock'))
                    .orWhere('current_stock', '>=', connection.raw('max_stock'))
                    .orWhere('status', 'out_of_stock');
            })
                .orderBy('current_stock', 'asc')
                .limit(50);
            // Days of inventory remaining
            const daysOfInventoryRemaining = await connection('inv_inventory_items')
                .leftJoin('inv_inventory_transactions', 'inv_inventory_items.id', 'inv_inventory_transactions.item_id')
                .select('inv_inventory_items.id as item_id', 'inv_inventory_items.name as item_name', 'inv_inventory_items.current_stock', connection.raw('AVG(CASE WHEN transaction_type = "consumption" THEN quantity END) as daily_consumption_rate'), connection.raw('CASE WHEN AVG(CASE WHEN transaction_type = "consumption" THEN quantity END) > 0 THEN inv_inventory_items.current_stock / AVG(CASE WHEN transaction_type = "consumption" THEN quantity END) ELSE 999 END as days_remaining'))
                .where('inv_inventory_items.is_active', 1)
                .andWhere('inv_inventory_transactions.transaction_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 30 DAY)'))
                .groupBy('inv_inventory_items.id', 'inv_inventory_items.name', 'inv_inventory_items.current_stock')
                .having('daily_consumption_rate', '>', 0)
                .orderBy('days_remaining', 'asc')
                .limit(50);
            // Predictive analytics (simplified)
            const stockOutPredictions = await connection('inv_inventory_items')
                .leftJoin('inv_inventory_transactions', 'inv_inventory_items.id', 'inv_inventory_transactions.item_id')
                .select('inv_inventory_items.id as item_id', 'inv_inventory_items.name as item_name', 'inv_inventory_items.current_stock', connection.raw('AVG(CASE WHEN transaction_type = "consumption" THEN quantity END) as daily_rate'), connection.raw('CASE WHEN AVG(CASE WHEN transaction_type = "consumption" THEN quantity END) > 0 THEN DATE_ADD(CURDATE(), INTERVAL (inv_inventory_items.current_stock / AVG(CASE WHEN transaction_type = "consumption" THEN quantity END)) DAY) ELSE NULL END as predicted_stock_out_date'), connection.raw('CASE WHEN AVG(CASE WHEN transaction_type = "consumption" THEN quantity END) > 0 THEN inv_inventory_items.current_stock / AVG(CASE WHEN transaction_type = "consumption" THEN quantity END) ELSE 999 END as days_until_stock_out'))
                .where('inv_inventory_items.is_active', 1)
                .andWhere('inv_inventory_transactions.transaction_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 30 DAY)'))
                .groupBy('inv_inventory_items.id', 'inv_inventory_items.name', 'inv_inventory_items.current_stock')
                .having('days_until_stock_out', '<=', 30)
                .orderBy('days_until_stock_out', 'asc')
                .limit(20);
            const analytics = {
                current_stock_on_hand: parseInt(currentStockResult === null || currentStockResult === void 0 ? void 0 : currentStockResult.total_stock) || 0,
                stock_available_for_use: stockAvailableForUse,
                stock_on_order: parseInt(stockOnOrderResult === null || stockOnOrderResult === void 0 ? void 0 : stockOnOrderResult.pending_quantity) || 0,
                allocated_stock: allocatedStock,
                stock_threshold_alerts: stockThresholdAlerts.map(row => ({
                    item_id: row.item_id,
                    item_name: row.item_name,
                    current_stock: parseInt(row.current_stock),
                    min_stock: parseInt(row.min_stock),
                    max_stock: parseInt(row.max_stock),
                    status: row.status,
                    alert_type: row.current_stock <= row.min_stock ? 'low_stock' :
                        row.current_stock >= row.max_stock ? 'over_stock' : 'out_of_stock'
                })),
                days_of_inventory_remaining: daysOfInventoryRemaining.map(row => ({
                    item_id: row.item_id,
                    item_name: row.item_name,
                    current_stock: parseInt(row.current_stock),
                    daily_consumption_rate: parseFloat(row.daily_consumption_rate) || 0,
                    days_remaining: parseFloat(row.days_remaining) || 0,
                    status: row.days_remaining <= 7 ? 'critical' :
                        row.days_remaining <= 30 ? 'warning' : 'normal'
                })),
                predictive_analytics: {
                    stock_out_predictions: stockOutPredictions.map(row => ({
                        item_id: row.item_id,
                        item_name: row.item_name,
                        predicted_stock_out_date: row.predicted_stock_out_date || '',
                        days_until_stock_out: parseFloat(row.days_until_stock_out) || 0
                    })),
                    overstock_predictions: [], // Placeholder - would need more complex analysis
                    safety_stock_recommendations: [] // Placeholder - would need historical analysis
                }
            };
            const response = {
                success: true,
                message: 'Stock level analytics retrieved successfully',
                data: analytics
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error retrieving stock level analytics:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to retrieve stock level analytics',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async getInventoryMovementAnalytics(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const connection = await (0, KnexConnections_1.default)(tenantId);
            // Movement by type
            const movementByType = await connection('inv_inventory_transactions')
                .select(connection.raw('SUM(CASE WHEN transaction_type = "addition" THEN quantity ELSE 0 END) as total_received'), connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) as total_issued'), connection.raw('SUM(CASE WHEN transaction_type = "adjustment" AND quantity < 0 THEN ABS(quantity) ELSE 0 END) as total_returned'), connection.raw('SUM(CASE WHEN transaction_type = "transfer" AND quantity > 0 THEN quantity ELSE 0 END) as internal_transfers_in'), connection.raw('SUM(CASE WHEN transaction_type = "transfer" AND quantity < 0 THEN ABS(quantity) ELSE 0 END) as internal_transfers_out'), connection.raw('SUM(CASE WHEN transaction_type = "adjustment" THEN quantity ELSE 0 END) as write_offs'), connection.raw('SUM(CASE WHEN transaction_type = "wastage" AND wastage_type = "expired" THEN quantity ELSE 0 END) as expired_quantity'), connection.raw('SUM(CASE WHEN transaction_type = "wastage" THEN quantity ELSE 0 END) as wastage_quantity'))
                .first();
            // Item turnover rate
            const itemTurnoverRate = await connection('inv_inventory_items')
                .leftJoin('inv_inventory_transactions', 'inv_inventory_items.id', 'inv_inventory_transactions.item_id')
                .select('inv_inventory_items.id as item_id', 'inv_inventory_items.name as item_name', 'inv_inventory_items.current_stock', connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) as consumed_quantity'), connection.raw('CASE WHEN inv_inventory_items.current_stock > 0 THEN SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) / (inv_inventory_items.current_stock * 12) ELSE 0 END as turnover_ratio'))
                .where('inv_inventory_transactions.transaction_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 365 DAY)'))
                .groupBy('inv_inventory_items.id', 'inv_inventory_items.name', 'inv_inventory_items.current_stock')
                .orderBy('turnover_ratio', 'desc')
                .limit(50);
            // Average inventory age
            const averageInventoryAge = await connection('inv_inventory_items')
                .leftJoin('inv_inventory_transactions', 'inv_inventory_items.id', 'inv_inventory_transactions.item_id')
                .select('inv_inventory_items.id as item_id', 'inv_inventory_items.name as item_name', connection.raw('MAX(inv_inventory_transactions.transaction_date) as last_movement_date'), connection.raw('DATEDIFF(CURDATE(), MAX(inv_inventory_transactions.transaction_date)) as days_since_last_movement'))
                .where('inv_inventory_items.is_active', 1)
                .groupBy('inv_inventory_items.id', 'inv_inventory_items.name')
                .orderBy('days_since_last_movement', 'desc')
                .limit(50);
            // Movement trends by month
            const movementTrends = await connection('inv_inventory_transactions')
                .select(connection.raw('DATE_FORMAT(transaction_date, "%Y-%m") as month'), connection.raw('SUM(CASE WHEN transaction_type = "addition" THEN quantity ELSE 0 END) as received'), connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) as issued'), connection.raw('SUM(CASE WHEN transaction_type = "transfer" THEN quantity ELSE 0 END) as transfers'), connection.raw('SUM(CASE WHEN transaction_type = "adjustment" THEN quantity ELSE 0 END) as adjustments'), connection.raw('SUM(quantity) as net_movement'))
                .where('transaction_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 12 MONTH)'))
                .groupBy('month')
                .orderBy('month', 'desc');
            const analytics = {
                movement_by_type: {
                    total_received: parseInt(movementByType === null || movementByType === void 0 ? void 0 : movementByType.total_received) || 0,
                    total_issued: parseInt(movementByType === null || movementByType === void 0 ? void 0 : movementByType.total_issued) || 0,
                    total_returned: parseInt(movementByType === null || movementByType === void 0 ? void 0 : movementByType.total_returned) || 0,
                    internal_transfers_in: parseInt(movementByType === null || movementByType === void 0 ? void 0 : movementByType.internal_transfers_in) || 0,
                    internal_transfers_out: parseInt(movementByType === null || movementByType === void 0 ? void 0 : movementByType.internal_transfers_out) || 0,
                    write_offs: parseInt(movementByType === null || movementByType === void 0 ? void 0 : movementByType.write_offs) || 0,
                    expired_quantity: parseInt(movementByType === null || movementByType === void 0 ? void 0 : movementByType.expired_quantity) || 0,
                    wastage_quantity: parseInt(movementByType === null || movementByType === void 0 ? void 0 : movementByType.wastage_quantity) || 0
                },
                velocity_metrics: {
                    item_turnover_rate: itemTurnoverRate.map((row, index) => ({
                        item_id: row.item_id,
                        item_name: row.item_name,
                        turnover_ratio: parseFloat(row.turnover_ratio) || 0,
                        turnover_category: row.turnover_ratio >= 12 ? 'fast' :
                            row.turnover_ratio >= 6 ? 'medium' : 'slow'
                    })),
                    average_inventory_age: averageInventoryAge.map(row => ({
                        item_id: row.item_id,
                        item_name: row.item_name,
                        average_days_in_stock: parseInt(row.days_since_last_movement) || 0,
                        last_movement_date: row.last_movement_date || ''
                    })),
                    fast_moving_items: itemTurnoverRate.filter(row => row.turnover_ratio >= 12).slice(0, 10).map((row, index) => ({
                        item_id: row.item_id,
                        item_name: row.item_name,
                        monthly_movement: parseFloat(row.consumed_quantity) / 12 || 0,
                        ranking: index + 1
                    })),
                    slow_moving_items: averageInventoryAge.filter(row => row.days_since_last_movement >= 90).slice(0, 10).map(row => ({
                        item_id: row.item_id,
                        item_name: row.item_name,
                        days_since_last_movement: parseInt(row.days_since_last_movement) || 0,
                        total_stock_value: 0 // Placeholder - would need pricing
                    }))
                },
                movement_trends: movementTrends.map(row => ({
                    month: row.month,
                    received: parseInt(row.received) || 0,
                    issued: parseInt(row.issued) || 0,
                    transfers: parseInt(row.transfers) || 0,
                    adjustments: parseInt(row.adjustments) || 0,
                    net_movement: parseInt(row.net_movement) || 0
                }))
            };
            const response = {
                success: true,
                message: 'Inventory movement analytics retrieved successfully',
                data: analytics
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error retrieving inventory movement analytics:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to retrieve inventory movement analytics',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async getBatchExpiryAnalytics(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const connection = await (0, KnexConnections_1.default)(tenantId);
            // Expiring batches (next 90 days)
            const expiringBatches = await connection('inv_inventory_batches')
                .leftJoin('inv_inventory_items', 'inv_inventory_batches.item_id', 'inv_inventory_items.id')
                .select('inv_inventory_batches.id as batch_id', 'inv_inventory_batches.batch_number', 'inv_inventory_batches.expiry_date', 'inv_inventory_batches.quantity as batch_quantity', 'inv_inventory_items.id as item_id', 'inv_inventory_items.name as item_name', connection.raw('DATEDIFF(inv_inventory_batches.expiry_date, CURDATE()) as days_until_expiry'))
                .where('inv_inventory_batches.expiry_date', '>=', connection.raw('CURDATE()'))
                .andWhere('inv_inventory_batches.expiry_date', '<=', connection.raw('DATE_ADD(CURDATE(), INTERVAL 90 DAY)'))
                .andWhere('inv_inventory_batches.quantity', '>', 0)
                .orderBy('days_until_expiry', 'asc')
                .limit(100);
            // Expired batches
            const expiredBatches = await connection('inv_inventory_batches')
                .leftJoin('inv_inventory_items', 'inv_inventory_batches.item_id', 'inv_inventory_items.id')
                .select('inv_inventory_batches.id as batch_id', 'inv_inventory_batches.batch_number', 'inv_inventory_batches.expiry_date', 'inv_inventory_batches.quantity as batch_quantity', 'inv_inventory_items.id as item_id', 'inv_inventory_items.name as item_name', connection.raw('DATEDIFF(CURDATE(), inv_inventory_batches.expiry_date) as days_expired'))
                .where('inv_inventory_batches.expiry_date', '<', connection.raw('CURDATE()'))
                .andWhere('inv_inventory_batches.quantity', '>', 0)
                .orderBy('days_expired', 'desc')
                .limit(50);
            // Batch expiry distribution
            const batchExpiryDistribution = await connection('inv_inventory_batches')
                .select(connection.raw('CASE WHEN DATEDIFF(expiry_date, CURDATE()) <= 30 THEN "0-30_days" WHEN DATEDIFF(expiry_date, CURDATE()) <= 60 THEN "31-60_days" WHEN DATEDIFF(expiry_date, CURDATE()) <= 90 THEN "61-90_days" WHEN DATEDIFF(expiry_date, CURDATE()) <= 180 THEN "91-180_days" ELSE "181+_days" END as expiry_range'), connection.raw('COUNT(*) as batch_count'), connection.raw('SUM(quantity) as total_quantity'))
                .where('expiry_date', '>=', connection.raw('CURDATE()'))
                .andWhere('quantity', '>', 0)
                .groupBy('expiry_range');
            // Items with multiple batches
            const itemsWithMultipleBatches = await connection('inv_inventory_batches')
                .leftJoin('inv_inventory_items', 'inv_inventory_batches.item_id', 'inv_inventory_items.id')
                .select('inv_inventory_items.id as item_id', 'inv_inventory_items.name as item_name', connection.raw('COUNT(inv_inventory_batches.id) as batch_count'), connection.raw('SUM(inv_inventory_batches.quantity) as total_quantity'), connection.raw('MIN(inv_inventory_batches.expiry_date) as earliest_expiry'), connection.raw('MAX(inv_inventory_batches.expiry_date) as latest_expiry'))
                .where('inv_inventory_batches.quantity', '>', 0)
                .groupBy('inv_inventory_items.id', 'inv_inventory_items.name')
                .having('batch_count', '>', 1)
                .orderBy('batch_count', 'desc')
                .limit(50);
            // Batch utilization analysis
            const batchUtilization = await connection('inv_inventory_batches')
                .leftJoin('inv_inventory_items', 'inv_inventory_batches.item_id', 'inv_inventory_items.id')
                .leftJoin('inv_inventory_transactions', function () {
                this.on('inv_inventory_batches.id', '=', 'inv_inventory_transactions.batch_id')
                    .andOn('inv_inventory_transactions.transaction_type', '=', connection.raw("'consumption'"));
            })
                .select('inv_inventory_batches.id as batch_id', 'inv_inventory_batches.batch_number', 'inv_inventory_batches.quantity as original_quantity', 'inv_inventory_batches.expiry_date', 'inv_inventory_items.id as item_id', 'inv_inventory_items.name as item_name', connection.raw('COALESCE(SUM(inv_inventory_transactions.quantity), 0) as consumed_quantity'), connection.raw('inv_inventory_batches.quantity - COALESCE(SUM(inv_inventory_transactions.quantity), 0) as remaining_quantity'), connection.raw('CASE WHEN inv_inventory_batches.quantity > 0 THEN (COALESCE(SUM(inv_inventory_transactions.quantity), 0) / inv_inventory_batches.quantity) * 100 ELSE 0 END as utilization_percentage'))
                .where('inv_inventory_batches.quantity', '>', 0)
                .groupBy('inv_inventory_batches.id', 'inv_inventory_batches.batch_number', 'inv_inventory_batches.quantity', 'inv_inventory_batches.expiry_date', 'inv_inventory_items.id', 'inv_inventory_items.name')
                .orderBy('utilization_percentage', 'asc')
                .limit(50);
            const analytics = {
                items_by_batch: expiringBatches.map(row => ({
                    batch_number: row.batch_number,
                    item_id: row.item_id,
                    item_name: row.item_name,
                    total_received: parseInt(row.batch_quantity), // Simplified
                    total_consumed: 0, // Would need consumption tracking
                    remaining_quantity: parseInt(row.batch_quantity),
                    expiry_date: row.expiry_date,
                    days_until_expiry: parseInt(row.days_until_expiry),
                    status: row.days_until_expiry <= 7 ? 'expired' : row.days_until_expiry <= 30 ? 'near_expiry' : 'fresh'
                })),
                expiry_summary: {
                    expired_stock_value: 0, // Placeholder
                    near_expiry_7_days: expiringBatches.filter(row => row.days_until_expiry <= 7).length,
                    near_expiry_30_days: expiringBatches.filter(row => row.days_until_expiry <= 30).length,
                    near_expiry_60_days: expiringBatches.filter(row => row.days_until_expiry <= 60).length,
                    expired_items_count: expiredBatches.length
                },
                batch_quality_issues: [], // Placeholder
                supplier_batch_performance: [] // Placeholder
            };
            const response = {
                success: true,
                message: 'Batch expiry analytics retrieved successfully',
                data: analytics
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error retrieving batch expiry analytics:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to retrieve batch expiry analytics',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async getProcurementAnalytics(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const connection = await (0, KnexConnections_1.default)(tenantId);
            // Supplier performance metrics
            const supplierPerformance = await connection('inv_suppliers')
                .leftJoin('inv_purchase_orders', 'inv_suppliers.id', 'inv_purchase_orders.supplier_id')
                .leftJoin('inv_purchase_order_items', 'inv_purchase_orders.id', 'inv_purchase_order_items.order_id')
                .select('inv_suppliers.id as supplier_id', 'inv_suppliers.name as supplier_name', connection.raw('COUNT(DISTINCT inv_purchase_orders.id) as total_orders'), connection.raw('SUM(inv_purchase_order_items.unit_price * inv_purchase_order_items.quantity_ordered) as total_order_value'), connection.raw('AVG(inv_purchase_orders.delivery_time_days) as lead_time_days'), connection.raw('SUM(CASE WHEN inv_purchase_orders.status = "completed" AND inv_purchase_orders.delivery_time_days <= 30 THEN 1 ELSE 0 END) / COUNT(CASE WHEN inv_purchase_orders.status = "completed" THEN 1 END) * 100 as on_time_delivery_rate'), connection.raw('CASE WHEN SUM(inv_purchase_order_items.quantity_ordered) > 0 THEN ABS(SUM(inv_purchase_order_items.quantity_ordered) - SUM(inv_purchase_order_items.quantity_received)) / SUM(inv_purchase_order_items.quantity_ordered) * 100 ELSE 0 END as delivery_discrepancy_rate'), connection.raw('0 as defect_rate'), // Placeholder - would need quality control data
            connection.raw('CASE WHEN COUNT(*) > 0 THEN (SUM(CASE WHEN inv_purchase_orders.status = "completed" THEN 1 ELSE 0 END) / COUNT(*)) * 100 ELSE 0 END as reliability_score'))
                .where('inv_purchase_orders.order_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 365 DAY)'))
                .groupBy('inv_suppliers.id', 'inv_suppliers.name')
                .orderBy('total_order_value', 'desc')
                .limit(50);
            // Purchase order trends
            const purchaseOrderTrends = await connection('inv_purchase_orders')
                .select(connection.raw('DATE_FORMAT(order_date, "%Y-%m") as month'), connection.raw('COUNT(*) as order_count'), connection.raw('SUM(total_amount) as total_value'), connection.raw('AVG(total_amount) as avg_order_value'), connection.raw('AVG(delivery_time_days) as avg_delivery_time'))
                .where('order_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 12 MONTH)'))
                .groupBy('month')
                .orderBy('month', 'desc');
            // Item procurement analysis
            const itemProcurementAnalysis = await connection('inv_inventory_items')
                .leftJoin('inv_purchase_order_items', 'inv_inventory_items.id', 'inv_purchase_order_items.item_id')
                .leftJoin('inv_purchase_orders', 'inv_purchase_order_items.order_id', 'inv_purchase_orders.id')
                .select('inv_inventory_items.id as item_id', 'inv_inventory_items.name as item_name', connection.raw('COUNT(DISTINCT inv_purchase_orders.id) as order_count'), connection.raw('SUM(inv_purchase_order_items.quantity_ordered) as total_quantity_ordered'), connection.raw('SUM(inv_purchase_order_items.quantity_received) as total_quantity_received'), connection.raw('AVG(inv_purchase_order_items.unit_price) as avg_unit_price'), connection.raw('MIN(inv_purchase_order_items.unit_price) as min_unit_price'), connection.raw('MAX(inv_purchase_order_items.unit_price) as max_unit_price'), connection.raw('SUM(inv_purchase_order_items.unit_price * inv_purchase_order_items.quantity_ordered) as total_procurement_value'))
                .where('inv_purchase_orders.order_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 365 DAY)'))
                .groupBy('inv_inventory_items.id', 'inv_inventory_items.name')
                .orderBy('total_procurement_value', 'desc')
                .limit(50);
            // Procurement cost analysis
            const procurementCostAnalysis = await connection('inv_purchase_orders')
                .leftJoin('inv_purchase_order_items', 'inv_purchase_orders.id', 'inv_purchase_order_items.order_id')
                .select(connection.raw('DATE_FORMAT(inv_purchase_orders.order_date, "%Y-%m") as month'), connection.raw('SUM(inv_purchase_order_items.unit_price * inv_purchase_order_items.quantity_ordered) as total_cost'), connection.raw('SUM(inv_purchase_order_items.quantity_ordered) as total_quantity'), connection.raw('AVG(inv_purchase_order_items.unit_price) as avg_unit_cost'), connection.raw('COUNT(DISTINCT inv_purchase_orders.id) as order_count'))
                .where('inv_purchase_orders.order_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 12 MONTH)'))
                .groupBy('month')
                .orderBy('month', 'desc');
            // Supplier reliability analysis
            const supplierReliability = await connection('inv_suppliers')
                .leftJoin('inv_purchase_orders', 'inv_suppliers.id', 'inv_purchase_orders.supplier_id')
                .select('inv_suppliers.id as supplier_id', 'inv_suppliers.name as supplier_name', connection.raw('COUNT(*) as total_orders'), connection.raw('SUM(CASE WHEN inv_purchase_orders.status = "completed" THEN 1 ELSE 0 END) as completed_orders'), connection.raw('SUM(CASE WHEN inv_purchase_orders.status = "cancelled" THEN 1 ELSE 0 END) as cancelled_orders'), connection.raw('SUM(CASE WHEN inv_purchase_orders.status = "delayed" THEN 1 ELSE 0 END) as delayed_orders'), connection.raw('AVG(CASE WHEN inv_purchase_orders.delivery_time_days IS NOT NULL THEN inv_purchase_orders.delivery_time_days END) as avg_delivery_days'), connection.raw('CASE WHEN COUNT(*) > 0 THEN (SUM(CASE WHEN inv_purchase_orders.status = "completed" THEN 1 ELSE 0 END) / COUNT(*)) * 100 ELSE 0 END as reliability_percentage'))
                .where('inv_purchase_orders.order_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 365 DAY)'))
                .groupBy('inv_suppliers.id', 'inv_suppliers.name')
                .having('total_orders', '>', 0)
                .orderBy('reliability_percentage', 'desc')
                .limit(50);
            const analytics = {
                supplier_performance: supplierPerformance.map(row => ({
                    supplier_id: row.supplier_id,
                    supplier_name: row.supplier_name,
                    lead_time_days: parseFloat(row.lead_time_days) || 0,
                    on_time_delivery_rate: parseFloat(row.on_time_delivery_rate) || 0,
                    delivery_discrepancy_rate: parseFloat(row.delivery_discrepancy_rate) || 0,
                    defect_rate: parseFloat(row.defect_rate) || 0,
                    reliability_score: parseFloat(row.reliability_score) || 0,
                    total_orders: parseInt(row.total_orders),
                    total_order_value: parseFloat(row.total_order_value) || 0
                })),
                pricing_analytics: {
                    price_history: [], // Placeholder - would need historical pricing data
                    average_cost_per_supplier: [], // Placeholder - would need supplier pricing data
                    best_suppliers: [] // Placeholder - would need comprehensive scoring
                },
                procurement_efficiency: {
                    average_po_processing_time_days: 0, // Placeholder
                    average_payment_cycle_days: 0, // Placeholder
                    emergency_purchases_count: 0, // Placeholder
                    emergency_purchase_percentage: 0, // Placeholder
                    order_accuracy_rate: 0, // Placeholder
                    supplier_response_time_avg: 0 // Placeholder
                }
            };
            const response = {
                success: true,
                message: 'Procurement analytics retrieved successfully',
                data: analytics
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error retrieving procurement analytics:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to retrieve procurement analytics',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async getCostValuationAnalytics(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const connection = await (0, KnexConnections_1.default)(tenantId);
            // Current valuation (simplified - would need actual costing methods)
            const [fifoValuation] = await connection('inv_inventory_items')
                .select(connection.raw('SUM(current_stock * COALESCE(last_purchase_price, 0)) as fifo_value'))
                .where('is_active', 1);
            const [lifoValuation] = await connection('inv_inventory_items')
                .select(connection.raw('SUM(current_stock * COALESCE(last_purchase_price, 0)) as lifo_value'))
                .where('is_active', 1); // Simplified - LIFO would need different calculation
            const [weightedAvgValuation] = await connection('inv_inventory_items')
                .select(connection.raw('SUM(current_stock * COALESCE(average_cost, last_purchase_price, 0)) as weighted_avg_value'))
                .where('is_active', 1);
            // Slow moving value
            const [slowMovingValue] = await connection('inv_inventory_items')
                .leftJoin('inv_inventory_transactions', 'inv_inventory_items.id', 'inv_inventory_transactions.item_id')
                .select(connection.raw('SUM(CASE WHEN DATEDIFF(CURDATE(), MAX(inv_inventory_transactions.transaction_date)) >= 90 THEN inv_inventory_items.current_stock * COALESCE(inv_inventory_items.last_purchase_price, 0) ELSE 0 END) as slow_moving_value'))
                .where('inv_inventory_items.is_active', 1)
                .groupBy('inv_inventory_items.id');
            // Expired stock value
            const [expiredValue] = await connection('inv_inventory_batches')
                .leftJoin('inv_inventory_items', 'inv_inventory_batches.item_id', 'inv_inventory_items.id')
                .select(connection.raw('SUM(CASE WHEN inv_inventory_batches.expiry_date < CURDATE() THEN inv_inventory_batches.quantity * COALESCE(inv_inventory_items.last_purchase_price, 0) ELSE 0 END) as expired_value'))
                .where('inv_inventory_batches.quantity', '>', 0);
            // Near expiry value
            const [nearExpiryValue] = await connection('inv_inventory_batches')
                .leftJoin('inv_inventory_items', 'inv_inventory_batches.item_id', 'inv_inventory_items.id')
                .select(connection.raw('SUM(CASE WHEN inv_inventory_batches.expiry_date >= CURDATE() AND inv_inventory_batches.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY) THEN inv_inventory_batches.quantity * COALESCE(inv_inventory_items.last_purchase_price, 0) ELSE 0 END) as near_expiry_value'))
                .where('inv_inventory_batches.quantity', '>', 0);
            // Cost trends by month
            const costTrends = await connection('inv_inventory_transactions')
                .select(connection.raw('DATE_FORMAT(transaction_date, "%Y-%m") as month'), connection.raw('SUM(CASE WHEN transaction_type = "addition" THEN COALESCE(total_cost, 0) ELSE 0 END) as additions_cost'), connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN COALESCE(total_cost, 0) ELSE 0 END) as consumption_cost'), connection.raw('SUM(CASE WHEN transaction_type = "adjustment" THEN COALESCE(total_cost, 0) ELSE 0 END) as write_off_cost'), connection.raw('SUM(COALESCE(total_cost, 0)) as net_cost_change'))
                .where('transaction_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 12 MONTH)'))
                .groupBy('month')
                .orderBy('month', 'desc');
            // Cost of goods issued
            const [cogiResult] = await connection('inv_inventory_transactions')
                .select(connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN COALESCE(total_cost, 0) ELSE 0 END) as cogi'))
                .where('transaction_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 365 DAY)'));
            // Average cost per unit
            const [avgCostResult] = await connection('inv_inventory_items')
                .select(connection.raw('AVG(COALESCE(average_cost, last_purchase_price, 0)) as avg_cost'))
                .where('is_active', 1)
                .andWhere('current_stock', '>', 0);
            const analytics = {
                current_valuation: {
                    total_stock_value_fifo: parseFloat(fifoValuation === null || fifoValuation === void 0 ? void 0 : fifoValuation.fifo_value) || 0,
                    total_stock_value_lifo: parseFloat(lifoValuation === null || lifoValuation === void 0 ? void 0 : lifoValuation.lifo_value) || 0,
                    total_stock_value_weighted_avg: parseFloat(weightedAvgValuation === null || weightedAvgValuation === void 0 ? void 0 : weightedAvgValuation.weighted_avg_value) || 0,
                    slow_moving_value: parseFloat(slowMovingValue === null || slowMovingValue === void 0 ? void 0 : slowMovingValue.slow_moving_value) || 0,
                    expired_stock_value: parseFloat(expiredValue === null || expiredValue === void 0 ? void 0 : expiredValue.expired_value) || 0,
                    near_expiry_value: parseFloat(nearExpiryValue === null || nearExpiryValue === void 0 ? void 0 : nearExpiryValue.near_expiry_value) || 0
                },
                cost_trends: costTrends.map(row => ({
                    month: row.month,
                    additions_cost: parseFloat(row.additions_cost) || 0,
                    consumption_cost: parseFloat(row.consumption_cost) || 0,
                    write_off_cost: parseFloat(row.write_off_cost) || 0,
                    net_cost_change: parseFloat(row.net_cost_change) || 0
                })),
                profitability_impact: {
                    cost_of_goods_issued: parseFloat(cogiResult === null || cogiResult === void 0 ? void 0 : cogiResult.cogi) || 0,
                    average_cost_per_unit: parseFloat(avgCostResult === null || avgCostResult === void 0 ? void 0 : avgCostResult.avg_cost) || 0,
                    cost_variance_analysis: [], // Placeholder - would need standard vs actual cost comparison
                    procurement_savings: [] // Placeholder - would need baseline vs actual cost analysis
                }
            };
            const response = {
                success: true,
                message: 'Cost valuation analytics retrieved successfully',
                data: analytics
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error retrieving cost valuation analytics:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to retrieve cost valuation analytics',
                data: null
            };
            res.status(500).json(response);
        }
    }
    async getUsageAnalytics(req, res) {
        try {
            const tenantId = this.getTenantId(req);
            const connection = await (0, KnexConnections_1.default)(tenantId);
            // Department usage analysis
            const departmentUsage = await connection('inv_inventory_transactions')
                .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
                .select(connection.raw('COALESCE(inv_inventory_transactions.department_id, "Unknown") as department_id'), connection.raw('COALESCE(inv_inventory_transactions.department_name, "Unknown Department") as department_name'), connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) as total_consumed'), connection.raw('COUNT(DISTINCT CASE WHEN transaction_type = "consumption" THEN inv_inventory_transactions.item_id END) as unique_items_used'))
                .where('inv_inventory_transactions.transaction_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 365 DAY)'))
                .andWhere('transaction_type', 'consumption')
                .groupBy('inv_inventory_transactions.department_id', 'inv_inventory_transactions.department_name')
                .orderBy('total_consumed', 'desc');
            // Calculate total consumption for percentage
            const totalConsumption = departmentUsage.reduce((sum, dept) => sum + parseInt(dept.total_consumed), 0);
            // Consumption trends
            const consumptionTrends = await connection('inv_inventory_transactions')
                .select(connection.raw('DATE_FORMAT(transaction_date, "%Y-%m-%d") as date'), connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) as total_consumed'), connection.raw('COUNT(DISTINCT CASE WHEN transaction_type = "consumption" THEN item_id END) as unique_items_used'), connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN COALESCE(total_cost, 0) ELSE 0 END) as consumption_value'))
                .where('transaction_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 90 DAY)'))
                .andWhere('transaction_type', 'consumption')
                .groupBy('date')
                .orderBy('date', 'desc');
            // Predictive usage (simplified)
            const predictiveUsage = await connection('inv_inventory_transactions')
                .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
                .select('inv_inventory_transactions.item_id', 'inv_inventory_items.name as item_name', connection.raw('AVG(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) as avg_monthly_usage'), connection.raw('STDDEV(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) as usage_stddev'), connection.raw('COUNT(CASE WHEN transaction_type = "consumption" THEN 1 END) as usage_count'))
                .where('inv_inventory_transactions.transaction_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 365 DAY)'))
                .andWhere('transaction_type', 'consumption')
                .groupBy('inv_inventory_transactions.item_id', 'inv_inventory_items.name')
                .having('usage_count', '>=', 3)
                .orderBy('avg_monthly_usage', 'desc')
                .limit(50);
            // Anomalies and red flags
            const unusualUsage = await connection('inv_inventory_transactions')
                .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
                .select('inv_inventory_transactions.item_id', 'inv_inventory_items.name as item_name', connection.raw('DATE_FORMAT(inv_inventory_transactions.transaction_date, "%Y-%m-%d") as date'), connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) as actual_usage'), connection.raw('AVG(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) OVER (PARTITION BY inv_inventory_transactions.item_id ORDER BY inv_inventory_transactions.transaction_date ROWS BETWEEN 29 PRECEDING AND 1 PRECEDING) as expected_usage'), connection.raw('CASE WHEN AVG(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) OVER (PARTITION BY inv_inventory_transactions.item_id ORDER BY inv_inventory_transactions.transaction_date ROWS BETWEEN 29 PRECEDING AND 1 PRECEDING) > 0 THEN (SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) - AVG(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) OVER (PARTITION BY inv_inventory_transactions.item_id ORDER BY inv_inventory_transactions.transaction_date ROWS BETWEEN 29 PRECEDING AND 1 PRECEDING)) / AVG(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) OVER (PARTITION BY inv_inventory_transactions.item_id ORDER BY inv_inventory_transactions.transaction_date ROWS BETWEEN 29 PRECEDING AND 1 PRECEDING) * 100 ELSE 0 END as deviation_percentage'))
                .where('inv_inventory_transactions.transaction_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 90 DAY)'))
                .andWhere('transaction_type', 'consumption')
                .groupBy('inv_inventory_transactions.item_id', 'inv_inventory_items.name', 'inv_inventory_transactions.transaction_date')
                .having('deviation_percentage', '>', 50)
                .orderBy('deviation_percentage', 'desc')
                .limit(20);
            // Stock utilization rate
            const [utilizationResult] = await connection('inv_inventory_items')
                .select(connection.raw('AVG(CASE WHEN current_stock > 0 THEN (current_stock - COALESCE(min_stock, 0)) / current_stock ELSE 0 END) as utilization_rate'))
                .where('is_active', 1);
            // Wastage rate
            const [wastageResult] = await connection('inv_inventory_transactions')
                .select(connection.raw('CASE WHEN SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) > 0 THEN SUM(CASE WHEN transaction_type = "wastage" THEN quantity ELSE 0 END) / SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) * 100 ELSE 0 END as wastage_rate'))
                .where('transaction_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 365 DAY)'));
            const analytics = {
                consumption_patterns: {
                    department_usage: departmentUsage.map(dept => ({
                        department_id: dept.department_id,
                        department_name: dept.department_name,
                        total_consumed: parseInt(dept.total_consumed),
                        percentage_of_total: totalConsumption > 0 ? (parseInt(dept.total_consumed) / totalConsumption) * 100 : 0,
                        top_items: [] // Placeholder - would need additional query
                    })),
                    consumption_trends: consumptionTrends.map(row => ({
                        date: row.date,
                        total_consumed: parseInt(row.total_consumed),
                        unique_items_used: parseInt(row.unique_items_used),
                        consumption_value: parseFloat(row.consumption_value) || 0
                    })),
                    predictive_usage: predictiveUsage.map(row => ({
                        item_id: row.item_id,
                        item_name: row.item_name,
                        predicted_monthly_usage: parseFloat(row.avg_monthly_usage) || 0,
                        confidence_level: parseFloat(row.usage_stddev) < parseFloat(row.avg_monthly_usage) * 0.3 ? 0.9 : parseFloat(row.usage_stddev) < parseFloat(row.avg_monthly_usage) * 0.5 ? 0.7 : 0.5,
                        based_on_history_months: 12
                    }))
                },
                anomalies_red_flags: {
                    unusual_usage_spikes: unusualUsage.map(row => ({
                        item_id: row.item_id,
                        item_name: row.item_name,
                        date: row.date,
                        actual_usage: parseInt(row.actual_usage),
                        expected_usage: parseFloat(row.expected_usage) || 0,
                        deviation_percentage: parseFloat(row.deviation_percentage) || 0,
                        potential_cause: parseFloat(row.deviation_percentage) > 100 ? 'Significant spike' : 'Moderate increase'
                    })),
                    potential_theft_indicators: [], // Placeholder - would need more complex analysis
                    misallocation_trends: [] // Placeholder - would need allocation tracking
                },
                usage_efficiency: {
                    stock_utilization_rate: parseFloat(utilizationResult === null || utilizationResult === void 0 ? void 0 : utilizationResult.utilization_rate) || 0,
                    average_usage_per_department: departmentUsage.length > 0 ? totalConsumption / departmentUsage.length : 0,
                    wastage_rate: parseFloat(wastageResult === null || wastageResult === void 0 ? void 0 : wastageResult.wastage_rate) || 0,
                    optimal_ordering_patterns: [] // Placeholder - would need complex analysis
                }
            };
            const response = {
                success: true,
                message: 'Usage analytics retrieved successfully',
                data: analytics
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error retrieving usage analytics:', error);
            const response = {
                success: false,
                message: error.message || 'Failed to retrieve usage analytics',
                data: null
            };
            res.status(500).json(response);
        }
    }
}
exports.InventoryAnalyticsController = InventoryAnalyticsController;
