"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseOrderModel = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class PurchaseOrderModel {
    constructor(tenantId) {
        this.orderItemCounter = 0;
        this.receiptCounter = 0;
        this.transactionCounter = 0;
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
        const timestamp = Date.now();
        this.orderItemCounter += 1;
        return `POI-${timestamp}${this.orderItemCounter.toString().padStart(3, '0')}`;
    }
    calculateLineTotal(unitPrice, quantity, taxRate = 0, discountRate = 0) {
        const price = unitPrice || 0;
        const subtotal = price * quantity;
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
        this.orderItemCounter = 0;
        this.receiptCounter = 0;
        this.transactionCounter = 0;
        const supplier = await connection('inv_suppliers')
            .where('id', request.supplier_id)
            .where('is_active', true)
            .first();
        if (!supplier) {
            throw new Error('Supplier not found or inactive');
        }
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
            order_number: orderId,
            supplier_id: request.supplier_id,
            order_date: orderDate,
            expected_delivery_date: request.expected_delivery_date || null,
            status: 'ordered',
            total_amount: totalAmount,
            communication_method: request.communication_method || null,
            communication_notes: request.communication_notes || null,
            notes: request.notes || null,
            created_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        const trx = await connection.transaction();
        try {
            await trx('inv_purchase_orders').insert(orderData);
            const orderItems = request.items.map(item => {
                const lineTotal = this.calculateLineTotal(item.unit_price, item.quantity_ordered, item.tax_rate || 0, item.discount_rate || 0);
                return {
                    id: this.generateOrderItemId(),
                    order_id: orderData.id,
                    inventory_item_id: item.inventory_item_id,
                    quantity_ordered: item.quantity_ordered,
                    quantity_received: 0,
                    unit_price: item.unit_price || 0,
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
            .select('inv_purchase_orders.*', 'inv_suppliers.id as supplier_id_join', 'inv_suppliers.name as supplier_name', 'inv_suppliers.contact as supplier_contact', 'inv_suppliers.email as supplier_email', 'inv_suppliers.phone as supplier_phone', 'inv_suppliers.address as supplier_address', 'inv_suppliers.is_active as supplier_is_active', 'inv_suppliers.created_at as supplier_created_at', 'inv_suppliers.updated_at as supplier_updated_at', connection.raw('COUNT(inv_purchase_order_items.id) as items_count'), connection.raw('SUM(CASE WHEN inv_purchase_order_items.status = "received" THEN 1 ELSE 0 END) as received_items_count'))
            .leftJoin('inv_purchase_order_items', 'inv_purchase_orders.id', 'inv_purchase_order_items.order_id')
            .where('inv_purchase_orders.id', id)
            .groupBy('inv_purchase_orders.id', 'inv_suppliers.id', 'inv_suppliers.name', 'inv_suppliers.contact', 'inv_suppliers.email', 'inv_suppliers.phone', 'inv_suppliers.address', 'inv_suppliers.is_active', 'inv_suppliers.created_at', 'inv_suppliers.updated_at')
            .first();
        if (!result)
            return null;
        const items = await this.getOrderItems(id);
        const supplier = result.supplier_id_join ? {
            id: result.supplier_id_join,
            name: result.supplier_name,
            contact: result.supplier_contact,
            email: result.supplier_email,
            phone: result.supplier_phone,
            address: result.supplier_address,
            is_active: result.supplier_is_active,
            created_at: result.supplier_created_at,
            updated_at: result.supplier_updated_at
        } : undefined;
        return {
            id: result.id,
            order_number: result.order_number,
            supplier_id: result.supplier_id,
            order_date: result.order_date,
            expected_delivery_date: result.expected_delivery_date,
            status: result.status,
            total_amount: parseFloat(result.total_amount),
            communication_method: result.communication_method,
            communication_notes: result.communication_notes,
            notes: result.notes,
            created_by: result.created_by,
            created_at: result.created_at,
            updated_at: result.updated_at,
            supplier: supplier,
            items_count: parseInt(result.items_count) || 0,
            received_items_count: parseInt(result.received_items_count) || 0,
            items: items
        };
    }
    async findByOrderId(orderId) {
        const connection = await this.connection;
        const result = await connection('inv_purchase_orders')
            .where('order_number', orderId)
            .first();
        if (!result)
            return null;
        return await this.findById(result.id);
    }
    async findMany(filters) {
        const connection = await this.connection;
        const { page = 1, count = 10, sortby = 'DESC', supplier_id, order_id, status, start_date, end_date, search } = filters;
        let query = connection('inv_purchase_orders')
            .leftJoin('inv_suppliers', 'inv_purchase_orders.supplier_id', 'inv_suppliers.id')
            .leftJoin('inv_purchase_order_items', 'inv_purchase_orders.id', 'inv_purchase_order_items.order_id')
            .select('inv_purchase_orders.*', 'inv_suppliers.name as supplier_name', connection.raw('COUNT(DISTINCT inv_purchase_order_items.id) as items_count'), connection.raw('COUNT(DISTINCT CASE WHEN inv_purchase_order_items.status = "received" THEN inv_purchase_order_items.id END) as received_items_count'))
            .groupBy('inv_purchase_orders.id', 'inv_suppliers.name')
            .orderBy('inv_purchase_orders.created_at', sortby);
        if (supplier_id) {
            query = query.where('inv_purchase_orders.supplier_id', supplier_id);
        }
        if (order_id) {
            query = query.where('inv_purchase_orders.order_number', order_id);
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
                qb.where('inv_purchase_orders.order_number', 'like', `%${search}%`)
                    .orWhere('inv_purchase_orders.notes', 'like', `%${search}%`)
                    .orWhere('inv_suppliers.name', 'like', `%${search}%`);
            });
        }
        if (start_date) {
            query = query.where('inv_purchase_orders.order_date', '>=', start_date);
        }
        if (end_date) {
            query = query.where('inv_purchase_orders.order_date', '<=', end_date);
        }
        const totalQuery = query.clone().clearSelect().clearOrder().select(connection.raw('COUNT(DISTINCT ??) as ??', ['inv_purchase_orders.id', 'count'])).first();
        const totalResult = await totalQuery;
        const total = parseInt(totalResult === null || totalResult === void 0 ? void 0 : totalResult.count) || 0;
        const offset = (page - 1) * count;
        const rawData = await query.limit(count).offset(offset);
        const orders = rawData.map((result) => ({
            id: result.id,
            order_number: result.order_number,
            supplier_id: result.supplier_id,
            order_date: result.order_date,
            expected_delivery_date: result.expected_delivery_date,
            status: result.status,
            total_amount: parseFloat(result.total_amount),
            communication_method: result.communication_method,
            communication_notes: result.communication_notes,
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
        if (currentOrder.status === 'received' || currentOrder.status === 'cancelled') {
            throw new Error('Cannot update a received or cancelled order');
        }
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
        if (updates.supplier_id !== undefined)
            updateData.supplier_id = updates.supplier_id;
        if (updates.expected_delivery_date !== undefined)
            updateData.expected_delivery_date = updates.expected_delivery_date;
        if (updates.communication_method !== undefined)
            updateData.communication_method = updates.communication_method;
        if (updates.communication_notes !== undefined)
            updateData.communication_notes = updates.communication_notes;
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
        const trx = await connection.transaction();
        try {
            await trx('inv_purchase_orders')
                .where({ id })
                .update({
                status: 'cancelled',
                updated_at: new Date().toISOString()
            });
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
            .leftJoin('inv_units as cu', 'inv_inventory_items.consumption_unit', 'cu.id')
            .select('inv_purchase_order_items.*', 'inv_inventory_items.name as item_name', 'inv_inventory_items.sku as item_sku', 'cu.name as consumption_unit_name')
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
            consumption_unit: result.consumption_unit_name,
            unit: result.unit
        }));
    }
    async updateOrderStatus(orderId, trx) {
        const connection = trx || await this.connection;
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
            newStatus = 'ordered';
        }
        await connection('inv_purchase_orders')
            .where('id', orderId)
            .update({
            status: newStatus,
            updated_at: new Date().toISOString()
        });
    }
    generateReceiptNumber() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        this.receiptCounter += 1;
        const timestamp = Date.now().toString().slice(-4);
        return `REC-${year}${month}${day}-${timestamp}${this.receiptCounter.toString().padStart(3, '0')}`;
    }
    generateTransactionId() {
        const timestamp = Date.now();
        this.transactionCounter += 1;
        return `TXN-${timestamp}${this.transactionCounter.toString().padStart(3, '0')}`;
    }
    async receiveOrder(orderId, request) {
        const connection = await this.connection;
        this.receiptCounter = 0;
        this.transactionCounter = 0;
        const trx = await connection.transaction();
        try {
            const order = await trx('inv_purchase_orders')
                .where('id', orderId)
                .whereNot('status', 'cancelled')
                .first();
            if (!order) {
                throw new Error('Purchase order not found or cancelled');
            }
            const receipts = [];
            const transactions = [];
            for (const receiptData of request.receipts) {
                const orderItem = await trx('inv_purchase_order_items')
                    .where('id', receiptData.order_item_id)
                    .where('order_id', orderId)
                    .first();
                if (!orderItem) {
                    throw new Error(`Order item ${receiptData.order_item_id} not found in this order`);
                }
                const newTotalReceived = orderItem.quantity_received + receiptData.quantity_received;
                if (newTotalReceived > orderItem.quantity_ordered) {
                    throw new Error(`Cannot receive more than ordered quantity for item ${receiptData.order_item_id}`);
                }
                const receiptNumber = this.generateReceiptNumber();
                const receipt = {
                    id: `REC-${Date.now()}`,
                    order_id: orderId,
                    order_item_id: receiptData.order_item_id,
                    receipt_number: receiptNumber,
                    received_date: receiptData.received_date || new Date().toISOString().split('T')[0],
                    received_by: request.received_by,
                    quantity_received: receiptData.quantity_received,
                    batch_number: receiptData.batch_number || null,
                    expiry_date: receiptData.expiry_date || null,
                    unit_price: receiptData.unit_price || orderItem.unit_price,
                    tax_rate: receiptData.tax_rate || orderItem.tax_rate,
                    discount_rate: receiptData.discount_rate || orderItem.discount_rate,
                    condition_status: receiptData.condition_status || 'good',
                    quality_check_passed: receiptData.quality_check_passed !== undefined ? receiptData.quality_check_passed : true,
                    notes: receiptData.notes || null,
                    image_url: null,
                    purchase_unit: receiptData.purchase_unit || null,
                    units_per_purchase_unit: receiptData.units_per_purchase_unit || null,
                    created_at: new Date().toISOString()
                };
                await trx('inv_purchase_order_receipts').insert(receipt);
                receipts.push(receipt);
                if (receipt.condition_status === 'good' || receipt.condition_status === 'acceptable') {
                    if (orderItem.inventory_item_id) {
                        const inventoryItem = await trx('inv_inventory_items')
                            .where('id', orderItem.inventory_item_id)
                            .first();
                        if (!inventoryItem) {
                            throw new Error(`Inventory item ${orderItem.inventory_item_id} not found`);
                        }
                        const previousStock = inventoryItem.current_stock;
                        const consumptionQuantity = receiptData.purchase_unit && receiptData.units_per_purchase_unit
                            ? receiptData.quantity_received * receiptData.units_per_purchase_unit
                            : receiptData.quantity_received;
                        const newStock = previousStock + consumptionQuantity;
                        await trx('inv_inventory_items')
                            .where('id', orderItem.inventory_item_id)
                            .update({
                            current_stock: newStock,
                            status: this.calculateStockStatus(newStock, inventoryItem.min_stock, inventoryItem.max_stock),
                            last_updated: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });
                        const transaction = {
                            id: this.generateTransactionId(),
                            item_id: orderItem.inventory_item_id,
                            transaction_type: 'addition',
                            unit_type: receiptData.purchase_unit ? 'purchase' : 'consumption',
                            quantity: consumptionQuantity,
                            purchase_unit: receiptData.purchase_unit || null,
                            units_per_purchase_unit: receiptData.units_per_purchase_unit || null,
                            previous_stock: previousStock,
                            new_stock: newStock,
                            batch_number: receiptData.batch_number || null,
                            expiry_date: receiptData.expiry_date || null,
                            unit_cost: receiptData.unit_price || orderItem.unit_price,
                            total_cost: (receiptData.unit_price || orderItem.unit_price) * receiptData.quantity_received,
                            brand_name: null,
                            reason: 'Purchase order receipt',
                            reference_id: receipt.id,
                            performed_by: request.received_by,
                            transaction_date: new Date().toISOString(),
                            notes: receiptData.purchase_unit
                                ? `Received ${receiptData.quantity_received} ${receiptData.purchase_unit} (${consumptionQuantity} ${inventoryItem.consumption_unit}) from purchase order ${order.order_number}`
                                : `Received ${receiptData.quantity_received} units from purchase order ${order.order_number}`,
                            created_at: new Date().toISOString()
                        };
                        await trx('inv_inventory_transactions').insert(transaction);
                        transactions.push(transaction);
                    }
                }
                const updatedQuantityReceived = orderItem.quantity_received + receiptData.quantity_received;
                let itemStatus;
                if (updatedQuantityReceived >= orderItem.quantity_ordered) {
                    itemStatus = 'received';
                }
                else if (updatedQuantityReceived > 0) {
                    itemStatus = 'partially_received';
                }
                else {
                    itemStatus = 'pending';
                }
                const receivedLineTotal = this.calculateLineTotal(receiptData.unit_price || orderItem.unit_price, updatedQuantityReceived, receiptData.tax_rate || orderItem.tax_rate, receiptData.discount_rate || orderItem.discount_rate);
                await trx('inv_purchase_order_items')
                    .where('id', receiptData.order_item_id)
                    .update({
                    quantity_received: updatedQuantityReceived,
                    status: itemStatus,
                    line_total: receivedLineTotal,
                    updated_at: new Date().toISOString()
                });
            }
            await this.updateOrderStatus(orderId, trx);
            const totalResult = await trx('inv_purchase_order_items')
                .where('order_id', orderId)
                .where('status', '!=', 'cancelled')
                .sum('line_total as total')
                .first();
            const newTotal = parseFloat((totalResult === null || totalResult === void 0 ? void 0 : totalResult.total) || 0);
            await trx('inv_purchase_orders')
                .where('id', orderId)
                .update({
                total_amount: newTotal,
                updated_at: new Date().toISOString()
            });
            await trx.commit();
            const updatedOrder = await this.findById(orderId);
            if (!updatedOrder) {
                throw new Error('Failed to retrieve updated order');
            }
            return updatedOrder;
        }
        catch (error) {
            await trx.rollback();
            throw error;
        }
    }
    calculateStockStatus(currentStock, minStock, maxStock) {
        if (currentStock <= 0)
            return 'out_of_stock';
        if (currentStock <= minStock)
            return 'low_stock';
        return 'in_stock';
    }
    async getReceivedOrdersReport(filters) {
        const connection = await this.connection;
        const { page = 1, count = 10, supplier_id, status, start_date, end_date, sortby = 'DESC' } = filters;
        let query = connection('inv_purchase_orders')
            .leftJoin('inv_suppliers', 'inv_purchase_orders.supplier_id', 'inv_suppliers.id')
            .leftJoin('inv_purchase_order_items', 'inv_purchase_orders.id', 'inv_purchase_order_items.order_id')
            .leftJoin('inv_inventory_items', 'inv_purchase_order_items.inventory_item_id', 'inv_inventory_items.id')
            .leftJoin('inv_purchase_order_receipts', 'inv_purchase_order_items.id', 'inv_purchase_order_receipts.order_item_id')
            .leftJoin('inv_inventory_transactions', 'inv_purchase_order_receipts.id', 'inv_inventory_transactions.reference_id')
            .leftJoin('roles', 'inv_inventory_transactions.performed_by', 'roles.employeeid')
            .select('inv_purchase_orders.id as order_id', 'inv_purchase_orders.order_number', 'inv_purchase_orders.order_date', 'inv_purchase_orders.expected_delivery_date', 'inv_purchase_orders.status', 'inv_purchase_orders.total_amount', 'inv_purchase_orders.communication_method', 'inv_purchase_orders.communication_notes', 'inv_purchase_orders.notes', 'inv_purchase_orders.created_at as order_created_at', 'inv_purchase_orders.updated_at as order_updated_at', 'inv_suppliers.id as supplier_id', 'inv_suppliers.name as supplier_name', 'inv_suppliers.contact as supplier_contact', 'inv_suppliers.email as supplier_email', 'inv_suppliers.phone as supplier_phone', 'inv_suppliers.address as supplier_address', 'inv_purchase_order_items.id as item_id', 'inv_purchase_order_items.quantity_ordered', 'inv_purchase_order_items.quantity_received', 'inv_purchase_order_items.unit_price as item_unit_price', 'inv_purchase_order_items.tax_rate as item_tax_rate', 'inv_purchase_order_items.discount_rate as item_discount_rate', 'inv_purchase_order_items.line_total', 'inv_purchase_order_items.status as item_status', 'inv_purchase_order_items.notes as item_notes', 'inv_purchase_order_items.created_at as item_created_at', 'inv_inventory_items.name as inventory_name', 'inv_inventory_items.sku as inventory_sku', 'inv_inventory_items.consumption_unit as inventory_unit', 'inv_purchase_order_receipts.id as receipt_id', 'inv_purchase_order_receipts.receipt_number', 'inv_purchase_order_receipts.received_date', 'inv_purchase_order_receipts.received_by', 'inv_purchase_order_receipts.quantity_received as receipt_quantity', 'inv_purchase_order_receipts.batch_number', 'inv_purchase_order_receipts.expiry_date', 'inv_purchase_order_receipts.unit_price as receipt_unit_price', 'inv_purchase_order_receipts.tax_rate as receipt_tax_rate', 'inv_purchase_order_receipts.discount_rate as receipt_discount_rate', 'inv_purchase_order_receipts.condition_status', 'inv_purchase_order_receipts.quality_check_passed', 'inv_purchase_order_receipts.notes as receipt_notes', 'inv_purchase_order_receipts.created_at as receipt_created_at', 'inv_inventory_transactions.id as transaction_id', 'inv_inventory_transactions.transaction_type', 'inv_inventory_transactions.quantity as transaction_quantity', 'inv_inventory_transactions.previous_stock', 'inv_inventory_transactions.new_stock', 'inv_inventory_transactions.unit_cost', 'inv_inventory_transactions.total_cost', 'inv_inventory_transactions.brand_name', 'inv_inventory_transactions.reason', 'inv_inventory_transactions.performed_by', 'inv_inventory_transactions.transaction_date', 'inv_inventory_transactions.notes as transaction_notes', 'inv_inventory_transactions.created_at as transaction_created_at', 'roles.employeeid as employee_id', 'roles.username as employee_fullname', 'roles.email as employee_email', 'roles.role as employee_jobtitle')
            .where(function () {
            if (status) {
                if (Array.isArray(status)) {
                    this.whereIn('inv_purchase_orders.status', status);
                }
                else {
                    this.where('inv_purchase_orders.status', status);
                }
            }
            else {
                this.where('inv_purchase_orders.status', 'received');
            }
        });
        if (supplier_id) {
            query = query.where('inv_purchase_orders.supplier_id', supplier_id);
        }
        if (start_date) {
            query = query.where('inv_purchase_orders.order_date', '>=', start_date);
        }
        if (end_date) {
            query = query.where('inv_purchase_orders.order_date', '<=', end_date);
        }
        const totalQuery = query.clone().clearSelect().clearOrder()
            .countDistinct('inv_purchase_orders.id as count').first();
        const totalResult = await totalQuery;
        const total = parseInt(totalResult === null || totalResult === void 0 ? void 0 : totalResult.count) || 0;
        query = query.orderBy('inv_purchase_orders.order_date', sortby)
            .orderBy('inv_purchase_orders.created_at', sortby);
        const offset = (page - 1) * count;
        const rawData = await query.limit(count).offset(offset);
        const ordersMap = new Map();
        rawData.forEach((row) => {
            const orderId = row.order_id;
            if (!ordersMap.has(orderId)) {
                ordersMap.set(orderId, {
                    id: orderId,
                    order_number: row.order_number,
                    order_date: row.order_date,
                    expected_delivery_date: row.expected_delivery_date,
                    status: row.status,
                    total_amount: parseFloat(row.total_amount || 0),
                    communication_method: row.communication_method,
                    communication_notes: row.communication_notes,
                    notes: row.notes,
                    created_at: row.order_created_at,
                    updated_at: row.order_updated_at,
                    supplier: {
                        id: row.supplier_id,
                        name: row.supplier_name,
                        contact: row.supplier_contact,
                        email: row.supplier_email,
                        phone: row.supplier_phone,
                        address: row.supplier_address
                    },
                    items: [],
                    total_cost: 0,
                    total_received_quantity: 0,
                    total_transaction_cost: 0
                });
            }
            const order = ordersMap.get(orderId);
            let item = order.items.find((i) => i.id === row.item_id);
            if (!item) {
                item = {
                    id: row.item_id,
                    quantity_ordered: row.quantity_ordered,
                    quantity_received: row.quantity_received,
                    unit_price: parseFloat(row.item_unit_price || 0),
                    tax_rate: parseFloat(row.item_tax_rate || 0),
                    discount_rate: parseFloat(row.item_discount_rate || 0),
                    line_total: parseFloat(row.line_total || 0),
                    status: row.item_status,
                    notes: row.item_notes,
                    created_at: row.item_created_at,
                    inventory_item: {
                        name: row.inventory_name,
                        sku: row.inventory_sku,
                        unit: row.inventory_unit
                    },
                    receipts: []
                };
                order.items.push(item);
                order.total_cost += item.line_total;
                order.total_received_quantity += item.quantity_received;
            }
            if (row.receipt_id) {
                let receipt = item.receipts.find((r) => r.id === row.receipt_id);
                if (!receipt) {
                    receipt = {
                        id: row.receipt_id,
                        receipt_number: row.receipt_number,
                        received_date: row.received_date,
                        received_by: row.received_by,
                        quantity_received: row.receipt_quantity,
                        batch_number: row.batch_number,
                        expiry_date: row.expiry_date,
                        unit_price: parseFloat(row.receipt_unit_price || 0),
                        tax_rate: parseFloat(row.receipt_tax_rate || 0),
                        discount_rate: parseFloat(row.receipt_discount_rate || 0),
                        condition_status: row.condition_status,
                        quality_check_passed: row.quality_check_passed,
                        notes: row.receipt_notes,
                        created_at: row.receipt_created_at,
                        transactions: []
                    };
                    item.receipts.push(receipt);
                }
                if (row.transaction_id) {
                    const transaction = {
                        id: row.transaction_id,
                        transaction_type: row.transaction_type,
                        quantity: row.transaction_quantity,
                        previous_stock: row.previous_stock,
                        new_stock: row.new_stock,
                        unit_cost: parseFloat(row.unit_cost || 0),
                        total_cost: parseFloat(row.total_cost || 0),
                        brand_name: row.brand_name,
                        reason: row.reason,
                        performed_by: row.performed_by,
                        employee: row.employee_id ? {
                            id: row.employee_id,
                            first_name: row.employee_firstname,
                            last_name: row.employee_lastname,
                            full_name: row.employee_fullname,
                            email: row.employee_email,
                            job_title: row.employee_jobtitle,
                            department: row.employee_department
                        } : null,
                        transaction_date: row.transaction_date,
                        notes: row.transaction_notes,
                        created_at: row.transaction_created_at
                    };
                    receipt.transactions.push(transaction);
                    order.total_transaction_cost += transaction.total_cost;
                }
            }
        });
        const orders = Array.from(ordersMap.values());
        return {
            orders,
            total,
            page,
            count,
            totalPages: Math.ceil(total / count),
            sortby
        };
    }
}
exports.PurchaseOrderModel = PurchaseOrderModel;
