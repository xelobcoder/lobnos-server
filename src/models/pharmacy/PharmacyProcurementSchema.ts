import { Knex } from 'knex';

export async function ensurePharmacyProcurementSchema(db: Knex): Promise<void> {
     if (!await db.schema.hasTable('pharmacy_procurement_settings')) await db.schema.createTable('pharmacy_procurement_settings', t => {
          t.integer('branchid').unsigned().primary();
          t.string('mode', 20).notNullable().defaultTo('approval');
          t.decimal('tolerance_percent', 8, 3).notNullable().defaultTo(0);
          t.decimal('rounding_increment', 14, 2).notNullable().defaultTo(0.01);
          t.integer('version').unsigned().notNullable().defaultTo(1);
          t.integer('updated_by').unsigned().notNullable();
          t.timestamp('updated_at').notNullable();
     });
     if (!await db.schema.hasTable('pharmacy_price_history')) await db.schema.createTable('pharmacy_price_history', t => {
          t.string('id', 36).primary(); t.integer('branchid').unsigned().notNullable();
          t.string('item_id', 64).notNullable(); t.string('source_id', 64).notNullable();
          t.text('previous_values').notNullable(); t.text('new_values').notNullable(); t.text('calculation').notNullable();
          t.integer('changed_by').unsigned().notNullable(); t.timestamp('effective_at').notNullable();
          t.index(['branchid', 'item_id', 'effective_at'], 'idx_pharmacy_price_history');
          t.unique(['source_id', 'item_id'], 'uq_pharmacy_receiving_price_change');
     });
}
