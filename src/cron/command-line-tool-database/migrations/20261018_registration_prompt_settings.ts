import { Knex } from 'knex';

const PROMPT_COLUMNS = ['homeCollectionPromptEnabled', 'resultDeliveryPromptEnabled'] as const;

export async function up(knex: Knex): Promise<void> {
     if (!(await knex.schema.hasTable('applicationsettings'))) return;
     for (const column of PROMPT_COLUMNS) {
          if (!(await knex.schema.hasColumn('applicationsettings', column))) {
               await knex.schema.alterTable('applicationsettings', (table) => {
                    table.boolean(column).notNullable().defaultTo(false);
               });
          }
     }
}

export async function down(knex: Knex): Promise<void> {
     if (!(await knex.schema.hasTable('applicationsettings'))) return;
     for (const column of PROMPT_COLUMNS) {
          if (await knex.schema.hasColumn('applicationsettings', column)) {
               await knex.schema.alterTable('applicationsettings', (table) => {
                    table.dropColumn(column);
               });
          }
     }
}
