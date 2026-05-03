"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Employee Compensation Configuration
    if (!(await knex.schema.hasTable('payroll_employee_compensation'))) {
        await knex.schema.createTable('payroll_employee_compensation', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('employeeid').notNullable().unsigned();
            table.enum('compensation_type', ['salary', 'hourly', 'commission', 'hybrid']).notNullable();
            // Salary-based
            table.decimal('basic_salary', 10, 2).nullable();
            table.string('salary_grade', 50).nullable();
            table.string('currency', 10).defaultTo('GHS');
            // Hourly-based
            table.decimal('hourly_rate', 10, 2).nullable();
            table.decimal('overtime_rate_multiplier', 3, 2).defaultTo(1.5);
            // Commission-based
            table.decimal('commission_percentage', 5, 2).nullable();
            table.decimal('commission_target', 10, 2).nullable();
            // Payment schedule
            table.enum('payment_frequency', ['monthly', 'bi-weekly', 'weekly']).defaultTo('monthly');
            table.enum('payment_method', ['bank_transfer', 'cash', 'cheque', 'mobile_money']).defaultTo('bank_transfer');
            table.string('bank_account_number', 50).nullable();
            table.string('bank_name', 100).nullable();
            table.string('bank_branch', 100).nullable();
            table.string('mobile_money_number', 15).nullable();
            // Effective dates
            table.date('effective_from').notNullable();
            table.date('effective_to').nullable();
            table.boolean('is_active').defaultTo(true);
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
            table.integer('created_by').unsigned().nullable();
            table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
            table.foreign('created_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
            table.index('employeeid');
            table.index('is_active');
        });
    }
    // Employee Attendance
    if (!(await knex.schema.hasTable('payroll_employee_attendance'))) {
        await knex.schema.createTable('payroll_employee_attendance', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('employeeid').notNullable().unsigned();
            table.date('attendance_date').notNullable();
            // Clock in/out times
            table.datetime('clock_in').nullable();
            table.datetime('clock_out').nullable();
            table.decimal('total_hours', 5, 2).nullable();
            // Work type
            table.enum('shift_type', ['regular', 'night', 'weekend', 'holiday']).defaultTo('regular');
            table.enum('work_location', ['on-site', 'remote', 'field']).defaultTo('on-site');
            // Status
            table.enum('status', ['present', 'absent', 'half-day', 'late', 'early_departure']).defaultTo('present');
            table.integer('late_minutes').defaultTo(0);
            // Overtime
            table.decimal('overtime_hours', 5, 2).defaultTo(0);
            table.boolean('overtime_approved').defaultTo(false);
            table.integer('overtime_approved_by').unsigned().nullable();
            table.text('remarks').nullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
            table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
            table.foreign('overtime_approved_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
            table.unique(['employeeid', 'attendance_date']);
            table.index('attendance_date');
            table.index('status');
        });
    }
    // Employee Leave
    if (!(await knex.schema.hasTable('payroll_employee_leave'))) {
        await knex.schema.createTable('payroll_employee_leave', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('employeeid').notNullable().unsigned();
            table.enum('leave_type', ['annual', 'sick', 'maternity', 'paternity', 'unpaid', 'study', 'compassionate']).notNullable();
            table.date('start_date').notNullable();
            table.date('end_date').notNullable();
            table.integer('total_days').notNullable();
            // Status workflow
            table.enum('status', ['pending', 'approved', 'rejected', 'cancelled']).defaultTo('pending');
            table.date('applied_date').notNullable();
            table.integer('approved_by').unsigned().nullable();
            table.date('approved_date').nullable();
            table.boolean('affects_salary').defaultTo(false);
            table.text('reason').nullable();
            table.text('attachments').nullable(); // JSON array of file paths
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
            table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
            table.foreign('approved_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
            table.index('employeeid');
            table.index('status');
            table.index(['start_date', 'end_date']);
        });
    }
    // Employee Leave Balance
    if (!(await knex.schema.hasTable('payroll_employee_leave_balance'))) {
        await knex.schema.createTable('payroll_employee_leave_balance', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('employeeid').notNullable().unsigned();
            table.integer('leave_year').notNullable();
            // Entitlements
            table.integer('annual_leave_entitlement').defaultTo(21);
            table.integer('sick_leave_entitlement').defaultTo(14);
            // Balances
            table.integer('annual_leave_taken').defaultTo(0);
            table.integer('annual_leave_balance').defaultTo(21);
            table.integer('sick_leave_taken').defaultTo(0);
            table.integer('sick_leave_balance').defaultTo(14);
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
            table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
            table.unique(['employeeid', 'leave_year']);
            table.index('leave_year');
        });
    }
    // Employee Allowances
    if (!(await knex.schema.hasTable('payroll_employee_allowances'))) {
        await knex.schema.createTable('payroll_employee_allowances', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('employeeid').notNullable().unsigned();
            table.enum('allowance_type', [
                'housing', 'transport', 'meal', 'medical', 'education',
                'uniform', 'mobile', 'hazard', 'shift_allowance', 'professional_development'
            ]).notNullable();
            table.decimal('amount', 10, 2).notNullable();
            table.enum('calculation_method', ['fixed', 'percentage_of_basic', 'variable']).defaultTo('fixed');
            table.decimal('percentage', 5, 2).nullable();
            // Frequency
            table.boolean('is_recurring').defaultTo(true);
            table.enum('frequency', ['monthly', 'quarterly', 'annually', 'one-time']).defaultTo('monthly');
            table.boolean('is_taxable').defaultTo(true);
            // Effective dates
            table.date('effective_from').notNullable();
            table.date('effective_to').nullable();
            table.boolean('is_active').defaultTo(true);
            table.integer('approved_by').unsigned().nullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
            table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
            table.foreign('approved_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
            table.index('employeeid');
            table.index('is_active');
        });
    }
    // Employee Bonuses
    if (!(await knex.schema.hasTable('payroll_employee_bonuses'))) {
        await knex.schema.createTable('payroll_employee_bonuses', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('employeeid').notNullable().unsigned();
            table.enum('bonus_type', ['performance', 'annual', 'project', 'retention', 'holiday', 'spot']).notNullable();
            table.decimal('amount', 10, 2).notNullable();
            table.string('bonus_period', 50).nullable();
            table.boolean('is_taxable').defaultTo(true);
            table.enum('tax_method', ['aggregate', 'separate', 'bonus_rate']).defaultTo('aggregate');
            // Approval workflow
            table.enum('status', ['pending', 'approved', 'rejected', 'paid']).defaultTo('pending');
            table.integer('approved_by').unsigned().nullable();
            table.date('approved_date').nullable();
            table.text('reason').nullable();
            table.decimal('performance_rating', 3, 2).nullable();
            table.date('payment_date').nullable();
            table.integer('payroll_period_id').unsigned().nullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
            table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
            table.foreign('approved_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
            table.index('employeeid');
            table.index('status');
        });
    }
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTableIfExists('payroll_employee_bonuses');
    await knex.schema.dropTableIfExists('payroll_employee_allowances');
    await knex.schema.dropTableIfExists('payroll_employee_leave_balance');
    await knex.schema.dropTableIfExists('payroll_employee_leave');
    await knex.schema.dropTableIfExists('payroll_employee_attendance');
    await knex.schema.dropTableIfExists('payroll_employee_compensation');
}
exports.down = down;
