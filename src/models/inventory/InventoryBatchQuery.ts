import { Knex } from 'knex';

/** Batch quantities and valuation use consumption units, regardless of how a receipt was entered. */
export function expiredInventoryBatchQuery(connection: Knex) {
     return connection('inv_inventory_transactions as movement')
          .join('inv_inventory_items as item', 'item.id', 'movement.item_id')
          .whereNotNull('movement.batch_number')
          .select(
               'movement.item_id', 'movement.batch_number',
               connection.raw('MAX(item.name) as item_name'),
               connection.raw('MAX(item.sku) as item_sku'),
               connection.raw('MAX(movement.brand_name) as brand_name'),
               connection.raw('MIN(CASE WHEN movement.transaction_type = ? THEN movement.expiry_date END) as expiry_date', ['addition']),
               connection.raw('MAX(item.cost_price) as unit_price'),
               connection.raw('1 as units_per_purchase_unit'),
               connection.raw('SUM(GREATEST(CAST(movement.new_stock AS DECIMAL(20, 6)) - CAST(movement.previous_stock AS DECIMAL(20, 6)), 0)) as total_received'),
               connection.raw('SUM(GREATEST(CAST(movement.previous_stock AS DECIMAL(20, 6)) - CAST(movement.new_stock AS DECIMAL(20, 6)), 0)) as total_consumed'),
               connection.raw('SUM(CAST(movement.new_stock AS DECIMAL(20, 6)) - CAST(movement.previous_stock AS DECIMAL(20, 6))) as available_quantity'),
               connection.raw('MAX(CASE WHEN movement.transaction_type = ? THEN movement.transaction_date END) as last_received', ['addition']),
          )
          .groupBy('movement.item_id', 'movement.batch_number')
          // Filter after aggregation: outflows commonly omit expiry metadata.
          .having('expiry_date', '<', new Date().toISOString().slice(0, 10))
          .havingRaw('SUM(CAST(movement.new_stock AS DECIMAL(20, 6)) - CAST(movement.previous_stock AS DECIMAL(20, 6))) > 0');
}
