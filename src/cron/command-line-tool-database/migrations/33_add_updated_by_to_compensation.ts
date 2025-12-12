import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // Add updated_by column to payroll_employee_compensation table
     await knex.schema.alterTable('payroll_employee_compensation', (table) => {
          table.integer('updated_by').unsigned().nullable();
          table.foreign('updated_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
     });
}

export async function down(knex: Knex): Promise<void> {
     // Remove updated_by column from payroll_employee_compensation table
     await knex.schema.alterTable('payroll_employee_compensation', (table) => {
          table.dropForeign('payroll_employee_compensation_updated_by_foreign');
          table.dropColumn('updated_by');
     });
}