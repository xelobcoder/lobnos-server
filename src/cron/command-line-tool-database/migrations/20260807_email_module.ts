import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     if (!(await knex.schema.hasTable('email_templates'))) {
          await knex.schema.createTable('email_templates', (table) => {
               table.increments('id').primary();
               table.string('name', 150).notNullable();
               table.enum('category', ['authentication', 'patient', 'clinician', 'organization', 'internal', 'marketing']).notNullable();
               table.string('subject', 255).notNullable();
               table.text('html_body', 'longtext').notNullable();
               table.text('plain_text_body', 'longtext').notNullable();
               table.text('variables_json', 'longtext').notNullable();
               table.enum('status', ['active', 'archived']).notNullable().defaultTo('active');
               table.integer('created_by').unsigned().nullable();
               table.integer('updated_by').unsigned().nullable();
               table.timestamps(true, true);
          });
     }

     if (!(await knex.schema.hasTable('email_providers'))) {
          await knex.schema.createTable('email_providers', (table) => {
               table.increments('id').primary();
               table.string('name', 150).notNullable();
               table.enum('provider_type', ['smtp']).notNullable().defaultTo('smtp');
               table.string('host', 255).notNullable();
               table.integer('port').notNullable();
               table.boolean('secure').notNullable().defaultTo(false);
               table.string('username', 255).notNullable();
               table.string('password', 255).notNullable();
               table.string('from_email', 255).notNullable();
               table.string('from_name', 150).notNullable();
               table.boolean('is_default').notNullable().defaultTo(false);
               table.boolean('is_active').notNullable().defaultTo(true);
               table.integer('created_by').unsigned().nullable();
               table.integer('updated_by').unsigned().nullable();
               table.timestamps(true, true);
          });
     }

     if (!(await knex.schema.hasTable('email_settings'))) {
          await knex.schema.createTable('email_settings', (table) => {
               table.increments('id').primary();
               table.integer('default_provider_id').unsigned().nullable();
               table.decimal('max_attachment_size_mb', 10, 2).notNullable().defaultTo(10);
               table.integer('max_retries').notNullable().defaultTo(3);
               table.text('retry_backoff_minutes_json', 'longtext').notNullable();
               table.boolean('allow_marketing_emails').notNullable().defaultTo(true);
               table.integer('updated_by').unsigned().nullable();
               table.timestamps(true, true);
          });

          await knex('email_settings').insert({
               default_provider_id: null,
               max_attachment_size_mb: 10,
               max_retries: 3,
               retry_backoff_minutes_json: JSON.stringify([2, 10, 30]),
               allow_marketing_emails: true,
          });
     }

     if (!(await knex.schema.hasTable('email_queue'))) {
          await knex.schema.createTable('email_queue', (table) => {
               table.increments('id').primary();
               table.integer('template_id').unsigned().nullable();
               table.integer('provider_id').unsigned().nullable();
               table.enum('status', ['pending', 'processing', 'sent', 'failed', 'cancelled', 'scheduled']).notNullable().defaultTo('pending');
               table.enum('priority', ['low', 'normal', 'high']).notNullable().defaultTo('normal');
               table.text('recipients_json', 'longtext').notNullable();
               table.text('cc_json', 'longtext').notNullable();
               table.text('bcc_json', 'longtext').notNullable();
               table.string('subject', 255).notNullable();
               table.text('html_body', 'longtext').notNullable();
               table.text('plain_text_body', 'longtext').notNullable();
               table.text('variables_json', 'longtext').notNullable();
               table.text('attachments_json', 'longtext').notNullable();
               table.dateTime('scheduled_at').nullable();
               table.dateTime('sent_at').nullable();
               table.text('failure_reason').nullable();
               table.integer('retry_count').notNullable().defaultTo(0);
               table.dateTime('next_retry_at').nullable();
               table.string('reference_type', 100).nullable();
               table.string('reference_id', 100).nullable();
               table.string('provider_message_id', 255).nullable();
               table.integer('created_by').unsigned().nullable();
               table.timestamps(true, true);
          });
     }

     if (!(await knex.schema.hasTable('email_logs'))) {
          await knex.schema.createTable('email_logs', (table) => {
               table.increments('id').primary();
               table.integer('queue_id').unsigned().notNullable();
               table.integer('provider_id').unsigned().nullable();
               table.enum('status', ['pending', 'processing', 'sent', 'failed', 'cancelled', 'scheduled']).notNullable();
               table.text('recipients_json', 'longtext').notNullable();
               table.string('subject', 255).notNullable();
               table.text('response_payload_json', 'longtext').nullable();
               table.text('failure_reason').nullable();
               table.integer('duration_ms').nullable();
               table.timestamp('created_at').defaultTo(knex.fn.now());
          });
     }
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTableIfExists('email_logs');
     await knex.schema.dropTableIfExists('email_queue');
     await knex.schema.dropTableIfExists('email_settings');
     await knex.schema.dropTableIfExists('email_providers');
     await knex.schema.dropTableIfExists('email_templates');
}
