"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.createTable('backup_schedules', (table) => {
        table.increments('id').primary();
        table.string('schedule_name').notNullable();
        table.enum('frequency', ['daily', 'weekly', 'monthly', 'hourly']).notNullable();
        table.time('backup_time').notNullable();
        table.integer('retention_days').notNullable();
        table.integer('employeeid').notNullable();
        table.string('backup_path').nullable();
        table.enum('backup_type', ['database', 'files', 'full_system']).notNullable();
        table.boolean('is_active').notNullable().defaultTo(true);
        table.string('database_name').nullable();
        table.string('source_path').nullable();
        table.timestamp('last_run').nullable();
        table.timestamps(true, true);
        table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE');
    });
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
    await knex.schema.dropTable('backup_schedules');
}
exports.down = down;
