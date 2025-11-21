import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // Drop the mode column from expensesrecord table
     await knex.schema.alterTable('expensesrecord', (table) => {
          table.dropColumn('mode');
     });
}

export async function down(knex: Knex): Promise<void> {
     // Add back the mode column (for rollback)
     await knex.schema.alterTable('expensesrecord', (table) => {
          table.integer('mode').nullable();
     });
}