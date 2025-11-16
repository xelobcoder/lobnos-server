"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.alterTable('inv_consumption_history', (table) => {
        table.string('brand_name', 255);
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.alterTable('inv_consumption_history', (table) => {
        table.dropColumn('brand_name');
    });
}
exports.down = down;
