import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     if (!(await knex.schema.hasTable('payroll_tax_configuration'))) {
          return;
     }

     const columns = [
          'employee_ssnit_rate',
          'employer_ssnit_rate',
          'tier3_employee_rate',
          'tier3_employer_rate',
          'ssnit_ceiling',
          'pension_ceiling'
     ];

     const existingColumns: string[] = [];
     for (const column of columns) {
          if (await knex.schema.hasColumn('payroll_tax_configuration', column)) {
               existingColumns.push(column);
          }
     }

     if (existingColumns.length === 0) {
          return;
     }

     await knex.schema.alterTable('payroll_tax_configuration', (table) => {
          for (const column of existingColumns) {
               table.dropColumn(column);
          }
     });
}

export async function down(knex: Knex): Promise<void> {
     if (!(await knex.schema.hasTable('payroll_tax_configuration'))) {
          return;
     }

     const hasEmployee = await knex.schema.hasColumn('payroll_tax_configuration', 'employee_ssnit_rate');
     if (!hasEmployee) {
          await knex.schema.alterTable('payroll_tax_configuration', (table) => {
               table.decimal('employee_ssnit_rate', 12, 2).notNullable().defaultTo(0);
               table.decimal('employer_ssnit_rate', 12, 2).notNullable().defaultTo(0);
               table.decimal('tier3_employee_rate', 12, 2).notNullable().defaultTo(0);
               table.decimal('tier3_employer_rate', 12, 2).notNullable().defaultTo(0);
               table.decimal('ssnit_ceiling', 12, 2).nullable();
               table.decimal('pension_ceiling', 12, 2).nullable();
          });
     }
}