import { describe, expect, it, vi } from 'vitest';
import { assertReviewedGmsValues, reviewedGmsColumns, applyReviewedGmsColumns } from './ReviewedGmsColumns';
function fixture(invalidTable?: string) {
    const raw = vi.fn((sql: string) => ({ sql }));
    const schema = { hasColumn: vi.fn(async () => true) };
    const db: any = vi.fn((table: string) => {
        const query: any = { whereRaw: () => query, whereNotNull: () => query, whereNotIn: () => query,
            first: async () => table === invalidTable ? { present: 1 } : undefined };
        return query;
    });
    db.raw = raw; db.schema = schema;
    return db;
}
describe('reviewed GMS compatibility decisions', () => {
    it('covers every one of the 24 reviewed columns exactly once', () => {
        expect(reviewedGmsColumns).toHaveLength(24);
        expect(new Set(reviewedGmsColumns.map(row => `${row.table}.${row.column}`)).size).toBe(24);
        expect(reviewedGmsColumns.find(row => row.table === 'expensesrecord')?.type).toBe('decimal(14,2) unsigned');
        expect(reviewedGmsColumns.find(row => row.column === 'temperature')?.type).toBe('decimal(12,2)');
        expect(reviewedGmsColumns.find(row => row.column === 'pin')?.defaultValue).toBeNull();
    });
    it('preserves every legacy enum category while adding supported application values', () => {
        expect(reviewedGmsColumns.find(row => row.table === 'commission_configs')?.allowed).toEqual(expect.arrayContaining(['percentage', 'fixed', 'tiered', 'hybrid', 'sliding_scale']));
        expect(reviewedGmsColumns.find(row => row.table === 'incidents')?.allowed).toContain('primelab-cause-analysis');
        expect(reviewedGmsColumns.find(row => row.table === 'inv_supplier_payments')?.allowed).toContain('cheque');
    });
    it('checks all bounded values before any ALTER or data mutation', async () => {
        const db = fixture();
        await assertReviewedGmsValues(db);
        expect(db.schema.hasColumn).toHaveBeenCalledTimes(24);
        expect(db.raw.mock.calls.every(([sql]: string[]) => sql === '1 AS present')).toBe(true);
    });
    it('blocks the whole migration before writes when a value would be truncated', async () => {
        const db = fixture('roles');
        await expect(applyReviewedGmsColumns(db)).rejects.toThrow('roles.role contains a value outside');
        expect(db.raw.mock.calls.every(([sql]: string[]) => sql === '1 AS present')).toBe(true);
    });
    it('requires existing columns, including on an existing but incomplete table', async () => {
        const db = fixture(); db.schema.hasColumn.mockResolvedValueOnce(false);
        await expect(applyReviewedGmsColumns(db)).rejects.toThrow('Compatibility baseline required');
        expect(db.raw).not.toHaveBeenCalled();
    });
});
