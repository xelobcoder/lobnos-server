import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));

import KnexConnection from '../../database/KnexConnections';
import { SpecimenLifecycleService, specimenLifecycleCapabilities } from './SpecimenLifecycleService';
import { laboratoryWorkflow } from '../operations/LaboratoryWorkflow';

type Row = Record<string, any>;

const specimen = (overrides: Row = {}): Row => ({
     id: 10, sample_uid: 'original-container', barcode: 'original-container',
     billingid: 20, patientid: 30, sample_type_id: 1, container_type_id: 2,
     status: 'accepted', quantity: '1.00', remaining_quantity: null, unit: 'ml',
     storage_state: 'available', storage_position_id: null, parent_sample_id: null,
     retention_until: null, version: 1, collected_by: 7, accepted_by: 7,
     ...overrides,
});

/** A small stateful query adapter: transactions roll back and serialize like locked specimen operations. */
function database(samples: Row[] = [specimen()]) {
     const tables: Record<string, Row[]> = {
          physical_samples: structuredClone(samples),
          physical_sample_events: [],
          specimen_storage_positions: [{ id: 1, freezer: 'Freezer A', rack: 'Rack 1', position: 'A01', is_active: 1 }],
          test_ascension_samples: [{ sample_id: 10, ascension_id: 101, is_required: true }],
          roles: [{ employeeid: 7, role: 'scientist', activation: 1 }, { employeeid: 8, role: 'scientist', activation: 1 }, { employeeid: 9, role: 'receptionist', activation: 1 }],
          logins: [{ employeeid: 7, role: 'scientist', activation: 1 }, { employeeid: 8, role: 'scientist', activation: 1 }, { employeeid: 9, role: 'receptionist', activation: 1 }],
     };
     const state = { tables, locks: [] as string[], failEvent: false };
     const value = (row: Row, key: string) => row[key.split('.').pop()!];
     const raw = (sql: string, bindings?: unknown[]) => ({ __raw: sql, bindings });
     const query: any = (tableName: string, predicates: Array<(row: Row) => boolean> = []) => {
          const table = tableName.split(/\s+as\s+/i)[0];
          const filters = [...predicates];
          let columns: string[] | undefined;
          let limit: number | undefined;
          let offset = 0;
          let countAlias: string | undefined;
          const matching = () => (state.tables[table] || []).filter(row => filters.every(predicate => predicate(row)));
          const selectRows = () => countAlias ? [{ [countAlias]: matching().length }] : matching().slice(offset, limit === undefined ? undefined : offset + limit).map(row => {
               if (!columns?.length || columns.some(column => typeof column !== 'string' || column === '*' || column.endsWith('.*'))) return structuredClone(row);
               return Object.fromEntries(columns.map(column => [column.split(/\s+as\s+/i).pop()!.split('.').pop()!, value(row, column.split(/\s+as\s+/i)[0])]));
          });
          const builder: any = {
               where: (...args: any[]) => {
                    if (typeof args[0] === 'function') { args[0].call(builder, builder); return builder; }
                    if (typeof args[0] === 'object') {
                         for (const [key, expected] of Object.entries(args[0])) filters.push(row => value(row, key) === expected || String(value(row, key)) === String(expected));
                    } else {
                         const [key, operator, expected] = args.length === 2 ? [args[0], '=', args[1]] : args;
                         filters.push(row => operator === '=' ? String(value(row, key)) === String(expected) : operator === '!=' || operator === '<>' ? String(value(row, key)) !== String(expected) : operator === '>' ? value(row, key) > expected : operator === '>=' ? value(row, key) >= expected : operator === '<' ? value(row, key) < expected : value(row, key) <= expected);
                    }
                    return builder;
               },
               whereIn: (key: string, values: any[]) => { filters.push(row => values.some(expected => String(value(row, key)) === String(expected))); return builder; },
               whereNull: (key: string) => { filters.push(row => value(row, key) == null); return builder; },
               whereNotNull: (key: string) => { filters.push(row => value(row, key) != null); return builder; },
               whereNot: (...args: any[]) => { const [key, expected] = args; filters.push(row => String(value(row, key)) !== String(expected)); return builder; },
               andWhere: (...args: any[]) => builder.where(...args),
               first: async (...args: string[]) => { if (args.length) columns = args; return selectRows()[0]; },
               select: (...args: string[]) => { columns = args.flat(); return builder; },
               forUpdate: () => { state.locks.push(table); return builder; },
               clone: () => query(tableName, filters),
               count: (column: string) => { countAlias = column.split(/\s+as\s+/i).pop()!; return builder; },
               orderBy: () => builder,
               limit: (count: number) => { limit = count; return builder; },
               offset: (count: number) => { offset = count; return builder; },
               join: () => builder,
               innerJoin: () => builder,
               leftJoin: () => builder,
               update: async (updates: Row) => {
                    const rows = matching();
                    rows.forEach(row => {
                         for (const [key, update] of Object.entries(updates)) {
                              row[key] = update && typeof update === 'object' && update.__raw ? /\+\s*1/.test(update.__raw) ? Number(row[key]) + 1 : new Date() : update;
                         }
                    });
                    return rows.length;
               },
               insert: async (data: Row | Row[]) => {
                    if (table === 'physical_sample_events' && state.failEvent) throw new Error('Audit storage unavailable');
                    const rows = Array.isArray(data) ? data : [data];
                    if (!state.tables[table]) state.tables[table] = [];
                    const ids: number[] = [];
                    rows.forEach(row => {
                         const id = row.id ?? Math.max(0, ...state.tables[table].map(existing => Number(existing.id) || 0)) + 1;
                         state.tables[table].push(structuredClone({ ...row, id }));
                         ids.push(id);
                    });
                    return ids;
               },
               then: (resolve: any, reject: any) => Promise.resolve(selectRows()).then(resolve, reject),
          };
          return builder;
     };
     query.raw = raw;
     query.fn = { now: () => new Date() };
     let pending = Promise.resolve();
     query.transaction = (operation: (trx: any) => Promise<any>) => {
          const run = pending.then(async () => {
               const snapshot = structuredClone(state.tables);
               try { return await operation(query); }
               catch (error) { state.tables = snapshot; throw error; }
          });
          pending = run.then(() => undefined, () => undefined);
          return run;
     };
     const service = new SpecimenLifecycleService(42);
     // Mutation invariants are asserted against committed rows; reporting SQL is tested separately.
     vi.spyOn(service, 'detail').mockImplementation(async id => structuredClone(state.tables.physical_samples.find(row => Number(row.id) === Number(id))));
     vi.mocked(KnexConnection).mockResolvedValue(query);
     return { service, state, connection: query };
}

