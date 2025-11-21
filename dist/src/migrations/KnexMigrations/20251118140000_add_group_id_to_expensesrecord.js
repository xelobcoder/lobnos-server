"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.alterTable('expensesrecord', (table) => {
        table.string('groupId').nullable();
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.alterTable('expensesrecord', (table) => {
        table.dropColumn('groupId');
    });
}
exports.down = down;
