"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Create incidents table
    if (!(await knex.schema.hasTable('incidents'))) {
        await knex.schema.createTable('incidents', (table) => {
            table.string('id', 50).notNullable().primary();
            table.enum('type', ['patient-safety', 'quality', 'security', 'compliance']).notNullable();
            table.string('title', 255).notNullable();
            table.text('description').notNullable();
            table.enum('severity', ['low', 'medium', 'high', 'critical']).notNullable();
            table.enum('status', ['reported', 'investigating', 'root-cause-analysis', 'corrective-actions', 'resolved', 'closed']).notNullable().defaultTo('reported');
            table.timestamp('reported_at').notNullable().defaultTo(knex.fn.now());
            table.text('affected_parties').nullable();
            table.string('location', 255).nullable();
            table.text('immediate_actions').nullable();
            table.text('root_cause').nullable();
            table.text('root_cause_analysis').nullable();
            table.text('corrective_actions').nullable();
            table.text('corrective_action_plan').nullable();
            table.tinyint('regulatory_reporting').defaultTo(0);
            table.text('escalated_to').nullable();
            table.date('follow_up_date').nullable();
            table.date('resolution_date').nullable();
            table.text('attachments').nullable();
            table.text('investigation_notes').nullable();
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
            table.integer('reported_by', 11).notNullable();
            // Indexes
            table.index('type', 'incidents_type_index');
            table.index('severity', 'incidents_severity_index');
            table.index('status', 'incidents_status_index');
            table.index('reported_at', 'incidents_reported_at_index');
            table.index('location', 'incidents_location_index');
        });
    }
    // Add JSON validation CHECK constraints using raw SQL (check if they exist first)
    const rootCauseCheckExists = await knex.raw(`
          SELECT CONSTRAINT_NAME
          FROM information_schema.TABLE_CONSTRAINTS
          WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'incidents'
          AND CONSTRAINT_NAME = 'incidents_root_cause_analysis_check'
     `);
    if (rootCauseCheckExists[0].length === 0) {
        await knex.raw(`
               ALTER TABLE incidents
               ADD CONSTRAINT incidents_root_cause_analysis_check CHECK (json_valid(root_cause_analysis))
          `);
    }
    const correctiveActionCheckExists = await knex.raw(`
          SELECT CONSTRAINT_NAME
          FROM information_schema.TABLE_CONSTRAINTS
          WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'incidents'
          AND CONSTRAINT_NAME = 'incidents_corrective_action_plan_check'
     `);
    if (correctiveActionCheckExists[0].length === 0) {
        await knex.raw(`
               ALTER TABLE incidents
               ADD CONSTRAINT incidents_corrective_action_plan_check CHECK (json_valid(corrective_action_plan))
          `);
    }
    const escalatedToCheckExists = await knex.raw(`
          SELECT CONSTRAINT_NAME
          FROM information_schema.TABLE_CONSTRAINTS
          WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'incidents'
          AND CONSTRAINT_NAME = 'incidents_escalated_to_check'
     `);
    if (escalatedToCheckExists[0].length === 0) {
        await knex.raw(`
               ALTER TABLE incidents
               ADD CONSTRAINT incidents_escalated_to_check CHECK (json_valid(escalated_to))
          `);
    }
    const attachmentsCheckExists = await knex.raw(`
          SELECT CONSTRAINT_NAME
          FROM information_schema.TABLE_CONSTRAINTS
          WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'incidents'
          AND CONSTRAINT_NAME = 'incidents_attachments_check'
     `);
    if (attachmentsCheckExists[0].length === 0) {
        await knex.raw(`
               ALTER TABLE incidents
               ADD CONSTRAINT incidents_attachments_check CHECK (json_valid(attachments))
          `);
    }
    const investigationNotesCheckExists = await knex.raw(`
          SELECT CONSTRAINT_NAME
          FROM information_schema.TABLE_CONSTRAINTS
          WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'incidents'
          AND CONSTRAINT_NAME = 'incidents_investigation_notes_check'
     `);
    if (investigationNotesCheckExists[0].length === 0) {
        await knex.raw(`
               ALTER TABLE incidents
               ADD CONSTRAINT incidents_investigation_notes_check CHECK (json_valid(investigation_notes))
          `);
    }
    // Create incident_audit_trail table
    if (!(await knex.schema.hasTable('incident_audit_trail'))) {
        await knex.schema.createTable('incident_audit_trail', (table) => {
            table.string('id', 50).notNullable().primary();
            table.string('incident_id', 50).notNullable();
            table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());
            table.string('action', 100).notNullable();
            table.integer('employeeId', 10).notNullable();
            table.text('oldValue').nullable();
            table.text('newValue').nullable();
            table.text('details').nullable();
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            // Indexes
            table.index('incident_id', 'incident_audit_trail_incident_id_index');
            table.index('timestamp', 'incident_audit_trail_timestamp_index');
            table.index('action', 'incident_audit_trail_action_index');
            table.index('employeeId', 'incident_audit_trail_user_index');
            // Foreign key
            table.foreign('incident_id').references('id').inTable('incidents').onDelete('CASCADE');
        });
    }
}
exports.up = up;
async function down(knex) {
    // Drop JSON validation constraints first
    await knex.raw(`
          ALTER TABLE incidents
          DROP CONSTRAINT IF EXISTS incidents_root_cause_analysis_check,
          DROP CONSTRAINT IF EXISTS incidents_corrective_action_plan_check,
          DROP CONSTRAINT IF EXISTS incidents_escalated_to_check,
          DROP CONSTRAINT IF EXISTS incidents_attachments_check,
          DROP CONSTRAINT IF EXISTS incidents_investigation_notes_check
     `);
    // Drop tables in reverse order due to foreign key constraints
    await knex.schema.dropTableIfExists('incident_audit_trail');
    await knex.schema.dropTableIfExists('incidents');
}
exports.down = down;
