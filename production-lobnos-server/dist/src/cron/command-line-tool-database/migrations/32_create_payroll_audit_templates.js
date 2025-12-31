"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Payroll Adjustments
    if (!(await knex.schema.hasTable('payroll_adjustments'))) {
        await knex.schema.createTable('payroll_adjustments', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('payroll_transaction_id').notNullable().unsigned();
            table.integer('employeeid').notNullable().unsigned();
            table.enum('adjustment_type', ['earning', 'deduction']).notNullable();
            table.enum('adjustment_category', [
                'arrears', 'correction', 'refund', 'advance_recovery',
                'retroactive_payment', 'overpayment_recovery', 'manual_adjustment'
            ]).notNullable();
            table.string('description', 255).notNullable();
            table.decimal('amount', 10, 2).notNullable();
            table.boolean('is_taxable').defaultTo(true);
            table.boolean('affects_ssnit').defaultTo(true);
            // Approval workflow
            table.enum('status', ['pending', 'approved', 'rejected']).defaultTo('pending');
            table.integer('requested_by').unsigned().notNullable();
            table.integer('approved_by').unsigned().nullable();
            table.date('approved_date').nullable();
            table.text('justification').nullable();
            table.text('attachments').nullable(); // JSON array
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
            table.foreign('payroll_transaction_id').references('id').inTable('payroll_transactions').onDelete('CASCADE').onUpdate('CASCADE');
            table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
            table.foreign('requested_by').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
            table.foreign('approved_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
            table.index('payroll_transaction_id');
            table.index('employeeid');
            table.index('status');
        });
    }
    // Payroll Audit Log
    if (!(await knex.schema.hasTable('payroll_audit_log'))) {
        await knex.schema.createTable('payroll_audit_log', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('employeeid').unsigned().nullable();
            table.integer('payroll_period_id').unsigned().nullable();
            table.integer('payroll_transaction_id').unsigned().nullable();
            table.enum('action_type', [
                'period_created', 'period_calculated', 'period_approved', 'period_locked', 'period_paid',
                'transaction_created', 'transaction_updated', 'transaction_approved', 'transaction_paid',
                'adjustment_added', 'adjustment_approved', 'allowance_added', 'deduction_added',
                'compensation_updated', 'statutory_updated', 'tax_config_updated'
            ]).notNullable();
            table.string('entity_type', 50).notNullable(); // e.g., 'payroll_period', 'payroll_transaction'
            table.integer('entity_id').unsigned().notNullable();
            table.json('old_values').nullable();
            table.json('new_values').nullable();
            table.text('description').nullable();
            table.string('ip_address', 45).nullable();
            table.string('user_agent', 255).nullable();
            table.integer('performed_by').unsigned().notNullable();
            table.timestamp('performed_at').defaultTo(knex.fn.now());
            table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
            table.foreign('payroll_period_id').references('id').inTable('payroll_periods').onDelete('SET NULL').onUpdate('CASCADE');
            table.foreign('payroll_transaction_id').references('id').inTable('payroll_transactions').onDelete('SET NULL').onUpdate('CASCADE');
            table.foreign('performed_by').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
            table.index('action_type');
            table.index('performed_at');
            table.index('entity_type');
        });
    }
    // Payroll Cost Centers (for expense allocation)
    if (!(await knex.schema.hasTable('payroll_cost_centers'))) {
        await knex.schema.createTable('payroll_cost_centers', (table) => {
            table.increments('id').primary().unsigned();
            table.string('cost_center_code', 50).notNullable().unique();
            table.string('cost_center_name', 100).notNullable();
            table.enum('department', [
                'laboratory', 'radiology', 'front_desk', 'administration',
                'finance', 'it', 'maintenance', 'security', 'management'
            ]).notNullable();
            table.integer('branch_id').unsigned().nullable();
            table.boolean('is_active').defaultTo(true);
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
            table.foreign('branch_id').references('branchid').inTable('branch').onDelete('SET NULL').onUpdate('CASCADE');
            table.index('department');
            table.index('is_active');
        });
    }
    // Employee Cost Center Allocation
    if (!(await knex.schema.hasTable('payroll_employee_cost_center_allocation'))) {
        await knex.schema.createTable('payroll_employee_cost_center_allocation', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('employeeid').notNullable().unsigned();
            table.integer('cost_center_id').notNullable().unsigned();
            table.decimal('allocation_percentage', 5, 2).notNullable().defaultTo(100);
            table.date('effective_from').notNullable();
            table.date('effective_to').nullable();
            table.boolean('is_active').defaultTo(true);
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
            table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
            table.foreign('cost_center_id').references('id').inTable('payroll_cost_centers').onDelete('CASCADE').onUpdate('CASCADE');
            table.index('employeeid');
            table.index('is_active');
        });
    }
    // Payslip Templates
    if (!(await knex.schema.hasTable('payroll_payslip_templates'))) {
        await knex.schema.createTable('payroll_payslip_templates', (table) => {
            table.increments('id').primary().unsigned();
            table.string('template_name', 100).notNullable();
            table.text('template_html').notNullable();
            table.boolean('show_employer_contributions').defaultTo(true);
            table.boolean('show_cost_center').defaultTo(false);
            table.boolean('show_attendance_summary').defaultTo(true);
            table.boolean('show_ytd_totals').defaultTo(true);
            table.json('custom_fields').nullable(); // Additional fields to display
            table.boolean('is_default').defaultTo(false);
            table.boolean('is_active').defaultTo(true);
            table.integer('created_by').unsigned().nullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
            table.foreign('created_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
            table.index('is_default');
            table.index('is_active');
        });
    }
    // Employee Payslip Access (track who viewed payslips)
    if (!(await knex.schema.hasTable('payroll_employee_payslip_access'))) {
        await knex.schema.createTable('payroll_employee_payslip_access', (table) => {
            table.increments('id').primary().unsigned();
            table.integer('employeeid').notNullable().unsigned();
            table.integer('payroll_transaction_id').notNullable().unsigned();
            table.datetime('accessed_at').notNullable();
            table.string('ip_address', 45).nullable();
            table.string('user_agent', 255).nullable();
            table.enum('access_type', ['view', 'download', 'email']).notNullable();
            table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
            table.foreign('payroll_transaction_id').references('id').inTable('payroll_transactions').onDelete('CASCADE').onUpdate('CASCADE');
            table.index('employeeid');
            table.index('accessed_at');
        });
    }
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTableIfExists('payroll_employee_payslip_access');
    await knex.schema.dropTableIfExists('payroll_payslip_templates');
    await knex.schema.dropTableIfExists('payroll_employee_cost_center_allocation');
    await knex.schema.dropTableIfExists('payroll_cost_centers');
    await knex.schema.dropTableIfExists('payroll_audit_log');
    await knex.schema.dropTableIfExists('payroll_adjustments');
}
exports.down = down;
