import KnexConnection from '../../database/KnexConnections';

export async function bootstrapPharmacyTables(tenantId = 1): Promise<void> {
     const connection = await KnexConnection(tenantId);

     if (!await connection.schema.hasColumn('inv_inventory_items', 'sale_price')) {
          await connection.schema.alterTable('inv_inventory_items', (table) => {
               table.decimal('sale_price', 14, 2).notNullable().defaultTo(0);
          });
     }

     if (!await connection.schema.hasTable('pharmacy_sales')) {
          await connection.schema.createTable('pharmacy_sales', (table) => {
               table.string('id', 36).primary();
               table.string('receipt_number', 64).notNullable().unique();
               table.string('idempotency_key', 128).notNullable().unique();
               table.string('customer_name', 255).notNullable();
               table.integer('patient_id').unsigned().nullable();
               table.string('payment_method', 32).notNullable();
               table.string('payment_reference', 128).nullable();
               table.decimal('total_amount', 14, 2).notNullable();
               table.integer('cashier_id').unsigned().notNullable();
               table.string('status', 32).notNullable();
               table.timestamp('completed_at').nullable();
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.index(['completed_at', 'status'], 'idx_pharmacy_sales_completed');
          });
     }

     if (!await connection.schema.hasTable('pharmacy_sale_lines')) {
          await connection.schema.createTable('pharmacy_sale_lines', (table) => {
               table.string('id', 36).primary();
               table.string('sale_id', 36).notNullable();
               table.string('inventory_item_id', 64).notNullable();
               table.string('item_name_snapshot', 255).notNullable();
               table.string('sku_snapshot', 128).notNullable();
               table.decimal('quantity', 14, 3).notNullable();
               table.decimal('unit_price', 14, 2).notNullable();
               table.decimal('line_total', 14, 2).notNullable();
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.index(['sale_id'], 'idx_pharmacy_sale_lines_sale');
          });
     }
}