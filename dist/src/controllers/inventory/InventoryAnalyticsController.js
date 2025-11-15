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
            let stockStatusQuery = connection('inv_inventory_items')
                .select(connection.raw('SUM(CASE WHEN status = "in_stock" THEN 1 ELSE 0 END) as in_stock'), connection.raw('SUM(CASE WHEN status = "low_stock" THEN 1 ELSE 0 END) as low_stock'), connection.raw('SUM(CASE WHEN status = "out_of_stock" THEN 1 ELSE 0 END) as out_of_stock'), connection.raw('SUM(CASE WHEN status = "expired" THEN 1 ELSE 0 END) as expired'));
            const stockStatus = await stockStatusQuery.first();
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
            // Utility function for raw results
            const parseRawResult = (result) => (result === null || result === void 0 ? void 0 : result[0]) || [];
            // 1. Purchase Order Volume and Status Analysis - FIXED to use actual receipt values
            const poVolumeAnalysis = await connection('inv_purchase_orders')
                .leftJoin('inv_purchase_order_receipts', 'inv_purchase_orders.id', 'inv_purchase_order_receipts.order_id')
                .select(connection.raw('COUNT(DISTINCT inv_purchase_orders.id) as total_orders'), connection.raw('COALESCE(SUM(inv_purchase_order_receipts.quantity_received * inv_purchase_order_receipts.unit_price), 0) as total_order_value'), connection.raw('COALESCE(AVG(inv_purchase_order_receipts.quantity_received * inv_purchase_order_receipts.unit_price), 0) as avg_order_value'), 'inv_purchase_orders.status', connection.raw('YEAR(inv_purchase_orders.order_date) as order_year'), connection.raw('MONTH(inv_purchase_orders.order_date) as order_month'))
                .groupBy('inv_purchase_orders.status', 'order_year', 'order_month')
                .orderBy('order_year', 'desc')
                .orderBy('order_month', 'desc');
            // 2. Supplier Performance Analysis - FIXED to use actual receipt values
            const supplierPerformance = await connection('inv_purchase_orders')
                .leftJoin('inv_suppliers', 'inv_purchase_orders.supplier_id', 'inv_suppliers.id')
                .leftJoin('inv_purchase_order_receipts', 'inv_purchase_orders.id', 'inv_purchase_order_receipts.order_id')
                .select('inv_suppliers.id as supplier_id', 'inv_suppliers.name as supplier_name', connection.raw('COUNT(DISTINCT inv_purchase_orders.id) as total_orders'), connection.raw('COALESCE(SUM(inv_purchase_order_receipts.quantity_received * inv_purchase_order_receipts.unit_price), 0) as total_spend'), connection.raw('COALESCE(AVG(inv_purchase_order_receipts.quantity_received * inv_purchase_order_receipts.unit_price), 0) as avg_order_value'), connection.raw('COUNT(DISTINCT CASE WHEN inv_purchase_orders.status = "received" THEN inv_purchase_orders.id END) as completed_orders'), connection.raw('COUNT(DISTINCT CASE WHEN inv_purchase_orders.status = "cancelled" THEN inv_purchase_orders.id END) as cancelled_orders'))
                .where('inv_suppliers.is_active', 1)
                .groupBy('inv_suppliers.id', 'inv_suppliers.name')
                .orderBy('total_spend', 'desc');
            // 3. Lead Time Analysis - FIXED
            const leadTimeAnalysis = await connection.raw(`
            SELECT
                po.id as order_id,
                po.order_number,
                po.order_date,
                po.expected_delivery_date,
                MIN(por.received_date) as actual_receipt_date,
                DATEDIFF(MIN(por.received_date), po.order_date) as total_lead_time_days,
                DATEDIFF(MIN(por.received_date), po.expected_delivery_date) as delivery_delay_days,
                s.name as supplier_name,
                CASE
                    WHEN MIN(por.received_date) <= po.expected_delivery_date THEN 'on_time'
                    WHEN DATEDIFF(MIN(por.received_date), po.expected_delivery_date) <= 3 THEN 'slightly_delayed'
                    ELSE 'significantly_delayed'
                END as delivery_status
            FROM inv_purchase_orders po
            JOIN inv_suppliers s ON po.supplier_id = s.id
            JOIN inv_purchase_order_receipts por ON po.id = por.order_id
            WHERE po.status = 'received'
                AND por.received_date IS NOT NULL
                AND po.expected_delivery_date IS NOT NULL
            GROUP BY po.id, po.order_number, po.order_date, po.expected_delivery_date, s.name
            ORDER BY total_lead_time_days DESC
        `);
            // 4. Purchase Order Efficiency Metrics - FIXED
            const efficiencyMetrics = await connection.raw(`
            WITH order_stats AS (
                SELECT
                    po.id as order_id,
                    po.order_number,
                    COUNT(poi.id) as total_line_items,
                    SUM(poi.quantity_ordered) as total_quantity_ordered,
                    SUM(poi.quantity_received) as total_quantity_received,
                    SUM(CASE WHEN poi.status = 'received' THEN 1 ELSE 0 END) as fully_received_items,
                    SUM(CASE WHEN poi.status = 'partially_received' THEN 1 ELSE 0 END) as partially_received_items,
                    SUM(CASE WHEN poi.status = 'pending' THEN 1 ELSE 0 END) as pending_items
                FROM inv_purchase_orders po
                LEFT JOIN inv_purchase_order_items poi ON po.id = poi.order_id
                GROUP BY po.id, po.order_number
            )
            SELECT
                COUNT(*) as total_orders_analyzed,
                AVG(total_line_items) as avg_line_items_per_order,
                AVG(total_quantity_ordered) as avg_quantity_per_order,
                AVG(total_quantity_received / NULLIF(total_quantity_ordered, 0)) as avg_fulfillment_rate,
                SUM(fully_received_items) / SUM(total_line_items) as overall_fulfillment_rate,
                COUNT(CASE WHEN partially_received_items > 0 THEN 1 END) as orders_with_partial_receipts,
                COUNT(CASE WHEN pending_items = total_line_items THEN 1 END) as orders_fully_pending
            FROM order_stats
        `);
            // 5. Monthly Trend Analysis - FIXED (MariaDB compatible) - Now using actual receipt values
            const monthlyTrends = await connection('inv_purchase_orders')
                .leftJoin('inv_purchase_order_receipts', 'inv_purchase_orders.id', 'inv_purchase_order_receipts.order_id')
                .select(connection.raw('YEAR(inv_purchase_orders.order_date) as year'), connection.raw('MONTH(inv_purchase_orders.order_date) as month'), connection.raw("DATE_FORMAT(inv_purchase_orders.order_date, '%Y-%m') as period"), connection.raw('COUNT(DISTINCT inv_purchase_orders.id) as order_count'), connection.raw('COALESCE(SUM(inv_purchase_order_receipts.quantity_received * inv_purchase_order_receipts.unit_price), 0) as total_order_value'), connection.raw('COALESCE(AVG(inv_purchase_order_receipts.quantity_received * inv_purchase_order_receipts.unit_price), 0) as avg_order_value'), connection.raw("COUNT(DISTINCT CASE WHEN inv_purchase_orders.status = 'received' THEN inv_purchase_orders.id END) as completed_orders"), connection.raw("COUNT(DISTINCT CASE WHEN inv_purchase_orders.status = 'ordered' THEN inv_purchase_orders.id END) as pending_orders"), connection.raw("COUNT(DISTINCT CASE WHEN inv_purchase_orders.status = 'cancelled' THEN inv_purchase_orders.id END) as cancelled_orders"))
                .groupByRaw("YEAR(inv_purchase_orders.order_date), MONTH(inv_purchase_orders.order_date), DATE_FORMAT(inv_purchase_orders.order_date, '%Y-%m')")
                .orderBy('year', 'desc')
                .orderBy('month', 'desc');
            // 6. Open Purchase Orders Analysis - FIXED
            const openOrdersAnalysis = await connection.raw(`
            SELECT
                po.id as order_id,
                po.order_number,
                po.order_date,
                po.expected_delivery_date,
                s.name as supplier_name,
                COUNT(poi.id) as total_line_items,
                SUM(poi.quantity_ordered) as total_quantity_ordered,
                SUM(poi.quantity_received) as total_quantity_received,
                SUM(poi.quantity_ordered - poi.quantity_received) as pending_quantity,
                SUM(poi.line_total) as total_order_value,
                DATEDIFF(CURDATE(), po.order_date) as days_since_order,
                DATEDIFF(CURDATE(), po.expected_delivery_date) as days_past_expected_delivery,
                CASE
                    WHEN DATEDIFF(CURDATE(), po.expected_delivery_date) > 7 THEN 'overdue'
                    WHEN DATEDIFF(CURDATE(), po.expected_delivery_date) > 0 THEN 'late'
                    ELSE 'on_track'
                END as delivery_status
            FROM inv_purchase_orders po
            JOIN inv_suppliers s ON po.supplier_id = s.id
            LEFT JOIN inv_purchase_order_items poi ON po.id = poi.order_id
            WHERE po.status IN ('ordered', 'partially_received')
            GROUP BY po.id, po.order_number, po.order_date, po.expected_delivery_date, s.name
            HAVING pending_quantity > 0
            ORDER BY days_past_expected_delivery DESC
        `);
            // 7. Communication Method Analysis - FIXED to use actual receipt values
            const communicationAnalysis = await connection('inv_purchase_orders')
                .leftJoin('inv_purchase_order_receipts', 'inv_purchase_orders.id', 'inv_purchase_order_receipts.order_id')
                .select('inv_purchase_orders.communication_method', connection.raw('COUNT(DISTINCT inv_purchase_orders.id) as order_count'), connection.raw('COALESCE(SUM(inv_purchase_order_receipts.quantity_received * inv_purchase_order_receipts.unit_price), 0) as total_value'), connection.raw('COALESCE(AVG(inv_purchase_order_receipts.quantity_received * inv_purchase_order_receipts.unit_price), 0) as avg_order_value'), connection.raw("COUNT(DISTINCT CASE WHEN inv_purchase_orders.status = 'received' THEN inv_purchase_orders.id END) as completed_orders"), connection.raw("COUNT(DISTINCT CASE WHEN inv_purchase_orders.status = 'cancelled' THEN inv_purchase_orders.id END) as cancelled_orders"))
                .whereNotNull('inv_purchase_orders.communication_method')
                .groupBy('inv_purchase_orders.communication_method')
                .orderBy('total_value', 'desc');
            // Parse all raw results
            const leadTimeData = parseRawResult(leadTimeAnalysis);
            const efficiencyData = parseRawResult(efficiencyMetrics);
            const openOrdersData = parseRawResult(openOrdersAnalysis);
            const analytics = {
                volume_analysis: (() => {
                    // Group by period and calculate totals
                    const periodGroups = {};
                    poVolumeAnalysis.forEach(row => {
                        const period = `${row.order_year}-${String(row.order_month).padStart(2, '0')}`;
                        if (!periodGroups[period]) {
                            periodGroups[period] = [];
                        }
                        periodGroups[period].push(row);
                    });
                    // Create volume analysis with totals
                    const result = [];
                    Object.keys(periodGroups).forEach(period => {
                        const periodData = periodGroups[period];
                        // Add individual status entries
                        periodData.forEach(row => {
                            result.push({
                                period: period,
                                status: row.status,
                                order_count: parseInt(row.total_orders),
                                total_value: parseFloat(row.total_order_value) || 0,
                                avg_order_value: parseFloat(row.avg_order_value) || 0
                            });
                        });
                        // Calculate and add total for this period
                        const totalOrderCount = periodData.reduce((sum, row) => sum + parseInt(row.total_orders), 0);
                        const totalValue = periodData.reduce((sum, row) => sum + (parseFloat(row.total_order_value) || 0), 0);
                        const weightedAvgOrderValue = totalValue / totalOrderCount;
                        result.push({
                            period: period,
                            status: 'total',
                            order_count: totalOrderCount,
                            total_value: totalValue,
                            avg_order_value: weightedAvgOrderValue || 0
                        });
                    });
                    return result;
                })(),
                supplier_performance: supplierPerformance.map(row => ({
                    supplier_id: row.supplier_id,
                    supplier_name: row.supplier_name,
                    total_orders: parseInt(row.total_orders),
                    total_spend: parseFloat(row.total_spend) || 0,
                    avg_order_value: parseFloat(row.avg_order_value) || 0,
                    completion_rate: parseInt(row.completed_orders) / parseInt(row.total_orders),
                    cancellation_rate: parseInt(row.cancelled_orders) / parseInt(row.total_orders)
                })),
                lead_time_analysis: leadTimeData.map(row => ({
                    order_id: row.order_id,
                    order_number: row.order_number,
                    supplier_name: row.supplier_name,
                    total_lead_time: parseInt(row.total_lead_time_days),
                    delivery_delay: parseInt(row.delivery_delay_days),
                    delivery_status: row.delivery_status,
                    on_time: row.delivery_status === 'on_time'
                })),
                efficiency_metrics: efficiencyData.length > 0 ? {
                    total_orders_analyzed: parseInt(efficiencyData[0].total_orders_analyzed) || 0,
                    avg_line_items_per_order: parseFloat(efficiencyData[0].avg_line_items_per_order) || 0,
                    avg_quantity_per_order: parseFloat(efficiencyData[0].avg_quantity_per_order) || 0,
                    overall_fulfillment_rate: parseFloat(efficiencyData[0].overall_fulfillment_rate) || 0,
                    orders_with_partial_receipts: parseInt(efficiencyData[0].orders_with_partial_receipts) || 0,
                    orders_fully_pending: parseInt(efficiencyData[0].orders_fully_pending) || 0
                } : null,
                monthly_trends: monthlyTrends.map(row => ({
                    period: row.period,
                    order_count: parseInt(row.order_count),
                    total_value: parseFloat(row.total_order_value) || 0,
                    avg_order_value: parseFloat(row.avg_order_value) || 0,
                    completion_rate: parseInt(row.completed_orders) / parseInt(row.order_count),
                    pending_rate: parseInt(row.pending_orders) / parseInt(row.order_count)
                })),
                open_orders: openOrdersData.map(row => ({
                    order_id: row.order_id,
                    order_number: row.order_number,
                    supplier_name: row.supplier_name,
                    days_since_order: parseInt(row.days_since_order),
                    days_past_expected: parseInt(row.days_past_expected_delivery),
                    pending_quantity: parseInt(row.pending_quantity),
                    total_value: parseFloat(row.total_order_value) || 0,
                    delivery_status: row.delivery_status
                })),
                communication_analysis: communicationAnalysis.map(row => ({
                    method: row.communication_method,
                    order_count: parseInt(row.order_count),
                    total_value: parseFloat(row.total_value) || 0,
                    avg_order_value: parseFloat(row.avg_order_value) || 0,
                    completion_rate: parseInt(row.completed_orders) / parseInt(row.order_count)
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
            const { itemid, supplierid } = req.query;
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
            const { supplierId } = req.query;
            if (!supplierId) {
                const response = {
                    success: false,
                    message: 'Supplier ID is required',
                    data: null
                };
                res.status(400).json(response);
                return;
            }
            // Utility function for raw results
            const parseRawResult = (result) => (result === null || result === void 0 ? void 0 : result[0]) || [];
            // 1. Supplier Basic Info & Performance Scorecard
            const supplierScorecard = await connection.raw(`
                    WITH supplier_metrics AS (
                         SELECT
                              s.id as supplier_id,
                              s.name as supplier_name,
                              s.contact,
                              s.email,
                              s.phone,
                              s.address,
                              s.is_active,

                              -- Order Volume Metrics
                              COUNT(po.id) as total_orders,
                              SUM(po.total_amount) as total_spend,
                              AVG(po.total_amount) as avg_order_value,
                              MAX(po.total_amount) as largest_order,
                              MIN(po.total_amount) as smallest_order,

                              -- Order Status Metrics
                              SUM(CASE WHEN po.status = 'received' THEN 1 ELSE 0 END) as completed_orders,
                              SUM(CASE WHEN po.status = 'ordered' THEN 1 ELSE 0 END) as pending_orders,
                              SUM(CASE WHEN po.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
                              SUM(CASE WHEN po.status = 'partially_received' THEN 1 ELSE 0 END) as partially_received_orders,

                              -- Lead Time Performance
                              AVG(DATEDIFF(por.received_date, po.order_date)) as avg_lead_time_days,
                              STDDEV(DATEDIFF(por.received_date, po.order_date)) as lead_time_std_dev,
                              AVG(DATEDIFF(por.received_date, po.expected_delivery_date)) as avg_delivery_delay,

                              -- Quality Metrics
                              COUNT(por.id) as total_receipts,
                              SUM(CASE WHEN por.condition_status = 'good' THEN 1 ELSE 0 END) as good_condition_receipts,
                              SUM(CASE WHEN por.condition_status = 'acceptable' THEN 1 ELSE 0 END) as acceptable_condition_receipts,
                              SUM(CASE WHEN por.condition_status IN ('damaged', 'expired') THEN 1 ELSE 0 END) as problematic_receipts,
                              SUM(CASE WHEN por.quality_check_passed = 0 THEN 1 ELSE 0 END) as failed_quality_checks,

                              -- Item Variety
                              COUNT(DISTINCT poi.inventory_item_id) as unique_items_supplied,

                              -- Activity Timeline
                              MAX(po.order_date) as last_order_date,
                              MIN(po.order_date) as first_order_date,
                              COUNT(DISTINCT MONTH(po.order_date)) as active_months

                         FROM inv_suppliers s
                         LEFT JOIN inv_purchase_orders po ON s.id = po.supplier_id
                         LEFT JOIN inv_purchase_order_receipts por ON po.id = por.order_id
                         LEFT JOIN inv_purchase_order_items poi ON po.id = poi.order_id
                         WHERE s.id = ?
                         GROUP BY s.id, s.name, s.contact, s.email, s.phone, s.address, s.is_active
                    ),
                    supplier_scores AS (
                         SELECT
                              *,
                              -- Performance Score (0-100)
                              CASE
                                   WHEN total_orders = 0 THEN 50  -- Default score for new suppliers
                                   ELSE ROUND(
                                        -- Order Completion (30%)
                                        (completed_orders / total_orders * 30) +
                                        -- Lead Time Reliability (25%)
                                        (GREATEST(0, 25 - (avg_delivery_delay * 2))) +
                                        -- Quality Performance (25%)
                                        (CASE
                                             WHEN total_receipts > 0 THEN (good_condition_receipts / total_receipts * 25)
                                             ELSE 20
                                        END) +
                                        -- Order Volume (10%)
                                        (LEAST(10, total_orders * 0.5)) +
                                        -- Consistency (10%)
                                        (GREATEST(0, 10 - (lead_time_std_dev * 0.5)))
                                   )
                              END as performance_score
                         FROM supplier_metrics
                    ),
                    supplier_classifications AS (
                         SELECT
                              *,
                              -- Risk Classification
                              CASE
                                   WHEN total_orders = 0 THEN 'New Supplier'
                                   WHEN performance_score >= 80 THEN 'High Performer'
                                   WHEN performance_score >= 60 THEN 'Reliable'
                                   WHEN performance_score >= 40 THEN 'Needs Attention'
                                   ELSE 'High Risk'
                              END as risk_category,

                              -- Strategic Importance
                              CASE
                                   WHEN unique_items_supplied > 5 OR total_spend > 10000 THEN 'Strategic'
                                   WHEN unique_items_supplied > 2 OR total_spend > 5000 THEN 'Important'
                                   ELSE 'Standard'
                              END as strategic_importance
                         FROM supplier_scores
                    )
                    SELECT
                         supplier_id,
                         supplier_name,
                         contact,
                         email,
                         phone,
                         address,
                         is_active,
                         total_orders,
                         total_spend,
                         avg_order_value,
                         largest_order,
                         smallest_order,
                         completed_orders,
                         pending_orders,
                         cancelled_orders,
                         partially_received_orders,
                         avg_lead_time_days,
                         lead_time_std_dev,
                         avg_delivery_delay,
                         total_receipts,
                         good_condition_receipts,
                         acceptable_condition_receipts,
                         problematic_receipts,
                         failed_quality_checks,
                         unique_items_supplied,
                         last_order_date,
                         first_order_date,
                         active_months,
                         performance_score,
                         risk_category,
                         strategic_importance,
                         DATEDIFF(CURDATE(), last_order_date) as days_since_last_order,
                         DATEDIFF(CURDATE(), first_order_date) as days_since_first_order
                    FROM supplier_classifications
               `, [supplierId]);
            // 2. Monthly Spend & Order Trends
            const monthlyTrends = await connection.raw(`
                    SELECT
                         YEAR(po.order_date) as year,
                         MONTH(po.order_date) as month,
                         COUNT(po.id) as monthly_orders,
                         SUM(po.total_amount) as monthly_spend
                    FROM inv_purchase_orders po
                    WHERE po.supplier_id = ?
                    GROUP BY YEAR(po.order_date), MONTH(po.order_date)
                    ORDER BY year DESC, month DESC
               `, [supplierId]);
            // 3. Delivery Performance & Lead Time Analysis
            const deliveryPerformance = await connection.raw(`
                    WITH delivery_data AS (
                         SELECT
                              po.id as order_id,
                              po.order_number,
                              po.order_date,
                              po.expected_delivery_date,
                              MIN(por.received_date) as actual_receipt_date,
                              DATEDIFF(MIN(por.received_date), po.order_date) as actual_lead_time,
                              DATEDIFF(po.expected_delivery_date, po.order_date) as promised_lead_time,
                              DATEDIFF(MIN(por.received_date), po.expected_delivery_date) as delivery_delay,

                              CASE
                                   WHEN MIN(por.received_date) <= po.expected_delivery_date THEN 'On Time'
                                   WHEN DATEDIFF(MIN(por.received_date), po.expected_delivery_date) <= 2 THEN 'Slightly Late (1-2 days)'
                                   WHEN DATEDIFF(MIN(por.received_date), po.expected_delivery_date) <= 7 THEN 'Moderately Late (3-7 days)'
                                   ELSE 'Severely Late (>7 days)'
                              END as delivery_performance

                         FROM inv_purchase_orders po
                         JOIN inv_purchase_order_receipts por ON po.id = por.order_id
                         WHERE po.supplier_id = ?
                              AND po.status = 'received'
                              AND por.received_date IS NOT NULL
                              AND po.expected_delivery_date IS NOT NULL
                         GROUP BY po.id, po.order_number, po.order_date, po.expected_delivery_date
                    )
                    SELECT
                         COUNT(*) as total_deliveries,

                         -- Lead Time Metrics
                         AVG(actual_lead_time) as avg_actual_lead_time,
                         AVG(promised_lead_time) as avg_promised_lead_time,
                         AVG(actual_lead_time - promised_lead_time) as avg_lead_time_variance,
                         STDDEV(actual_lead_time) as lead_time_consistency,
                         MIN(actual_lead_time) as min_lead_time,
                         MAX(actual_lead_time) as max_lead_time,

                         -- On-Time Performance
                         SUM(CASE WHEN delivery_performance = 'On Time' THEN 1 ELSE 0 END) as on_time_deliveries,
                         SUM(CASE WHEN delivery_performance LIKE '%Late%' THEN 1 ELSE 0 END) as late_deliveries,
                         AVG(CASE WHEN delivery_performance = 'On Time' THEN 1 ELSE 0 END) as on_time_rate,

                         -- Delay Analysis
                         AVG(delivery_delay) as avg_delay_days,
                         MAX(delivery_delay) as max_delay_days,
                         SUM(CASE WHEN delivery_delay > 7 THEN 1 ELSE 0 END) as severe_delays,

                         -- Performance Categories
                         CASE
                              WHEN AVG(CASE WHEN delivery_performance = 'On Time' THEN 1 ELSE 0 END) >= 0.95 THEN 'Excellent'
                              WHEN AVG(CASE WHEN delivery_performance = 'On Time' THEN 1 ELSE 0 END) >= 0.85 THEN 'Good'
                              WHEN AVG(CASE WHEN delivery_performance = 'On Time' THEN 1 ELSE 0 END) >= 0.70 THEN 'Fair'
                              ELSE 'Poor'
                         END as delivery_reliability_rating

                    FROM delivery_data
               `, [supplierId]);
            // 4. Quality & Product Performance
            const qualityMetrics = await connection.raw(`
                    SELECT
                         -- Receipt Quality Analysis
                         COUNT(por.id) as total_receipts,
                         SUM(CASE WHEN por.condition_status = 'good' THEN 1 ELSE 0 END) as good_condition_count,
                         SUM(CASE WHEN por.condition_status = 'acceptable' THEN 1 ELSE 0 END) as acceptable_condition_count,
                         SUM(CASE WHEN por.condition_status IN ('damaged', 'expired') THEN 1 ELSE 0 END) as poor_condition_count,
                         SUM(CASE WHEN por.quality_check_passed = 1 THEN 1 ELSE 0 END) as passed_quality_checks,
                         SUM(CASE WHEN por.quality_check_passed = 0 THEN 1 ELSE 0 END) as failed_quality_checks,

                         -- Quality Scores
                         CASE
                              WHEN COUNT(por.id) = 0 THEN 100
                              ELSE ROUND((SUM(CASE WHEN por.condition_status = 'good' THEN 1 ELSE 0 END) / COUNT(por.id)) * 100, 2)
                         END as condition_quality_score,

                         CASE
                              WHEN COUNT(por.id) = 0 THEN 100
                              ELSE ROUND((SUM(CASE WHEN por.quality_check_passed = 1 THEN 1 ELSE 0 END) / COUNT(por.id)) * 100, 2)
                         END as quality_check_score,

                         -- Batch Expiry Analysis
                         AVG(DATEDIFF(por.expiry_date, por.received_date)) as avg_shelf_life_on_arrival,
                         SUM(CASE WHEN por.expiry_date < CURDATE() THEN 1 ELSE 0 END) as expired_on_arrival,
                         SUM(CASE WHEN DATEDIFF(por.expiry_date, por.received_date) < 30 THEN 1 ELSE 0 END) as short_shelf_life_items,

                         -- Quality Rating
                         CASE
                              WHEN COUNT(por.id) = 0 THEN 'Unknown'
                              WHEN (SUM(CASE WHEN por.condition_status = 'good' THEN 1 ELSE 0 END) / COUNT(por.id)) >= 0.95 THEN 'Excellent'
                              WHEN (SUM(CASE WHEN por.condition_status = 'good' THEN 1 ELSE 0 END) / COUNT(por.id)) >= 0.85 THEN 'Good'
                              WHEN (SUM(CASE WHEN por.condition_status = 'good' THEN 1 ELSE 0 END) / COUNT(por.id)) >= 0.70 THEN 'Fair'
                              ELSE 'Poor'
                         END as overall_quality_rating

                    FROM inv_purchase_order_receipts por
                    JOIN inv_purchase_orders po ON por.order_id = po.id
                    WHERE po.supplier_id = ?
               `, [supplierId]);
            // 5. Product Portfolio Analysis
            const productPortfolio = await connection.raw(`
                    SELECT
                         i.id as item_id,
                         i.name as item_name,
                         i.sku,
                         c.name as category_name,
                         COUNT(poi.id) as times_ordered,
                         SUM(poi.quantity_ordered) as total_quantity_ordered,
                         SUM(poi.quantity_received) as total_quantity_received,
                         AVG(poi.unit_price) as avg_unit_price,
                         MIN(poi.unit_price) as min_unit_price,
                         MAX(poi.unit_price) as max_unit_price,
                         SUM(poi.line_total) as total_spend_on_item,

                         -- Price Stability
                         STDDEV(poi.unit_price) as price_volatility,

                         -- Order Efficiency
                         AVG(poi.quantity_received / NULLIF(poi.quantity_ordered, 0)) as avg_fulfillment_rate,

                         -- Recent Activity
                         MAX(po.order_date) as last_ordered_date,
                         DATEDIFF(CURDATE(), MAX(po.order_date)) as days_since_last_order

                    FROM inv_purchase_order_items poi
                    JOIN inv_purchase_orders po ON poi.order_id = po.id
                    JOIN inv_inventory_items i ON poi.inventory_item_id = i.id
                    LEFT JOIN inv_categories c ON i.category_id = c.id
                    WHERE po.supplier_id = ?
                    GROUP BY i.id, i.name, i.sku, c.name
                    ORDER BY total_spend_on_item DESC
               `, [supplierId]);
            // 6. Recent Order Activity
            const recentOrders = await connection.raw(`
                    SELECT
                         po.id as order_id,
                         po.order_number,
                         po.order_date,
                         po.expected_delivery_date,
                         po.status,
                         po.total_amount,
                         COUNT(poi.id) as line_item_count,
                         SUM(poi.quantity_ordered) as total_quantity_ordered,
                         SUM(poi.quantity_received) as total_quantity_received,
                         SUM(poi.quantity_ordered - poi.quantity_received) as pending_quantity,

                         -- Delivery Status
                         CASE
                              WHEN po.status = 'received' THEN 'Completed'
                              WHEN po.status = 'cancelled' THEN 'Cancelled'
                              WHEN CURDATE() > po.expected_delivery_date THEN 'Overdue'
                              ELSE 'In Progress'
                         END as delivery_status,

                         DATEDIFF(CURDATE(), po.order_date) as days_since_order,
                         DATEDIFF(CURDATE(), po.expected_delivery_date) as days_past_due

                    FROM inv_purchase_orders po
                    LEFT JOIN inv_purchase_order_items poi ON po.id = poi.order_id
                    WHERE po.supplier_id = ?
                    GROUP BY po.id, po.order_number, po.order_date, po.expected_delivery_date, po.status, po.total_amount
                    ORDER BY po.order_date DESC
                    LIMIT 20
               `, [supplierId]);
            // 7. Payment History
            const paymentHistory = await connection.raw(`
                    SELECT
                         sp.id as payment_id,
                         sp.payment_id as payment_reference,
                         sp.payment_amount,
                         sp.payment_date,
                         sp.payment_method,
                         sp.payment_status,
                         sp.reference_number,
                         sp.payment_notes,
                         sp.approved_by,
                         sp.approved_at,
                         sp.processed_at,
                         po.order_number,
                         po.total_amount as order_total

                    FROM inv_supplier_payments sp
                    JOIN inv_purchase_orders po ON sp.purchase_order_id = po.id
                    WHERE sp.supplier_id = ?
                    ORDER BY sp.payment_date DESC
                    LIMIT 20
               `, [supplierId]);
            // Parse all results
            const scorecardData = parseRawResult(supplierScorecard);
            const monthlyTrendsData = parseRawResult(monthlyTrends);
            const deliveryData = parseRawResult(deliveryPerformance);
            const qualityData = parseRawResult(qualityMetrics);
            const portfolioData = parseRawResult(productPortfolio);
            const recentOrdersData = parseRawResult(recentOrders);
            const paymentData = parseRawResult(paymentHistory);
            const analytics = {
                supplier_info: scorecardData.length > 0 ? {
                    supplier_id: scorecardData[0].supplier_id,
                    supplier_name: scorecardData[0].supplier_name,
                    contact_info: {
                        contact_person: scorecardData[0].contact,
                        email: scorecardData[0].email,
                        phone: scorecardData[0].phone,
                        address: scorecardData[0].address
                    },
                    status: scorecardData[0].is_active ? 'Active' : 'Inactive',
                    relationship_timeline: {
                        first_order_date: scorecardData[0].first_order_date,
                        last_order_date: scorecardData[0].last_order_date,
                        days_since_first_order: parseInt(scorecardData[0].days_since_first_order) || 0,
                        days_since_last_order: parseInt(scorecardData[0].days_since_last_order) || 0,
                        active_months: parseInt(scorecardData[0].active_months) || 0
                    }
                } : null,
                performance_scorecard: scorecardData.length > 0 ? {
                    overall_performance: {
                        performance_score: parseInt(scorecardData[0].performance_score) || 0,
                        risk_category: scorecardData[0].risk_category,
                        strategic_importance: scorecardData[0].strategic_importance
                    },
                    volume_metrics: {
                        total_orders: parseInt(scorecardData[0].total_orders) || 0,
                        total_spend: parseFloat(scorecardData[0].total_spend) || 0,
                        avg_order_value: parseFloat(scorecardData[0].avg_order_value) || 0,
                        largest_order: parseFloat(scorecardData[0].largest_order) || 0,
                        smallest_order: parseFloat(scorecardData[0].smallest_order) || 0
                    },
                    order_status_breakdown: {
                        completed_orders: parseInt(scorecardData[0].completed_orders) || 0,
                        pending_orders: parseInt(scorecardData[0].pending_orders) || 0,
                        cancelled_orders: parseInt(scorecardData[0].cancelled_orders) || 0,
                        partially_received_orders: parseInt(scorecardData[0].partially_received_orders) || 0,
                        completion_rate: parseInt(scorecardData[0].completed_orders) / parseInt(scorecardData[0].total_orders) || 0,
                        cancellation_rate: parseInt(scorecardData[0].cancelled_orders) / parseInt(scorecardData[0].total_orders) || 0
                    },
                    operational_metrics: {
                        unique_items_supplied: parseInt(scorecardData[0].unique_items_supplied) || 0,
                        avg_lead_time: parseFloat(scorecardData[0].avg_lead_time_days) || 0,
                        lead_time_consistency: parseFloat(scorecardData[0].lead_time_std_dev) || 0,
                        avg_delivery_delay: parseFloat(scorecardData[0].avg_delivery_delay) || 0,
                        quality_performance: parseInt(scorecardData[0].good_condition_receipts) / parseInt(scorecardData[0].total_receipts) || 0
                    }
                } : null,
                monthly_trends: monthlyTrendsData.map(row => ({
                    period: `${row.year}-${String(row.month).padStart(2, '0')}`,
                    year: parseInt(row.year),
                    month: parseInt(row.month),
                    metrics: {
                        monthly_orders: parseInt(row.monthly_orders) || 0,
                        monthly_spend: parseFloat(row.monthly_spend) || 0,
                        avg_monthly_order_value: 0,
                        monthly_received_value: 0,
                        monthly_cancelled_value: 0,
                        three_month_avg_spend: 0
                    },
                    order_status: {
                        completed_orders: 0,
                        pending_orders: 0,
                        cancelled_orders: 0
                    }
                })),
                delivery_performance: deliveryData.length > 0 ? {
                    summary: {
                        total_deliveries: parseInt(deliveryData[0].total_deliveries) || 0,
                        on_time_deliveries: parseInt(deliveryData[0].on_time_deliveries) || 0,
                        late_deliveries: parseInt(deliveryData[0].late_deliveries) || 0,
                        on_time_rate: parseFloat(deliveryData[0].on_time_rate) || 0,
                        reliability_rating: deliveryData[0].delivery_reliability_rating
                    },
                    lead_time_analysis: {
                        avg_actual_lead_time: parseFloat(deliveryData[0].avg_actual_lead_time) || 0,
                        avg_promised_lead_time: parseFloat(deliveryData[0].avg_promised_lead_time) || 0,
                        avg_lead_time_variance: parseFloat(deliveryData[0].avg_lead_time_variance) || 0,
                        lead_time_consistency: parseFloat(deliveryData[0].lead_time_consistency) || 0,
                        min_lead_time: parseInt(deliveryData[0].min_lead_time) || 0,
                        max_lead_time: parseInt(deliveryData[0].max_lead_time) || 0
                    },
                    delay_analysis: {
                        avg_delay_days: parseFloat(deliveryData[0].avg_delay_days) || 0,
                        max_delay_days: parseInt(deliveryData[0].max_delay_days) || 0,
                        severe_delays: parseInt(deliveryData[0].severe_delays) || 0
                    }
                } : null,
                quality_metrics: qualityData.length > 0 ? {
                    quality_scores: {
                        condition_quality_score: parseFloat(qualityData[0].condition_quality_score) || 0,
                        quality_check_score: parseFloat(qualityData[0].quality_check_score) || 0,
                        overall_quality_rating: qualityData[0].overall_quality_rating
                    },
                    condition_breakdown: {
                        total_receipts: parseInt(qualityData[0].total_receipts) || 0,
                        good_condition_count: parseInt(qualityData[0].good_condition_count) || 0,
                        acceptable_condition_count: parseInt(qualityData[0].acceptable_condition_count) || 0,
                        poor_condition_count: parseInt(qualityData[0].poor_condition_count) || 0
                    },
                    quality_check_results: {
                        passed_quality_checks: parseInt(qualityData[0].passed_quality_checks) || 0,
                        failed_quality_checks: parseInt(qualityData[0].failed_quality_checks) || 0
                    },
                    shelf_life_analysis: {
                        avg_shelf_life_on_arrival: parseFloat(qualityData[0].avg_shelf_life_on_arrival) || 0,
                        expired_on_arrival: parseInt(qualityData[0].expired_on_arrival) || 0,
                        short_shelf_life_items: parseInt(qualityData[0].short_shelf_life_items) || 0
                    }
                } : null,
                product_portfolio: portfolioData.map(row => ({
                    item_id: row.item_id,
                    item_name: row.item_name,
                    sku: row.sku,
                    category_name: row.category_name,
                    order_metrics: {
                        times_ordered: parseInt(row.times_ordered) || 0,
                        total_quantity_ordered: parseInt(row.total_quantity_ordered) || 0,
                        total_quantity_received: parseInt(row.total_quantity_received) || 0,
                        avg_fulfillment_rate: parseFloat(row.avg_fulfillment_rate) || 0
                    },
                    pricing_metrics: {
                        avg_unit_price: parseFloat(row.avg_unit_price) || 0,
                        min_unit_price: parseFloat(row.min_unit_price) || 0,
                        max_unit_price: parseFloat(row.max_unit_price) || 0,
                        price_volatility: parseFloat(row.price_volatility) || 0,
                        total_spend_on_item: parseFloat(row.total_spend_on_item) || 0
                    },
                    recent_activity: {
                        last_ordered_date: row.last_ordered_date,
                        days_since_last_order: parseInt(row.days_since_last_order) || 0
                    }
                })),
                recent_activity: {
                    orders: recentOrdersData.map(row => ({
                        order_id: row.order_id,
                        order_number: row.order_number,
                        order_date: row.order_date,
                        expected_delivery_date: row.expected_delivery_date,
                        status: row.status,
                        delivery_status: row.delivery_status,
                        total_amount: parseFloat(row.total_amount) || 0,
                        line_item_count: parseInt(row.line_item_count) || 0,
                        quantity_metrics: {
                            total_ordered: parseInt(row.total_quantity_ordered) || 0,
                            total_received: parseInt(row.total_quantity_received) || 0,
                            pending: parseInt(row.pending_quantity) || 0
                        },
                        timeline: {
                            days_since_order: parseInt(row.days_since_order) || 0,
                            days_past_due: parseInt(row.days_past_due) || 0
                        }
                    })),
                    payments: paymentData.map(row => ({
                        payment_id: row.payment_id,
                        payment_reference: row.payment_reference,
                        payment_amount: parseFloat(row.payment_amount) || 0,
                        payment_date: row.payment_date,
                        payment_method: row.payment_method,
                        payment_status: row.payment_status,
                        reference_number: row.reference_number,
                        order_number: row.order_number,
                        order_total: parseFloat(row.order_total) || 0,
                        approval_info: {
                            approved_by: row.approved_by,
                            approved_at: row.approved_at,
                            processed_at: row.processed_at
                        }
                    }))
                },
                key_terms_explanation: {
                    performance_score: "A weighted composite score (0-100) evaluating supplier performance across order completion (30%), delivery reliability (25%), quality (25%), order volume (10%), and consistency (10%). Higher scores indicate better overall performance.",
                    risk_category: "Classification based on performance score: High Performer (80+), Reliable (60-79), Needs Attention (40-59), High Risk (<40), or New Supplier (no orders yet).",
                    strategic_importance: "Categorization based on item variety and spend volume: Strategic (>5 unique items or >$10K spend), Important (2-5 items or $5K-$10K), Standard (1-2 items or <$5K).",
                    lead_time: "Average time (in days) between order placement and receipt. Lower values indicate faster delivery, while consistency measures variation in delivery times.",
                    on_time_delivery_rate: "Percentage of orders delivered by or before the expected delivery date. Rates above 95% are considered excellent, 85-94% good, 70-84% fair, below 70% poor.",
                    quality_performance: "Ratio of good condition receipts to total receipts. Higher ratios indicate better product quality and packaging standards.",
                    fulfillment_rate: "Percentage of ordered quantity actually received. Rates below 95% may indicate supply chain issues or quality problems.",
                    price_volatility: "Standard deviation of unit prices across orders. Higher values indicate inconsistent pricing, which may affect budgeting and cost control.",
                    shelf_life_analysis: "Analysis of product expiration dates upon arrival. Includes average shelf life remaining and counts of expired or short-dated items.",
                    delivery_reliability_rating: "Overall assessment of delivery performance: Excellent (95%+ on-time), Good (85-94%), Fair (70-84%), Poor (<70%).",
                    order_completion_rate: "Percentage of orders that reach 'received' status. High rates indicate reliable suppliers, while low rates may signal performance issues.",
                    supplier_relationship_timeline: "Duration and activity metrics of the supplier relationship, including first/last order dates and active months of business.",
                    product_portfolio_diversity: "Number of unique items supplied by the vendor. Higher diversity indicates broader product capabilities and reduced supply risk.",
                    payment_terms_analysis: "Analysis of payment patterns, methods, and timeliness. Includes payment method preferences and approval workflows."
                }
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
            const { start_date, end_date } = req.query;
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
                .andWhere('current_stock', 'is not', null)
                .andWhere(function () {
                this.where('current_stock', '<=', connection.raw('min_stock'))
                    .orWhere('current_stock', '>=', connection.raw('max_stock'))
                    .orWhere('status', 'out_of_stock');
            })
                .orderBy('current_stock', 'asc')
                .limit(50);
            // Days of inventory remaining - FIXED: Proper consumption calculation using Knex query builder
            let dailyConsumptionQuery = connection('inv_inventory_transactions')
                .select('item_id', connection.raw('DATE(transaction_date) as consumption_date'), connection.raw('SUM(COALESCE(quantity, 0)) as daily_consumption'))
                .where('transaction_type', 'consumption')
                .where(connection.raw('COALESCE(quantity, 0)'), '>', 0);
            const daysOfInventoryRemaining = await connection('inv_inventory_items')
                .select('id as item_id', 'name as item_name', 'current_stock', connection.raw('COALESCE(consumption_stats.avg_daily_consumption, 0) as daily_consumption_rate'), connection.raw('CASE WHEN COALESCE(consumption_stats.avg_daily_consumption, 0) > 0 THEN ROUND(current_stock / consumption_stats.avg_daily_consumption, 1) ELSE 999 END as days_remaining'))
                .leftJoin(connection('inv_inventory_transactions')
                .select('item_id')
                .select(connection.raw('AVG(daily_consumption) as avg_daily_consumption'))
                .from(dailyConsumptionQuery
                .groupBy('item_id', connection.raw('DATE(transaction_date)'))
                .as('daily_consumption'))
                .groupBy('item_id')
                .as('consumption_stats'), 'inv_inventory_items.id', 'consumption_stats.item_id')
                .where('is_active', 1)
                .where('current_stock', '>', 0)
                .orderBy('current_stock', 'desc')
                .limit(20);
            // DEBUG: Log the raw results
            console.log('DEBUG - Knex query results:', daysOfInventoryRemaining);
            // Predictive analytics (simplified) - FIXED: Proper daily consumption calculation
            let dailyConsumptionQuery2 = connection('inv_inventory_transactions')
                .select('item_id', connection.raw('DATE(transaction_date) as consumption_date'), connection.raw('SUM(COALESCE(quantity, 0)) as daily_consumption'))
                .where('transaction_type', 'consumption')
                .where(connection.raw('COALESCE(quantity, 0)'), '>', 0);
            const stockOutPredictions = await connection('inv_inventory_items')
                .select('id as item_id', 'name as item_name', 'current_stock', connection.raw('COALESCE(consumption_stats.avg_daily_consumption, 0) as daily_rate'), connection.raw('CASE WHEN COALESCE(consumption_stats.avg_daily_consumption, 0) > 0 THEN DATE_ADD(CURDATE(), INTERVAL (current_stock / consumption_stats.avg_daily_consumption) DAY) ELSE NULL END as predicted_stock_out_date'), connection.raw('CASE WHEN COALESCE(consumption_stats.avg_daily_consumption, 0) > 0 THEN current_stock / consumption_stats.avg_daily_consumption ELSE 999 END as days_until_stock_out'))
                .leftJoin(connection('inv_inventory_transactions')
                .select('item_id')
                .select(connection.raw('AVG(daily_consumption) as avg_daily_consumption'))
                .from(dailyConsumptionQuery2
                .groupBy('item_id', connection.raw('DATE(transaction_date)'))
                .as('daily_consumption'))
                .groupBy('item_id')
                .as('consumption_stats'), 'inv_inventory_items.id', 'consumption_stats.item_id')
                .where('is_active', 1)
                .where('current_stock', '>', 0)
                .having(connection.raw('days_until_stock_out <= 30'))
                .orderBy('days_until_stock_out', 'asc')
                .limit(20);
            // Overstock predictions - items with excess stock relative to consumption - FIXED: Proper daily consumption calculation
            let dailyConsumptionQuery3 = connection('inv_inventory_transactions')
                .select('item_id', connection.raw('DATE(transaction_date) as consumption_date'), connection.raw('SUM(COALESCE(quantity, 0)) as daily_consumption'))
                .where('transaction_type', 'consumption')
                .where(connection.raw('COALESCE(quantity, 0)'), '>', 0);
            const overstockPredictions = await connection('inv_inventory_items')
                .select('id as item_id', 'name as item_name', 'current_stock', 'max_stock', connection.raw('COALESCE(consumption_stats.avg_daily_consumption, 0) as avg_daily_consumption'), connection.raw('COALESCE(consumption_stats.consumption_std_dev, 0) as consumption_std_dev'), connection.raw(`
                              CASE
                                   WHEN max_stock IS NOT NULL AND current_stock > max_stock THEN current_stock - max_stock
                                   WHEN COALESCE(consumption_stats.avg_daily_consumption, 0) > 0
                                        THEN current_stock - (consumption_stats.avg_daily_consumption * 90)
                                   ELSE 0
                              END as excess_quantity
                         `), connection.raw(`
                              CASE
                                   WHEN max_stock IS NOT NULL AND current_stock > max_stock THEN 'exceeds_max_stock'
                                   WHEN COALESCE(consumption_stats.avg_daily_consumption, 0) > 0
                                        AND current_stock > (consumption_stats.avg_daily_consumption * 90)
                                        THEN 'excess_inventory'
                                   ELSE 'normal'
                              END as overstock_reason
                         `))
                .leftJoin(connection('inv_inventory_transactions')
                .select('item_id')
                .select(connection.raw('AVG(daily_consumption) as avg_daily_consumption'))
                .select(connection.raw('STDDEV(daily_consumption) as consumption_std_dev'))
                .from(dailyConsumptionQuery3
                .groupBy('item_id', connection.raw('DATE(transaction_date)'))
                .as('daily_consumption'))
                .groupBy('item_id')
                .as('consumption_stats'), 'inv_inventory_items.id', 'consumption_stats.item_id')
                .where('is_active', 1)
                .where('current_stock', '>', 0)
                .having(connection.raw('excess_quantity > 0'))
                .orderBy('excess_quantity', 'desc')
                .limit(20);
            // Safety stock recommendations - calculate optimal safety stock levels - FIXED: Proper daily consumption calculation + Actual Lead Times
            const safetyStockRecommendations = await connection.raw(`
                    SELECT
                         i.id as item_id,
                         i.name as item_name,
                         i.current_stock,
                         i.min_stock as current_min_stock,
                         cs.avg_daily_demand,
                         cs.demand_std_dev,
                         slt.avg_lead_time_days,
                         slt.lead_time_std_dev,
                         CASE
                              WHEN cs.avg_daily_demand > 0 THEN
                                   ROUND(
                                        (cs.avg_daily_demand * slt.avg_lead_time_days) +
                                        (cs.demand_std_dev * 1.645 * SQRT(slt.avg_lead_time_days))
                                   )
                              ELSE 0
                         END as recommended_safety_stock,
                         CASE
                              WHEN i.min_stock IS NULL THEN 'no_min_stock_set'
                              WHEN cs.avg_daily_demand > 0
                                   AND i.min_stock < ((cs.avg_daily_demand * slt.avg_lead_time_days) +
                                                     (cs.demand_std_dev * 1.645 * SQRT(slt.avg_lead_time_days)))
                                   THEN 'insufficient_safety_stock'
                              WHEN cs.avg_daily_demand > 0
                                   AND i.min_stock > ((cs.avg_daily_demand * slt.avg_lead_time_days) +
                                                     (cs.demand_std_dev * 1.645 * SQRT(slt.avg_lead_time_days)))
                                   THEN 'excessive_safety_stock'
                              ELSE 'adequate_safety_stock'
                         END as recommendation_status
                    FROM inv_inventory_items i
                    LEFT JOIN (
                         SELECT
                              item_id,
                              AVG(daily_consumption) as avg_daily_demand,
                              STDDEV(daily_consumption) as demand_std_dev
                         FROM (
                              SELECT
                                   item_id,
                                   DATE(transaction_date) as consumption_date,
                                   SUM(quantity) as daily_consumption
                              FROM inv_inventory_transactions
                              WHERE transaction_type = 'consumption'
                              GROUP BY item_id, DATE(transaction_date)
                         ) as daily_data
                         GROUP BY item_id
                    ) cs ON i.id = cs.item_id
                    LEFT JOIN (
                         SELECT
                              poi.inventory_item_id,
                              AVG(DATEDIFF(por.received_date, po.order_date)) as avg_lead_time_days,
                              STDDEV(DATEDIFF(por.received_date, po.order_date)) as lead_time_std_dev
                         FROM inv_purchase_orders po
                         JOIN inv_purchase_order_receipts por ON po.id = por.order_id
                         JOIN inv_purchase_order_items poi ON po.id = poi.order_id
                         WHERE po.status = 'received'
                              AND por.received_date IS NOT NULL
                              AND po.order_date >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
                         GROUP BY poi.inventory_item_id
                    ) slt ON i.id = slt.inventory_item_id
                    WHERE i.is_active = 1
                         AND i.current_stock IS NOT NULL
                    HAVING cs.avg_daily_demand > 0
                    ORDER BY recommended_safety_stock DESC
                    LIMIT 20
               `);
            // Advanced Demand Forecasting - Calculate actual monthly demand and trends
            const demandForecasting = await connection.raw(`
                    WITH monthly_consumption AS (
                         SELECT
                              t.item_id,
                              i.name as item_name,
                              DATE_FORMAT(t.transaction_date, '%Y-%m') as month_year,
                              SUM(t.quantity) as monthly_consumed,
                              COUNT(*) as transactions_in_month
                         FROM inv_inventory_transactions t
                         JOIN inv_inventory_items i ON t.item_id = i.id
                         WHERE t.transaction_type = 'consumption'
                              AND t.transaction_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                              AND i.is_active = 1
                         GROUP BY t.item_id, i.name, DATE_FORMAT(t.transaction_date, '%Y-%m')
                    ),
                    consumption_stats AS (
                         SELECT
                              item_id,
                              item_name,
                              AVG(monthly_consumed) as avg_monthly_demand,
                              STDDEV(monthly_consumed) as demand_std_dev,
                              COUNT(*) as months_with_data,
                              -- Calculate trend using linear regression slope
                              CASE
                                   WHEN COUNT(*) > 1 THEN
                                        (COUNT(*) * SUM(month_year_num * monthly_consumed) - SUM(month_year_num) * SUM(monthly_consumed)) /
                                        (COUNT(*) * SUM(month_year_num * month_year_num) - SUM(month_year_num) * SUM(month_year_num))
                                   ELSE 0
                              END as demand_trend,
                              MIN(month_year) as earliest_month,
                              MAX(month_year) as latest_month
                         FROM (
                              SELECT
                                   item_id,
                                   item_name,
                                   month_year,
                                   monthly_consumed,
                                   -- Convert month_year to number for regression (YYYYMM format)
                                   CAST(CONCAT(SUBSTRING(month_year, 1, 4), SUBSTRING(month_year, 6, 2)) AS UNSIGNED) as month_year_num
                              FROM monthly_consumption
                         ) numbered_months
                         GROUP BY item_id, item_name
                    )
                    SELECT
                         cs.item_id,
                         cs.item_name,
                         ROUND(cs.avg_monthly_demand, 2) as avg_monthly_demand,
                         ROUND(cs.demand_trend, 2) as demand_trend,
                         CASE
                              WHEN cs.demand_trend > cs.avg_monthly_demand * 0.1 THEN 'strong_increasing'
                              WHEN cs.demand_trend > cs.avg_monthly_demand * 0.05 THEN 'moderate_increasing'
                              WHEN cs.demand_trend < cs.avg_monthly_demand * -0.1 THEN 'strong_decreasing'
                              WHEN cs.demand_trend < cs.avg_monthly_demand * -0.05 THEN 'moderate_decreasing'
                              ELSE 'stable'
                         END as trend_direction,
                         -- Simple forecast: current average + trend
                         ROUND(cs.avg_monthly_demand + cs.demand_trend, 2) as next_month_forecast,
                         ROUND(cs.avg_monthly_demand + (cs.demand_trend * 2), 2) as month_2_forecast,
                         ROUND(cs.avg_monthly_demand + (cs.demand_trend * 3), 2) as month_3_forecast,
                         CASE
                              WHEN cs.months_with_data >= 6 THEN 'high'
                              WHEN cs.months_with_data >= 3 THEN 'medium'
                              ELSE 'low'
                         END as forecast_confidence,
                         -- Months of stock cover (simplified - would need current stock)
                         0 as months_of_stock_cover
                    FROM consumption_stats cs
                    WHERE cs.avg_monthly_demand > 0
                    ORDER BY cs.avg_monthly_demand DESC
                    LIMIT 10
               `);
            // Enhanced Reorder Point Optimization
            const reorderPointOptimization = await connection.raw(`
                    WITH consumption_stats AS (
                         SELECT
                              item_id,
                              AVG(daily_consumption) as avg_daily_consumption,
                              STDDEV(daily_consumption) as consumption_std_dev,
                              MAX(daily_consumption) as max_daily_consumption,
                              COUNT(*) as days_with_data
                         FROM (
                              SELECT
                                   item_id,
                                   DATE(transaction_date) as consumption_date,
                                   SUM(quantity) as daily_consumption
                              FROM inv_inventory_transactions
                              WHERE transaction_type = 'consumption'
                              GROUP BY item_id, DATE(transaction_date)
                         ) daily_data
                         GROUP BY item_id
                    ),
                    lead_time_analysis AS (
                         SELECT
                              poi.inventory_item_id,
                              AVG(DATEDIFF(por.received_date, po.order_date)) as avg_lead_time_days,
                              STDDEV(DATEDIFF(por.received_date, po.order_date)) as lead_time_std_dev,
                              MAX(DATEDIFF(por.received_date, po.order_date)) as max_lead_time_days,
                              COUNT(*) as order_count
                         FROM inv_purchase_orders po
                         JOIN inv_purchase_order_receipts por ON po.id = por.order_id
                         JOIN inv_purchase_order_items poi ON po.id = poi.order_id
                         WHERE po.status = 'received'
                              AND por.received_date IS NOT NULL
                              AND po.order_date >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
                         GROUP BY poi.inventory_item_id
                    )
                    SELECT
                         i.id as item_id,
                         i.name as item_name,
                         i.current_stock,
                         i.min_stock as current_min_stock,
                         i.max_stock as current_max_stock,
                         COALESCE(cs.avg_daily_consumption, 0) as avg_daily_demand,
                         COALESCE(cs.consumption_std_dev, 0) as demand_variability,
                         COALESCE(lta.avg_lead_time_days, 7) as avg_lead_time_days,
                         COALESCE(lta.lead_time_std_dev, 2) as lead_time_variability,
                         -- Optimized reorder point calculation (demand during lead time + safety stock)
                         ROUND(
                              (COALESCE(cs.avg_daily_consumption, 0) * COALESCE(lta.avg_lead_time_days, 7)) +
                              (COALESCE(cs.consumption_std_dev, 0) * SQRT(COALESCE(lta.avg_lead_time_days, 7))) +
                              (COALESCE(cs.consumption_std_dev, 0) * COALESCE(lta.lead_time_std_dev, 2))
                         ) as optimized_reorder_point,
                         -- Economic order quantity approximation
                         CASE
                              WHEN COALESCE(cs.avg_daily_consumption, 0) > 0
                              THEN ROUND(SQRT((2 * COALESCE(cs.avg_daily_consumption, 0) * 365 * 10) / 0.2)) -- Assuming $10 ordering cost, 20% carrying cost
                              ELSE 0
                         END as economic_order_quantity,
                         -- Service level optimization
                         CASE
                              WHEN COALESCE(cs.avg_daily_consumption, 0) > 0 AND COALESCE(lta.avg_lead_time_days, 7) > 0
                              THEN ROUND(100 * (1 - (COALESCE(cs.consumption_std_dev, 0) * SQRT(COALESCE(lta.avg_lead_time_days, 7))) /
                                         (COALESCE(cs.avg_daily_consumption, 0) * COALESCE(lta.avg_lead_time_days, 7))), 1)
                              ELSE 95
                         END as target_service_level,
                         -- Stock status assessment
                         CASE
                              WHEN i.current_stock <= COALESCE(i.min_stock, 0) THEN 'critical'
                              WHEN COALESCE(cs.avg_daily_consumption, 0) > 0 AND i.current_stock <= (COALESCE(cs.avg_daily_consumption, 0) * COALESCE(lta.avg_lead_time_days, 7))
                                   THEN 'reorder_needed'
                              WHEN COALESCE(cs.avg_daily_consumption, 0) > 0 AND i.current_stock <= (COALESCE(cs.avg_daily_consumption, 0) * COALESCE(lta.avg_lead_time_days, 7) * 1.5)
                                   THEN 'monitor'
                              ELSE 'adequate'
                         END as stock_status
                    FROM inv_inventory_items i
                    LEFT JOIN consumption_stats cs ON i.id = cs.item_id
                    LEFT JOIN lead_time_analysis lta ON i.id = lta.inventory_item_id
                    WHERE i.is_active = 1
                         AND i.current_stock IS NOT NULL
                         AND COALESCE(cs.avg_daily_consumption, 0) > 0
                    ORDER BY
                         CASE stock_status
                              WHEN 'critical' THEN 1
                              WHEN 'reorder_needed' THEN 2
                              WHEN 'monitor' THEN 3
                              ELSE 4
                         END ASC,
                         optimized_reorder_point DESC
                    LIMIT 30
               `);
            const aiFeatures = await connection.raw(`
                    WITH daily_consumption AS (
                         SELECT
                              item_id,
                              DATE(transaction_date) as consumption_date,
                              DAYOFWEEK(transaction_date) as day_of_week,
                              MONTH(transaction_date) as month_of_year,
                              SUM(quantity) as daily_consumption
                         FROM inv_inventory_transactions
                         WHERE transaction_type = 'consumption'
                         GROUP BY item_id, DATE(transaction_date), DAYOFWEEK(transaction_date), MONTH(transaction_date)
                    ),
                    consumption_stats AS (
                         SELECT
                              item_id,
                              AVG(daily_consumption) as avg_daily_consumption,
                              STDDEV(daily_consumption) as consumption_std_dev,
                              COUNT(*) as total_days,
                              SUM(CASE WHEN daily_consumption = 0 THEN 1 ELSE 0 END) as zero_consumption_days,
                              MAX(daily_consumption) as max_daily_consumption,
                              MIN(daily_consumption) as min_daily_consumption
                         FROM daily_consumption
                         GROUP BY item_id
                    ),
                    temporal_patterns AS (
                         SELECT
                              item_id,
                              AVG(CASE WHEN day_of_week = 1 THEN daily_consumption ELSE NULL END) / AVG(daily_consumption) as sunday_effect,
                              AVG(CASE WHEN day_of_week = 2 THEN daily_consumption ELSE NULL END) / AVG(daily_consumption) as monday_effect,
                              AVG(CASE WHEN day_of_week = 7 THEN daily_consumption ELSE NULL END) / AVG(daily_consumption) as saturday_effect,
                              AVG(CASE WHEN month_of_year IN (12,1,2) THEN daily_consumption ELSE NULL END) / AVG(daily_consumption) as winter_seasonality,
                              AVG(CASE WHEN month_of_year IN (6,7,8) THEN daily_consumption ELSE NULL END) / AVG(daily_consumption) as summer_seasonality
                         FROM daily_consumption
                         GROUP BY item_id
                    ),
                    supplier_performance AS (
                         SELECT
                              poi.inventory_item_id,
                              COUNT(DISTINCT po.id) as total_orders,
                              AVG(DATEDIFF(por.received_date, po.expected_delivery_date)) as avg_delivery_delay,
                              STDDEV(DATEDIFF(por.received_date, po.expected_delivery_date)) as delivery_delay_std_dev,
                              SUM(CASE WHEN por.received_date <= po.expected_delivery_date THEN 1 ELSE 0 END) / COUNT(*) as on_time_delivery_rate,
                              AVG(poi.quantity_ordered) as avg_order_quantity
                         FROM inv_purchase_orders po
                         JOIN inv_purchase_order_receipts por ON po.id = por.order_id
                         JOIN inv_purchase_order_items poi ON po.id = poi.order_id
                         WHERE po.status = 'received'
                              AND por.received_date IS NOT NULL
                              AND po.expected_delivery_date IS NOT NULL
                              AND po.order_date >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
                         GROUP BY poi.inventory_item_id
                    )
                    SELECT
                         i.id as item_id,
                         i.name as item_name,
                         -- Temporal Features
                         COALESCE(tp.monday_effect, 1.0) as day_of_week_effect,
                         COALESCE(tp.winter_seasonality, 1.0) as monthly_seasonality,
                         CASE
                              WHEN cs.consumption_std_dev > 0 THEN cs.consumption_std_dev / cs.avg_daily_consumption
                              ELSE 0
                         END as consumption_consistency,
                         CASE
                              WHEN cs.avg_daily_consumption > 0 THEN cs.max_daily_consumption / cs.avg_daily_consumption
                              ELSE 0
                         END as demand_spikiness,
                         CASE
                              WHEN cs.total_days > 0 THEN cs.zero_consumption_days / cs.total_days
                              ELSE 0
                         END as zero_consumption_days,
                         -- Supplier Performance Features
                         COALESCE(sp.on_time_delivery_rate, 0.85) as lead_time_reliability,
                         COALESCE(sp.delivery_delay_std_dev, 2.5) as lead_time_variability,
                         0.02 as quality_rejection_rate, -- Placeholder - would need quality tracking
                         COALESCE(sp.avg_order_quantity, 0) as minimum_order_quantity_impact,
                         -- Inventory Health Indicators
                         CASE
                              WHEN cs.avg_daily_consumption > 0 THEN i.current_stock / cs.avg_daily_consumption
                              ELSE 0
                         END as stock_cover_ratio,
                         CASE
                              WHEN cs.avg_daily_consumption > 0 AND cs.consumption_std_dev > 0
                              THEN (i.current_stock / cs.avg_daily_consumption) / (cs.consumption_std_dev / cs.avg_daily_consumption)
                              ELSE 0
                         END as stock_cover_z_score,
                         COALESCE(sp.total_orders, 0) as supplier_order_history
                    FROM inv_inventory_items i
                    LEFT JOIN consumption_stats cs ON i.id = cs.item_id
                    LEFT JOIN temporal_patterns tp ON i.id = tp.item_id
                    LEFT JOIN supplier_performance sp ON i.id = sp.inventory_item_id
                    WHERE i.is_active = 1
                         AND i.current_stock IS NOT NULL
                    ORDER BY i.id
                    LIMIT 100
               `, [...(start_date ? [start_date] : []), ...(end_date ? [end_date] : [])]);
            // Data Validation Framework - Anomaly Detection
            const dataValidationAlerts = await connection.raw(`
                    WITH daily_consumption AS (
                         SELECT
                              item_id,
                              DATE(transaction_date) as consumption_date,
                              SUM(quantity) as daily_consumption
                         FROM inv_inventory_transactions
                         WHERE transaction_type = 'consumption'
                              ${start_date ? 'AND transaction_date >= ?' : ''}
                              ${end_date ? 'AND transaction_date <= ?' : ''}
                         GROUP BY item_id, DATE(transaction_date)
                    ),
                    consumption_stats AS (
                         SELECT
                              item_id,
                              AVG(daily_consumption) as avg_daily_consumption,
                              STDDEV(daily_consumption) as consumption_std_dev,
                              MAX(daily_consumption) as max_daily_consumption,
                              COUNT(*) as days_with_data
                         FROM daily_consumption
                         GROUP BY item_id
                    ),
                    supplier_performance AS (
                         SELECT
                              poi.inventory_item_id,
                              COUNT(*) as total_orders,
                              AVG(DATEDIFF(por.received_date, po.expected_delivery_date)) as avg_delivery_delay
                         FROM inv_purchase_orders po
                         JOIN inv_purchase_order_receipts por ON po.id = por.order_id
                         JOIN inv_purchase_order_items poi ON po.id = poi.order_id
                         WHERE po.status = 'received'
                              AND por.received_date IS NOT NULL
                              AND po.expected_delivery_date IS NOT NULL
                              AND po.order_date >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
                         GROUP BY poi.inventory_item_id
                    )
                    SELECT
                         i.id as item_id,
                         i.name as item_name,
                         i.current_stock,
                         i.min_stock,
                         i.max_stock,
                         COALESCE(cs.avg_daily_consumption, 0) as avg_daily_consumption,
                         COALESCE(cs.consumption_std_dev, 0) as consumption_std_dev,
                         COALESCE(cs.max_daily_consumption, 0) as max_daily_consumption,
                         COALESCE(sp.avg_delivery_delay, 0) as avg_delivery_delay,
                         -- Anomaly Detection Rules
                         CASE
                              WHEN i.current_stock < 0 THEN 'negative_inventory'
                              WHEN cs.max_daily_consumption > (cs.avg_daily_consumption + 3 * cs.consumption_std_dev) THEN 'consumption_spike'
                              WHEN COALESCE(cs.avg_daily_consumption, 0) > 0 AND i.current_stock / cs.avg_daily_consumption > 365 THEN 'unrealistic_cover'
                              WHEN sp.avg_delivery_delay > 30 THEN 'supplier_performance_issue'
                              WHEN i.min_stock IS NULL OR i.max_stock IS NULL THEN 'missing_thresholds'
                              ELSE 'normal'
                         END as anomaly_type,
                         CASE
                              WHEN i.current_stock < 0 THEN CONCAT('Negative inventory: ', i.current_stock)
                              WHEN cs.max_daily_consumption > (cs.avg_daily_consumption + 3 * cs.consumption_std_dev)
                                   THEN CONCAT('Consumption spike detected: ', cs.max_daily_consumption, ' vs avg ', ROUND(cs.avg_daily_consumption, 2))
                              WHEN COALESCE(cs.avg_daily_consumption, 0) > 0 AND i.current_stock / cs.avg_daily_consumption > 365
                                   THEN CONCAT('Unrealistic stock cover: ', ROUND(i.current_stock / cs.avg_daily_consumption, 1), ' days')
                              WHEN sp.avg_delivery_delay > 30
                                   THEN CONCAT('Supplier delay: ', ROUND(sp.avg_delivery_delay, 1), ' days average')
                              WHEN i.min_stock IS NULL OR i.max_stock IS NULL
                                   THEN 'Missing min/max stock thresholds'
                              ELSE 'No anomalies detected'
                         END as anomaly_description,
                         CASE
                              WHEN i.current_stock < 0 THEN 'immediate_action'
                              WHEN cs.max_daily_consumption > (cs.avg_daily_consumption + 3 * cs.consumption_std_dev) THEN 'investigate'
                              WHEN COALESCE(cs.avg_daily_consumption, 0) > 0 AND i.current_stock / cs.avg_daily_consumption > 365 THEN 'review_data'
                              WHEN sp.avg_delivery_delay > 30 THEN 'supplier_review'
                              WHEN i.min_stock IS NULL OR i.max_stock IS NULL THEN 'setup_required'
                              ELSE 'normal'
                         END as recommended_action
                    FROM inv_inventory_items i
                    LEFT JOIN consumption_stats cs ON i.id = cs.item_id
                    LEFT JOIN supplier_performance sp ON i.id = sp.inventory_item_id
                    WHERE i.is_active = 1
                         AND i.current_stock IS NOT NULL
                         AND (
                              i.current_stock < 0
                              OR cs.max_daily_consumption > (cs.avg_daily_consumption + 3 * cs.consumption_std_dev)
                              OR (cs.avg_daily_consumption > 0 AND i.current_stock / cs.avg_daily_consumption > 365)
                              OR sp.avg_delivery_delay > 30
                              OR i.min_stock IS NULL
                              OR i.max_stock IS NULL
                         )
                    ORDER BY
                         CASE
                              WHEN i.current_stock < 0 THEN 1
                              WHEN cs.max_daily_consumption > (cs.avg_daily_consumption + 3 * cs.consumption_std_dev) THEN 2
                              WHEN sp.avg_delivery_delay > 30 THEN 3
                              WHEN COALESCE(cs.avg_daily_consumption, 0) > 0 AND i.current_stock / cs.avg_daily_consumption > 365 THEN 4
                              ELSE 5
                         END ASC
                    LIMIT 50
               `, [...(start_date ? [start_date] : []), ...(end_date ? [end_date] : [])]);
            const analytics = {
                current_stock_on_hand: parseInt(currentStockResult === null || currentStockResult === void 0 ? void 0 : currentStockResult.total_stock) || 0,
                stock_available_for_use: stockAvailableForUse,
                stock_on_order: parseInt(stockOnOrderResult === null || stockOnOrderResult === void 0 ? void 0 : stockOnOrderResult.pending_quantity) || 0,
                allocated_stock: allocatedStock,
                stock_threshold_alerts: stockThresholdAlerts.map(row => ({
                    item_id: row.item_id,
                    item_name: row.item_name,
                    current_stock: parseInt(row.current_stock || 0),
                    min_stock: parseInt(row.min_stock || 0),
                    max_stock: parseInt(row.max_stock || 0),
                    status: row.status,
                    alert_type: row.current_stock <= row.min_stock ? 'low_stock' :
                        row.current_stock >= row.max_stock ? 'over_stock' : 'out_of_stock'
                })),
                days_of_inventory_remaining: daysOfInventoryRemaining.map(row => ({
                    item_id: row.item_id,
                    item_name: row.item_name,
                    current_stock: parseInt(row.current_stock || 0),
                    daily_consumption_rate: parseFloat(row.daily_consumption_rate) || 0,
                    days_remaining: parseFloat(row.days_remaining) || 0,
                    status: row.days_remaining <= 7 ? 'critical' :
                        row.days_remaining <= 30 ? 'warning' : 'normal'
                })),
                key_terms_explanation: {
                    safety_stock: "Extra inventory kept on hand to prevent stockouts during unexpected delays in receiving new supplies. Acts as a buffer against demand variability and supplier lead time issues.",
                    reorder_point: "The inventory level at which you should place a new order to replenish stock before running out. Calculated based on demand during lead time plus safety stock.",
                    economic_order_quantity: "The optimal order quantity that minimizes total inventory costs by balancing ordering costs against carrying costs. Larger orders reduce ordering frequency but increase holding costs.",
                    service_level: "The percentage of customer demand that is fulfilled from available stock. A 95% service level means you meet customer needs 95% of the time.",
                    demand_forecasting: "Prediction of future product demand based on historical consumption patterns, trends, and seasonal factors. Helps plan inventory levels and purchasing decisions.",
                    trend_direction: "Indicates whether demand for an item is increasing, decreasing, or staying stable over time. Helps predict future inventory needs.",
                    forecast_confidence: "How reliable the demand forecast is, based on the amount and quality of historical data available. High confidence means more accurate predictions.",
                    stock_out_prediction: "Forecast of when an item will run out of stock based on current inventory levels and consumption rates. Helps prevent unexpected shortages.",
                    overstock_prediction: "Identification of items with excess inventory beyond normal requirements. Indicates potential capital tied up in unnecessary stock.",
                    data_quality_alerts: "Warnings about potential issues with inventory data, such as negative stock levels, unusual consumption patterns, or missing information that could affect decision making.",
                    anomaly_types: "Unusual patterns or data points that deviate from normal inventory behavior, such as sudden demand spikes, unrealistic stock levels, or supplier performance issues.",
                    carrying_cost: "The total cost of holding inventory, including storage, insurance, obsolescence, and opportunity cost of capital tied up in stock.",
                    lead_time: "The time between placing an order with a supplier and receiving the goods. Critical for calculating safety stock and reorder points.",
                    turnover_ratio: "How many times inventory is sold and replaced over a period (usually annually). Higher ratios indicate faster-moving, more efficient inventory."
                },
                predictive_analytics: {
                    stock_out_predictions: stockOutPredictions.map(row => ({
                        item_id: row.item_id,
                        item_name: row.item_name,
                        predicted_stock_out_date: row.predicted_stock_out_date || '',
                        days_until_stock_out: parseFloat(row.days_until_stock_out) || 0
                    })),
                    overstock_predictions: overstockPredictions.map(row => ({
                        item_id: row.item_id,
                        item_name: row.item_name,
                        excess_quantity: parseFloat(row.excess_quantity || 0),
                        carrying_cost_impact: parseFloat(row.excess_quantity || 0) * 0.2 // Estimated carrying cost at 20%
                    })),
                    safety_stock_recommendations: safetyStockRecommendations[0].map(row => ({
                        item_id: row.item_id,
                        item_name: row.item_name,
                        current_safety_stock: parseInt(row.current_min_stock || 0),
                        recommended_safety_stock: parseFloat(row.recommended_safety_stock || 0),
                        reasoning: row.recommendation_status || 'unknown',
                        interpretation: (() => {
                            switch (row.recommendation_status) {
                                case 'insufficient_safety_stock':
                                    return `Your current safety stock of ${parseInt(row.current_min_stock || 0)} units is too low. Increase to ${parseFloat(row.recommended_safety_stock || 0)} units to maintain 95% service level and prevent stockouts during supplier lead time.`;
                                case 'excessive_safety_stock':
                                    return `Your current safety stock of ${parseInt(row.current_min_stock || 0)} units is too high. Consider reducing to ${parseFloat(row.recommended_safety_stock || 0)} units to free up capital and reduce carrying costs.`;
                                case 'adequate_safety_stock':
                                    return `Your current safety stock of ${parseInt(row.current_min_stock || 0)} units is appropriate for your demand patterns and supplier lead times.`;
                                case 'no_min_stock_set':
                                    return `No minimum stock level is set. Recommended safety stock is ${parseFloat(row.recommended_safety_stock || 0)} units based on demand variability and lead times.`;
                                default:
                                    return 'Unable to determine safety stock recommendation due to insufficient data.';
                            }
                        })()
                    })),
                    // Advanced Forecasting Features
                    demand_forecasting: demandForecasting[0].map(row => ({
                        item_id: row.item_id,
                        item_name: row.item_name,
                        avg_monthly_demand: parseFloat(row.avg_monthly_demand) || 0,
                        demand_trend: parseFloat(row.demand_trend) || 0,
                        trend_direction: row.trend_direction,
                        next_month_forecast: parseFloat(row.next_month_forecast) || 0,
                        month_2_forecast: parseFloat(row.month_2_forecast) || 0,
                        month_3_forecast: parseFloat(row.month_3_forecast) || 0,
                        forecast_confidence: row.forecast_confidence,
                        months_of_stock_cover: parseFloat(row.months_of_stock_cover) || 0,
                        interpretation: (() => {
                            const trend = row.trend_direction;
                            const confidence = row.forecast_confidence;
                            const avgDemand = parseFloat(row.avg_monthly_demand) || 0;
                            const nextMonth = parseFloat(row.next_month_forecast) || 0;
                            let trendText = '';
                            switch (trend) {
                                case 'strong_increasing':
                                    trendText = 'demand is rapidly increasing';
                                    break;
                                case 'moderate_increasing':
                                    trendText = 'demand is moderately increasing';
                                    break;
                                case 'stable':
                                    trendText = 'demand is stable';
                                    break;
                                case 'moderate_decreasing':
                                    trendText = 'demand is moderately decreasing';
                                    break;
                                case 'strong_decreasing':
                                    trendText = 'demand is rapidly decreasing';
                                    break;
                            }
                            const confidenceText = confidence === 'high' ? 'high confidence' : confidence === 'medium' ? 'moderate confidence' : 'low confidence (limited data)';
                            return `Average monthly consumption is ${avgDemand} units with ${trendText}. Next month forecast: ${nextMonth} units (${confidenceText}). Plan inventory accordingly.`;
                        })()
                    })),
                    reorder_point_optimization: reorderPointOptimization[0].map(row => ({
                        item_id: row.item_id,
                        item_name: row.item_name,
                        optimized_reorder_point: parseFloat(row.optimized_reorder_point) || 0,
                        economic_order_quantity: parseFloat(row.economic_order_quantity) || 0,
                        target_service_level: parseFloat(row.target_service_level) || 95,
                        stock_status: row.stock_status,
                        interpretation: (() => {
                            const reorderPoint = parseFloat(row.optimized_reorder_point) || 0;
                            const eoq = parseFloat(row.economic_order_quantity) || 0;
                            const serviceLevel = parseFloat(row.target_service_level) || 95;
                            const status = row.stock_status;
                            let statusText = '';
                            switch (status) {
                                case 'critical':
                                    statusText = 'CRITICAL: Reorder immediately to prevent stockouts';
                                    break;
                                case 'reorder_needed':
                                    statusText = 'Reorder needed soon to maintain service levels';
                                    break;
                                case 'monitor':
                                    statusText = 'Monitor closely - approaching reorder point';
                                    break;
                                case 'adequate':
                                    statusText = 'Stock levels are adequate';
                                    break;
                            }
                            return `${statusText}. Optimal reorder point: ${reorderPoint} units. Economic order quantity: ${eoq} units. Target service level: ${serviceLevel.toFixed(1)}%.`;
                        })()
                    })),
                    // Data Validation Alerts
                    data_quality_alerts: dataValidationAlerts[0].map(row => ({
                        item_id: row.item_id,
                        item_name: row.item_name,
                        anomaly_type: row.anomaly_type,
                        description: row.anomaly_description,
                        recommended_action: row.recommended_action,
                        severity: row.anomaly_type === 'negative_inventory' ? 'critical' :
                            row.anomaly_type === 'consumption_spike' ? 'high' :
                                row.anomaly_type === 'supplier_performance_issue' ? 'medium' : 'low',
                        interpretation: (() => {
                            const type = row.anomaly_type;
                            const severity = row.anomaly_type === 'negative_inventory' ? 'CRITICAL' :
                                row.anomaly_type === 'consumption_spike' ? 'HIGH PRIORITY' :
                                    row.anomaly_type === 'supplier_performance_issue' ? 'MEDIUM PRIORITY' : 'LOW PRIORITY';
                            switch (type) {
                                case 'negative_inventory':
                                    return `${severity}: System shows negative inventory which is impossible. Check for data entry errors or system bugs immediately.`;
                                case 'consumption_spike':
                                    return `${severity}: Unusual consumption spike detected. Verify if this is legitimate usage or potential data error/theft.`;
                                case 'unrealistic_cover':
                                    return `${severity}: Stock would last unrealistically long. Review consumption data accuracy and consider reducing safety stock.`;
                                case 'supplier_performance_issue':
                                    return `${severity}: Supplier delivery delays detected. Consider alternative suppliers or renegotiate terms.`;
                                case 'missing_thresholds':
                                    return `${severity}: No minimum/maximum stock levels set. Define thresholds to enable proper inventory management.`;
                                default:
                                    return `${severity}: Data quality issue detected. ${row.recommended_action}.`;
                            }
                        })()
                    }))
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
            const { page = 1, count = 10, start_date, end_date } = req.query;
            // Validate and sanitize pagination parameters
            const parsedCount = parseInt(count);
            const limit = isNaN(parsedCount) ? 10 : Math.max(1, parsedCount); // Min 1 record, no maximum limit
            const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;
            // Build date filter conditions
            let dateFilter = '';
            const dateParams = [];
            if (start_date) {
                dateFilter += ' AND transaction_date >= ?';
                dateParams.push(start_date);
            }
            if (end_date) {
                dateFilter += ' AND transaction_date <= ?';
                dateParams.push(end_date);
            }
            // Default to last 12 months if no date filters provided
            const defaultStartDate = start_date || connection.raw('DATE_SUB(CURDATE(), INTERVAL 12 MONTH)');
            const defaultEndDate = end_date || connection.raw('CURDATE()');
            // Movement by type - Use date filters or default to last 12 months
            const movementByType = await connection('inv_inventory_transactions')
                .select(connection.raw('SUM(CASE WHEN transaction_type = "addition" THEN quantity ELSE 0 END) as total_received'), connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) as total_issued'), connection.raw('SUM(CASE WHEN transaction_type = "adjustment" AND quantity < 0 THEN ABS(quantity) ELSE 0 END) as total_adjustments_negative'), connection.raw('SUM(CASE WHEN transaction_type = "transfer" THEN quantity ELSE 0 END) as net_transfers'), connection.raw('SUM(CASE WHEN transaction_type = "adjustment" THEN quantity ELSE 0 END) as net_adjustments'), connection.raw('SUM(CASE WHEN transaction_type = "wastage" AND wastage_type = "expired" THEN quantity ELSE 0 END) as expired_quantity'), connection.raw('SUM(CASE WHEN transaction_type = "wastage" THEN quantity ELSE 0 END) as total_wastage'))
                .where('transaction_date', '>=', start_date || connection.raw('DATE_SUB(CURDATE(), INTERVAL 12 MONTH)'))
                .andWhere('transaction_date', '<=', end_date || connection.raw('CURDATE()'))
                .first();
            // Item turnover rate - Fixed calculation with pagination and date filters
            const itemTurnoverRate = await connection('inv_inventory_items')
                .leftJoin('inv_inventory_transactions', 'inv_inventory_items.id', 'inv_inventory_transactions.item_id')
                .select('inv_inventory_items.id as item_id', 'inv_inventory_items.name as item_name', 'inv_inventory_items.current_stock', connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) as consumed_quantity'), connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN COALESCE(total_cost, 0) ELSE 0 END) as cogs_value'), connection.raw('CASE WHEN inv_inventory_items.current_stock > 0 THEN (SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) / NULLIF(inv_inventory_items.current_stock, 0)) ELSE 0 END as turnover_ratio'))
                .where('inv_inventory_transactions.transaction_date', '>=', start_date || connection.raw('DATE_SUB(CURDATE(), INTERVAL 365 DAY)'))
                .andWhere('inv_inventory_transactions.transaction_date', '<=', end_date || connection.raw('CURDATE()'))
                .groupBy('inv_inventory_items.id', 'inv_inventory_items.name', 'inv_inventory_items.current_stock')
                .orderBy('turnover_ratio', 'desc')
                .limit(limit)
                .offset(offset);
            // Average inventory age - Include all active items with pagination
            const averageInventoryAge = await connection.raw(`
                    SELECT
                         i.id as item_id,
                         i.name as item_name,
                         COALESCE(MAX(t.transaction_date), i.created_at) as last_movement_date,
                         DATEDIFF(CURDATE(), COALESCE(MAX(t.transaction_date), i.created_at)) as days_since_last_movement
                    FROM inv_inventory_items i
                    LEFT JOIN inv_inventory_transactions t ON i.id = t.item_id
                    WHERE i.is_active = 1
                    GROUP BY i.id, i.name, i.created_at
                    ORDER BY days_since_last_movement DESC
                    LIMIT ? OFFSET ?
               `, [limit, offset]);
            // Movement trends by month - Use date filters
            const movementTrends = await connection('inv_inventory_transactions')
                .select(connection.raw('DATE_FORMAT(transaction_date, "%Y-%m") as month'), connection.raw('SUM(CASE WHEN transaction_type = "addition" THEN quantity ELSE 0 END) as received'), connection.raw('SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) as issued'), connection.raw('SUM(CASE WHEN transaction_type = "transfer" THEN quantity ELSE 0 END) as transfers'), connection.raw('SUM(CASE WHEN transaction_type = "adjustment" THEN quantity ELSE 0 END) as adjustments'), connection.raw('SUM(quantity) as net_movement'))
                .where('transaction_date', '>=', start_date || connection.raw('DATE_SUB(CURDATE(), INTERVAL 12 MONTH)'))
                .andWhere('transaction_date', '<=', end_date || connection.raw('CURDATE()'))
                .groupBy('month')
                .orderBy('month', 'desc');
            const analytics = {
                movement_by_type: {
                    total_received: parseInt(movementByType === null || movementByType === void 0 ? void 0 : movementByType.total_received) || 0,
                    total_issued: parseInt(movementByType === null || movementByType === void 0 ? void 0 : movementByType.total_issued) || 0,
                    total_returned: parseInt(movementByType === null || movementByType === void 0 ? void 0 : movementByType.total_adjustments_negative) || 0,
                    internal_transfers_in: 0, // Placeholder - would need separate transfer tracking
                    internal_transfers_out: 0, // Placeholder - would need separate transfer tracking
                    write_offs: parseInt(movementByType === null || movementByType === void 0 ? void 0 : movementByType.net_adjustments) || 0,
                    expired_quantity: parseInt(movementByType === null || movementByType === void 0 ? void 0 : movementByType.expired_quantity) || 0,
                    wastage_quantity: parseInt(movementByType === null || movementByType === void 0 ? void 0 : movementByType.total_wastage) || 0
                },
                velocity_metrics: {
                    item_turnover_rate: itemTurnoverRate.map((row, index) => ({
                        item_id: row.item_id,
                        item_name: row.item_name,
                        turnover_ratio: parseFloat(row.turnover_ratio) || 0,
                        turnover_category: row.turnover_ratio >= 12 ? 'fast' :
                            row.turnover_ratio >= 4 ? 'medium' : 'slow'
                    })),
                    average_inventory_age: averageInventoryAge.map(row => ({
                        item_id: row.item_id,
                        item_name: row.item_name,
                        average_days_in_stock: parseInt(row.days_since_last_movement) || 0,
                        last_movement_date: row.last_movement_date || ''
                    })),
                    fast_moving_items: itemTurnoverRate.filter(row => row.turnover_ratio >= 1).slice(0, 10).map((row, index) => ({
                        item_id: row.item_id,
                        item_name: row.item_name,
                        monthly_movement: parseFloat(row.consumed_quantity) / 12 || 0, // Annual consumption divided by 12 for monthly average
                        ranking: index + 1
                    })),
                    slow_moving_items: averageInventoryAge.filter(row => row.days_since_last_movement >= 30).slice(0, 10).map(row => ({
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
                message: `Inventory movement analytics retrieved successfully (Page: ${parseInt(page) || 1}, Count: ${limit}, Start: ${start_date || 'default'}, End: ${end_date || 'default'})`,
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
            const { start_date, end_date } = req.query;
            // Expiring batches (next 90 days)
            const expiringBatches = await connection('inv_inventory_batches')
                .leftJoin('inv_inventory_items', 'inv_inventory_batches.item_id', 'inv_inventory_items.id')
                .select('inv_inventory_batches.id as batch_id', 'inv_inventory_batches.batch_number', 'inv_inventory_batches.expiry_date', 'inv_inventory_batches.quantity as batch_quantity', 'inv_inventory_items.id as item_id', 'inv_inventory_items.name as item_name', connection.raw('DATEDIFF(inv_inventory_batches.expiry_date, CURDATE()) as days_until_expiry'))
                .modify(function (queryBuilder) {
                if (start_date) {
                    queryBuilder.andWhere('inv_inventory_batches.expiry_date', '>=', start_date);
                }
                else {
                    queryBuilder.andWhere('inv_inventory_batches.expiry_date', '>=', connection.raw('CURDATE()'));
                }
                if (end_date) {
                    queryBuilder.andWhere('inv_inventory_batches.expiry_date', '<=', end_date);
                }
                else {
                    queryBuilder.andWhere('inv_inventory_batches.expiry_date', '<=', connection.raw('DATE_ADD(CURDATE(), INTERVAL 90 DAY)'));
                }
            })
                .andWhere('inv_inventory_batches.quantity', '>', 0)
                .orderBy('days_until_expiry', 'asc')
                .limit(100);
            // Expired batches
            const expiredBatches = await connection('inv_inventory_batches')
                .leftJoin('inv_inventory_items', 'inv_inventory_batches.item_id', 'inv_inventory_items.id')
                .select('inv_inventory_batches.id as batch_id', 'inv_inventory_batches.batch_number', 'inv_inventory_batches.expiry_date', 'inv_inventory_batches.quantity as batch_quantity', 'inv_inventory_items.id as item_id', 'inv_inventory_items.name as item_name', connection.raw('DATEDIFF(CURDATE(), inv_inventory_batches.expiry_date) as days_expired'))
                .modify(function (queryBuilder) {
                if (start_date) {
                    queryBuilder.andWhere('inv_inventory_batches.expiry_date', '<', start_date);
                }
                else {
                    queryBuilder.andWhere('inv_inventory_batches.expiry_date', '<', connection.raw('CURDATE()'));
                }
            })
                .andWhere('inv_inventory_batches.quantity', '>', 0)
                .orderBy('days_expired', 'desc')
                .limit(50);
            // Batch expiry distribution
            const batchExpiryDistribution = await connection('inv_inventory_batches')
                .select(connection.raw('CASE WHEN DATEDIFF(expiry_date, CURDATE()) <= 30 THEN "0-30_days" WHEN DATEDIFF(expiry_date, CURDATE()) <= 60 THEN "31-60_days" WHEN DATEDIFF(expiry_date, CURDATE()) <= 90 THEN "61-90_days" WHEN DATEDIFF(expiry_date, CURDATE()) <= 180 THEN "91-180_days" ELSE "181+_days" END as expiry_range'), connection.raw('COUNT(*) as batch_count'), connection.raw('SUM(quantity) as total_quantity'))
                .modify(function (queryBuilder) {
                if (start_date) {
                    queryBuilder.andWhere('expiry_date', '>=', start_date);
                }
                else {
                    queryBuilder.andWhere('expiry_date', '>=', connection.raw('CURDATE()'));
                }
                if (end_date) {
                    queryBuilder.andWhere('expiry_date', '<=', end_date);
                }
                else {
                    queryBuilder.andWhere('expiry_date', '<=', connection.raw('DATE_ADD(CURDATE(), INTERVAL 365 DAY)'));
                }
            })
                .andWhere('quantity', '>', 0)
                .groupBy('expiry_range');
            // Items with multiple batches
            const itemsWithMultipleBatches = await connection('inv_inventory_batches')
                .leftJoin('inv_inventory_items', 'inv_inventory_batches.item_id', 'inv_inventory_items.id')
                .select('inv_inventory_items.id as item_id', 'inv_inventory_items.name as item_name', connection.raw('COUNT(inv_inventory_batches.id) as batch_count'), connection.raw('SUM(inv_inventory_batches.quantity) as total_quantity'), connection.raw('MIN(inv_inventory_batches.expiry_date) as earliest_expiry'), connection.raw('MAX(inv_inventory_batches.expiry_date) as latest_expiry'))
                .modify(function (queryBuilder) {
                if (start_date) {
                    queryBuilder.andWhere('inv_inventory_batches.expiry_date', '>=', start_date);
                }
                else {
                    queryBuilder.andWhere('inv_inventory_batches.expiry_date', '>=', connection.raw('CURDATE()'));
                }
                if (end_date) {
                    queryBuilder.andWhere('inv_inventory_batches.expiry_date', '<=', end_date);
                }
                else {
                    queryBuilder.andWhere('inv_inventory_batches.expiry_date', '<=', connection.raw('DATE_ADD(CURDATE(), INTERVAL 365 DAY)'));
                }
            })
                .andWhere('inv_inventory_batches.quantity', '>', 0)
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
                .modify(function (queryBuilder) {
                if (start_date) {
                    queryBuilder.andWhere('inv_inventory_batches.expiry_date', '>=', start_date);
                }
                else {
                    queryBuilder.andWhere('inv_inventory_batches.expiry_date', '>=', connection.raw('CURDATE()'));
                }
                if (end_date) {
                    queryBuilder.andWhere('inv_inventory_batches.expiry_date', '<=', end_date);
                }
                else {
                    queryBuilder.andWhere('inv_inventory_batches.expiry_date', '<=', connection.raw('DATE_ADD(CURDATE(), INTERVAL 365 DAY)'));
                }
            })
                .andWhere('inv_inventory_batches.quantity', '>', 0)
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
            const { start_date, end_date, supplierId, item_id, count = 10, page = 1 } = req.query;
            // Validate and sanitize pagination parameters
            const limit = Math.min(parseInt(count) || 10, 1000); // Max 1000 records
            const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;
            let whereConditions = '';
            const params = [];
            if (start_date) {
                whereConditions += ' AND r.received_date >= ?';
                params.push(start_date);
            }
            if (end_date) {
                whereConditions += ' AND r.received_date <= ?';
                params.push(end_date);
            }
            if (supplierId) {
                whereConditions += ' AND po.supplier_id = ?';
                params.push(supplierId);
            }
            if (item_id) {
                whereConditions += ' AND poi.inventory_item_id = ?';
                params.push(item_id);
            }
            const actualItemsReceived = await connection.raw(`
                    SELECT
                         r.id AS receipt_item_id,
                         r.id AS receipt_id,
                         r.receipt_number,
                         r.received_date AS receipt_date,
                         r.order_id,
                         po.supplier_id,
                         s.name AS supplier_name,
                         r.order_item_id,
                         poi.inventory_item_id,
                         i.name AS item_name,
                         r.quantity_received,
                         CASE WHEN r.condition_status IN ('damaged', 'expired') THEN r.quantity_received ELSE 0 END AS quantity_rejected,
                         r.unit_price,
                         r.batch_number,
                         r.expiry_date,
                         (r.quantity_received * r.unit_price) AS total_value
                    FROM inv_purchase_order_receipts r
                    JOIN inv_purchase_orders po ON po.id = r.order_id
                    JOIN inv_purchase_order_items poi ON poi.id = r.order_item_id
                    LEFT JOIN inv_suppliers s ON s.id = po.supplier_id
                    LEFT JOIN inv_inventory_items i ON i.id = poi.inventory_item_id
                    WHERE 1=1 ${whereConditions}
                    ORDER BY r.received_date DESC
                    LIMIT ? OFFSET ?
               `, [...params, limit, offset]);
            // 2. Supplier Actual Spend Analytics
            const supplierActualSpend = await connection.raw(`
                    SELECT 
                         po.supplier_id,
                         s.name AS supplier_name,
                         SUM(r.quantity_received * r.unit_price) AS actual_spend,
                         SUM(r.quantity_received) AS total_items_received,
                         AVG(r.unit_price) AS avg_unit_price,
                         COUNT(DISTINCT r.id) AS total_receipts
                    FROM inv_purchase_order_receipts r
                    JOIN inv_purchase_orders po ON po.id = r.order_id
                    LEFT JOIN inv_suppliers s ON s.id = po.supplier_id
                    WHERE 1=1 ${whereConditions}
                    GROUP BY po.supplier_id, s.name
                    ORDER BY actual_spend DESC
                    LIMIT ? OFFSET ?
               `, [...params, limit, offset]);
            const itemActualSpend = await connection.raw(`
                    SELECT
                         poi.inventory_item_id,
                         i.name AS item_name,
                         c.name AS category,
                         SUM(r.quantity_received * r.unit_price) AS item_spend,
                         SUM(r.quantity_received) AS total_received,
                         AVG(r.unit_price) AS avg_unit_price,
                         COUNT(DISTINCT po.supplier_id) AS supplier_count
                    FROM inv_purchase_order_receipts r
                    JOIN inv_purchase_orders po ON po.id = r.order_id
                    JOIN inv_purchase_order_items poi ON poi.id = r.order_item_id
                    LEFT JOIN inv_inventory_items i ON i.id = poi.inventory_item_id
                    LEFT JOIN inv_categories c ON c.id = i.category_id
                    WHERE 1=1 ${whereConditions}
                    GROUP BY poi.inventory_item_id, i.name, c.name
                    ORDER BY item_spend DESC
                    LIMIT ? OFFSET ?
               `, [...params, limit, offset]);
            const supplierFillRate = await connection.raw(`
                    SELECT
                         po.supplier_id,
                         s.name AS supplier_name,
                         SUM(r.quantity_received) AS total_received,
                         SUM(poi.quantity_ordered) AS total_ordered,
                         ROUND(100 * SUM(r.quantity_received) / NULLIF(SUM(poi.quantity_ordered),0),2) AS fill_rate_pct
                    FROM inv_purchase_order_receipts r
                    JOIN inv_purchase_orders po ON po.id = r.order_id
                    JOIN inv_purchase_order_items poi ON poi.id = r.order_item_id
                    LEFT JOIN inv_suppliers s ON s.id = po.supplier_id
                    WHERE 1=1 ${whereConditions}
                    GROUP BY po.supplier_id, s.name
                    HAVING total_ordered > 0
                    ORDER BY fill_rate_pct DESC
                    LIMIT ? OFFSET ?
               `, [...params, limit, offset]);
            const deliveryTimeliness = await connection.raw(`
                    SELECT
                         po.supplier_id,
                         s.name AS supplier_name,
                         COUNT(*) AS total_deliveries,
                         SUM(CASE WHEN r.received_date <= po.expected_delivery_date THEN 1 ELSE 0 END) AS on_time_deliveries,
                         ROUND(100 * SUM(CASE WHEN r.received_date <= po.expected_delivery_date THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0),2) AS on_time_pct,
                         AVG(DATEDIFF(r.received_date, po.expected_delivery_date)) AS avg_days_variance
                    FROM inv_purchase_order_receipts r
                    JOIN inv_purchase_orders po ON po.id = r.order_id
                    LEFT JOIN inv_suppliers s ON s.id = po.supplier_id
                    WHERE 1=1 ${whereConditions}
                    AND po.expected_delivery_date IS NOT NULL
                    GROUP BY po.supplier_id, s.name
                    ORDER BY on_time_pct DESC
                    LIMIT ? OFFSET ?
               `, [...params, limit, offset]);
            const procurementRejectionRate = await connection.raw(`
                    SELECT
                         po.supplier_id,
                         s.name AS supplier_name,
                         poi.inventory_item_id,
                         i.name AS item_name,
                         SUM(r.quantity_received) AS received,
                         SUM(CASE WHEN r.condition_status IN ('damaged', 'expired', 'rejected') THEN r.quantity_received ELSE 0 END) AS rejected,
                         ROUND(
                              100 * SUM(CASE WHEN r.condition_status IN ('damaged', 'expired', 'rejected') THEN r.quantity_received ELSE 0 END) / NULLIF(SUM(r.quantity_received),0),
                              2
                         ) AS rejection_rate_pct
                    FROM inv_purchase_order_receipts r
                    JOIN inv_purchase_orders po ON po.id = r.order_id
                    JOIN inv_purchase_order_items poi ON poi.id = r.order_item_id
                    LEFT JOIN inv_suppliers s ON s.id = po.supplier_id
                    LEFT JOIN inv_inventory_items i ON i.id = poi.inventory_item_id
                    WHERE 1=1 ${whereConditions}
                    GROUP BY po.supplier_id, s.name, poi.inventory_item_id, i.name
                    HAVING received > 0
                    ORDER BY rejection_rate_pct DESC
                    LIMIT ? OFFSET ?
               `, [...params, limit, offset]);
            const inventoryAdditions = await connection.raw(`
                    SELECT
                         t.id AS transaction_id,
                         t.transaction_date,
                         t.item_id,
                         i.name AS item_name,
                         c.name AS category,
                         t.quantity,
                         t.unit_cost,
                         (t.quantity * t.unit_cost) AS total_value,
                         t.batch_number,
                         t.expiry_date,
                         t.reference_id,
                         t.performed_by
                    FROM inv_inventory_transactions t
                    LEFT JOIN inv_inventory_items i ON i.id = t.item_id
                    LEFT JOIN inv_categories c ON c.id = i.category_id
                    WHERE t.transaction_type = 'addition' ${whereConditions.replace(/r\.received_date/g, 't.transaction_date').replace(/po\.supplier_id/g, '1=1')}
                    ORDER BY t.transaction_date DESC
                    LIMIT ? OFFSET ?
               `, [...params, limit, offset]);
            const batchExpiryAnalytics = await connection.raw(`
                    SELECT
                         r.batch_number,
                         r.expiry_date,
                         SUM(r.quantity_received) AS total_received,
                         poi.inventory_item_id,
                         i.name AS item_name,
                         DATEDIFF(r.expiry_date, CURDATE()) AS days_to_expiry,
                         CASE
                              WHEN DATEDIFF(r.expiry_date, CURDATE()) <= 30 THEN 'Critical'
                              WHEN DATEDIFF(r.expiry_date, CURDATE()) <= 90 THEN 'Warning'
                              ELSE 'Good'
                         END AS expiry_status
                    FROM inv_purchase_order_receipts r
                    JOIN inv_purchase_order_items poi ON poi.id = r.order_item_id
                    LEFT JOIN inv_inventory_items i ON i.id = poi.inventory_item_id
                    WHERE r.expiry_date IS NOT NULL
                    AND r.batch_number IS NOT NULL
                    AND DATEDIFF(r.expiry_date, CURDATE()) <= 90 ${whereConditions}
                    GROUP BY r.batch_number, r.expiry_date, poi.inventory_item_id, i.name
                    ORDER BY days_to_expiry ASC
                    LIMIT ? OFFSET ?
               `, [...params, limit, offset]);
            // 9. Monthly Procurement Cost
            const monthlyProcurementCost = await connection.raw(`
                    SELECT
                         DATE_FORMAT(r.received_date, '%Y-%m') AS month,
                         DATE_FORMAT(r.received_date, '%M %Y') AS month_name,
                         SUM(r.quantity_received * r.unit_price) AS monthly_cost,
                         SUM(r.quantity_received) AS total_items,
                         COUNT(DISTINCT po.supplier_id) AS supplier_count,
                         COUNT(DISTINCT r.id) AS receipt_count
                    FROM inv_purchase_order_receipts r
                    JOIN inv_purchase_orders po ON po.id = r.order_id
                    WHERE r.received_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH) ${whereConditions}
                    GROUP BY month, month_name
                    ORDER BY month ASC
               `, params);
            // 10. Supplier Reliability Score (Weighted Score Based on Receipts)
            const supplierReliabilityScore = await connection.raw(`
                    SELECT
                         s.supplier_id,
                         sup.name AS supplier_name,

                         -- Individual Metrics
                         ROUND(AVG(s.on_time_score),2) AS avg_on_time_score,
                         ROUND(AVG(s.fill_rate_pct),2) AS avg_fill_rate,
                         ROUND(AVG(s.rejection_rate_pct),2) AS avg_rejection_rate,

                         -- Weighted Reliability Score (50% delivery + 35% fill rate + 15% rejection penalty)
                         ROUND(
                              (0.50 * AVG(s.on_time_score)) +
                              (0.35 * AVG(s.fill_rate_pct)) +
                              (0.15 * (100 - AVG(s.rejection_rate_pct)))
                         ,2) AS supplier_reliability_score,

                         -- Additional Context
                         COUNT(DISTINCT s.purchase_order_id) AS total_orders,
                         SUM(s.total_value) AS total_spend

                    FROM (
                         SELECT
                              po.supplier_id,
                              po.id AS purchase_order_id,
                              r.id AS receipt_id,

                              -- ON-TIME DELIVERY SCORE
                              CASE
                                   WHEN po.expected_delivery_date IS NULL THEN 100
                                   WHEN DATEDIFF(r.received_date, po.expected_delivery_date) <= 0
                                   THEN 100 ELSE 0
                              END AS on_time_score,

                              -- FILL RATE PERCENTAGE
                              COALESCE(
                                   (SUM(r.quantity_received) / NULLIF(SUM(poi.quantity_ordered),0)) * 100,
                                   0
                              ) AS fill_rate_pct,

                              -- REJECTION RATE PERCENTAGE
                              COALESCE(
                                   (SUM(CASE WHEN r.condition_status IN ('damaged', 'expired', 'rejected') THEN r.quantity_received ELSE 0 END) / NULLIF(SUM(r.quantity_received),0)) * 100,
                                   0
                              ) AS rejection_rate_pct,

                              -- TOTAL VALUE
                              SUM(r.quantity_received * r.unit_price) AS total_value

                         FROM inv_purchase_order_receipts r
                         JOIN inv_purchase_order_items poi ON poi.id = r.order_item_id
                         JOIN inv_purchase_orders po ON po.id = r.order_id
                         WHERE 1=1 ${whereConditions.replace('WHERE 1=1', '').replace('AND r.received_date', 'AND r.received_date')}

                         GROUP BY po.supplier_id, po.id, r.id
                    ) s
                    LEFT JOIN inv_suppliers sup ON sup.id = s.supplier_id
                    GROUP BY s.supplier_id, sup.name
                    ORDER BY supplier_reliability_score DESC
                    LIMIT ? OFFSET ?
               `, [...params, limit, offset]); // Procurement Summary
            const procurementSummary = await connection.raw(`
                    SELECT
                         SUM(r.quantity_received * r.unit_price) AS total_procurement_spend,
                         SUM(r.quantity_received) AS total_items_received,
                         SUM(CASE WHEN r.condition_status IN ('damaged', 'expired', 'rejected') THEN r.quantity_received ELSE 0 END) AS total_items_rejected,
                         COUNT(DISTINCT po.supplier_id) AS active_suppliers,
                         COUNT(DISTINCT r.id) AS total_receipts,
                         COUNT(DISTINCT po.id) AS total_orders,

                         -- Average metrics
                         AVG(r.unit_price) AS avg_unit_price,

                         -- Rejection rate
                         ROUND(
                              100 * SUM(CASE WHEN r.condition_status IN ('damaged', 'expired', 'rejected') THEN r.quantity_received ELSE 0 END) / NULLIF(SUM(r.quantity_received), 0),
                              2
                         ) AS overall_rejection_rate
                    FROM inv_purchase_order_receipts r
                    JOIN inv_purchase_orders po ON po.id = r.order_id
                    WHERE 1=1 ${whereConditions}
               `, params);
            const analytics = {
                actual_items_received: actualItemsReceived[0],
                supplier_actual_spend: supplierActualSpend[0],
                item_actual_spend: itemActualSpend[0],
                supplier_fill_rate: supplierFillRate[0],
                delivery_timeliness: deliveryTimeliness[0],
                procurement_rejection_rate: procurementRejectionRate[0],
                inventory_additions: inventoryAdditions[0],
                batch_expiry_analytics: batchExpiryAnalytics[0],
                monthly_procurement_cost: monthlyProcurementCost[0],
                supplier_reliability_score: supplierReliabilityScore[0],
                summary: procurementSummary[0][0]
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
            const { start_date, end_date } = req.query;
            // Current valuation (simplified - using most recent unit cost from transactions)
            const [fifoValuation] = await connection.raw(`
                    SELECT SUM(i.current_stock * COALESCE((
                         SELECT t.unit_cost
                         FROM inv_inventory_transactions t
                         WHERE t.item_id = i.id AND t.transaction_type = 'addition' AND t.unit_cost IS NOT NULL
                         ORDER BY t.transaction_date DESC
                         LIMIT 1
                    ), 0)) as fifo_value
                    FROM inv_inventory_items i
                    WHERE i.is_active = 1
               `);
            const [lifoValuation] = await connection.raw(`
                    SELECT SUM(i.current_stock * COALESCE((
                         SELECT t.unit_cost
                         FROM inv_inventory_transactions t
                         WHERE t.item_id = i.id AND t.transaction_type = 'addition' AND t.unit_cost IS NOT NULL
                         ORDER BY t.transaction_date DESC
                         LIMIT 1
                    ), 0)) as lifo_value
                    FROM inv_inventory_items i
                    WHERE i.is_active = 1
               `); // Simplified - LIFO would need different calculation
            const [weightedAvgValuation] = await connection.raw(`
                    SELECT SUM(i.current_stock * COALESCE((
                         SELECT AVG(t.unit_cost)
                         FROM inv_inventory_transactions t
                         WHERE t.item_id = i.id AND t.transaction_type = 'addition' AND t.unit_cost IS NOT NULL
                         ${start_date ? 'AND t.transaction_date >= ?' : ''}
                         ${end_date ? 'AND t.transaction_date <= ?' : ''}
                         ${!start_date && !end_date ? 'AND t.transaction_date >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)' : ''}
                    ), 0)) as weighted_avg_value
                    FROM inv_inventory_items i
                    WHERE i.is_active = 1
               `, [...(start_date ? [start_date] : []), ...(end_date ? [end_date] : [])]);
            // Slow moving value
            const [slowMovingValue] = await connection.raw(`
                    SELECT SUM(CASE WHEN DATEDIFF(CURDATE(), MAX(t.transaction_date)) >= 90 THEN i.current_stock * COALESCE((
                         SELECT sub_t.unit_cost
                         FROM inv_inventory_transactions sub_t
                         WHERE sub_t.item_id = i.id AND sub_t.transaction_type = 'addition' AND sub_t.unit_cost IS NOT NULL
                         ORDER BY sub_t.transaction_date DESC
                         LIMIT 1
                    ), 0) ELSE 0 END) as slow_moving_value
                    FROM inv_inventory_items i
                    LEFT JOIN inv_inventory_transactions t ON i.id = t.item_id
                    WHERE i.is_active = 1
                    GROUP BY i.id
               `);
            // Expired stock value
            const [expiredValue] = await connection.raw(`
                    SELECT SUM(CASE WHEN b.expiry_date < CURDATE() THEN b.quantity * COALESCE((
                         SELECT t.unit_cost
                         FROM inv_inventory_transactions t
                         WHERE t.item_id = b.item_id AND t.transaction_type = 'addition' AND t.unit_cost IS NOT NULL
                         ORDER BY t.transaction_date DESC
                         LIMIT 1
                    ), 0) ELSE 0 END) as expired_value
                    FROM inv_inventory_batches b
                    WHERE b.quantity > 0
               `);
            // Near expiry value
            const [nearExpiryValue] = await connection.raw(`
                    SELECT SUM(CASE WHEN b.expiry_date >= CURDATE() AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 90 DAY) THEN b.quantity * COALESCE((
                         SELECT t.unit_cost
                         FROM inv_inventory_transactions t
                         WHERE t.item_id = b.item_id AND t.transaction_type = 'addition' AND t.unit_cost IS NOT NULL
                         ORDER BY t.transaction_date DESC
                         LIMIT 1
                    ), 0) ELSE 0 END) as near_expiry_value
                    FROM inv_inventory_batches b
                    WHERE b.quantity > 0
               `);
            // Cost trends by month
            const costTrends = await connection('inv_inventory_transactions')
                .leftJoin('inv_purchase_order_receipts', function () {
                this.on('inv_inventory_transactions.batch_number', 'inv_purchase_order_receipts.batch_number')
                    .andOn('inv_inventory_transactions.expiry_date', 'inv_purchase_order_receipts.expiry_date');
            })
                .select(connection.raw('DATE_FORMAT(inv_inventory_transactions.transaction_date, "%Y-%m") as month'), connection.raw('SUM(CASE WHEN inv_inventory_transactions.transaction_type = "addition" THEN COALESCE(inv_inventory_transactions.total_cost, 0) ELSE 0 END) as additions_cost'), connection.raw('SUM(CASE WHEN inv_inventory_transactions.transaction_type = "consumption" THEN COALESCE(inv_inventory_transactions.total_cost, inv_inventory_transactions.quantity * COALESCE(inv_purchase_order_receipts.unit_price, inv_inventory_transactions.unit_cost, 0)) ELSE 0 END) as consumption_cost'), connection.raw('SUM(CASE WHEN inv_inventory_transactions.transaction_type = "adjustment" THEN COALESCE(inv_inventory_transactions.total_cost, 0) ELSE 0 END) as write_off_cost'), connection.raw('SUM(COALESCE(inv_inventory_transactions.total_cost, CASE WHEN inv_inventory_transactions.transaction_type = "consumption" THEN inv_inventory_transactions.quantity * COALESCE(inv_purchase_order_receipts.unit_price, inv_inventory_transactions.unit_cost, 0) ELSE 0 END)) as net_cost_change'))
                .modify(function (queryBuilder) {
                if (start_date) {
                    queryBuilder.andWhere('inv_inventory_transactions.transaction_date', '>=', start_date);
                }
                else {
                    queryBuilder.andWhere('inv_inventory_transactions.transaction_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 12 MONTH)'));
                }
                if (end_date) {
                    queryBuilder.andWhere('inv_inventory_transactions.transaction_date', '<=', end_date);
                }
                else {
                    queryBuilder.andWhere('inv_inventory_transactions.transaction_date', '<=', connection.raw('CURDATE()'));
                }
            })
                .groupBy('month')
                .orderBy('month', 'desc');
            // Cost of goods issued
            const [cogiResult] = await connection('inv_inventory_transactions')
                .leftJoin('inv_purchase_order_receipts', function () {
                this.on('inv_inventory_transactions.batch_number', 'inv_purchase_order_receipts.batch_number')
                    .andOn('inv_inventory_transactions.expiry_date', 'inv_purchase_order_receipts.expiry_date');
            })
                .select(connection.raw('SUM(CASE WHEN inv_inventory_transactions.transaction_type = "consumption" THEN COALESCE(inv_inventory_transactions.total_cost, inv_inventory_transactions.quantity * COALESCE(inv_purchase_order_receipts.unit_price, inv_inventory_transactions.unit_cost, 0)) ELSE 0 END) as cogi'))
                .modify(function (queryBuilder) {
                if (start_date) {
                    queryBuilder.andWhere('inv_inventory_transactions.transaction_date', '>=', start_date);
                }
                else {
                    queryBuilder.andWhere('inv_inventory_transactions.transaction_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 365 DAY)'));
                }
                if (end_date) {
                    queryBuilder.andWhere('inv_inventory_transactions.transaction_date', '<=', end_date);
                }
                else {
                    queryBuilder.andWhere('inv_inventory_transactions.transaction_date', '<=', connection.raw('CURDATE()'));
                }
            });
            // Average cost per unit
            const [avgCostResult] = await connection.raw(`
                    SELECT AVG(COALESCE((
                         SELECT t.unit_cost
                         FROM inv_inventory_transactions t
                         WHERE t.item_id = i.id AND t.transaction_type = 'addition' AND t.unit_cost IS NOT NULL
                         ORDER BY t.transaction_date DESC
                         LIMIT 1
                    ), 0)) as avg_cost
                    FROM inv_inventory_items i
                    WHERE i.is_active = 1 AND i.current_stock > 0
               `);
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
            const { start_date, end_date } = req.query;
            const connection = await (0, KnexConnections_1.default)(tenantId);
            // Consumption trends
            const consumptionTrends = await connection('inv_inventory_transactions')
                .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
                .leftJoin('inv_purchase_order_receipts', function () {
                this.on('inv_inventory_transactions.batch_number', 'inv_purchase_order_receipts.batch_number')
                    .andOn('inv_inventory_transactions.expiry_date', 'inv_purchase_order_receipts.expiry_date');
            })
                .select('inv_purchase_order_receipts.unit_price', connection.raw('DATE_FORMAT(inv_inventory_transactions.transaction_date, "%Y-%m-%d") as date'), connection.raw('SUM(CASE WHEN inv_inventory_transactions.transaction_type = "consumption" THEN inv_inventory_transactions.quantity ELSE 0 END) as total_consumed'), connection.raw('COUNT(DISTINCT CASE WHEN inv_inventory_transactions.transaction_type = "consumption" THEN inv_inventory_transactions.item_id END) as unique_items_used'), connection.raw('AVG(CASE WHEN inv_inventory_transactions.transaction_type = "consumption" THEN COALESCE(inv_purchase_order_receipts.unit_price, inv_inventory_transactions.unit_cost, 0) ELSE NULL END) as avg_unit_price'))
                .where('inv_inventory_transactions.transaction_type', 'consumption')
                .modify(function (queryBuilder) {
                if (start_date) {
                    queryBuilder.andWhere('inv_inventory_transactions.transaction_date', '>=', start_date);
                }
                else {
                    queryBuilder.andWhere('inv_inventory_transactions.transaction_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 90 DAY)'));
                }
                if (end_date) {
                    queryBuilder.andWhere('inv_inventory_transactions.transaction_date', '<=', end_date);
                }
            })
                .groupBy('date')
                .orderBy('date', 'desc');
            // Employee-based consumption analysis
            const departmentConsumption = await connection('inv_inventory_transactions')
                .leftJoin('roles', 'inv_inventory_transactions.performed_by', 'roles.employeeid')
                .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
                .leftJoin('inv_purchase_order_receipts', function () {
                this.on('inv_inventory_transactions.batch_number', 'inv_purchase_order_receipts.batch_number')
                    .andOn('inv_inventory_transactions.expiry_date', 'inv_purchase_order_receipts.expiry_date');
            })
                .select(connection.raw('COALESCE(inv_inventory_transactions.performed_by, "Unknown") as performed_by'), 'roles.username', 'roles.role', connection.raw('SUM(CASE WHEN inv_inventory_transactions.transaction_type = "consumption" THEN inv_inventory_transactions.quantity ELSE 0 END) as total_consumed'), connection.raw('COUNT(DISTINCT CASE WHEN inv_inventory_transactions.transaction_type = "consumption" THEN inv_inventory_transactions.item_id END) as unique_items_used'), connection.raw('SUM(CASE WHEN inv_inventory_transactions.transaction_type = "consumption" THEN COALESCE(inv_inventory_transactions.total_cost, inv_inventory_transactions.quantity * COALESCE(inv_purchase_order_receipts.unit_price, inv_inventory_transactions.unit_cost, 0)) ELSE 0 END) as consumption_value'), connection.raw('COUNT(CASE WHEN inv_inventory_transactions.transaction_type = "consumption" THEN 1 END) as transaction_count'))
                .where('inv_inventory_transactions.transaction_type', 'consumption')
                .modify(function (queryBuilder) {
                if (start_date) {
                    queryBuilder.andWhere('inv_inventory_transactions.transaction_date', '>=', start_date);
                }
                else {
                    queryBuilder.andWhere('inv_inventory_transactions.transaction_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 90 DAY)'));
                }
                if (end_date) {
                    queryBuilder.andWhere('inv_inventory_transactions.transaction_date', '<=', end_date);
                }
            })
                .groupBy('inv_inventory_transactions.performed_by')
                .orderBy('total_consumed', 'desc');
            // Category-based consumption analysis
            const categoryConsumption = await connection('inv_inventory_transactions')
                .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
                .leftJoin('inv_categories', 'inv_inventory_items.category_id', 'inv_categories.id')
                .leftJoin('inv_purchase_order_receipts', function () {
                this.on('inv_inventory_transactions.batch_number', 'inv_purchase_order_receipts.batch_number')
                    .andOn('inv_inventory_transactions.expiry_date', 'inv_purchase_order_receipts.expiry_date');
            })
                .select('inv_categories.name as category_name', connection.raw('SUM(CASE WHEN inv_inventory_transactions.transaction_type = "consumption" THEN inv_inventory_transactions.quantity ELSE 0 END) as total_consumed'), connection.raw('COUNT(DISTINCT CASE WHEN inv_inventory_transactions.transaction_type = "consumption" THEN inv_inventory_transactions.item_id END) as unique_items_used'), connection.raw('SUM(CASE WHEN inv_inventory_transactions.transaction_type = "consumption" THEN COALESCE(inv_inventory_transactions.total_cost, inv_inventory_transactions.quantity * COALESCE(inv_purchase_order_receipts.unit_price, inv_inventory_transactions.unit_cost, 0)) ELSE 0 END) as consumption_value'), connection.raw('COUNT(CASE WHEN inv_inventory_transactions.transaction_type = "consumption" THEN 1 END) as transaction_count'))
                .where('inv_inventory_transactions.transaction_type', 'consumption')
                .whereNotNull('inv_categories.name')
                .modify(function (queryBuilder) {
                if (start_date) {
                    queryBuilder.andWhere('inv_inventory_transactions.transaction_date', '>=', start_date);
                }
                else {
                    queryBuilder.andWhere('inv_inventory_transactions.transaction_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 90 DAY)'));
                }
                if (end_date) {
                    queryBuilder.andWhere('inv_inventory_transactions.transaction_date', '<=', end_date);
                }
            })
                .groupBy('inv_categories.name')
                .orderBy('total_consumed', 'desc');
            // Predictive usage (simplified)
            const predictiveUsage = await connection('inv_inventory_transactions')
                .leftJoin('inv_inventory_items', 'inv_inventory_transactions.item_id', 'inv_inventory_items.id')
                .select('inv_inventory_transactions.item_id', 'inv_inventory_items.name as item_name', connection.raw('AVG(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) as avg_monthly_usage'), connection.raw('STDDEV(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) as usage_stddev'), connection.raw('COUNT(CASE WHEN transaction_type = "consumption" THEN 1 END) as usage_count'))
                .where('transaction_type', 'consumption')
                .modify(function (queryBuilder) {
                if (start_date) {
                    queryBuilder.andWhere('inv_inventory_transactions.transaction_date', '>=', start_date);
                }
                else {
                    queryBuilder.andWhere('inv_inventory_transactions.transaction_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 365 DAY)'));
                }
                if (end_date) {
                    queryBuilder.andWhere('inv_inventory_transactions.transaction_date', '<=', end_date);
                }
            })
                .groupBy('inv_inventory_transactions.item_id', 'inv_inventory_items.name')
                .having('usage_count', '>=', 3)
                .orderBy('avg_monthly_usage', 'desc')
                .limit(50);
            // Anomalies and red flags - Using raw SQL for MySQL compatibility
            const unusualUsage = await connection.raw(`
                    SELECT
                         t.item_id,
                         i.name as item_name,
                         DATE_FORMAT(t.transaction_date, '%Y-%m-%d') as date,
                         SUM(CASE WHEN t.transaction_type = 'consumption' THEN t.quantity ELSE 0 END) as actual_usage,
                         COALESCE((
                              SELECT AVG(sub_t.quantity)
                              FROM inv_inventory_transactions sub_t
                              WHERE sub_t.item_id = t.item_id
                              AND sub_t.transaction_type = 'consumption'
                              AND sub_t.transaction_date < t.transaction_date
                              AND sub_t.transaction_date >= DATE_SUB(t.transaction_date, INTERVAL 30 DAY)
                         ), 0) as expected_usage,
                         CASE
                              WHEN COALESCE((
                                   SELECT AVG(sub_t.quantity)
                                   FROM inv_inventory_transactions sub_t
                                   WHERE sub_t.item_id = t.item_id
                                   AND sub_t.transaction_type = 'consumption'
                                   AND sub_t.transaction_date < t.transaction_date
                                   AND sub_t.transaction_date >= DATE_SUB(t.transaction_date, INTERVAL 30 DAY)
                              ), 0) > 0
                              THEN (
                                   SUM(CASE WHEN t.transaction_type = 'consumption' THEN t.quantity ELSE 0 END) -
                                   COALESCE((
                                        SELECT AVG(sub_t.quantity)
                                        FROM inv_inventory_transactions sub_t
                                        WHERE sub_t.item_id = t.item_id
                                        AND sub_t.transaction_type = 'consumption'
                                        AND sub_t.transaction_date < t.transaction_date
                                        AND sub_t.transaction_date >= DATE_SUB(t.transaction_date, INTERVAL 30 DAY)
                                   ), 0)
                              ) / COALESCE((
                                   SELECT AVG(sub_t.quantity)
                                   FROM inv_inventory_transactions sub_t
                                   WHERE sub_t.item_id = t.item_id
                                   AND sub_t.transaction_type = 'consumption'
                                   AND sub_t.transaction_date < t.transaction_date
                                   AND sub_t.transaction_date >= DATE_SUB(t.transaction_date, INTERVAL 30 DAY)
                              ), 0) * 100
                              ELSE 0
                         END as deviation_percentage
                    FROM inv_inventory_transactions t
                    LEFT JOIN inv_inventory_items i ON i.id = t.item_id
                    WHERE t.transaction_type = 'consumption'
                    ${start_date ? `AND t.transaction_date >= '${start_date}'` : 'AND t.transaction_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)'}
                    ${end_date ? `AND t.transaction_date <= '${end_date}'` : ''}
                    GROUP BY t.item_id, i.name, t.transaction_date
                    HAVING deviation_percentage > 50
                    ORDER BY deviation_percentage DESC
                    LIMIT 20
               `);
            // Stock utilization rate
            const [utilizationResult] = await connection('inv_inventory_items')
                .select(connection.raw('AVG(CASE WHEN current_stock > 0 THEN (current_stock - COALESCE(min_stock, 0)) / current_stock ELSE 0 END) as utilization_rate'))
                .where('is_active', 1);
            // Wastage rate
            const [wastageResult] = await connection('inv_inventory_transactions')
                .select(connection.raw('CASE WHEN SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) > 0 THEN SUM(CASE WHEN transaction_type = "wastage" THEN quantity ELSE 0 END) / SUM(CASE WHEN transaction_type = "consumption" THEN quantity ELSE 0 END) * 100 ELSE 0 END as wastage_rate'))
                .modify(function (queryBuilder) {
                if (start_date) {
                    queryBuilder.andWhere('transaction_date', '>=', start_date);
                }
                else {
                    queryBuilder.andWhere('transaction_date', '>=', connection.raw('DATE_SUB(CURDATE(), INTERVAL 365 DAY)'));
                }
                if (end_date) {
                    queryBuilder.andWhere('transaction_date', '<=', end_date);
                }
            });
            // Misallocation trends - comparing expected vs actual usage (MySQL compatible)
            const misallocationTrends = await connection.raw(`
                    SELECT
                         sub.item_id,
                         sub.item_name,
                         sub.performed_by,
                         sub.username,
                         sub.role,
                         sub.month,
                         sub.actual_usage,
                         sub.expected_usage,
                         sub.variance_percentage
                    FROM (
                         SELECT
                              t.item_id,
                              i.name as item_name,
                              COALESCE(t.performed_by, 'Unknown') as performed_by,
                              r.username,
                              r.role,
                              DATE_FORMAT(t.transaction_date, '%Y-%m') as month,
                              SUM(CASE WHEN t.transaction_type = 'consumption' THEN t.quantity ELSE 0 END) as actual_usage,

                              -- Expected usage using correlated subquery instead of window function
                              (
                                   SELECT ROUND(AVG(sub_t.quantity), 2)
                                   FROM inv_inventory_transactions sub_t
                                   WHERE sub_t.item_id = t.item_id
                                   AND sub_t.transaction_type = 'consumption'
                                   AND sub_t.transaction_date >= DATE_SUB(t.transaction_date, INTERVAL 30 DAY)
                                   AND sub_t.transaction_date < t.transaction_date
                              ) as expected_usage,

                              -- Variance percentage calculation
                              CASE
                                   WHEN (
                                        SELECT AVG(sub_t.quantity)
                                        FROM inv_inventory_transactions sub_t
                                        WHERE sub_t.item_id = t.item_id
                                        AND sub_t.transaction_type = 'consumption'
                                        AND sub_t.transaction_date >= DATE_SUB(t.transaction_date, INTERVAL 30 DAY)
                                        AND sub_t.transaction_date < t.transaction_date
                                   ) > 0
                                   THEN ROUND((
                                        SUM(CASE WHEN t.transaction_type = 'consumption' THEN t.quantity ELSE 0 END) -
                                        (
                                             SELECT AVG(sub_t.quantity)
                                             FROM inv_inventory_transactions sub_t
                                             WHERE sub_t.item_id = t.item_id
                                             AND sub_t.transaction_type = 'consumption'
                                             AND sub_t.transaction_date >= DATE_SUB(t.transaction_date, INTERVAL 30 DAY)
                                             AND sub_t.transaction_date < t.transaction_date
                                        )
                                   ) / (
                                        SELECT AVG(sub_t.quantity)
                                        FROM inv_inventory_transactions sub_t
                                        WHERE sub_t.item_id = t.item_id
                                        AND sub_t.transaction_type = 'consumption'
                                        AND sub_t.transaction_date >= DATE_SUB(t.transaction_date, INTERVAL 30 DAY)
                                        AND sub_t.transaction_date < t.transaction_date
                                   ) * 100, 2)
                                   ELSE 0
                              END as variance_percentage

                         FROM inv_inventory_transactions t
                         LEFT JOIN inv_inventory_items i ON i.id = t.item_id
                         LEFT JOIN roles r ON t.performed_by = r.employeeid
                         WHERE t.transaction_type = 'consumption'
                         ${start_date ? `AND t.transaction_date >= '${start_date}'` : 'AND t.transaction_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)'}
                         ${end_date ? `AND t.transaction_date <= '${end_date}'` : ''}
                         GROUP BY t.item_id, i.name, t.performed_by, r.employeeid, r.role, DATE_FORMAT(t.transaction_date, '%Y-%m'), t.transaction_date
                    ) sub
                    WHERE ABS(sub.variance_percentage) > 25
                    ORDER BY ABS(sub.variance_percentage) DESC, sub.month DESC
                    LIMIT 15
               `);
            // Theft indicators - unusual patterns suggesting potential theft
            const theftIndicators = await connection.raw(`
                    SELECT
                         t.item_id,
                         i.name as item_name,
                         CASE
                              WHEN t.quantity > (SELECT AVG(quantity) * 3 FROM inv_inventory_transactions WHERE item_id = t.item_id AND transaction_type = 'consumption' AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) THEN 'High quantity spike'
                              WHEN HOUR(t.transaction_date) < 6 OR HOUR(t.transaction_date) > 22 THEN 'Off-hours consumption'
                              WHEN t.performed_by IS NULL OR t.performed_by = '' THEN 'Undocumented transaction'
                              WHEN t.quantity > 100 AND t.transaction_type = 'consumption' THEN 'Unusually large consumption'
                              ELSE 'Multiple small transactions'
                         END as risk_indicator,
                         CASE
                              WHEN t.quantity > (SELECT AVG(quantity) * 5 FROM inv_inventory_transactions WHERE item_id = t.item_id AND transaction_type = 'consumption' AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) THEN 'high'
                              WHEN t.quantity > (SELECT AVG(quantity) * 3 FROM inv_inventory_transactions WHERE item_id = t.item_id AND transaction_type = 'consumption' AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) THEN 'medium'
                              ELSE 'low'
                         END as risk_level,
                         MAX(t.transaction_date) as last_incident_date
                    FROM inv_inventory_transactions t
                    LEFT JOIN inv_inventory_items i ON i.id = t.item_id
                    WHERE t.transaction_type = 'consumption'
                    ${start_date ? `AND t.transaction_date >= '${start_date}'` : 'AND t.transaction_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)'}
                    ${end_date ? `AND t.transaction_date <= '${end_date}'` : ''}
                    AND (
                         t.quantity > (SELECT COALESCE(AVG(quantity) * 2, 10) FROM inv_inventory_transactions WHERE item_id = t.item_id AND transaction_type = 'consumption' AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY))
                         OR HOUR(t.transaction_date) < 6
                         OR HOUR(t.transaction_date) > 22
                         OR t.performed_by IS NULL
                         OR t.performed_by = ''
                    )
                    GROUP BY t.item_id, i.name, risk_indicator, risk_level
                    ORDER BY 
                         CASE risk_level WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
                         last_incident_date DESC
                    LIMIT 10
               `);
            // FIFO compliance analysis
            const fifoComplianceIssues = await connection.raw(`
                    SELECT
                         i.id as item_id,
                         i.name as item_name,
                         t.batch_number,
                         t.expiry_date,
                         t.transaction_date as consumption_date,
                         DATEDIFF(t.expiry_date, t.transaction_date) as days_until_expiry_at_consumption,
                         CASE
                              WHEN DATEDIFF(t.expiry_date, t.transaction_date) > 30 THEN 'low'
                              WHEN DATEDIFF(t.expiry_date, t.transaction_date) > 7 THEN 'medium'
                              ELSE 'high'
                         END as risk_level
                    FROM inv_inventory_transactions t
                    JOIN inv_inventory_items i ON t.item_id = i.id
                    WHERE t.transaction_type = 'consumption'
                    AND t.batch_number IS NOT NULL
                    AND t.expiry_date IS NOT NULL
                    ${start_date ? `AND t.transaction_date >= '${start_date}'` : ''}
                    ${end_date ? `AND t.transaction_date <= '${end_date}'` : ''}
                    AND DATEDIFF(t.expiry_date, t.transaction_date) < (
                         SELECT MIN(DATEDIFF(sub_t.expiry_date, sub_t.transaction_date))
                         FROM inv_inventory_transactions sub_t
                         WHERE sub_t.item_id = t.item_id
                         AND sub_t.transaction_type = 'consumption'
                         AND DATE(sub_t.transaction_date) = DATE(t.transaction_date)
                         AND sub_t.expiry_date IS NOT NULL
                    )
                    ORDER BY DATEDIFF(t.expiry_date, t.transaction_date) ASC
                    LIMIT 20
               `);
            // Critical alerts for expiry risk and wastage ratios
            const criticalAlerts = await connection.raw(`
                    -- Expiry risk alerts
                    SELECT
                         'expiry_risk' as alert_type,
                         i.id as item_id,
                         i.name as item_name,
                         CASE
                              WHEN DATEDIFF(t.expiry_date, CURDATE()) <= 7 THEN 'critical'
                              WHEN DATEDIFF(t.expiry_date, CURDATE()) <= 30 THEN 'high'
                              WHEN DATEDIFF(t.expiry_date, CURDATE()) <= 90 THEN 'medium'
                              ELSE 'low'
                         END as severity,
                         CONCAT('Expires in ', DATEDIFF(t.expiry_date, CURDATE()), ' days - Batch: ', t.batch_number) as message,
                         t.quantity as value,
                         0 as threshold
                    FROM inv_inventory_transactions t
                    JOIN inv_inventory_items i ON t.item_id = i.id
                    WHERE t.transaction_type = 'addition'
                    AND t.batch_number IS NOT NULL
                    AND t.expiry_date IS NOT NULL
                    AND t.expiry_date >= CURDATE()
                    AND DATEDIFF(t.expiry_date, CURDATE()) <= 90
                    AND t.new_stock > 0
                    ${start_date ? `AND t.transaction_date >= '${start_date}'` : ''}
                    ${end_date ? `AND t.transaction_date <= '${end_date}'` : ''}

                    UNION ALL

                    -- Wastage ratio alerts
                    SELECT
                         'wastage_ratio' as alert_type,
                         i.id as item_id,
                         i.name as item_name,
                         CASE
                              WHEN (SUM(CASE WHEN t.transaction_type = 'wastage' THEN t.quantity ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN t.transaction_type IN ('consumption', 'wastage') THEN t.quantity ELSE 0 END), 0)) > 50 THEN 'critical'
                              WHEN (SUM(CASE WHEN t.transaction_type = 'wastage' THEN t.quantity ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN t.transaction_type IN ('consumption', 'wastage') THEN t.quantity ELSE 0 END), 0)) > 25 THEN 'high'
                              WHEN (SUM(CASE WHEN t.transaction_type = 'wastage' THEN t.quantity ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN t.transaction_type IN ('consumption', 'wastage') THEN t.quantity ELSE 0 END), 0)) > 10 THEN 'medium'
                              ELSE 'low'
                         END as severity,
                         CONCAT('Wastage rate: ', ROUND((SUM(CASE WHEN t.transaction_type = 'wastage' THEN t.quantity ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN t.transaction_type IN ('consumption', 'wastage') THEN t.quantity ELSE 0 END), 0)), 1), '%') as message,
                         ROUND((SUM(CASE WHEN t.transaction_type = 'wastage' THEN t.quantity ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN t.transaction_type IN ('consumption', 'wastage') THEN t.quantity ELSE 0 END), 0)), 1) as value,
                         10 as threshold
                    FROM inv_inventory_transactions t
                    JOIN inv_inventory_items i ON t.item_id = i.id
                    ${start_date || end_date ? `WHERE ${start_date ? `t.transaction_date >= '${start_date}'` : ''} ${start_date && end_date ? 'AND' : ''} ${end_date ? `t.transaction_date <= '${end_date}'` : ''}` : ''}
                    GROUP BY i.id, i.name
                    HAVING SUM(CASE WHEN t.transaction_type IN ('consumption', 'wastage') THEN t.quantity ELSE 0 END) > 0
                    AND (SUM(CASE WHEN t.transaction_type = 'wastage' THEN t.quantity ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN t.transaction_type IN ('consumption', 'wastage') THEN t.quantity ELSE 0 END), 0)) > 5

                    ORDER BY
                         CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END,
                         value DESC
                    LIMIT 30
               `);
            // Detailed wastage analysis
            const detailedWastageAnalysis = await connection.raw(`
                    SELECT
                         i.name as item_name,
                         COALESCE(t.wastage_type, 'unspecified') as wastage_type,
                         COUNT(*) as wastage_events,
                         SUM(t.quantity) as total_wasted_units,
                         ROUND(AVG(t.quantity), 2) as avg_wastage_per_event,
                         ROUND(
                              (SUM(t.quantity) * 100.0 / (
                                   SELECT SUM(sub_t.quantity)
                                   FROM inv_inventory_transactions sub_t
                                   WHERE sub_t.item_id = t.item_id
                                   AND sub_t.transaction_type IN ('consumption', 'wastage')
                              )),
                              2
                         ) as wastage_percentage
                    FROM inv_inventory_transactions t
                    JOIN inv_inventory_items i ON t.item_id = i.id
                    WHERE t.transaction_type = 'wastage'
                    ${start_date ? `AND t.transaction_date >= '${start_date}'` : ''}
                    ${end_date ? `AND t.transaction_date <= '${end_date}'` : ''}
                    GROUP BY i.name, t.wastage_type
                    ORDER BY total_wasted_units DESC
                    LIMIT 20
               `);
            // Batch utilization analysis
            const batchUtilizationAnalysis = await connection.raw(`
                    SELECT
                         i.name as item_name,
                         t.batch_number,
                         t.expiry_date,
                         SUM(CASE WHEN t.transaction_type = 'addition' THEN t.quantity ELSE 0 END) as total_received,
                         SUM(CASE WHEN t.transaction_type = 'consumption' THEN t.quantity ELSE 0 END) as total_consumed,
                         SUM(CASE WHEN t.transaction_type = 'wastage' THEN t.quantity ELSE 0 END) as total_wasted,
                         ROUND(
                              (SUM(CASE WHEN t.transaction_type = 'consumption' THEN t.quantity ELSE 0 END) * 100.0 /
                              NULLIF(SUM(CASE WHEN t.transaction_type = 'addition' THEN t.quantity ELSE 0 END), 0)),
                              2
                         ) as utilization_rate,
                         GREATEST(0, DATEDIFF(t.expiry_date, CURDATE())) as days_to_expiry,
                         CASE
                              WHEN DATEDIFF(t.expiry_date, CURDATE()) < 0 THEN 'expired'
                              WHEN ROUND((SUM(CASE WHEN t.transaction_type = 'consumption' THEN t.quantity ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN t.transaction_type = 'addition' THEN t.quantity ELSE 0 END), 0)), 2) >= 90 THEN 'excellent'
                              WHEN ROUND((SUM(CASE WHEN t.transaction_type = 'consumption' THEN t.quantity ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN t.transaction_type = 'addition' THEN t.quantity ELSE 0 END), 0)), 2) >= 70 THEN 'good'
                              WHEN ROUND((SUM(CASE WHEN t.transaction_type = 'consumption' THEN t.quantity ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN t.transaction_type = 'addition' THEN t.quantity ELSE 0 END), 0)), 2) >= 50 THEN 'poor'
                              ELSE 'critical'
                         END as utilization_status
                    FROM inv_inventory_transactions t
                    JOIN inv_inventory_items i ON t.item_id = i.id
                    WHERE t.batch_number IS NOT NULL
                    ${start_date ? `AND t.transaction_date >= '${start_date}'` : ''}
                    ${end_date ? `AND t.transaction_date <= '${end_date}'` : ''}
                    GROUP BY i.name, t.batch_number, t.expiry_date
                    HAVING total_received > 0
                    ORDER BY utilization_rate DESC, total_received DESC
                    LIMIT 30
               `);
            // Stock turnover rates
            const stockTurnoverRates = await connection.raw(`
                    SELECT
                         i.name as item_name,
                         SUM(CASE WHEN t.transaction_type = 'addition' THEN t.quantity ELSE 0 END) as total_added,
                         SUM(CASE WHEN t.transaction_type = 'consumption' THEN t.quantity ELSE 0 END) as total_consumed,
                         SUM(CASE WHEN t.transaction_type = 'wastage' THEN t.quantity ELSE 0 END) as total_wasted,
                         ROUND(
                              (SUM(CASE WHEN t.transaction_type = 'consumption' THEN t.quantity ELSE 0 END) * 100.0 /
                              NULLIF(SUM(CASE WHEN t.transaction_type = 'addition' THEN t.quantity ELSE 0 END), 0)),
                              2
                         ) as consumption_rate,
                         ROUND(
                              (SUM(CASE WHEN t.transaction_type = 'wastage' THEN t.quantity ELSE 0 END) * 100.0 /
                              NULLIF(SUM(CASE WHEN t.transaction_type = 'addition' THEN t.quantity ELSE 0 END), 0)),
                              2
                         ) as wastage_rate,
                         CASE
                              WHEN ROUND((SUM(CASE WHEN t.transaction_type = 'consumption' THEN t.quantity ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN t.transaction_type = 'addition' THEN t.quantity ELSE 0 END), 0)), 2) >= 90 THEN 'excellent'
                              WHEN ROUND((SUM(CASE WHEN t.transaction_type = 'consumption' THEN t.quantity ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN t.transaction_type = 'addition' THEN t.quantity ELSE 0 END), 0)), 2) >= 75 THEN 'good'
                              WHEN ROUND((SUM(CASE WHEN t.transaction_type = 'consumption' THEN t.quantity ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN t.transaction_type = 'addition' THEN t.quantity ELSE 0 END), 0)), 2) >= 60 THEN 'fair'
                              ELSE 'poor'
                         END as turnover_efficiency
                    FROM inv_inventory_transactions t
                    JOIN inv_inventory_items i ON t.item_id = i.id
                    ${start_date || end_date ? `WHERE ${start_date ? `t.transaction_date >= '${start_date}'` : ''} ${start_date && end_date ? 'AND' : ''} ${end_date ? `t.transaction_date <= '${end_date}'` : ''}` : ''}
                    GROUP BY i.name
                    ORDER BY wastage_rate DESC
                    LIMIT 25
               `);
            // Comprehensive usage summary
            const comprehensiveUsageSummary = await connection.raw(`
                    SELECT
                         i.name as item_name,
                         COUNT(DISTINCT t.id) as total_transactions,
                         SUM(CASE WHEN t.transaction_type = 'addition' THEN t.quantity ELSE 0 END) as total_added,
                         SUM(CASE WHEN t.transaction_type = 'consumption' THEN t.quantity ELSE 0 END) as total_consumed,
                         SUM(CASE WHEN t.transaction_type = 'wastage' THEN t.quantity ELSE 0 END) as total_wasted,
                         ROUND(
                              (SUM(CASE WHEN t.transaction_type = 'consumption' THEN t.quantity ELSE 0 END) * 100.0 /
                              NULLIF(SUM(CASE WHEN t.transaction_type IN ('consumption', 'wastage') THEN t.quantity ELSE 0 END), 0)),
                              2
                         ) as consumption_percentage,
                         ROUND(
                              (SUM(CASE WHEN t.transaction_type = 'wastage' THEN t.quantity ELSE 0 END) * 100.0 /
                              NULLIF(SUM(CASE WHEN t.transaction_type IN ('consumption', 'wastage') THEN t.quantity ELSE 0 END), 0)),
                              2
                         ) as wastage_percentage,
                         ROUND(
                              SUM(CASE WHEN t.transaction_type = 'consumption' THEN t.quantity ELSE 0 END) /
                              NULLIF(COUNT(DISTINCT DATE(t.transaction_date)), 0),
                              2
                         ) as avg_daily_consumption,
                         ROUND(
                              (SUM(CASE WHEN t.transaction_type = 'consumption' THEN t.quantity ELSE 0 END) * 100.0 /
                              NULLIF(SUM(CASE WHEN t.transaction_type = 'addition' THEN t.quantity ELSE 0 END), 0)) -
                              (SUM(CASE WHEN t.transaction_type = 'wastage' THEN t.quantity ELSE 0 END) * 100.0 /
                              NULLIF(SUM(CASE WHEN t.transaction_type = 'addition' THEN t.quantity ELSE 0 END), 0)),
                              2
                         ) as efficiency_score
                    FROM inv_inventory_transactions t
                    JOIN inv_inventory_items i ON t.item_id = i.id
                    ${start_date || end_date ? `WHERE ${start_date ? `t.transaction_date >= '${start_date}'` : ''} ${start_date && end_date ? 'AND' : ''} ${end_date ? `t.transaction_date <= '${end_date}'` : ''}` : ''}
                    GROUP BY i.name
                    ORDER BY wastage_percentage DESC, total_wasted DESC
                    LIMIT 30
               `);
            const analytics = {
                consumption_patterns: {
                    consumption_trends: consumptionTrends.map(row => ({
                        date: row.date,
                        total_consumed: parseInt(row.total_consumed),
                        unique_items_used: parseInt(row.unique_items_used),
                        avg_unit_price: parseFloat(row.avg_unit_price) || 0,
                    })),
                    department_consumption: departmentConsumption.map(row => ({
                        performed_by: row.performed_by,
                        username: row.username || row.performed_by,
                        role: row.role || 'Unknown',
                        total_consumed: parseInt(row.total_consumed),
                        unique_items_used: parseInt(row.unique_items_used),
                        consumption_value: parseFloat(row.consumption_value) || 0,
                        transaction_count: parseInt(row.transaction_count)
                    })),
                    category_consumption: categoryConsumption.map(row => ({
                        category_name: row.category_name,
                        total_consumed: parseInt(row.total_consumed),
                        unique_items_used: parseInt(row.unique_items_used),
                        consumption_value: parseFloat(row.consumption_value) || 0,
                        transaction_count: parseInt(row.transaction_count)
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
                    potential_theft_indicators: theftIndicators[0].map((row) => ({
                        item_id: row.item_id,
                        item_name: row.item_name,
                        unusual_pattern: row.risk_indicator,
                        risk_level: row.risk_level,
                        last_incident_date: row.last_incident_date
                    })),
                    misallocation_trends: misallocationTrends[0].map((row) => ({
                        item_id: row.item_id,
                        item_name: row.item_name,
                        allocated_quantity: parseFloat(row.expected_usage) || 0,
                        actual_usage: parseInt(row.actual_usage),
                        variance_percentage: parseFloat(row.variance_percentage) || 0,
                        performed_by: row.performed_by,
                        username: row.username || row.performed_by,
                        role: row.role || 'Unknown'
                    })),
                    fifo_compliance_issues: fifoComplianceIssues[0].map((row) => ({
                        item_id: row.item_id,
                        item_name: row.item_name,
                        batch_number: row.batch_number,
                        expiry_date: row.expiry_date,
                        consumption_date: row.consumption_date,
                        days_early_consumption: parseInt(row.days_until_expiry_at_consumption),
                        risk_level: row.risk_level
                    })),
                    critical_alerts: criticalAlerts[0].map((row) => ({
                        alert_type: row.alert_type,
                        item_id: row.item_id,
                        item_name: row.item_name,
                        severity: row.severity,
                        message: row.message,
                        value: parseFloat(row.value) || 0,
                        threshold: parseFloat(row.threshold) || 0
                    }))
                },
                usage_efficiency: {
                    stock_utilization_rate: parseFloat(utilizationResult === null || utilizationResult === void 0 ? void 0 : utilizationResult.utilization_rate) || 0,
                    wastage_rate: parseFloat(wastageResult === null || wastageResult === void 0 ? void 0 : wastageResult.wastage_rate) || 0,
                    detailed_wastage_analysis: detailedWastageAnalysis[0].map((row) => ({
                        item_name: row.item_name,
                        wastage_type: row.wastage_type,
                        wastage_events: parseInt(row.wastage_events),
                        total_wasted_units: parseInt(row.total_wasted_units),
                        avg_wastage_per_event: parseFloat(row.avg_wastage_per_event) || 0,
                        wastage_percentage: parseFloat(row.wastage_percentage) || 0
                    })),
                    batch_utilization_analysis: batchUtilizationAnalysis[0].map((row) => ({
                        item_name: row.item_name,
                        batch_number: row.batch_number,
                        expiry_date: row.expiry_date,
                        total_received: parseInt(row.total_received),
                        total_consumed: parseInt(row.total_consumed),
                        total_wasted: parseInt(row.total_wasted),
                        utilization_rate: parseFloat(row.utilization_rate) || 0,
                        days_to_expiry: parseInt(row.days_to_expiry) || 0,
                        utilization_status: row.utilization_status
                    })),
                    stock_turnover_rates: stockTurnoverRates[0].map((row) => ({
                        item_name: row.item_name,
                        total_added: parseInt(row.total_added),
                        total_consumed: parseInt(row.total_consumed),
                        total_wasted: parseInt(row.total_wasted),
                        consumption_rate: parseFloat(row.consumption_rate) || 0,
                        wastage_rate: parseFloat(row.wastage_rate) || 0,
                        turnover_efficiency: row.turnover_efficiency
                    })),
                    comprehensive_usage_summary: comprehensiveUsageSummary[0].map((row) => ({
                        item_name: row.item_name,
                        total_transactions: parseInt(row.total_transactions),
                        total_added: parseInt(row.total_added),
                        total_consumed: parseInt(row.total_consumed),
                        total_wasted: parseInt(row.total_wasted),
                        consumption_percentage: parseFloat(row.consumption_percentage) || 0,
                        wastage_percentage: parseFloat(row.wastage_percentage) || 0,
                        avg_daily_consumption: parseFloat(row.avg_daily_consumption) || 0,
                        efficiency_score: parseFloat(row.efficiency_score) || 0
                    })),
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
