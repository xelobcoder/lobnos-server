"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    return knex.schema.createTable('commission_tracking', (table) => {
        table.increments('id').primary();
        // Service information
        table.integer('service_id').unsigned().notNullable().index();
        table.decimal('service_amount', 12, 2).notNullable().comment('Service amount at time of calculation');
        // Commission calculation details
        table.enum('commission_type', ['percentage', 'fixed', 'tiered', 'hybrid']).notNullable();
        table.decimal('percentage_rate_applied', 10, 4).nullable();
        table.decimal('fixed_amount_applied', 10, 2).nullable();
        table.integer('tier_id').unsigned().nullable().comment('If tiered commission');
        // Calculated amounts
        table.decimal('commission_due', 10, 2).notNullable().comment('Raw calculation (before caps)');
        table.decimal('min_cap_adjustment', 10, 2).defaultTo(0).comment('Adjustment from min cap');
        table.decimal('max_cap_adjustment', 10, 2).defaultTo(0).comment('Adjustment from max cap');
        table.decimal('period_cap_adjustment', 10, 2).defaultTo(0).comment('Adjustment from period cap');
        table.decimal('final_commission', 10, 2).notNullable().comment('After all caps applied');
        // Configuration and assignment references
        table.integer('config_id').unsigned().notNullable().comment('Which config was used');
        table.integer('assignment_id').unsigned().nullable().comment('Which assignment matched (null for default)');
        // Recipient information
        table.enum('recipient_type', ['clinician', 'organization']).notNullable().index();
        table.integer('recipient_id').unsigned().notNullable();
        // Period cap information
        table.string('cap_period_reference', 50).nullable().comment('e.g., "2024-06" for monthly');
        // Status workflow
        table.enum('status', ['pending', 'approved', 'paid', 'voided', 'adjusted']).defaultTo('pending').index();
        // Currency
        table.string('currency', 3).defaultTo('GHS');
        // Timestamps
        table.timestamp('calculated_at').defaultTo(knex.fn.now()).index();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now()).onUpdate(knex.fn.now());
        // Foreign keys
        table.foreign('config_id')
            .references('id')
            .inTable('commission_configs')
            .onDelete('RESTRICT');
        table.foreign('tier_id')
            .references('id')
            .inTable('commission_tiers')
            .onDelete('SET NULL');
        table.foreign('assignment_id')
            .references('id')
            .inTable('commission_assignments')
            .onDelete('SET NULL');
        // Indexes for common queries
        table.index(['service_id']);
        table.index(['recipient_type', 'recipient_id', 'status']);
        table.index(['status', 'calculated_at']);
        table.index(['cap_period_reference', 'recipient_type', 'recipient_id']);
    });
}
exports.up = up;
async function down(knex) {
    return knex.schema.dropTableIfExists('commission_tracking');
}
exports.down = down;
