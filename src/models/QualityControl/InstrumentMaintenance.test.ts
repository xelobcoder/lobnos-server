import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ connection: vi.fn(), store: {} as Record<string, any[]> }));
vi.mock('../../database/KnexConnections', () => ({ default: state.connection }));
import { bootstrapInstrumentMaintenance } from './InstrumentMaintenanceBootstrapper';
import {
     canSupervisorClearMaintenance, InstrumentMaintenanceService,
     maintenanceRunStatusAfterInspection, nextMaintenanceDate,
} from './InstrumentMaintenanceService';
import { INSTRUMENT_MAINTENANCE_TABLES as T } from './InstrumentMaintenanceBootstrapper';

function queryDb() {
     const db: any = (table: string) => {
          const baseTable = table.split(' as ')[0];
          const filters: Array<(row: any) => boolean> = [];
          let first = false;
          const query: any = {
               where(key: any, value?: any) {
                    if (typeof key === 'object') filters.push(row => Object.entries(key).every(([k, v]) => row[k] === v));
                    else filters.push(row => row[key.split('.').pop()!] === value);
                    return query;
               },
               whereNotNull(key: string) { filters.push(row => row[key] != null); return query; },
               whereNot(key: string, value: any) { filters.push(row => row[key] !== value); return query; },
               forUpdate() { return query; },
               first() { first = true; return query; },
               async update(values: any) {
                    const rows = (state.store[baseTable] || []).filter(row => filters.every(filter => filter(row)));
                    rows.forEach(row => Object.assign(row, values));
                    return rows.length;
               },
               async insert(value: any) {
                    const rows = Array.isArray(value) ? value : [value];
                    (state.store[baseTable] ||= []).push(...rows.map((row, i) => ({ id: row.id || i + 1, ...row })));
                    return rows.map((row, i) => row.id || i + 1);
               },
               then(resolve: any, reject: any) {
                    try {
                         const rows = (state.store[baseTable] || []).filter(row => filters.every(filter => filter(row)));
                         resolve(first ? rows[0] : rows);
                    } catch (error) { reject(error); }
               },
          };
          return query;
     };
     db.transaction = async (callback: any) => callback(db);
     db.fn = { now: () => new Date('2026-01-02T00:00:00.000Z') };
     return db;
}

beforeEach(() => {
     vi.clearAllMocks();
     state.store = {};
});

describe('instrument maintenance tenant bootstrap', () => {
     it('idempotently creates the tenant maintenance tables beside the QC device registry', async () => {
          const created: string[] = [];
          const schema: any = {
               hasTable: vi.fn(async (name: string) => name === 'devices' || created.includes(name)),
               hasColumn: vi.fn().mockResolvedValue(true),
               createTable: vi.fn(async (name: string, define: (table: any) => void) => {
                    created.push(name);
                    const table: any = new Proxy({}, { get: (_target, method) => (..._args: any[]) => table });
                    define(table);
               }),
          };
          const db: any = { schema };
          state.connection.mockResolvedValue(db);
          await bootstrapInstrumentMaintenance(77);
          expect(state.connection).toHaveBeenCalledWith(77);
          expect(created).toEqual(Object.values(T));
          schema.createTable.mockClear();
          await bootstrapInstrumentMaintenance(77);
          expect(schema.createTable).not.toHaveBeenCalled();
     });
     it('refuses to create feature tables if the existing QC instrument registry is missing', async () => {
          const db: any = { schema: { hasTable: vi.fn().mockResolvedValue(false), createTable: vi.fn() } };
          state.connection.mockResolvedValue(db);
          await expect(bootstrapInstrumentMaintenance(4)).rejects.toThrow('QC devices registry');
          expect(db.schema.createTable).not.toHaveBeenCalled();
     });
     it('repairs missing task draft and revision columns without replacing existing tables', async () => {
          const columns = new Set<string>();
          const schema: any = {
               hasTable: vi.fn().mockResolvedValue(true),
               hasColumn: vi.fn(async (_table: string, name: string) => columns.has(name)),
               alterTable: vi.fn(async (_table: string, define: (table: any) => void) => {
                    const chain: any = new Proxy({}, { get: () => () => chain });
                    define(new Proxy({}, { get: (_target, method) => (name: string) => { columns.add(name); return chain; } }));
               }),
          };
          state.connection.mockResolvedValue({ schema });
          await bootstrapInstrumentMaintenance(77);
          expect([...columns]).toEqual(['revision', 'draft', 'draft_by']);
          await bootstrapInstrumentMaintenance(77);
          expect(schema.alterTable).toHaveBeenCalledTimes(3);
     });
});

