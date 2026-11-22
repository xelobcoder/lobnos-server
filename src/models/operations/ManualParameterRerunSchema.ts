import type { Knex } from 'knex';

export async function ensureManualParameterRerunSchema(db: Knex): Promise<void> {
     if (!await db.schema.hasTable('lab_manual_parameter_reruns')) {
          await db.schema.createTable('lab_manual_parameter_reruns', table => {
               table.bigIncrements('id').primary();
               table.integer('ascensionid').unsigned().notNullable();
               table.integer('testid').unsigned().notNullable();
               table.integer('billingid').unsigned().notNullable();
               table.integer('patientid').unsigned().notNullable();
               table.text('field_ids').notNullable();
               table.text('confirmed_field_ids').notNullable();
               table.string('status', 32).notNullable();
               table.integer('initiated_by').unsigned().notNullable();
               table.integer('confirmed_by').unsigned().nullable();
               table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
               table.index(['ascensionid', 'status'], 'ix_manual_rerun_ascension_status');
          });
     }
     if (!await db.schema.hasTable('lab_manual_parameter_rerun_values')) {
          await db.schema.createTable('lab_manual_parameter_rerun_values', table => {
               table.bigIncrements('id').primary();
               table.integer('rerun_id').unsigned().notNullable();
               table.integer('fieldid').unsigned().notNullable();
               table.text('field').notNullable();
               table.text('value').notNullable();
               table.text('originalvalue').notNullable();
               table.string('entrymode', 32).notNullable().defaultTo('automatic');
               table.integer('received_by').unsigned().notNullable();
               table.timestamp('received_at').notNullable().defaultTo(db.fn.now());
               table.unique(['rerun_id', 'fieldid'], 'uq_manual_rerun_staged_parameter');
          });
     }
     if (!await db.schema.hasTable('lab_manual_parameter_rerun_events')) {
          await db.schema.createTable('lab_manual_parameter_rerun_events', table => {
               table.bigIncrements('id').primary();
               table.integer('rerun_id').unsigned().notNullable();
               table.integer('ascensionid').unsigned().notNullable();
               table.integer('employeeid').unsigned().notNullable();
               table.string('action', 32).notNullable();
               table.text('metadata').notNullable();
               table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
               table.index(['ascensionid', 'created_at'], 'ix_manual_rerun_events_ascension');
          });
     }
}
