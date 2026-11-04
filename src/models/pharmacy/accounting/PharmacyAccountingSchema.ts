import { Knex } from 'knex';
import { ensureCashFlowReviewSchema } from '../../../accountingModule/init/cashFlowSchema';
export const REVERSAL_IDENTITY_SQL = "varchar(36) GENERATED ALWAYS AS (CASE WHEN status <> 'voided' THEN reversal_of ELSE NULL END) VIRTUAL";

/** Additive only. Called by the pharmacy bootstrap/migration, never by request handlers. */
export async function ensurePharmacyAccountingSchema(db: Knex): Promise<void> {
     await ensureCashFlowReviewSchema(db, true);
     if (!await db.schema.hasTable('pharmacy_accounting_settings')) await db.schema.createTable('pharmacy_accounting_settings', t => {
          t.integer('branchid').unsigned().primary(); t.integer('tenant_id').unsigned().notNullable();
          t.boolean('enabled').notNullable().defaultTo(false); t.date('effective_date').nullable(); t.json('mappings').nullable();
          t.integer('updated_by').unsigned().notNullable(); t.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
     });
     if (!await db.schema.hasTable('pharmacy_accounting_posting_links')) await db.schema.createTable('pharmacy_accounting_posting_links', t => {
          t.string('journal_id', 64).primary(); t.integer('shared_entry_id').unsigned().notNullable().unique();
          t.integer('branchid').unsigned().notNullable(); t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
     });
     if (!await db.schema.hasTable('pharmacy_accounting_requests')) await db.schema.createTable('pharmacy_accounting_requests', t => {
          t.integer('branchid').unsigned().notNullable(); t.string('request_key', 128).notNullable(); t.string('request_hash', 64).notNullable();
          t.integer('actor_id').unsigned().notNullable(); t.text('response', 'longtext').notNullable(); t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
          t.primary(['branchid', 'request_key']);
     });
     if (!await db.schema.hasTable('pharmacy_accounting_audit')) await db.schema.createTable('pharmacy_accounting_audit', t => {
          t.increments('id'); t.integer('branchid').unsigned().notNullable(); t.integer('actor_id').unsigned().notNullable();
          t.string('action', 80).notNullable(); t.string('entity_id', 128).notNullable();
          t.text('before_state', 'longtext').nullable(); t.text('after_state', 'longtext').notNullable();
          t.timestamp('created_at').notNullable().defaultTo(db.fn.now()); t.index(['branchid', 'created_at']);
     });
     if (!await db.schema.hasTable('pharmacy_accounting_owned_accounts')) await db.schema.createTable('pharmacy_accounting_owned_accounts', t => {
          t.integer('account_id').unsigned().primary(); t.integer('branchid').unsigned().notNullable();
          t.integer('created_by').unsigned().notNullable(); t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
     });
     if (!await db.schema.hasTable('pharmacy_local_accounts')) await db.schema.createTable('pharmacy_local_accounts', t => {
          t.increments('id'); t.integer('branchid').unsigned().notNullable();
          t.string('account_code', 20).notNullable(); t.string('local_code', 100).notNullable();
          t.string('name', 120).notNullable(); t.string('type', 20).notNullable(); t.string('normal_balance', 6).notNullable();
          t.string('parent_code', 100).nullable(); t.boolean('is_active').notNullable().defaultTo(true);
          t.integer('created_by').unsigned().notNullable(); t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
          t.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
          t.unique(['branchid', 'account_code'], 'uq_pharm_local_account_code');
          t.unique(['branchid', 'local_code'], 'uq_pharm_local_posting_code');
     });
     if (!await db.schema.hasTable('pharmacy_accounting_documents')) await db.schema.createTable('pharmacy_accounting_documents', t => {
          t.string('id', 36).primary(); t.integer('branchid').unsigned().notNullable(); t.string('kind', 20).notNullable();
          t.string('status', 24).notNullable(); t.integer('version').unsigned().notNullable().defaultTo(1);
          t.date('financial_date').notNullable(); t.string('description', 500).notNullable();
          t.decimal('amount', 14, 2).notNullable(); t.text('details', 'longtext').notNullable();
          t.integer('created_by').unsigned().notNullable(); t.integer('submitted_by').unsigned().nullable(); t.integer('approved_by').unsigned().nullable();
          t.string('reversal_of', 36).nullable(); t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
          t.timestamp('updated_at').notNullable().defaultTo(db.fn.now()); t.index(['branchid', 'kind', 'status']);
     });
     await ensureReversalIntentIdentity(db);
     if (!await db.schema.hasTable('pharmacy_accounting_expense_payments')) await db.schema.createTable('pharmacy_accounting_expense_payments', t => {
          t.string('id', 36).primary(); t.string('expense_id', 36).notNullable(); t.integer('branchid').unsigned().notNullable();
          t.integer('account_id').unsigned().notNullable(); t.date('financial_date').notNullable(); t.decimal('amount', 14, 2).notNullable();
          t.string('method', 32).notNullable(); t.string('reference', 128).nullable(); t.integer('created_by').unsigned().notNullable();
          t.timestamp('created_at').notNullable().defaultTo(db.fn.now()); t.index(['branchid', 'expense_id']);
     });
     if (!await db.schema.hasTable('pharmacy_accounting_statements')) await db.schema.createTable('pharmacy_accounting_statements', t => {
          t.string('id', 36).primary(); t.integer('branchid').unsigned().notNullable(); t.integer('account_id').unsigned().notNullable();
          t.string('reference', 128).notNullable(); t.date('start_date').notNullable(); t.date('end_date').notNullable();
          t.decimal('opening_balance', 14, 2).notNullable(); t.decimal('closing_balance', 14, 2).notNullable();
          t.string('status', 20).notNullable().defaultTo('imported'); t.integer('created_by').unsigned().notNullable();
          t.integer('finalized_by').unsigned().nullable(); t.timestamp('finalized_at').nullable(); t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
          t.unique(['branchid', 'account_id', 'reference'], 'uq_pharm_acc_statement_ref');
     });
     if (!await db.schema.hasTable('pharmacy_accounting_statement_lines')) await db.schema.createTable('pharmacy_accounting_statement_lines', t => {
          t.string('id', 36).primary(); t.string('statement_id', 36).notNullable(); t.integer('branchid').unsigned().notNullable();
          t.integer('account_id').unsigned().notNullable(); t.string('reference', 128).notNullable(); t.date('financial_date').notNullable();
          t.decimal('amount', 14, 2).notNullable(); t.string('description', 500).nullable();
          t.integer('journal_line_id').unsigned().nullable().unique(); t.integer('matched_by').unsigned().nullable(); t.timestamp('matched_at').nullable();
          t.unique(['branchid', 'account_id', 'reference'], 'uq_pharm_acc_bank_reference'); t.index(['statement_id']);
     });
     if (!await db.schema.hasTable('pharmacy_accounting_bills')) await db.schema.createTable('pharmacy_accounting_bills', t => {
          t.string('id', 36).primary(); t.integer('branchid').unsigned().notNullable(); t.string('supplier_id', 64).notNullable();
          t.string('source_kind', 20).notNullable(); t.string('source_ref', 64).notNullable(); t.string('reference', 128).notNullable();
          t.date('document_date').notNullable(); t.date('due_date').nullable(); t.decimal('amount', 14, 2).notNullable();
          t.integer('created_by').unsigned().notNullable(); t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
          t.unique(['branchid', 'source_kind', 'source_ref'], 'uq_pharm_acc_bill_source'); t.index(['branchid', 'supplier_id']);
     });
     if (!await db.schema.hasTable('pharmacy_accounting_allocations')) await db.schema.createTable('pharmacy_accounting_allocations', t => {
          t.string('id', 36).primary(); t.integer('branchid').unsigned().notNullable(); t.string('bill_id', 36).notNullable();
          t.string('document_id', 36).notNullable(); t.string('kind', 24).notNullable(); t.date('financial_date').notNullable();
          t.string('reversal_of_allocation_id', 36).nullable(); t.date('original_financial_date').nullable();
          t.decimal('amount', 14, 2).notNullable(); t.integer('created_by').unsigned().notNullable();
          t.timestamp('created_at').notNullable().defaultTo(db.fn.now()); t.unique(['bill_id', 'document_id'], 'uq_pharm_acc_bill_allocation');
          t.unique(['reversal_of_allocation_id'], 'uq_pharm_acc_allocation_reversal');
     });
     if (!await db.schema.hasColumn('pharmacy_accounting_allocations', 'reversal_of_allocation_id')) await db.schema.alterTable('pharmacy_accounting_allocations', t => {
          t.string('reversal_of_allocation_id', 36).nullable(); t.date('original_financial_date').nullable();
          t.unique(['reversal_of_allocation_id'], 'uq_pharm_acc_allocation_reversal');
     });
     if (!await db.schema.hasTable('pharmacy_accounting_invoice_terms')) await db.schema.createTable('pharmacy_accounting_invoice_terms', t => {
          t.string('sale_id', 36).primary(); t.integer('branchid').unsigned().notNullable(); t.date('due_date').notNullable();
          t.string('reason', 500).notNullable(); t.integer('created_by').unsigned().notNullable(); t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
     });
     if (!await db.schema.hasTable('pharmacy_accounting_uploads')) await db.schema.createTable('pharmacy_accounting_uploads', t => {
          t.string('id', 36).primary(); t.integer('branchid').unsigned().notNullable(); t.integer('uploaded_by').unsigned().notNullable();
          t.string('filename', 150).notNullable(); t.string('mime_type', 80).notNullable(); t.integer('byte_length').unsigned().notNullable();
          t.string('sha256', 64).notNullable(); t.text('content_base64', 'longtext').notNullable();
          t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
     });
     if (!await db.schema.hasTable('pharmacy_accounting_attachments')) await db.schema.createTable('pharmacy_accounting_attachments', t => {
          t.string('id', 36).primary(); t.integer('branchid').unsigned().notNullable(); t.string('expense_id', 36).notNullable();
          t.string('upload_id', 36).notNullable().unique(); t.integer('created_by').unsigned().notNullable();
          t.timestamp('created_at').notNullable().defaultTo(db.fn.now()); t.index(['branchid', 'expense_id']);
     });
     if (!await db.schema.hasTable('pharmacy_accounting_tax_adjustments')) await db.schema.createTable('pharmacy_accounting_tax_adjustments', t => {
          t.string('id', 36).primary(); t.integer('branchid').unsigned().notNullable(); t.string('sale_id', 36).notNullable();
          t.string('credit_document_id', 36).notNullable(); t.string('source_credit_id', 36).notNullable(); t.string('component_ref', 64).notNullable();
          t.string('tax_event_id', 36).nullable(); t.string('sale_line_id', 36).nullable(); t.string('event_type', 12).notNullable();
          t.string('policy', 48).notNullable(); t.date('financial_date').notNullable();
          for (const column of ['gross_amount', 'net_amount', 'tax_amount', 'original_gross_amount', 'original_net_amount', 'original_tax_amount']) t.decimal(column, 14, 2).notNullable();
          t.decimal('rate', 9, 4).nullable(); t.string('local_account', 100).nullable();
          t.string('reversal_of_adjustment_id', 36).nullable(); t.integer('created_by').unsigned().notNullable();
          t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
          t.unique(['credit_document_id', 'component_ref'], 'uq_pharm_acc_tax_credit_component');
          t.unique(['reversal_of_adjustment_id'], 'uq_pharm_acc_tax_credit_reversal');
          t.index(['branchid', 'sale_id', 'financial_date'], 'idx_pharm_acc_tax_credit_sale');
     });
     if (!await db.schema.hasTable('pharmacy_accounting_supplier_sources')) await db.schema.createTable('pharmacy_accounting_supplier_sources', t => {
          t.string('id', 36).primary(); t.integer('branchid').unsigned().notNullable(); t.string('supplier_id', 64).notNullable();
          t.string('source_kind', 20).notNullable(); t.string('source_ref', 64).notNullable(); t.string('journal_id', 64).notNullable().unique();
          t.string('source_hash', 64).notNullable(); t.decimal('amount', 14, 2).notNullable(); t.date('financial_date').notNullable();
          t.text('evidence', 'longtext').notNullable(); t.string('status', 20).notNullable().defaultTo('available');
          t.integer('registered_by').unsigned().notNullable(); t.timestamp('created_at').notNullable().defaultTo(db.fn.now());
          t.timestamp('retired_at').nullable(); t.integer('retired_by').unsigned().nullable(); t.string('retirement_reason', 500).nullable();
          t.unique(['branchid', 'source_kind', 'source_ref'], 'uq_pharm_acc_supplier_source');
     });
     if (!await db.schema.hasTable('pharmacy_accounting_supplier_uses')) await db.schema.createTable('pharmacy_accounting_supplier_uses', t => {
          t.string('id', 36).primary(); t.integer('branchid').unsigned().notNullable(); t.string('source_id', 36).notNullable();
          t.string('document_id', 36).notNullable(); t.string('bill_id', 36).notNullable(); t.string('allocation_id', 36).notNullable().unique();
          t.date('financial_date').notNullable(); t.decimal('amount', 14, 2).notNullable();
          t.string('reversal_of_use_id', 36).nullable().unique(); t.integer('created_by').unsigned().notNullable();
          t.timestamp('created_at').notNullable().defaultTo(db.fn.now()); t.index(['branchid', 'source_id']);
     });
     if (!await db.schema.hasTable('pharmacy_accounting_supplier_retirements')) await db.schema.createTable('pharmacy_accounting_supplier_retirements', t => {
          t.integer('branchid').unsigned().notNullable(); t.string('source_kind', 20).notNullable(); t.string('source_ref', 64).notNullable();
          t.integer('created_by').unsigned().notNullable(); t.string('reason', 500).notNullable();
          t.timestamp('created_at').notNullable().defaultTo(db.fn.now()); t.primary(['branchid', 'source_kind', 'source_ref']);
     });
}

