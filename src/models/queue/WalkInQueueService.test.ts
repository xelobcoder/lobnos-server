import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ connection: vi.fn(), profiles: vi.fn(), allowed: vi.fn(), standing: vi.fn(), publicTenant: vi.fn(), tenant: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('../public/PublicFacilityRegistry', () => ({ PublicFacilityRegistry: class { all = mocks.profiles; publicationAllowed = mocks.allowed; } }));
vi.mock('../Tenancy/tenancyRepo', () => ({ TenancyRepository: class { validateTenantStanding = mocks.standing; } }));
vi.mock('../Tenancy/TenantRegistry', () => ({ TenantRegistry: class { getTenant = mocks.tenant; } }));
vi.mock('../../middleware/resolveLoginTenant', () => ({ resolvePublicTenant: mocks.publicTenant }));

import { queueDate, resolveQueueFacility, WalkInQueueService } from './WalkInQueueService';
import { QUEUE_COUNTERS, QUEUE_EVENTS, QUEUE_SETTINGS, QUEUE_TICKETS } from './WalkInQueueBootstrapper';

type Row = Record<string, any>;
function database() {
     const state = { tables: {
          [QUEUE_SETTINGS]: [{ id: 1, public_enabled: 1, display_enabled: 1, ticket_prefix: 'Q', version: 1 }],
          [QUEUE_COUNTERS]: [], [QUEUE_TICKETS]: [], [QUEUE_EVENTS]: [],
          billing: [{ billingid: 100, patientid: 10 }, { billingid: 101, patientid: 11 }, { billingid: 102, patientid: 10, status: 'voided' }],
          new_patients: [{ patientid: 10 }, { patientid: 11 }], 'test_ascension': [],
     } as Record<string, Row[]>, failAudit: false, locks: [] as string[] };
     const value = (row: Row, key: string) => row[key.split('.').pop()!];
     const query: any = (name: string) => {
          const table = name.split(/\s+as\s+/i)[0];
          const filters: Array<(row: Row) => boolean> = [];
          let columns: string[] = [];
          let max = Infinity;
          let conflict: string | undefined;
          const rows = () => (state.tables[table] || []).filter(row => filters.every(filter => filter(row)));
          const selected = () => rows().slice(0, max).map(row => columns.length ? Object.fromEntries(columns.map(key => [key.split('.').pop()!, value(row, key)])) : structuredClone(row));
          const builder: any = {
               where: (input: Row | string, expected?: unknown) => {
                    const pairs = typeof input === 'string' ? [[input, expected]] : Object.entries(input);
                    for (const [key, val] of pairs) filters.push(row => String(value(row, key as string)) === String(val));
                    return builder;
               },
               whereIn: (key: string, values: unknown[]) => { filters.push(row => values.some(val => String(value(row, key)) === String(val))); return builder; },
               whereRaw: (sql: string, bindings: unknown[] = []) => {
                    if (sql === '(service.isDeleted = 0 OR service.isDeleted IS NULL)') filters.push(row => row.isDeleted == null || Number(row.isDeleted) === 0);
                    else if (sql === '(bill.status IS NULL OR bill.status <> ?)') filters.push(row => !bindings.includes(state.tables.billing.find(bill => Number(bill.billingid) === Number(row.billingid))?.status));
                    else if (sql === '(service.status IS NULL OR service.status NOT IN (?, ?, ?))') filters.push(row => !bindings.includes(row.serviceStatus));
                    else if (sql === '(service.paymentstatus IS NULL OR service.paymentstatus <> ?)') filters.push(row => !bindings.includes(row.paymentstatus));
                    else throw new Error('Unexpected queue SQL');
                    return builder;
               },
               forUpdate: () => { state.locks.push(table); return builder; },
               orderBy: () => builder,
               limit: (count: number) => { max = count; return builder; },
               select: (...keys: string[]) => { columns = keys; return builder; },
               leftJoin: () => builder,
               join: () => builder,
               first: async (...keys: string[]) => { if (keys.length) columns = keys; return selected()[0]; },
               update: async (changes: Row) => { const matching = rows(); matching.forEach(row => Object.assign(row, structuredClone(changes))); return matching.length; },
               insert: (input: Row) => {
                    const insertion: any = {
                         onConflict: (key: string) => { conflict = key; return insertion; },
                         ignore: async () => {
                              if (conflict && state.tables[table].some(row => String(row[conflict!]) === String(input[conflict!]))) return [];
                              return insert();
                         },
                         then: (resolve: any, reject: any) => Promise.resolve().then(insert).then(resolve, reject),
                    };
                    const insert = () => {
                         if (table === QUEUE_EVENTS && state.failAudit) throw new Error('Audit unavailable');
                         const id = Math.max(0, ...state.tables[table].map(row => Number(row.id) || 0)) + 1;
                         state.tables[table].push(structuredClone({ id, ...input }));
                         return [id];
                    };
                    return insertion;
               },
               then: (resolve: any, reject: any) => Promise.resolve(selected()).then(resolve, reject),
          };
          return builder;
     };
     query.fn = { now: () => new Date('2026-10-22T08:00:00Z') };
     let pending = Promise.resolve();
     query.transaction = (operation: (db: any) => Promise<unknown>) => {
          const work = pending.then(async () => {
               const previous = structuredClone(state.tables);
               try { return await operation(query); } catch (error) { state.tables = previous; throw error; }
          });
          pending = work.then(() => undefined, () => undefined);
          return work;
     };
     mocks.connection.mockResolvedValue(query);
     return { state, service: new WalkInQueueService(42), query };
}
const join = (suffix = 'a', overrides: Row = {}) => ({ name: `Walk-in ${suffix}`, phone: `024555${suffix === 'a' ? '0001' : suffix === 'b' ? '0002' : '0003'}`,
     idempotencyKey: `browser-retry-${suffix}`, ...overrides });

