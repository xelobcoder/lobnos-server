import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     if (!(await knex.schema.hasTable('sales_session_config'))) {
          await knex.schema.createTable('sales_session_config', (table) => {
               table.increments('id').primary();
               table.integer('branchid').notNullable();
               table.boolean('allow_multiple_sessions').notNullable().defaultTo(false);
               table.integer('session_count').nullable();
               table.time('start_time').nullable();
               table.time('end_time').nullable();
               table.json('time_ranges').nullable();
               table.timestamp('created_at').defaultTo(knex.fn.now());
               table.timestamp('updated_at').defaultTo(knex.fn.now());
               table.index('branchid');
          });
     }
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTableIfExists('sales_session_config');
}