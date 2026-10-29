import type { Knex } from 'knex';
import { ensureArkeselSchema } from '../../../models/application/sms/ArkeselSchema';
export const up = (db: Knex) => ensureArkeselSchema(db);
export async function down(_db: Knex) { /* Retain provider evidence and queue environment. */ }
