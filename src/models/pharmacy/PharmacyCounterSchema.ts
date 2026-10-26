import { Knex } from 'knex';
export async function ensurePharmacyCounterSchema(db: Knex) {
    if (!await db.schema.hasTable('pharmacy_checkout_settings'))
        await db.schema.createTable('pharmacy_checkout_settings', t => { t.integer('branchid').unsigned().primary(); t.string('mode', 24).notNullable().defaultTo('direct'); t.integer('updated_by').unsigned().nullable(); t.timestamp('updated_at').notNullable().defaultTo(db.fn.now()); });
    if (!await db.schema.hasTable('pharmacy_counter_invoices'))
        await db.schema.createTable('pharmacy_counter_invoices', t => { t.bigIncrements('sequence').primary(); t.string('id', 36).notNullable().unique(); t.integer('branchid').unsigned().notNullable(); t.string('code', 4).notNullable(); t.string('invoice_number', 80).nullable().unique(); t.string('status', 20).notNullable(); t.text('details').notNullable(); t.decimal('total', 14, 2).notNullable(); t.integer('attendant_id').unsigned().notNullable(); t.string('attendant_name', 255).notNullable(); t.string('sale_id', 36).nullable().unique(); t.integer('cashier_id').unsigned().nullable(); t.integer('collected_by').unsigned().nullable(); t.timestamp('paid_at').nullable(); t.timestamp('collected_at').nullable(); t.timestamp('created_at').notNullable(); t.timestamp('updated_at').notNullable(); t.unique(['branchid', 'code']); t.index(['branchid', 'status', 'created_at']); });
}
