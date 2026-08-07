import KnexConnection from '../../../../../database/KnexConnections';
import { NotificationContextProvider } from './NotificationContextProvider';
import { buildEventDefinitionFromCatalog } from './NotificationEventCatalog';
import { EventDefinition } from './NotificationEventDefinitions';

export class PurchaseOrderContextProvider implements NotificationContextProvider {
     private connection;

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     private formatMoney(value: unknown): string {
          const amount = Number(value || 0);
          if (!Number.isFinite(amount)) return 'GHS 0.00';
          try {
               return new Intl.NumberFormat('en-GH', {
                    style: 'currency',
                    currency: 'GHS',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
               }).format(amount);
          } catch (_error) {
               return `GHS ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          }
     }

     private escapeHtml(value: unknown): string {
          const text = String(value ?? '');
          return text
               .replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&#39;');
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
                    const unitPrice = this.formatMoney(item.unit_price);
                    const lineTotal = this.formatMoney(item.line_total);
                    const itemName = item.item_name || item.inventory_item_id;
                    return `${index + 1}. ${itemName} | Quantity: ${item.quantity_ordered} | Unit Price: ${unitPrice} | Total Price: ${lineTotal}`;
               }).join('\n')
               : 'No items attached to this purchase order.';

          const purchase_order_items_html = items.length > 0
               ? items.map((item: any, index: number) => {
                    const unitPrice = this.formatMoney(item.unit_price);
                    const lineTotal = this.formatMoney(item.line_total);
                    const itemName = this.escapeHtml(item.item_name || item.inventory_item_id);
                    const itemSku = this.escapeHtml(item.item_sku || '-');
                    const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
                    const border = index === items.length - 1 ? '0' : '1px solid #e2e8f0';
                    return `<tr style="background:${bg};"><td style="padding:12px 12px;border-bottom:${border};color:#64748b;font-size:12px;font-weight:600;">${index + 1}</td><td style="padding:12px 12px;border-bottom:${border};color:#0f172a;font-size:13px;font-weight:600;">${itemName}</td><td style="padding:12px 12px;border-bottom:${border};color:#64748b;font-size:12px;">${itemSku}</td><td align="right" style="padding:12px 12px;border-bottom:${border};color:#0f172a;font-size:13px;font-variant-numeric:tabular-nums;">${item.quantity_ordered}</td><td align="right" style="padding:12px 12px;border-bottom:${border};color:#0f172a;font-size:13px;font-variant-numeric:tabular-nums;">${unitPrice}</td><td align="right" style="padding:12px 12px;border-bottom:${border};color:#0b3a6e;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;">${lineTotal}</td></tr>`;
               }).join('')
               : '<tr><td colspan="6" style="padding:16px 12px;color:#64748b;font-size:13px;background:#f8fafc;">No items attached to this purchase order.</td></tr>';

          const purchase_order_received_items_text = items.length > 0
               ? items.map((item: any, index: number) => {
                    const unitPrice = this.formatMoney(item.unit_price);
                    const lineTotal = this.formatMoney(item.line_total);
                    const receivedQty = Number(item.quantity_received || 0);
                    const itemName = item.item_name || item.inventory_item_id;
                    return `${index + 1}. ${itemName} | Qty Ordered: ${item.quantity_ordered} | Qty Received: ${receivedQty} | Unit Price: ${unitPrice} | Total Price: ${lineTotal}`;
               }).join('\n')
               : 'No items attached to this purchase order.';

          const purchase_order_received_items_html = items.length > 0
               ? items.map((item: any, index: number) => {
                    const unitPrice = this.formatMoney(item.unit_price);
                    const lineTotal = this.formatMoney(item.line_total);
                    const receivedQty = Number(item.quantity_received || 0);
                    const itemName = this.escapeHtml(item.item_name || item.inventory_item_id);
                    const itemSku = this.escapeHtml(item.item_sku || '-');
                    const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
                    const border = index === items.length - 1 ? '0' : '1px solid #e2e8f0';
                    return `<tr style="background:${bg};"><td style="padding:12px 12px;border-bottom:${border};color:#64748b;font-size:12px;font-weight:600;">${index + 1}</td><td style="padding:12px 12px;border-bottom:${border};color:#0f172a;font-size:13px;font-weight:600;">${itemName}</td><td style="padding:12px 12px;border-bottom:${border};color:#64748b;font-size:12px;">${itemSku}</td><td align="right" style="padding:12px 12px;border-bottom:${border};color:#0f172a;font-size:13px;font-variant-numeric:tabular-nums;">${item.quantity_ordered}</td><td align="right" style="padding:12px 12px;border-bottom:${border};color:#047857;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;">${receivedQty}</td><td align="right" style="padding:12px 12px;border-bottom:${border};color:#0f172a;font-size:13px;font-variant-numeric:tabular-nums;">${unitPrice}</td><td align="right" style="padding:12px 12px;border-bottom:${border};color:#0b3a6e;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;">${lineTotal}</td></tr>`;
               }).join('')
               : '<tr><td colspan="7" style="padding:16px 12px;color:#64748b;font-size:13px;background:#f8fafc;">No items attached to this purchase order.</td></tr>';

          const subtotal = Number(row.purchase_order_total || 0);
          const tax = 0;
          const total = subtotal + tax;

          return {
               ...row,
               currency_code: 'GHS',
               purchase_order_items_text,
               purchase_order_items_html,
               purchase_order_received_items_text,
               purchase_order_received_items_html,
               purchase_order_items_count: items.length,
               purchase_order_subtotal: this.formatMoney(subtotal),
               purchase_order_tax: this.formatMoney(tax),
               purchase_order_total_formatted: this.formatMoney(total),
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
