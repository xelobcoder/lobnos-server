import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock('../../../database/KnexConnections', () => ({ default: mock.connect }));
import { PackageConfiguration, configurationRevision } from './PackageConfiguration';

// An in-memory transaction adapter exercises the service's replacement/rollback contract.
function database() {
    let tables: any = { packages: [{ id: 8, package_name: 'Old package' }], test_panels: [{ id: 1, name: 'A', price: 100 }, { id: 2, name: 'B', price: 50 }], organization: [{ id: 3, name: 'Company' }], package_tests: [{ package_id: 8, test_id: 1, concession_mode: 'none', concession_value: 0 }, { package_id: 8, test_id: 2, concession_mode: 'none', concession_value: 0 }], package_assignments: [{ package_id: 8, assignment_type: 'organization', organization_id: 3 }, { package_id: 8, assignment_type: 'clinician', clinician_id: 9 }] };
    let fail = false;
    function connection(state: any): any {
        const conn: any = (source: string) => {
            const table = source.split(' as ')[0]; let filters: ((row: any) => boolean)[] = [];
            const rows = () => state[table].filter((r: any) => filters.every(f => f(r)));
            const query: any = {
                where(key: any, value?: any) { const values = typeof key === 'object' ? key : { [key]: value }; for (const [k,v] of Object.entries(values)) filters.push(r => r[k.split('.').pop()!] === v); return query; },
                whereIn(key: string, values: any[]) { filters.push(r => values.includes(r[key])); return query; },
                forUpdate() { return query; }, join() { return query; },
                first: async () => rows()[0],
                select: async () => rows().map((r: any) => source.includes(' as pt') ? { ...r, ...state.test_panels.find((p: any) => p.id === r.test_id) } : source.includes(' as pa') ? state.organization.find((o: any) => o.id === r.organization_id) : r),
                update: async (patch: any) => { rows().forEach((r: any) => Object.assign(r, patch)); return rows().length; },
                del: async () => { state[table] = state[table].filter((r: any) => !rows().includes(r)); },
                insert: async (records: any) => { if (fail && table === 'package_assignments') throw Error('Storage unavailable'); state[table].push(...(Array.isArray(records) ? records : [{ ...records, id: 10 }])); return [10]; },
            }; return query;
        };
        conn.fn = { now: () => 'now' };
        conn.transaction = async (callback: any) => { const draft = structuredClone(tables); const result = await callback(connection(draft)); tables = draft; return result; };
        return conn;
    }
    return { connect: () => connection(tables), snapshot: () => structuredClone(tables), failInsert: () => { fail = true; } };
}
describe('Package configuration persistence', () => {
    let db: ReturnType<typeof database>, service: PackageConfiguration;
    beforeEach(() => { db = database(); mock.connect.mockImplementation(async () => db.connect()); service = new PackageConfiguration(1); });
    const draft = { package_name: 'New package', tests: [{ test_id: 1, concession_mode: 'absolute', concession_value: 100 }], organizationIds: [] };
    it('stores price edits, test removals and organization removals while preserving clinician assignments', async () => {
        const current = await service.get(8); const saved = await service.save(4, { ...draft, expectedRevision: current.revision }, 8);
        expect(saved.tests).toHaveLength(1); expect(saved.tests[0].concession_value).toBe(100); expect(saved.organizations).toEqual([]);
        expect(db.snapshot().package_assignments).toEqual([{ package_id: 8, assignment_type: 'clinician', clinician_id: 9 }]);
    });
    it('rejects a stale draft without mutating stored configuration', async () => {
        const before = db.snapshot(); await expect(service.save(4, { ...draft, expectedRevision: 'old' }, 8)).rejects.toThrow('changed'); expect(db.snapshot()).toEqual(before);
    });
    it('rolls back name and test changes if organization persistence fails', async () => {
        const current = await service.get(8), before = db.snapshot(); db.failInsert();
        await expect(service.save(4, { ...draft, organizationIds: [3], expectedRevision: current.revision }, 8)).rejects.toThrow('Storage unavailable'); expect(db.snapshot()).toEqual(before);
    });
    it('rejects nonexistent organizations and invalid discounts before writing', async () => {
        const current = await service.get(8), before = db.snapshot();
        await expect(service.save(4, { ...draft, organizationIds: [999], expectedRevision: current.revision }, 8)).rejects.toThrow('organizations');
        await expect(service.save(4, { ...draft, tests: [{ test_id: 1, concession_mode: 'percentage', concession_value: 101 }], expectedRevision: current.revision }, 8)).rejects.toThrow('discount'); expect(db.snapshot()).toEqual(before);
    });
    it('does not mark reordered selections as a conflicting revision', () => {
        const record = { package_name: 'P', tests: [{ test_id: 1, price: 100 }, { test_id: 2, price: 20 }], organizations: [{ id: 3 }, { id: 4 }] };
        expect(configurationRevision(record)).toBe(configurationRevision({ ...record, tests: [...record.tests].reverse(), organizations: [...record.organizations].reverse() }));
    });
});
