"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Create invoices table
    await knex.schema.createTable('invoices', (table) => {
        table.increments('id').primary();
        table.string('invoice_number', 50).notNullable().unique();
        table.datetime('invoice_date').notNullable();
        table.datetime('due_date').nullable();
        table.integer('merchant_id').notNullable().references('id').inTable('expense_merchants');
        table.integer('employee_id').notNullable().references('employeeid').inTable('roles');
        table.integer('branch_id').nullable();
        table.decimal('total_amount', 12, 2).notNullable();
        table.decimal('tax_amount', 12, 2).defaultTo(0.00);
        table.enu('status', ['Pending', 'Approved', 'Rejected', 'Paid']).defaultTo('Pending');
        table.datetime('created_on').defaultTo(knex.fn.now());
        table.datetime('updated_on').defaultTo(knex.fn.now());
    });
    // Create invoice_expenses table
    await knex.schema.createTable('invoice_expenses', (table) => {
        table.increments('id').primary();
        table.integer('invoice_id').notNullable().references('id').inTable('invoices');
        table.integer('expense_id').notNullable().references('id').inTable('expensesrecord');
        table.unique(['invoice_id', 'expense_id']);
    });
    // Create expense_payments table
    await knex.schema.createTable('expense_payments', (table) => {
        table.increments('id').primary();
        table.integer('expense_id').notNullable().references('id').inTable('expensesrecord');
        table.integer('invoice_id').nullable().references('id').inTable('invoices');
        table.datetime('payment_date').notNullable();
        table.decimal('amount', 12, 2).notNullable();
        table.string('method', 50);
        table.enu('status', ['Paid', 'Pending', 'Failed']).defaultTo('Pending');
        table.integer('created_by').notNullable();
        table.datetime('created_on').defaultTo(knex.fn.now());
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTableIfExists('expense_payments');
    await knex.schema.dropTableIfExists('invoice_expenses');
    await knex.schema.dropTableIfExists('invoices');
}
exports.down = down;
