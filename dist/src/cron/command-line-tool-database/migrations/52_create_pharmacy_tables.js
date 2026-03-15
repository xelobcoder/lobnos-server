"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // 1. pharmacy_orders
    if (!(await knex.schema.hasTable('pharmacy_orders'))) {
        await knex.schema.createTable('pharmacy_orders', (table) => {
            table.increments('id').primary();
            table.integer('branchid').notNullable();
            table.integer('patient_id').nullable();
            table.integer('doctor_id').nullable();
            table.string('order_type').notNullable().defaultTo('WALK_IN'); // PRESCRIPTION, WALK_IN
            table.string('payment_status').notNullable().defaultTo('PENDING'); // PENDING, PAID, CANCELLED
            table.string('dispensation_status').notNullable().defaultTo('PENDING'); // PENDING, DISPENSED
            table.decimal('total_amount', 10, 2).defaultTo(0);
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
            table.index('branchid');
        });
    }
    // 2. pharmacy_order_items
    if (!(await knex.schema.hasTable('pharmacy_order_items'))) {
        await knex.schema.createTable('pharmacy_order_items', (table) => {
            table.increments('id').primary();
            table.integer('order_id').unsigned().notNullable().references('id').inTable('pharmacy_orders').onDelete('CASCADE');
            table.integer('drug_id').notNullable(); // References drugs
            table.integer('quantity').notNullable();
            table.string('dosage').nullable();
            table.string('frequency').nullable();
            table.string('duration').nullable();
            table.decimal('unit_price', 10, 2).notNullable();
            table.decimal('subtotal', 10, 2).notNullable();
        });
    }
    // 3. pharmacy_dispensations
    if (!(await knex.schema.hasTable('pharmacy_dispensations'))) {
        await knex.schema.createTable('pharmacy_dispensations', (table) => {
            table.increments('id').primary();
            table.integer('branchid').notNullable();
            table.integer('order_id').unsigned().notNullable().references('id').inTable('pharmacy_orders').onDelete('CASCADE');
            table.integer('pharmacist_id').notNullable();
            table.timestamp('dispensation_date').defaultTo(knex.fn.now());
            table.index('branchid');
        });
    }
    // 4. pharmacy_dispensation_items
    if (!(await knex.schema.hasTable('pharmacy_dispensation_items'))) {
        await knex.schema.createTable('pharmacy_dispensation_items', (table) => {
            table.increments('id').primary();
            table.integer('dispensation_id').unsigned().notNullable().references('id').inTable('pharmacy_dispensations').onDelete('CASCADE');
            table.integer('inventory_item_id').notNullable();
            table.integer('batch_id').nullable();
            table.integer('quantity_dispensed').notNullable();
        });
    }
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTableIfExists('pharmacy_dispensation_items');
    await knex.schema.dropTableIfExists('pharmacy_dispensations');
    await knex.schema.dropTableIfExists('pharmacy_order_items');
    await knex.schema.dropTableIfExists('pharmacy_orders');
}
exports.down = down;
