import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
     await knex.schema.alterTable('inv_inventory_items', (table) => {
          table.string('brand_id', 50).references('id').inTable('inv_brands').onDelete('SET NULL').comment('Reference to brand/manufacturer');
          table.index('brand_id', 'idx_inv_item_brand');
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.alterTable('inv_inventory_items', (table) => {
          table.dropIndex('brand_id', 'idx_inv_item_brand');
          table.dropColumn('brand_id');
     });
}