beforeEach(() => {
     vi.clearAllMocks();
     mocks.profiles.mockResolvedValue([{ slug: 'test-lab', tenantId: 42, name: 'Test Laboratory', published: true }]);
     mocks.allowed.mockResolvedValue(true); mocks.standing.mockResolvedValue(true);
     mocks.tenant.mockResolvedValue({ tenantId: 42, platformId: 'LAB042', name: 'Test Laboratory', isActive: true });
     mocks.publicTenant.mockImplementation(async code => String(code).toUpperCase() === 'LAB042' ? { tenantId: 42, platformId: 'LAB042', name: 'Test Laboratory', isActive: true } : null);
});

describe('queue public facility routing', () => {
     it('resolves a canonical active facility without a published catalog', async () => {
          mocks.profiles.mockResolvedValue([]);
          expect(await resolveQueueFacility('facility-lab042')).toEqual({ tenantId: 42, slug: 'facility-lab042', name: 'Test Laboratory' });
          expect(mocks.publicTenant).toHaveBeenCalledWith('lab042');
          expect(mocks.connection).not.toHaveBeenCalled();
     });
     it('supports approved directory slugs, refusing suspended or unpublished profiles', async () => {
          expect((await resolveQueueFacility('test-lab')).tenantId).toBe(42);
          mocks.allowed.mockResolvedValue(false);
          await expect(resolveQueueFacility('test-lab')).rejects.toMatchObject({ statusCode: 404 });
          mocks.profiles.mockResolvedValue([{ slug: 'test-lab', tenantId: 42, published: false }]);
          await expect(resolveQueueFacility('test-lab')).rejects.toMatchObject({ statusCode: 404 });
     });
     it.each(['42', '../42', '', 'facility-42', 'OTHER', 'a'.repeat(81)])('does not resolve arbitrary tenant input %s', async slug => {
          await expect(resolveQueueFacility(slug)).rejects.toMatchObject({ statusCode: 404 });
          expect(mocks.connection).not.toHaveBeenCalled();
     });
     it.each(['2026-02-30', 'yesterday', ['2026-10-22'], '2026-1-2'])('rejects invalid date %j', input => {
          expect(() => queueDate(input)).toThrow('Invalid queue date');
     });
});

