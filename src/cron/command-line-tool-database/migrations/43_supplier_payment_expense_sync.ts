import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // Add expense_synced column to supplier payments table
     await knex.schema.alterTable('inv_supplier_payments', (table) => {
          table.boolean('expense_synced').defaultTo(false);
          table.string('expense_id').nullable();
          table.string('expense_invoice_id').nullable();
     });
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.alterTable('inv_supplier_payments', (table) => {
          table.dropColumn('expense_synced');
          table.dropColumn('expense_id');
          table.dropColumn('expense_invoice_id');
     });
}