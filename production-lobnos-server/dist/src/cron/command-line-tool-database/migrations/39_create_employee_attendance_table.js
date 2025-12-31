"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Create employee attendance table
    await knex.schema.createTable('payroll_employee_attendance', (table) => {
        table.increments('id').unsigned().primary();
        table.integer('employeeid').unsigned().notNullable();
        table.date('attendance_date').notNullable();
        // Clock times
        table.time('clock_in').nullable();
        table.time('clock_out').nullable();
        table.decimal('total_hours', 5, 2).nullable();
        // Work type
        table.enu('shift_type', ['regular', 'night', 'weekend', 'holiday']).defaultTo('regular');
        table.enu('work_location', ['on-site', 'remote', 'field']).defaultTo('on-site');
        // Status
        table.enu('status', ['present', 'absent', 'half-day', 'late', 'early_departure']).defaultTo('present');
        table.integer('late_minutes').defaultTo(0);
        // Overtime
        table.decimal('overtime_hours', 5, 2).defaultTo(0);
        table.boolean('overtime_approved').defaultTo(false);
        table.integer('overtime_approved_by').unsigned().nullable();
        table.text('remarks').nullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        // Foreign keys
        table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
        table.foreign('overtime_approved_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
        // Constraints
        table.unique(['employeeid', 'attendance_date']);
        table.index('attendance_date');
        table.index('status');
    });
}
exports.up = up;
async function down(knex) {
    // Drop attendance table
    await knex.schema.dropTableIfExists('payroll_employee_attendance');
}
exports.down = down;
