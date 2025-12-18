import { Knex } from 'knex';
import {
     PurchaseOrderItem,
     CreatePurchaseOrderItemRequest,
     UpdatePurchaseOrderItemRequest,
     PurchaseOrderItemListResponse
} from './types';
import KnexConnection from '../../database/KnexConnections';

export class PurchaseOrderItemModel {
     private connection: Promise<Knex<any, any[]>>;

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     private calculateLineTotal(unitPrice: number, quantity: number, taxRate: number = 0, discountRate: number = 0): number {
          const subtotal = unitPrice * quantity;
          const taxAmount = subtotal * (taxRate / 100);
          const discountAmount = subtotal * (discountRate / 100);
          return subtotal + taxAmount - discountAmount;
     }

     async create(orderId: string, request: CreatePurchaseOrderItemRequest): Promise<PurchaseOrderItem> {
          const connection = await this.connection;

          // Validate order exists
          const order = await connection('inv_purchase_orders')
               .where('id', orderId)
               .first();

          if (!order) {
               throw new Error('Purchase order not found');
          }

          // Validate inventory item exists and is active
          const inventoryItem = await connection('inv_inventory_items')
               .where('id', request.inventory_item_id)
               .where('is_active', true)
               .first();

          if (!inventoryItem) {
               throw new Error('Inventory item not found or inactive');
          }

          // Check if item already exists in order
          const existingItem = await connection('inv_purchase_order_items')
               .where('order_id', orderId)
               .where('inventory_item_id', request.inventory_item_id)
               .first();

          if (existingItem) {
               throw new Error('Item already exists in this purchase order');
          }

          const lineTotal = this.calculateLineTotal(
               request.unit_price,
               request.quantity_ordered,
               request.tax_rate || 0,
               request.discount_rate || 0
          );

          const itemData = {
               id: `POI-${Date.now()}`,
               order_id: orderId,
               inventory_item_id: request.inventory_item_id,
               quantity_ordered: request.quantity_ordered,
               quantity_received: 0,
               unit_price: request.unit_price,
               tax_rate: request.tax_rate || 0,
               discount_rate: request.discount_rate || 0,
               line_total: lineTotal,
               status: 'pending' as const,
               notes: request.notes || null,
               created_at: new Date().toISOString(),
               updated_at: new Date().toISOString()
          };

          await connection('inv_purchase_order_items').insert(itemData);

          // Update order total
          await this.updateOrderTotal(orderId);

          return await this.findById(itemData.id) as PurchaseOrderItem;
     }

     async findById(id: string): Promise<PurchaseOrderItem | null> {
          const connection = await this.connection;

          const result = await connection('inv_purchase_order_items')
               .leftJoin('inv_inventory_items', 'inv_purchase_order_items.inventory_item_id', 'inv_inventory_items.id')
               .select(
                    'inv_purchase_order_items.*',
                    'inv_inventory_items.name as item_name',
                    'inv_inventory_items.sku as item_sku',
                    'inv_inventory_items.consumption_unit'
               )
               .where('inv_purchase_order_items.id', id)
               .first();

          if (!result) return null;

          return {
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
          };
     }

