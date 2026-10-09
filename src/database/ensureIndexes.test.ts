import { describe, expect, it, vi } from 'vitest';
import { Knex } from 'knex';
import { ensureIndexes } from './ensureIndexes';

const definition = { name: 'new_unique', columns: ['source', 'reference'], unique: true };
function harness(rows: Array<{ Key_name: string; Column_name: string; Seq_in_index: number; Non_unique: number }>) {
     const unique = vi.fn();
     const index = vi.fn();
     const db = {
          raw: vi.fn().mockResolvedValue([rows, []]),
          schema: { alterTable: vi.fn(async (_name: string, action: (table: { unique: typeof unique; index: typeof index }) => void) => {
               action({ unique, index });
          }) },
     };
     return { db, unique, index, connection: db as unknown as Knex };
}
const row = (name: string, column: string, position = 1, nonUnique = 0) =>
     ({ Key_name: name, Column_name: column, Seq_in_index: position, Non_unique: nonUnique });

describe('idempotent bootstrap indexes', () => {
     it('reuses matching exported indexes and never drops an absent legacy index', async () => {
          const { db, connection } = harness([row('new_unique', 'reference', 2), row('new_unique', 'source')]);
          await ensureIndexes(connection, 'test_table', [definition], ['old_unique']);
          expect(db.raw).toHaveBeenCalledTimes(1);
          expect(db.schema.alterTable).not.toHaveBeenCalled();
     });
     it('creates a replacement before dropping the existing legacy index', async () => {
          const { db, unique, connection } = harness([row('old_unique', 'source')]);
          await ensureIndexes(connection, 'test_table', [definition], ['old_unique']);
          expect(unique).toHaveBeenCalledWith(['source', 'reference'], { indexName: 'new_unique' });
          expect(db.raw).toHaveBeenLastCalledWith('ALTER TABLE ?? DROP INDEX ??', ['test_table', 'old_unique']);
          expect(db.schema.alterTable.mock.invocationCallOrder[0]).toBeLessThan(db.raw.mock.invocationCallOrder[1]);
     });
     it('adds a missing nonunique index', async () => {
          const { index, connection } = harness([]);
          await ensureIndexes(connection, 'test_table', [{ name: 'lookup', columns: ['date'] }]);
          expect(index).toHaveBeenCalledWith(['date'], 'lookup');
     });
     it.each([
          [row('new_unique', 'wrong'), row('new_unique', 'reference', 2)],
          [row('new_unique', 'source', 1, 1), row('new_unique', 'reference', 2, 1)],
     ])('rejects mismatched columns or uniqueness', async (...rows) => {
          const { connection } = harness(rows);
          await expect(ensureIndexes(connection, 'test_table', [definition])).rejects.toThrow('Unexpected index definition');
     });
     it('propagates creation failure without dropping the old constraint', async () => {
          const { db, connection } = harness([row('old_unique', 'source')]);
          db.schema.alterTable.mockRejectedValueOnce(new Error('DDL failed'));
          await expect(ensureIndexes(connection, 'test_table', [definition], ['old_unique'])).rejects.toThrow('DDL failed');
          expect(db.raw).toHaveBeenCalledTimes(1);
     });
});
