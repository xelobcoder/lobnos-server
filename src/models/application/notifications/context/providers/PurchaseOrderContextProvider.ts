import KnexConnection from '../../../../../database/KnexConnections';
import { NotificationContextProvider } from './NotificationContextProvider';
import { EventDefinition } from './NotificationEventDefinitions';
import { buildEventDefinitionFromCatalog } from './NotificationEventCatalog';

export class PurchaseOrderContextProvider implements NotificationContextProvider {
     private connection;

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async getContext(referenceId?: number | string): Promise<Record<string, unknown>> {
          if (!referenceId) throw new Error('Purchase order reference is required');

          const connection = await this.connection;
          const row = await connection('inv_purchase_orders as po')
               .leftJoin('inv_suppliers as s', 's.id', 'po.supplier_id')
               .select(
                    'po.id as purchase_order_id',
                    'po.order_number',
                    'po.supplier_id',
                    'po.order_date',
                    'po.expected_delivery_date',
                    'po.status as purchase_order_status',
                    'po.total_amount as purchase_order_total',
                    's.name as supplier_name',
                    's.email as supplier_email',
                    's.phone as supplier_phone',
                    's.contact as supplier_contact',
               )
               .where('po.id', String(referenceId))
               .orWhere('po.order_number', String(referenceId))
               .first();

          if (!row) throw new Error('Purchase order not found');

          const items = await connection('inv_purchase_order_items as poi')
               .leftJoin('inv_inventory_items as ii', 'ii.id', 'poi.inventory_item_id')
               .select(
                    'poi.inventory_item_id',
                    'ii.name as item_name',
                    'ii.sku as item_sku',
                    'poi.quantity_ordered',
                    'poi.quantity_received',
                    'poi.unit_price',
                    'poi.line_total',
                    'poi.status',
               )
               .where('poi.order_id', row.purchase_order_id)
               .orderBy('poi.created_at', 'asc');

          const purchase_order_items_text = items.length > 0
               ? items.map((item: any, index: number) => {
                    const unitPrice = Number(item.unit_price || 0).toFixed(2);
                    const lineTotal = Number(item.line_total || 0).toFixed(2);
                    return `${index + 1}. ${item.item_name || item.inventory_item_id} | Qty Ordered: ${item.quantity_ordered} | Unit Price: ${unitPrice} | Line Total: ${lineTotal}`;
               }).join('\n')
               : 'No items attached to this purchase order.';

          const purchase_order_items_html = items.length > 0
               ? items.map((item: any, index: number) => {
                    const unitPrice = Number(item.unit_price || 0).toFixed(2);
                    const lineTotal = Number(item.line_total || 0).toFixed(2);
                    return `<tr><td style="padding:8px;border:1px solid #d9e2ec;">${index + 1}</td><td style="padding:8px;border:1px solid #d9e2ec;">${item.item_name || item.inventory_item_id}</td><td style="padding:8px;border:1px solid #d9e2ec;">${item.item_sku || ''}</td><td style="padding:8px;border:1px solid #d9e2ec;">${item.quantity_ordered}</td><td style="padding:8px;border:1px solid #d9e2ec;">${unitPrice}</td><td style="padding:8px;border:1px solid #d9e2ec;">${lineTotal}</td></tr>`;
               }).join('')
               : '<tr><td colspan="6" style="padding:8px;border:1px solid #d9e2ec;">No items attached to this purchase order.</td></tr>';

          return {
               ...row,
               purchase_order_items_text,
               purchase_order_items_html,
               purchase_order_items_count: items.length,
          };
     }

     supportsEvent(eventCode: string): boolean {
          return eventCode.startsWith('PURCHASE_ORDER_');
     }

     getEventDefinition(eventCode: string): EventDefinition | null {
          if (!this.supportsEvent(eventCode)) return null;
          return buildEventDefinitionFromCatalog(eventCode) ?? null;
     }
}
