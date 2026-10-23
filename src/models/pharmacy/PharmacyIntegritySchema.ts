import { Knex } from 'knex';

export async function ensurePharmacyIntegritySchema(db: Knex): Promise<void> {
     for (const column of ['requires_prescription', 'pharmacy_batch_tracking']) {
          if (!await db.schema.hasColumn('inv_inventory_items', column)) await db.schema.alterTable('inv_inventory_items', table => {
               table.boolean(column).notNullable().defaultTo(column === 'pharmacy_batch_tracking');
          });
     }
     for (const column of ['request_hash', 'prescription_id', 'held_sale_id']) {
          if (!await db.schema.hasColumn('pharmacy_sales', column)) await db.schema.alterTable('pharmacy_sales', table => table.string(column, column === 'request_hash' ? 64 : 36).nullable());
     }
     for (const column of ['payment_account_id', 'branchid']) {
          if (!await db.schema.hasColumn('pharmacy_sales', column)) await db.schema.alterTable('pharmacy_sales', table => table.integer(column).unsigned().nullable());
     }
     if (!await db.schema.hasColumn('pharmacy_held_sales','branchid')) await db.schema.alterTable('pharmacy_held_sales',table=>table.integer('branchid').unsigned().nullable());
     if (!await db.schema.hasTable('pharmacy_item_profile_audit')) await db.schema.createTable('pharmacy_item_profile_audit',table=>{
          table.increments('id'); table.string('item_id',64).notNullable(); table.text('previous_values').notNullable(); table.text('new_values').notNullable();
          table.integer('changed_by').unsigned().notNullable(); table.timestamp('changed_at').notNullable();
     });
     if (!await db.schema.hasTable('pharmacy_reconciliations')) await db.schema.createTable('pharmacy_reconciliations',table=>{
          table.increments('id'); table.integer('payment_account_id').unsigned().notNullable(); table.integer('cashier_id').unsigned().notNullable();
          table.integer('branchid').unsigned().notNullable(); table.date('financial_date').notNullable();
          table.decimal('expected_amount',14,2).notNullable(); table.decimal('counted_amount',14,2).notNullable(); table.decimal('difference',14,2).notNullable();
          table.string('notes',500).notNullable(); table.integer('recorded_by').unsigned().notNullable(); table.timestamp('recorded_at').notNullable();
          table.index(['financial_date','branchid'],'idx_pharmacy_reconciliation_date');
     });
     if (!await db.schema.hasTable('pharmacy_payments')) await db.schema.createTable('pharmacy_payments', table => {
          table.increments('id'); table.string('sale_id', 36).notNullable().unique();
          table.integer('payment_account_id').unsigned().notNullable(); table.integer('branchid').unsigned().nullable();
          table.decimal('amount', 14, 2).notNullable(); table.string('method', 32).notNullable(); table.string('reference', 128).nullable();
          table.string('status', 20).notNullable(); table.integer('recorded_by').unsigned().notNullable(); table.timestamp('collected_at').notNullable();
          table.integer('reversed_by').unsigned().nullable(); table.timestamp('reversed_at').nullable(); table.string('reversal_reason', 500).nullable();
          table.index(['branchid', 'recorded_by', 'collected_at'], 'idx_pharmacy_payment_scope');
     });
     if(!await db.schema.hasColumn('pharmacy_payments','verified_by'))await db.schema.alterTable('pharmacy_payments',table=>table.integer('verified_by').unsigned().nullable());
     if (!await db.schema.hasTable('pharmacy_dispenses')) await db.schema.createTable('pharmacy_dispenses', table => {
          table.increments('id'); table.string('sale_id', 36).notNullable(); table.string('prescription_id', 36).notNullable();
          table.string('prescription_item_id', 36).notNullable(); table.decimal('quantity', 14, 3).notNullable();
          table.boolean('is_reversed').notNullable().defaultTo(false); table.unique(['sale_id', 'prescription_item_id']);
          table.index(['prescription_id'], 'idx_pharmacy_dispense_prescription');
     });
     if (!await db.schema.hasTable('pharmacy_returns')) await db.schema.createTable('pharmacy_returns', table => {
          table.increments('id'); table.string('sale_id', 36).notNullable(); table.string('inventory_item_id', 64).notNullable();
          table.decimal('quantity', 14, 3).notNullable(); table.string('disposition', 32).notNullable();
          table.integer('recorded_by').unsigned().notNullable(); table.timestamp('created_at').notNullable();
          table.unique(['sale_id', 'inventory_item_id']);
     });
}