beforeEach(() => vi.clearAllMocks());

describe('specimen aliquots', () => {
     it('conserves decimal volume, retains lineage, and never makes the new container mandatory for the original tests', async () => {
          const { service, state } = database();
          const result = await service.aliquot(10, { expectedVersion: 1, quantity: 0.30 }, 7);
          expect(KnexConnection).toHaveBeenCalledWith(42);
          const parent = state.tables.physical_samples.find(row => row.id === 10)!;
          const created = state.tables.physical_samples.find(row => row.id !== 10)!;
          expect(Number(parent.quantity)).toBe(1);
          expect(Number(parent.remaining_quantity)).toBe(0.7);
          expect(Number(created.quantity)).toBe(0.3);
          expect(Number(created.remaining_quantity)).toBe(0.3);
          expect(created).toMatchObject({ parent_sample_id: 10, patientid: 30, billingid: 20, unit: 'ml', storage_state: 'available' });
          expect(created.barcode).toBeTruthy();
          expect(created.barcode).not.toBe(parent.barcode);
          expect(result.id).toBe(parent.id);
          expect(state.tables.test_ascension_samples).toContainEqual(expect.objectContaining({ sample_id: created.id, ascension_id: 101, is_required: false }));
          expect(state.locks).toContain('physical_samples');
          expect(state.tables.physical_sample_events).toHaveLength(2);
     });

     it.each([0, -1, 0.001, 1.01, NaN, Infinity])('rejects invalid or excessive aliquot quantity %s without consuming volume', async quantity => {
          const { service, state } = database();
          await expect(service.aliquot(10, { expectedVersion: 1, quantity }, 7)).rejects.toThrow();
          expect(state.tables.physical_samples).toHaveLength(1);
          expect(state.tables.physical_samples[0].remaining_quantity).toBeNull();
          expect(state.tables.physical_sample_events).toEqual([]);
     });

     it('makes only one allocation when two requests use the same sample version', async () => {
          const { service, state } = database();
          const outcomes = await Promise.allSettled([
               service.aliquot(10, { expectedVersion: 1, quantity: 0.6 }, 7),
               service.aliquot(10, { expectedVersion: 1, quantity: 0.6 }, 8),
          ]);
          expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
          expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1);
          expect(state.tables.physical_samples).toHaveLength(2);
          expect(Number(state.tables.physical_samples.find(row => row.id === 10)!.remaining_quantity)).toBe(0.4);
     });

     it('rolls back the child, test links, volume and version when its audit write fails', async () => {
          const { service, state } = database();
          const before = structuredClone(state.tables);
          state.failEvent = true;
          await expect(service.aliquot(10, { expectedVersion: 1, quantity: 0.2 }, 7)).rejects.toThrow('Audit storage unavailable');
          expect(state.tables).toEqual(before);
     });

     it('replays an aliquot request without allocating twice and rejects reuse for different content', async () => {
          const { service, state } = database();
          const input = { expectedVersion: 1, quantity: 0.3, idempotencyKey: 'aliquot-request-one' };
          const first = await service.aliquot(10, input, 7);
          const replay = await service.aliquot(10, input, 7);
          expect(replay.id).toBe(first.id);
          expect(state.tables.physical_samples).toHaveLength(2);
          expect(Number(state.tables.physical_samples.find(row => row.id === 10)!.remaining_quantity)).toBe(0.7);
          expect(state.tables.physical_sample_events).toHaveLength(2);
          await expect(service.aliquot(10, { ...input, quantity: 0.4 }, 7)).rejects.toThrow();
          expect(state.tables.physical_samples).toHaveLength(2);
     });

     it('deducts repeated decimal allocations exactly and permits the final remaining quantity', async () => {
          const { service, state } = database();
          await service.aliquot(10, { expectedVersion: 1, quantity: 0.1 }, 7);
          await service.aliquot(10, { expectedVersion: 2, quantity: 0.2 }, 7);
          await service.aliquot(10, { expectedVersion: 3, quantity: 0.7 }, 7);
          const parent = state.tables.physical_samples.find(row => row.id === 10)!;
          expect(Number(parent.remaining_quantity)).toBe(0);
          expect(state.tables.physical_samples.filter(row => row.parent_sample_id === 10).reduce((total, row) => total + Number(row.quantity), 0)).toBe(1);
          await expect(service.aliquot(10, { expectedVersion: 4, quantity: 0.01 }, 7)).rejects.toThrow();
     });

     it.each([{ status: 'collected' }, { storage_state: 'stored', storage_position_id: 1 }, { storage_state: 'disposed' }])('cannot split a specimen in state %j', async overrides => {
          const { service, state } = database([specimen(overrides)]);
          await expect(service.aliquot(10, { expectedVersion: 1, quantity: 0.2 }, 7)).rejects.toThrow();
          expect(state.tables.physical_samples).toHaveLength(1);
     });
});

