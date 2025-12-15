import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // Add tax_configuration_id to payroll_periods
     if (await knex.schema.hasTable('payroll_periods')) {
          const hasColumn = await knex.schema.hasColumn('payroll_periods', 'tax_configuration_id');
          if (!hasColumn) {
               await knex.schema.alterTable('payroll_periods', (table) => {
                    table.integer('tax_configuration_id').unsigned().nullable();
                    table.foreign('tax_configuration_id').references('id').inTable('payroll_tax_configuration').onDelete('SET NULL').onUpdate('CASCADE');
               });
          }
     }
}

export async function down(knex: Knex): Promise<void> {
     // Remove tax_configuration_id from payroll_periods
     if (await knex.schema.hasTable('payroll_periods')) {
          const hasColumn = await knex.schema.hasColumn('payroll_periods', 'tax_configuration_id');
          if (hasColumn) {
               await knex.schema.alterTable('payroll_periods', (table) => {
                    table.dropForeign(['tax_configuration_id']);
                    table.dropColumn('tax_configuration_id');
               });
          }
     }
}