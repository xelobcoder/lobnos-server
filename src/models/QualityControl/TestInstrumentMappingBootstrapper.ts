import KnexConnection from '../../database/KnexConnections';

/** Call for every served tenant, including tenants whose normal startup migrations are skipped. */
export async function bootstrapTestInstrumentMapping(tenantId: number): Promise<void> {
     const db = await KnexConnection(tenantId);
     if (!await db.schema.hasTable('test_panels') || !await db.schema.hasTable('devices'))
          throw new Error('Test instrument mapping requires test_panels and devices');
     if (!await db.schema.hasTable('pls_test_instrument_config')) {
          await db.schema.createTable('pls_test_instrument_config', table => {
               table.charset('utf8mb4'); table.collate('utf8mb4_unicode_ci');
               table.integer('testid').notNullable().primary();
               table.enu('mode', ['manual', 'instrument']).notNullable();
               table.integer('version').unsigned().notNullable();
               table.foreign('testid').references('test_panels.id').onDelete('RESTRICT').onUpdate('RESTRICT');
          });
     }
     if (!await db.schema.hasTable('pls_test_instruments')) {
          await db.schema.createTable('pls_test_instruments', table => {
               table.charset('utf8mb4'); table.collate('utf8mb4_unicode_ci');
               table.integer('testid').notNullable();
               table.specificType('device_id', 'CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci').notNullable();
               table.primary(['testid', 'device_id']);
               table.foreign('testid').references('pls_test_instrument_config.testid').onDelete('RESTRICT');
               table.foreign('device_id').references('devices.id').onDelete('RESTRICT').onUpdate('RESTRICT');
               table.index('device_id');
          });
     }
     if (!await db.schema.hasTable('pls_test_instrument_history')) {
          await db.schema.createTable('pls_test_instrument_history', table => {
               table.charset('utf8mb4'); table.collate('utf8mb4_unicode_ci');
               table.increments('id').primary();
               table.integer('testid').notNullable();
               table.integer('actor_id').unsigned().notNullable();
               table.string('reason', 1000).notNullable();
               table.text('before_data', 'longtext').nullable();
               table.text('after_data', 'longtext').notNullable();
               table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
               table.index(['testid', 'id']);
               table.foreign('testid').references('test_panels.id').onDelete('RESTRICT');
          });
     }
}
