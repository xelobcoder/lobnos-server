import { Knex } from 'knex';

/**
 * Patient engagement additions: booking/collection/payment settings, result-ready notification
 * tracking and patient-visible home-collection history. Idempotent so it can run at every start.
 */
const SETTINGS_COLUMNS: Array<[string, (table: Knex.AlterTableBuilder) => void]> = [
     ['result_notifications_enabled', t => { t.boolean('result_notifications_enabled').notNullable().defaultTo(true); }],
     ['result_notifications_since', t => { t.dateTime('result_notifications_since').nullable(); }],
     ['appointment_slot_capacity', t => { t.integer('appointment_slot_capacity').unsigned().notNullable().defaultTo(4); }],
     ['booking_start_hour', t => { t.integer('booking_start_hour').unsigned().notNullable().defaultTo(7); }],
     ['booking_end_hour', t => { t.integer('booking_end_hour').unsigned().notNullable().defaultTo(17); }],
     ['home_collection_enabled', t => { t.boolean('home_collection_enabled').notNullable().defaultTo(false); }],
     ['home_collection_slot_capacity', t => { t.integer('home_collection_slot_capacity').unsigned().notNullable().defaultTo(3); }],
     ['home_collection_note', t => { t.string('home_collection_note', 500).notNullable().defaultTo(''); }],
     ['payment_instructions', t => { t.string('payment_instructions', 1000).notNullable().defaultTo(''); }],
     ['help_contact', t => { t.string('help_contact', 300).notNullable().defaultTo(''); }],
];

const ORDER_COLUMNS: Array<[string, (table: Knex.AlterTableBuilder) => void]> = [
     ['source', t => { t.string('source', 20).notNullable().defaultTo('staff'); }],
     ['area_id', t => { t.integer('area_id').unsigned().nullable(); }],
     ['landmark', t => { t.string('landmark', 200).nullable(); }],
     ['contact_phone', t => { t.string('contact_phone', 30).nullable(); }],
     ['patient_note', t => { t.string('patient_note', 500).nullable(); }],
     ['updated_at', t => { t.dateTime('updated_at').nullable(); }],
];

async function addMissingColumns(knex: Knex, tableName: string, columns: typeof SETTINGS_COLUMNS) {
     for (const [name, add] of columns) {
          if (!(await knex.schema.hasColumn(tableName, name))) {
               await knex.schema.alterTable(tableName, add);
          }
     }
}

export async function up(knex: Knex): Promise<void> {
     if (await knex.schema.hasTable('patient_portal_settings')) {
          const hadSince = await knex.schema.hasColumn('patient_portal_settings', 'result_notifications_since');
          await addMissingColumns(knex, 'patient_portal_settings', SETTINGS_COLUMNS);
          // Only results released after notifications were introduced are announced; never backfill old ones.
          if (!hadSince) await knex('patient_portal_settings').update({ result_notifications_since: new Date() });
     }

     if (!(await knex.schema.hasTable('patient_portal_result_notices'))) {
          await knex.schema.createTable('patient_portal_result_notices', table => {
               table.increments('id').primary();
               table.integer('ascension_id').unsigned().notNullable().unique('uq_patient_portal_result_notice');
               table.integer('patientid').unsigned().notNullable();
               table.integer('billingid').unsigned().notNullable();
               table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
               table.index(['patientid'], 'idx_patient_portal_result_notice_patient');
          });
     }

     if (!(await knex.schema.hasTable('patient_portal_notifications'))) {
          await knex.schema.createTable('patient_portal_notifications', table => {
               table.bigIncrements('id').primary();
               table.integer('patientid').unsigned().notNullable();
               table.string('event_key', 120).notNullable();
               table.string('channel', 10).notNullable();
               table.string('status', 12).notNullable();
               table.integer('attempts').unsigned().notNullable().defaultTo(1);
               table.string('reason', 200).nullable();
               table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
               table.unique(['event_key', 'channel'], 'uq_patient_portal_notification_event');
               table.index(['patientid', 'created_at'], 'idx_patient_portal_notification_patient');
          });
     }

     if (await knex.schema.hasTable('home_collection_orders')) {
          await addMissingColumns(knex, 'home_collection_orders', ORDER_COLUMNS);
     }

     if (!(await knex.schema.hasTable('home_collection_order_events'))) {
          await knex.schema.createTable('home_collection_order_events', table => {
               table.increments('id').primary();
               table.integer('home_collection_id').unsigned().notNullable();
               table.string('status', 20).notNullable();
               table.string('actor_type', 20).notNullable();
               table.integer('actor_id').unsigned().nullable();
               table.string('note', 300).nullable();
               table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
               table.index(['home_collection_id'], 'idx_home_collection_order_events');
          });
     }
}

export async function down(knex: Knex): Promise<void> {
     for (const table of ['home_collection_order_events', 'patient_portal_notifications', 'patient_portal_result_notices']) {
          await knex.schema.dropTableIfExists(table);
     }
}
