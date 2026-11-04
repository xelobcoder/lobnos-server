import { describe, expect, it, vi } from 'vitest';
import { up, down } from '../../cron/command-line-tool-database/migrations/20261103_result_save_identity';

function database(duplicate?: any, unidentified?: any, installed = false) {
    let queries = 0;
    const db: any = vi.fn(() => {
        const result = queries++ === 0 ? duplicate : unidentified;
        const q: any = {
            select: () => q, groupBy: () => q, havingRaw: () => q,
            where: () => q, first: async () => result,
        };
        return q;
    });
    const column: any = {
        primary: () => column, unsigned: () => column, notNullable: () => column, defaultTo: () => column,
    };
    const table: any = {
        bigIncrements: () => column, integer: () => column, string: () => column,
        specificType: () => column, timestamp: () => column, unique: vi.fn(),
    };
    db.raw = vi.fn().mockResolvedValue([installed ? [{ Key_name: 'uq_result_current_parameter' }] : []]);
    db.fn = { now: () => 'now' };
    db.schema = {
        hasTable: vi.fn().mockResolvedValue(installed),
        alterTable: vi.fn(async (_name, callback) => callback(table)),
        createTable: vi.fn(async (_name, callback) => callback(table)),
    };
    return { db, table };
}
describe('result save migration safety (no database connection)', () => {
    it.each([[{ fieldid: 1 }, undefined], [undefined, { fieldid: null }]])('blocks ambiguous data before any DDL', async (duplicates, unidentified) => {
        const { db } = database(duplicates, unidentified);
        await expect(up(db)).rejects.toThrow('reviewed, non-destructive repair');
        expect(db.schema.alterTable).not.toHaveBeenCalled();
        expect(db.schema.createTable).not.toHaveBeenCalled();
    });
    it('adds only current-result uniqueness and retry receipts, with parameterized identifiers', async () => {
        const { db, table } = database();
        await up(db);
        expect(db.raw).toHaveBeenCalledWith('SHOW INDEX FROM ?? WHERE Key_name = ?', ['test_results', 'uq_result_current_parameter']);
        expect(table.unique).toHaveBeenCalledWith(['ascensionid', 'testid', 'fieldid'], 'uq_result_current_parameter');
        expect(table.unique).toHaveBeenCalledWith(['ascensionid', 'request_id'], 'uq_result_save_request');
        expect(db.schema.createTable).toHaveBeenCalledWith('lab_result_save_requests', expect.any(Function));
    });
    it('is repeatable and rollback never drops history or receipts', async () => {
        const { db } = database(undefined, undefined, true);
        await up(db);
        await down();
        expect(db.schema.alterTable).not.toHaveBeenCalled();
        expect(db.schema.createTable).not.toHaveBeenCalled();
    });
});
