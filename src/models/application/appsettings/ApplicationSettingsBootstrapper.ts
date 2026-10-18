import KnexConnection from '../../../database/KnexConnections';
import { up as migrateWorkspaceLayout } from '../../../cron/command-line-tool-database/migrations/20261012_workspace_layout';
import { up as migrateWorkspaceRibbon } from '../../../cron/command-line-tool-database/migrations/20261012_workspace_ribbon';
import { up as migrateWorkspacePortal } from '../../../cron/command-line-tool-database/migrations/20261018_workspace_portal';
import { up as migrateRegistrationPrompts } from '../../../cron/command-line-tool-database/migrations/20261018_registration_prompt_settings';
import { up as migrateStaffPinSecurity } from '../../../cron/command-line-tool-database/migrations/20261018_staff_pin_security';

export async function bootstrapApplicationSettings(tenantId = 1): Promise<void> {
     const connection = await KnexConnection(tenantId);
     await migrateWorkspaceLayout(connection);
     await migrateWorkspaceRibbon(connection);
     await migrateWorkspacePortal(connection);
     await migrateRegistrationPrompts(connection);
     await migrateStaffPinSecurity(connection);

     if (await connection.schema.hasTable('applicationsettings')) {
          const columns: Array<{ name: string; add: (table: any) => void }> = [
               { name: 'allowCrmToPrintResult', add: (table) => table.boolean('allowCrmToPrintResult').notNullable().defaultTo(false) },
               { name: 'headerColor', add: (table) => table.string('headerColor', 32).nullable() },
               { name: 'sidebarColor', add: (table) => table.string('sidebarColor', 32).nullable() },
               { name: 'pageBackgroundColor', add: (table) => table.string('pageBackgroundColor', 32).nullable() },
               { name: 'headerTextColor', add: (table) => table.string('headerTextColor', 32).nullable() },
               { name: 'sidebarTextColor', add: (table) => table.string('sidebarTextColor', 32).nullable() },
               { name: 'primaryColor', add: (table) => table.string('primaryColor', 32).nullable() },
               { name: 'secondaryColor', add: (table) => table.string('secondaryColor', 32).nullable() },
               { name: 'commissionRecipientPolicy', add: (table) => table.enu('commissionRecipientPolicy', ['clinician', 'organization']).notNullable().defaultTo('clinician') },
               { name: 'moduleConfiguration', add: (table) => table.text('moduleConfiguration', 'longtext').nullable() },
          ];

          for (const column of columns) {
               if (!(await connection.schema.hasColumn('applicationsettings', column.name))) {
                    await connection.schema.alterTable('applicationsettings', column.add);
               }
          }
     }
}
