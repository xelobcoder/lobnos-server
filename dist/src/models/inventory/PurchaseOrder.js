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
    generateOrderId() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const timestamp = Date.now().toString().slice(-4);
        return `ORD-${year}${month}${day}-${timestamp}`;
    }
    generateOrderItemId() {
        const timestamp = Date.now().toString();
        return `POI-${timestamp}`;
    }
    calculateLineTotal(unitPrice, quantity, taxRate = 0, discountRate = 0) {
        const subtotal = unitPrice * quantity;
        const taxAmount = subtotal * (taxRate / 100);
        const discountAmount = subtotal * (discountRate / 100);
        return subtotal + taxAmount - discountAmount;
    }
    calculateOrderTotal(items) {
        return items.reduce((total, item) => {
            return total + this.calculateLineTotal(item.unit_price, item.quantity_ordered, item.tax_rate, item.discount_rate);
        }, 0);
    }
    async create(request) {
        const connection = await this.connection;
        // Validate supplier exists and is active
        const supplier = await connection('inv_suppliers')
            .where('id', request.supplier_id)
            .where('is_active', true)
            .first();
        if (!supplier) {
            throw new Error('Supplier not found or inactive');
        }
        // Validate items exist and are active
        for (const item of request.items) {
            const inventoryItem = await connection('inv_inventory_items')
                .where('id', item.inventory_item_id)
                .where('is_active', true)
                .first();
            if (!inventoryItem) {
                throw new Error(`Inventory item ${item.inventory_item_id} not found or inactive`);
            }
        }
        const orderId = this.generateOrderId();
        const orderDate = request.order_date || new Date().toISOString().split('T')[0];
        const totalAmount = this.calculateOrderTotal(request.items);
        const orderData = {
            id: `PO-${Date.now()}`,
            order_id: orderId,
            supplier_id: request.supplier_id,
            order_date: orderDate,
            expected_delivery_date: request.expected_delivery_date || null,
            status: 'ordered',
            total_amount: totalAmount,
            notes: request.notes || null,
            created_by: null, // TODO: Get from auth context
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        // Start transaction
        const trx = await connection.transaction();
        try {
            // Insert order
            await trx('inv_purchase_orders').insert(orderData);
            // Insert order items
            const orderItems = request.items.map(item => {
                const lineTotal = this.calculateLineTotal(item.unit_price, item.quantity_ordered, item.tax_rate || 0, item.discount_rate || 0);
                return {
                    id: this.generateOrderItemId(),
                    order_id: orderData.id,
                    inventory_item_id: item.inventory_item_id,
                    quantity_ordered: item.quantity_ordered,
                    quantity_received: 0,
                    unit_price: item.unit_price,
                    tax_rate: item.tax_rate || 0,
                    discount_rate: item.discount_rate || 0,
                    line_total: lineTotal,
                    status: 'pending',
                    notes: item.notes || null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
            });
            await trx('inv_purchase_order_items').insert(orderItems);
            await trx.commit();
            return await this.findById(orderData.id);
        }
        catch (error) {
            await trx.rollback();
            throw error;
        }
    }
    async findById(id) {
        const connection = await this.connection;
        const result = await connection('inv_purchase_orders')
            .leftJoin('inv_suppliers', 'inv_purchase_orders.supplier_id', 'inv_suppliers.id')
            .select('inv_purchase_orders.*', 'inv_suppliers.name as supplier_name', connection.raw('COUNT(inv_purchase_order_items.id) as items_count'), connection.raw('SUM(CASE WHEN inv_purchase_order_items.status = "received" THEN 1 ELSE 0 END) as received_items_count'))
            .leftJoin('inv_purchase_order_items', 'inv_purchase_orders.id', 'inv_purchase_order_items.order_id')
            .where('inv_purchase_orders.id', id)
            .groupBy('inv_purchase_orders.id', 'inv_suppliers.name')
            .first();
        if (!result)
            return null;
        return {
            id: result.id,
            order_id: result.order_id,
            supplier_id: result.supplier_id,
            order_date: result.order_date,
            expected_delivery_date: result.expected_delivery_date,
            status: result.status,
            total_amount: parseFloat(result.total_amount),
            notes: result.notes,
            created_by: result.created_by,
            created_at: result.created_at,
            updated_at: result.updated_at,
            supplier_name: result.supplier_name,
            items_count: parseInt(result.items_count) || 0,
            received_items_count: parseInt(result.received_items_count) || 0
        };
    }
    async findByOrderId(orderId) {
        const connection = await this.connection;
        const result = await connection('inv_purchase_orders')
            .where('order_id', orderId)
            .first();
        if (!result)
            return null;
        return await this.findById(result.id);
    }
    async findMany(filters) {
        const connection = await this.connection;
        const { page = 1, count = 10, sortby = 'DESC', supplier_id, status, startDate, endDate, search } = filters;
        let query = connection('inv_purchase_orders')
            .leftJoin('inv_suppliers', 'inv_purchase_orders.supplier_id', 'inv_suppliers.id')
            .leftJoin('inv_purchase_order_items', 'inv_purchase_orders.id', 'inv_purchase_order_items.order_id')
            .select('inv_purchase_orders.*', 'inv_suppliers.name as supplier_name', connection.raw('COUNT(DISTINCT inv_purchase_order_items.id) as items_count'), connection.raw('COUNT(DISTINCT CASE WHEN inv_purchase_order_items.status = "received" THEN inv_purchase_order_items.id END) as received_items_count'))
            .groupBy('inv_purchase_orders.id', 'inv_suppliers.name')
            .orderBy('inv_purchase_orders.created_at', sortby);
        // Apply filters
        if (supplier_id) {
            query = query.where('inv_purchase_orders.supplier_id', supplier_id);
        }
        if (status) {
            if (Array.isArray(status)) {
                query = query.whereIn('inv_purchase_orders.status', status);
            }
            else {
                query = query.where('inv_purchase_orders.status', status);
            }
        }
        if (search) {
            query = query.where((qb) => {
                qb.where('inv_purchase_orders.order_id', 'like', `%${search}%`)
                    .orWhere('inv_purchase_orders.notes', 'like', `%${search}%`)
                    .orWhere('inv_suppliers.name', 'like', `%${search}%`);
            });
        }
        if (startDate) {
            query = query.where('inv_purchase_orders.order_date', '>=', startDate);
        }
        if (endDate) {
            query = query.where('inv_purchase_orders.order_date', '<=', endDate);
        }
        const totalQuery = query.clone().clearSelect().clearOrder().select(connection.raw('COUNT(DISTINCT ??) as ??', ['inv_purchase_orders.id', 'count'])).first();
        const totalResult = await totalQuery;
        const total = parseInt(totalResult === null || totalResult === void 0 ? void 0 : totalResult.count) || 0;
        const offset = (page - 1) * count;
        const rawData = await query.limit(count).offset(offset);
        const orders = rawData.map((result) => ({
            id: result.id,
            order_id: result.order_id,
            supplier_id: result.supplier_id,
            order_date: result.order_date,
            expected_delivery_date: result.expected_delivery_date,
            status: result.status,
            total_amount: parseFloat(result.total_amount),
            notes: result.notes,
            created_by: result.created_by,
            created_at: result.created_at,
            updated_at: result.updated_at,
            supplier_name: result.supplier_name,
            items_count: parseInt(result.items_count) || 0,
            received_items_count: parseInt(result.received_items_count) || 0
        }));
        return {
            orders,
            total,
            page,
            count,
            totalPages: Math.ceil(total / count),
            sortby
        };
    }
    async update(id, updates) {
        const connection = await this.connection;
        const currentOrder = await this.findById(id);
        if (!currentOrder) {
            throw new Error('Purchase order not found');
        }
        // Only allow updates if order is not received or cancelled
        if (currentOrder.status === 'received' || currentOrder.status === 'cancelled') {
            throw new Error('Cannot update a received or cancelled order');
        }
        // Validate supplier if changing
        if (updates.supplier_id && updates.supplier_id !== currentOrder.supplier_id) {
            const supplier = await connection('inv_suppliers')
                .where('id', updates.supplier_id)
                .where('is_active', true)
                .first();
            if (!supplier) {
                throw new Error('Supplier not found or inactive');
            }
        }
        const updateData = {
            updated_at: new Date().toISOString()
        };
        // Map updates
        if (updates.supplier_id !== undefined)
            updateData.supplier_id = updates.supplier_id;
        if (updates.expected_delivery_date !== undefined)
            updateData.expected_delivery_date = updates.expected_delivery_date;
        if (updates.status !== undefined)
            updateData.status = updates.status;
        if (updates.notes !== undefined)
            updateData.notes = updates.notes;
        await connection('inv_purchase_orders')
            .where({ id })
            .update(updateData);
        return await this.findById(id);
    }
    async cancel(id) {
        const connection = await this.connection;
        const currentOrder = await this.findById(id);
        if (!currentOrder) {
            throw new Error('Purchase order not found');
        }
        if (currentOrder.status === 'received' || currentOrder.status === 'cancelled') {
            throw new Error('Order is already received or cancelled');
        }
        // Start transaction to update order and items
        const trx = await connection.transaction();
        try {
            // Update order status
            await trx('inv_purchase_orders')
                .where({ id })
                .update({
                status: 'cancelled',
                updated_at: new Date().toISOString()
            });
            // Update all order items to cancelled
            await trx('inv_purchase_order_items')
                .where('order_id', id)
                .update({
                status: 'cancelled',
                updated_at: new Date().toISOString()
            });
            await trx.commit();
            return await this.findById(id);
        }
        catch (error) {
            await trx.rollback();
            throw error;
        }
    }
    async getOrderItems(orderId) {
        const connection = await this.connection;
        const results = await connection('inv_purchase_order_items')
            .leftJoin('inv_inventory_items', 'inv_purchase_order_items.inventory_item_id', 'inv_inventory_items.id')
            .select('inv_purchase_order_items.*', 'inv_inventory_items.name as item_name', 'inv_inventory_items.sku as item_sku', 'inv_inventory_items.unit')
            .where('inv_purchase_order_items.order_id', orderId)
            .orderBy('inv_purchase_order_items.created_at', 'ASC');
        return results.map((result) => ({
            id: result.id,
            order_id: result.order_id,
            inventory_item_id: result.inventory_item_id,
            quantity_ordered: result.quantity_ordered,
            quantity_received: result.quantity_received,
            unit_price: parseFloat(result.unit_price),
            tax_rate: parseFloat(result.tax_rate),
            discount_rate: parseFloat(result.discount_rate),
            line_total: parseFloat(result.line_total),
            status: result.status,
            notes: result.notes,
            created_at: result.created_at,
            updated_at: result.updated_at,
            item_name: result.item_name,
            item_sku: result.item_sku,
            unit: result.unit
        }));
    }
    async updateOrderStatus(orderId) {
        const connection = await this.connection;
        // Get order items status
        const items = await connection('inv_purchase_order_items')
            .where('order_id', orderId)
            .select('status', 'quantity_ordered', 'quantity_received');
        if (items.length === 0)
            return;
        const allReceived = items.every(item => item.status === 'received');
        const hasPartial = items.some(item => item.status === 'partially_received');
        const hasPending = items.some(item => item.status === 'pending');
        let newStatus;
        if (allReceived) {
            newStatus = 'received';
        }
        else if (hasPartial || hasPending) {
            newStatus = 'partially_received';
        }
        else {
            newStatus = 'ordered'; // fallback
        }
        await connection('inv_purchase_orders')
            .where('id', orderId)
            .update({
            status: newStatus,
            updated_at: new Date().toISOString()
        });
    }
}
exports.PurchaseOrderModel = PurchaseOrderModel;
