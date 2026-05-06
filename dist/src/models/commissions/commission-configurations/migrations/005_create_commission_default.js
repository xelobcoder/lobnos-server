"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    return knex.schema.createTable('commission_default', (table) => {
        table.increments('id').primary();
        // Recipient information
        table.enum('recipient_type', ['clinician', 'organization']).notNullable().index();
        table.integer('recipient_id').unsigned().notNullable();
        // Default commission configuration
        table.integer('commission_config_id').unsigned().notNullable();
        // Status
        table.boolean('is_active').defaultTo(true).index();
        // Timestamps
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now()).onUpdate(knex.fn.now());
        // Foreign key to config
        table.foreign('commission_config_id')
            .references('id')
            .inTable('commission_configs')
            .onDelete('RESTRICT');
        // Unique constraint - only one default per recipient
        table.unique(['recipient_type', 'recipient_id']);
        // Indexes
        table.index(['recipient_type', 'recipient_id', 'is_active']);
    });
}
exports.up = up;
async function down(knex) {
    return knex.schema.dropTableIfExists('commission_default');
}
exports.down = down;
