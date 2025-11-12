"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Add communication fields to purchase orders table
    await knex.schema.alterTable('inv_purchase_orders', (table) => {
        table.string('communication_method', 50).nullable().comment('Method used to communicate with supplier (email, phone, fax, etc.)');
        table.text('communication_notes').nullable().comment('Notes about communication with supplier');
    });
}
exports.up = up;
async function down(knex) {
    // Remove communication fields from purchase orders table
    await knex.schema.alterTable('inv_purchase_orders', (table) => {
        table.dropColumn('communication_method');
        table.dropColumn('communication_notes');
    });
}
exports.down = down;
