"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    if (!(await knex.schema.hasTable('roles_audit_log'))) {
        await knex.schema.createTable('roles_audit_log', (table) => {
            table.increments('id').primary().unsigned();
            table.enum('action', ['INSERT', 'UPDATE', 'DELETE']).notNullable();
            table.integer('employeeid').unsigned().notNullable();
            table.integer('actor_employeeid').unsigned().nullable();
            table.json('old_data').nullable();
            table.json('new_data').nullable();
            table.datetime('created_at', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
            table.index(['employeeid', 'created_at'], 'idx_roles_audit_emp_time');
            table.index(['action', 'created_at'], 'idx_roles_audit_action_time');
        });
    }
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTableIfExists('roles_audit_log');
}
exports.down = down;
