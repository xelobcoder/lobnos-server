import KnexConnection from '../../database/KnexConnections';

const TABLES = {
     schedules: 'pls_instrument_maintenance_schedules',
     checklist: 'pls_instrument_maintenance_checklist',
     runs: 'pls_instrument_maintenance_runs',
     checks: 'pls_instrument_maintenance_checks',
     actions: 'pls_instrument_corrective_actions',
} as const;

/** Idempotent tenant upgrade. All DDL uses the tenant's established Knex connection. */
export async function bootstrapInstrumentMaintenance(tenantId: number): Promise<void> {
     const db = await KnexConnection(tenantId);
     if (!await db.schema.hasTable('devices')) {
          throw new Error('Instrument maintenance requires the QC devices registry');
     }
     if (!await db.schema.hasTable(TABLES.schedules)) {
          await db.schema.createTable(TABLES.schedules, (table: any) => {
               table.increments('id').primary();
               table.specificType('device_id', 'CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci').notNullable().unique();
               table.enu('frequency', ['daily', 'weekly', 'monthly', 'quarterly', 'annual']).notNullable();
               table.integer('interval').unsigned().notNullable().defaultTo(1);
               table.date('next_due_date').notNullable();
               table.boolean('active').notNullable().defaultTo(true);
               table.integer('created_by').unsigned().notNullable();
               table.integer('updated_by').unsigned().notNullable();
               table.timestamps(true, true);
               table.dateTime('last_completed_at').nullable();
               table.foreign('device_id').references('devices.id').onDelete('RESTRICT').onUpdate('CASCADE');
               table.index(['active', 'next_due_date']);
          });
     }
     if (!await db.schema.hasTable(TABLES.checklist)) {
          await db.schema.createTable(TABLES.checklist, (table: any) => {
               table.increments('id').primary();
               table.string('title', 255).notNullable();
               table.text('instructions').nullable();
               table.boolean('active').notNullable().defaultTo(true);
               table.integer('sort_order').unsigned().notNullable().defaultTo(0);
               table.integer('created_by').unsigned().notNullable();
               table.integer('updated_by').unsigned().notNullable();
               table.timestamps(true, true);
               table.index(['active', 'sort_order']);
          });
     }
     if (!await db.schema.hasTable(TABLES.runs)) {
          await db.schema.createTable(TABLES.runs, (table: any) => {
               table.increments('id').primary();
               table.specificType('device_id', 'CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci').notNullable();
               table.integer('schedule_id').unsigned().nullable();
               table.date('scheduled_date').nullable();
               table.dateTime('performed_at').notNullable();
               table.integer('performed_by').unsigned().notNullable();
               table.text('observations').nullable();
               table.enu('status', ['awaiting_supervisor_review', 'awaiting_corrective_action', 'cleared']).notNullable();
               table.integer('reviewed_by').unsigned().nullable();
               table.dateTime('reviewed_at').nullable();
               table.text('review_comment').nullable();
               table.timestamps(true, true);
               table.foreign('device_id').references('devices.id').onDelete('RESTRICT').onUpdate('CASCADE');
               table.foreign('schedule_id').references(`${TABLES.schedules}.id`).onDelete('SET NULL').onUpdate('CASCADE');
               table.index(['device_id', 'performed_at']);
               table.index(['status', 'device_id']);
          });
     }
     if (!await db.schema.hasTable(TABLES.checks)) {
          await db.schema.createTable(TABLES.checks, (table: any) => {
               table.increments('id').primary();
               table.integer('run_id').unsigned().notNullable();
               table.integer('checklist_item_id').unsigned().nullable();
               table.string('title_snapshot', 255).notNullable();
               table.text('instructions_snapshot').nullable();
               table.enu('result', ['pass', 'fail']).notNullable();
               table.text('comment').nullable();
               table.timestamps(true, true);
               table.foreign('run_id').references(`${TABLES.runs}.id`).onDelete('RESTRICT').onUpdate('CASCADE');
               table.foreign('checklist_item_id').references(`${TABLES.checklist}.id`).onDelete('SET NULL').onUpdate('CASCADE');
               table.index(['run_id', 'result']);
          });
     }
     if (!await db.schema.hasTable(TABLES.actions)) {
          await db.schema.createTable(TABLES.actions, (table: any) => {
               table.increments('id').primary();
               table.integer('run_id').unsigned().notNullable();
               table.integer('check_id').unsigned().notNullable();
               table.text('description').notNullable();
               table.enu('status', ['open', 'completed']).notNullable().defaultTo('open');
               table.integer('completed_by').unsigned().nullable();
               table.dateTime('completed_at').nullable();
               table.timestamps(true, true);
               table.foreign('run_id').references(`${TABLES.runs}.id`).onDelete('RESTRICT').onUpdate('CASCADE');
               table.foreign('check_id').references(`${TABLES.checks}.id`).onDelete('RESTRICT').onUpdate('CASCADE');
               table.index(['run_id', 'status']);
          });
     }
}

export { TABLES as INSTRUMENT_MAINTENANCE_TABLES };
