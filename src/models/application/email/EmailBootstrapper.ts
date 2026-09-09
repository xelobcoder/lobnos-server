import KnexConnection from '../../../database/KnexConnections';

export async function bootstrapEmailTables(tenantId = 1): Promise<void> {
     const connection = await KnexConnection(tenantId);

     if (!(await connection.schema.hasTable('email_templates'))) {
          await connection.schema.createTable('email_templates', (table) => {
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
               table.index(['category'], 'idx_email_templates_category');
               table.index(['status'], 'idx_email_templates_status');
          });
     }

     if (!(await connection.schema.hasTable('email_providers'))) {
          await connection.schema.createTable('email_providers', (table) => {
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
               table.index(['is_default'], 'idx_email_providers_default');
               table.index(['is_active'], 'idx_email_providers_active');
          });
     }

     if (!(await connection.schema.hasTable('email_settings'))) {
          await connection.schema.createTable('email_settings', (table) => {
               table.increments('id').primary();
               table.integer('default_provider_id').unsigned().nullable();
               table.decimal('max_attachment_size_mb', 10, 2).notNullable().defaultTo(10);
               table.integer('max_retries').notNullable().defaultTo(3);
               table.text('retry_backoff_minutes_json', 'longtext').notNullable();
               table.boolean('allow_marketing_emails').notNullable().defaultTo(true);
               table.integer('updated_by').unsigned().nullable();
               table.timestamps(true, true);
               table.index(['default_provider_id'], 'idx_email_settings_default_provider');
               table.foreign('default_provider_id', 'fk_email_settings_default_provider')
                    .references('id').inTable('email_providers')
                    .onDelete('SET NULL').onUpdate('CASCADE');
          });

          await connection('email_settings').insert({
               default_provider_id: null,
               max_attachment_size_mb: 10,
               max_retries: 3,
               retry_backoff_minutes_json: JSON.stringify([2, 10, 30]),
               allow_marketing_emails: true,
          });
     }

     if (!(await connection.schema.hasTable('email_queue'))) {
          await connection.schema.createTable('email_queue', (table) => {
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
               table.index(['status'], 'idx_email_queue_status');
               table.index(['priority'], 'idx_email_queue_priority');
               table.index(['scheduled_at'], 'idx_email_queue_scheduled_at');
               table.index(['next_retry_at'], 'idx_email_queue_next_retry_at');
               table.foreign('template_id', 'fk_email_queue_template')
                    .references('id').inTable('email_templates')
                    .onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('provider_id', 'fk_email_queue_provider')
                    .references('id').inTable('email_providers')
                    .onDelete('SET NULL').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('email_logs'))) {
          await connection.schema.createTable('email_logs', (table) => {
               table.increments('id').primary();
               table.integer('queue_id').unsigned().notNullable();
               table.integer('provider_id').unsigned().nullable();
               table.enum('status', ['pending', 'processing', 'sent', 'failed', 'cancelled', 'scheduled']).notNullable();
               table.text('recipients_json', 'longtext').notNullable();
               table.string('subject', 255).notNullable();
               table.text('response_payload_json', 'longtext').nullable();
               table.text('failure_reason').nullable();
               table.integer('duration_ms').nullable();
               table.timestamp('created_at').defaultTo(connection.fn.now());
               table.index(['queue_id'], 'idx_email_logs_queue_id');
               table.index(['status'], 'idx_email_logs_status');
               table.foreign('queue_id', 'fk_email_logs_queue')
                    .references('id').inTable('email_queue')
                    .onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('provider_id', 'fk_email_logs_provider')
                    .references('id').inTable('email_providers')
                    .onDelete('SET NULL').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('email_queue_attempts'))) {
          await connection.schema.createTable('email_queue_attempts', (table) => {
               table.increments('id').primary();
               table.integer('queue_id').unsigned().notNullable();
               table.integer('attempt_number').notNullable();
               table.string('provider', 100).nullable();
               table.string('status', 30).notNullable();
               table.text('response_payload', 'longtext').nullable();
               table.text('error').nullable();
               table.dateTime('started_at').nullable();
               table.dateTime('completed_at').nullable();
               table.timestamp('created_at').defaultTo(connection.fn.now());
               table.index(['queue_id'], 'idx_email_queue_attempts_queue');
               table.foreign('queue_id', 'fk_email_queue_attempts_queue')
                    .references('id').inTable('email_queue')
                    .onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('emaillog'))) {
          await connection.schema.createTable('emaillog', (table) => {
               table.increments('id').primary();
               table.integer('target').unsigned().notNullable();
               table.string('type', 100).notNullable();
               table.integer('success').unsigned().notNullable();
               table.dateTime('date', { precision: 6 }).notNullable().defaultTo(connection.fn.now());
               table.string('reason', 100).nullable();
          });
     }

     if (!(await connection.schema.hasTable('emailpreference'))) {
          await connection.schema.createTable('emailpreference', (table) => {
               table.increments('id').primary();
               table.string('registration', 3).notNullable().defaultTo('No');
               table.string('result', 3).notNullable().defaultTo('No');
               table.string('rejection', 3).notNullable().defaultTo('No');
               table.string('approval', 3).notNullable().defaultTo('No');
               table.string('transactions', 3).notNullable().defaultTo('No');
               table.dateTime('updated_on', { precision: 6 }).nullable();
               table.string('birthday', 3).notNullable().defaultTo('Yes');
               table.string('billing', 3).notNullable().defaultTo('Yes');
          });
     }
}