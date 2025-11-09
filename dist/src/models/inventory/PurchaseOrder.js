"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseOrderModel = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class PurchaseOrderModel {
    constructor(tenantId) {
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(request, createdBy) {
        const connection = await this.connection;
        // Validate supplier exists
        const supplier = await connection('inv_suppliers')
            .where('id', request.supplier_id)
            .where('is_active', true)
            .first();
        if (!supplier) {
            throw new Error('Supplier not found or inactive');
        }
        // Generate order number using stored function
        const [orderNumberResult] = await connection.raw('SELECT inv_generate_purchase_order_number() as order_number');
        const orderNumber = orderNumberResult[0].order_number;
        const orderDate = request.order_date || new Date().toISOString().split('T')[0];
        // Fetch inventory item details for all items
        const itemIds = request.items.map(item => item.item_id);
        const inventoryItems = await connection('inv_inventory_items')
            .select('id', 'name', 'sku', 'description', 'unit', 'category_id', 'location_id')
            .whereIn('id', itemIds)
            .where('is_active', true);
        const itemMap = new Map(inventoryItems.map(item => [item.id, item]));
        // Validate all items exist
        const missingItems = itemIds.filter(id => !itemMap.has(id));
        if (missingItems.length > 0) {
            throw new Error(`Inventory items not found: ${missingItems.join(', ')}`);
        }
        // Calculate initial totals (will be updated by triggers)
        const totalAmount = request.items.reduce((sum, item) => {
            const inventoryItem = itemMap.get(item.item_id);
            const unitPrice = item.unit_price || 0; // Default to 0 if not provided
            const lineTotal = (item.quantity * unitPrice) *
                (1 + (item.tax_rate || 0) / 100) *
                (1 - (item.discount_rate || 0) / 100);
            return sum + lineTotal;
        }, 0);
        const finalAmount = totalAmount + (request.tax_amount || 0) +
            (request.shipping_cost || 0) - (request.discount_amount || 0);
        const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        // Create purchase order
        await connection('inv_purchase_orders').insert({
            id: orderId,
            order_number: orderNumber,
            supplier_id: request.supplier_id,
            order_date: orderDate,
            expected_delivery_date: request.expected_delivery_date,
            status: 'draft',
            total_amount: totalAmount,
            tax_amount: request.tax_amount || 0,
            discount_amount: request.discount_amount || 0,
            shipping_cost: request.shipping_cost || 0,
            final_amount: finalAmount,
            currency: request.currency || 'USD',
            payment_terms: request.payment_terms,
            notes: request.notes,
            created_by: createdBy,
            created_at: connection.fn.now(),
            updated_at: connection.fn.now()
        });
        // Create order items
        const orderItems = request.items.map(item => {
            const inventoryItem = itemMap.get(item.item_id);
            const unitPrice = item.unit_price || 0;
            return {
                id: `POI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                order_id: orderId,
                inventory_item_id: item.item_id,
                item_name: inventoryItem.name,
                item_description: inventoryItem.description,
                sku: inventoryItem.sku,
                quantity_ordered: item.quantity,
                quantity_received: 0,
                quantity_rejected: 0,
                unit_price: unitPrice,
                tax_rate: item.tax_rate || 0,
                discount_rate: item.discount_rate || 0,
                line_total: (item.quantity * unitPrice) *
                    (1 + (item.tax_rate || 0) / 100) *
                    (1 - (item.discount_rate || 0) / 100),
                unit: inventoryItem.unit,
                status: 'pending',
                notes: item.notes,
                created_at: connection.fn.now(),
                updated_at: connection.fn.now()
            };
        });
        await connection('inv_purchase_order_items').insert(orderItems);
        return this.findById(orderId);
    }
    async findById(id) {
        const connection = await this.connection;
        const result = await connection('inv_purchase_orders')
            .select('inv_purchase_orders.*', 'inv_suppliers.name as supplier_name')
            .leftJoin('inv_suppliers', 'inv_purchase_orders.supplier_id', 'inv_suppliers.id')
            .where('inv_purchase_orders.id', id)
            .first();
        if (!result)
            return null;
        // Get items count
        const itemsCountResult = await connection('inv_purchase_order_items')
            .count('* as count')
            .where('order_id', id)
            .first();
        const receivedItemsCountResult = await connection('inv_purchase_order_items')
            .count('* as count')
            .where('order_id', id)
            .where('status', 'received')
            .first();
        return {
            id: result.id,
            order_number: result.order_number,
            supplier_id: result.supplier_id,
            order_date: result.order_date,
            expected_delivery_date: result.expected_delivery_date,
            actual_delivery_date: result.actual_delivery_date,
            status: result.status,
            total_amount: parseFloat(result.total_amount),
            tax_amount: parseFloat(result.tax_amount),
            discount_amount: parseFloat(result.discount_amount),
            shipping_cost: parseFloat(result.shipping_cost),
            final_amount: parseFloat(result.final_amount),
            currency: result.currency,
            payment_terms: result.payment_terms,
            notes: result.notes,
            created_by: result.created_by,
            approved_by: result.approved_by,
            approved_at: result.approved_at,
            sent_at: result.sent_at,
            created_at: result.created_at,
            updated_at: result.updated_at,
            supplier_name: result.supplier_name,
            items_count: parseInt(String((itemsCountResult === null || itemsCountResult === void 0 ? void 0 : itemsCountResult.count) || 0)),
            received_items_count: parseInt(String((receivedItemsCountResult === null || receivedItemsCountResult === void 0 ? void 0 : receivedItemsCountResult.count) || 0))
        };
    }
    async findMany(filters) {
        var _a;
        const connection = await this.connection;
        const page = filters.page || 1;
        const count = filters.count || 25;
        const offset = (page - 1) * count;
        const sortBy = filters.sortby || 'DESC';
        let query = connection('inv_purchase_orders')
            .select('inv_purchase_orders.*', 'inv_suppliers.name as supplier_name', connection.raw('COUNT(inv_purchase_order_items.id) as items_count'), connection.raw('SUM(CASE WHEN inv_purchase_order_items.status = "received" THEN 1 ELSE 0 END) as received_items_count'))
            .leftJoin('inv_suppliers', 'inv_purchase_orders.supplier_id', 'inv_suppliers.id')
            .leftJoin('inv_purchase_order_items', 'inv_purchase_orders.id', 'inv_purchase_order_items.order_id')
            .groupBy('inv_purchase_orders.id');
        // Apply filters
        if (filters.supplier_id) {
            query = query.where('inv_purchase_orders.supplier_id', filters.supplier_id);
        }
        if (filters.status) {
            const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
            query = query.whereIn('inv_purchase_orders.status', statuses);
        }
        if (filters.startDate) {
            query = query.where('inv_purchase_orders.order_date', '>=', filters.startDate);
        }
        if (filters.endDate) {
            query = query.where('inv_purchase_orders.order_date', '<=', filters.endDate);
        }
        if (filters.search) {
            query = query.where(function () {
                this.where('inv_purchase_orders.order_number', 'like', `%${filters.search}%`)
                    .orWhere('inv_suppliers.name', 'like', `%${filters.search}%`)
                    .orWhere('inv_purchase_orders.notes', 'like', `%${filters.search}%`);
            });
        }
        // Get total count
        const totalResult = await connection.raw(`
               SELECT COUNT(DISTINCT po.id) as total
               FROM inv_purchase_orders po
               LEFT JOIN inv_suppliers s ON po.supplier_id = s.id
               LEFT JOIN inv_purchase_order_items poi ON po.id = poi.order_id
               WHERE 1=1
               ${filters.supplier_id ? 'AND po.supplier_id = ?' : ''}
               ${filters.status ? `AND po.status ${Array.isArray(filters.status) ? 'IN (?)' : '= ?'}` : ''}
               ${filters.startDate ? 'AND po.order_date >= ?' : ''}
               ${filters.endDate ? 'AND po.order_date <= ?' : ''}
               ${filters.search ? 'AND (po.order_number LIKE ? OR s.name LIKE ? OR po.notes LIKE ?)' : ''}
          `, [
            ...(filters.supplier_id ? [filters.supplier_id] : []),
            ...(filters.status ? [Array.isArray(filters.status) ? filters.status : filters.status] : []),
            ...(filters.startDate ? [filters.startDate] : []),
            ...(filters.endDate ? [filters.endDate] : []),
            ...(filters.search ? [`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`] : [])
        ]);
        const total = parseInt(String(((_a = totalResult[0][0]) === null || _a === void 0 ? void 0 : _a.total) || 0));
        // Apply sorting and pagination
        query = query.orderBy('inv_purchase_orders.order_date', sortBy)
            .limit(count)
            .offset(offset);
        const rawData = await query;
        // Transform data
        const orders = rawData.map(result => ({
            id: result.id,
            order_number: result.order_number,
            supplier_id: result.supplier_id,
            order_date: result.order_date,
            expected_delivery_date: result.expected_delivery_date,
            actual_delivery_date: result.actual_delivery_date,
            status: result.status,
            total_amount: parseFloat(result.total_amount),
            tax_amount: parseFloat(result.tax_amount),
            discount_amount: parseFloat(result.discount_amount),
            shipping_cost: parseFloat(result.shipping_cost),
            final_amount: parseFloat(result.final_amount),
            currency: result.currency,
            payment_terms: result.payment_terms,
            notes: result.notes,
            created_by: result.created_by,
            approved_by: result.approved_by,
            approved_at: result.approved_at,
            sent_at: result.sent_at,
            created_at: result.created_at,
            updated_at: result.updated_at,
            supplier_name: result.supplier_name,
            items_count: parseInt(result.items_count),
            received_items_count: parseInt(result.received_items_count || 0)
        }));
        return {
            orders,
            total,
            page,
            count,
            totalPages: Math.ceil(total / count),
            sortby: sortBy
        };
    }
    async update(id, updates) {
        const connection = await this.connection;
        // Check if order exists
        const existingOrder = await this.findById(id);
        if (!existingOrder) {
            return null;
        }
        // Validate status transitions
        if (updates.status && !this.isValidStatusTransition(existingOrder.status, updates.status)) {
            throw new Error(`Invalid status transition from ${existingOrder.status} to ${updates.status}`);
        }
        // Set timestamps based on status changes
        const updateData = Object.assign(Object.assign({}, updates), { updated_at: connection.fn.now() });
        if (updates.status === 'approved' && updates.approved_by) {
            updateData.approved_at = connection.fn.now();
        }
        if (updates.sent_at) {
            updateData.sent_at = updates.sent_at;
        }
        await connection('inv_purchase_orders')
            .where('id', id)
            .update(updateData);
        return this.findById(id);
    }
    async delete(id) {
        const connection = await this.connection;
        // Check if order can be deleted (only draft status)
        const order = await connection('inv_purchase_orders')
            .where('id', id)
            .where('status', 'draft')
            .first();
        if (!order) {
            throw new Error('Order not found or cannot be deleted (not in draft status)');
        }
        await connection('inv_purchase_orders').where('id', id).del();
        return true;
    }
    async getOrderItems(orderId) {
        const connection = await this.connection;
        const results = await connection('inv_purchase_order_items')
            .where('order_id', orderId)
            .orderBy('created_at', 'asc');
        return results.map(result => ({
            id: result.id,
            order_id: result.order_id,
            inventory_item_id: result.inventory_item_id,
            item_name: result.item_name,
            item_description: result.item_description,
            sku: result.sku,
            category_name: result.category_name,
            brand_name: result.brand_name,
            supplier_sku: result.supplier_sku,
            quantity_ordered: result.quantity_ordered,
            quantity_received: result.quantity_received,
            quantity_rejected: result.quantity_rejected,
            unit_price: parseFloat(result.unit_price),
            tax_rate: parseFloat(result.tax_rate),
            discount_rate: parseFloat(result.discount_rate),
            line_total: parseFloat(result.line_total),
            unit: result.unit,
            batch_number: result.batch_number,
            expiry_date: result.expiry_date,
            status: result.status,
            received_at: result.received_at,
            notes: result.notes,
            created_at: result.created_at,
            updated_at: result.updated_at
        }));
    }
    async receiveOrder(request) {
        const connection = await this.connection;
        const transaction = await connection.transaction();
        try {
            // Verify order exists and is in a receivable state
            const order = await transaction('inv_purchase_orders')
                .where('id', request.order_id)
                .first();
            if (!order) {
                throw new Error('Purchase order not found');
            }
            if (order.status === 'cancelled') {
                throw new Error('Cannot receive items for a cancelled order');
            }
            if (order.status === 'received') {
                throw new Error('Order is already fully received');
            }
            const results = [];
            // Process each receipt
            for (const receipt of request.receipts) {
                const result = await this.processReceipt(transaction, receipt, request.received_by, request.received_date);
                results.push(result);
            }
            // Update order status
            await transaction.raw('CALL inv_update_purchase_order_status(?)', [request.order_id]);
            await transaction.commit();
            return {
                order_id: request.order_id,
                receipts_processed: results,
                message: 'Order receipts processed successfully'
            };
        }
        catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    async processReceipt(transaction, receipt, receivedBy, receivedDate) {
        // Call stored procedure to process the receipt
        await transaction.raw('CALL inv_process_purchase_receipt(?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            receipt.order_item_id,
            receipt.quantity_received,
            receipt.batch_number || null,
            receipt.expiry_date || null,
            receipt.storage_location_id || null,
            receivedBy,
            receipt.condition_status || 'good',
            receipt.quality_check_passed !== false, // Default to true
            receipt.notes || null
        ]);
        return {
            order_item_id: receipt.order_item_id,
            quantity_received: receipt.quantity_received,
            batch_number: receipt.batch_number,
            condition_status: receipt.condition_status || 'good',
            quality_check_passed: receipt.quality_check_passed !== false
        };
    }
    isValidStatusTransition(fromStatus, toStatus) {
        var _a;
        const validTransitions = {
            'draft': ['pending_approval', 'cancelled'],
            'pending_approval': ['approved', 'draft', 'cancelled'],
            'approved': ['sent', 'cancelled'],
            'sent': ['confirmed', 'cancelled'],
            'confirmed': ['partially_received', 'received', 'cancelled'],
            'partially_received': ['confirmed', 'received', 'cancelled'],
            'received': [], // Final state
            'cancelled': [] // Final state
        };
        return ((_a = validTransitions[fromStatus]) === null || _a === void 0 ? void 0 : _a.includes(toStatus)) || false;
    }
}
exports.PurchaseOrderModel = PurchaseOrderModel;
