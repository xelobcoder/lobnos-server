"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.createTable('inv_inventory_items', (table) => {
        table.string('id', 50).primary();
        table.string('name', 255).notNullable().comment('Item name');
        table.string('sku', 100).notNullable().unique().comment('Stock Keeping Unit - unique identifier');
        table.text('description').comment('Detailed item description');
        table.string('category_id', 50).references('id').inTable('inv_categories').onDelete('SET NULL');
        table.string('unit', 50).defaultTo('pieces').comment('Unit of measurement');
        table.integer('current_stock').defaultTo(0).comment('Current quantity in stock');
        table.integer('min_stock').defaultTo(0).comment('Minimum stock level threshold');
        table.integer('max_stock').defaultTo(0).comment('Maximum stock level (optional)');
        table.decimal('unit_price', 10, 2).defaultTo(0.00).comment('Price per unit');
        table.decimal('total_value', 12, 2).defaultTo(0.00).comment('Computed: current_stock * unit_price');
        table.string('location_id', 50).references('id').inTable('inv_storage_locations').onDelete('SET NULL');
        table.date('expiry_date').comment('Expiration date (if applicable)');
        table.string('batch_number', 100).comment('Manufacturing batch/lot number');
        table.enum('status', ['in_stock', 'low_stock', 'out_of_stock', 'expired']).defaultTo('out_of_stock').comment('Computed stock status');
        table.boolean('is_active').defaultTo(true).comment('Item is active in system');
        table.timestamp('last_updated').defaultTo(knex.fn.now()).comment('Last stock change');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
        // Indexes
        table.index('sku', 'idx_inv_item_sku');
        table.index('name', 'idx_inv_item_name');
        table.index('category_id', 'idx_inv_item_category');
        table.index('location_id', 'idx_inv_item_location');
        table.index('status', 'idx_inv_item_status');
        table.index('expiry_date', 'idx_inv_item_expiry');
        table.index('is_active', 'idx_inv_item_active');
        table.index(['current_stock', 'min_stock', 'max_stock'], 'idx_inv_item_stock_levels');
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTable('inv_inventory_items');
}
exports.down = down;
