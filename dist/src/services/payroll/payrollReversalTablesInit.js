"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensurePayrollReversalTables = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
async function ensurePayrollReversalTables(tenantId) {
    const knex = await (0, KnexConnections_1.default)(tenantId);
    if (!(await knex.schema.hasTable('payroll_periods'))) {
        return;
    }
    const hasExpenseSynced = await knex.schema.hasColumn('payroll_periods', 'expense_synced');
    if (!hasExpenseSynced) {
        await knex.schema.alterTable('payroll_periods', (table) => {
            table.boolean('expense_synced').defaultTo(false);
            table.integer('expense_id').unsigned().nullable();
            table.integer('expense_invoice_id').unsigned().nullable();
            table.integer('expense_payment_id').unsigned().nullable();
            table.boolean('was_reversed').defaultTo(false);
            table.timestamp('reversed_at').nullable();
            table.integer('last_reversal_id').unsigned().nullable();
        });
    }
    if (!(await knex.schema.hasTable('payroll_period_reversals'))) {
        const hasExpensePaymentReversals = await knex.schema.hasTable('expense_payment_reversals');
        await knex.schema.createTable('payroll_period_reversals', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('payroll_period_id').notNullable().unsigned();
            table.integer('reversed_by').notNullable().unsigned();
            table.integer('branchid').nullable().unsigned();
            table.text('reason').nullable();
            table.string('previous_status', 20).notNullable();
            table.string('reverted_to_status', 20).notNullable();
            table.integer('expense_id').unsigned().nullable();
            table.integer('invoice_id').unsigned().nullable();
            table.integer('payment_id').unsigned().nullable();
            table.integer('expense_payment_reversal_id').unsigned().nullable();
            table.json('metadata').nullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.index(['payroll_period_id', 'created_at'], 'idx_payroll_period_reversals_period_date');
            table.index('reversed_by', 'idx_payroll_period_reversals_reversed_by');
            table.foreign('payroll_period_id').references('id').inTable('payroll_periods').onDelete('CASCADE').onUpdate('CASCADE');
            table.foreign('reversed_by').references('employeeid').inTable('roles').onDelete('RESTRICT').onUpdate('CASCADE');
            table.foreign('expense_id').references('id').inTable('expensesrecord').onDelete('SET NULL').onUpdate('CASCADE');
            table.foreign('invoice_id').references('id').inTable('invoices').onDelete('SET NULL').onUpdate('CASCADE');
            table.foreign('payment_id').references('id').inTable('expense_payments').onDelete('SET NULL').onUpdate('CASCADE');
            if (hasExpensePaymentReversals) {
                table.foreign('expense_payment_reversal_id').references('id').inTable('expense_payment_reversals').onDelete('SET NULL').onUpdate('CASCADE');
            }
        });
    }
    if (!(await knex.schema.hasTable('payroll_period_errors'))) {
        await knex.schema.createTable('payroll_period_errors', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('payroll_period_id').notNullable().unsigned();
            table.string('error_type', 80).notNullable();
            table.text('error_message').notNullable();
            table.text('stack').nullable();
            table.integer('created_by').nullable().unsigned();
            table.integer('branchid').nullable().unsigned();
            table.integer('reversal_id').unsigned().nullable();
            table.json('metadata').nullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.index(['payroll_period_id', 'created_at'], 'idx_payroll_period_errors_period_date');
            table.index('error_type', 'idx_payroll_period_errors_type');
            table.foreign('payroll_period_id').references('id').inTable('payroll_periods').onDelete('CASCADE').onUpdate('CASCADE');
            table.foreign('created_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
            table.foreign('reversal_id').references('id').inTable('payroll_period_reversals').onDelete('SET NULL').onUpdate('CASCADE');
        });
    }
    const hasLastReversalId = await knex.schema.hasColumn('payroll_periods', 'last_reversal_id');
    const hasReversalsTable = await knex.schema.hasTable('payroll_period_reversals');
    if (hasLastReversalId && hasReversalsTable) {
        try {
            await knex.schema.alterTable('payroll_periods', (table) => {
                table.foreign('last_reversal_id').references('id').inTable('payroll_period_reversals').onDelete('SET NULL').onUpdate('CASCADE');
            });
        }
        catch (_a) {
        }
    }
}
exports.ensurePayrollReversalTables = ensurePayrollReversalTables;
