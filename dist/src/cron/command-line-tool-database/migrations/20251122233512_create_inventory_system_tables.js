"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Create inv_brands table
    await knex.schema.createTable('inv_brands', (table) => {
        table.string('id', 50).primary();
        table.string('name', 255).notNullable();
        table.timestamp('created_date').nullable().defaultTo(knex.fn.now());
        table.integer('item_count').defaultTo(0);
        table.timestamp('created_at').nullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').nullable().defaultTo(knex.fn.now());
        table.string('inventory_item_id', 50).nullable();
        table.index('name', null, 'unique');
        table.index('name');
        table.index('created_date');
    });
    // Create inv_categories table
    await knex.schema.createTable('inv_categories', (table) => {
        table.string('id', 50).primary();
        table.string('name', 255).notNullable();
        table.text('description').nullable();
        table.integer('item_count').defaultTo(0);
        table.timestamp('created_at').nullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').nullable().defaultTo(knex.fn.now());
        table.index('name', null, 'unique');
        table.index('name');
        table.index('item_count');
    });
    // Create inv_storage_locations table
    await knex.schema.createTable('inv_storage_locations', (table) => {
        table.string('id', 50).primary();
        table.string('name', 255).notNullable();
        table.text('description').nullable();
        table.integer('capacity').nullable();
        table.tinyint('temperature_controlled').defaultTo(0);
        table.tinyint('hazardous_materials').defaultTo(0);
        table.tinyint('is_active').defaultTo(1);
        table.timestamp('created_at').nullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').nullable().defaultTo(knex.fn.now());
        table.string('temperature_range', 20).notNullable();
        table.index('name', null, 'unique');
        table.index('name');
        table.index('is_active');
        table.index('temperature_controlled');
        table.index('hazardous_materials');
    });
    // Create inv_suppliers table
    await knex.schema.createTable('inv_suppliers', (table) => {
        table.string('id', 50).primary();
        table.string('name', 255).notNullable();
        table.string('contact', 255).nullable();
        table.string('email', 255).nullable();
        table.string('phone', 50).nullable();
        table.text('address').nullable();
        table.tinyint('is_active').defaultTo(1);
        table.timestamp('created_at').nullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').nullable().defaultTo(knex.fn.now());
        table.index('name');
        table.index('is_active');
        table.index('email');
    });
    // Create inv_inventory_items table (depends on inv_categories, inv_storage_locations)
    await knex.schema.createTable('inv_inventory_items', (table) => {
        table.string('id', 50).primary();
        table.string('name', 255).notNullable();
        table.string('sku', 100).notNullable();
        table.text('description').nullable();
        table.string('category_id', 50).nullable();
        table.string('unit', 50).defaultTo('pieces');
        table.integer('current_stock').defaultTo(0);
        table.integer('min_stock').defaultTo(0);
        table.integer('max_stock').defaultTo(0);
        table.string('location_id', 50).nullable();
        table.enum('status', ['in_stock', 'low_stock', 'out_of_stock', 'expired']).defaultTo('out_of_stock');
        table.tinyint('is_active').defaultTo(1);
        table.timestamp('last_updated').nullable().defaultTo(knex.fn.now());
        table.timestamp('created_at').nullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').nullable().defaultTo(knex.fn.now());
        table.index('sku', null, 'unique');
        table.index('sku');
        table.index('name');
        table.index('category_id');
        table.index('location_id');
        table.index('status');
        table.index('is_active');
        table.index(['current_stock', 'min_stock', 'max_stock']);
        table.foreign('category_id').references('id').inTable('inv_categories').onDelete('SET NULL');
        table.foreign('location_id').references('id').inTable('inv_storage_locations').onDelete('SET NULL');
    });
    // Create inv_consumption_history table (depends on inv_inventory_items)
    await knex.schema.createTable('inv_consumption_history', (table) => {
        table.string('id', 50).primary();
        table.string('item_id', 50).notNullable();
        table.integer('quantity_consumed').notNullable();
        table.string('consumed_by', 100).nullable();
        table.timestamp('consumption_date').nullable().defaultTo(knex.fn.now());
        table.string('batch_number', 100).nullable();
        table.decimal('unit_cost', 10, 2).nullable();
        table.decimal('total_cost', 12, 2).nullable();
        table.string('consumption_reason', 255).nullable();
        table.string('department', 100).nullable();
        table.string('patient_id', 50).nullable();
        table.string('prescription_id', 50).nullable();
        table.text('notes').nullable();
        table.string('approved_by', 100).nullable();
        table.timestamp('created_at').nullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').nullable().defaultTo(knex.fn.now());
        table.string('brand_name', 255).nullable();
        table.index('item_id');
        table.index(['consumption_date', 'item_id']);
        table.index(['consumed_by', 'consumption_date']);
        table.index('batch_number');
        table.index('consumption_reason');
        table.index('department');
        table.index('patient_id');
        table.foreign('item_id').references('id').inTable('inv_inventory_items');
    });
    // Create inv_inventory_transactions table (depends on inv_inventory_items)
    await knex.schema.createTable('inv_inventory_transactions', (table) => {
        table.string('id', 50).primary();
        table.string('item_id', 50).notNullable();
        table.enum('transaction_type', ['addition', 'consumption', 'adjustment', 'transfer', 'wastage']).notNullable();
        table.integer('quantity').notNullable();
        table.integer('previous_stock').notNullable();
        table.integer('new_stock').notNullable();
        table.string('batch_number', 100).nullable();
        table.date('expiry_date').nullable();
        table.decimal('unit_cost', 10, 2).nullable();
        table.decimal('total_cost', 12, 2).nullable();
        table.string('brand_name', 255).nullable();
        table.string('reason', 255).nullable();
        table.string('reference_id', 50).nullable();
        table.string('performed_by', 100).nullable();
        table.timestamp('transaction_date').nullable().defaultTo(knex.fn.now());
        table.text('notes').nullable();
        table.timestamp('created_at').nullable().defaultTo(knex.fn.now());
        table.integer('patient_id').nullable();
        table.integer('ascension_id').nullable();
        table.integer('testid').nullable();
        table.enum('wastage_type', ['expired', 'damaged', 'broken', 'contamination', 'other']).nullable();
        table.index('item_id');
        table.index(['item_id', 'transaction_type', 'transaction_date', 'batch_number', 'reference_id']);
        table.index(['transaction_date', 'transaction_type']);
        table.index(['reference_id', 'transaction_type']);
        table.foreign('item_id').references('id').inTable('inv_inventory_items');
    });
    // Create inv_purchase_orders table (depends on inv_suppliers)
    await knex.schema.createTable('inv_purchase_orders', (table) => {
        table.string('id', 50).primary();
        table.string('order_number', 100).notNullable();
        table.string('supplier_id', 50).notNullable();
        table.date('order_date').notNullable();
        table.date('expected_delivery_date').nullable();
        table.enum('status', ['ordered', 'partially_received', 'received', 'cancelled']).defaultTo('ordered');
        table.decimal('total_amount', 12, 2).defaultTo(0.00);
        table.text('notes').nullable();
        table.string('created_by', 100).nullable();
        table.timestamp('created_at').nullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').nullable().defaultTo(knex.fn.now());
        table.string('communication_method', 50).nullable();
        table.text('communication_notes').nullable();
        table.index('order_number', null, 'unique');
        table.index('supplier_id');
        table.index(['order_number', 'supplier_id', 'status', 'order_date']);
        table.index(['status', 'order_date']);
        table.index(['supplier_id', 'order_date']);
        table.foreign('supplier_id').references('id').inTable('inv_suppliers');
    });
    // Create inv_purchase_order_items table (depends on inv_purchase_orders, inv_inventory_items)
    await knex.schema.createTable('inv_purchase_order_items', (table) => {
        table.string('id', 50).primary();
        table.string('order_id', 50).notNullable();
        table.string('inventory_item_id', 50).nullable();
        table.integer('quantity_ordered').notNullable();
        table.integer('quantity_received').defaultTo(0);
        table.decimal('unit_price', 10, 2).notNullable();
        table.decimal('tax_rate', 5, 2).defaultTo(0.00);
        table.decimal('discount_rate', 5, 2).defaultTo(0.00);
        table.decimal('line_total', 12, 2).notNullable();
        table.enum('status', ['pending', 'partially_received', 'received', 'cancelled']).defaultTo('pending');
        table.text('notes').nullable();
        table.timestamp('created_at').nullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').nullable().defaultTo(knex.fn.now());
        table.index('order_id');
        table.index('inventory_item_id');
        table.index(['order_id', 'inventory_item_id', 'status']);
        table.index('status');
        table.foreign('inventory_item_id').references('id').inTable('inv_inventory_items');
        table.foreign('order_id').references('id').inTable('inv_purchase_orders').onDelete('CASCADE');
    });
    // Create inv_purchase_order_receipts table (depends on inv_purchase_orders, inv_purchase_order_items)
    await knex.schema.createTable('inv_purchase_order_receipts', (table) => {
        table.string('id', 50).primary();
        table.string('order_id', 50).notNullable();
        table.string('order_item_id', 50).notNullable();
        table.string('receipt_number', 100).notNullable();
        table.date('received_date').notNullable();
        table.string('received_by', 100).nullable();
        table.integer('quantity_received').notNullable();
        table.string('batch_number', 100).nullable();
        table.date('expiry_date').nullable();
        table.decimal('unit_price', 10, 2).nullable();
        table.decimal('tax_rate', 5, 2).nullable();
        table.decimal('discount_rate', 5, 2).nullable();
        table.enum('condition_status', ['good', 'acceptable', 'damaged', 'expired']).defaultTo('good');
        table.tinyint('quality_check_passed').defaultTo(1);
        table.text('notes').nullable();
        table.string('image_url', 255).nullable();
        table.timestamp('created_at').nullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.index('receipt_number', null, 'unique');
        table.index('order_id');
        table.index('order_item_id');
        table.index(['order_id', 'order_item_id', 'received_date', 'batch_number']);
        table.index(['batch_number', 'expiry_date']);
        table.foreign('order_id').references('id').inTable('inv_purchase_orders');
        table.foreign('order_item_id').references('id').inTable('inv_purchase_order_items');
    });
    // Create inv_supplier_payments table (depends on inv_suppliers, inv_purchase_orders)
    await knex.schema.createTable('inv_supplier_payments', (table) => {
        table.string('id', 50).primary();
        table.string('payment_id', 50).notNullable();
        table.string('supplier_id', 50).notNullable();
        table.string('purchase_order_id', 50).notNullable();
        table.decimal('payment_amount', 12, 2).notNullable();
        table.decimal('total_allocated', 12, 2).defaultTo(0.00);
        table.date('payment_date').notNullable();
        table.enum('payment_method', ['cash', 'check', 'bank_transfer', 'credit_card', 'wire_transfer', 'other']).defaultTo('bank_transfer');
        table.enum('payment_status', ['pending', 'completed', 'failed', 'cancelled', 'refunded', 'reject']).defaultTo('pending');
        table.string('reference_number', 100).nullable();
        table.text('payment_notes').nullable();
        table.string('created_by', 100).nullable();
        table.string('approved_by', 100).nullable();
        table.timestamp('approved_at').nullable();
        table.timestamp('processed_at').nullable();
        table.timestamp('created_at').nullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').nullable().defaultTo(knex.fn.now());
        table.index('payment_id', null, 'unique');
        table.index('supplier_id');
        table.index('purchase_order_id');
        table.index(['supplier_id', 'payment_status', 'payment_date']);
        table.index(['purchase_order_id', 'payment_status']);
        table.index(['payment_date', 'payment_status']);
        table.index('payment_method');
        table.index('reference_number');
        table.index('created_at');
        table.index('updated_at');
        table.index('payment_id');
        table.foreign('purchase_order_id').references('id').inTable('inv_purchase_orders');
        table.foreign('supplier_id').references('id').inTable('inv_suppliers');
    });
    // Create inv_supplier_payment_allocations table (depends on inv_supplier_payments, inv_purchase_orders, inv_purchase_order_items)
    await knex.schema.createTable('inv_supplier_payment_allocations', (table) => {
        table.string('id', 50).primary();
        table.string('payment_id', 50).notNullable();
        table.string('purchase_order_id', 50).notNullable();
        table.string('order_item_id', 50).nullable();
        table.decimal('allocated_amount', 12, 2).notNullable();
        table.text('allocation_notes').nullable();
        table.timestamp('created_at').nullable().defaultTo(knex.fn.now());
        table.index('payment_id');
        table.index('purchase_order_id');
        table.index('order_item_id');
        table.index(['payment_id', 'purchase_order_id']);
        table.index('created_at');
        table.foreign('order_item_id').references('id').inTable('inv_purchase_order_items');
        table.foreign('payment_id').references('id').inTable('inv_supplier_payments').onDelete('CASCADE');
        table.foreign('purchase_order_id').references('id').inTable('inv_purchase_orders');
    });
}
exports.up = up;
async function down(knex) {
    // Drop tables in reverse order due to foreign key constraints
    const tables = [
        'inv_supplier_payment_allocations',
        'inv_supplier_payments',
        'inv_purchase_order_receipts',
        'inv_purchase_order_items',
        'inv_purchase_orders',
        'inv_inventory_transactions',
        'inv_consumption_history',
        'inv_inventory_items',
        'inv_suppliers',
        'inv_storage_locations',
        'inv_categories',
        'inv_brands'
    ];
    for (const table of tables) {
        await knex.schema.dropTableIfExists(table);
    }
}
exports.down = down;
