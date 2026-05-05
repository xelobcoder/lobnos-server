"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Add expense sync columns to commission_batch_payments
    if (await knex.schema.hasTable('commission_batch_payments')) {
        const hasExpenseSynced = await knex.schema.hasColumn('commission_batch_payments', 'expense_synced');
        const hasExpenseId = await knex.schema.hasColumn('commission_batch_payments', 'expense_id');
        const hasExpenseInvoiceId = await knex.schema.hasColumn('commission_batch_payments', 'expense_invoice_id');
        const hasExpensePaymentId = await knex.schema.hasColumn('commission_batch_payments', 'expense_payment_id');
        if (!hasExpenseSynced || !hasExpenseId || !hasExpenseInvoiceId || !hasExpensePaymentId) {
            await knex.schema.alterTable('commission_batch_payments', (table) => {
                if (!hasExpenseSynced) {
                    table.boolean('expense_synced').notNullable().defaultTo(false);
                }
                if (!hasExpenseId) {
                    table.integer('expense_id').nullable().unsigned();
                }
                if (!hasExpenseInvoiceId) {
                    table.integer('expense_invoice_id').nullable().unsigned();
                }
                if (!hasExpensePaymentId) {
                    table.integer('expense_payment_id').nullable().unsigned();
                }
            });
        }
    }
    // Add expense sync columns to commission_batch_payment_services
    if (await knex.schema.hasTable('commission_batch_payment_services')) {
        const hasExpenseSynced = await knex.schema.hasColumn('commission_batch_payment_services', 'expense_synced');
        const hasExpenseId = await knex.schema.hasColumn('commission_batch_payment_services', 'expense_id');
        if (!hasExpenseSynced || !hasExpenseId) {
            await knex.schema.alterTable('commission_batch_payment_services', (table) => {
                if (!hasExpenseSynced) {
                    table.boolean('expense_synced').notNullable().defaultTo(false);
                }
                if (!hasExpenseId) {
                    table.integer('expense_id').nullable().unsigned();
                }
            });
        }
    }
}
exports.up = up;
async function down(knex) {
    if (await knex.schema.hasTable('commission_batch_payments')) {
        await knex.schema.alterTable('commission_batch_payments', (table) => {
            table.dropColumn('expense_synced');
            table.dropColumn('expense_id');
            table.dropColumn('expense_invoice_id');
            table.dropColumn('expense_payment_id');
        });
    }
    if (await knex.schema.hasTable('commission_batch_payment_services')) {
        await knex.schema.alterTable('commission_batch_payment_services', (table) => {
            table.dropColumn('expense_synced');
            table.dropColumn('expense_id');
        });
    }
}
exports.down = down;
