"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.createTable('inv_purchase_orders', (table) => {
        table.string('id', 50).primary();
        table.string('order_number', 100).notNullable().unique().comment('Unique order number (auto-generated)');
        table.string('supplier_id', 50).notNullable().references('id').inTable('inv_suppliers');
        table.date('order_date').notNullable().comment('Date order was placed');
        table.date('expected_delivery_date').comment('Expected delivery date');
        table.date('actual_delivery_date').comment('Actual delivery date');
        table.enum('status', ['draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled']).defaultTo('draft');
        table.decimal('total_amount', 12, 2).defaultTo(0.00).comment('Computed: sum of all line items');
        table.text('notes').comment('Order notes');
        table.string('created_by', 100).comment('User who created the order');
        table.string('approved_by', 100).comment('User who approved the order');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
        // Indexes
        table.index('order_number', 'idx_inv_order_number');
        table.index('supplier_id', 'idx_inv_order_supplier');
        table.index('status', 'idx_inv_order_status');
        table.index(['order_date', 'expected_delivery_date', 'actual_delivery_date'], 'idx_inv_order_dates');
        table.index('created_by', 'idx_inv_order_created_by');
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTable('inv_purchase_orders');
}
exports.down = down;
