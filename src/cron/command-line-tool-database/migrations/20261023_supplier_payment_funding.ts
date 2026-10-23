import { Knex } from 'knex';
import { ensureSupplierPaymentFundingColumns } from '../../../models/inventory/SupplierPaymentFunding';

export async function up(connection: Knex): Promise<void> { await ensureSupplierPaymentFundingColumns(connection); }
export async function down(connection: Knex): Promise<void> {
     if (!(await connection.schema.hasTable('inv_supplier_payments'))) return;
     for (const column of ['payment_account_id', 'payment_account_gl_code', 'branchid']) {
          if (await connection.schema.hasColumn('inv_supplier_payments', column)) {
               await connection.schema.alterTable('inv_supplier_payments', table => table.dropColumn(column));
          }
     }
}
