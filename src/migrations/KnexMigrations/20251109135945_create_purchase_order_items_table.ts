import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
     await knex.schema.createTable('inv_purchase_order_items', (table) => {
          table.string('id', 50).primary();
          table.string('order_id', 50).notNullable().references('id').inTable('inv_purchase_orders').onDelete('CASCADE').comment('Reference to purchase order');
          table.string('item_name', 255).notNullable().comment('Item name at time of order');
          table.string('sku', 100).comment('SKU at time of order');
          table.string('brand_name', 255).comment('Brand name at time of order');
          table.integer('quantity_ordered').notNullable().comment('Total quantity ordered');
          table.integer('quantity_received').defaultTo(0).comment('Quantity received so far');
          table.decimal('unit_price', 10, 2).notNullable().comment('Price per unit');
          table.decimal('total_price', 12, 2).notNullable().comment('Computed: quantity_ordered * unit_price');
          table.enum('status', ['pending', 'partially_received', 'received', 'cancelled']).defaultTo('pending');
          table.text('notes').comment('Line item notes');
          table.timestamp('created_at').defaultTo(knex.fn.now());
          table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

          // Indexes
          table.index('order_id', 'idx_inv_order_item_order');
          table.index('sku', 'idx_inv_order_item_sku');
          table.index('status', 'idx_inv_order_item_status');
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTable('inv_purchase_order_items');
}