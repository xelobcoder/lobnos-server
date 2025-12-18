import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    // Create units table
    await knex.schema.createTable('inv_units', (table) => {
        table.string('id', 50).primary();
        table.string('name', 100).notNullable();
        table.text('description');
        table.enum('category', ['count', 'weight', 'volume', 'custom']).notNullable();
        table.boolean('is_standard').defaultTo(true);
        table.timestamps(true, true);
    });

    // Insert standard units
    await knex('inv_units').insert([
        { id: 'pieces', name: 'Pieces', description: 'Individual pieces or items', category: 'count', is_standard: true },
        { id: 'boxes', name: 'Boxes', description: 'Standard cardboard boxes', category: 'count', is_standard: true },
        { id: 'bottles', name: 'Bottles', description: 'Glass or plastic bottles', category: 'count', is_standard: true },
        { id: 'packs', name: 'Packs', description: 'Pre-packaged units', category: 'count', is_standard: true },
        { id: 'liters', name: 'Liters', description: 'Volume in liters', category: 'volume', is_standard: true },
        { id: 'kg', name: 'Kilograms', description: 'Weight in kilograms', category: 'weight', is_standard: true },
        { id: 'mg', name: 'Milligrams', description: 'Weight in milligrams', category: 'weight', is_standard: true },
        { id: 'ml', name: 'Milliliters', description: 'Volume in milliliters', category: 'volume', is_standard: true },
        { id: 'units', name: 'Units', description: 'Generic units', category: 'count', is_standard: true },
        { id: 'vials', name: 'Vials', description: 'Small containers', category: 'count', is_standard: true },
        { id: 'tubes', name: 'Tubes', description: 'Test tubes or containers', category: 'count', is_standard: true },
        { id: 'plates', name: 'Plates', description: 'Culture plates or similar', category: 'count', is_standard: true },
        { id: 'strips', name: 'Strips', description: 'Test strips', category: 'count', is_standard: true },
        { id: 'kits', name: 'Kits', description: 'Complete kits', category: 'count', is_standard: true }
    ]);

    // Add new columns to inventory items
    await knex.schema.alterTable('inv_inventory_items', (table) => {
        table.string('consumption_unit').notNullable().defaultTo('pieces');
    });

    // Add new columns to inventory transactions
    await knex.schema.alterTable('inv_inventory_transactions', (table) => {
        table.enum('unit_type', ['consumption', 'purchase']).notNullable().defaultTo('consumption');
        table.string('purchase_unit');
        table.decimal('units_per_purchase_unit', 10, 4);
    });

    // Create packages table
    await knex.schema.createTable('inv_packages', (table) => {
        table.string('id', 50).primary();
        table.string('item_id', 50).notNullable();
        table.string('package_identifier', 100).notNullable();
        table.decimal('total_quantity', 10, 2).notNullable();
        table.decimal('remaining_quantity', 10, 2).notNullable();
        table.string('unit', 50).notNullable();
        table.string('batch_number', 100);
        table.date('expiry_date');
        table.date('opened_date');
        table.boolean('is_opened').defaultTo(false);
        table.string('storage_location_id', 50);
        table.string('supplier_id', 50);
        table.string('purchase_order_id', 50);
        table.decimal('cost_per_unit', 10, 4);
        table.enum('status', ['sealed', 'opened', 'empty', 'expired', 'damaged']).defaultTo('sealed');
        table.timestamps(true, true);

        table.foreign('item_id').references('id').inTable('inv_inventory_items');
        table.foreign('storage_location_id').references('id').inTable('inv_storage_locations');
        table.foreign('supplier_id').references('id').inTable('inv_suppliers');
    });

    // Create package transactions table
    await knex.schema.createTable('inv_package_transactions', (table) => {
        table.string('id', 50).primary();
        table.string('package_id', 50).notNullable();
        table.enum('transaction_type', ['open', 'consume', 'transfer', 'waste', 'adjust']).notNullable();
        table.decimal('quantity', 10, 2).notNullable();
        table.decimal('previous_remaining', 10, 2).notNullable();
        table.decimal('new_remaining', 10, 2).notNullable();
        table.text('reason');
        table.string('performed_by', 50);
        table.timestamp('transaction_date').defaultTo(knex.fn.now());

        table.foreign('package_id').references('id').inTable('inv_packages');
    });

}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('inv_inventory_transactions', (table) => {
        table.dropColumn('unit_type');
        table.dropColumn('purchase_unit');
        table.dropColumn('units_per_purchase_unit');
    });

    await knex.schema.dropTableIfExists('inv_package_transactions');
    await knex.schema.dropTableIfExists('inv_packages');

    await knex.schema.alterTable('inv_inventory_items', (table) => {
        table.dropColumn('consumption_unit');
    });

    await knex.schema.dropTableIfExists('inv_units');
}