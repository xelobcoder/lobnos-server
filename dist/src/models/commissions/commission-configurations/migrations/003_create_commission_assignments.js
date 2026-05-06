"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    return knex.schema.createTable('commission_assignments', (table) => {
        table.increments('id').primary();
        table.integer('commission_config_id').unsigned().notNullable();
        // Scope of assignment (system > organization > clinician)
        table.enum('scope_type', ['system', 'organization', 'clinician']).notNullable().index();
        table.integer('scope_id').unsigned().nullable().comment('ID of org/clinician. Null for system scope');
        // Service specification (null = global)
        table.integer('service_id').unsigned().nullable().comment('Exact service match');
        table.string('service_category', 100).nullable().comment('Service category match');
        // Priority for resolution (higher wins)
        table.smallint('priority').defaultTo(50).notNullable().index().comment('Higher priority overrides lower');
        // Validity window
        table.date('assigned_from').notNullable().defaultTo(knex.fn.now());
        table.date('assigned_to').nullable().comment('Null means ongoing');
        // Status
        table.boolean('is_active').defaultTo(true).index();
        // Timestamps
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now()).onUpdate(knex.fn.now());
        // Foreign key to config
        table.foreign('commission_config_id')
            .references('id')
            .inTable('commission_configs')
            .onDelete('CASCADE');
        // Indexes for resolution queries
        table.index(['scope_type', 'scope_id', 'is_active']);
        table.index(['is_active', 'priority', 'assigned_from']);
    });
}
exports.up = up;
async function down(knex) {
    return knex.schema.dropTableIfExists('commission_assignments');
}
exports.down = down;
