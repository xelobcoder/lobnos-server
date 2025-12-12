import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // Tax Configuration
     if (!(await knex.schema.hasTable('payroll_tax_configuration'))) {
          await knex.schema.createTable('payroll_tax_configuration', (table) => {
               table.increments('id').primary().unsigned();
               table.string('tax_year', 4).notNullable();
               table.string('country', 50).defaultTo('Ghana');

               // Tax bands (JSON structure: [{min: 0, max: 4380, rate: 0}, {min: 4381, max: 6000, rate: 5}])
               table.json('tax_bands').notNullable();

               // Exemptions and reliefs
               table.decimal('standard_exemption', 10, 2).defaultTo(0);
               table.decimal('dependent_relief', 10, 2).defaultTo(0);
               table.decimal('disability_exemption', 10, 2).defaultTo(0);

               // Social security rates
               table.decimal('employee_ssnit_rate', 5, 2).defaultTo(5.5);
               table.decimal('employer_ssnit_rate', 5, 2).defaultTo(13);
               table.decimal('tier3_employee_rate', 5, 2).defaultTo(5);
               table.decimal('tier3_employer_rate', 5, 2).defaultTo(5);

               // Ceilings
               table.decimal('ssnit_ceiling', 10, 2).nullable();
               table.decimal('pension_ceiling', 10, 2).nullable();

               table.boolean('is_active').defaultTo(true);

               table.timestamp('created_at').defaultTo(knex.fn.now());
               table.timestamp('updated_at').defaultTo(knex.fn.now());
               table.integer('created_by').unsigned().nullable();

               table.foreign('created_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');

               table.unique('tax_year');
               table.index('is_active');
          });
     }

     // Employee Statutory Deductions
     if (!(await knex.schema.hasTable('payroll_employee_statutory_deductions'))) {
          await knex.schema.createTable('payroll_employee_statutory_deductions', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('employeeid').notNullable().unsigned();

               // SSNIT
               table.string('ssnit_number', 50).nullable().unique();
               table.boolean('ssnit_active').defaultTo(true);
               table.decimal('ssnit_employee_rate', 5, 2).defaultTo(5.5);

               // Tier 3 Pension
               table.boolean('tier3_enrolled').defaultTo(false);
               table.string('tier3_scheme_name', 100).nullable();
               table.string('tier3_scheme_number', 50).nullable();
               table.decimal('tier3_employee_rate', 5, 2).defaultTo(5);
               table.decimal('tier3_employer_rate', 5, 2).defaultTo(5);

               // Tax
               table.string('tin_number', 50).nullable().unique();
               table.boolean('tax_exempt').defaultTo(false);
               table.text('tax_exempt_reason').nullable();
               table.integer('dependents_count').defaultTo(0);

               // NHIS (National Health Insurance Scheme)
               table.string('nhis_number', 50).nullable();
               table.boolean('nhis_active').defaultTo(false);
               table.decimal('nhis_rate', 5, 2).defaultTo(2.5);

               table.timestamp('created_at').defaultTo(knex.fn.now());
               table.timestamp('updated_at').defaultTo(knex.fn.now());

               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');

               table.index('employeeid');
               table.index('ssnit_number');
               table.index('tin_number');
          });
     }

     // Employee Other Deductions
     if (!(await knex.schema.hasTable('payroll_employee_other_deductions'))) {
          await knex.schema.createTable('payroll_employee_other_deductions', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('employeeid').notNullable().unsigned();
               table.enum('deduction_type', [
                    'loan', 'advance', 'garnishment', 'union_dues', 'insurance',
                    'cooperative', 'welfare', 'savings', 'disciplinary', 'other'
               ]).notNullable();

               table.string('deduction_name', 100).notNullable();
               table.decimal('amount', 10, 2).notNullable();

               // Frequency and limits
               table.boolean('is_recurring').defaultTo(true);
               table.enum('frequency', ['monthly', 'bi-weekly', 'weekly', 'one-time']).defaultTo('monthly');
               table.decimal('total_amount', 10, 2).nullable(); // For loans/advances
               table.decimal('remaining_balance', 10, 2).nullable();

               // Priority (lower number = higher priority)
               table.integer('deduction_priority').defaultTo(10);

               // Dates
               table.date('start_date').notNullable();
               table.date('end_date').nullable();
               table.boolean('is_active').defaultTo(true);

               // Approval
               table.integer('approved_by').unsigned().nullable();
               table.date('approved_date').nullable();

               table.text('remarks').nullable();
               table.text('attachments').nullable(); // JSON array of file paths

               table.timestamp('created_at').defaultTo(knex.fn.now());
               table.timestamp('updated_at').defaultTo(knex.fn.now());

               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('approved_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');

               table.index('employeeid');
               table.index('is_active');
               table.index('deduction_type');
          });
     }

     // Payroll Periods
     if (!(await knex.schema.hasTable('payroll_periods'))) {
          await knex.schema.createTable('payroll_periods', (table) => {
               table.increments('id').primary().unsigned();
               table.string('period_name', 50).notNullable(); // e.g., "January 2024"
               table.integer('period_year').notNullable();
               table.integer('period_month').notNullable();

               table.date('period_start_date').notNullable();
               table.date('period_end_date').notNullable();
               table.date('payment_date').notNullable();

               // Attendance tracking period (may differ from payment period)
               table.date('attendance_start_date').notNullable();
               table.date('attendance_end_date').notNullable();

               table.enum('status', ['draft', 'calculated', 'approved', 'locked', 'paid']).defaultTo('draft');

               // Totals
               table.decimal('total_gross_salary', 12, 2).defaultTo(0);
               table.decimal('total_deductions', 12, 2).defaultTo(0);
               table.decimal('total_net_salary', 12, 2).defaultTo(0);
               table.integer('employee_count').defaultTo(0);

               // Approval workflow
               table.integer('calculated_by').unsigned().nullable();
               table.datetime('calculated_at').nullable();
               table.integer('approved_by').unsigned().nullable();
               table.datetime('approved_at').nullable();
               table.integer('locked_by').unsigned().nullable();
               table.datetime('locked_at').nullable();

               table.timestamp('created_at').defaultTo(knex.fn.now());
               table.timestamp('updated_at').defaultTo(knex.fn.now());

               table.foreign('calculated_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('approved_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('locked_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');

               table.unique(['period_year', 'period_month']);
               table.index('status');
               table.index(['period_start_date', 'period_end_date']);
          });
     }

     // Payroll Transactions (main payroll records)
     if (!(await knex.schema.hasTable('payroll_transactions'))) {
          await knex.schema.createTable('payroll_transactions', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('payroll_period_id').notNullable().unsigned();
               table.integer('employeeid').notNullable().unsigned();

               // Earnings breakdown
               table.decimal('basic_salary', 10, 2).defaultTo(0);
               table.decimal('hourly_earnings', 10, 2).defaultTo(0);
               table.decimal('overtime_earnings', 10, 2).defaultTo(0);
               table.decimal('commission_earnings', 10, 2).defaultTo(0);
               table.decimal('total_allowances', 10, 2).defaultTo(0);
               table.decimal('total_bonuses', 10, 2).defaultTo(0);
               table.decimal('gross_salary', 10, 2).notNullable();

               // Deductions breakdown
               table.decimal('income_tax', 10, 2).defaultTo(0);
               table.decimal('employee_ssnit', 10, 2).defaultTo(0);
               table.decimal('employer_ssnit', 10, 2).defaultTo(0);
               table.decimal('employee_tier3', 10, 2).defaultTo(0);
               table.decimal('employer_tier3', 10, 2).defaultTo(0);
               table.decimal('nhis', 10, 2).defaultTo(0);
               table.decimal('total_other_deductions', 10, 2).defaultTo(0);
               table.decimal('total_deductions', 10, 2).notNullable();

               // Final amounts
               table.decimal('net_salary', 10, 2).notNullable();
               table.decimal('employer_cost', 10, 2).notNullable(); // Total cost to employer

               // Attendance summary
               table.integer('days_worked').defaultTo(0);
               table.decimal('hours_worked', 5, 2).defaultTo(0);
               table.decimal('overtime_hours', 5, 2).defaultTo(0);
               table.integer('days_absent').defaultTo(0);
               table.integer('days_leave').defaultTo(0);

               // Status
               table.enum('status', ['pending', 'approved', 'paid', 'cancelled']).defaultTo('pending');
               table.date('payment_date').nullable();

               // Payment details
               table.enum('payment_method', ['bank_transfer', 'cash', 'cheque', 'mobile_money']).nullable();
               table.string('payment_reference', 100).nullable();

               // Detailed breakdown (JSON)
               table.json('allowances_detail').nullable(); // [{type, amount}]
               table.json('bonuses_detail').nullable(); // [{type, amount}]
               table.json('other_deductions_detail').nullable(); // [{type, amount}]

               table.timestamp('created_at').defaultTo(knex.fn.now());
               table.timestamp('updated_at').defaultTo(knex.fn.now());

               table.foreign('payroll_period_id').references('id').inTable('payroll_periods').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');

               table.unique(['payroll_period_id', 'employeeid']);
               table.index('status');
               table.index('payment_date');
          });
     }
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTableIfExists('payroll_transactions');
     await knex.schema.dropTableIfExists('payroll_periods');
     await knex.schema.dropTableIfExists('payroll_employee_other_deductions');
     await knex.schema.dropTableIfExists('payroll_employee_statutory_deductions');
     await knex.schema.dropTableIfExists('payroll_tax_configuration');
}
