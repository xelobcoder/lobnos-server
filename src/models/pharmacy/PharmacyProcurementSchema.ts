import { Knex } from 'knex';

export async function ensurePharmacyProcurementSchema(db: Knex): Promise<void> {
     if (!await db.schema.hasTable('pharmacy_supplier_invoice_files')) await db.schema.createTable('pharmacy_supplier_invoice_files', t => {
          t.string('id', 36).primary(); t.integer('branchid').unsigned().notNullable();
          t.string('invoice_id', 36).notNullable(); t.string('upload_id', 36).notNullable().unique();
          t.integer('created_by').unsigned().notNullable(); t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
          t.index(['branchid', 'invoice_id']);
     });
     for (const [table, column] of [['pharmacy_purchase_orders', 'total_amount'], ['pharmacy_purchase_order_lines', 'unit_cost']]) {
          if (await db.schema.hasTable(table)) {
               const info = await db(table).columnInfo(column);
               if (info.nullable === false) await db.schema.alterTable(table, t => { t.decimal(column, 14, 2).nullable().alter(); });
          }
     }
     if (!await db.schema.hasTable('pharmacy_order_sequences')) await db.schema.createTable('pharmacy_order_sequences', t => {
          t.integer('branchid').unsigned().notNullable();
          t.integer('year').unsigned().notNullable();
          t.integer('last_number').unsigned().notNullable().defaultTo(0);
          t.primary(['branchid', 'year']);
     });
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
