"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.alterTable('inv_purchase_order_receipts', (table) => {
        table.timestamp('updated_at').defaultTo(knex.fn.now()).alter();
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.alterTable('inv_purchase_order_receipts', (table) => {
        table.dropColumn('updated_at');
    });
}
exports.down = down;
