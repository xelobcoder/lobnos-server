import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     await knex.schema.alterTable('inv_purchase_order_receipts', (table) => {
          table.timestamp('updated_at').defaultTo(knex.fn.now()).alter();
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.alterTable('inv_purchase_order_receipts', (table) => {
          table.dropColumn('updated_at');
     });
}