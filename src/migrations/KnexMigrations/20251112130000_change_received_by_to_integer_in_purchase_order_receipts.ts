import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     await knex.schema.alterTable('inv_purchase_order_receipts', (table) => {
          table.dropColumn('received_by');
     });

     await knex.schema.alterTable('inv_purchase_order_receipts', (table) => {
          table.integer('received_by');
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.alterTable('inv_purchase_order_receipts', (table) => {
          table.dropColumn('received_by');
     });

     await knex.schema.alterTable('inv_purchase_order_receipts', (table) => {
          table.string('received_by', 100);
     });
}