describe('specimen storage custody', () => {
     it.each(['collected', 'received'])('stores and retrieves a %s specimen without fabricating acceptance or bypassing required validation', async status => {
          const { service, state } = database([specimen({ status, accepted_at: null, accepted_by: null })]);
          const bypassValidation = { byPassSampleValidation: 1, byPassProcessing: 1 };
          const current = () => state.tables.physical_samples[0];
          expect(specimenLifecycleCapabilities('phlebotomist', current())).toMatchObject({ canStore: true, canRetrieve: false, canAliquot: false });
          expect(laboratoryWorkflow(bypassValidation, {}, [current()]).canEnterResults).toBe(true);

          await service.store(10, { expectedVersion: 1, positionId: 1 }, 7);
          expect(current()).toMatchObject({ status, accepted_at: null, accepted_by: null, storage_state: 'stored', storage_position_id: 1, version: 2 });
          expect(specimenLifecycleCapabilities('phlebotomist', current()).canRetrieve).toBe(true);
          expect(laboratoryWorkflow(bypassValidation, {}, [current()])).toMatchObject({ canEnterResults: false });

          await service.retrieve(10, { expectedVersion: 2, reason: 'Repeat testing requested' }, 8);
          expect(current()).toMatchObject({ status, accepted_at: null, accepted_by: null, storage_state: 'retrieved', storage_position_id: null, version: 3 });
          expect(specimenLifecycleCapabilities('phlebotomist', current())).toMatchObject({ canStore: true, canRetrieve: false });
          expect(laboratoryWorkflow(bypassValidation, {}, [current()]).canEnterResults).toBe(true);
          expect(laboratoryWorkflow({ byPassProcessing: 1 }, {}, [current()]))
               .toMatchObject({ sampleValidation: 'pending', canValidateSample: true, canEnterResults: false, blockedReason: 'Sample validation is required' });
          expect(state.tables.physical_sample_events.map(event => ({ type: event.event_type, from: event.from_status, to: event.to_status })))
               .toEqual([{ type: 'stored', from: status, to: status }, { type: 'retrieved', from: status, to: status }]);
     });

     it.each(['planned', 'collection_started', 'rejected', 'recollection_required'])('does not start storage for a %s specimen', async status => {
          const { service, state } = database([specimen({ status })]);
          const before = structuredClone(state.tables);
          expect(specimenLifecycleCapabilities('scientist', state.tables.physical_samples[0]).canStore).toBe(false);
          await expect(service.store(10, { expectedVersion: 1, positionId: 1 }, 7)).rejects.toMatchObject({ statusCode: 409 });
          expect(state.tables).toEqual(before);
     });

     it.each(['rejected', 'recollection_required'])('allows documented retrieval after a stored specimen becomes %s', async status => {
          const { service, state } = database([specimen({ status: 'received', accepted_by: null, accepted_at: null })]);
          await service.store(10, { expectedVersion: 1, positionId: 1 }, 7);
          // Sample review changes validation status but preserves its occupied location.
          Object.assign(state.tables.physical_samples[0], { status, version: 3 });
          expect(specimenLifecycleCapabilities('scientist', state.tables.physical_samples[0])).toMatchObject({ canStore: false, canRetrieve: true });
          await service.retrieve(10, { expectedVersion: 3, reason: 'Remove rejected material for review' }, 8);
          expect(state.tables.physical_samples[0]).toMatchObject({ status, accepted_by: null, accepted_at: null, storage_state: 'retrieved', storage_position_id: null, version: 4 });
          expect(state.tables.physical_sample_events[1]).toMatchObject({ event_type: 'retrieved', from_status: status, to_status: status, reason: 'Remove rejected material for review' });
     });

     it.each([
          { status: 'planned', storage_state: 'stored', storage_position_id: 1 },
          { status: 'collection_started', storage_state: 'stored', storage_position_id: 1 },
          { status: 'accepted', storage_state: 'stored', storage_position_id: null },
     ])('does not expose or permit retrieval without a real stored specimen: %j', overrides => {
          const { service, state } = database([specimen(overrides)]);
          expect(specimenLifecycleCapabilities('scientist', state.tables.physical_samples[0]).canRetrieve).toBe(false);
          return expect(service.retrieve(10, { expectedVersion: 1, reason: 'Attempt retrieval' }, 7)).rejects.toMatchObject({ statusCode: 409 });
     });

     it('assigns one exclusive storage position and releases it on documented retrieval', async () => {
          const { service, state } = database();
          await service.store(10, { expectedVersion: 1, positionId: 1 }, 7);
          expect(state.tables.physical_samples[0]).toMatchObject({ storage_state: 'stored', storage_position_id: 1, version: 2 });
          await service.retrieve(10, { expectedVersion: 2, reason: 'Repeat testing requested' }, 8);
          expect(state.tables.physical_samples[0]).toMatchObject({ storage_state: 'retrieved', storage_position_id: null, version: 3 });
          expect(state.tables.physical_sample_events.map(row => row.event_type)).toEqual(['stored', 'retrieved']);
          expect(state.tables.physical_sample_events[1]).toMatchObject({ actor_employeeid: 8, reason: 'Repeat testing requested' });
          expect(state.locks).toContain('specimen_storage_positions');
     });

     it('allows only one specimen to claim a position under competing requests', async () => {
          const { service, state } = database([specimen(), specimen({ id: 11, barcode: 'second-container' })]);
          const outcomes = await Promise.allSettled([
               service.store(10, { expectedVersion: 1, positionId: 1 }, 7),
               service.store(11, { expectedVersion: 1, positionId: 1 }, 8),
          ]);
          expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
          expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1);
          expect(state.tables.physical_samples.filter(row => row.storage_position_id === 1)).toHaveLength(1);
          expect(state.tables.physical_sample_events).toHaveLength(1);
     });

     it('rejects missing retrieval reason and retains custody', async () => {
          const { service, state } = database([specimen({ storage_state: 'stored', storage_position_id: 1 })]);
          await expect(service.retrieve(10, { expectedVersion: 1, reason: '   ' }, 7)).rejects.toThrow();
          expect(state.tables.physical_samples[0].storage_position_id).toBe(1);
          expect(state.tables.physical_sample_events).toEqual([]);
     });

     it('does not permit a caller to omit the optimistic version', async () => {
          const { service, state } = database();
          await expect(service.store(10, { positionId: 1 } as any, 7)).rejects.toThrow();
          expect(state.tables.physical_samples[0].storage_position_id).toBeNull();
     });

     it('refuses an inactive storage position', async () => {
          const { service, state } = database();
          state.tables.specimen_storage_positions[0].is_active = 0;
          await expect(service.store(10, { expectedVersion: 1, positionId: 1 }, 7)).rejects.toThrow();
          expect(state.tables.physical_samples[0].storage_position_id).toBeNull();
          expect(state.tables.physical_sample_events).toEqual([]);
     });

     it('rolls back a custody change when recording its audit event fails', async () => {
          const { service, state } = database();
          state.failEvent = true;
          await expect(service.store(10, { expectedVersion: 1, positionId: 1 }, 7)).rejects.toThrow('Audit storage unavailable');
          expect(state.tables.physical_samples[0]).toMatchObject({ storage_state: 'available', storage_position_id: null, version: 1 });
     });

     it('does not resolve a specimen outside its tenant database', async () => {
          const { service, state } = database([]);
          await expect(service.store(10, { expectedVersion: 1, positionId: 1 }, 7)).rejects.toThrow();
          expect(KnexConnection).toHaveBeenCalledWith(42);
          expect(state.tables.physical_sample_events).toEqual([]);
     });
});

