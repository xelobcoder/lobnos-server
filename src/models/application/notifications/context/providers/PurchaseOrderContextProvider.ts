import KnexConnection from '../../../../../database/KnexConnections';
import { NotificationContextProvider } from './NotificationContextProvider';

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

          return row;
     }
}
