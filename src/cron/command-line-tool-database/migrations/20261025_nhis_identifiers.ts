import type { Knex } from 'knex';
import { ensureNhisIdentifierSchema } from '../../../models/billing/NhisIdentifiers';
export async function up(db: Knex) { await ensureNhisIdentifierSchema(db); }
export async function down() { throw Error('NHIS identifiers must not be narrowed back to integers; use a forward migration.'); }
