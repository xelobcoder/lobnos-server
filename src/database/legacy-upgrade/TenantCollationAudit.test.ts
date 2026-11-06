import { describe, expect, it, vi } from 'vitest';
import { assertTenantCollation, auditTenantCollation } from './TenantCollationAudit';

function fixture(defaultCollation = 'utf8mb4_unicode_ci', tableCollation = defaultCollation, columnCollation = defaultCollation) {
    const raw = vi.fn()
        .mockResolvedValueOnce([[{ SCHEMA_NAME: 'fixture', DEFAULT_CHARACTER_SET_NAME: 'utf8mb4', DEFAULT_COLLATION_NAME: defaultCollation }]])
        .mockResolvedValueOnce([[{ TABLE_NAME: 'records', TABLE_COLLATION: tableCollation }]])
        .mockResolvedValueOnce([[
            { TABLE_NAME: 'records', COLUMN_NAME: 'name', CHARACTER_SET_NAME: 'utf8mb4', COLLATION_NAME: columnCollation },
            { TABLE_NAME: 'records', COLUMN_NAME: 'token', CHARACTER_SET_NAME: 'ascii', COLLATION_NAME: 'ascii_bin' },
            { TABLE_NAME: 'records', COLUMN_NAME: 'identifier', CHARACTER_SET_NAME: 'utf8mb4', COLLATION_NAME: 'utf8mb4_0900_as_cs' },
        ]]);
    return { db: { raw }, raw };
}

describe('read-only tenant collation audit', () => {
    it('accepts standard defaults while reporting intentional exact-match exceptions', async () => {
        const { db, raw } = fixture();
        const result = await auditTenantCollation(db);
        expect(result).toMatchObject({ compliant: true, tableCount: 1, textColumnCount: 3, exactMatchColumns: 2 });
        expect(result.nonstandardColumns).toEqual([]);
        for (const [sql] of raw.mock.calls) {
            expect(sql).toMatch(/^SELECT /);
            expect(sql).not.toMatch(/INSERT|UPDATE|DELETE|ALTER|CREATE|SET /);
        }
    });
    it('does not confuse a corrected database default with converted tables and columns', async () => {
        const { db } = fixture('utf8mb4_unicode_ci', 'utf8mb4_0900_ai_ci', 'utf8mb4_general_ci');
        const result = await auditTenantCollation(db);
        expect(result.compliant).toBe(false);
        expect(result.nonstandardTables).toEqual([{ table: 'records', collation: 'utf8mb4_0900_ai_ci' }]);
        expect(result.nonstandardColumns).toEqual([{ table: 'records', column: 'name', collation: 'utf8mb4_general_ci' }]);
    });
    it('rejects a nonstandard database default even when individual tables are standard', async () => {
        const { db } = fixture('utf8mb4_0900_ai_ci', 'utf8mb4_unicode_ci', 'utf8mb4_unicode_ci');
        expect((await auditTenantCollation(db)).compliant).toBe(false);
    });
    it('fails explicitly when metadata is unavailable or a query fails', async () => {
        const { db, raw } = fixture();
        raw.mockReset().mockResolvedValueOnce([[]]);
        await expect(auditTenantCollation(db)).rejects.toThrow('not visible');
        raw.mockReset().mockRejectedValueOnce(new Error('metadata denied'));
        await expect(auditTenantCollation(db)).rejects.toThrow('metadata denied');
    });
    it('blocks activation when ordinary-text or table drift remains', async () => {
        await expect(assertTenantCollation(fixture().db)).resolves.toBeUndefined();
        await expect(assertTenantCollation(fixture('utf8mb4_unicode_ci', 'utf8mb4_0900_ai_ci', 'utf8mb4_0900_ai_ci').db))
            .rejects.toThrow(/1 nonstandard table\(s\).*1 nonstandard text column\(s\)/);
        await expect(assertTenantCollation(fixture('utf8mb4_0900_ai_ci', 'utf8mb4_unicode_ci', 'utf8mb4_unicode_ci').db))
            .rejects.toThrow(/database default utf8mb4_0900_ai_ci/);
    });
});
