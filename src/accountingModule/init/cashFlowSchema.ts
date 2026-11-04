import { Knex } from 'knex';

export async function ensureCashFlowReviewSchema(db: Knex | Knex.Transaction, pharmacy = false): Promise<void> {
     const table = pharmacy ? 'pharmacy_cash_flow_classifications' : 'acc_cash_flow_classifications';
     if (!await db.schema.hasTable(table)) {
          await db.schema.createTable(table, t => {
               if (pharmacy) { t.string('journal_id', 64).primary(); t.integer('branchid').unsigned().notNullable(); }
               else t.integer('journal_entry_id').unsigned().primary();
               t.decimal('operating', 14, 2).notNullable();
               t.decimal('investing', 14, 2).notNullable();
               t.decimal('financing', 14, 2).notNullable();
               t.json('gross_allocations').nullable();
               t.integer('updated_by').unsigned().notNullable();
               t.datetime('updated_at').notNullable();
          });
     } else if (!await db.schema.hasColumn(table, 'gross_allocations')) {
          await db.schema.alterTable(table, t => { t.json('gross_allocations').nullable(); });
     }
}
