"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Create expense_payment_reversals table for audit trail
    if (!(await knex.schema.hasTable('expense_payment_reversals'))) {
        await knex.schema.createTable('expense_payment_reversals', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('payment_id').notNullable().unsigned();
            table.integer('expense_id').notNullable().unsigned();
            table.integer('invoice_id').nullable().unsigned();
            table.decimal('reversed_amount', 12, 2).notNullable();
            table.integer('reversed_by').notNullable().unsigned();
            table.text('reversal_reason').nullable();
            table.timestamp('reversed_on').defaultTo(knex.fn.now());
            table.string('reversal_method', 50).nullable();
            table.datetime('created_at').defaultTo(knex.fn.now());
            // Indexes for better query performance
            table.index('payment_id', 'idx_reversal_payment_id');
            table.index('expense_id', 'idx_reversal_expense_id');
            table.index('reversed_by', 'idx_reversal_reversed_by');
            table.index('reversed_on', 'idx_reversal_date');
            table.index(['expense_id', 'reversed_on'], 'idx_reversal_expense_date');
            // Foreign keys
            table.foreign('payment_id').references('id').inTable('expense_payments').onDelete('CASCADE').onUpdate('CASCADE');
            table.foreign('expense_id').references('id').inTable('expensesrecord').onDelete('CASCADE').onUpdate('CASCADE');
            table.foreign('reversed_by').references('employeeid').inTable('roles').onDelete('RESTRICT').onUpdate('CASCADE');
        });
    }
    // Add reversal tracking columns to expense_payments table
    if ((await knex.schema.hasTable('expense_payments'))) {
        const hasReversedColumn = await knex.schema.hasColumn('expense_payments', 'is_reversed');
        if (!hasReversedColumn) {
            await knex.schema.alterTable('expense_payments', (table) => {
                table.boolean('is_reversed').defaultTo(false);
                table.integer('reversal_id').nullable().unsigned();
                table.timestamp('reversed_on').nullable();
            });
        }
    }
}
exports.up = up;
async function down(knex) {
    // Drop reversal tracking columns from expense_payments
    if ((await knex.schema.hasTable('expense_payments'))) {
        await knex.schema.alterTable('expense_payments', (table) => {
            table.dropColumn('is_reversed');
            table.dropColumn('reversal_id');
            table.dropColumn('reversed_on');
        });
    }
    // Drop expense_payment_reversals table
    await knex.schema.dropTableIfExists('expense_payment_reversals');
}
exports.down = down;
