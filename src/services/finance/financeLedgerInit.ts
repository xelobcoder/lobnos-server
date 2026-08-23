import KnexConnection from '../../database/KnexConnections';

export async function ensureFinanceLedgerTables(tenantId: number): Promise<void> {
     const knex = await KnexConnection(tenantId);

     if (!(await knex.schema.hasTable('finance_ledger'))) {
          await knex.schema.createTable('finance_ledger', (table) => {
               table.increments('id').primary().unsigned();
               table.datetime('occurred_at').notNullable().defaultTo(knex.fn.now());
               table.enum('direction', ['credit', 'debit']).notNullable();
               table.decimal('amount', 12, 2).notNullable();
               table.string('account_ref', 50).nullable();
               table.string('source_module', 30).notNullable();
               table.string('source_table', 60).notNullable();
               table.integer('source_pk').unsigned().notNullable();
               table.integer('billingid').unsigned().nullable();
               table.integer('expense_id').unsigned().nullable();
               table.integer('invoice_id').unsigned().nullable();
               table.integer('employeeid').unsigned().nullable();
               table.integer('branchid').unsigned().nullable();
               table.enum('status', ['posted', 'voided']).notNullable().defaultTo('posted');
               table.integer('reversal_of_ledger_id').unsigned().nullable();
               table.datetime('reversed_at').nullable();
               table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
          });
     }

     const columnsToEnsure: Array<{ name: string; add: (table: any) => void }> = [
          { name: 'occurred_at', add: (table) => table.datetime('occurred_at').notNullable().defaultTo(knex.fn.now()) },
          { name: 'direction', add: (table) => table.enum('direction', ['credit', 'debit']).notNullable().defaultTo('credit') },
          { name: 'amount', add: (table) => table.decimal('amount', 12, 2).notNullable().defaultTo(0) },
          { name: 'account_ref', add: (table) => table.string('account_ref', 50).nullable() },
          { name: 'source_module', add: (table) => table.string('source_module', 30).notNullable().defaultTo('unknown') },
          { name: 'source_table', add: (table) => table.string('source_table', 60).notNullable().defaultTo('unknown') },
          { name: 'source_pk', add: (table) => table.integer('source_pk').unsigned().notNullable().defaultTo(0) },
          { name: 'source_ref', add: (table) => table.string('source_ref', 80).notNullable().defaultTo('') },
          { name: 'billingid', add: (table) => table.integer('billingid').unsigned().nullable() },
          { name: 'expense_id', add: (table) => table.integer('expense_id').unsigned().nullable() },
          { name: 'invoice_id', add: (table) => table.integer('invoice_id').unsigned().nullable() },
          { name: 'employeeid', add: (table) => table.integer('employeeid').unsigned().nullable() },
          { name: 'branchid', add: (table) => table.integer('branchid').unsigned().nullable() },
          { name: 'status', add: (table) => table.enum('status', ['posted', 'voided']).notNullable().defaultTo('posted') },
          { name: 'reversal_of_ledger_id', add: (table) => table.integer('reversal_of_ledger_id').unsigned().nullable() },
          { name: 'reversed_at', add: (table) => table.datetime('reversed_at').nullable() },
          { name: 'created_at', add: (table) => table.datetime('created_at').notNullable().defaultTo(knex.fn.now()) },
     ];

     for (const column of columnsToEnsure) {
          if (!(await knex.schema.hasColumn('finance_ledger', column.name))) {
               await knex.schema.alterTable('finance_ledger', (table) => {
                    column.add(table);
               });
          }
     }

     const indexStatements = [
          'CREATE INDEX idx_fin_ledger_occurred_at ON finance_ledger (occurred_at)',
          'CREATE INDEX idx_fin_ledger_direction_date ON finance_ledger (direction, occurred_at)',
          'CREATE INDEX idx_fin_ledger_billingid ON finance_ledger (billingid)',
          'CREATE INDEX idx_fin_ledger_expense_id ON finance_ledger (expense_id)',
          'CREATE INDEX idx_fin_ledger_invoice_id ON finance_ledger (invoice_id)',
          'CREATE INDEX idx_fin_ledger_branchid ON finance_ledger (branchid)',
          'ALTER TABLE finance_ledger DROP INDEX uq_fin_ledger_source_direction',
          'CREATE UNIQUE INDEX uq_fin_ledger_source_dir_ref ON finance_ledger (source_module, source_table, source_pk, direction, source_ref)',
     ];

     for (const statement of indexStatements) {
          try {
               await knex.raw(statement);
          } catch {
          }
     }
}

