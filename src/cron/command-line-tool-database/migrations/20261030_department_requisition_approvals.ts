import {Knex} from 'knex';
import {ensureDepartmentStockSchema} from '../../../models/inventory/DepartmentStock';
export async function up(db:Knex){await ensureDepartmentStockSchema(db);
 for(const table of ['roles','staff_role_access'])if(await db.schema.hasTable(table)){
  const [columns]=await db.raw('SHOW COLUMNS FROM ?? LIKE ?',[table,'role']);const column=columns[0];
  if(column&&String(column.Type).startsWith('enum(')){
   const values=Array.from(String(column.Type).matchAll(/'([^']+)'/g)).map(match=>match[1]);
   const next=[...new Set([...values,'head_of_laboratory','head_of_imaging'])];
   if(next.length!==values.length)await db.schema.alterTable(table,t=>{let role=t.enum('role',next);if(column.Null==='YES')role=role.nullable();else role=role.notNullable();if(column.Default!=null)role.defaultTo(column.Default);role.alter();});
  }
 }}
export async function down(_db:Knex){}
