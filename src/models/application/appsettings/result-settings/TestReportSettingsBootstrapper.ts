import KnexConnection from '../../../../database/KnexConnections';

export async function bootstrapTestReportSettingsTable(tenantId = 1): Promise<void> {
     const connection = await KnexConnection(tenantId);

     if (!await connection.schema.hasTable('test_report_settings')) {
          await connection.schema.createTable('test_report_settings', (table) => {
               table.increments('id').primary();
               table.integer('testid').unsigned().notNullable();
               table.text('resultsettings', 'longtext').notNullable();
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.unique(['testid'], 'uq_test_report_settings_testid');
          });
     }
}
