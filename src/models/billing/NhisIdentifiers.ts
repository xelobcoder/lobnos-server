import { z } from 'zod';
import type { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';

// These are identifiers, not amounts: keep their digits and leading zeroes intact.
export const nhisIdentifier = z.union([z.string(), z.number().int().positive().refine(Number.isSafeInteger)])
    .transform(value => String(value).trim())
    .refine(value => /^\d{1,64}$/.test(value) && /[1-9]/.test(value), 'Enter an identifier containing 1–64 digits');
export const nhisIdentifiers = z.object({ nhismembershipid: nhisIdentifier, claimscheckcode: nhisIdentifier });

const ready = new WeakMap<object, Promise<void>>();
export async function ensureNhisIdentifierSchema(db: Knex) {
    if (!await db.schema.hasTable('dboservices')) return;
    const columns = await db('dboservices').columnInfo();
    for (const name of ['nhismembershipid', 'claimscheckcode']) {
        const info = columns[name];
        if (!info) {
            await db.schema.alterTable('dboservices', table => table.string(name, 64).nullable());
        } else if (!(['varchar', 'char'].includes(info.type) && Number(info.maxLength) >= 64) && !['text', 'longtext', 'mediumtext'].includes(info.type)) {
            await db.schema.alterTable('dboservices', table => {
                const field = table.string(name, 64);
                if (info.nullable) field.nullable(); else field.notNullable();
                if (info.defaultValue != null) field.defaultTo(info.defaultValue);
                field.alter();
            });
        }
    }
}
export async function prepareNhisIdentifierStorage(db: Knex) {
    let task = ready.get(db);
    if (!task) { task = ensureNhisIdentifierSchema(db).catch(error => { ready.delete(db); throw error; }); ready.set(db, task); }
    await task;
}
export async function bootstrapNhisIdentifiers(tenantId: number) { await prepareNhisIdentifierStorage(await KnexConnection(tenantId)); }