/** Generated unique identity is enforced by MySQL and SQLite, not just application row locks.
 * Old reversal_of links are never cleared. Build the new constraint BEFORE dropping the legacy
 * unique index, so interrupted/nontransactional MySQL DDL cannot leave an unprotected identity.
 */
export async function ensureReversalIntentIdentity(db: Knex): Promise<void> {
     const table = 'pharmacy_accounting_documents';
     const client = String((db.client as any).dialect || db.client.config.client).toLowerCase();
     const indexExists = async (name: string): Promise<boolean> => {
          if (client.includes('mysql')) return Boolean(await db('information_schema.statistics').whereRaw('TABLE_SCHEMA = DATABASE()').where({ TABLE_NAME: table, INDEX_NAME: name }).first());
          if (client.includes('sqlite')) return Boolean(await db('sqlite_master').where({ type: 'index', name, tbl_name: table }).first());
          throw new Error('Pharmacy reversal identity migration supports MySQL and SQLite only');
     };
     if (!await db.schema.hasColumn(table, 'replaces_intent_id')) await db.schema.alterTable(table, t => t.string('replaces_intent_id', 36).nullable());
     if (!await db.schema.hasColumn(table, 'supplier_source_id')) await db.schema.alterTable(table, t => t.string('supplier_source_id', 36).nullable());
     if (!await indexExists('idx_pharm_acc_doc_supplier_source')) await db.schema.alterTable(table, t => t.index(['branchid', 'supplier_source_id', 'status'], 'idx_pharm_acc_doc_supplier_source'));
     if (!await indexExists('uq_pharm_acc_replacement')) await db.schema.alterTable(table, t => t.unique(['replaces_intent_id'], 'uq_pharm_acc_replacement'));
     // SQLite table_info (used by Knex hasColumn) intentionally omits generated columns.
     const hasIdentity = client.includes('sqlite')
          ? String((await db('sqlite_master').where({ type: 'table', name: table }).first('sql'))?.sql || '').includes('active_reversal_of')
          : await db.schema.hasColumn(table, 'active_reversal_of');
     if (!hasIdentity) await db.schema.alterTable(table, t => {
          t.specificType('active_reversal_of', REVERSAL_IDENTITY_SQL);
     });
     if (!await indexExists('uq_pharm_acc_active_reversal')) await db.schema.alterTable(table, t => t.unique(['active_reversal_of'], 'uq_pharm_acc_active_reversal'));
     const legacy = 'pharmacy_accounting_documents_reversal_of_unique';
     if (await indexExists(legacy)) await db.schema.alterTable(table, t => t.dropUnique(['reversal_of'], legacy));
     if (!await indexExists('idx_pharm_acc_reversal_history')) await db.schema.alterTable(table, t => t.index(['reversal_of'], 'idx_pharm_acc_reversal_history'));
}
