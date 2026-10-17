import { Knex } from 'knex';
import { WORKSPACE_LAYOUTS } from '../../../models/application/appsettings/workspaceLayout';

async function hasAllWorkspaceLayouts(knex: Knex): Promise<boolean | null> {
     if (!(await knex.schema.hasTable('applicationsettings')) ||
          !(await knex.schema.hasColumn('applicationsettings', 'workspaceLayout'))) return null;
     const [columns] = await knex.raw<[Array<{ Type: string }>, unknown]>(
          'SHOW COLUMNS FROM ?? WHERE Field = ?', ['applicationsettings', 'workspaceLayout']
     );
     if (!columns[0]) throw new Error('Unable to inspect workspaceLayout column');
     return WORKSPACE_LAYOUTS.every(layout => columns[0].Type.includes(`'${layout}'`));
}

export async function up(knex: Knex): Promise<void> {
     if (await hasAllWorkspaceLayouts(knex) !== false) return;
     await knex.schema.alterTable('applicationsettings', table => {
          table.enu('workspaceLayout', [...WORKSPACE_LAYOUTS]).notNullable().defaultTo('classic').alter();
     });
}

export async function down(knex: Knex): Promise<void> {
     if (await hasAllWorkspaceLayouts(knex) !== true) return;
     // MySQL ENUM narrowing must follow normalization of the removed value.
     await knex('applicationsettings').whereIn('workspaceLayout', ['ribbon', 'slack']).update({ workspaceLayout: 'classic' });
     await knex.schema.alterTable('applicationsettings', table => {
          table.enu('workspaceLayout', ['classic', 'zoho', 'claude']).notNullable().defaultTo('classic').alter();
     });
}
