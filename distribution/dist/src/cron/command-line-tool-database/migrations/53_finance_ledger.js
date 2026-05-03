"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    if (!(await knex.schema.hasTable('finance_ledger'))) {
        await knex.schema.createTable('finance_ledger', (table) => {
            table.increments('id').primary().unsigned();
            table.datetime('occurred_at').notNullable().defaultTo(knex.fn.now());
            table.enum('direction', ['credit', 'debit']).notNullable();
            table.decimal('amount', 12, 2).notNullable();
            table.string('account_ref', 50).nullable();
            table.string('source_module', 30).notNullable();
            table.string('source_table', 60).notNullable();
            table.string('source_ref', 80).notNullable();
            table.integer('billingid').unsigned().nullable();
            table.integer('expense_id').unsigned().nullable();
            table.integer('invoice_id').unsigned().nullable();
            table.integer('employeeid').unsigned().nullable();
            table.integer('branchid').unsigned().nullable();
            table.enum('status', ['posted', 'voided']).notNullable().defaultTo('posted');
            table.integer('reversal_of_ledger_id').unsigned().nullable();
            table.datetime('reversed_at').nullable();
            table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
            table.unique(['source_module', 'source_table', 'source_ref', 'direction'], 'uq_fin_ledger_source_direction');
            table.index(['occurred_at'], 'idx_fin_ledger_occurred_at');
            table.index(['direction', 'occurred_at'], 'idx_fin_ledger_direction_date');
            table.index(['billingid'], 'idx_fin_ledger_billingid');
            table.index(['expense_id'], 'idx_fin_ledger_expense_id');
            table.index(['invoice_id'], 'idx_fin_ledger_invoice_id');
            table.index(['branchid'], 'idx_fin_ledger_branchid');
        });
    }
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTableIfExists('finance_ledger');
}
exports.down = down;
