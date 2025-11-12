import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     await knex.schema.alterTable('inv_inventory_transactions', (table) => {
          table.integer('testid');
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.alterTable('inv_inventory_transactions', (table) => {
          table.dropColumn('testid');
     });
}