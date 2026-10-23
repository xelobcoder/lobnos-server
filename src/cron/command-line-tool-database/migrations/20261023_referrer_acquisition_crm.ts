import type { Knex } from 'knex';
import { ensureCrmSchema } from '../../../models/crm/CrmBootstrapper';
export async function up(db: Knex) { await ensureCrmSchema(db); }
export async function down() { /* Preserve acquisition history and approved agreements. */ }
