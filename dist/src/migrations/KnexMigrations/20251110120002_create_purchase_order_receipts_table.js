"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.createTable('inv_purchase_order_receipts', (table) => {
        table.string('id', 50).primary();
        table.string('order_id', 50).notNullable();
        table.string('order_item_id', 50).notNullable();
        table.string('receipt_number', 100).notNullable();
        table.date('received_date').notNullable();
        table.string('received_by', 100);
        table.integer('quantity_received').notNullable();
        table.string('batch_number', 100);
        table.date('expiry_date');
        table.decimal('unit_price', 10, 2);
        table.decimal('tax_rate', 5, 2);
        table.decimal('discount_rate', 5, 2);
        table.enum('condition_status', ['good', 'acceptable', 'damaged', 'expired']).defaultTo('good');
        table.boolean('quality_check_passed').defaultTo(true);
        table.text('notes');
        table.string('image_url', 255);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.foreign('order_id').references('id').inTable('inv_purchase_orders');
        table.foreign('order_item_id').references('id').inTable('inv_purchase_order_items');
        table.unique(['receipt_number']);
        table.index(['order_id', 'order_item_id', 'received_date', 'batch_number']);
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTable('inv_purchase_order_receipts');
}
exports.down = down;
