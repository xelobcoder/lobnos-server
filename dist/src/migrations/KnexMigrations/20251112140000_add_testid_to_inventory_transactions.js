"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.alterTable('inv_inventory_transactions', (table) => {
        table.integer('testid');
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.alterTable('inv_inventory_transactions', (table) => {
        table.dropColumn('testid');
    });
}
exports.down = down;
