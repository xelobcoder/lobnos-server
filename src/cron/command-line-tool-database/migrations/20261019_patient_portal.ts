import { Knex } from 'knex';

/**
 * Facility-owned Patient Portal. Each tenant database holds its own portal configuration,
 * accounts, invitations, release decisions and audit trail; nothing is shared across facilities.
 * Patient, billing, result and appointment data stay in the existing tables. Foreign keys to
 * legacy tables are omitted because tenant databases vary in id column definitions; services
 * validate ownership against the live tables on every request.
 */
export async function up(knex: Knex): Promise<void> {
     if (!(await knex.schema.hasTable('patient_portal_settings'))) {
          await knex.schema.createTable('patient_portal_settings', (table) => {
               table.integer('keyid').unsigned().primary();
               table.boolean('portal_enabled').notNullable().defaultTo(false);
               table.boolean('self_registration_enabled').notNullable().defaultTo(false);
               table.boolean('staff_invitations_enabled').notNullable().defaultTo(true);
               table.string('result_release_policy', 20).notNullable().defaultTo('approved');
               table.boolean('require_payment_for_results').notNullable().defaultTo(true);
               table.boolean('appointment_requests_enabled').notNullable().defaultTo(false);
               table.integer('appointment_request_practitioner').unsigned().nullable();
               table.boolean('billing_enabled').notNullable().defaultTo(true);
               table.boolean('email_notifications_enabled').notNullable().defaultTo(true);
               table.boolean('sms_notifications_enabled').notNullable().defaultTo(false);
               table.integer('invitation_expiry_hours').unsigned().notNullable().defaultTo(72);
               table.integer('updated_by').unsigned().nullable();
               table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
          });
     }

     if (!(await knex.schema.hasTable('patient_portal_accounts'))) {
          await knex.schema.createTable('patient_portal_accounts', (table) => {
               table.increments('id').primary();
               table.integer('patientid').unsigned().notNullable().unique('uq_patient_portal_account_patient');
               table.string('status', 20).notNullable().defaultTo('active');
               table.string('activation_method', 30).notNullable();
               table.integer('session_version').unsigned().notNullable().defaultTo(1);
               table.integer('failed_attempts').unsigned().notNullable().defaultTo(0);
               table.dateTime('locked_until').nullable();
               table.dateTime('last_login_at').nullable();
               table.boolean('notify_email').notNullable().defaultTo(true);
               table.boolean('notify_sms').notNullable().defaultTo(false);
               table.dateTime('activated_at').notNullable();
               table.integer('disabled_by').unsigned().nullable();
               table.dateTime('disabled_at').nullable();
               table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
          });
     }

     if (!(await knex.schema.hasTable('patient_portal_invitations'))) {
          await knex.schema.createTable('patient_portal_invitations', (table) => {
               table.increments('id').primary();
               table.integer('patientid').unsigned().notNullable();
               table.string('token_hash', 64).notNullable().unique('uq_patient_portal_invitation_token');
               table.integer('created_by').unsigned().notNullable();
               table.dateTime('expires_at').notNullable();
               table.dateTime('used_at').nullable();
               table.dateTime('revoked_at').nullable();
               table.integer('revoked_by').unsigned().nullable();
               table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
               table.index(['patientid'], 'idx_patient_portal_invitations_patient');
          });
     }

     if (!(await knex.schema.hasTable('patient_portal_verifications'))) {
          await knex.schema.createTable('patient_portal_verifications', (table) => {
               table.increments('id').primary();
               table.integer('patientid').unsigned().notNullable();
               table.string('code_hash', 64).notNullable();
               table.integer('attempts').unsigned().notNullable().defaultTo(0);
               table.dateTime('expires_at').notNullable();
               table.dateTime('used_at').nullable();
               table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
               table.index(['patientid'], 'idx_patient_portal_verifications_patient');
          });
     }

     if (!(await knex.schema.hasTable('patient_portal_result_releases'))) {
          await knex.schema.createTable('patient_portal_result_releases', (table) => {
               table.increments('id').primary();
               table.integer('ascension_id').unsigned().notNullable().unique('uq_patient_portal_release_ascension');
               table.string('status', 20).notNullable();
               table.integer('decided_by').unsigned().notNullable();
               table.string('reason', 500).nullable();
               table.timestamp('decided_at').notNullable().defaultTo(knex.fn.now());
          });
     }

     if (!(await knex.schema.hasTable('patient_portal_audit'))) {
          await knex.schema.createTable('patient_portal_audit', (table) => {
               table.bigIncrements('id').primary();
               table.integer('patientid').unsigned().nullable();
               table.string('actor_type', 20).notNullable();
               table.integer('actor_id').unsigned().nullable();
               table.string('action', 60).notNullable();
               table.string('resource', 60).nullable();
               table.string('resource_id', 60).nullable();
               table.string('ip_address', 64).nullable();
               table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
               table.index(['patientid', 'created_at'], 'idx_patient_portal_audit_patient');
          });
     }
}

export async function down(knex: Knex): Promise<void> {
     for (const table of ['patient_portal_audit', 'patient_portal_result_releases', 'patient_portal_verifications',
          'patient_portal_invitations', 'patient_portal_accounts', 'patient_portal_settings']) {
          await knex.schema.dropTableIfExists(table);
     }
}
