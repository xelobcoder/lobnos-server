import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     if (!(await knex.schema.hasTable('payroll_tax_configuration'))) {
          return;
     }

     const hasStandardExemption = await knex.schema.hasColumn('payroll_tax_configuration', 'standard_exemption');
     const hasDependentRelief = await knex.schema.hasColumn('payroll_tax_configuration', 'dependent_relief');
     const hasDisabilityExemption = await knex.schema.hasColumn('payroll_tax_configuration', 'disability_exemption');

     if (!hasStandardExemption && !hasDependentRelief && !hasDisabilityExemption) {
          return;
     }

     await knex.schema.alterTable('payroll_tax_configuration', (table) => {
          if (hasStandardExemption) {
               table.dropColumn('standard_exemption');
          }

          if (hasDependentRelief) {
               table.dropColumn('dependent_relief');
          }

          if (hasDisabilityExemption) {
               table.dropColumn('disability_exemption');
          }
     });
}

export async function down(knex: Knex): Promise<void> {
     if (!(await knex.schema.hasTable('payroll_tax_configuration'))) {
          return;
     }

     if (!(await knex.schema.hasColumn('payroll_tax_configuration', 'standard_exemption'))) {
          await knex.schema.alterTable('payroll_tax_configuration', (table) => {
               table.decimal('standard_exemption', 12, 2).notNullable().defaultTo(0);
               table.decimal('dependent_relief', 12, 2).notNullable().defaultTo(0);
               table.decimal('disability_exemption', 12, 2).notNullable().defaultTo(0);
          });
     }
}