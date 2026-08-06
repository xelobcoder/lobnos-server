"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    if (!(await knex.schema.hasTable('departments'))) {
        await knex.schema.createTable('departments', (table) => {
            table.increments('id').primary().unsigned();
            table.string('department', 100).notNullable();
            table.string('departmentManager', 100).notNullable();
            table.dateTime('date', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
            table.integer('employeeid').notNullable().unsigned();
            table.unique('department');
            table.index('employeeid', 'dept_creation_map_employee');
            table.foreign('employeeid').references('employeeid').inTable('roles').onUpdate('CASCADE');
        });
    }
}
async function down(knex) {
    await knex.schema.dropTableIfExists('departments');
}
