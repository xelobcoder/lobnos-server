"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.alterTable('inv_purchase_order_receipts', (table) => {
        table.dropColumn('received_by');
    });
    await knex.schema.alterTable('inv_purchase_order_receipts', (table) => {
        table.integer('received_by');
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.alterTable('inv_purchase_order_receipts', (table) => {
        table.dropColumn('received_by');
    });
    await knex.schema.alterTable('inv_purchase_order_receipts', (table) => {
        table.string('received_by', 100);
    });
}
exports.down = down;
