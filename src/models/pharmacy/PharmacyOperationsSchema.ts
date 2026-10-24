import { Knex } from 'knex';

/** Guarded upgrades for explicit days and purchase-pack receiving. No lab tables are altered. */
export async function ensurePharmacyOperationsSchema(db: Knex): Promise<void> {
     if (!await db.schema.hasTable('pharmacy_financial_day_events')) await db.schema.createTable('pharmacy_financial_day_events', t => {
          t.string('id', 36).primary(); t.integer('branchid').unsigned().notNullable(); t.date('financial_date').notNullable();
          t.string('event_type', 20).notNullable(); t.string('reason', 500).nullable(); t.integer('performed_by').unsigned().notNullable();
          t.json('details').nullable(); t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
          t.index(['branchid', 'financial_date'], 'idx_pharmacy_day_events_branch_date');
     });
     if (!await db.schema.hasColumn('pharmacy_financial_days', 'opened_by')) await db.schema.alterTable('pharmacy_financial_days', t => {
          t.integer('opened_by').unsigned().nullable(); t.timestamp('opened_at').nullable(); t.string('opening_note', 500).nullable();
     });
     if (!await db.schema.hasColumn('pharmacy_shifts', 'financial_date')) await db.schema.alterTable('pharmacy_shifts', t => t.date('financial_date').nullable().index());
     if (!await db.schema.hasColumn('pharmacy_inventory_items', 'purchase_unit')) await db.schema.alterTable('pharmacy_inventory_items', t => {
          t.string('purchase_unit', 100).nullable(); t.decimal('units_per_purchase_unit', 14, 3).notNullable().defaultTo(1);
          t.decimal('cost_price', 18, 6).notNullable().defaultTo(0).alter();
     });
     if (!await db.schema.hasColumn('pharmacy_stock_movements', 'purchase_quantity')) await db.schema.alterTable('pharmacy_stock_movements', t => {
          t.decimal('purchase_quantity', 14, 3).nullable(); t.string('receiving_unit', 100).nullable(); t.decimal('conversion_factor', 14, 3).nullable();
          t.decimal('purchase_unit_cost', 14, 2).nullable(); t.decimal('unit_cost', 18, 6).notNullable().alter();
     });
     if (!await db.schema.hasColumn('pharmacy_sale_lines', 'unit_cost_basis')) await db.schema.alterTable('pharmacy_sale_lines', t => {
          t.string('unit_cost_basis', 20).notNullable().defaultTo('base_unit'); t.decimal('unit_cost', 18, 6).notNullable().defaultTo(0).alter();
     });
}
