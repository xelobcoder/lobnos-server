import KnexConnection from '../../../database/KnexConnections';

export async function bootstrapApplicationSettings(tenantId = 1): Promise<void> {
     const connection = await KnexConnection(tenantId);

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
          ];

          for (const column of columns) {
               if (!(await connection.schema.hasColumn('applicationsettings', column.name))) {
                    await connection.schema.alterTable('applicationsettings', column.add);
               }
          }
     }
}
