import { describe, expect, it, vi } from 'vitest';
import { archiveLegacyTable, archiveRefundWitnesses } from './LegacyArchive';

describe('legacy migration evidence preservation', () => {
    it('renames retired tables and refuses to overwrite an existing archive', async () => {
        const renameTable = vi.fn();
        const db: any = { schema: { hasTable: vi.fn(async (name: string) => name === 'old'), renameTable } };
        await archiveLegacyTable(db, 'old');
        expect(renameTable).toHaveBeenCalledWith('old', 'legacy_old');
        db.schema.hasTable.mockResolvedValue(true);
        await expect(archiveLegacyTable(db, 'old')).rejects.toThrow('already exists');
        expect(renameTable).toHaveBeenCalledTimes(1);
    });
    it('preserves refund witness rows using shared named columns, including after a partial retry', async () => {
        const raw = vi.fn();
        const db: any = vi.fn((table: string) => ({ leftJoin: () => ({ whereNull: () => ({ first: async () => undefined }) }), columnInfo: async () => table === 'dbobillingrefundtable'
            ? { id: {}, firstWitness: {}, secondWitness: {} }
            : { id: {}, firstWitness: {}, secondWitness: {}, thirdWitness: {} } }));
        db.raw = raw;
        await archiveRefundWitnesses(db);
        expect(raw).toHaveBeenNthCalledWith(1, 'CREATE TABLE IF NOT EXISTS ?? LIKE ??', ['legacy_refund_witnesses', 'dbobillingrefundtable']);
        expect(raw).toHaveBeenNthCalledWith(2, 'INSERT IGNORE INTO ?? (??) SELECT ?? FROM ??',
            ['legacy_refund_witnesses', ['id', 'firstWitness', 'secondWitness'], ['id', 'firstWitness', 'secondWitness'], 'dbobillingrefundtable']);
    });
    it('repairs missing evidence columns in a partial archive without overwriting earlier fields', async () => {
        const raw = vi.fn(async (sql: string) => sql === 'SHOW CREATE TABLE ??'
            ? [[{ 'Create Table': 'CREATE TABLE `dbobillingrefundtable` (\n `refundid` int,\n `secondWitness` int DEFAULT NULL\n)' }]] : undefined);
        const db: any = vi.fn((table: any) => ({
            columnInfo: async () => table === 'dbobillingrefundtable' ? { refundid: {}, secondWitness: {} } : { refundid: {} },
            leftJoin: () => ({ whereNull: () => ({ first: async () => undefined }) }),
        }));
        db.raw = raw;
        await archiveRefundWitnesses(db);
        expect(raw).toHaveBeenCalledWith('ALTER TABLE ?? ADD COLUMN `secondWitness` int DEFAULT NULL', ['legacy_refund_witnesses']);
        expect(raw).toHaveBeenCalledWith('UPDATE ?? a JOIN ?? s ON a.refundid = s.refundid SET a.?? = s.??',
            ['legacy_refund_witnesses', 'dbobillingrefundtable', 'secondWitness', 'secondWitness']);
    });
    it('blocks witness retirement when any source refund is missing from the archive', async () => {
        const db: any = vi.fn(() => ({ columnInfo: async () => ({ refundid: {} }),
            leftJoin: () => ({ whereNull: () => ({ first: async () => ({ refundid: 1 }) }) }),
        }));
        db.raw = vi.fn();
        await expect(archiveRefundWitnesses(db)).rejects.toThrow('archive is incomplete');
    });

});
