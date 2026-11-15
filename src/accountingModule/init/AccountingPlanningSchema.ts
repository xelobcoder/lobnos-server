import type { Knex } from 'knex';

const OCCURRENCES = 'acc_recurring_expense_occurrences';
const OCCURRENCE_KEYS = [
     { name: 'uq_recurring_profile_date', columns: ['profile_id', 'occurrence_date'] },
     { name: 'uq_recurring_expense', columns: ['expense_id'] },
];

// MySQL can commit CREATE TABLE before a separate Knex index statement fails.
async function repairOccurrenceKeys(db: Knex): Promise<void> {
     const [indexes] = await db.raw('SHOW INDEX FROM ??', [OCCURRENCES]);
     const uniqueKeys = new Map<string, string[]>();
     for (const index of indexes) {
          if (Number(index.Non_unique) !== 0) continue;
          const columns = uniqueKeys.get(index.Key_name) ?? [];
          columns[Number(index.Seq_in_index) - 1] = index.Column_name;
          uniqueKeys.set(index.Key_name, columns);
     }
     for (const key of OCCURRENCE_KEYS) {
          const exists = [...uniqueKeys.values()].some(columns =>
               columns.length === key.columns.length && key.columns.every((column, i) => columns[i] === column),
          );
          if (exists) continue;
          try {
               await db.schema.alterTable(OCCURRENCES, table => table.unique(key.columns, key.name));
          } catch (error) {
               // Bootstrap in another process may have installed the same key.
               if ((error as { code?: string }).code !== 'ER_DUP_KEYNAME' || uniqueKeys.has(key.name)) throw error;
               const [current] = await db.raw('SHOW INDEX FROM ?? WHERE Key_name = ?', [OCCURRENCES, key.name]);
               if (current.length !== key.columns.length || !current.every((index: any) =>
                    Number(index.Non_unique) === 0 && key.columns[Number(index.Seq_in_index) - 1] === index.Column_name,
               )) throw error;
          }
     }
}

export async function ensureAccountingPlanningSchema(db: Knex): Promise<void> {
 if (!(await db.schema.hasTable('acc_budgets'))) await db.schema.createTable('acc_budgets', table => {
  table.increments('id').primary(); table.string('name',120).notNullable(); table.integer('year').notNullable(); table.integer('branchid').unsigned().notNullable();
  table.string('status',16).notNullable().defaultTo('active'); table.integer('version').notNullable().defaultTo(1); table.integer('created_by').unsigned().notNullable();table.integer('updated_by').unsigned().notNullable();table.datetime('created_at').notNullable().defaultTo(db.fn.now());table.datetime('updated_at').notNullable().defaultTo(db.fn.now());table.index(['branchid','year']);
 });
 if (!(await db.schema.hasTable('acc_budget_lines'))) await db.schema.createTable('acc_budget_lines', table => {
  table.increments('id').primary();table.integer('budget_id').unsigned().notNullable();table.string('account_code',20).notNullable();table.integer('month').notNullable();table.decimal('amount',14,2).notNullable();table.unique(['budget_id','account_code','month']);
 });
 if (!(await db.schema.hasTable('acc_recurring_expenses'))) await db.schema.createTable('acc_recurring_expenses', table => {
  table.increments('id').primary();table.string('name',120).notNullable();table.text('description').nullable();table.integer('branchid').unsigned().notNullable();table.integer('merchant_id').unsigned().notNullable();table.integer('category_id').unsigned().notNullable();table.decimal('amount',14,2).notNullable();table.string('frequency',16).notNullable();table.integer('interval_count').notNullable().defaultTo(1);table.date('start_date').notNullable();table.date('end_date').nullable();table.date('next_run_date').nullable();table.string('status',16).notNullable().defaultTo('active');table.integer('version').notNullable().defaultTo(1);table.integer('created_by').unsigned().notNullable();table.integer('updated_by').unsigned().notNullable();table.text('last_error').nullable();table.datetime('created_at').notNullable().defaultTo(db.fn.now());table.datetime('updated_at').notNullable().defaultTo(db.fn.now());table.index(['status','next_run_date']);table.index('branchid');
 });
 if (!(await db.schema.hasTable(OCCURRENCES))) {
     await db.schema.createTable(OCCURRENCES, table => {
          table.increments('id').primary();
          table.integer('profile_id').unsigned().notNullable();
          table.date('occurrence_date').notNullable();
          table.integer('expense_id').unsigned().notNullable();
          table.datetime('created_at').notNullable().defaultTo(db.fn.now());
          for (const key of OCCURRENCE_KEYS) table.unique(key.columns, key.name);
     });
 } else if (['mysql', 'mysql2'].includes(db.client.config.client)) {
     await repairOccurrenceKeys(db);
 }
}
