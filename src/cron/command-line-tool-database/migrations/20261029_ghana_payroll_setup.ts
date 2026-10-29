import type {Knex} from 'knex';
import {ensureGhanaPayrollSchema} from '../../../models/payroll/GhanaPayrollSchema';
export const up=(db:Knex)=>ensureGhanaPayrollSchema(db);
export async function down(_db:Knex){/* Preserve payroll setup audit and employee profiles. */}
