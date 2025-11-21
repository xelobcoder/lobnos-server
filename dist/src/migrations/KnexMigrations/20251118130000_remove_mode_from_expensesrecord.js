"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Drop the mode column from expensesrecord table
    await knex.schema.alterTable('expensesrecord', (table) => {
        table.dropColumn('mode');
    });
}
exports.up = up;
async function down(knex) {
    // Add back the mode column (for rollback)
    await knex.schema.alterTable('expensesrecord', (table) => {
        table.integer('mode').nullable();
    });
}
exports.down = down;
