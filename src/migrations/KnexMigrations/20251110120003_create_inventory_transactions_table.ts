import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     await knex.schema.createTable('inv_inventory_transactions', (table) => {
          table.string('id', 50).primary();
          table.string('item_id', 50).notNullable();
          table.enum('transaction_type', ['addition', 'consumption', 'adjustment', 'transfer']).notNullable();
          table.integer('quantity').notNullable();
          table.integer('previous_stock').notNullable();
          table.integer('new_stock').notNullable();
          table.string('batch_number', 100);
          table.date('expiry_date');
          table.decimal('unit_cost', 10, 2);
          table.decimal('total_cost', 12, 2);
          table.string('brand_name', 255);
          table.string('reason', 255);
          table.string('reference_id', 50);
          table.string('performed_by', 100);
          table.timestamp('transaction_date').defaultTo(knex.fn.now());
          table.text('notes');
          table.timestamp('created_at').defaultTo(knex.fn.now());

          table.foreign('item_id').references('id').inTable('inv_inventory_items');
          table.index(['item_id', 'transaction_type', 'transaction_date', 'batch_number', 'reference_id']);
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTable('inv_inventory_transactions');
}