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

     await seedAccountsFromConfig(tenantId);
}

// ACCOUNT_CONFIG is the pre-database seed source; acc_accounts is authoritative once seeded
async function seedAccountsFromConfig(tenantId: number): Promise<void> {
     const knex = await KnexConnection(tenantId);
     const existingCount = await knex('acc_accounts').count<{ count: number }>('* as count').first();

     if (existingCount && Number(existingCount.count) > 0) {
          return;
     }

     const rows = Object.entries(ACCOUNT_CONFIG).map(([accountCode, config]) => ({
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
