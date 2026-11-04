import { describe, expect, it } from 'vitest';
import knex from 'knex';
import { UNICODE_CI_PROTOCOL_ID } from './SchemaCollationPolicy';
import { caseSensitiveCollation, normalizeSchemaTextCollations, TENANT_COLLATION } from './SchemaCollationPolicy';
describe('tenant collation policy', () => {
    it('standardizes imported defaults and ordinary text while preserving exact-match identifiers', () => {
        const sql = "CREATE TABLE `t` (\n `id` varchar(64) COLLATE utf8mb4_0900_ai_ci,\n `note` text COLLATE utf8mb4_general_ci,\n `token` varchar(80) CHARACTER SET ascii COLLATE ascii_bin\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci";
        const result = normalizeSchemaTextCollations(sql);
        expect(result).not.toContain('0900_ai_ci'); expect(result).not.toContain('general_ci');
        expect(result).toContain('`token` varchar(80) CHARACTER SET ascii COLLATE ascii_bin');
        expect(result).toContain(`COLLATE=${TENANT_COLLATION}`);
        expect(normalizeSchemaTextCollations(result)).toBe(result);
    });
    it('preserves binary and case-sensitive domain comparisons', () => {
        expect(caseSensitiveCollation('utf8mb4_bin')).toBe(true);
        expect(caseSensitiveCollation('utf8mb4_0900_as_cs')).toBe(true);
        expect(caseSensitiveCollation('utf8mb4_0900_ai_ci')).toBe(false);
    });    it('uses the protocol collation ID without passing a collation as a SQL character set', async () => {
        const db = knex({ client: 'mysql2', connection: { database: 'fixture', charsetNumber: UNICODE_CI_PROTOCOL_ID } as any });
        try {
            const sql = db.schema.createTable('fixture_table', table => table.integer('id')).toQuery();
            expect(sql).not.toContain('character set utf8mb4_unicode_ci');
            expect(db.client.config.connection.charsetNumber).toBe(224);
        } finally { await db.destroy(); }
    });

});
