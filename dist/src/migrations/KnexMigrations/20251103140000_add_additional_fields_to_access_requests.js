"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.alterTable('result_access_requests', (table) => {
        table.integer('requested_by').nullable().comment('Employee ID of who made the request');
        table.integer('approved_by').nullable().comment('Employee ID of who approved');
        table.text('approval_notes').nullable().comment('Notes from approver');
        table.string('expected_duration').nullable().comment('Expected duration of access needed');
        table.string('department').nullable().comment('Department of requester');
        table.text('contact_info').nullable().comment('Additional contact details');
        table.text('comments').nullable().comment('General comments');
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.alterTable('result_access_requests', (table) => {
        table.dropColumn('requested_by');
        table.dropColumn('approved_by');
        table.dropColumn('approval_notes');
        table.dropColumn('expected_duration');
        table.dropColumn('department');
        table.dropColumn('contact_info');
        table.dropColumn('comments');
    });
}
exports.down = down;
