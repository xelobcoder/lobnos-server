import { normalizeSchemaTextCollations } from './SchemaCollationPolicy';
import type { Knex } from 'knex';

export interface LegacySchemaColumn {
    table: string;
    name: string;
    type: string;
    nullable: string;
    defaultValue: unknown;
    extra: string;
}
export interface LegacyUpgradeStep { table: string; column?: string; sql: string; }
export interface LegacyUpgradePlan {
    database: string;
    reference: string;
    steps: LegacyUpgradeStep[];
    review: string[];
    existingTables: number;
}
export function quoteIdentifier(value: string): string {
    return '`' + value.replace(/`/g, '``') + '`';
}
export function columnDefinition(createSql: string, name: string): string {
    const prefix = quoteIdentifier(name) + ' ';
    const line = createSql.split('\n').map(part => part.trim()).find(part => part.toLowerCase().startsWith(prefix.toLowerCase()));
    if (!line) throw new Error(`Column definition missing for ${name}`);
    return line.replace(/,$/, '');
}
async function readColumns(db: Knex, database: string): Promise<LegacySchemaColumn[]> {
    return db('information_schema.COLUMNS').where('TABLE_SCHEMA', database).select({
        table: 'TABLE_NAME', name: 'COLUMN_NAME', type: 'COLUMN_TYPE', nullable: 'IS_NULLABLE',
        defaultValue: 'COLUMN_DEFAULT', extra: 'EXTRA',
    }).orderBy(['TABLE_NAME', 'ORDINAL_POSITION']);
}
/** Reference schemas supply structure only. Never copy reference accounts, settings or clinical rows. */
export async function assessLegacySchema(db: Knex, database: string, reference: string): Promise<LegacyUpgradePlan> {
    if (database.toLowerCase() === reference.toLowerCase()) throw new Error('Target and reference databases must differ');
    const target = await readColumns(db, database);
    const source = await readColumns(db, reference);
    if (!target.length || !source.length) throw new Error('Both target and reference must contain existing tables');
    const tables = new Set(target.map(column => column.table));
    const columns = new Map(target.map(column => [`${column.table}.${column.name}`.toLowerCase(), column]));
    const plan: LegacyUpgradePlan = { database, reference, existingTables: tables.size, steps: [], review: [] };
    const missingTables = new Map<string, { sql: string; dependencies: string[] }>();
    for (const table of new Set(source.map(column => column.table))) {
        const [rows] = await db.raw('SHOW CREATE TABLE ??.??', [reference, table]);
        const originalSql = rows[0]?.['Create Table'];
        const createSql = typeof originalSql === 'string' ? normalizeSchemaTextCollations(originalSql) : originalSql;
        if (typeof createSql !== 'string') { plan.review.push(`${table}: views require separate review`); continue; }
        if (!tables.has(table)) {
            const sql = createSql.replace(/^CREATE TABLE `(?:``|[^`])+`/, `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(database)}.${quoteIdentifier(table)}`)
                .replace(/ AUTO_INCREMENT=\d+/g, '');
            missingTables.set(table, { sql, dependencies: [...createSql.matchAll(/REFERENCES `([^`]+)`/g)].map(match => match[1]) });
            continue;
        }
        for (const column of source.filter(item => item.table === table)) {
            const old = columns.get(`${table}.${column.name}`.toLowerCase());
            if (old) {
                if (old.type !== column.type || old.nullable !== column.nullable || String(old.defaultValue) !== String(column.defaultValue)) {
                    plan.review.push(`${table}.${column.name}: existing ${old.type} ${old.nullable === 'YES' ? 'NULL' : 'NOT NULL'} differs from reference ${column.type} ${column.nullable === 'YES' ? 'NULL' : 'NOT NULL'} or its default; retained for reviewed migration`);
                }
                continue;
            }
            if (column.nullable === 'NO' && column.defaultValue == null && !column.extra.includes('auto_increment')) {
                const populated = await db(table).withSchema(database).first(db.raw('1 AS present'));
                if (populated) {
                    plan.review.push(`${table}.${column.name}: required column needs a reviewed backfill for existing rows`);
                    continue;
                }
            }
            if (column.extra.includes('auto_increment') || /(?:STORED|VIRTUAL) GENERATED/.test(column.extra)) {
                plan.review.push(`${table}.${column.name}: generated identity requires a reviewed migration`);
                continue;
            }
            plan.steps.push({ table, column: column.name, sql: `ALTER TABLE ${quoteIdentifier(database)}.${quoteIdentifier(table)} ADD COLUMN ${columnDefinition(createSql, column.name)}` });
        }
    }
    const creates: LegacyUpgradeStep[] = [];
    while (missingTables.size) {
        const ready = [...missingTables].filter(([table, value]) => value.dependencies.every(dependency => dependency === table || tables.has(dependency)));
        if (!ready.length) {
            for (const table of missingTables.keys()) plan.review.push(`${table}: unresolved foreign-key dependency; requires reviewed table creation`);
            break;
        }
        for (const [table, value] of ready) { creates.push({ table, sql: value.sql }); tables.add(table); missingTables.delete(table); }
    }
    // Existing tables receive prerequisite columns before new tables reference them.
    plan.steps.push(...creates);
    return plan;
}
export function renderLegacyUpgradeSql(plan: LegacyUpgradePlan): string {
    const literal = (value: string) => `CONVERT(0x${Buffer.from(value, 'utf8').toString('hex')} USING utf8mb4)`;
    const lines = [
        '-- Additive compatibility baseline. Review the JSON report and take a verified backup first.',
        '-- Existing column definitions, indexes, triggers and data are retained. Run application bootstrappers afterwards.',
        '-- MySQL DDL commits implicitly. Stop on the first error and regenerate the plan before retrying.',
        `USE ${quoteIdentifier(plan.database)};`,
        'SET @pls_previous_sql_mode = @@SESSION.sql_mode;',
        "SET SESSION sql_mode = REPLACE(REPLACE(@@SESSION.sql_mode, 'NO_ZERO_DATE', ''), 'NO_ZERO_IN_DATE', '');",
    ];
    for (const step of plan.steps) {
        if (!step.column) { lines.push(step.sql + ';'); continue; }
        lines.push(`SET @pls_upgrade_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ${literal(plan.database)} AND TABLE_NAME = ${literal(step.table)} AND COLUMN_NAME = ${literal(step.column)}), 'SELECT 1', ${literal(step.sql)});`,
            'PREPARE pls_legacy_upgrade FROM @pls_upgrade_sql;', 'EXECUTE pls_legacy_upgrade;', 'DEALLOCATE PREPARE pls_legacy_upgrade;');
    }
    lines.push('SET SESSION sql_mode = @pls_previous_sql_mode;');
    return lines.join('\n\n') + '\n';
}
