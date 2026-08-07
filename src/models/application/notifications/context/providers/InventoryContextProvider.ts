import KnexConnection from '../../../../../database/KnexConnections';
import { NotificationContextProvider } from './NotificationContextProvider';

export class InventoryContextProvider implements NotificationContextProvider {
     private connection;

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async getContext(referenceId?: number | string): Promise<Record<string, unknown>> {
          if (!referenceId) throw new Error('Inventory reference is required');

          const connection = await this.connection;
          const row = await connection('inv_inventory_items as i')
               .leftJoin('inv_categories as c', 'c.id', 'i.category_id')
               .leftJoin('inv_storage_locations as l', 'l.id', 'i.location_id')
               .leftJoin('inv_units as u', 'u.id', 'i.consumption_unit')
               .select(
                    'i.id as inventory_item_id',
                    'i.name as item_name',
                    'i.sku as item_sku',
                    'i.current_stock',
                    'i.min_stock',
                    'i.max_stock',
                    'i.status as stock_status',
                    'c.name as category_name',
                    'l.name as location_name',
                    'u.name as unit_name',
               )
               .where('i.id', String(referenceId))
               .first();

          if (!row) throw new Error('Inventory item not found');

          return row;
     }
}
