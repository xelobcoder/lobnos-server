import {Knex} from 'knex';
import {ensureDepartmentStockSchema} from '../../../models/inventory/DepartmentStock';
export async function up(db:Knex){
 await ensureDepartmentStockSchema(db);
 if(await db.schema.hasTable('payroll_periods'))for(const column of ['payment_account_id','payment_account_gl_code']){
  if(!await db.schema.hasColumn('payroll_periods',column))await db.schema.alterTable('payroll_periods',t=>{if(column==='payment_account_id')t.integer(column).unsigned().nullable();else t.string(column,20).nullable();});
 }
}
// Retain financial/custody audit records on rollback.
export async function down(_db:Knex){}
