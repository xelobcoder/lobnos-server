"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Alter payroll_employee_compensation table to change salary_grade to salary_grade_id
    await knex.schema.alterTable('payroll_employee_compensation', (table) => {
        // Drop the old salary_grade column
        table.dropColumn('salary_grade');
        // Add the new salary_grade_id column
        table.integer('salary_grade_id').unsigned().nullable();
        // Add foreign key constraint
        table.foreign('salary_grade_id').references('id').inTable('payroll_salary_grades').onDelete('SET NULL').onUpdate('CASCADE');
    });
}
exports.up = up;
async function down(knex) {
    // Revert the changes
    await knex.schema.alterTable('payroll_employee_compensation', (table) => {
        // Drop foreign key and column
        table.dropForeign('payroll_employee_compensation_salary_grade_id_foreign');
        table.dropColumn('salary_grade_id');
        // Add back the old salary_grade column
        table.string('salary_grade', 50).nullable();
    });
}
exports.down = down;
