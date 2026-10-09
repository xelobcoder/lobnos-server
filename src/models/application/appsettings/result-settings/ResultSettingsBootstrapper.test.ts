import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ connection: vi.fn() }));
vi.mock('../../../../database/KnexConnections', () => ({ default: mocks.connection }));
import { bootstrapResultSettings, DEFAULT_RESULT_ENTRY_SETTINGS, DEFAULT_RESULT_SETTINGS } from './ResultSettingsBootstrapper';

function harness(initial?: Record<string, unknown>, exists = true) {
     let row = initial;
     const updates: Record<string, string>[] = [];
     const db = Object.assign((table: string) => {
          expect(table).toBe('resultsettings');
          const query = {
               insert: (value: Record<string, unknown>) => ({
                    onConflict: (key: string) => ({
                         merge: async (columns: string[]) => {
                              expect(key).toBe('id');
                              expect(columns).toEqual(['id']);
                              row ||= value;
                         },
                    }),
               }),
               where: () => query,
               forUpdate: () => query,
               first: async () => row,
               update: async (value: Record<string, string>) => { updates.push(value); Object.assign(row!, value); },
          };
          return query;
     }, {
          schema: {
               hasTable: vi.fn(async () => exists),
               hasColumn: vi.fn(async () => true),
               createTable: vi.fn(async () => {}),
               alterTable: vi.fn(async () => {}),
          },
          transaction: async (work: (trx: typeof db) => Promise<void>) => work(db),
     });
     mocks.connection.mockResolvedValue(db);
     return { db, updates, row: () => row };
}

describe('tenant result settings bootstrap', () => {
     beforeEach(() => vi.clearAllMocks());
     it('creates the table and seeds both login and printing configuration', async () => {
          const h = harness(undefined, false);
          await bootstrapResultSettings(582054);
          expect(mocks.connection).toHaveBeenCalledWith(582054);
          expect(h.db.schema.createTable).toHaveBeenCalledWith('resultsettings', expect.any(Function));
          expect(JSON.parse(String(h.row()!.resultsEntrySettings))).toEqual(DEFAULT_RESULT_ENTRY_SETTINGS);
          expect(JSON.parse(String(h.row()!.resultsettings))).toEqual(DEFAULT_RESULT_SETTINGS);
     });
     it('backfills missing entry settings without overwriting customized printing settings', async () => {
          const h = harness({ id: 1, resultsettings: '{"template":"custom"}', resultsEntrySettings: null });
          await bootstrapResultSettings(582054);
          expect(h.updates).toEqual([{ resultsEntrySettings: JSON.stringify(DEFAULT_RESULT_ENTRY_SETTINGS) }]);
          expect(h.row()!.resultsettings).toBe('{"template":"custom"}');
     });
     it('preserves populated client settings on repeated runs', async () => {
          const initial = { id: 1, resultsettings: '{"template":1}', resultsEntrySettings: '{"isPinOnResultEntry":0}' };
          const h = harness({ ...initial });
          await bootstrapResultSettings(582054);
          await bootstrapResultSettings(582054);
          expect(h.row()).toEqual(initial);
          expect(h.updates).toEqual([]);
     });
     it('does not inherit source staff IDs or facility contact details', () => {
          expect(DEFAULT_RESULT_ENTRY_SETTINGS.staffQualifiedToValidationResult).toEqual([]);
          expect(JSON.stringify(DEFAULT_RESULT_SETTINGS)).not.toContain('0500010615');
     });
     it('propagates failures instead of pretending settings were created', async () => {
          mocks.connection.mockRejectedValueOnce(new Error('Database unavailable'));
          await expect(bootstrapResultSettings(582054)).rejects.toThrow('Database unavailable');
     });
});
