"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.createTable('incident_audit_trail', (table) => {
        table.string('id', 50).primary();
        table.string('incident_id', 50).notNullable();
        table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());
        table.string('action', 100).notNullable();
        table.integer('employeeId').notNullable();
        table.text('oldValue');
        table.text('newValue');
        table.text('details');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.index('incident_id');
        table.index('timestamp');
        table.index('action');
        table.index('employeeId');
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTable('incident_audit_trail');
}
exports.down = down;
