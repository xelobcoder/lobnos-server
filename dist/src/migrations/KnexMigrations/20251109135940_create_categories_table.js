"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.createTable('inv_categories', (table) => {
        table.string('id', 50).primary().comment('UUID unique identifier');
        table.string('name', 255).notNullable().unique().comment('Category name - must be unique');
        table.text('description').comment('Optional detailed description');
        table.integer('item_count').defaultTo(0).comment('Computed: number of active items in this category');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
        // Indexes
        table.index('name', 'idx_inv_category_name');
        table.index('item_count', 'idx_inv_category_item_count');
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTable('inv_categories');
}
exports.down = down;
