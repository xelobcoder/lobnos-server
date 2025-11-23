import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     return knex.schema.createTable('branch', (table) => {
          table.increments('branchid').primary();
          table.string('name', 255).notNullable();
          table.date('date').notNullable().defaultTo(knex.fn.now());
          table.tinyint('activation').notNullable().defaultTo(0);
          table.string('address', 200).nullable();
          table.string('email', 100).nullable();
          table.integer('contact').notNullable();
          table.string('managerid', 10).notNullable();
     });
}

export async function down(knex: Knex): Promise<void> {
     return knex.schema.dropTableIfExists('branch');
}