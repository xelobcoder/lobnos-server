"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.alterTable('salessessionmanager', (table) => {
        table.time('start_time').nullable();
        table.time('end_time').nullable();
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.alterTable('salessessionmanager', (table) => {
        table.dropColumn('start_time');
        table.dropColumn('end_time');
    });
}
exports.down = down;
