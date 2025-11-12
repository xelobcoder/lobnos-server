"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.alterTable('inv_inventory_transactions', (table) => {
        table.integer('patient_id');
        table.integer('ascension_id');
        table.index(['patient_id', 'ascension_id']);
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.alterTable('inv_inventory_transactions', (table) => {
        table.dropIndex(['patient_id', 'ascension_id']);
        table.dropColumn('patient_id');
        table.dropColumn('ascension_id');
    });
}
exports.down = down;
