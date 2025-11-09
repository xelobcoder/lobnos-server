"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.createTable('inv_storage_locations', (table) => {
        table.string('id', 50).primary();
        table.string('name', 255).notNullable().unique().comment('Location name');
        table.text('description').comment('Detailed description');
        table.integer('capacity').comment('Maximum capacity (optional)');
        table.boolean('temperature_controlled').defaultTo(false).comment('Requires temperature control');
        table.string("temperature_range").comment("Temperature range details (if applicable)");
        table.boolean('hazardous_materials').defaultTo(false).comment('Can store hazardous materials');
        table.boolean('is_active').defaultTo(true).comment('Location is active');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
        // Indexes
        table.index('name', 'idx_inv_location_name');
        table.index('is_active', 'idx_inv_location_active');
        table.index('temperature_controlled', 'idx_inv_location_temp_control');
        table.index('hazardous_materials', 'idx_inv_location_hazardous');
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTable('inv_storage_locations');
}
exports.down = down;