describe('retention and documented disposal', () => {
     const disposal = { expectedVersion: 1, method: 'Approved clinical waste process', reason: 'Retention completed', witnessEmployeeId: 8 };

     it('blocks early disposal unless both explicit override and administrative authority are present', async () => {
          const { service, state } = database([specimen({ retention_until: new Date('2099-01-01') })]);
          await expect(service.dispose(10, disposal, 7)).rejects.toThrow();
          await expect(service.dispose(10, { ...disposal, overrideRetention: true }, 7, false)).rejects.toThrow();
          await expect(service.dispose(10, disposal, 7, true)).rejects.toThrow();
          expect(state.tables.physical_sample_events).toEqual([]);
          await service.dispose(10, { ...disposal, overrideRetention: true }, 7, true);
          expect(state.tables.physical_samples[0].storage_state).toBe('disposed');
     });

     it.each([7, 9, 999])('requires an independent active laboratory witness (%s)', async witnessEmployeeId => {
          const { service, state } = database();
          await expect(service.dispose(10, { ...disposal, witnessEmployeeId }, 7)).rejects.toThrow();
          expect(state.tables.physical_samples[0].storage_state).toBe('available');
          expect(state.tables.physical_sample_events).toEqual([]);
     });

     it('rejects an inactive witness', async () => {
          const { service, state } = database();
          for (const table of ['roles', 'logins']) state.tables[table].find(row => row.employeeid === 8)!.activation = 0;
          await expect(service.dispose(10, disposal, 7)).rejects.toThrow();
          expect(state.tables.physical_sample_events).toEqual([]);
     });

     it.each([{ method: '' }, { reason: '  ' }, { method: 'x'.repeat(121) }, { reason: 'x'.repeat(2001) }])('requires bounded documentation %j', async invalid => {
          const { service, state } = database();
          await expect(service.dispose(10, { ...disposal, ...invalid }, 7)).rejects.toThrow();
          expect(state.tables.physical_samples[0].storage_state).toBe('available');
          expect(state.tables.physical_sample_events).toEqual([]);
     });

     it('records the method, reason, actor and witness, frees storage, and leaves disposal terminal', async () => {
          const { service, state } = database([specimen({ storage_state: 'stored', storage_position_id: 1, retention_until: new Date('2020-01-01') })]);
          await service.dispose(10, disposal, 7);
          expect(state.tables.physical_samples[0]).toMatchObject({ storage_state: 'disposed', storage_position_id: null, disposed_by: 7, disposal_method: disposal.method, disposal_reason: disposal.reason, disposal_witness_employeeid: 8, version: 2 });
          expect(state.tables.physical_samples[0].disposed_at).toBeInstanceOf(Date);
          expect(state.tables.physical_sample_events[0]).toMatchObject({ event_type: 'disposed', actor_employeeid: 7, reason: disposal.reason });
          await expect(service.store(10, { expectedVersion: 2, positionId: 1 }, 7)).rejects.toThrow();
          await expect(service.aliquot(10, { expectedVersion: 2, quantity: 0.1 }, 7)).rejects.toThrow();
          await expect(service.dispose(10, { ...disposal, expectedVersion: 2 }, 7)).rejects.toThrow();
          expect(state.tables.physical_sample_events).toHaveLength(1);
     });

     it.each([0, -1, 0.5, 36501])('rejects invalid retention period %s', async retentionDays => {
          const { service, state } = database();
          await expect(service.setRetention(10, { expectedVersion: 1, retentionDays, reason: 'Routine specimen retention policy' }, 7)).rejects.toThrow();
          expect(state.tables.physical_samples[0].retention_until).toBeNull();
     });

     it('persists a retention deadline and its audit event in the same transaction', async () => {
          const { service, state } = database();
          await service.setRetention(10, { expectedVersion: 1, retentionDays: 30, reason: 'Routine specimen retention policy' }, 7);
          const deadline = new Date(state.tables.physical_samples[0].retention_until).getTime();
          expect(deadline).toBeGreaterThan(Date.now() + 29 * 86400000);
          expect(deadline).toBeLessThanOrEqual(Date.now() + 31 * 86400000);
          expect(state.tables.physical_samples[0].version).toBe(2);
          expect(state.tables.physical_sample_events[0]).toMatchObject({ event_type: 'retention_updated', actor_employeeid: 7 });
     });

     it('rejects nonexistent calendar dates without silently rolling into the next month', async () => {
          vi.useFakeTimers();
          vi.setSystemTime(new Date('2026-10-22T12:00:00Z'));
          try {
               const { service, state } = database();
               await expect(service.setRetention(10, { expectedVersion: 1, retentionUntil: '2027-02-30T00:00:00Z', reason: 'Routine retention policy' }, 7)).rejects.toThrow();
               expect(state.tables.physical_samples[0]).toMatchObject({ retention_until: null, version: 1 });
               expect(state.tables.physical_sample_events).toEqual([]);
          } finally {
               vi.useRealTimers();
          }
     });

     it('replays a committed retention request after its original deadline passes without extending it', async () => {
          vi.useFakeTimers();
          vi.setSystemTime(new Date('2026-10-22T12:00:00Z'));
          try {
               const { service, state } = database();
               const input = { expectedVersion: 1, retentionUntil: '2026-10-24T12:00:00Z', reason: 'Routine retention policy', idempotencyKey: 'retention-fixed-date' };
               await service.setRetention(10, input, 7);
               const committed = structuredClone(state.tables);
               vi.setSystemTime(new Date('2026-10-25T12:00:00Z'));
               await expect(service.setRetention(10, input, 7)).resolves.toBeDefined();
               expect(state.tables).toEqual(committed);
          } finally {
               vi.useRealTimers();
          }
     });

     it('prevents an ordinary scientist from shortening retention to bypass early-disposal restrictions', async () => {
          const { service, state } = database([specimen({ retention_until: new Date('2099-12-31T12:00:00Z') })]);
          await expect(service.setRetention(10, { expectedVersion: 1, retentionUntil: '2099-01-01T12:00:00Z', reason: 'Shorten established policy' }, 7)).rejects.toMatchObject({ statusCode: 403 });
          expect(state.tables.physical_samples[0]).toMatchObject({ retention_until: new Date('2099-12-31T12:00:00Z'), version: 1 });
          expect(state.tables.physical_sample_events).toEqual([]);
     });

     it('allows an administrator-authorized retention reduction with its documented audit event', async () => {
          const { service, state } = database([specimen({ retention_until: new Date('2099-12-31T12:00:00Z') })]);
          await service.setRetention(10, { expectedVersion: 1, retentionUntil: '2099-01-01T12:00:00Z', reason: 'Approved retention policy correction' }, 7, true);
          expect(state.tables.physical_samples[0]).toMatchObject({ retention_until: new Date('2099-01-01T12:00:00Z'), version: 2 });
          expect(state.tables.physical_sample_events[0]).toMatchObject({ event_type: 'retention_updated', reason: 'Approved retention policy correction', actor_employeeid: 7 });
     });

     it('permits scientific staff to extend an existing retention deadline', async () => {
          const { service, state } = database([specimen({ retention_until: new Date('2099-01-01T12:00:00Z') })]);
          await service.setRetention(10, { expectedVersion: 1, retentionUntil: '2099-12-31T12:00:00Z', reason: 'Additional confirmatory testing requested' }, 7);
          expect(state.tables.physical_samples[0]).toMatchObject({ retention_until: new Date('2099-12-31T12:00:00Z'), version: 2 });
     });
});

describe('specimen worklist input validation', () => {
     it('lists collected and received material in bypassed facilities and keeps rejected stored containers discoverable', async () => {
          const statuses = ['planned', 'collection_started', 'collected', 'received', 'accepted', 'rejected', 'recollection_required'];
          const { service } = database(statuses.map((status, index) => specimen({ id: 10 + index, status })));
          const result = await service.worklist();
          expect(result.items.map((sample: Row) => sample.status)).toEqual(['collected', 'received', 'accepted', 'rejected', 'recollection_required']);
          expect(result.pagination).toMatchObject({ page: 1, count: 25, total: 5, totalPages: 1 });
     });

     it.each([
          { state: ['stored', 'disposed'] }, { retention: ['due'] }, { search: ['patient'] },
          { page: ['1'] }, { count: ['25'] }, { state: 'unknown' }, { retention: 'unknown' },
     ])('rejects ambiguous or unsupported filters %j', async filters => {
          const { service } = database();
          await expect(service.worklist(filters)).rejects.toMatchObject({ statusCode: 400 });
     });
});