describe('instrument maintenance recurrence and status lifecycle', () => {
     it.each([
          ['daily', '2026-01-03'], ['weekly', '2026-01-09'], ['monthly', '2026-02-02'],
          ['quarterly', '2026-04-02'], ['annual', '2027-01-02'],
     ] as const)('calculates %s due date using date-only UTC semantics', (frequency, expected) => {
          expect(nextMaintenanceDate('2026-01-02', frequency)).toBe(expected);
     });
     it('clamps monthly recurrences at month end rather than rolling into the following month', () => {
          expect(nextMaintenanceDate('2026-01-31', 'monthly')).toBe('2026-02-28');
          expect(nextMaintenanceDate('2024-02-29', 'annual')).toBe('2025-02-28');
     });
     it('routes passing checks to supervisor review and failed checks to corrective work', () => {
          expect(maintenanceRunStatusAfterInspection(0)).toBe('awaiting_supervisor_review');
          expect(maintenanceRunStatusAfterInspection(1)).toBe('awaiting_corrective_action');
          expect(canSupervisorClearMaintenance(1, 1, 1)).toBe(false);
          expect(canSupervisorClearMaintenance(1, 1, 0)).toBe(true);
          expect(canSupervisorClearMaintenance(1, 0, 0)).toBe(false);
     });
     it('blocks an instrument with a failed scheduled execution but leaves other instruments unchanged', async () => {
          const db = queryDb();
          state.connection.mockResolvedValue(db);
          const service = new InstrumentMaintenanceService(2);
          const trx = db;
          state.store[T.runs] = [
               { id: 1, device_id: 'instrument-1', schedule_id: 3, status: 'awaiting_corrective_action' },
               { id: 2, device_id: 'instrument-2', schedule_id: null, status: 'cleared' },
               { id: 3, device_id: 'instrument-3', schedule_id: null, status: 'awaiting_corrective_action' },
          ];
          await expect(service.assertInstrumentClear(trx, 'instrument-1')).rejects.toMatchObject({
               statusCode: 423, code: 'INSTRUMENT_MAINTENANCE_BLOCKED',
          });
          await expect(service.assertInstrumentClear(trx, 'instrument-2')).resolves.toBeUndefined();
          await expect(service.assertInstrumentClear(trx, 'instrument-3')).rejects.toMatchObject({
               statusCode: 423, code: 'INSTRUMENT_MAINTENANCE_BLOCKED',
          });
          await expect(service.assertInstrumentClear(trx, null)).resolves.toBeUndefined();
     });
     it('persists corrective completion and permits supervisor clearance only afterward', async () => {
          const db = queryDb();
          state.connection.mockResolvedValue(db);
          state.store[T.runs] = [{ id: 5, status: 'awaiting_corrective_action' }];
          state.store[T.checks] = [{ id: 6, run_id: 5, result: 'fail' }];
          state.store[T.actions] = [{ id: 7, run_id: 5, check_id: 6, description: 'Repair', status: 'open' }];
          const service = new InstrumentMaintenanceService(2);
          await expect(service.supervisorReview(5, 90)).rejects.toThrow('Complete all failed-check');
          expect(state.store[T.runs][0].status).toBe('awaiting_corrective_action');
          const action = await service.completeCorrectiveAction(7, 'Replaced damaged component', 42);
          expect(action.status).toBe('completed');
          const cleared = await service.supervisorReview(5, 90, 'Verified safe');
          expect(cleared.status).toBe('cleared');
          expect(cleared.reviewed_by).toBe(90);
     });
     it('requires a completed task, one completed action per failed check, and an independent reviewer', async () => {
          const db = queryDb(); state.connection.mockResolvedValue(db);
          state.store[T.runs] = [{ id: 5, status: 'awaiting_corrective_action', performed_by: 7 }];
          state.store[T.checks] = [{ id: 6, run_id: 5, result: 'fail' }, { id: 8, run_id: 5, result: 'fail' }];
          state.store[T.actions] = [{ id: 1, run_id: 5, check_id: 6, status: 'completed', completed_by: 9 }, { id: 2, run_id: 5, check_id: 6, status: 'completed', completed_by: 9 }];
          state.store[T.tasks] = [{ id: 3, run_id: 5, status: 'pending' }];
          const service = new InstrumentMaintenanceService(2);
          await expect(service.supervisorReview(5, 10, 'Verified')).rejects.toThrow('failed-check');
          state.store[T.actions][1].check_id = 8;
          await expect(service.supervisorReview(5, 10, 'Verified')).rejects.toThrow('Complete the maintenance task');
          state.store[T.tasks][0].status = 'completed';
          await expect(service.supervisorReview(5, 7, 'Verified')).rejects.toThrow('independent supervisor');
          await expect(service.supervisorReview(5, 9, 'Verified')).rejects.toThrow('independent supervisor');
          await expect(service.supervisorReview(5, 10, 'Verified')).resolves.toMatchObject({ status: 'cleared' });
     });
});
