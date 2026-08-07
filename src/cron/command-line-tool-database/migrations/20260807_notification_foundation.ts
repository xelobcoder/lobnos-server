import { Knex } from 'knex';

const EVENT_CODES = [
     'PATIENT_CREATED',
     'PATIENT_UPDATED',
     'APPOINTMENT_CREATED',
     'APPOINTMENT_CONFIRMED',
     'APPOINTMENT_RESCHEDULED',
     'APPOINTMENT_CANCELLED',
     'APPOINTMENT_REMINDER',
     'SAMPLE_COLLECTED',
     'SAMPLE_RECEIVED',
     'SAMPLE_REJECTED',
     'SAMPLE_RECALL_REQUIRED',
     'SAMPLE_RECOLLECTED',
     'SAMPLE_PROCESSED',
     'RESULT_VERIFIED',
     'RESULT_READY',
     'RESULT_RELEASED',
     'RESULT_AMENDED',
     'RESULT_CORRECTED',
     'CRITICAL_RESULT',
     'INVOICE_CREATED',
     'INVOICE_SENT',
     'PAYMENT_RECEIVED',
     'PAYMENT_FAILED',
     'REPORT_READY',
     'USER_CREATED',
     'USER_ACTIVATED',
     'PASSWORD_RESET',
];

