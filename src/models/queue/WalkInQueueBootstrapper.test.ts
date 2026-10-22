import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ connection: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.connection }));
import { bootstrapWalkInQueueTables, QUEUE_COUNTERS, QUEUE_EVENTS, QUEUE_SETTINGS, QUEUE_TICKETS } from './WalkInQueueBootstrapper';

function database(existing: string[] = []) {
     const tables = new Set(existing);
     const created: string[] = [];
     const ignored: any[] = [];
     const state = { failTable: '', tables, created, ignored };
     const column: any = new Proxy({}, { get: () => () => column });
     const table: any = new Proxy({}, { get: () => () => column });
     const db: any = (name: string) => ({ insert: (values: unknown) => ({ onConflict: (key: string) => ({ ignore: async () => { ignored.push({ name, values, key }); } }) }) });
     db.fn = { now: () => 'CURRENT_TIMESTAMP' };
     db.schema = {
          hasTable: vi.fn(async (name: string) => tables.has(name)),
          createTable: vi.fn(async (name: string, define: (builder: any) => void) => {
               if (state.failTable === name) throw new Error('Interrupted schema upgrade');
               define(table); created.push(name); tables.add(name);
          }),
     };
     mocks.connection.mockResolvedValue(db);
     return { db, state };
}
beforeEach(() => vi.clearAllMocks());
describe('walk-in queue startup schema', () => {
     it('creates all per-tenant tables and seeds settings without replacing existing preferences', async () => {
          const { state } = database();
          await bootstrapWalkInQueueTables(42);
          expect(mocks.connection).toHaveBeenCalledWith(42);
          expect(state.created).toEqual([QUEUE_SETTINGS, QUEUE_COUNTERS, QUEUE_TICKETS, QUEUE_EVENTS]);
          expect(state.ignored).toEqual([{ name: QUEUE_SETTINGS, values: { id: 1 }, key: 'id' }]);
     });
     it('performs no DDL when additive tables already exist', async () => {
          const { db, state } = database([QUEUE_SETTINGS, QUEUE_COUNTERS, QUEUE_TICKETS, QUEUE_EVENTS]);
          await bootstrapWalkInQueueTables(42);
          expect(db.schema.createTable).not.toHaveBeenCalled();
          expect(state.ignored[0].values).toEqual({ id: 1 });
     });
     it('deduplicates concurrent startup and can resume an interrupted upgrade', async () => {
          const { state } = database();
          state.failTable = QUEUE_TICKETS;
          const attempts = await Promise.allSettled([bootstrapWalkInQueueTables(42), bootstrapWalkInQueueTables(42)]);
          expect(attempts.every(result => result.status === 'rejected')).toBe(true);
          expect(state.created).toEqual([QUEUE_SETTINGS, QUEUE_COUNTERS]);
          state.failTable = '';
          await bootstrapWalkInQueueTables(42);
          expect(state.created).toEqual([QUEUE_SETTINGS, QUEUE_COUNTERS, QUEUE_TICKETS, QUEUE_EVENTS]);
     });
});
