import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     await knex.schema.createTable('inv_purchase_order_items', (table) => {
          table.string('id', 50).primary();
          table.string('order_id', 50).notNullable();
          table.string('inventory_item_id', 50);
          table.integer('quantity_ordered').notNullable();
          table.integer('quantity_received').defaultTo(0);
          table.decimal('unit_price', 10, 2).notNullable();
          table.decimal('tax_rate', 5, 2).defaultTo(0.00);
          table.decimal('discount_rate', 5, 2).defaultTo(0.00);
          table.decimal('line_total', 12, 2).notNullable();
          table.enum('status', ['pending', 'partially_received', 'received', 'cancelled']).defaultTo('pending');
          table.text('notes');
          table.timestamp('created_at').defaultTo(knex.fn.now());
          table.timestamp('updated_at').defaultTo(knex.fn.now());

          table.foreign('order_id').references('id').inTable('inv_purchase_orders').onDelete('CASCADE');
          table.foreign('inventory_item_id').references('id').inTable('inv_inventory_items');
          table.index(['order_id', 'inventory_item_id', 'status']);
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTable('inv_purchase_order_items');
}