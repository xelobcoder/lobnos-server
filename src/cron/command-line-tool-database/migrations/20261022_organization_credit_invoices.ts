import { Knex } from 'knex';

/**
 * Organizational credit invoices (accounts receivable owed by a contracted organization).
 *
 * Per-facility database: tenancy is the connection, so there is deliberately no tenant column.
 * - org_invoice_sequences: one row per year, row-locked (SELECT ... FOR UPDATE) inside the invoice
 *   transaction, giving gapless, concurrency-safe INV-YYYY-NNNNNN numbers.
 * - org_invoice_lines.active_service_id: equals service_id while the invoice is live and is cleared
 *   on void. Its UNIQUE index is the database-level guard against invoicing a service twice.
 * - org_invoice_payments.idempotency_key: UNIQUE so a retried/double-clicked payment is recorded once.
 * Idempotent: safe to run from the migrator and from the lazy runtime bootstrapper.
 */
export async function up(knex: Knex): Promise<void> {
     if (!(await knex.schema.hasTable('org_invoice_sequences'))) {
          await knex.schema.createTable('org_invoice_sequences', table => {
               table.integer('seq_year').unsigned().notNullable().primary();
               table.integer('last_value').unsigned().notNullable().defaultTo(0);
          });
     }

     if (!(await knex.schema.hasTable('org_invoices'))) {
          await knex.schema.createTable('org_invoices', table => {
               table.increments('id').primary();
               table.string('invoice_number', 32).notNullable().unique('org_invoices_number_unique');
               table.integer('organization_id').unsigned().notNullable().index('org_invoices_org_idx');
               table.date('invoice_date').notNullable();
               table.date('due_date').notNullable();
               table.string('status', 20).notNullable().defaultTo('unpaid').index('org_invoices_status_idx');
               table.string('payment_terms', 255).notNullable().defaultTo('');
               table.string('reference', 120).notNullable().defaultTo('');
               table.string('notes', 1000).notNullable().defaultTo('');
               table.decimal('subtotal', 14, 2).notNullable().defaultTo(0);
               table.decimal('discount_total', 14, 2).notNullable().defaultTo(0);
               table.decimal('tax_total', 14, 2).notNullable().defaultTo(0);
               table.decimal('total_amount', 14, 2).notNullable().defaultTo(0);
               table.decimal('prior_credits', 14, 2).notNullable().defaultTo(0);
               table.decimal('amount_due', 14, 2).notNullable().defaultTo(0);
               table.decimal('amount_paid', 14, 2).notNullable().defaultTo(0);
               table.decimal('balance_due', 14, 2).notNullable().defaultTo(0);
               table.integer('created_by').unsigned().nullable();
               table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
               table.timestamp('voided_at').nullable();
               table.integer('voided_by').unsigned().nullable();
               table.string('void_reason', 500).notNullable().defaultTo('');
          });
     }

     if (!(await knex.schema.hasTable('org_invoice_lines'))) {
          await knex.schema.createTable('org_invoice_lines', table => {
               table.increments('id').primary();
               table.integer('invoice_id').unsigned().notNullable().index('org_invoice_lines_invoice_idx');
               table.integer('service_id').unsigned().notNullable().index('org_invoice_lines_service_idx');
               table.integer('active_service_id').unsigned().nullable().unique('org_invoice_lines_active_service_unique');
               table.integer('billing_id').unsigned().notNullable().index('org_invoice_lines_billing_idx');
               table.integer('patient_id').unsigned().nullable();
               table.string('patient_name', 255).notNullable().defaultTo('');
               table.string('description', 255).notNullable().defaultTo('');
               table.dateTime('service_date').nullable();
               table.integer('quantity').unsigned().notNullable().defaultTo(1);
               table.decimal('unit_price', 14, 2).notNullable().defaultTo(0);
               table.decimal('discount', 14, 2).notNullable().defaultTo(0);
               table.decimal('tax', 14, 2).notNullable().defaultTo(0);
               table.decimal('line_total', 14, 2).notNullable().defaultTo(0);
               table.decimal('prior_credit', 14, 2).notNullable().defaultTo(0);
               table.decimal('amount_due', 14, 2).notNullable().defaultTo(0);
               table.decimal('amount_paid', 14, 2).notNullable().defaultTo(0);
          });
     }

     if (!(await knex.schema.hasTable('org_invoice_payments'))) {
          await knex.schema.createTable('org_invoice_payments', table => {
               table.increments('id').primary();
               table.integer('invoice_id').unsigned().notNullable().index('org_invoice_payments_invoice_idx');
               table.decimal('amount', 14, 2).notNullable();
               table.integer('payment_mode_id').unsigned().notNullable();
               table.date('payment_date').notNullable();
               table.string('reference', 120).notNullable().defaultTo('');
               table.string('notes', 500).notNullable().defaultTo('');
               table.string('idempotency_key', 80).nullable().unique('org_invoice_payments_idempotency_unique');
               table.integer('received_by').unsigned().nullable();
               table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
          });
     }

     if (!(await knex.schema.hasTable('org_invoice_payment_allocations'))) {
          await knex.schema.createTable('org_invoice_payment_allocations', table => {
               table.increments('id').primary();
               table.integer('payment_id').unsigned().notNullable().index('org_invoice_alloc_payment_idx');
               table.integer('line_id').unsigned().notNullable().index('org_invoice_alloc_line_idx');
               table.integer('service_id').unsigned().notNullable();
               table.integer('billing_id').unsigned().notNullable();
               /** billinghx.KeyID written for this allocation's billing, linking AR to the legacy ledger. */
               table.integer('billinghx_id').unsigned().nullable();
               table.decimal('amount', 14, 2).notNullable();
          });
     }
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTableIfExists('org_invoice_payment_allocations');
     await knex.schema.dropTableIfExists('org_invoice_payments');
     await knex.schema.dropTableIfExists('org_invoice_lines');
     await knex.schema.dropTableIfExists('org_invoices');
     await knex.schema.dropTableIfExists('org_invoice_sequences');
}
