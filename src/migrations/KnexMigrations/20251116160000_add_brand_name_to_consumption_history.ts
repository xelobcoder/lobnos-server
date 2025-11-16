import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     await knex.schema.alterTable('inv_consumption_history', (table) => {
          table.string('brand_name', 255);
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.alterTable('inv_consumption_history', (table) => {
          table.dropColumn('brand_name');
     });
}