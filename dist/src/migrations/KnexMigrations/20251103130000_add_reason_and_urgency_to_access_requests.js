"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // First check if table exists and drop it if it does
    const exists = await knex.schema.hasTable('result_access_requests');
    if (exists) {
        await knex.schema.dropTable('result_access_requests');
    }
    // Create the table with all fields including additional information
    await knex.schema.createTable('result_access_requests', (table) => {
        table.increments('id').primary();
        table.integer('patientid').notNullable();
        table.integer('staffid').notNullable();
        table.enum('requestType', ['access', 'edit']).notNullable();
        table.datetime('requestedAt').notNullable();
        table.enum('status', ['pending', 'granted', 'revoked', 'expired']).notNullable().defaultTo('pending');
        table.integer('ascensionid').notNullable();
        table.datetime('grantedAt').nullable();
        table.datetime('revokedAt').nullable();
        table.datetime('expiredAt').nullable();
        table.datetime('accessedAt').nullable();
        // Additional information fields
        table.text('reason').nullable().comment('Reason for requesting access');
        table.enum('urgency', ['low', 'medium', 'high', 'critical']).nullable().comment('Urgency level of the request');
        table.integer('requested_by').nullable().comment('Employee ID of who made the request');
        table.integer('approved_by').nullable().comment('Employee ID of who approved');
        table.text('approval_notes').nullable().comment('Notes from approver');
        table.string('expected_duration').nullable().comment('Expected duration of access needed');
        table.string('department').nullable().comment('Department of requester');
        table.text('contact_info').nullable().comment('Additional contact details');
        table.text('comments').nullable().comment('General comments');
        // Indexes
        table.index('patientid', 'idx_patientid');
        table.index('staffid', 'idx_staffid');
        table.index('status', 'idx_status');
        // Foreign keys
        table.foreign('patientid').references('patientid').inTable('new_patients').onDelete('CASCADE').onUpdate('CASCADE');
        table.foreign('staffid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTable('result_access_requests');
}
exports.down = down;
