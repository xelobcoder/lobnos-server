import { Knex } from 'knex';

const PREVIOUS_LAYOUTS = ['classic', 'zoho', 'claude', 'ribbon', 'slack'];

async function hasPortalLayout(knex: Knex): Promise<boolean | null> {
     if (!(await knex.schema.hasTable('applicationsettings')) ||
          !(await knex.schema.hasColumn('applicationsettings', 'workspaceLayout'))) return null;
     const [columns] = await knex.raw<[Array<{ Type: string }>, unknown]>(
          'SHOW COLUMNS FROM ?? WHERE Field = ?', ['applicationsettings', 'workspaceLayout']
     );
     if (!columns[0]) throw new Error('Unable to inspect workspaceLayout column');
     return columns[0].Type.includes("'portal'");
}

export async function up(knex: Knex): Promise<void> {
     if (await hasPortalLayout(knex) !== false) return;
     await knex.schema.alterTable('applicationsettings', table => {
          table.enu('workspaceLayout', [...PREVIOUS_LAYOUTS, 'portal']).notNullable().defaultTo('classic').alter();
     });
}

export async function down(knex: Knex): Promise<void> {
     if (await hasPortalLayout(knex) !== true) return;
     await knex('applicationsettings').where('workspaceLayout', 'portal').update({ workspaceLayout: 'classic' });
     await knex.schema.alterTable('applicationsettings', table => {
          table.enu('workspaceLayout', PREVIOUS_LAYOUTS).notNullable().defaultTo('classic').alter();
     });
}
