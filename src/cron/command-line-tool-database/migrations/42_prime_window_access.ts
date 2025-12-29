import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     await knex.schema.createTable('prime_window_access', (table) => {
          table.increments('id').unsigned().primary();
          table.text('start_period').notNullable();
          table.text('end_period').notNullable();
          table.integer('window_days').unsigned().defaultTo(3);
          table.boolean('islicensedRenewed').defaultTo(false);
          table.integer('loginDurationPerUser').unsigned().defaultTo(6);
          table.timestamps(true, true);
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTable('prime_window_access');
}