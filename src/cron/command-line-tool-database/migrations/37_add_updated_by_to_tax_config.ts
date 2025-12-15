import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // Add updated_by to payroll_tax_configuration
     if (await knex.schema.hasTable('payroll_tax_configuration')) {
          const hasColumn = await knex.schema.hasColumn('payroll_tax_configuration', 'updated_by');
          if (!hasColumn) {
               await knex.schema.alterTable('payroll_tax_configuration', (table) => {
                    table.integer('updated_by').unsigned().nullable();
                    table.foreign('updated_by').references('employeeid').inTable('roles').onDelete('SET NULL').onUpdate('CASCADE');
               });
          }
     }
}

export async function down(knex: Knex): Promise<void> {
     // Remove updated_by from payroll_tax_configuration
     if (await knex.schema.hasTable('payroll_tax_configuration')) {
          const hasColumn = await knex.schema.hasColumn('payroll_tax_configuration', 'updated_by');
          if (hasColumn) {
               await knex.schema.alterTable('payroll_tax_configuration', (table) => {
                    table.dropForeign(['updated_by']);
                    table.dropColumn('updated_by');
               });
          }
     }
}