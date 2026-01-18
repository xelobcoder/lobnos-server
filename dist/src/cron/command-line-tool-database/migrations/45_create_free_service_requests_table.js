"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    const tableExists = await knex.schema.hasTable('free_service_requests');
    if (!tableExists) {
        await knex.schema.createTable('free_service_requests', (table) => {
            table.increments('id').primary();
            table.integer('requester_id').notNullable();
            table.string('requester_name', 255).notNullable();
            table.text('reason').notNullable();
            table
                .enum('status', ['PENDING', 'APPROVED', 'REJECTED'])
                .notNullable()
                .defaultTo('PENDING');
            table.integer('reviewer_id').nullable();
            table.string('reviewer_name', 255).nullable();
            table.text('reviewer_notes').nullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
            table.timestamp('approved_at').nullable();
            table.timestamp('rejected_at').nullable();
            table.index('status');
            table.index('created_at');
            table.index('requester_id');
        });
    }
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTableIfExists('free_service_requests');
}
exports.down = down;
