import { createHash } from 'node:crypto';
import type { Knex } from 'knex';
import { columnDefinition, quoteIdentifier } from './LegacySchema';
import { TENANT_COLLATION, caseSensitiveCollation } from './SchemaCollationPolicy';

/** Lightweight startup guard for future DDL. Existing data conversions use the reviewed maintenance tool. */
export async function ensureTenantCollationDefault(db: Knex): Promise<void> {
    if (!String(db.client.config.client).includes('mysql')) return;
    const [rows] = await db.raw('SELECT DATABASE() AS database_name');
    const database = rows[0].database_name;
    const schema = await db('information_schema.SCHEMATA').where('SCHEMA_NAME', database).first();
    if (schema.DEFAULT_CHARACTER_SET_NAME !== 'utf8mb4' || schema.DEFAULT_COLLATION_NAME !== TENANT_COLLATION) {
        await db.raw(`ALTER DATABASE ?? CHARACTER SET utf8mb4 COLLATE ${TENANT_COLLATION}`, [database]);
    }
}

/** Validate uniqueness and referential membership under the intended collation before rebuilding. */
export async function normalizeTenantCollation(db: Knex): Promise<{ changedTables: string[]; preservedCaseSensitiveColumns: number; existingOrphanConstraints: string[] }> {
    const [{ database }] = await db.raw('SELECT DATABASE() AS ??', ['database']).then(([rows]) => rows);
    const columns: any[] = await db('information_schema.COLUMNS').where('TABLE_SCHEMA', database);
    const tables: any[] = await db('information_schema.TABLES').where({ TABLE_SCHEMA: database, TABLE_TYPE: 'BASE TABLE' });
    const columnMap = new Map(columns.map(column => [`${column.TABLE_NAME}.${column.COLUMN_NAME}`, column]));
    const sensitive = columns.filter(column => column.COLLATION_NAME && caseSensitiveCollation(column.COLLATION_NAME));
    const changed = tables.filter(table => table.TABLE_COLLATION !== TENANT_COLLATION || columns.some(column => column.TABLE_NAME === table.TABLE_NAME && column.COLLATION_NAME && !caseSensitiveCollation(column.COLLATION_NAME) && column.COLLATION_NAME !== TENANT_COLLATION));
    if (!changed.length) {
        await ensureTenantCollationDefault(db);
        return { changedTables: [], preservedCaseSensitiveColumns: sensitive.length, existingOrphanConstraints: [] };
    }
    const convertedExpression = (table: string, column: string, alias?: string, prefix?: number) => {
        const value = `${alias ? `${alias}.` : ''}${quoteIdentifier(column)}`;
        const metadata = columnMap.get(`${table}.${column}`);
        const expression = metadata?.COLLATION_NAME && !caseSensitiveCollation(metadata.COLLATION_NAME)
            ? `CONVERT(${value} USING utf8mb4) COLLATE ${TENANT_COLLATION}` : value;
        return prefix ? `LEFT(${expression}, ${Number(prefix)})` : expression;
    };
    const indexes: any[] = await db('information_schema.STATISTICS').where({ TABLE_SCHEMA: database, NON_UNIQUE: 0 }).orderBy(['TABLE_NAME', 'INDEX_NAME', 'SEQ_IN_INDEX']);
    const grouped = new Map<string, any[]>();
    for (const index of indexes) { const key = `${index.TABLE_NAME}.${index.INDEX_NAME}`; grouped.set(key, [...(grouped.get(key) || []), index]); }
    for (const [key, parts] of grouped) {
        if (!changed.some(table => table.TABLE_NAME === parts[0].TABLE_NAME)) continue;
        if (parts.some(part => !part.COLUMN_NAME)) throw new Error(`Functional unique index ${key} requires explicit collation review`);
        const expressions = parts.map(part => convertedExpression(part.TABLE_NAME, part.COLUMN_NAME, undefined, part.SUB_PART));
        const where = parts.map(part => `${quoteIdentifier(part.COLUMN_NAME)} IS NOT NULL`).join(' AND ');
        const [duplicates] = await db.raw(`SELECT 1 FROM ?? WHERE ${where} GROUP BY ${expressions.join(', ')} HAVING COUNT(*) > 1 LIMIT 1`, [parts[0].TABLE_NAME]);
        if (duplicates.length) throw new Error(`Collation conversion blocked by duplicate keys in ${key}`);
    }
    const foreignKeys: any[] = await db('information_schema.KEY_COLUMN_USAGE').where({ TABLE_SCHEMA: database }).whereNotNull('REFERENCED_TABLE_NAME').orderBy(['TABLE_NAME', 'CONSTRAINT_NAME', 'ORDINAL_POSITION']);
    const relations = new Map<string, any[]>();
    for (const foreign of foreignKeys) { const key = `${foreign.TABLE_NAME}.${foreign.CONSTRAINT_NAME}`; relations.set(key, [...(relations.get(key) || []), foreign]); }
    const orphanFingerprints = async (converted: boolean) => {
        const fingerprints = new Map<string, string>();
        const orphaned: string[] = [];
        for (const [key, parts] of relations) {
            if (parts.some(part => part.REFERENCED_TABLE_SCHEMA !== database)) throw new Error(`Cross-database foreign key ${key} requires coordinated conversion`);
            const field = (part: any, parent: boolean) => converted
                ? convertedExpression(parent ? part.REFERENCED_TABLE_NAME : part.TABLE_NAME, parent ? part.REFERENCED_COLUMN_NAME : part.COLUMN_NAME, parent ? 'p' : 'c')
                : `${parent ? 'p' : 'c'}.${quoteIdentifier(parent ? part.REFERENCED_COLUMN_NAME : part.COLUMN_NAME)}`;
            const condition = parts.map(part => `${field(part, false)} = ${field(part, true)}`).join(' AND ');
            const populated = parts.map(part => `c.${quoteIdentifier(part.COLUMN_NAME)} IS NOT NULL`).join(' AND ');
            const values = parts.map(part => `CAST(c.${quoteIdentifier(part.COLUMN_NAME)} AS CHAR)`);
            const [rows] = await db.raw(`SELECT JSON_ARRAY(${values.join(', ')}) AS orphan_key FROM ?? c WHERE ${populated} AND NOT EXISTS (SELECT 1 FROM ?? p WHERE ${condition})`, [parts[0].TABLE_NAME, parts[0].REFERENCED_TABLE_NAME]);
            const keys = rows.map((row: any) => typeof row.orphan_key === 'string' ? row.orphan_key : JSON.stringify(row.orphan_key)).sort();
            fingerprints.set(key, createHash('sha256').update(JSON.stringify(keys)).digest('hex'));
            if (keys.length) orphaned.push(key);
        }
        return { fingerprints, orphaned };
    };
    const originalOrphans = await orphanFingerprints(false);
    const intendedOrphans = await orphanFingerprints(true);
    for (const [key, fingerprint] of intendedOrphans.fingerprints) {
        if (originalOrphans.fingerprints.get(key) !== fingerprint) throw new Error(`Collation conversion changes foreign-key membership in ${key}; reviewed data repair is required`);
    }
    const session = await db.client.acquireConnection();
    try {
        const [rows] = await db.raw('SELECT @@SESSION.foreign_key_checks AS fk, @@SESSION.sql_mode AS mode').connection(session);
        const previous = rows[0];
        try {
            await db.raw("SET SESSION sql_mode = REPLACE(REPLACE(@@SESSION.sql_mode, 'NO_ZERO_DATE', ''), 'NO_ZERO_IN_DATE', '')").connection(session);
            await db.raw('SET SESSION foreign_key_checks = 0').connection(session);
            await db.raw(`ALTER DATABASE ?? CHARACTER SET utf8mb4 COLLATE ${TENANT_COLLATION}`, [database]).connection(session);
            for (const table of changed) {
                const retained = sensitive.filter(column => column.TABLE_NAME === table.TABLE_NAME);
                const [definition] = await db.raw('SHOW CREATE TABLE ??', [table.TABLE_NAME]).connection(session);
                const modifiers = retained.map(column => `MODIFY COLUMN ${columnDefinition(definition[0]['Create Table'], column.COLUMN_NAME)}`);
                await db.raw(`ALTER TABLE ?? CONVERT TO CHARACTER SET utf8mb4 COLLATE ${TENANT_COLLATION}`, [table.TABLE_NAME]).connection(session);
                // MySQL applies CONVERT after combined MODIFY clauses. Restore exact-match definitions separately.
                if (modifiers.length) await db.raw(`ALTER TABLE ?? ${modifiers.join(', ')}`, [table.TABLE_NAME]).connection(session);
            }
        } finally {
            await db.raw('SET SESSION foreign_key_checks = ?', [previous.fk]).connection(session);
            await db.raw('SET SESSION sql_mode = ?', [previous.mode]).connection(session);
        }
    } finally { await db.client.releaseConnection(session); }
    const currentColumns: any[] = await db('information_schema.COLUMNS').where('TABLE_SCHEMA', database);
    for (const column of sensitive) {
        const current = currentColumns.find(value => value.TABLE_NAME === column.TABLE_NAME && value.COLUMN_NAME === column.COLUMN_NAME);
        if (!current || current.COLLATION_NAME !== column.COLLATION_NAME || current.COLUMN_TYPE !== column.COLUMN_TYPE) throw new Error(`Exact-match column definition changed for ${column.TABLE_NAME}.${column.COLUMN_NAME}`);
    }
    const after = await orphanFingerprints(false);
    for (const [key, fingerprint] of after.fingerprints) {
        if (originalOrphans.fingerprints.get(key) !== fingerprint) throw new Error(`Foreign-key membership changed after conversion in ${key}`);
    }
    return { changedTables: changed.map(table => table.TABLE_NAME), preservedCaseSensitiveColumns: sensitive.length, existingOrphanConstraints: originalOrphans.orphaned };
}
