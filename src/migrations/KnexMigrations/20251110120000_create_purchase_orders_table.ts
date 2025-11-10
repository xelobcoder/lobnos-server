import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     await knex.schema.createTable('inv_purchase_orders', (table) => {
          table.string('id', 50).primary();
          table.string('order_number', 100).notNullable().unique();
          table.string('supplier_id', 50).notNullable();
          table.date('order_date').notNullable();
          table.date('expected_delivery_date');
          table.enum('status', ['ordered', 'partially_received', 'received', 'cancelled']).defaultTo('ordered');
          table.decimal('total_amount', 12, 2).defaultTo(0.00);
          table.text('notes');
          table.string('created_by', 100);
          table.timestamp('created_at').defaultTo(knex.fn.now());
          table.timestamp('updated_at').defaultTo(knex.fn.now());

          table.foreign('supplier_id').references('id').inTable('inv_suppliers');
          table.index(['order_number', 'supplier_id', 'status', 'order_date']);
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTable('inv_purchase_orders');
}