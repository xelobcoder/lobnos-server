"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Alter clock_in and clock_out columns from DATETIME to TIME if they exist as DATETIME
    const hasClockInColumn = await knex.schema.hasColumn('payroll_employee_attendance', 'clock_in');
    const hasClockOutColumn = await knex.schema.hasColumn('payroll_employee_attendance', 'clock_out');
    if (hasClockInColumn) {
        // Check current column type and alter if needed
        const columns = await knex.raw("DESCRIBE payroll_employee_attendance");
        const clockInColumn = columns[0].find((col) => col.Field === 'clock_in');
        if (clockInColumn && clockInColumn.Type.includes('datetime')) {
            await knex.schema.alterTable('payroll_employee_attendance', (table) => {
                table.time('clock_in').nullable().alter();
            });
        }
    }
    if (hasClockOutColumn) {
        const columns = await knex.raw("DESCRIBE payroll_employee_attendance");
        const clockOutColumn = columns[0].find((col) => col.Field === 'clock_out');
        if (clockOutColumn && clockOutColumn.Type.includes('datetime')) {
            await knex.schema.alterTable('payroll_employee_attendance', (table) => {
                table.time('clock_out').nullable().alter();
            });
        }
    }
}
exports.up = up;
async function down(knex) {
    // Revert back to DATETIME if needed
    await knex.schema.alterTable('payroll_employee_attendance', (table) => {
        table.datetime('clock_in').nullable().alter();
        table.datetime('clock_out').nullable().alter();
    });
}
exports.down = down;
