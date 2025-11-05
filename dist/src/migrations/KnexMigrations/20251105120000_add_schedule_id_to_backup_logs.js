"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.alterTable('backup_logs', (table) => {
        table.integer('schedule_id').nullable().references('id').inTable('backup_schedules').onDelete('SET NULL');
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.alterTable('backup_logs', (table) => {
        table.dropForeign('schedule_id');
        table.dropColumn('schedule_id');
    });
}
exports.down = down;
