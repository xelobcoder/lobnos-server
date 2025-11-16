import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     await knex.schema.createTable('inv_consumption_history', (table) => {
          table.string('id', 50).primary();
          table.string('item_id', 50).notNullable();
          table.integer('quantity_consumed').notNullable();
          table.string('consumed_by', 100);
          table.timestamp('consumption_date').defaultTo(knex.fn.now());
          table.string('batch_number', 100);
          table.string('brand_name', 255);
          table.decimal('unit_cost', 10, 2);
          table.decimal('total_cost', 12, 2);
          table.string('consumption_reason', 255);
          table.string('department', 100);
          table.string('patient_id', 50);
          table.string('prescription_id', 50);
          table.text('notes');
          table.string('approved_by', 100);
          table.timestamp('created_at').defaultTo(knex.fn.now());
          table.timestamp('updated_at').defaultTo(knex.fn.now());

          table.foreign('item_id').references('id').inTable('inv_inventory_items');
          table.index(['consumption_date', 'item_id']);
          table.index(['consumed_by', 'consumption_date']);
          table.index('batch_number');
          table.index('consumption_reason');
          table.index('department');
          table.index('patient_id');
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTable('inv_consumption_history');
}