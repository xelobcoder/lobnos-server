import type {Knex} from 'knex';
import {ensureSalaryTemplateSchema} from '../../../models/payroll/SalaryTemplateRepository';
export const up=(db:Knex)=>ensureSalaryTemplateSchema(db);
export async function down(_db:Knex){/* Retain compensation source snapshots and template audit. */}