export async function up(knex: Knex): Promise<void> {
     if (!(await knex.schema.hasTable('notification_events'))) {
          await knex.schema.createTable('notification_events', (table) => {
               table.increments('id').primary();
               table.string('event_code', 100).notNullable().unique();
               table.string('event_name', 255).notNullable();
               table.text('description').nullable();
               table.string('module', 100).notNullable();
               table.boolean('is_system').notNullable().defaultTo(true);
               table.boolean('is_active').notNullable().defaultTo(true);
               table.timestamps(true, true);
          });
     }

     if (!(await knex.schema.hasTable('notification_templates'))) {
          await knex.schema.createTable('notification_templates', (table) => {
               table.increments('id').primary();
               table.integer('tenant_id').unsigned().nullable();
               table.integer('event_id').unsigned().notNullable();
               table.string('template_name', 255).notNullable();
               table.string('subject', 500).notNullable();
               table.text('html_body', 'longtext').nullable();
               table.text('plain_body', 'longtext').nullable();
               table.boolean('is_system').notNullable().defaultTo(false);
               table.boolean('is_default').notNullable().defaultTo(false);
               table.boolean('is_active').notNullable().defaultTo(true);
               table.integer('created_by').unsigned().nullable();
               table.integer('updated_by').unsigned().nullable();
               table.timestamps(true, true);
               table.index(['tenant_id', 'event_id']);
               table.foreign('event_id').references('id').inTable('notification_events').onDelete('CASCADE');
          });
     }

     if (!(await knex.schema.hasTable('notification_template_variables'))) {
          await knex.schema.createTable('notification_template_variables', (table) => {
               table.increments('id').primary();
               table.integer('event_id').unsigned().notNullable();
               table.string('variable_name', 100).notNullable();
               table.string('display_name', 255).notNullable();
               table.string('data_type', 50).notNullable();
               table.text('description').nullable();
               table.string('example_value', 500).nullable();
               table.boolean('is_required').notNullable().defaultTo(false);
               table.timestamp('created_at').defaultTo(knex.fn.now());
               table.unique(['event_id', 'variable_name']);
               table.foreign('event_id').references('id').inTable('notification_events').onDelete('CASCADE');
          });
     }

     if (!(await knex.schema.hasTable('notification_event_settings'))) {
          await knex.schema.createTable('notification_event_settings', (table) => {
               table.increments('id').primary();
               table.integer('tenant_id').unsigned().nullable();
               table.integer('event_id').unsigned().notNullable();
               table.boolean('email_enabled').notNullable().defaultTo(true);
               table.boolean('sms_enabled').notNullable().defaultTo(false);
               table.boolean('whatsapp_enabled').notNullable().defaultTo(false);
               table.boolean('in_app_enabled').notNullable().defaultTo(true);
               table.integer('default_template_id').unsigned().nullable();
               table.timestamps(true, true);
               table.unique(['tenant_id', 'event_id']);
               table.foreign('event_id').references('id').inTable('notification_events').onDelete('CASCADE');
          });
     }

     if (!(await knex.schema.hasTable('notification_event_recipients'))) {
          await knex.schema.createTable('notification_event_recipients', (table) => {
               table.increments('id').primary();
               table.integer('event_id').unsigned().notNullable();
               table.string('recipient_type', 50).notNullable();
               table.boolean('is_required').notNullable().defaultTo(false);
               table.string('email_override', 255).nullable();
               table.boolean('is_active').notNullable().defaultTo(true);
               table.timestamps(true, true);
               table.unique(['event_id', 'recipient_type']);
               table.foreign('event_id').references('id').inTable('notification_events').onDelete('CASCADE');
          });
     }

     if (!(await knex.schema.hasTable('notification_queue'))) {
          await knex.schema.createTable('notification_queue', (table) => {
               table.increments('id').primary();
               table.integer('tenant_id').unsigned().notNullable();
               table.integer('event_id').unsigned().notNullable();
               table.string('event_code', 100).notNullable();
               table.string('channel', 30).notNullable().defaultTo('email');
               table.integer('template_id').unsigned().nullable();
               table.integer('email_queue_id').unsigned().nullable();
               table.string('priority', 20).notNullable().defaultTo('normal');
               table.string('status', 30).notNullable().defaultTo('pending');
               table.dateTime('scheduled_at').nullable();
               table.dateTime('processing_started_at').nullable();
               table.dateTime('processed_at').nullable();
               table.integer('attempts').notNullable().defaultTo(0);
               table.integer('max_attempts').notNullable().defaultTo(3);
               table.text('last_error').nullable();
               table.text('payload_json', 'longtext').nullable();
               table.integer('created_by').unsigned().nullable();
               table.timestamps(true, true);
               table.index(['tenant_id', 'status']);
               table.foreign('event_id').references('id').inTable('notification_events').onDelete('CASCADE');
               table.foreign('template_id').references('id').inTable('notification_templates').onDelete('SET NULL');
          });
     }

     if (!(await knex.schema.hasTable('email_queue_attempts'))) {
          await knex.schema.createTable('email_queue_attempts', (table) => {
               table.increments('id').primary();
               table.integer('queue_id').unsigned().notNullable();
               table.integer('attempt_number').notNullable();
               table.string('provider', 100).nullable();
               table.string('status', 30).notNullable();
               table.text('response_payload', 'longtext').nullable();
               table.text('error').nullable();
               table.dateTime('started_at').nullable();
               table.dateTime('completed_at').nullable();
               table.timestamp('created_at').defaultTo(knex.fn.now());
               table.foreign('queue_id').references('id').inTable('email_queue').onDelete('CASCADE');
          });
     }

     if (!(await knex.schema.hasTable('notification_template_versions'))) {
          await knex.schema.createTable('notification_template_versions', (table) => {
               table.increments('id').primary();
               table.integer('template_id').unsigned().notNullable();
               table.integer('version').notNullable();
               table.string('subject', 500).notNullable();
               table.text('html_body', 'longtext').nullable();
               table.text('plain_body', 'longtext').nullable();
               table.integer('changed_by').unsigned().nullable();
               table.timestamp('created_at').defaultTo(knex.fn.now());
               table.foreign('template_id').references('id').inTable('notification_templates').onDelete('CASCADE');
          });
     }

     for (const eventCode of EVENT_CODES) {
          const exists = await knex('notification_events').where({ event_code: eventCode }).first();
          if (!exists) {
               const moduleName = eventCode.startsWith('PATIENT')
                    ? 'patient'
                    : eventCode.startsWith('APPOINTMENT')
                         ? 'appointment'
                         : eventCode.startsWith('SAMPLE')
                              ? 'sample'
                              : eventCode.startsWith('RESULT') || eventCode === 'CRITICAL_RESULT'
                                   ? 'result'
                                   : eventCode.startsWith('INVOICE') || eventCode.startsWith('PAYMENT')
                                        ? 'billing'
                                        : eventCode.startsWith('REPORT')
                                             ? 'report'
                                             : 'security';

               await knex('notification_events').insert({
                    event_code: eventCode,
                    event_name: eventCode.replace(/_/g, ' '),
                    description: `${eventCode.replace(/_/g, ' ')} notification event`,
                    module: moduleName,
                    is_system: true,
                    is_active: true,
               });
          }
     }

     const resultReadyEvent = await knex('notification_events').where({ event_code: 'RESULT_READY' }).first();
     const sampleRejectedEvent = await knex('notification_events').where({ event_code: 'SAMPLE_REJECTED' }).first();
     const patientCreatedEvent = await knex('notification_events').where({ event_code: 'PATIENT_CREATED' }).first();

     const variableSeeds = [
          [resultReadyEvent?.id, 'PatientName', 'Patient Name', 'string', 'Patient full name', 'John Doe', true],
          [resultReadyEvent?.id, 'PatientNumber', 'Patient Number', 'string', 'Patient number', 'PL-000123', true],
          [resultReadyEvent?.id, 'InvoiceNumber', 'Invoice Number', 'string', 'Invoice number', 'INV-10023', false],
          [resultReadyEvent?.id, 'ResultName', 'Result Name', 'string', 'Result/Test name', 'Full Blood Count', true],
          [resultReadyEvent?.id, 'ResultDate', 'Result Date', 'string', 'Date result is ready', '2026-08-07', true],
          [resultReadyEvent?.id, 'DoctorName', 'Doctor Name', 'string', 'Clinician name', 'Dr. Smith', false],
          [resultReadyEvent?.id, 'DoctorEmail', 'Doctor Email', 'string', 'Clinician email', 'doctor@example.com', false],
          [resultReadyEvent?.id, 'BranchName', 'Branch Name', 'string', 'Laboratory branch name', 'Prime Lab Main Branch', true],
          [resultReadyEvent?.id, 'BranchPhone', 'Branch Phone', 'string', 'Laboratory branch phone', '0240000000', false],
          [resultReadyEvent?.id, 'ResultLink', 'Result Link', 'string', 'Result access URL', 'https://example.com/results/123', false],
          [sampleRejectedEvent?.id, 'SampleNumber', 'Sample Number', 'string', 'Sample number', 'SMP-001', true],
          [sampleRejectedEvent?.id, 'RejectionReason', 'Rejection Reason', 'string', 'Reason for rejection', 'Hemolyzed sample', true],
          [patientCreatedEvent?.id, 'PatientEmail', 'Patient Email', 'string', 'Patient email', 'patient@example.com', true],
     ];

     for (const seed of variableSeeds) {
          const [eventId, variableName, displayName, dataType, description, exampleValue, isRequired] = seed;
          if (!eventId) continue;

          const exists = await knex('notification_template_variables')
               .where({ event_id: eventId, variable_name: variableName })
               .first();

          if (!exists) {
               await knex('notification_template_variables').insert({
                    event_id: eventId,
                    variable_name: variableName,
                    display_name: displayName,
                    data_type: dataType,
                    description,
                    example_value: exampleValue,
                    is_required: isRequired,
               });
          }
     }

     const recipientSeeds = [
          [resultReadyEvent?.id, 'PATIENT', true],
          [resultReadyEvent?.id, 'DOCTOR', false],
          [sampleRejectedEvent?.id, 'PATIENT', true],
          [sampleRejectedEvent?.id, 'DOCTOR', false],
          [sampleRejectedEvent?.id, 'ORGANIZATION', false],
          [sampleRejectedEvent?.id, 'STAFF', false],
          [patientCreatedEvent?.id, 'PATIENT', true],
     ];

     for (const seed of recipientSeeds) {
          const [eventId, recipientType, isRequired] = seed;
          if (!eventId) continue;

          const exists = await knex('notification_event_recipients')
               .where({ event_id: eventId, recipient_type: recipientType })
               .first();

          if (!exists) {
               await knex('notification_event_recipients').insert({
                    event_id: eventId,
                    recipient_type: recipientType,
                    is_required: isRequired,
                    is_active: true,
               });
          }
     }

     const defaultTemplateSeeds = [
          {
               eventId: resultReadyEvent?.id,
               templateName: 'Result Ready Default',
               subject: 'Prime Lab - Your Result Is Ready | {{InvoiceNumber}}',
               htmlBody: '<p>Dear {{PatientName}},</p><p>Your {{ResultName}} result is now available.</p><p>{{BranchName}}</p>',
               plainBody: 'Dear {{PatientName}}, your {{ResultName}} result is now available. {{BranchName}}',
          },
          {
               eventId: sampleRejectedEvent?.id,
               templateName: 'Sample Rejected Default',
               subject: 'Sample {{SampleNumber}} Rejected',
               htmlBody: '<p>Dear {{PatientName}},</p><p>Your sample {{SampleNumber}} was rejected. Reason: {{RejectionReason}}</p>',
               plainBody: 'Dear {{PatientName}}, your sample {{SampleNumber}} was rejected. Reason: {{RejectionReason}}',
          },
          {
               eventId: patientCreatedEvent?.id,
               templateName: 'Patient Created Default',
               subject: 'Welcome {{PatientName}}',
               htmlBody: '<p>Dear {{PatientName}}, welcome to {{BranchName}}</p>',
               plainBody: 'Dear {{PatientName}}, welcome to {{BranchName}}',
          },
     ];

     for (const seed of defaultTemplateSeeds) {
          if (!seed.eventId) continue;

          const exists = await knex('notification_templates')
               .where({ event_id: seed.eventId, is_system: true, is_default: true })
               .first();

          if (!exists) {
               const [templateId] = await knex('notification_templates').insert({
                    tenant_id: null,
                    event_id: seed.eventId,
                    template_name: seed.templateName,
                    subject: seed.subject,
                    html_body: seed.htmlBody,
                    plain_body: seed.plainBody,
                    is_system: true,
                    is_default: true,
                    is_active: true,
                    created_by: null,
                    updated_by: null,
               });

               await knex('notification_template_versions').insert({
                    template_id: Number(templateId),
                    version: 1,
                    subject: seed.subject,
                    html_body: seed.htmlBody,
                    plain_body: seed.plainBody,
                    changed_by: null,
               });
          }
     }

     const allEvents = await knex('notification_events').select('id', 'event_code');
     for (const event of allEvents) {
          const exists = await knex('notification_event_settings').where({ tenant_id: null, event_id: event.id }).first();
          if (!exists) {
               await knex('notification_event_settings').insert({
                    tenant_id: null,
                    event_id: event.id,
                    email_enabled: ['RESULT_READY', 'SAMPLE_REJECTED', 'PATIENT_CREATED'].includes(event.event_code),
                    sms_enabled: false,
                    whatsapp_enabled: false,
                    in_app_enabled: true,
               });
          }
     }
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTableIfExists('notification_template_versions');
     await knex.schema.dropTableIfExists('email_queue_attempts');
     await knex.schema.dropTableIfExists('notification_queue');
     await knex.schema.dropTableIfExists('notification_event_recipients');
     await knex.schema.dropTableIfExists('notification_event_settings');
     await knex.schema.dropTableIfExists('notification_template_variables');
     await knex.schema.dropTableIfExists('notification_templates');
     await knex.schema.dropTableIfExists('notification_events');
}