describe('walk-in queue check-in', () => {
     it('issues serialized unique daily tickets and binds every read to the tenant connection', async () => {
          const { service, state } = database();
          const tickets = await Promise.all([service.join(join()), service.join(join('b'))]);
          expect(tickets.map(result => result.ticket.ticketNumber)).toEqual(['Q-001', 'Q-002']);
          expect(mocks.connection.mock.calls.every(call => call[0] === 42)).toBe(true);
          expect(state.locks).toContain(QUEUE_COUNTERS);
          expect(state.tables[QUEUE_EVENTS]).toHaveLength(2);
          expect(JSON.stringify(tickets)).not.toMatch(/Walk-in|024555|request_hash|idempotency_key/);
     });
     it('returns the same ticket for a network retry without consuming a new number', async () => {
          const { service, state } = database();
          const initial = await service.join(join());
          expect(await service.join(join())).toEqual(initial);
          expect(state.tables[QUEUE_COUNTERS][0].last_number).toBe(1);
          expect(state.tables[QUEUE_TICKETS]).toHaveLength(1);
          await expect(service.join(join('b', { idempotencyKey: join().idempotencyKey }))).rejects.toMatchObject({ statusCode: 409 });
     });
     it('avoids duplicate active check-ins but permits family members to share a phone', async () => {
          const { service } = database();
          await service.join(join());
          await expect(service.join(join('a', { idempotencyKey: 'another-browser-key' }))).rejects.toMatchObject({ statusCode: 409 });
          expect((await service.join(join('b', { phone: join().phone }))).ticket.ticketNumber).toBe('Q-002');
     });
     it.each([{ tenantId: 99 }, { name: '' }, { phone: 'invalid' }, { idempotencyKey: '' }, { name: 'a'.repeat(161) }, { name: 'A\u0000B' }])('rejects malformed or spoofed check-in %j', async overrides => {
          const { service, state } = database();
          await expect(service.join(join('a', overrides))).rejects.toMatchObject({ statusCode: 400 });
          expect(state.tables[QUEUE_TICKETS]).toHaveLength(0);
     });
     it('honors closure and capacity without allocating a ticket', async () => {
          const { service, state } = database();
          state.tables[QUEUE_SETTINGS][0].public_enabled = 0;
          await expect(service.join(join())).rejects.toMatchObject({ statusCode: 403 });
          state.tables[QUEUE_SETTINGS][0].public_enabled = 1;
          state.tables[QUEUE_COUNTERS].push({ queue_date: queueDate(), last_number: 2000 });
          await expect(service.join(join())).rejects.toMatchObject({ statusCode: 429 });
          expect(state.tables[QUEUE_TICKETS]).toHaveLength(0);
     });
     it('rolls back the allocated number and ticket if its audit cannot be written', async () => {
          const { service, state } = database();
          state.failAudit = true;
          await expect(service.join(join())).rejects.toThrow('Audit unavailable');
          expect(state.tables[QUEUE_TICKETS]).toHaveLength(0);
          expect(state.tables[QUEUE_COUNTERS]).toHaveLength(0);
     });
});

