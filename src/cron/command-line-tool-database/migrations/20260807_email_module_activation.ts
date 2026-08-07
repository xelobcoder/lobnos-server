import { Knex } from 'knex';

const TABLE_NAME = 'applicationsettings';
const COLUMN_NAME = 'emailModuleActivated';

export async function up(knex: Knex): Promise<void> {
     const hasTable = await knex.schema.hasTable(TABLE_NAME);
     if (!hasTable) return;

     const hasColumn = await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME);
     if (!hasColumn) {
          await knex.schema.alterTable(TABLE_NAME, (table) => {
               table.boolean(COLUMN_NAME).notNullable().defaultTo(false);
          });
     }
}

export async function down(knex: Knex): Promise<void> {
     const hasTable = await knex.schema.hasTable(TABLE_NAME);
     if (!hasTable) return;

     const hasColumn = await knex.schema.hasColumn(TABLE_NAME, COLUMN_NAME);
     if (hasColumn) {
          await knex.schema.alterTable(TABLE_NAME, (table) => {
               table.dropColumn(COLUMN_NAME);
          });
     }
}
