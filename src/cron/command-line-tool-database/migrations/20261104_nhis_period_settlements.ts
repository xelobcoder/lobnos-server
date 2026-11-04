import type { Knex } from 'knex';
import { ensureNhisAccountingSchema } from '../../../accountingModule/init/nhisAccountingSchema';

export async function up(db: Knex) { await ensureNhisAccountingSchema(db); }
export async function down() { throw new Error('NHIS period settlement audit history is immutable; use a forward migration.'); }
