import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     if (await knex.schema.hasTable('applicationsettings') && !(await knex.schema.hasColumn('applicationsettings', 'commissionRecipientPolicy'))) {
          await knex.schema.alterTable('applicationsettings', (table) => {
               table.enu('commissionRecipientPolicy', ['clinician', 'organization']).notNullable().defaultTo('clinician');
          });
     }
}

export async function down(knex: Knex): Promise<void> {
     if (await knex.schema.hasTable('applicationsettings') && await knex.schema.hasColumn('applicationsettings', 'commissionRecipientPolicy')) {
          await knex.schema.alterTable('applicationsettings', (table) => {
               table.dropColumn('commissionRecipientPolicy');
          });
     }
}