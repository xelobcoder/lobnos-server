import { Knex } from 'knex';

const PHARMACY_CATEGORY_ID = 'CAT-PHARMACY';
const PHARMACY_CATEGORY_NAME = 'Pharmacy';

export async function up(knex: Knex): Promise<void> {
     const pharmacyCategory = await knex('inv_categories').whereRaw('LOWER(name) = ?', [PHARMACY_CATEGORY_NAME.toLowerCase()]).first();
     if (!pharmacyCategory) await knex('inv_categories').insert({ id: PHARMACY_CATEGORY_ID, name: PHARMACY_CATEGORY_NAME, description: 'Mandatory category for inventory items available to pharmacy workflows.', item_count: 0, created_at: new Date(), updated_at: new Date() });
     if (!await knex.schema.hasColumn('inv_inventory_items', 'sale_price')) await knex.schema.alterTable('inv_inventory_items', (table) => table.decimal('sale_price', 14, 2).notNullable().defaultTo(0));
}

export async function down(_knex: Knex): Promise<void> { }