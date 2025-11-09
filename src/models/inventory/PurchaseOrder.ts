import { Knex } from 'knex';
import {
     PurchaseOrder,
     CreatePurchaseOrderRequest,
     UpdatePurchaseOrderRequest,
     PurchaseOrderListResponse,
     PurchaseOrderFilters,
     PurchaseOrderItem
} from './types';
import KnexConnection from '../../database/KnexConnections';

export class PurchaseOrderModel {
     private connection: Promise<Knex<any, any[]>>;

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     private generateOrderId(): string {
          const timestamp = Date.now().toString();
          return `ORD-${timestamp}`;
     }

     private generateOrderNumber(): string {
          // Generate order number in format: ORD-202411-0001
          const year = new Date().getFullYear();
          const month = String(new Date().getMonth() + 1).padStart(2, '0');
          // For simplicity, using timestamp-based sequence
          const sequence = Date.now().toString().slice(-4);
          return `ORD-${year}${month}-${sequence}`;
     }

     async create(request: CreatePurchaseOrderRequest, createdBy: string): Promise<PurchaseOrder> {
          const connection = await this.connection;

          // Validate supplier exists
          const supplier = await connection('inv_suppliers')
               .where('id', request.supplier_id)
               .where('is_active', true)
               .first();

          if (!supplier) {
               throw new Error('Supplier not found or inactive');
          }

          const orderNumber = this.generateOrderNumber();
          const orderDate = request.order_date || new Date().toISOString().split('T')[0];

          // Calculate total amount from items
          const totalAmount = request.items.reduce((sum, item) => sum + (item.quantity_ordered * item.unit_price), 0);

          const orderData = {
               id: this.generateOrderId(),
               order_number: orderNumber,
               supplier_id: request.supplier_id,
               order_date: orderDate,
               expected_delivery_date: request.expected_delivery_date || null,
               status: 'draft',
               total_amount: totalAmount,
               notes: request.notes || null,
               created_by: createdBy,
               created_at: new Date().toISOString(),
               updated_at: new Date().toISOString()
          };

          await connection('inv_purchase_orders').insert(orderData);

          // Create order items
          const orderItems = request.items.map(item => ({
               id: `POI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
               order_id: orderData.id,
               item_name: item.item_name,
               sku: item.sku || null,
               brand_name: item.brand_name || null,
               quantity_ordered: item.quantity_ordered,
               quantity_received: 0,
               unit_price: item.unit_price,
               total_price: item.quantity_ordered * item.unit_price,
               status: 'pending',
               notes: item.notes || null,
               created_at: new Date().toISOString(),
               updated_at: new Date().toISOString()
          }));

          await connection('inv_purchase_order_items').insert(orderItems);

          return await this.findById(orderData.id) as PurchaseOrder;
     }

     async findById(id: string): Promise<PurchaseOrder | null> {
          const connection = await this.connection;
          const result = await connection('inv_purchase_orders')
               .leftJoin('inv_suppliers', 'inv_purchase_orders.supplier_id', 'inv_suppliers.id')
               .select(
                    'inv_purchase_orders.*',
                    'inv_suppliers.name as supplier_name'
               )
               .where('inv_purchase_orders.id', id)
               .first();

          if (!result) return null;

          // Get items count
          const itemsCount = await connection('inv_purchase_order_items')
               .where('order_id', id)
               .count('* as count')
               .first();

          return {
               id: result.id,
               order_number: result.order_number,
               supplier_id: result.supplier_id,
               order_date: result.order_date,
               expected_delivery_date: result.expected_delivery_date,
               actual_delivery_date: result.actual_delivery_date,
               status: result.status,
               total_amount: result.total_amount,
               notes: result.notes,
               created_by: result.created_by,
               approved_by: result.approved_by,
               created_at: result.created_at,
               updated_at: result.updated_at,
               supplier_name: result.supplier_name,
               items_count: parseInt((itemsCount as any)?.count || 0)
          };
     }

     async findMany(filters: PurchaseOrderFilters): Promise<PurchaseOrderListResponse> {
          const connection = await this.connection;
          const {
               page = 1,
               count = 10,
               sortby = 'DESC',
               supplier_id,
               status,
               startDate,
               endDate,
               search
          } = filters;

          let query = connection('purchase_orders')
               .leftJoin('suppliers', 'purchase_orders.supplier_id', 'suppliers.id')
               .select(
                    'purchase_orders.*',
                    'suppliers.name as supplier_name'
               )
               .orderBy('purchase_orders.created_at', sortby);

          if (supplier_id) {
               query = query.where('purchase_orders.supplier_id', supplier_id);
          }
          if (status) {
               query = query.where('purchase_orders.status', status);
          }
          if (startDate) {
               query = query.where('purchase_orders.order_date', '>=', startDate);
          }
          if (endDate) {
               query = query.where('purchase_orders.order_date', '<=', endDate);
          }
          if (search) {
               query = query.where('purchase_orders.order_number', 'like', `%${search}%`);
          }

          const totalQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
          const totalResult = await totalQuery;
          const total = parseInt((totalResult as any)?.count || 0);

          const offset = (page - 1) * count;
          const rawData = await query.limit(count).offset(offset);

          const orders = await Promise.all(rawData.map(async (result: any) => {
               const itemsCount = await connection('inv_purchase_order_items')
                    .where('order_id', result.id)
                    .count('* as count')
                    .first();

               return {
                    id: result.id,
                    order_number: result.order_number,
                    supplier_id: result.supplier_id,
                    order_date: result.order_date,
                    expected_delivery_date: result.expected_delivery_date,
                    actual_delivery_date: result.actual_delivery_date,
                    status: result.status,
                    total_amount: result.total_amount,
                    notes: result.notes,
                    created_by: result.created_by,
                    approved_by: result.approved_by,
                    created_at: result.created_at,
                    updated_at: result.updated_at,
                    supplier_name: result.supplier_name,
                    items_count: parseInt((itemsCount as any)?.count || 0)
               };
          }));

          return {
               orders,
               total,
               page,
               count,
               totalPages: Math.ceil(total / count)
          };
     }

     async update(id: string, updates: UpdatePurchaseOrderRequest): Promise<PurchaseOrder | null> {
          const connection = await this.connection;

          const currentOrder = await this.findById(id);
          if (!currentOrder) {
               throw new Error('Purchase order not found');
          }

          const updateData: any = {
               updated_at: new Date().toISOString()
          };

          if (updates.supplier_id !== undefined) updateData.supplier_id = updates.supplier_id;
          if (updates.order_date !== undefined) updateData.order_date = updates.order_date;
          if (updates.expected_delivery_date !== undefined) updateData.expected_delivery_date = updates.expected_delivery_date;
          if (updates.actual_delivery_date !== undefined) updateData.actual_delivery_date = updates.actual_delivery_date;
          if (updates.status !== undefined) updateData.status = updates.status;
          if (updates.notes !== undefined) updateData.notes = updates.notes;
          if (updates.approved_by !== undefined) updateData.approved_by = updates.approved_by;

          await connection('inv_purchase_orders')
               .where({ id })
               .update(updateData);

          return await this.findById(id);
     }

     async delete(id: string): Promise<boolean> {
          const connection = await this.connection;

          const result = await connection('inv_purchase_orders')
               .where({ id })
               .del();

          return result > 0;
     }

     async getOrderItems(orderId: string): Promise<PurchaseOrderItem[]> {
          const connection = await this.connection;
          const results = await connection('inv_purchase_order_items')
               .where('order_id', orderId)
               .orderBy('created_at', 'ASC');

          return results.map((result: any) => ({
               id: result.id,
               order_id: result.order_id,
               item_name: result.item_name,
               sku: result.sku,
               brand_name: result.brand_name,
               quantity_ordered: result.quantity_ordered,
               quantity_received: result.quantity_received,
               unit_price: result.unit_price,
               total_price: result.total_price,
               status: result.status,
               notes: result.notes,
               created_at: result.created_at,
               updated_at: result.updated_at
          }));
     }
}