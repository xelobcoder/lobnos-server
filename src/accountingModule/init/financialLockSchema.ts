import type { Knex } from 'knex';

export async function ensureFinancialLockSchema(db: Knex): Promise<void> {
     if (!(await db.schema.hasTable('financial_lock_settings'))) {
          await db.schema.createTable('financial_lock_settings', table => {
               table.integer('branchid').unsigned().primary();
               table.boolean('enabled').notNullable().defaultTo(false);
               table.integer('grace_hours').unsigned().notNullable().defaultTo(48);
               table.integer('updated_by').unsigned().nullable();
               table.datetime('updated_at').notNullable().defaultTo(db.fn.now());
          });
     }
     if (!(await db.schema.hasTable('financial_historical_locks'))) {
          await db.schema.createTable('financial_historical_locks', table => {
               table.increments('id').primary();
               table.integer('branchid').unsigned().notNullable();
               table.date('start_date').notNullable();
               table.date('end_date').notNullable();
               table.string('reason', 1000).notNullable();
               table.integer('created_by').unsigned().notNullable();
               table.datetime('created_at').notNullable().defaultTo(db.fn.now());
               table.index(['branchid', 'start_date', 'end_date']);
          });
     }
}
