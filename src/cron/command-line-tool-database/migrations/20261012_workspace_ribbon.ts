import { Knex } from 'knex';
import { WORKSPACE_LAYOUTS } from '../../../models/application/appsettings/workspaceLayout';

async function hasRibbonLayout(knex: Knex): Promise<boolean | null> {
     if (!(await knex.schema.hasTable('applicationsettings')) ||
          !(await knex.schema.hasColumn('applicationsettings', 'workspaceLayout'))) return null;
     const [columns] = await knex.raw<[Array<{ Type: string }>, unknown]>(
          'SHOW COLUMNS FROM ?? WHERE Field = ?', ['applicationsettings', 'workspaceLayout']
     );
     if (!columns[0]) throw new Error('Unable to inspect workspaceLayout column');
     return columns[0].Type.includes("'ribbon'");
}

export async function up(knex: Knex): Promise<void> {
     if (await hasRibbonLayout(knex) !== false) return;
     await knex.schema.alterTable('applicationsettings', table => {
          table.enu('workspaceLayout', [...WORKSPACE_LAYOUTS]).notNullable().defaultTo('classic').alter();
     });
}

export async function down(knex: Knex): Promise<void> {
     if (await hasRibbonLayout(knex) !== true) return;
     // MySQL ENUM narrowing must follow normalization of the removed value.
     await knex('applicationsettings').where({ workspaceLayout: 'ribbon' }).update({ workspaceLayout: 'classic' });
     await knex.schema.alterTable('applicationsettings', table => {
          table.enu('workspaceLayout', ['classic', 'zoho', 'claude']).notNullable().defaultTo('classic').alter();
     });
}