     async findByOrderId(orderId: string): Promise<PurchaseOrderItem[]> {
          const connection = await this.connection;

          const results = await connection('inv_purchase_order_items')
               .leftJoin('inv_inventory_items', 'inv_purchase_order_items.inventory_item_id', 'inv_inventory_items.id')
               .select(
                    'inv_purchase_order_items.*',
                    'inv_inventory_items.name as item_name',
                    'inv_inventory_items.sku as item_sku',
                    'inv_inventory_items.consumption_unit'
               )
               .where('inv_purchase_order_items.order_id', orderId)
               .orderBy('inv_purchase_order_items.created_at', 'ASC');

          return results.map((result: any) => ({
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

     async update(id: string, updates: UpdatePurchaseOrderItemRequest): Promise<PurchaseOrderItem | null> {
          const connection = await this.connection;

          const currentItem = await this.findById(id);
          if (!currentItem) {
               throw new Error('Purchase order item not found');
          }

          // Check if order is still editable
          const order = await connection('inv_purchase_orders')
               .where('id', currentItem.order_id)
               .first();

          if (order.status === 'received' || order.status === 'cancelled') {
               throw new Error('Cannot update item in a received or cancelled order');
          }

          const updateData: any = {
               updated_at: new Date().toISOString()
          };

          if (updates.quantity_ordered !== undefined) updateData.quantity_ordered = updates.quantity_ordered;
          if (updates.unit_price !== undefined) updateData.unit_price = updates.unit_price;
          if (updates.tax_rate !== undefined) updateData.tax_rate = updates.tax_rate;
          if (updates.discount_rate !== undefined) updateData.discount_rate = updates.discount_rate;
          if (updates.notes !== undefined) updateData.notes = updates.notes;

          if (updates.unit_price !== undefined || updates.quantity_ordered !== undefined ||
               updates.tax_rate !== undefined || updates.discount_rate !== undefined) {
               const unitPrice = updates.unit_price !== undefined ? updates.unit_price : currentItem.unit_price;
               const quantity = updates.quantity_ordered !== undefined ? updates.quantity_ordered : currentItem.quantity_ordered;
               const taxRate = updates.tax_rate !== undefined ? updates.tax_rate : currentItem.tax_rate;
               const discountRate = updates.discount_rate !== undefined ? updates.discount_rate : currentItem.discount_rate;

               updateData.line_total = this.calculateLineTotal(unitPrice, quantity, taxRate, discountRate);
          }

          await connection('inv_purchase_order_items')
               .where({ id })
               .update(updateData);

          // Update order total
          await this.updateOrderTotal(currentItem.order_id);

          return await this.findById(id);
     }

     async updateReceivedQuantity(id: string, quantityReceived: number): Promise<PurchaseOrderItem | null> {
          const connection = await this.connection;

          const currentItem = await this.findById(id);
          if (!currentItem) {
               throw new Error('Purchase order item not found');
          }

          if (quantityReceived < 0) {
               throw new Error('Received quantity cannot be negative');
          }

          if (quantityReceived > currentItem.quantity_ordered - currentItem.quantity_received) {
               throw new Error('Received quantity exceeds remaining ordered quantity');
          }

          const newTotalReceived = currentItem.quantity_received + quantityReceived;

          let newStatus: string;
          if (newTotalReceived === 0) {
               newStatus = 'pending';
          } else if (newTotalReceived >= currentItem.quantity_ordered) {
               newStatus = 'received';
          } else {
               newStatus = 'partially_received';
          }

          await connection('inv_purchase_order_items')
               .where({ id })
               .update({
                    quantity_received: newTotalReceived,
                    status: newStatus,
                    updated_at: new Date().toISOString()
               });

          return await this.findById(id);
     }

     async cancel(id: string): Promise<PurchaseOrderItem | null> {
          const connection = await this.connection;

          const currentItem = await this.findById(id);
          if (!currentItem) {
               throw new Error('Purchase order item not found');
          }

          if (currentItem.status === 'received') {
               throw new Error('Cannot cancel a received item');
          }

          await connection('inv_purchase_order_items')
               .where({ id })
               .update({
                    status: 'cancelled',
                    updated_at: new Date().toISOString()
               });

          return await this.findById(id);
     }

     async delete(id: string): Promise<boolean> {
          const connection = await this.connection;

          const currentItem = await this.findById(id);
          if (!currentItem) {
               return false;
          }

          // Check if order is still editable
          const order = await connection('inv_purchase_orders')
               .where('id', currentItem.order_id)
               .first();

          if (order.status === 'received' || order.status === 'cancelled') {
               throw new Error('Cannot delete item from a received or cancelled order');
          }

          const result = await connection('inv_purchase_order_items')
               .where({ id })
               .del();

          if (result > 0) {
               await this.updateOrderTotal(currentItem.order_id);
          }

          return result > 0;
     }

     private async updateOrderTotal(orderId: string): Promise<void> {
          const connection = await this.connection;

          const result = await connection('inv_purchase_order_items')
               .where('order_id', orderId)
               .where('status', '!=', 'cancelled')
               .sum('line_total as total')
               .first();

          const newTotal = parseFloat(result?.total || 0);

          await connection('inv_purchase_orders')
               .where('id', orderId)
               .update({
                    total_amount: newTotal,
                    updated_at: new Date().toISOString()
               });
     }
}