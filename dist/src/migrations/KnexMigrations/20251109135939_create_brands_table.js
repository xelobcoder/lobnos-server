"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.createTable('inv_brands', (table) => {
        table.string('id', 50).primary().comment('UUID or auto-generated unique identifier');
        table.string('name', 255).notNullable().unique().comment('Brand name - must be unique across system');
        table.timestamp('created_date').defaultTo(knex.fn.now()).comment('Date brand was first added to system');
        table.integer('item_count').defaultTo(0).comment('Computed: number of active inventory items using this brand');
        table.timestamp('created_at').defaultTo(knex.fn.now()).comment('Record creation timestamp');
        table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')).comment('Last modification timestamp');
        // Indexes
        table.index('name', 'idx_inv_brand_name');
        table.index('created_date', 'idx_inv_brand_created_date');
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTable('inv_brands');
}
exports.down = down;
