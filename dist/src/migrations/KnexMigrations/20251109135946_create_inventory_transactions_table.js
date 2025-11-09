"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.createTable('inv_inventory_transactions', (table) => {
        table.string('id', 50).primary();
        table.string('item_id', 50).notNullable().references('id').inTable('inv_inventory_items').comment('Reference to inventory item');
        table.enum('transaction_type', ['consumption', 'addition', 'adjustment', 'transfer']).notNullable();
        table.integer('quantity').notNullable().comment('Quantity involved in transaction');
        table.integer('previous_stock').notNullable().comment('Stock level before transaction');
        table.integer('new_stock').notNullable().comment('Stock level after transaction');
        table.string('batch_number', 100).comment('Batch/lot number (if applicable)');
        table.string('brand_name', 255).comment('Brand name at time of transaction');
        table.string('reason', 255).comment('Reason for transaction');
        table.string('reference_id', 50).comment('Reference to order, test, etc.');
        table.string('performed_by', 100).comment('User who performed transaction');
        table.timestamp('transaction_date').defaultTo(knex.fn.now()).comment('When transaction occurred');
        table.text('notes').comment('Additional notes');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        // Indexes
        table.index('item_id', 'idx_inv_transaction_item');
        table.index('transaction_type', 'idx_inv_transaction_type');
        table.index('transaction_date', 'idx_inv_transaction_date');
        table.index('performed_by', 'idx_inv_transaction_performed_by');
        table.index('reference_id', 'idx_inv_transaction_reference');
        table.index('batch_number', 'idx_inv_transaction_batch');
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTable('inv_inventory_transactions');
}
exports.down = down;
