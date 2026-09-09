import KnexConnection from '../../database/KnexConnections';

export async function bootstrapPayrollTables(tenantId = 1): Promise<void> {
     const connection = await KnexConnection(tenantId);

     if (!(await connection.schema.hasTable('payroll_salary_grades'))) {
          await connection.schema.createTable('payroll_salary_grades', (table) => {
               table.increments('id').primary();
               table.string('grade_name', 100).notNullable().unique('unique_grade_name');
               table.string('grade_level', 50).notNullable();
               table.string('role_name', 100).nullable();
               table.decimal('min_salary', 10, 2).nullable();
               table.decimal('max_salary', 10, 2).nullable();
               table.text('description').nullable();
               table.string('currency', 3).defaultTo('GHS');
               table.boolean('is_active').defaultTo(true);
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.integer('created_by').unsigned().nullable();
               table.integer('updated_by').unsigned().nullable();
               table.foreign('created_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('updated_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('payroll_tax_configuration'))) {
          await connection.schema.createTable('payroll_tax_configuration', (table) => {
               table.increments('id').primary();
               table.string('tax_year', 4).notNullable().unique('unique_tax_year');
               table.string('country', 50).defaultTo('Ghana');
               table.text('tax_bands', 'longtext').notNullable();
               table.boolean('is_active').defaultTo(true);
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.integer('created_by').unsigned().nullable();
               table.integer('updated_by').unsigned().nullable();
               table.foreign('created_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('updated_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('payroll_tax_reliefs'))) {
          await connection.schema.createTable('payroll_tax_reliefs', (table) => {
               table.increments('id').primary();
               table.integer('tax_configuration_id').unsigned().nullable();
               table.string('relief_code', 100).nullable();
               table.string('relief_name', 150).notNullable();
               table.enum('calculation_method', ['fixed', 'per_dependent', 'percentage_of_gross']).notNullable().defaultTo('fixed');
               table.decimal('amount', 12, 2).notNullable().defaultTo(0);
               table.boolean('is_active').notNullable().defaultTo(true);
               table.boolean('requires_disability').notNullable().defaultTo(false);
               table.integer('created_by').unsigned().nullable();
               table.integer('updated_by').unsigned().nullable();
               table.timestamp('created_at').nullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').nullable().defaultTo(connection.fn.now());
          });
     }

     if (!(await connection.schema.hasTable('payroll_deduction_definitions'))) {
          await connection.schema.createTable('payroll_deduction_definitions', (table) => {
               table.increments('id').primary();
               table.string('deduction_code', 100).notNullable().unique('deduction_code');
               table.string('deduction_name', 150).notNullable();
               table.enum('default_calculation_method', ['fixed_amount', 'percentage_of_gross']).notNullable().defaultTo('fixed_amount');
               table.decimal('default_amount', 12, 2).nullable();
               table.enum('application_scope', ['all_employees', 'specific_employees', 'specific_roles']).notNullable().defaultTo('all_employees');
               table.json('target_employee_ids').nullable();
               table.json('target_roles').nullable();
               table.boolean('is_statutory').notNullable().defaultTo(false);
               table.boolean('is_active').notNullable().defaultTo(true);
               table.integer('created_by').unsigned().nullable();
               table.integer('updated_by').unsigned().nullable();
               table.timestamp('created_at').nullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').nullable().defaultTo(connection.fn.now());
          });
     }

     if (!(await connection.schema.hasTable('payroll_cost_centers'))) {
          await connection.schema.createTable('payroll_cost_centers', (table) => {
               table.increments('id').primary();
               table.string('cost_center_code', 50).notNullable().unique('cost_center_code');
               table.string('cost_center_name', 100).notNullable();
               table.enum('department', ['laboratory', 'radiology', 'front_desk', 'administration', 'finance', 'it', 'maintenance', 'security', 'management']).notNullable();
               table.integer('branch_id').unsigned().nullable();
               table.boolean('is_active').defaultTo(true);
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.foreign('branch_id').references('branchid').inTable('branch').onDelete('SET NULL').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('payroll_payslip_templates'))) {
          await connection.schema.createTable('payroll_payslip_templates', (table) => {
               table.increments('id').primary();
               table.string('template_name', 100).notNullable();
               table.text('template_html').notNullable();
               table.boolean('show_employer_contributions').defaultTo(true);
               table.boolean('show_cost_center').defaultTo(false);
               table.boolean('show_attendance_summary').defaultTo(true);
               table.boolean('show_ytd_totals').defaultTo(true);
               table.text('custom_fields', 'longtext').nullable();
               table.boolean('is_default').defaultTo(false);
               table.boolean('is_active').defaultTo(true);
               table.integer('created_by').unsigned().nullable();
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.foreign('created_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('payroll_periods'))) {
          await connection.schema.createTable('payroll_periods', (table) => {
               table.increments('id').primary();
               table.string('period_name', 50).notNullable();
               table.integer('period_year').notNullable();
               table.integer('period_month').notNullable();
               table.date('period_start_date').notNullable();
               table.date('period_end_date').notNullable();
               table.date('payment_date').notNullable();
               table.date('attendance_start_date').notNullable();
               table.date('attendance_end_date').notNullable();
               table.enum('status', ['draft', 'calculated', 'approved', 'locked', 'paid']).defaultTo('draft');
               table.decimal('total_gross_salary', 12, 2).defaultTo(0);
               table.decimal('total_deductions', 12, 2).defaultTo(0);
               table.decimal('total_net_salary', 12, 2).defaultTo(0);
               table.integer('employee_count').defaultTo(0);
               table.integer('calculated_by').unsigned().nullable();
               table.dateTime('calculated_at').nullable();
               table.integer('approved_by').unsigned().nullable();
               table.dateTime('approved_at').nullable();
               table.integer('locked_by').unsigned().nullable();
               table.dateTime('locked_at').nullable();
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.integer('tax_configuration_id').unsigned().nullable();
               table.boolean('expense_synced').notNullable().defaultTo(false);
               table.integer('expense_id').nullable();
               table.integer('expense_invoice_id').nullable();
               table.integer('expense_payment_id').nullable();
               table.boolean('was_reversed').defaultTo(false);
               table.dateTime('reversed_at').nullable();
               table.integer('last_reversal_id').nullable();
               table.unique(['period_year', 'period_month'], 'unique_period');
               table.foreign('calculated_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('approved_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('locked_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('tax_configuration_id').references('id').inTable('payroll_tax_configuration').onDelete('SET NULL').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('payroll_transactions'))) {
          await connection.schema.createTable('payroll_transactions', (table) => {
               table.increments('id').primary();
               table.integer('payroll_period_id').unsigned().notNullable();
               table.integer('employeeid').unsigned().notNullable();
               table.decimal('basic_salary', 10, 2).defaultTo(0);
               table.decimal('hourly_earnings', 10, 2).defaultTo(0);
               table.decimal('overtime_earnings', 10, 2).defaultTo(0);
               table.decimal('commission_earnings', 10, 2).defaultTo(0);
               table.decimal('total_allowances', 10, 2).defaultTo(0);
               table.decimal('total_bonuses', 10, 2).defaultTo(0);
               table.decimal('gross_salary', 10, 2).notNullable();
               table.decimal('income_tax', 10, 2).defaultTo(0);
               table.decimal('total_other_deductions', 10, 2).defaultTo(0);
               table.decimal('total_deductions', 10, 2).notNullable();
               table.decimal('net_salary', 10, 2).notNullable();
               table.decimal('employer_cost', 10, 2).notNullable();
               table.integer('days_worked').defaultTo(0);
               table.decimal('hours_worked', 5, 2).defaultTo(0);
               table.decimal('overtime_hours', 5, 2).defaultTo(0);
               table.integer('days_absent').defaultTo(0);
               table.integer('days_leave').defaultTo(0);
               table.enum('status', ['pending', 'approved', 'paid', 'cancelled']).defaultTo('pending');
               table.date('payment_date').nullable();
               table.enum('payment_method', ['bank_transfer', 'cash', 'cheque', 'mobile_money']).nullable();
               table.string('payment_reference', 100).nullable();
               table.text('allowances_detail', 'longtext').nullable();
               table.text('bonuses_detail', 'longtext').nullable();
               table.text('other_deductions_detail', 'longtext').nullable();
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.unique(['payroll_period_id', 'employeeid'], 'unique_period_employee');
               table.foreign('payroll_period_id').references('id').inTable('payroll_periods').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('payroll_employee_compensation'))) {
          await connection.schema.createTable('payroll_employee_compensation', (table) => {
               table.increments('id').primary();
               table.integer('employeeid').unsigned().notNullable();
               table.enum('compensation_type', ['salary', 'hourly', 'commission', 'hybrid']).notNullable();
               table.decimal('basic_salary', 10, 2).nullable();
               table.integer('salary_grade_id').unsigned().nullable();
               table.string('currency', 10).defaultTo('GHS');
               table.decimal('hourly_rate', 10, 2).nullable();
               table.decimal('overtime_rate_multiplier', 3, 2).defaultTo(1.5);
               table.decimal('commission_percentage', 5, 2).nullable();
               table.decimal('commission_target', 10, 2).nullable();
               table.enum('payment_frequency', ['monthly', 'bi-weekly', 'weekly']).defaultTo('monthly');
               table.enum('payment_method', ['bank_transfer', 'cash', 'cheque', 'mobile_money']).defaultTo('bank_transfer');
               table.string('bank_account_number', 50).nullable();
               table.string('bank_name', 100).nullable();
               table.string('bank_branch', 100).nullable();
               table.string('mobile_money_number', 15).nullable();
               table.date('effective_from').notNullable();
               table.date('effective_to').nullable();
               table.boolean('is_active').defaultTo(true);
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.integer('created_by').unsigned().nullable();
               table.integer('updated_by').unsigned().nullable();
               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('salary_grade_id').references('id').inTable('payroll_salary_grades').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('created_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('updated_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('payroll_employee_allowances'))) {
          await connection.schema.createTable('payroll_employee_allowances', (table) => {
               table.increments('id').primary();
               table.integer('employeeid').unsigned().notNullable();
               table.enum('allowance_type', ['housing', 'risk', 'transport', 'meal', 'medical', 'education', 'uniform', 'mobile', 'hazard', 'shift_allowance', 'professional_development', 'responsibillity', 'hardship', 'acting', 'other', 'utility']).notNullable();
               table.decimal('amount', 10, 2).notNullable();
               table.enum('calculation_method', ['fixed', 'percentage_of_basic', 'variable']).defaultTo('fixed');
               table.decimal('percentage', 5, 2).nullable();
               table.boolean('is_recurring').defaultTo(true);
               table.enum('frequency', ['monthly', 'quarterly', 'annually', 'one-time']).defaultTo('monthly');
               table.boolean('is_taxable').defaultTo(true);
               table.date('effective_from').notNullable();
               table.date('effective_to').nullable();
               table.boolean('is_active').defaultTo(true);
               table.integer('approved_by').unsigned().nullable();
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('approved_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('payroll_employee_bonuses'))) {
          await connection.schema.createTable('payroll_employee_bonuses', (table) => {
               table.increments('id').primary();
               table.integer('employeeid').unsigned().notNullable();
               table.enum('bonus_type', ['performance', 'annual', 'project', 'retention', 'holiday', 'spot']).notNullable();
               table.decimal('amount', 10, 2).notNullable();
               table.date('start_date').nullable();
               table.date('end_date').nullable();
               table.boolean('is_taxable').defaultTo(true);
               table.enum('tax_method', ['aggregate', 'separate', 'bonus_rate']).defaultTo('aggregate');
               table.enum('status', ['pending', 'approved', 'rejected', 'paid']).defaultTo('pending');
               table.integer('approved_by').unsigned().nullable();
               table.date('approved_date').nullable();
               table.text('reason').nullable();
               table.decimal('performance_rating', 3, 2).nullable();
               table.date('payment_date').nullable();
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('approved_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('payroll_employee_attendance'))) {
          await connection.schema.createTable('payroll_employee_attendance', (table) => {
               table.increments('id').primary();
               table.integer('employeeid').unsigned().notNullable();
               table.date('attendance_date').notNullable();
               table.time('clock_in').nullable();
               table.time('clock_out').nullable();
               table.decimal('total_hours', 5, 2).nullable();
               table.enum('shift_type', ['regular', 'night', 'weekend', 'holiday']).defaultTo('regular');
               table.enum('work_location', ['on-site', 'remote', 'field']).defaultTo('on-site');
               table.enum('status', ['present', 'absent', 'half-day', 'late', 'early_departure']).defaultTo('present');
               table.integer('late_minutes').defaultTo(0);
               table.decimal('overtime_hours', 5, 2).defaultTo(0);
               table.boolean('overtime_approved').defaultTo(false);
               table.integer('overtime_approved_by').unsigned().nullable();
               table.text('remarks').nullable();
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.unique(['employeeid', 'attendance_date'], 'unique_employee_date');
               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('overtime_approved_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('payroll_employee_leave'))) {
          await connection.schema.createTable('payroll_employee_leave', (table) => {
               table.increments('id').primary();
               table.integer('employeeid').unsigned().notNullable();
               table.enum('leave_type', ['annual', 'sick', 'maternity', 'paternity', 'unpaid', 'study', 'compassionate']).notNullable();
               table.date('start_date').notNullable();
               table.date('end_date').notNullable();
               table.integer('total_days').notNullable();
               table.enum('status', ['pending', 'approved', 'rejected', 'cancelled']).defaultTo('pending');
               table.date('applied_date').notNullable();
               table.integer('approved_by').unsigned().nullable();
               table.date('approved_date').nullable();
               table.boolean('affects_salary').defaultTo(false);
               table.text('reason').nullable();
               table.text('attachments').nullable();
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('approved_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('payroll_employee_leave_balance'))) {
          await connection.schema.createTable('payroll_employee_leave_balance', (table) => {
               table.increments('id').primary();
               table.integer('employeeid').unsigned().notNullable();
               table.integer('leave_year').notNullable();
               table.integer('annual_leave_entitlement').defaultTo(21);
               table.integer('sick_leave_entitlement').defaultTo(14);
               table.integer('annual_leave_taken').defaultTo(0);
               table.integer('annual_leave_balance').defaultTo(21);
               table.integer('sick_leave_taken').defaultTo(0);
               table.integer('sick_leave_balance').defaultTo(14);
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.unique(['employeeid', 'leave_year'], 'unique_employee_year');
               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('payroll_employee_statutory_deductions'))) {
          await connection.schema.createTable('payroll_employee_statutory_deductions', (table) => {
               table.increments('id').primary();
               table.integer('employeeid').unsigned().notNullable();
               table.string('ssnit_number', 50).nullable().unique('ssnit_number');
               table.boolean('ssnit_active').defaultTo(true);
               table.decimal('ssnit_employee_rate', 5, 2).defaultTo(5.5);
               table.boolean('tier3_enrolled').defaultTo(false);
               table.string('tier3_scheme_name', 100).nullable();
               table.string('tier3_scheme_number', 50).nullable();
               table.decimal('tier3_employee_rate', 5, 2).defaultTo(5);
               table.decimal('tier3_employer_rate', 5, 2).defaultTo(5);
               table.string('tin_number', 50).nullable().unique('tin_number');
               table.boolean('tax_exempt').defaultTo(false);
               table.text('tax_exempt_reason').nullable();
               table.integer('dependents_count').defaultTo(0);
               table.string('nhis_number', 50).nullable();
               table.boolean('nhis_active').defaultTo(false);
               table.decimal('nhis_rate', 5, 2).defaultTo(2.5);
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('payroll_employee_other_deductions'))) {
          await connection.schema.createTable('payroll_employee_other_deductions', (table) => {
               table.increments('id').primary();
               table.integer('employeeid').unsigned().notNullable();
               table.integer('deduction_definition_id').unsigned().nullable();
               table.string('deduction_type', 100).notNullable();
               table.string('deduction_name', 100).notNullable();
               table.decimal('amount', 10, 2).notNullable();
               table.boolean('is_recurring').defaultTo(true);
               table.enum('frequency', ['monthly', 'bi-weekly', 'weekly', 'one-time']).defaultTo('monthly');
               table.decimal('total_amount', 10, 2).nullable();
               table.decimal('remaining_balance', 10, 2).nullable();
               table.integer('deduction_priority').defaultTo(10);
               table.date('start_date').notNullable();
               table.date('end_date').nullable();
               table.boolean('is_active').defaultTo(true);
               table.integer('approved_by').unsigned().nullable();
               table.date('approved_date').nullable();
               table.text('remarks').nullable();
               table.text('attachments').nullable();
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.foreign('deduction_definition_id').references('id').inTable('payroll_deduction_definitions').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('approved_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('payroll_employee_other_deduction_ledger'))) {
          await connection.schema.createTable('payroll_employee_other_deduction_ledger', (table) => {
               table.increments('id').primary();
               table.integer('deduction_id').unsigned().notNullable();
               table.integer('payroll_period_id').unsigned().nullable();
               table.integer('payroll_transaction_id').unsigned().nullable();
               table.integer('employeeid').unsigned().notNullable();
               table.decimal('payment_amount', 10, 2).notNullable();
               table.decimal('balance_before', 10, 2).notNullable();
               table.decimal('balance_after', 10, 2).notNullable();
               table.enum('entry_type', ['payroll_payment', 'manual_adjustment', 'reversal']).notNullable().defaultTo('payroll_payment');
               table.string('notes', 255).nullable();
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.foreign('deduction_id').references('id').inTable('payroll_employee_other_deductions').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('payroll_period_id').references('id').inTable('payroll_periods').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('payroll_transaction_id').references('id').inTable('payroll_transactions').onDelete('SET NULL').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('payroll_employee_cost_center_allocation'))) {
          await connection.schema.createTable('payroll_employee_cost_center_allocation', (table) => {
               table.increments('id').primary();
               table.integer('employeeid').unsigned().notNullable();
               table.integer('cost_center_id').unsigned().notNullable();
               table.decimal('allocation_percentage', 5, 2).notNullable().defaultTo(100);
               table.date('effective_from').notNullable();
               table.date('effective_to').nullable();
               table.boolean('is_active').defaultTo(true);
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('cost_center_id').references('id').inTable('payroll_cost_centers').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('payroll_employee_payslip_access'))) {
          await connection.schema.createTable('payroll_employee_payslip_access', (table) => {
               table.increments('id').primary();
               table.integer('employeeid').unsigned().notNullable();
               table.integer('payroll_transaction_id').unsigned().notNullable();
               table.dateTime('accessed_at').notNullable();
               table.string('ip_address', 45).nullable();
               table.string('user_agent', 255).nullable();
               table.enum('access_type', ['view', 'download', 'email']).notNullable();
               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('payroll_transaction_id').references('id').inTable('payroll_transactions').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('payroll_adjustments'))) {
          await connection.schema.createTable('payroll_adjustments', (table) => {
               table.increments('id').primary();
               table.integer('payroll_transaction_id').unsigned().notNullable();
               table.integer('employeeid').unsigned().notNullable();
               table.enum('adjustment_type', ['earning', 'deduction']).notNullable();
               table.enum('adjustment_category', ['arrears', 'correction', 'refund', 'advance_recovery', 'retroactive_payment', 'overpayment_recovery', 'manual_adjustment']).notNullable();
               table.string('description', 255).notNullable();
               table.decimal('amount', 10, 2).notNullable();
               table.boolean('is_taxable').defaultTo(true);
               table.boolean('affects_ssnit').defaultTo(true);
               table.enum('status', ['pending', 'approved', 'rejected']).defaultTo('pending');
               table.integer('requested_by').unsigned().notNullable();
               table.integer('approved_by').unsigned().nullable();
               table.date('approved_date').nullable();
               table.text('justification').nullable();
               table.text('attachments').nullable();
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.foreign('payroll_transaction_id').references('id').inTable('payroll_transactions').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('requested_by').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('approved_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('payroll_period_reversals'))) {
          await connection.schema.createTable('payroll_period_reversals', (table) => {
               table.increments('id').primary();
               table.integer('payroll_period_id').unsigned().notNullable();
               table.integer('reversed_by').unsigned().notNullable();
               table.integer('branchid').unsigned().nullable();
               table.text('reason').nullable();
               table.string('previous_status', 20).notNullable();
               table.string('reverted_to_status', 20).notNullable();
               table.integer('expense_id').unsigned().nullable();
               table.integer('invoice_id').unsigned().nullable();
               table.integer('payment_id').unsigned().nullable();
               table.integer('expense_payment_reversal_id').unsigned().nullable();
               table.json('metadata').nullable();
               table.timestamp('created_at').nullable().defaultTo(connection.fn.now());
               table.foreign('payroll_period_id').references('id').inTable('payroll_periods').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('reversed_by').references('employeeid').inTable('roles').onDelete('RESTRICT').onUpdate('CASCADE');
               table.foreign('expense_id').references('id').inTable('expensesrecord').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('invoice_id').references('id').inTable('invoices').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('payment_id').references('id').inTable('expense_payments').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('expense_payment_reversal_id').references('id').inTable('expense_payment_reversals').onDelete('SET NULL').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('payroll_period_errors'))) {
          await connection.schema.createTable('payroll_period_errors', (table) => {
               table.increments('id').primary();
               table.integer('payroll_period_id').unsigned().notNullable();
               table.string('error_type', 80).notNullable();
               table.text('error_message').notNullable();
               table.text('stack').nullable();
               table.integer('created_by').unsigned().nullable();
               table.integer('branchid').unsigned().nullable();
               table.integer('reversal_id').unsigned().nullable();
               table.json('metadata').nullable();
               table.timestamp('created_at').nullable().defaultTo(connection.fn.now());
               table.foreign('created_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('payroll_period_id').references('id').inTable('payroll_periods').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('reversal_id').references('id').inTable('payroll_period_reversals').onDelete('SET NULL').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('payroll_audit_log'))) {
          await connection.schema.createTable('payroll_audit_log', (table) => {
               table.increments('id').primary();
               table.integer('employeeid').unsigned().nullable();
               table.integer('payroll_period_id').unsigned().nullable();
               table.integer('payroll_transaction_id').unsigned().nullable();
               table.enum('action_type', ['period_created', 'period_calculated', 'period_approved', 'period_locked', 'period_paid', 'transaction_created', 'transaction_updated', 'transaction_approved', 'transaction_paid', 'adjustment_added', 'adjustment_approved', 'allowance_added', 'deduction_added', 'compensation_updated', 'statutory_updated', 'tax_config_updated']).notNullable();
               table.string('entity_type', 50).notNullable();
               table.integer('entity_id').unsigned().notNullable();
               table.text('old_values', 'longtext').nullable();
               table.text('new_values', 'longtext').nullable();
               table.text('description').nullable();
               table.string('ip_address', 45).nullable();
               table.string('user_agent', 255).nullable();
               table.integer('performed_by').unsigned().notNullable();
               table.timestamp('performed_at').notNullable().defaultTo(connection.fn.now());
               table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('payroll_period_id').references('id').inTable('payroll_periods').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('payroll_transaction_id').references('id').inTable('payroll_transactions').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('performed_by').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }
}