describe('queue staff workflow and privacy', () => {
     it('calls and serves a ticket with optimistic concurrency and staff audit', async () => {
          const { service, state } = database();
          const { ticket } = await service.join(join());
          const called = await service.update(ticket.id, { expectedVersion: 1, status: 'called', counter: 'Reception 1' }, 7);
          expect(called.ticket).toMatchObject({ name: 'Walk-in a', status: 'called', counter: 'Reception 1', version: 2 });
          await expect(service.update(ticket.id, { expectedVersion: 1, status: 'serving' }, 7)).rejects.toMatchObject({ statusCode: 409 });
          await service.update(ticket.id, { expectedVersion: 2, status: 'serving' }, 7);
          expect(state.tables[QUEUE_EVENTS][1]).toMatchObject({ actor_employeeid: 7, action: 'ticket_updated' });
          await expect(service.update(ticket.id, { expectedVersion: 3, status: 'fake' }, 7)).rejects.toMatchObject({ statusCode: 409 });
     });
     it('links only a real billing record belonging to the selected patient', async () => {
          const { service } = database();
          const { ticket } = await service.join(join());
          await expect(service.update(ticket.id, { expectedVersion: 1, billingid: 999 }, 7)).rejects.toMatchObject({ statusCode: 404 });
          await expect(service.update(ticket.id, { expectedVersion: 1, billingid: 100, patientid: 11 }, 7)).rejects.toMatchObject({ statusCode: 409 });
          const linked = await service.update(ticket.id, { expectedVersion: 1, billingid: 100 }, 7);
          expect(linked.ticket).toMatchObject({ patientid: 10, billingid: 100, version: 2 });
          await expect(service.update(ticket.id, { expectedVersion: 2, patientid: null }, 7)).rejects.toMatchObject({ statusCode: 409 });
     });
     it('rejects voided bill links and stops counting tests when an already-linked bill is voided', async () => {
          const { service, state } = database();
          const { ticket } = await service.join(join());
          await expect(service.update(ticket.id, { expectedVersion: 1, billingid: 102 }, 7)).rejects.toMatchObject({ statusCode: 409 });
          await service.update(ticket.id, { expectedVersion: 1, billingid: 100, status: 'serving' }, 7);
          state.tables.test_ascension = [{ id: 1, billingid: 100, resultEntryEnd: null }];
          state.tables.billing.find(bill => bill.billingid === 100)!.status = 'voided';
          const board = await service.list();
          expect(board.tickets[0]).toMatchObject({ testsTotal: 0, testsCompleted: 0, testsValidated: 0 });
          await expect(service.update(ticket.id, { expectedVersion: 2, status: 'completed' }, 7)).rejects.toMatchObject({ statusCode: 409 });
          expect((await service.update(ticket.id, { expectedVersion: 2, status: 'cancelled' }, 7)).ticket.status).toBe('cancelled');
     });
     it('counts distinct actual test completion and validation, and keeps pending tests visible', async () => {
          const { service, state } = database();
          state.tables.test_ascension = [
               { id: 1, billingid: 100, resultEntryEnd: '2026-10-22', isapproved: 1 },
               { id: 1, billingid: 100, resultEntryEnd: '2026-10-22', isapproved: 1 },
               { id: 2, billingid: 100, resultEntryEnd: '2026-10-22', isapproved: 0 },
               { id: 3, billingid: 100, resultEntryEnd: null, isapproved: 1 },
               { id: 4, billingid: 100, resultEntryEnd: null, isapproved: 0, isDeleted: 1 },
               { id: 5, billingid: 100, resultEntryEnd: null, serviceStatus: 'cancelled' },
               { id: 6, billingid: 100, resultEntryEnd: null, serviceStatus: 'voided' },
               { id: 7, billingid: 100, resultEntryEnd: '2026-10-22', isapproved: 1, serviceStatus: 'refunded' },
               { id: 8, billingid: 100, resultEntryEnd: null, paymentstatus: 'refunded' },
          ];
          const { ticket } = await service.join(join());
          const linked = await service.update(ticket.id, { expectedVersion: 1, status: 'serving', billingid: 100 }, 7);
          expect(linked.ticket).toMatchObject({ testsTotal: 3, testsCompleted: 2, testsValidated: 1 });
          await expect(service.update(ticket.id, { expectedVersion: 2, status: 'completed' }, 7)).rejects.toMatchObject({ statusCode: 409 });
          const display = await service.list(undefined, false, { slug: 'facility-lab042', name: 'Test Laboratory' });
          expect(display.tickets[0]).toMatchObject({ ticketNumber: 'Q-001', status: 'serving', testsTotal: 3, testsCompleted: 2, testsValidated: 1 });
          expect(display.summary).toMatchObject({ total: 1, serving: 1 });
          expect(JSON.stringify(display)).not.toMatch(/Walk-in a|024555|patientid|billingid|notes|version|request_hash/);
          expect(display.tickets[0]).not.toHaveProperty('id');
     });
     it('does not reopen closed tickets or silently skip queue stages', async () => {
          const { service } = database();
          const { ticket } = await service.join(join());
          await expect(service.update(ticket.id, { expectedVersion: 1, status: 'completed' }, 7)).rejects.toMatchObject({ statusCode: 409 });
          await service.update(ticket.id, { expectedVersion: 1, status: 'cancelled' }, 7);
          await expect(service.update(ticket.id, { expectedVersion: 2, status: 'waiting' }, 7)).rejects.toMatchObject({ statusCode: 409 });
     });
     it('keeps settings versioned and can independently disable the public display', async () => {
          const { service, state } = database();
          expect((await service.getSettings()).facility?.slug).toBe('facility-lab042');
          const updated = await service.updateSettings({ expectedVersion: 1, publicEnabled: true, displayEnabled: false, ticketPrefix: 'LAB' }, 7);
          expect(updated.settings).toMatchObject({ publicEnabled: true, displayEnabled: false, ticketPrefix: 'LAB', version: 2 });
          await expect(service.list(undefined, false)).rejects.toMatchObject({ statusCode: 403 });
          await expect(service.updateSettings({ expectedVersion: 1, publicEnabled: true, displayEnabled: true, ticketPrefix: 'Q' }, 7)).rejects.toMatchObject({ statusCode: 409 });
          expect(state.tables[QUEUE_EVENTS][0].action).toBe('settings_updated');
     });
     it('rolls back staff changes when auditing fails', async () => {
          const { service, state } = database();
          const { ticket } = await service.join(join());
          state.failAudit = true;
          await expect(service.update(ticket.id, { expectedVersion: 1, status: 'called' }, 7)).rejects.toThrow('Audit unavailable');
          expect(state.tables[QUEUE_TICKETS][0]).toMatchObject({ status: 'waiting', version: 1 });
     });
});
