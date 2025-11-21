"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Add tenant_id to invoices table
    await knex.schema.alterTable('invoices', (table) => {
        table.integer('tenant_id').notNullable().defaultTo(1);
    });
    // Add tenant_id to invoice_expenses table
    await knex.schema.alterTable('invoice_expenses', (table) => {
        table.integer('tenant_id').notNullable().defaultTo(1);
    });
    // Add tenant_id to expense_payments table
    await knex.schema.alterTable('expense_payments', (table) => {
        table.integer('tenant_id').notNullable().defaultTo(1);
    });
}
exports.up = up;
async function down(knex) {
    // Remove tenant_id from expense_payments table
    await knex.schema.alterTable('expense_payments', (table) => {
        table.dropColumn('tenant_id');
    });
    // Remove tenant_id from invoice_expenses table
    await knex.schema.alterTable('invoice_expenses', (table) => {
        table.dropColumn('tenant_id');
    });
    // Remove tenant_id from invoices table
    await knex.schema.alterTable('invoices', (table) => {
        table.dropColumn('tenant_id');
    });
}
exports.down = down;
