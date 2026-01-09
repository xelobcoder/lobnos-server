import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     await knex.schema.alterTable('salessessionmanager', (table) => {
          table.time('start_time').nullable();
          table.time('end_time').nullable();
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.alterTable('salessessionmanager', (table) => {
          table.dropColumn('start_time');
          table.dropColumn('end_time');
     });
}