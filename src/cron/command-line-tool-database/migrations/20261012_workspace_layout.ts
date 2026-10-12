import { Knex } from 'knex';
import { WORKSPACE_LAYOUTS } from '../../../models/application/appsettings/workspaceLayout';

export async function up(knex: Knex): Promise<void> {
     if (await knex.schema.hasTable('applicationsettings') && !(await knex.schema.hasColumn('applicationsettings', 'workspaceLayout'))) {
          await knex.schema.alterTable('applicationsettings', table => {
               table.enu('workspaceLayout', [...WORKSPACE_LAYOUTS]).notNullable().defaultTo('classic');
          });
     }
}

export async function down(knex: Knex): Promise<void> {
     if (await knex.schema.hasTable('applicationsettings') && await knex.schema.hasColumn('applicationsettings', 'workspaceLayout')) {
          await knex.schema.alterTable('applicationsettings', table => {
               table.dropColumn('workspaceLayout');
          });
     }
}
