"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    return knex.schema.createTable('commission_configs', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable();
        table.enum('commission_type', ['percentage', 'fixed', 'tiered', 'hybrid']).notNullable();
        // Percentage-based commission
        table.decimal('percentage_rate', 10, 4).nullable().comment('For percentage and hybrid types');
        // Fixed commission component
        table.decimal('fixed_component', 10, 2).nullable().comment('For fixed and hybrid types');
        // Commission caps (per-service)
        table.decimal('min_commission', 10, 2).defaultTo(0).comment('Minimum commission amount');
        table.decimal('max_commission', 10, 2).defaultTo(999999).comment('Maximum commission amount');
        // Period caps (daily/weekly/monthly/quarterly/yearly)
        table.decimal('period_cap', 10, 2).nullable().comment('Maximum commission in a period');
        table.enum('period_cap_reset', [
            'daily',
            'weekly',
            'monthly',
            'quarterly',
            'yearly'
        ]).nullable().comment('When period cap resets');
        // Validity window
        table.date('effective_from').notNullable().defaultTo(knex.fn.now());
        table.date('effective_to').nullable().comment('Null means ongoing');
        // Status
        table.boolean('is_active').defaultTo(true).index();
        // Timestamps
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now()).onUpdate(knex.fn.now());
        // Indexes for common queries
        table.index(['is_active', 'commission_type']);
        table.index(['effective_from', 'effective_to']);
    });
}
exports.up = up;
async function down(knex) {
    return knex.schema.dropTableIfExists('commission_configs');
}
exports.down = down;
