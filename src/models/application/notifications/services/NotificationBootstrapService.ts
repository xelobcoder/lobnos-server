import KnexConnection from '../../../../database/KnexConnections';
import logger from '../../../../hooks/logger';
import { NotificationEventsRepo } from '../repositories/NotificationEventsRepo';
import { NotificationTemplatesRepo } from '../repositories/NotificationTemplatesRepo';
import { NotificationTemplateVariablesRepo } from '../repositories/NotificationTemplateVariablesRepo';
import { NotificationTemplateVersionsRepo } from '../repositories/NotificationTemplateVersionsRepo';
import { NotificationEventContextService } from './NotificationEventContextService';

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

function moduleFromEventCode(eventCode: string): string {
     if (eventCode.startsWith('PATIENT')) return 'patient';
     if (eventCode.startsWith('APPOINTMENT')) return 'appointment';
     if (eventCode.startsWith('SAMPLE')) return 'sample';
     if (eventCode.startsWith('RESULT') || eventCode === 'CRITICAL_RESULT') return 'result';
     if (eventCode.startsWith('INVOICE') || eventCode.startsWith('PAYMENT')) return 'billing';
     if (eventCode.startsWith('REPORT')) return 'report';
     return 'security';
}

async function ensureCoreTables(tenantId: number) {
     const connection = await KnexConnection(tenantId);

     if (!(await connection.schema.hasTable('notification_events'))) {
          await connection.schema.createTable('notification_events', (table) => {
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

     if (!(await connection.schema.hasTable('notification_templates'))) {
          await connection.schema.createTable('notification_templates', (table) => {
               table.increments('id').primary();
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
               table.index(['event_id']);
               table.foreign('event_id').references('id').inTable('notification_events').onDelete('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('notification_template_variables'))) {
          await connection.schema.createTable('notification_template_variables', (table) => {
               table.increments('id').primary();
               table.integer('event_id').unsigned().notNullable();
               table.string('variable_name', 100).notNullable();
               table.string('display_name', 255).notNullable();
               table.string('data_type', 50).notNullable();
               table.text('description').nullable();
               table.string('example_value', 500).nullable();
               table.boolean('is_required').notNullable().defaultTo(false);
               table.timestamp('created_at').defaultTo(connection.fn.now());
               table.unique(['event_id', 'variable_name']);
               table.foreign('event_id').references('id').inTable('notification_events').onDelete('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('notification_event_settings'))) {
          await connection.schema.createTable('notification_event_settings', (table) => {
               table.increments('id').primary();
               table.integer('event_id').unsigned().notNullable();
               table.boolean('email_enabled').notNullable().defaultTo(true);
               table.boolean('sms_enabled').notNullable().defaultTo(false);
               table.boolean('whatsapp_enabled').notNullable().defaultTo(false);
               table.boolean('in_app_enabled').notNullable().defaultTo(true);
               table.integer('default_template_id').unsigned().nullable();
               table.timestamps(true, true);
               table.unique(['event_id']);
               table.foreign('event_id').references('id').inTable('notification_events').onDelete('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('notification_event_recipients'))) {
          await connection.schema.createTable('notification_event_recipients', (table) => {
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

     if (!(await connection.schema.hasTable('notification_template_versions'))) {
          await connection.schema.createTable('notification_template_versions', (table) => {
               table.increments('id').primary();
               table.integer('template_id').unsigned().notNullable();
               table.integer('version').notNullable();
               table.string('subject', 500).notNullable();
               table.text('html_body', 'longtext').nullable();
               table.text('plain_body', 'longtext').nullable();
               table.integer('changed_by').unsigned().nullable();
               table.timestamp('created_at').defaultTo(connection.fn.now());
               table.foreign('template_id').references('id').inTable('notification_templates').onDelete('CASCADE');
          });
     }
}

async function seedEvents(tenantId: number) {
     const connection = await KnexConnection(tenantId);

     for (const eventCode of EVENT_CODES) {
          const exists = await connection('notification_events').where({ event_code: eventCode }).first();
          if (exists) continue;

          await connection('notification_events').insert({
               event_code: eventCode,
               event_name: eventCode.replace(/_/g, ' '),
               description: `${eventCode.replace(/_/g, ' ')} notification event`,
               module: moduleFromEventCode(eventCode),
               is_system: true,
               is_active: true,
          });
     }
}

async function seedDefaultEventSettings(tenantId: number) {
     const connection = await KnexConnection(tenantId);
     const events = await connection('notification_events').select('id', 'event_code');

     for (const event of events) {
          const defaultTemplate = await connection('notification_templates')
               .select('id')
               .where({
                    event_id: event.id,
                    is_system: true,
                    is_default: true,
               })
               .first();

          const defaultTemplateId = defaultTemplate ? Number(defaultTemplate.id) : null;

          const exists = await connection('notification_event_settings')
               .where({ event_id: event.id })
               .first();

          if (!exists) {
               await connection('notification_event_settings').insert({
                    event_id: event.id,
                    email_enabled: true,
                    sms_enabled: false,
                    whatsapp_enabled: false,
                    in_app_enabled: true,
                    default_template_id: defaultTemplateId,
               });
               continue;
          }

          if (!exists.default_template_id && defaultTemplateId) {
               await connection('notification_event_settings')
                    .where({ id: exists.id })
                    .update({
                         default_template_id: defaultTemplateId,
                         updated_at: connection.fn.now(),
                    });
          }
     }
}

export async function bootstrapNotificationDefinitions(tenantId = 1) {
     await ensureCoreTables(tenantId);
     await seedEvents(tenantId);

     const eventsRepo = new NotificationEventsRepo(tenantId);
     const templatesRepo = new NotificationTemplatesRepo(tenantId);
     const variablesRepo = new NotificationTemplateVariablesRepo(tenantId);
     const versionsRepo = new NotificationTemplateVersionsRepo(tenantId);
     const eventContextService = new NotificationEventContextService(
          eventsRepo,
          templatesRepo,
          variablesRepo,
          versionsRepo,
          tenantId,
     );

     const syncResult = await eventContextService.ensureSystemDefinitions();
     await seedDefaultEventSettings(tenantId);

     const seededEvents = syncResult.length;
     const insertedVariables = syncResult.reduce((acc, row) => acc + row.variablesInserted, 0);
     const createdTemplates = syncResult.filter((row) => row.templateCreated).length;
     const backfilledTemplates = syncResult.filter((row) => row.templateBackfilled).length;

     logger.info('Notifications bootstrap complete', {
          tenantId,
          seededEvents,
          insertedVariables,
          createdTemplates,
          backfilledTemplates,
     });

     return {
          tenantId,
          seededEvents,
          insertedVariables,
          createdTemplates,
          backfilledTemplates,
     };
}
