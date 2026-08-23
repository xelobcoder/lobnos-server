import KnexConnection from '../../database/KnexConnections';
import { ACCOUNT_CONFIG } from '../config/accountConfig';

export async function ensureAccountingSchema(tenantId: number): Promise<void> {
     const knex = await KnexConnection(tenantId);

     if (!(await knex.schema.hasTable('acc_accounts'))) {
          await knex.schema.createTable('acc_accounts', (table) => {
               table.increments('id').primary().unsigned();
               table.string('account_code', 20).notNullable().unique();
               table.string('name', 120).notNullable();
               table.enum('type', ['asset', 'liability', 'equity', 'revenue', 'expense']).notNullable();
               table.enum('normal_balance', ['debit', 'credit']).notNullable();
               table.integer('parent_account_id').unsigned().nullable();
               table.boolean('is_active').notNullable().defaultTo(true);
               table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
               table.datetime('updated_at').notNullable().defaultTo(knex.fn.now());
          });
     }

     if (!(await knex.schema.hasTable('acc_journal_entries'))) {
          await knex.schema.createTable('acc_journal_entries', (table) => {
               table.increments('id').primary().unsigned();
               table.enum('transaction_type', ['payment', 'refund', 'adjustment', 'accrual', 'reversal']).notNullable();
               table.enum('source_module', ['billing', 'expense', 'inventory', 'commission', 'supplier', 'payroll']).notNullable();
               table.string('source_table', 60).notNullable();
               table.integer('source_pk').unsigned().notNullable();
               table.string('description', 255).nullable();
               table.datetime('occurred_at').notNullable().defaultTo(knex.fn.now());
               table.enum('status', ['posted', 'voided', 'reversed']).notNullable().defaultTo('posted');
               table.integer('reversal_of_entry_id').unsigned().nullable();
               table.integer('created_by').unsigned().nullable();
               table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
               table.unique(['source_module', 'source_table', 'source_pk', 'transaction_type'], 'uq_acc_journal_source');
          });
     }

     if (!(await knex.schema.hasTable('acc_journal_lines'))) {
          await knex.schema.createTable('acc_journal_lines', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('journal_entry_id').unsigned().notNullable();
               table.integer('account_id').unsigned().notNullable();
               table.enum('direction', ['debit', 'credit']).notNullable();
               table.decimal('amount', 14, 2).notNullable();
               table.integer('branchid').unsigned().nullable();
               table.integer('billingid').unsigned().nullable();
               table.integer('expense_id').unsigned().nullable();
               table.integer('invoice_id').unsigned().nullable();
               table.integer('employeeid').unsigned().nullable();
               table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
               table.index('journal_entry_id', 'idx_acc_journal_lines_entry');
               table.index('account_id', 'idx_acc_journal_lines_account');
          });
     }

     // outbox: producer modules enqueue here inside their own DB transaction; posting to the
     // ledger itself happens out-of-band so a ledger failure never blocks/rolls back the producer
     if (!(await knex.schema.hasTable('acc_posting_outbox'))) {
          await knex.schema.createTable('acc_posting_outbox', (table) => {
               table.increments('id').primary().unsigned();
               table.string('source_module', 30).notNullable();
               table.string('source_table', 60).notNullable();
               table.integer('source_pk').unsigned().notNullable();
               table.string('transaction_type', 20).notNullable();
               table.text('payload').notNullable();
               table.enum('status', ['pending', 'posted', 'failed']).notNullable().defaultTo('pending');
               table.integer('attempts').unsigned().notNullable().defaultTo(0);
               table.text('last_error').nullable();
               table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
               table.datetime('processed_at').nullable();
               table.unique(['source_module', 'source_table', 'source_pk', 'transaction_type'], 'uq_acc_outbox_source');
               table.index('status', 'idx_acc_outbox_status');
          });
     }

     await ensureStringSourceRefSupport(tenantId);
     await ensurePeriodTable(tenantId);
     await ensureManualJournalTables(tenantId);
     await ensureSubledgerTable(tenantId);
     await seedAccountsFromConfig(tenantId);
}

async function ensureSubledgerTable(tenantId: number): Promise<void> {
     const knex = await KnexConnection(tenantId);

     if (await knex.schema.hasTable('acc_subledger_entries')) return;

     await knex.schema.createTable('acc_subledger_entries', (table) => {
          table.increments('id').primary().unsigned();
          table.enum('ledger', ['AR', 'AP']).notNullable();
          table.string('party_type', 30).notNullable();
          table.integer('party_id').unsigned().nullable();
          table.string('party_name', 160).nullable();
          table.string('document_type', 30).notNullable();
          table.string('document_ref', 60).notNullable();
          table.date('document_date').notNullable();
          table.date('due_date').nullable();
          table.decimal('amount', 14, 2).notNullable();
          table.decimal('gross_amount', 14, 2).notNullable().defaultTo(0);
          table.decimal('tax_amount', 14, 2).notNullable().defaultTo(0);
          table.string('source_module', 30).notNullable();
          table.string('source_table', 60).notNullable();
          table.string('source_ref', 80).notNullable();
          table.integer('branchid').unsigned().nullable();
          table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
          table.unique(['ledger', 'source_table', 'source_ref'], 'uq_acc_subledger_source');
          table.index(['ledger', 'party_type', 'party_id'], 'idx_acc_subledger_party');
          table.index(['ledger', 'document_date'], 'idx_acc_subledger_date');
     });
}

