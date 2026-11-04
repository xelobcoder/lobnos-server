import { Knex } from 'knex';

/** Per-database schema; never add a tenant column to financial records. */
export async function ensureBillingIntegritySchema(db: Knex): Promise<void> {
    for (const name of ['billing_submission_requests', 'billing_refund_requests']) {
        if (!await db.schema.hasTable(name)) await db.schema.createTable(name, t => {
            t.string('request_key', 80).primary();
            t.string('fingerprint', 64).notNullable();
            t.text('result_json').nullable();
            t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
        });
    }
    if (!await db.schema.hasTable('billing_receipt_corrections')) await db.schema.createTable('billing_receipt_corrections', t => {
        t.increments('id').primary();
        t.string('request_key', 80).notNullable().unique();
        t.string('fingerprint', 64).notNullable();
        t.integer('original_history_id').unsigned().notNullable().unique();
        t.integer('reversal_history_id').unsigned().notNullable();
        t.integer('replacement_history_id').unsigned().notNullable();
        t.string('reason', 500).notNullable();
        t.integer('employeeid').unsigned().notNullable();
        t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
    });
    if (!await db.schema.hasTable('billing_refund_events')) await db.schema.createTable('billing_refund_events', t => {
        t.increments('id').primary();
        t.string('request_key', 80).notNullable().index();
        t.integer('billingid').unsigned().notNullable();
        t.integer('serviceid').unsigned().notNullable();
        t.integer('history_id').unsigned().notNullable();
        t.decimal('amount', 14, 2).notNullable();
        t.decimal('tax_amount', 14, 2).notNullable();
        t.integer('employeeid').unsigned().notNullable();
        t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
    });
}
