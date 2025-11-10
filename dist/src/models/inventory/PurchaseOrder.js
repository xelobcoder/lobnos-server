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
            status: request.status || 'draft',
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
            .select('inv_purchase_orders.*', 'inv_suppliers.name as supplier_name', 'inv_suppliers.contact as supplier_contact', 'inv_suppliers.email as supplier_email', 'inv_suppliers.phone as supplier_phone', 'inv_suppliers.address as supplier_address')
            .leftJoin('inv_suppliers', function () {
            this.on('inv_purchase_orders.supplier_id', 'inv_suppliers.id')
                .andOn('inv_suppliers.is_active', connection.raw('?', [true]));
        })
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
        // Get order items
        const items = await this.getOrderItems(id);
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
            supplier_contact: result.supplier_contact,
            supplier_email: result.supplier_email,
            supplier_phone: result.supplier_phone,
            supplier_address: result.supplier_address,
            items_count: parseInt(String((itemsCountResult === null || itemsCountResult === void 0 ? void 0 : itemsCountResult.count) || 0)),
            received_items_count: parseInt(String((receivedItemsCountResult === null || receivedItemsCountResult === void 0 ? void 0 : receivedItemsCountResult.count) || 0)),
            items: items
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
            .select('inv_purchase_orders.*', 'inv_suppliers.name as supplier_name', 'inv_suppliers.contact as supplier_contact', 'inv_suppliers.email as supplier_email', 'inv_suppliers.phone as supplier_phone', 'inv_suppliers.address as supplier_address', connection.raw('COUNT(inv_purchase_order_items.id) as items_count'), connection.raw('SUM(CASE WHEN inv_purchase_order_items.status = "received" THEN 1 ELSE 0 END) as received_items_count'))
            .leftJoin('inv_suppliers', function () {
            this.on('inv_purchase_orders.supplier_id', 'inv_suppliers.id')
                .andOn('inv_suppliers.is_active', connection.raw('?', [true]));
        })
            .leftJoin('inv_purchase_order_items', 'inv_purchase_orders.id', 'inv_purchase_order_items.order_id')
            .groupBy('inv_purchase_orders.id');
        // Apply filters
        if (filters.supplier_id) {
            query = query.where('inv_purchase_orders.supplier_id', filters.supplier_id);
        }
        if (filters.supplier_name) {
            query = query.where('inv_suppliers.name', 'like', `%${filters.supplier_name}%`);
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
               LEFT JOIN inv_suppliers s ON po.supplier_id = s.id AND s.is_active = true
               LEFT JOIN inv_purchase_order_items poi ON po.id = poi.order_id
               WHERE 1=1
               ${filters.supplier_id ? 'AND po.supplier_id = ?' : ''}
               ${filters.supplier_name ? 'AND s.name LIKE ?' : ''}
               ${filters.status ? `AND po.status ${Array.isArray(filters.status) ? 'IN (?)' : '= ?'}` : ''}
               ${filters.startDate ? 'AND po.order_date >= ?' : ''}
               ${filters.endDate ? 'AND po.order_date <= ?' : ''}
               ${filters.search ? 'AND (po.order_number LIKE ? OR s.name LIKE ? OR po.notes LIKE ?)' : ''}
          `, [
            ...(filters.supplier_id ? [filters.supplier_id] : []),
            ...(filters.supplier_name ? [`%${filters.supplier_name}%`] : []),
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
        // Transform data and fetch items for each order
        const orders = [];
        for (const result of rawData) {
            const order = {
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
                supplier_contact: result.supplier_contact,
                supplier_email: result.supplier_email,
                supplier_phone: result.supplier_phone,
                supplier_address: result.supplier_address,
                items_count: parseInt(result.items_count),
                received_items_count: parseInt(result.received_items_count || 0)
            };
            // Fetch items for this order
            const items = await this.getOrderItems(result.id);
            order.items = items;
            orders.push(order);
        }
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
        // Validate status transitions only if status is changing
        if (updates.status && updates.status !== existingOrder.status && !this.isValidStatusTransition(existingOrder.status, updates.status)) {
            throw new Error(`Invalid status transition from ${existingOrder.status} to ${updates.status}`);
        }
        // Handle item updates if provided - only for orders that haven't been received
        if (updates.items) {
            // Check if any items have been received for this order
            const receivedItemsCount = await connection('inv_purchase_order_items')
                .where('order_id', id)
                .where('quantity_received', '>', 0)
                .count('* as count')
                .first();
            if (parseInt(String((receivedItemsCount === null || receivedItemsCount === void 0 ? void 0 : receivedItemsCount.count) || 0)) > 0) {
                throw new Error('Cannot update items for orders that have already received items. Use the receiving process instead.');
            }
            // Validate supplier exists if supplier_id is being updated
            const supplierId = updates.supplier_id || existingOrder.supplier_id;
            const supplier = await connection('inv_suppliers')
                .where('id', supplierId)
                .where('is_active', true)
                .first();
            if (!supplier) {
                throw new Error('Supplier not found or inactive');
            }
            // Fetch inventory item details for all items
            const itemIds = updates.items.map(item => item.inventory_item_id).filter(id => id);
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
            // Delete existing items and create new ones (full replacement for unreceived orders)
            await connection('inv_purchase_order_items').where('order_id', id).del();
            // Create new order items
            const orderItems = updates.items.map(item => {
                const inventoryItem = itemMap.get(item.inventory_item_id);
                const unitPrice = item.unit_price || 0;
                return {
                    id: `POI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    order_id: id,
                    inventory_item_id: item.inventory_item_id,
                    item_name: inventoryItem.name,
                    item_description: inventoryItem.description,
                    sku: inventoryItem.sku,
                    quantity_ordered: item.quantity_ordered || 0,
                    quantity_received: 0,
                    quantity_rejected: 0,
                    unit_price: unitPrice,
                    tax_rate: item.tax_rate || 0,
                    discount_rate: item.discount_rate || 0,
                    line_total: (item.quantity_ordered || 0) * unitPrice *
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
            // Recalculate totals
            const totalAmount = orderItems.reduce((sum, item) => sum + item.line_total, 0);
            const taxAmount = updates.tax_amount !== undefined ? updates.tax_amount : existingOrder.tax_amount;
            const discountAmount = updates.discount_amount !== undefined ? updates.discount_amount : existingOrder.discount_amount;
            const shippingCost = updates.shipping_cost !== undefined ? updates.shipping_cost : existingOrder.shipping_cost;
            const finalAmount = totalAmount + taxAmount + shippingCost - discountAmount;
            updates.total_amount = totalAmount;
            updates.final_amount = finalAmount;
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
    async updatePreReceival(id, updates) {
        const connection = await this.connection;
        // Check if order exists
        const existingOrder = await this.findById(id);
        if (!existingOrder) {
            return null;
        }
        // Check if any items have been received for this order
        const receivedItemsCount = await connection('inv_purchase_order_items')
            .where('order_id', id)
            .where('quantity_received', '>', 0)
            .count('* as count')
            .first();
        if (parseInt(String((receivedItemsCount === null || receivedItemsCount === void 0 ? void 0 : receivedItemsCount.count) || 0)) > 0) {
            throw new Error('Cannot update pre-receival for orders that have already received items. Use the receiving process instead.');
        }
        // Validate status transitions only if status is changing
        if (updates.status && updates.status !== existingOrder.status && !this.isValidStatusTransition(existingOrder.status, updates.status)) {
            throw new Error(`Invalid status transition from ${existingOrder.status} to ${updates.status}`);
        }
        // Validate supplier exists if supplier_id is being updated
        if (updates.supplier_id) {
            const supplier = await connection('inv_suppliers')
                .where('id', updates.supplier_id)
                .where('is_active', true)
                .first();
            if (!supplier) {
                throw new Error('Supplier not found or inactive');
            }
        }
        // Sync items: delete items not in payload, update existing items, add new items
        if (updates.items) {
            await this.syncOrderItems(id, updates.items);
        }
        // Update order header
        const updateData = {
            updated_at: connection.fn.now()
        };
        if (updates.supplier_id !== undefined)
            updateData.supplier_id = updates.supplier_id;
        if (updates.expected_delivery_date !== undefined)
            updateData.expected_delivery_date = updates.expected_delivery_date;
        if (updates.status !== undefined)
            updateData.status = updates.status;
        if (updates.notes !== undefined)
            updateData.notes = updates.notes;
        if (updates.communication_method !== undefined)
            updateData.communication_method = updates.communication_method;
        if (updates.communication_notes !== undefined)
            updateData.communication_notes = updates.communication_notes;
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
    async updateOrderItem(orderId, itemId, updates) {
        const connection = await this.connection;
        // Check if order exists and hasn't been received
        const order = await connection('inv_purchase_orders')
            .where('id', orderId)
            .first();
        if (!order) {
            throw new Error('Purchase order not found');
        }
        // Check if any items have been received for this order
        const receivedItemsCount = await connection('inv_purchase_order_items')
            .where('order_id', orderId)
            .where('quantity_received', '>', 0)
            .count('* as count')
            .first();
        if (parseInt(String((receivedItemsCount === null || receivedItemsCount === void 0 ? void 0 : receivedItemsCount.count) || 0)) > 0) {
            throw new Error('Cannot update items for orders that have already received items. Use the receiving process instead.');
        }
        // Check if item exists
        const existingItem = await connection('inv_purchase_order_items')
            .where('id', itemId)
            .where('order_id', orderId)
            .first();
        if (!existingItem) {
            throw new Error('Purchase order item not found');
        }
        const updateData = {
            updated_at: connection.fn.now()
        };
        // Handle inventory item change
        if (updates.inventory_item_id && updates.inventory_item_id !== existingItem.inventory_item_id) {
            const inventoryItem = await connection('inv_inventory_items')
                .where('id', updates.inventory_item_id)
                .where('is_active', true)
                .first();
            if (!inventoryItem) {
                throw new Error('Inventory item not found or inactive');
            }
            updateData.inventory_item_id = updates.inventory_item_id;
            updateData.item_name = inventoryItem.name;
            updateData.item_description = inventoryItem.description;
            updateData.sku = inventoryItem.sku;
            updateData.unit = inventoryItem.unit;
        }
        // Update other fields
        if (updates.quantity_ordered !== undefined)
            updateData.quantity_ordered = updates.quantity_ordered;
        if (updates.unit_price !== undefined)
            updateData.unit_price = updates.unit_price;
        if (updates.tax_rate !== undefined)
            updateData.tax_rate = updates.tax_rate;
        if (updates.discount_rate !== undefined)
            updateData.discount_rate = updates.discount_rate;
        if (updates.notes !== undefined)
            updateData.notes = updates.notes;
        // Recalculate line total
        const quantity = updates.quantity_ordered !== undefined ? updates.quantity_ordered : existingItem.quantity_ordered;
        const unitPrice = updates.unit_price !== undefined ? updates.unit_price : existingItem.unit_price;
        const taxRate = updates.tax_rate !== undefined ? updates.tax_rate : existingItem.tax_rate;
        const discountRate = updates.discount_rate !== undefined ? updates.discount_rate : existingItem.discount_rate;
        updateData.line_total = quantity * unitPrice * (1 + taxRate / 100) * (1 - discountRate / 100);
        await connection('inv_purchase_order_items')
            .where('id', itemId)
            .update(updateData);
        // Recalculate order totals
        await this.recalculateOrderTotals(orderId);
        return await this.getOrderItems(orderId).then(items => items.find(item => item.id === itemId) || null);
    }
    async addOrderItem(orderId, item) {
        const connection = await this.connection;
        // Check if order exists and hasn't been received
        const order = await connection('inv_purchase_orders')
            .where('id', orderId)
            .first();
        if (!order) {
            throw new Error('Purchase order not found');
        }
        // Check if any items have been received for this order
        const receivedItemsCount = await connection('inv_purchase_order_items')
            .where('order_id', orderId)
            .where('quantity_received', '>', 0)
            .count('* as count')
            .first();
        if (parseInt(String((receivedItemsCount === null || receivedItemsCount === void 0 ? void 0 : receivedItemsCount.count) || 0)) > 0) {
            throw new Error('Cannot add items to orders that have already received items. Use the receiving process instead.');
        }
        // Validate inventory item exists
        const inventoryItem = await connection('inv_inventory_items')
            .where('id', item.item_id)
            .where('is_active', true)
            .first();
        if (!inventoryItem) {
            throw new Error('Inventory item not found or inactive');
        }
        const unitPrice = item.unit_price || 0;
        const itemData = {
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
            line_total: item.quantity * unitPrice * (1 + (item.tax_rate || 0) / 100) * (1 - (item.discount_rate || 0) / 100),
            unit: inventoryItem.unit,
            status: 'pending',
            notes: item.notes || null,
            created_at: connection.fn.now(),
            updated_at: connection.fn.now()
        };
        await connection('inv_purchase_order_items').insert(itemData);
        // Recalculate order totals
        await this.recalculateOrderTotals(orderId);
        return {
            id: itemData.id,
            order_id: itemData.order_id,
            inventory_item_id: itemData.inventory_item_id,
            item_name: itemData.item_name,
            item_description: itemData.item_description,
            sku: itemData.sku,
            quantity_ordered: itemData.quantity_ordered,
            quantity_received: itemData.quantity_received,
            quantity_rejected: itemData.quantity_rejected,
            unit_price: itemData.unit_price,
            tax_rate: itemData.tax_rate,
            discount_rate: itemData.discount_rate,
            line_total: itemData.line_total,
            unit: itemData.unit,
            status: itemData.status,
            notes: itemData.notes,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }
    async removeOrderItem(orderId, itemId) {
        const connection = await this.connection;
        // Check if order exists and hasn't been received
        const order = await connection('inv_purchase_orders')
            .where('id', orderId)
            .first();
        if (!order) {
            throw new Error('Purchase order not found');
        }
        // Check if any items have been received for this order
        const receivedItemsCount = await connection('inv_purchase_order_items')
            .where('order_id', orderId)
            .where('quantity_received', '>', 0)
            .count('* as count')
            .first();
        if (parseInt(String((receivedItemsCount === null || receivedItemsCount === void 0 ? void 0 : receivedItemsCount.count) || 0)) > 0) {
            throw new Error('Cannot remove items from orders that have already received items. Use the receiving process instead.');
        }
        // Check if item exists and belongs to this order
        const item = await connection('inv_purchase_order_items')
            .where('id', itemId)
            .where('order_id', orderId)
            .first();
        if (!item) {
            throw new Error('Purchase order item not found');
        }
        await connection('inv_purchase_order_items')
            .where('id', itemId)
            .del();
        // Recalculate order totals
        await this.recalculateOrderTotals(orderId);
        return true;
    }
    async recalculateOrderTotals(orderId) {
        const connection = await this.connection;
        // Calculate new totals from items
        const itemsResult = await connection('inv_purchase_order_items')
            .where('order_id', orderId)
            .sum('line_total as total_amount')
            .first();
        const totalAmount = parseFloat(String((itemsResult === null || itemsResult === void 0 ? void 0 : itemsResult.total_amount) || 0));
        // Get current order data
        const order = await connection('inv_purchase_orders')
            .where('id', orderId)
            .first();
        if (order) {
            const taxAmount = parseFloat(order.tax_amount || 0);
            const discountAmount = parseFloat(order.discount_amount || 0);
            const shippingCost = parseFloat(order.shipping_cost || 0);
            const finalAmount = totalAmount + taxAmount + shippingCost - discountAmount;
            await connection('inv_purchase_orders')
                .where('id', orderId)
                .update({
                total_amount: totalAmount,
                final_amount: finalAmount,
                updated_at: connection.fn.now()
            });
        }
    }
    async syncOrderItems(orderId, payloadItems) {
        const connection = await this.connection;
        // Get existing items
        const existingItems = await connection('inv_purchase_order_items')
            .where('order_id', orderId)
            .select('id', 'inventory_item_id', 'quantity_ordered');
        const existingItemMap = new Map(existingItems.map(item => [item.inventory_item_id, item]));
        // Validate all payload items exist in inventory
        const itemIds = payloadItems.map(item => item.inventory_item_id);
        const inventoryItems = await connection('inv_inventory_items')
            .select('id', 'name', 'sku', 'description', 'unit')
            .whereIn('id', itemIds)
            .where('is_active', true);
        const inventoryItemMap = new Map(inventoryItems.map(item => [item.id, item]));
        // Validate all items exist
        const missingItems = itemIds.filter(id => !inventoryItemMap.has(id));
        if (missingItems.length > 0) {
            throw new Error(`Inventory items not found: ${missingItems.join(', ')}`);
        }
        // Process items
        const itemsToDelete = [];
        const itemsToUpdate = [];
        const itemsToAdd = [];
        // Find items to delete (existing items not in payload)
        for (const existingItem of existingItems) {
            const payloadItem = payloadItems.find(item => item.inventory_item_id === existingItem.inventory_item_id);
            if (!payloadItem) {
                itemsToDelete.push(existingItem.id);
            }
            else if (payloadItem.quantity_ordered !== existingItem.quantity_ordered) {
                itemsToUpdate.push({
                    id: existingItem.id,
                    quantity_ordered: payloadItem.quantity_ordered
                });
            }
        }
        // Find items to add (payload items not in existing)
        for (const payloadItem of payloadItems) {
            if (!existingItemMap.has(payloadItem.inventory_item_id)) {
                const inventoryItem = inventoryItemMap.get(payloadItem.inventory_item_id);
                itemsToAdd.push({
                    inventory_item_id: payloadItem.inventory_item_id,
                    item_name: inventoryItem.name,
                    item_description: inventoryItem.description,
                    sku: inventoryItem.sku,
                    unit: inventoryItem.unit,
                    quantity_ordered: payloadItem.quantity_ordered
                });
            }
        }
        // Delete items not in payload
        if (itemsToDelete.length > 0) {
            await connection('inv_purchase_order_items')
                .whereIn('id', itemsToDelete)
                .del();
        }
        // Update existing items with changed quantities
        for (const item of itemsToUpdate) {
            await connection('inv_purchase_order_items')
                .where('id', item.id)
                .update({
                quantity_ordered: item.quantity_ordered,
                line_total: connection.raw('quantity_ordered * unit_price * (1 + tax_rate / 100) * (1 - discount_rate / 100)'),
                updated_at: connection.fn.now()
            });
        }
        // Add new items
        if (itemsToAdd.length > 0) {
            const newItems = itemsToAdd.map(item => ({
                id: `POI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                order_id: orderId,
                inventory_item_id: item.inventory_item_id,
                item_name: item.item_name,
                item_description: item.item_description,
                sku: item.sku,
                quantity_ordered: item.quantity_ordered,
                quantity_received: 0,
                quantity_rejected: 0,
                unit_price: 0, // Default to 0, can be updated later
                tax_rate: 0,
                discount_rate: 0,
                line_total: 0, // Will be calculated by trigger or manually
                unit: item.unit,
                status: 'pending',
                created_at: connection.fn.now(),
                updated_at: connection.fn.now()
            }));
            await connection('inv_purchase_order_items').insert(newItems);
        }
        // Recalculate order totals
        await this.recalculateOrderTotals(orderId);
    }
}
exports.PurchaseOrderModel = PurchaseOrderModel;