async function ensureManualJournalTables(tenantId: number): Promise<void> {
     const knex = await KnexConnection(tenantId);

     if (!(await knex.schema.hasTable('acc_manual_journals'))) {
          await knex.schema.createTable('acc_manual_journals', (table) => {
               table.increments('id').primary().unsigned();
               table.string('journal_no', 30).notNullable().unique();
               table.date('journal_date').notNullable();
               table.string('description', 255).notNullable();
               table.string('reference', 120).nullable();
               table.enum('status', ['draft', 'submitted', 'approved', 'posted', 'void']).notNullable().defaultTo('draft');
               table.integer('journal_entry_id').unsigned().nullable();
               table.integer('created_by').unsigned().nullable();
               table.integer('submitted_by').unsigned().nullable();
               table.integer('approved_by').unsigned().nullable();
               table.integer('posted_by').unsigned().nullable();
               table.datetime('submitted_at').nullable();
               table.datetime('approved_at').nullable();
               table.datetime('posted_at').nullable();
               table.text('notes').nullable();
               table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
               table.datetime('updated_at').notNullable().defaultTo(knex.fn.now());
          });
     }

     if (!(await knex.schema.hasTable('acc_manual_journal_lines'))) {
          await knex.schema.createTable('acc_manual_journal_lines', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('manual_journal_id').unsigned().notNullable();
               table.string('account_code', 20).notNullable();
               table.enum('direction', ['debit', 'credit']).notNullable();
               table.decimal('amount', 14, 2).notNullable();
               table.integer('branchid').unsigned().nullable();
               table.integer('employeeid').unsigned().nullable();
               table.string('line_description', 255).nullable();
               table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
               table.index('manual_journal_id', 'idx_acc_manual_journal_lines_parent');
          });
     }

     // the source_module enum predates manual journals
     try {
          await knex.raw(
               "ALTER TABLE acc_journal_entries MODIFY COLUMN source_module ENUM('billing','expense','inventory','commission','supplier','payroll','manual') NOT NULL"
          );
     } catch {
     }
}

async function ensurePeriodTable(tenantId: number): Promise<void> {
     const knex = await KnexConnection(tenantId);

     if (!(await knex.schema.hasTable('acc_periods'))) {
          await knex.schema.createTable('acc_periods', (table) => {
               table.increments('id').primary().unsigned();
               table.string('period_code', 7).notNullable().unique();
               table.date('period_start').notNullable();
               table.date('period_end').notNullable();
               table.enum('status', ['open', 'soft_closed', 'closed', 'locked']).notNullable().defaultTo('open');
               table.integer('closed_by').unsigned().nullable();
               table.datetime('closed_at').nullable();
               table.text('notes').nullable();
               table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
               table.datetime('updated_at').notNullable().defaultTo(knex.fn.now());
          });
     }
}

/**
 * Modules keyed by varchar ids (supplier payments, stock movements) cannot fit source_pk,
 * so the idempotency key is widened with a string discriminator that defaults to ''.
 */
async function ensureStringSourceRefSupport(tenantId: number): Promise<void> {
     const knex = await KnexConnection(tenantId);

     for (const tableName of ['acc_posting_outbox', 'acc_journal_entries']) {
          if (!(await knex.schema.hasColumn(tableName, 'source_ref'))) {
               await knex.schema.alterTable(tableName, (table) => {
                    table.string('source_ref', 80).notNullable().defaultTo('');
               });
          }
     }

     const statements = [
          'ALTER TABLE acc_posting_outbox DROP INDEX uq_acc_outbox_source',
          'CREATE UNIQUE INDEX uq_acc_outbox_source_ref ON acc_posting_outbox (source_module, source_table, source_pk, transaction_type, source_ref)',
          'ALTER TABLE acc_journal_entries DROP INDEX uq_acc_journal_source',
          'CREATE UNIQUE INDEX uq_acc_journal_source_ref ON acc_journal_entries (source_module, source_table, source_pk, transaction_type, source_ref)',
          "ALTER TABLE acc_posting_outbox MODIFY COLUMN status ENUM('pending','posted','failed','dead_letter') NOT NULL DEFAULT 'pending'",
     ];

     for (const statement of statements) {
          try {
               await knex.raw(statement);
          } catch {
          }
     }
}

async function seedAccountsFromConfig(tenantId: number): Promise<void> {
     const knex = await KnexConnection(tenantId);
     const existing = await knex('acc_accounts').select('account_code');
     const existingCodes = new Set(existing.map((row: any) => row.account_code));

     const rows = Object.entries(ACCOUNT_CONFIG)
          .filter(([accountCode]) => !existingCodes.has(accountCode))
          .map(([accountCode, config]) => ({
               account_code: accountCode,
               name: config.name,
               type: config.type,
               normal_balance: config.normalBalance,
               parent_account_id: null,
               is_active: true,
               created_at: new Date(),
               updated_at: new Date(),
          }));

     if (rows.length > 0) {
          await knex('acc_accounts').insert(rows);
     }
}
