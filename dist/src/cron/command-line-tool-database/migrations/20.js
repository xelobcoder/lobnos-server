"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    return knex.schema
        .createTable('inventory_templates', function (table) {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.text('description');
        table.string('testId').notNullable(); // Links to the test (e.g., from your test table)
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
        .createTable('inventory_template_items', function (table) {
        table.increments('id').primary();
        table.integer('template_id').unsigned().references('id').inTable('inventory_templates').onDelete('CASCADE');
        table.string('itemId').notNullable(); // Matches your inventory item ID
        table.string('itemName').notNullable();
        table.decimal('quantity', 10, 2).notNullable(); // Quantity to deduct
        table.string('unit').notNullable(); // e.g., 'boxes'
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });
}
exports.up = up;
async function down(knex) {
    return knex.schema
        .dropTableIfExists('inventory_template_items')
        .dropTableIfExists('inventory_templates');
}
exports.down = down;
