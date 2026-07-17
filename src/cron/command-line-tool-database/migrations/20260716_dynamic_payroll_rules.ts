import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     if (!(await knex.schema.hasTable('payroll_tax_reliefs'))) {
          await knex.schema.createTable('payroll_tax_reliefs', (table) => {
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
               table.timestamps(true, true);
          });
     }

     if (!(await knex.schema.hasTable('payroll_deduction_definitions'))) {
          await knex.schema.createTable('payroll_deduction_definitions', (table) => {
               table.increments('id').primary();
               table.string('deduction_code', 100).notNullable().unique();
               table.string('deduction_name', 150).notNullable();
               table.enum('default_calculation_method', ['fixed_amount', 'percentage_of_gross']).notNullable().defaultTo('fixed_amount');
               table.decimal('default_amount', 12, 2).nullable();
               table.boolean('is_statutory').notNullable().defaultTo(false);
               table.boolean('is_active').notNullable().defaultTo(true);
               table.integer('created_by').unsigned().nullable();
               table.integer('updated_by').unsigned().nullable();
               table.timestamps(true, true);
          });
     }

     if (await knex.schema.hasTable('payroll_employee_other_deductions')) {
          if (!(await knex.schema.hasColumn('payroll_employee_other_deductions', 'deduction_definition_id'))) {
               await knex.schema.alterTable('payroll_employee_other_deductions', (table) => {
                    table.integer('deduction_definition_id').unsigned().nullable().after('employeeid');
               });
          }
     }

     if (await knex.schema.hasTable('payroll_salary_grades')) {
          if (!(await knex.schema.hasColumn('payroll_salary_grades', 'role_name'))) {
               await knex.schema.alterTable('payroll_salary_grades', (table) => {
                    table.string('role_name', 100).nullable().after('grade_level');
               });
          }
     }
}

export async function down(knex: Knex): Promise<void> {
     if (await knex.schema.hasTable('payroll_salary_grades') && await knex.schema.hasColumn('payroll_salary_grades', 'role_name')) {
          await knex.schema.alterTable('payroll_salary_grades', (table) => {
               table.dropColumn('role_name');
          });
     }

     if (await knex.schema.hasTable('payroll_employee_other_deductions') && await knex.schema.hasColumn('payroll_employee_other_deductions', 'deduction_definition_id')) {
          await knex.schema.alterTable('payroll_employee_other_deductions', (table) => {
               table.dropColumn('deduction_definition_id');
          });
     }

     await knex.schema.dropTableIfExists('payroll_deduction_definitions');
     await knex.schema.dropTableIfExists('payroll_tax_reliefs');
}