"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    return knex.schema.createTable('commission_tiers', (table) => {
        table.increments('id').primary();
        table.integer('commission_config_id').unsigned().notNullable();
        // Tier boundaries (half-open interval [min, max))
        table.decimal('min_amount_inclusive', 12, 2).notNullable().comment('Minimum service amount for this tier');
        table.decimal('max_amount_exclusive', 12, 2).nullable().comment('Maximum service amount (exclusive). Null = unbounded');
        // Tier calculation type and value
        table.enum('tier_type', ['fixed', 'percentage']).notNullable();
        table.decimal('tier_value', 10, 4).notNullable().comment('Commission value (amount or percentage)');
        // Ordering for tier matching
        table.smallint('sort_order').defaultTo(1).comment('Order for matching (lowest amount first)');
        // Timestamps
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now()).onUpdate(knex.fn.now());
        // Foreign key to config
        table.foreign('commission_config_id')
            .references('id')
            .inTable('commission_configs')
            .onDelete('CASCADE');
        // Indexes
        table.index(['commission_config_id', 'min_amount_inclusive']);
        table.unique(['commission_config_id', 'sort_order']);
    });
}
exports.up = up;
async function down(knex) {
    return knex.schema.dropTableIfExists('commission_tiers');
}
exports.down = down;
