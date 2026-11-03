import { Knex } from 'knex';

/** Pharmacy storage deliberately has no foreign keys into lab inventory or accounting. */
export async function ensurePharmacySeparationSchema(db: Knex): Promise<void> {
     if (!await db.schema.hasTable('pharmacy_inventory_items')) await db.schema.createTable('pharmacy_inventory_items', t => {
          t.string('id', 64).primary(); t.integer('branchid').unsigned().notNullable();
          t.string('name', 255).notNullable(); t.string('sku', 100).notNullable(); t.string('consumption_unit', 100).notNullable().defaultTo('unit');
          t.decimal('current_stock', 14, 3).notNullable().defaultTo(0); t.decimal('min_stock', 14, 3).notNullable().defaultTo(0);
          t.decimal('cost_price', 14, 2).notNullable().defaultTo(0); t.decimal('sale_price', 14, 2).notNullable().defaultTo(0); t.decimal('wholesale_price', 14, 2).notNullable().defaultTo(0);
          t.boolean('requires_prescription').notNullable().defaultTo(false); t.boolean('pharmacy_batch_tracking').notNullable().defaultTo(true);
          t.boolean('is_active').notNullable().defaultTo(true); t.string('status', 32).notNullable().defaultTo('out_of_stock');
          t.timestamp('last_updated').nullable(); t.timestamp('created_at').defaultTo(db.fn.now()); t.timestamp('updated_at').defaultTo(db.fn.now());
          t.unique(['branchid', 'sku']); t.index(['branchid', 'is_active']);
     });
     if (!await db.schema.hasTable('pharmacy_stock_movements')) await db.schema.createTable('pharmacy_stock_movements', t => {
          t.string('id', 64).primary(); t.string('item_id', 64).notNullable(); t.integer('branchid').unsigned().notNullable();
          t.string('transaction_type', 32).notNullable(); t.decimal('quantity', 14, 3).notNullable(); t.string('unit_type', 32).defaultTo('consumption');
          t.decimal('previous_stock', 14, 3).notNullable(); t.decimal('new_stock', 14, 3).notNullable();
          t.decimal('unit_cost', 14, 2).notNullable(); t.decimal('total_cost', 14, 2).notNullable();
          t.string('reason', 500).notNullable(); t.string('reference_id', 128).notNullable(); t.integer('patientid').unsigned().nullable();
          t.integer('performed_by').unsigned().notNullable(); t.timestamp('transaction_date').notNullable(); t.text('notes').nullable();
          t.string('batch_number', 100).nullable(); t.date('expiry_date').nullable(); t.timestamp('created_at').defaultTo(db.fn.now());
          t.index(['item_id', 'batch_number']); t.index(['branchid', 'transaction_date']); t.index(['reference_id']);
          t.foreign('item_id').references('id').inTable('pharmacy_inventory_items');
     });
     if (!await db.schema.hasTable('pharmacy_collection_accounts')) await db.schema.createTable('pharmacy_collection_accounts', t => {
          t.increments('id'); t.integer('branchid').unsigned().notNullable(); t.string('name', 120).notNullable();
          t.string('account_type', 32).notNullable(); t.string('currency', 3).notNullable().defaultTo('GHS'); t.boolean('is_active').notNullable().defaultTo(true);
          t.integer('created_by').unsigned().notNullable(); t.timestamp('created_at').defaultTo(db.fn.now()); t.unique(['branchid', 'name']);
     });
     if (!await db.schema.hasTable('pharmacy_payment_routes')) await db.schema.createTable('pharmacy_payment_routes', t => {
          t.increments('id'); t.integer('branchid').unsigned().notNullable(); t.string('method', 32).notNullable(); t.integer('account_id').unsigned().notNullable();
          t.integer('updated_by').unsigned().notNullable(); t.timestamp('updated_at').defaultTo(db.fn.now()); t.unique(['branchid', 'method']);
          t.foreign('account_id').references('id').inTable('pharmacy_collection_accounts');
     });
     if (!await db.schema.hasTable('pharmacy_financial_days')) await db.schema.createTable('pharmacy_financial_days', t => {
          t.increments('id'); t.integer('branchid').unsigned().notNullable(); t.date('financial_date').notNullable();
          t.string('status', 20).notNullable().defaultTo('open'); t.integer('closed_by').unsigned().nullable(); t.timestamp('closed_at').nullable();
          t.unique(['branchid', 'financial_date']);
     });
     if (!await db.schema.hasTable('pharmacy_journals')) await db.schema.createTable('pharmacy_journals', t => {
          t.string('id', 64).primary(); t.integer('branchid').unsigned().notNullable(); t.string('source_ref', 128).notNullable();
          t.string('kind', 32).notNullable(); t.string('description', 500).notNullable(); t.date('financial_date').notNullable();
          t.integer('created_by').unsigned().notNullable(); t.timestamp('created_at').defaultTo(db.fn.now()); t.unique(['source_ref', 'kind']);
          t.index(['branchid', 'financial_date']);
     });
     if (!await db.schema.hasTable('pharmacy_journal_lines')) await db.schema.createTable('pharmacy_journal_lines', t => {
          t.increments('id'); t.string('journal_id', 64).notNullable(); t.string('account_code', 100).notNullable();
          t.decimal('debit', 14, 2).notNullable().defaultTo(0); t.decimal('credit', 14, 2).notNullable().defaultTo(0);
          t.foreign('journal_id').references('id').inTable('pharmacy_journals'); t.index(['account_code']);
     });
     if (!await db.schema.hasTable('pharmacy_suppliers')) await db.schema.createTable('pharmacy_suppliers', t => {
          t.string('id', 64).primary(); t.integer('branchid').unsigned().notNullable(); t.string('name', 255).notNullable();
          t.string('phone', 100).nullable(); t.string('email', 255).nullable(); t.boolean('is_active').notNullable().defaultTo(true);
     });
     if (!await db.schema.hasTable('pharmacy_documents')) await db.schema.createTable('pharmacy_documents', t => {
          t.string('id', 64).primary(); t.integer('branchid').unsigned().notNullable(); t.string('kind', 32).notNullable(); t.string('request_key', 128).notNullable().unique();
          t.string('request_hash', 64).notNullable(); t.string('supplier_id', 64).nullable(); t.decimal('amount', 14, 2).notNullable();
          t.text('details').notNullable(); t.integer('created_by').unsigned().notNullable(); t.timestamp('created_at').defaultTo(db.fn.now());
          t.index(['branchid', 'kind']);
     });
     if (!await db.schema.hasTable('pharmacy_purchase_orders')) await db.schema.createTable('pharmacy_purchase_orders', t => {
          t.string('id', 64).primary(); t.integer('branchid').unsigned().notNullable(); t.string('supplier_id', 64).notNullable();
          t.string('status', 32).notNullable().defaultTo('ordered'); t.decimal('total_amount', 14, 2).nullable();
          t.integer('created_by').unsigned().notNullable(); t.timestamp('created_at').defaultTo(db.fn.now()); t.string('notes', 500).nullable();
          t.foreign('supplier_id').references('id').inTable('pharmacy_suppliers'); t.index(['branchid', 'status']);
     });
     if (!await db.schema.hasTable('pharmacy_purchase_order_lines')) await db.schema.createTable('pharmacy_purchase_order_lines', t => {
          t.string('id', 64).primary(); t.string('order_id', 64).notNullable(); t.string('item_id', 64).notNullable();
          t.decimal('quantity_ordered', 14, 3).notNullable(); t.decimal('quantity_received', 14, 3).notNullable().defaultTo(0); t.decimal('unit_cost', 14, 2).nullable();
          t.foreign('order_id').references('id').inTable('pharmacy_purchase_orders'); t.foreign('item_id').references('id').inTable('pharmacy_inventory_items'); t.unique(['order_id', 'item_id']);
     });
     if (!await db.schema.hasTable('pharmacy_shifts')) await db.schema.createTable('pharmacy_shifts', t => {
          t.string('id', 64).primary(); t.integer('branchid').unsigned().notNullable(); t.integer('cashier_id').unsigned().notNullable();
          // Non-null only while open. Unique key prevents two open shifts for the same cashier/branch.
          t.string('active_key', 100).nullable().unique(); t.decimal('opening_float', 14, 2).notNullable();
          t.decimal('counted_cash', 14, 2).nullable(); t.decimal('expected_cash', 14, 2).nullable(); t.decimal('variance', 14, 2).nullable();
          t.timestamp('opened_at').notNullable(); t.timestamp('closed_at').nullable(); t.integer('closed_by').unsigned().nullable();
     });
     if (!await db.schema.hasColumn('pharmacy_shifts', 'reviewed_by')) await db.schema.alterTable('pharmacy_shifts', t => { t.integer('reviewed_by').unsigned().nullable(); t.timestamp('reviewed_at').nullable(); t.string('review_note', 500).nullable(); });
     for (const [column, create] of Object.entries({
          amount_tendered: (t: Knex.AlterTableBuilder) => t.decimal('amount_tendered', 14, 2).nullable(),
          change_amount: (t: Knex.AlterTableBuilder) => t.decimal('change_amount', 14, 2).nullable(),
          shift_id: (t: Knex.AlterTableBuilder) => t.string('shift_id', 64).nullable(),
          accounting_version: (t: Knex.AlterTableBuilder) => t.integer('accounting_version').notNullable().defaultTo(1),
     })) if (!await db.schema.hasColumn('pharmacy_sales', column)) await db.schema.alterTable('pharmacy_sales', create);
     if (!await db.schema.hasColumn('pharmacy_payments', 'refund_shift_id')) await db.schema.alterTable('pharmacy_payments', t => t.string('refund_shift_id', 64).nullable());
     for(const table of ['pharmacy_sale_lines','pharmacy_held_sale_lines']) {
          if(!await db.schema.hasColumn(table,'price_type'))await db.schema.alterTable(table,t=>t.string('price_type',16).notNullable().defaultTo('retail'));
     }
}
