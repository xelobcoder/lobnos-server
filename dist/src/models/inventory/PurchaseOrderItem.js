"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseOrderItemModel = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class PurchaseOrderItemModel {
    constructor(tenantId) {
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(orderId, request) {
        const connection = await this.connection;
        // Validate order exists
        const order = await connection('inv_purchase_orders')
            .where('id', orderId)
            .first();
        if (!order) {
            throw new Error('Purchase order not found');
        }
        const itemData = {
            id: `POI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            order_id: orderId,
            item_name: request.item_name,
            sku: request.sku || null,
            brand_name: request.brand_name || null,
            quantity_ordered: request.quantity,
            quantity_received: 0,
            unit_price: request.unit_price,
            line_total: request.quantity * request.unit_price,
            status: 'pending',
            notes: request.notes || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        await connection('inv_purchase_order_items').insert(itemData);
        return {
            id: itemData.id,
            order_id: itemData.order_id,
            item_name: itemData.item_name,
            sku: itemData.sku,
            brand_name: itemData.brand_name,
            quantity_ordered: itemData.quantity_ordered,
            quantity_received: itemData.quantity_received,
            unit_price: itemData.unit_price,
            line_total: itemData.line_total,
            status: itemData.status,
            notes: itemData.notes,
            created_at: itemData.created_at,
            updated_at: itemData.updated_at
        };
    }
    async findById(id) {
        const connection = await this.connection;
        const result = await connection('inv_purchase_order_items')
            .where('id', id)
            .first();
        if (!result)
            return null;
        return {
            id: result.id,
            order_id: result.order_id,
            item_name: result.item_name,
            sku: result.sku,
            brand_name: result.brand_name,
            quantity_ordered: result.quantity_ordered,
            quantity_received: result.quantity_received,
            unit_price: result.unit_price,
            line_total: result.line_total,
            status: result.status,
            notes: result.notes,
            created_at: result.created_at,
            updated_at: result.updated_at
        };
    }
    async findMany(filters) {
        const connection = await this.connection;
        const { page = 1, count = 10, sortby = 'DESC', order_id, status, search } = filters;
        let query = connection('inv_purchase_order_items')
            .orderBy('created_at', sortby);
        if (order_id) {
            query = query.where('order_id', order_id);
        }
        if (status) {
            query = query.where('status', status);
        }
        if (search) {
            query = query.where('item_name', 'like', `%${search}%`);
        }
        const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
        const totalResult = await totalQuery;
        const total = parseInt((totalResult === null || totalResult === void 0 ? void 0 : totalResult.count) || 0);
        const offset = (page - 1) * count;
        const rawData = await query.limit(count).offset(offset);
        const items = rawData.map((result) => ({
            id: result.id,
            order_id: result.order_id,
            item_name: result.item_name,
            sku: result.sku,
            brand_name: result.brand_name,
            quantity_ordered: result.quantity_ordered,
            quantity_received: result.quantity_received,
            unit_price: result.unit_price,
            line_total: result.line_total,
            status: result.status,
            notes: result.notes,
            created_at: result.created_at,
            updated_at: result.updated_at
        }));
        return {
            items,
            total,
            page,
            count,
            totalPages: Math.ceil(total / count)
        };
    }
    async update(id, updates) {
        const connection = await this.connection;
        const currentItem = await this.findById(id);
        if (!currentItem) {
            throw new Error('Purchase order item not found');
        }
        const updateData = {
            updated_at: new Date().toISOString()
        };
        if (updates.quantity_ordered !== undefined) {
            updateData.quantity_ordered = updates.quantity_ordered;
            updateData.line_total = updates.quantity_ordered * currentItem.unit_price;
        }
        if (updates.unit_price !== undefined) {
            updateData.unit_price = updates.unit_price;
            updateData.line_total = currentItem.quantity_ordered * updates.unit_price;
        }
        if (updates.notes !== undefined)
            updateData.notes = updates.notes;
        await connection('inv_purchase_order_items')
            .where({ id })
            .update(updateData);
        return await this.findById(id);
    }
    async delete(id) {
        const connection = await this.connection;
        const result = await connection('inv_purchase_order_items')
            .where({ id })
            .del();
        return result > 0;
    }
    async receiveItem(id, quantityReceived, receivedBy) {
        const connection = await this.connection;
        const item = await this.findById(id);
        if (!item) {
            throw new Error('Purchase order item not found');
        }
        if (quantityReceived < 0) {
            throw new Error('Received quantity cannot be negative');
        }
        if (quantityReceived > item.quantity_ordered - item.quantity_received) {
            throw new Error('Cannot receive more than ordered quantity');
        }
        const newReceivedQuantity = item.quantity_received + quantityReceived;
        const newStatus = newReceivedQuantity >= item.quantity_ordered ? 'received' : 'partially_received';
        await connection('inv_purchase_order_items')
            .where({ id })
            .update({
            quantity_received: newReceivedQuantity,
            status: newStatus,
            updated_at: new Date().toISOString()
        });
        // If item is fully received, check if we should update inventory
        if (newStatus === 'received') {
            // This would typically trigger inventory updates, but we'll handle that in the service layer
        }
        return await this.findById(id);
    }
    async getItemsByOrder(orderId) {
        const connection = await this.connection;
        const results = await connection('inv_purchase_order_items')
            .where('order_id', orderId)
            .orderBy('created_at', 'ASC');
        return results.map((result) => ({
            id: result.id,
            order_id: result.order_id,
            item_name: result.item_name,
            sku: result.sku,
            brand_name: result.brand_name,
            quantity_ordered: result.quantity_ordered,
            quantity_received: result.quantity_received,
            unit_price: result.unit_price,
            line_total: result.line_total,
            status: result.status,
            notes: result.notes,
            created_at: result.created_at,
            updated_at: result.updated_at
        }));
    }
}
exports.PurchaseOrderItemModel = PurchaseOrderItemModel;
