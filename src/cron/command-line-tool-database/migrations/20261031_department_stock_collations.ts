import {Knex} from 'knex';
import {ensureDepartmentStockSchema} from '../../../models/inventory/DepartmentStock';
export async function up(db:Knex){await ensureDepartmentStockSchema(db);}
export async function down(_db:Knex){}
