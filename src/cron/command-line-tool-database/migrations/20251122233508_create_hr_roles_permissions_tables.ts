import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     await knex.schema.createTable('roles', (table) => {
          table.increments('employeeid').primary();
          table.string('username', 255).notNullable().unique();
          table.enum('role', [
               'scientist',
               'sonographer',
               'admin',
               'manager',
               'phelobotomist',
               'customer service representative',
               "super-admin"
          ]).notNullable();
          table.string('password', 255).notNullable();
          table.integer('pin', 4).defaultTo(0);
          table.date('date_created').defaultTo(knex.fn.now());
          table.time('time').defaultTo(knex.raw('CURRENT_TIME(6)'));
          table.string('refresh_token', 255).nullable();
          table.tinyint('activation').notNullable().defaultTo(0);
          table.string('email', 200).notNullable();
          table.text('permissions').notNullable().defaultTo('{}');
          table.datetime('updated_on', { precision: 6 }).nullable();
          table.string('emailAuthenticated', 6).notNullable().defaultTo('false');
          table.integer('branch').nullable();
          table.string('mobile', 10).notNullable();
          table.string('alternativeMobile', 10).nullable();
          table.date('dob').nullable();
     });
}
export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTableIfExists('roles');
}