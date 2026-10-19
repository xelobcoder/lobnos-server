import { Knex } from 'knex';

/**
 * Appointment workflow additions (per tenant, idempotent):
 *   service_ids           TEXT NULL      JSON array of booked test_panels ids (lab/ultrasound)
 *   reminder_24h_sent_at  DATETIME NULL  set once the 24h reminder is claimed/sent
 *   reminder_30m_sent_at  DATETIME NULL  set once the 30m reminder is claimed/sent
 *   reminder_attempts     INT DEFAULT 0  failed reminder dispatches for the current schedule
 *   converted_by          INT NULL       employee who converted the appointment into a bill
 *   converted_at          DATETIME NULL  conversion time (billingid holds the bill)
 * Reminder flags are reset whenever the appointment is rescheduled.
 */
const TABLE = 'appointments';

const COLUMNS: Array<[string, (table: Knex.AlterTableBuilder) => void]> = [
     ['service_ids', t => { t.text('service_ids').nullable(); }],
     ['reminder_24h_sent_at', t => { t.dateTime('reminder_24h_sent_at').nullable(); }],
     ['reminder_30m_sent_at', t => { t.dateTime('reminder_30m_sent_at').nullable(); }],
     ['reminder_attempts', t => { t.integer('reminder_attempts').unsigned().notNullable().defaultTo(0); }],
     ['converted_by', t => { t.integer('converted_by').unsigned().nullable(); }],
     ['converted_at', t => { t.dateTime('converted_at').nullable(); }],
];

export async function up(knex: Knex): Promise<void> {
     if (!(await knex.schema.hasTable(TABLE))) return;
     for (const [name, add] of COLUMNS) {
          if (!(await knex.schema.hasColumn(TABLE, name))) {
               await knex.schema.alterTable(TABLE, add);
          }
     }
}

export async function down(knex: Knex): Promise<void> {
     if (!(await knex.schema.hasTable(TABLE))) return;
     for (const [name] of [...COLUMNS].reverse()) {
          if (await knex.schema.hasColumn(TABLE, name)) {
               await knex.schema.alterTable(TABLE, t => { t.dropColumn(name); });
          }
     }
}
