"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.alterTable('inv_storage_locations', (table) => {
        table.decimal('room_temperature', 5, 2).comment('Room temperature in Celsius (optional)');
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.alterTable('inv_storage_locations', (table) => {
        table.dropColumn('room_temperature');
    });
}
exports.down = down;
