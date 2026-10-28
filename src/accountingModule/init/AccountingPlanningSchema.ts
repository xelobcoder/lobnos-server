import type { Knex } from 'knex';
export async function ensureAccountingPlanningSchema(db: Knex): Promise<void> {
 if (!(await db.schema.hasTable('acc_budgets'))) await db.schema.createTable('acc_budgets', table => {
  table.increments('id').primary(); table.string('name',120).notNullable(); table.integer('year').notNullable(); table.integer('branchid').unsigned().notNullable();
  table.string('status',16).notNullable().defaultTo('active'); table.integer('version').notNullable().defaultTo(1); table.integer('created_by').unsigned().notNullable();table.integer('updated_by').unsigned().notNullable();table.datetime('created_at').notNullable().defaultTo(db.fn.now());table.datetime('updated_at').notNullable().defaultTo(db.fn.now());table.index(['branchid','year']);
 });
 if (!(await db.schema.hasTable('acc_budget_lines'))) await db.schema.createTable('acc_budget_lines', table => {
  table.increments('id').primary();table.integer('budget_id').unsigned().notNullable();table.string('account_code',20).notNullable();table.integer('month').notNullable();table.decimal('amount',14,2).notNullable();table.unique(['budget_id','account_code','month']);
 });
 if (!(await db.schema.hasTable('acc_recurring_expenses'))) await db.schema.createTable('acc_recurring_expenses', table => {
  table.increments('id').primary();table.string('name',120).notNullable();table.text('description').nullable();table.integer('branchid').unsigned().notNullable();table.integer('merchant_id').unsigned().notNullable();table.integer('category_id').unsigned().notNullable();table.decimal('amount',14,2).notNullable();table.string('frequency',16).notNullable();table.integer('interval_count').notNullable().defaultTo(1);table.date('start_date').notNullable();table.date('end_date').nullable();table.date('next_run_date').nullable();table.string('status',16).notNullable().defaultTo('active');table.integer('version').notNullable().defaultTo(1);table.integer('created_by').unsigned().notNullable();table.integer('updated_by').unsigned().notNullable();table.text('last_error').nullable();table.datetime('created_at').notNullable().defaultTo(db.fn.now());table.datetime('updated_at').notNullable().defaultTo(db.fn.now());table.index(['status','next_run_date']);table.index('branchid');
 });
 if (!(await db.schema.hasTable('acc_recurring_expense_occurrences'))) await db.schema.createTable('acc_recurring_expense_occurrences',table=>{
  table.increments('id').primary();table.integer('profile_id').unsigned().notNullable();table.date('occurrence_date').notNullable();table.integer('expense_id').unsigned().notNullable();table.datetime('created_at').notNullable().defaultTo(db.fn.now());table.unique(['profile_id','occurrence_date']);table.unique('expense_id');
 });
}
