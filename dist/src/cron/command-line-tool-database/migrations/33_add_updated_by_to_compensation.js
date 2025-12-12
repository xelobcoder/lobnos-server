"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Add updated_by column to payroll_employee_compensation table
    await knex.schema.alterTable('payroll_employee_compensation', (table) => {
        table.integer('updated_by').unsigned().nullable();
        table.foreign('updated_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
    });
}
exports.up = up;
async function down(knex) {
    // Remove updated_by column from payroll_employee_compensation table
    await knex.schema.alterTable('payroll_employee_compensation', (table) => {
        table.dropForeign('payroll_employee_compensation_updated_by_foreign');
        table.dropColumn('updated_by');
    });
}
exports.down = down;
