import KnexConnection from '../../database/KnexConnections';
import { ACCOUNT_CONFIG } from '../config/accountConfig';
import { ensureIndexes } from '../../database/ensureIndexes';

export async function ensureAccountingSchema(tenantId: number): Promise<void> {
     if (ensuredAccountingTenants.has(tenantId)) return;

     const pendingEnsure = pendingAccountingEnsures.get(tenantId);
     if (pendingEnsure) return pendingEnsure;

     const ensurePromise = ensureAccountingSchemaForTenant(tenantId)
          .then(() => {
               ensuredAccountingTenants.add(tenantId);
          })
          .finally(() => {
               pendingAccountingEnsures.delete(tenantId);
          });

     pendingAccountingEnsures.set(tenantId, ensurePromise);
     return ensurePromise;
}

const ensuredAccountingTenants = new Set<number>();
const pendingAccountingEnsures = new Map<number, Promise<void>>();

async function ensureAccountingSchemaForTenant(tenantId: number): Promise<void> {
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
     await ensureFinancialFinalizationTables(tenantId);
     await ensureFinancialFinalizationTriggers(tenantId);
     await seedAccountsFromConfig(tenantId);
}

async function ensureFinancialFinalizationTables(tenantId: number): Promise<void> {
     const knex = await KnexConnection(tenantId);

     if (!(await knex.schema.hasTable('financial_day_closures'))) {
          await knex.schema.createTable('financial_day_closures', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('branchid').unsigned().notNullable();
               table.date('financial_date').notNullable();
               table.string('timezone', 64).notNullable();
               table.enum('status', ['draft', 'accountant_submitted', 'returned_to_accountant', 'manager_approved', 'finalized']).notNullable().defaultTo('draft');
               table.integer('workflow_version').unsigned().notNullable().defaultTo(0);
               table.integer('accountant_employeeid').unsigned().nullable();
               table.integer('manager_employeeid').unsigned().nullable();
               table.integer('owner_employeeid').unsigned().nullable();
               table.datetime('accountant_submitted_at', { precision: 6 }).nullable();
               table.datetime('manager_decided_at', { precision: 6 }).nullable();
               table.datetime('finalized_at', { precision: 6 }).nullable();
               table.datetime('locked_at', { precision: 6 }).nullable();
               table.text('return_reason').nullable();
               table.string('latest_snapshot_hash', 64).nullable();
               table.string('finalized_hash', 64).nullable();
               table.integer('created_by').unsigned().notNullable();
               table.integer('updated_by').unsigned().nullable();
               table.datetime('created_at', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.datetime('updated_at', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.unique(['branchid', 'financial_date'], 'uq_financial_day');
               table.index(['status', 'financial_date'], 'idx_financial_day_status');
               table.index(['financial_date', 'branchid'], 'idx_financial_day_date');
          });
     }

     if (!(await knex.schema.hasTable('financial_day_close_actions'))) {
          await knex.schema.createTable('financial_day_close_actions', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('closure_id').unsigned().notNullable();
               table.string('action', 40).notNullable();
               table.string('from_status', 32).nullable();
               table.string('to_status', 32).nullable();
               table.integer('actor_employeeid').unsigned().notNullable();
               table.string('actor_role', 50).notNullable();
               table.integer('actor_branchid').unsigned().nullable();
               table.string('permission', 60).notNullable();
               table.enum('authority_source', ['role', 'delegation', 'denied']).notNullable();
               table.integer('authority_delegation_id').unsigned().nullable();
               table.enum('result', ['succeeded', 'denied', 'failed']).notNullable();
               table.text('reason').nullable();
               table.string('snapshot_hash', 64).nullable();
               table.integer('workflow_version').unsigned().notNullable();
               table.text('metadata_json').nullable();
               table.datetime('action_at', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.index(['closure_id', 'action_at'], 'idx_close_actions');
               table.index(['actor_employeeid', 'action_at'], 'idx_close_actor');
          });
     }

     if (!(await knex.schema.hasTable('financial_day_close_snapshots'))) {
          await knex.schema.createTable('financial_day_close_snapshots', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('closure_id').unsigned().notNullable();
               table.string('stage', 32).notNullable();
               table.integer('workflow_version').unsigned().notNullable();
               table.text('totals_json', 'longtext').notNullable();
               table.text('discrepancies_json', 'longtext').notNullable();
               table.text('record_counts_json', 'longtext').notNullable();
               table.integer('outbox_pending').unsigned().notNullable().defaultTo(0);
               table.integer('outbox_failed').unsigned().notNullable().defaultTo(0);
               table.decimal('ledger_debits', 14, 2).notNullable().defaultTo(0);
               table.decimal('ledger_credits', 14, 2).notNullable().defaultTo(0);
               table.string('snapshot_hash', 64).notNullable();
               table.integer('created_by').unsigned().notNullable();
               table.datetime('created_at', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.unique(['closure_id', 'workflow_version', 'stage'], 'uq_close_snapshot');
               table.index('snapshot_hash', 'idx_snapshot_hash');
          });
     }

     if (!(await knex.schema.hasTable('financial_record_locks'))) {
          await knex.schema.createTable('financial_record_locks', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('closure_id').unsigned().notNullable();
               table.integer('branchid').unsigned().notNullable();
               table.date('financial_date').notNullable();
               table.string('source_module', 30).notNullable();
               table.string('source_table', 64).notNullable();
               table.string('source_ref', 80).notNullable().defaultTo('');
               table.text('source_pk_json', 'longtext').notNullable();
               table.string('source_identity_hash', 64).notNullable();
               table.string('content_hash', 64).notNullable();
               table.datetime('locked_at', { precision: 6 }).notNullable();
               table.unique(['source_module', 'source_table', 'source_identity_hash'], 'uq_financial_source');
               table.index('closure_id', 'idx_record_locks_closure');
               table.index(['branchid', 'financial_date'], 'idx_record_locks_day');
          });
     }

     if (!(await knex.schema.hasTable('financial_correction_requests'))) {
          await knex.schema.createTable('financial_correction_requests', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('closure_id').unsigned().notNullable();
               table.integer('record_lock_id').unsigned().notNullable();
               table.integer('branchid').unsigned().notNullable();
               table.integer('requested_by').unsigned().notNullable();
               table.datetime('requested_at', { precision: 6 }).notNullable();
               table.text('reason').notNullable();
               table.text('proposed_correction_json', 'longtext').notNullable();
               table.text('evidence_json', 'longtext').nullable();
               table.enum('status', ['requested', 'approved', 'rejected', 'executed', 'cancelled']).notNullable().defaultTo('requested');
               table.integer('reviewed_by').unsigned().nullable();
               table.datetime('reviewed_at', { precision: 6 }).nullable();
               table.text('review_reason').nullable();
               table.integer('executed_by').unsigned().nullable();
               table.datetime('executed_at', { precision: 6 }).nullable();
               table.integer('reversal_entry_id').unsigned().nullable();
               table.string('replacement_module', 30).nullable();
               table.string('replacement_table', 64).nullable();
               table.string('replacement_ref', 80).nullable();
               table.string('idempotency_key', 100).notNullable().unique('uq_correction_idempotency');
               table.datetime('created_at', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.datetime('updated_at', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.index(['branchid', 'status', 'requested_at'], 'idx_correction_status');
               table.index('record_lock_id', 'idx_correction_record');
          });
     }

     if (!(await knex.schema.hasTable('financial_correction_actions'))) {
          await knex.schema.createTable('financial_correction_actions', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('correction_request_id').unsigned().notNullable();
               table.string('action', 40).notNullable();
               table.string('from_status', 24).nullable();
               table.string('to_status', 24).nullable();
               table.integer('actor_employeeid').unsigned().notNullable();
               table.string('actor_role', 50).notNullable();
               table.enum('authority_source', ['role', 'delegation', 'denied']).notNullable();
               table.integer('authority_delegation_id').unsigned().nullable();
               table.enum('result', ['succeeded', 'denied', 'failed']).notNullable();
               table.text('reason').nullable();
               table.integer('reversal_entry_id').unsigned().nullable();
               table.string('replacement_ref', 80).nullable();
               table.text('metadata_json', 'longtext').nullable();
               table.datetime('action_at', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.index(['correction_request_id', 'action_at'], 'idx_correction_actions');
          });
     }

     if (!(await knex.schema.hasTable('financial_authorization_attempts'))) {
          await knex.schema.createTable('financial_authorization_attempts', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('actor_employeeid').unsigned().notNullable();
               table.integer('branchid').unsigned().nullable();
               table.string('purpose', 60).notNullable();
               table.string('resource_type', 40).nullable();
               table.string('resource_id', 80).nullable();
               table.enum('result', ['success', 'failure', 'rate_limited', 'error']).notNullable();
               table.string('failure_category', 40).nullable();
               table.string('ip_address', 45).nullable();
               table.string('user_agent', 512).nullable();
               table.string('request_id', 64).nullable();
               table.datetime('attempted_at', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.index(['actor_employeeid', 'attempted_at'], 'idx_auth_actor');
               table.index(['ip_address', 'attempted_at'], 'idx_auth_ip');
               table.index(['resource_type', 'resource_id', 'attempted_at'], 'idx_auth_resource');
          });
     }

     if (!(await knex.schema.hasTable('receipt_print_events'))) {
          await knex.schema.createTable('receipt_print_events', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('receipt_id').unsigned().notNullable();
               table.integer('closure_id').unsigned().nullable();
               table.integer('actor_employeeid').unsigned().notNullable();
               table.enum('event_type', ['print', 'reprint']).notNullable();
               table.specificType('copies', 'SMALLINT UNSIGNED').notNullable().defaultTo(1);
               table.string('reason', 255).nullable();
               table.text('printer_metadata_json', 'longtext').nullable();
               table.datetime('printed_at', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.index(['receipt_id', 'printed_at'], 'idx_receipt_print');
               table.index('closure_id', 'idx_receipt_print_closure');
          });
     }
}

async function ensureFinancialFinalizationTriggers(tenantId: number): Promise<void> {
     const knex = await KnexConnection(tenantId);
     const protectedTables = [
          { table: 'billing', key: 'billingid', branch: 'NEW.branchid', date: 'DATE(NEW.billedon)' },
          { table: 'dboservices', key: 'serviceid', branch: 'NEW.branchid', date: 'DATE(NEW.serviceAddedOn)' },
          { table: 'billinghx', key: 'KeyID', branch: '(SELECT branchid FROM billing WHERE billingid = NEW.Billingid LIMIT 1)', date: 'DATE(NEW.Date)' },
          { table: 'expensesrecord', key: 'id', branch: 'NEW.branchid', date: 'DATE(NEW.date)' },
          { table: 'expense_payments', key: 'id', branch: 'NEW.branchid', date: 'DATE(NEW.payment_date)' },
          { table: 'finance_ledger', key: 'id', branch: 'NEW.branchid', date: 'DATE(NEW.occurred_at)' },
          { table: 'receipts', key: 'id', branch: '(SELECT branchid FROM billing WHERE billingid = NEW.billingid LIMIT 1)', date: 'DATE(NEW.generated_at)' },
          { table: 'dbobillingrefundtable', key: 'refundid', branch: '(SELECT branchid FROM dboservices WHERE serviceid = NEW.serviceid LIMIT 1)', date: 'DATE(NEW.approvalDate)' },
          { table: 'acc_journal_entries', key: 'id', branch: '(SELECT branchid FROM acc_journal_lines WHERE journal_entry_id = NEW.id AND branchid IS NOT NULL LIMIT 1)', date: 'DATE(NEW.occurred_at)' },
          { table: 'acc_journal_lines', key: 'id', branch: 'NEW.branchid', date: '(SELECT DATE(occurred_at) FROM acc_journal_entries WHERE id = NEW.journal_entry_id LIMIT 1)' },
          { table: 'acc_manual_journals', key: 'id', branch: '(SELECT branchid FROM acc_manual_journal_lines WHERE manual_journal_id = NEW.id AND branchid IS NOT NULL LIMIT 1)', date: 'NEW.journal_date' },
          { table: 'acc_manual_journal_lines', key: 'id', branch: 'NEW.branchid', date: '(SELECT journal_date FROM acc_manual_journals WHERE id = NEW.manual_journal_id LIMIT 1)' },
          { table: 'acc_subledger_entries', key: 'id', branch: 'NEW.branchid', date: 'NEW.document_date' },
     ];

     for (const definition of protectedTables) {
          if (!(await knex.schema.hasTable(definition.table))) continue;
          const prefix = `trg_fin_lock_${definition.table}`;
          await knex.raw(`DROP TRIGGER IF EXISTS ${prefix}_update`);
          await knex.raw(`DROP TRIGGER IF EXISTS ${prefix}_delete`);
          await knex.raw(`DROP TRIGGER IF EXISTS ${prefix}_insert`);
          await knex.raw(`CREATE TRIGGER ${prefix}_update BEFORE UPDATE ON ${definition.table} FOR EACH ROW BEGIN IF EXISTS (SELECT 1 FROM financial_record_locks WHERE source_table = '${definition.table}' AND source_ref = CAST(OLD.${definition.key} AS CHAR)) OR EXISTS (SELECT 1 FROM financial_day_closures WHERE branchid = ${definition.branch} AND financial_date = ${definition.date} AND status = 'finalized') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FINANCIAL_RECORD_FINALIZED'; END IF; END`);
          await knex.raw(`CREATE TRIGGER ${prefix}_delete BEFORE DELETE ON ${definition.table} FOR EACH ROW BEGIN IF EXISTS (SELECT 1 FROM financial_record_locks WHERE source_table = '${definition.table}' AND source_ref = CAST(OLD.${definition.key} AS CHAR)) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FINANCIAL_RECORD_FINALIZED'; END IF; END`);
          await knex.raw(`CREATE TRIGGER ${prefix}_insert BEFORE INSERT ON ${definition.table} FOR EACH ROW BEGIN IF EXISTS (SELECT 1 FROM financial_day_closures WHERE branchid = ${definition.branch} AND financial_date = ${definition.date} AND status = 'finalized') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FINANCIAL_DAY_FINALIZED'; END IF; END`);
     }

     const appendOnlyTables = [
          'financial_day_close_actions', 'financial_day_close_snapshots', 'financial_record_locks',
          'financial_correction_actions', 'financial_authorization_attempts', 'receipt_print_events',
     ];
     for (const tableName of appendOnlyTables) {
          const prefix = `trg_fin_append_${tableName}`;
          await knex.raw(`DROP TRIGGER IF EXISTS ${prefix}_update`);
          await knex.raw(`DROP TRIGGER IF EXISTS ${prefix}_delete`);
          await knex.raw(`CREATE TRIGGER ${prefix}_update BEFORE UPDATE ON ${tableName} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_AUDIT_RECORD'`);
          await knex.raw(`CREATE TRIGGER ${prefix}_delete BEFORE DELETE ON ${tableName} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'IMMUTABLE_AUDIT_RECORD'`);
     }

     await knex.raw('DROP TRIGGER IF EXISTS trg_fin_closure_finalized_update');
     await knex.raw('DROP TRIGGER IF EXISTS trg_fin_closure_delete');
     await knex.raw("CREATE TRIGGER trg_fin_closure_finalized_update BEFORE UPDATE ON financial_day_closures FOR EACH ROW BEGIN IF OLD.status = 'finalized' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FINANCIAL_DAY_FINALIZED'; END IF; END");
     await knex.raw("CREATE TRIGGER trg_fin_closure_delete BEFORE DELETE ON financial_day_closures FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'FINANCIAL_DAY_CLOSE_DELETE_FORBIDDEN'");
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

     await ensureIndexes(knex, 'acc_posting_outbox', [{
          name: 'uq_acc_outbox_source_ref', unique: true,
          columns: ['source_module', 'source_table', 'source_pk', 'transaction_type', 'source_ref'],
     }], ['uq_acc_outbox_source']);
     await ensureIndexes(knex, 'acc_journal_entries', [{
          name: 'uq_acc_journal_source_ref', unique: true,
          columns: ['source_module', 'source_table', 'source_pk', 'transaction_type', 'source_ref'],
     }], ['uq_acc_journal_source']);
     await knex.raw("ALTER TABLE acc_posting_outbox MODIFY COLUMN status ENUM('pending','posted','failed','dead_letter') NOT NULL DEFAULT 'pending'");
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
