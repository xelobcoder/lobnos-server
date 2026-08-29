import KnexConnection from '../../../database/KnexConnections';

export async function bootstrapInAppNotificationTables(tenantId: number): Promise<void> {
     const connection = await KnexConnection(tenantId);

     if (!(await connection.schema.hasTable('in_app_notifications'))) {
          await connection.schema.createTable('in_app_notifications', (table) => {
               table.increments('id').primary();
               table.string('event_code', 100).notNullable();
               table.string('module', 100).notNullable();
               table.string('title', 255).notNullable();
               table.text('message').notNullable();
               table.enum('priority', ['info', 'warning', 'critical']).notNullable().defaultTo('info');
               table.string('reference_type', 100).nullable();
               table.integer('reference_id').unsigned().nullable();
               table.integer('actor_employeeid').unsigned().nullable();
               table.string('action_url', 500).nullable();
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.index(['created_at'], 'idx_in_app_notifications_created_at');
               table.index(['module', 'created_at'], 'idx_in_app_notifications_module_created_at');
          });
     }

     if (!(await connection.schema.hasTable('in_app_notification_reads'))) {
          await connection.schema.createTable('in_app_notification_reads', (table) => {
               table.increments('id').primary();
               table.integer('notification_id').unsigned().notNullable();
               table.integer('employeeid').unsigned().notNullable();
               table.timestamp('read_at').nullable();
               table.timestamp('dismissed_at').nullable();
               table.timestamps(true, true);
               table.unique(['notification_id', 'employeeid'], 'uq_in_app_notification_read');
               table.index(['employeeid', 'read_at'], 'idx_in_app_notification_reads_employee_read');
               table.foreign('notification_id').references('id').inTable('in_app_notifications').onDelete('CASCADE');
          });
     }
}