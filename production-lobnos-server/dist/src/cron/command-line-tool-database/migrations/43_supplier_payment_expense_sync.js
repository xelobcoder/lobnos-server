"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Add expense_synced column to supplier payments table
    await knex.schema.alterTable('inv_supplier_payments', (table) => {
        table.boolean('expense_synced').defaultTo(false);
        table.string('expense_id').nullable();
        table.string('expense_invoice_id').nullable();
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.alterTable('inv_supplier_payments', (table) => {
        table.dropColumn('expense_synced');
        table.dropColumn('expense_id');
        table.dropColumn('expense_invoice_id');
    });
}
exports.down = down;
