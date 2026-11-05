import type { Knex } from 'knex';
import { caseSensitiveCollation, TENANT_COLLATION } from './SchemaCollationPolicy';

export async function auditTenantCollation(db: Knex) {
    const [schemas] = await db.raw(
        'SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()',
    );
    if (schemas.length !== 1) throw new Error('The configured database is not visible for collation verification');
    const schema = schemas[0];
    const [tables] = await db.raw(
        "SELECT TABLE_NAME, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
        [schema.SCHEMA_NAME],
    );
    const [columns] = await db.raw(
        'SELECT TABLE_NAME, COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND COLLATION_NAME IS NOT NULL ORDER BY TABLE_NAME, ORDINAL_POSITION',
        [schema.SCHEMA_NAME],
    );
    const nonstandardTables: { table: string; collation: string }[] = tables
        .filter((table: { TABLE_COLLATION: string }) => table.TABLE_COLLATION !== TENANT_COLLATION)
        .map((table: { TABLE_NAME: string; TABLE_COLLATION: string }) => ({ table: table.TABLE_NAME, collation: table.TABLE_COLLATION }));
    const nonstandardColumns: { table: string; column: string; collation: string }[] = [];
    let exactMatchColumns = 0;
    for (const column of columns) {
        if (caseSensitiveCollation(column.COLLATION_NAME)) {
            exactMatchColumns++;
        } else if (column.CHARACTER_SET_NAME !== 'utf8mb4' || column.COLLATION_NAME !== TENANT_COLLATION) {
            nonstandardColumns.push({ table: column.TABLE_NAME, column: column.COLUMN_NAME, collation: column.COLLATION_NAME });
        }
    }
    return {
        database: String(schema.SCHEMA_NAME),
        expectedCollation: TENANT_COLLATION,
        defaultCharacterSet: String(schema.DEFAULT_CHARACTER_SET_NAME),
        defaultCollation: String(schema.DEFAULT_COLLATION_NAME),
        tableCount: tables.length,
        textColumnCount: columns.length,
        exactMatchColumns,
        nonstandardTables,
        nonstandardColumns,
        compliant: schema.DEFAULT_CHARACTER_SET_NAME === 'utf8mb4'
            && schema.DEFAULT_COLLATION_NAME === TENANT_COLLATION
            && nonstandardTables.length === 0 && nonstandardColumns.length === 0,
    };
}
