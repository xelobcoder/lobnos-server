import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Knex } from 'knex';

const mocks = vi.hoisted(() => ({
     randomInt: vi.fn(),
     config: { defaultTenantId: 3, isMultiTenant: true, masterControlDatabase: 'test' },
}));
vi.mock('crypto', async (original) => ({
     ...await original<typeof import('crypto')>(), randomInt: mocks.randomInt,
}));
vi.mock('../../database/connection', () => ({ singleTenantKnexInstance: {}, systemConfigConnection: {} }));
vi.mock('../../hooks/configuration', () => ({ configuration: mocks.config }));
vi.mock('../../hooks/logger', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { RegisteredTenant, TenantRegistry } from './TenantRegistry';

describe('organization registry login mapping and six-digit tenant IDs', () => {
     beforeEach(() => {
          vi.restoreAllMocks();
          mocks.randomInt.mockReset();
          mocks.config.defaultTenantId = 3;
          vi.spyOn(TenantRegistry, 'ensureReady').mockResolvedValue(undefined);
     });

     it('maps the public identifier to its distinct internal tenant ID', async () => {
          const registry = new TenantRegistry();
          vi.spyOn(registry, 'listTenants').mockResolvedValue([
               { platformId: 'PLS20154', tenantId: 397773 } as RegisteredTenant,
               { platformId: 'PLS20155', tenantId: 827461 } as RegisteredTenant,
          ]);
          expect(await registry.getByOrganizationIdentifier('pls20154')).toMatchObject({ tenantId: 397773 });
          expect(await registry.getByOrganizationIdentifier('PLS20156')).toBeNull();
          expect(await registry.getByOrganizationIdentifier('397773')).toBeNull();
     });

     it('runs legacy-ID migration during registry preparation before declaring readiness', async () => {
          const registry = new TenantRegistry();
          const order: string[] = [];
          registry['ensureSchema'] = vi.fn(async () => { order.push('schema'); });
          registry['removeLegacyLoginDirectory'] = vi.fn(async () => { order.push('directory'); });
          registry['registerLocalTenant'] = vi.fn(async () => { order.push('local'); });
          registry['assignMissingTenantNumbers'] = vi.fn(async () => { order.push('missing'); });
          registry['migrateShortTenantNumbers'] = vi.fn(async () => { order.push('migration'); return []; });
          registry['assignMissingFacilityCodes'] = vi.fn(async () => { order.push('codes'); });

          await registry['prepare']();

          expect(order).toEqual(['schema', 'directory', 'local', 'missing', 'migration', 'codes']);
          // Calling the ready gate from inside preparation would deadlock on itself.
          expect(TenantRegistry.ensureReady).not.toHaveBeenCalled();
     });

     it('propagates automatic migration errors rather than reporting registry readiness', async () => {
          const registry = new TenantRegistry();
          registry['ensureSchema'] = vi.fn(async () => {});
          registry['removeLegacyLoginDirectory'] = vi.fn(async () => {});
          registry['registerLocalTenant'] = vi.fn(async () => {});
          registry['assignMissingTenantNumbers'] = vi.fn(async () => {});
          registry['migrateShortTenantNumbers'] = vi.fn(async () => { throw new Error('Database unavailable'); });
          registry['assignMissingFacilityCodes'] = vi.fn(async () => {});

          await expect(registry['prepare']()).rejects.toThrow('Database unavailable');
          expect(registry['assignMissingFacilityCodes']).not.toHaveBeenCalled();
     });

     it('allocates true six-digit numbers, retries occupied numbers, and preserves public identifiers', async () => {
          const rows = [
               { id: 'PLS20154', tenant_number: 3 },
               { id: 'PLS20155', tenant_number: 4 },
               { id: 'EXISTING', tenant_number: 123456 },
          ];
          mocks.randomInt.mockReturnValueOnce(123456).mockReturnValueOnce(654321).mockReturnValueOnce(827461);
          const db = ((table: string) => {
               expect(table).toBe('prime_tenants');
               const filters: Array<(row: typeof rows[number]) => boolean> = [];
               const query = {
                    where: (condition: Record<string, unknown> | string, operator?: string, value?: number) => {
                         if (typeof condition === 'string') filters.push((row) => operator === '<' && row.tenant_number < value!);
                         else filters.push((row) => Object.entries(condition).every(([key, item]) => row[key as keyof typeof row] === item));
                         return query;
                    },
                    select: async (..._columns: string[]) => rows.filter((row) => filters.every((filter) => filter(row))).map((row) => ({ ...row })),
                    first: async (_column: string) => rows.find((row) => filters.every((filter) => filter(row))),
                    update: async (changes: { tenant_number: number }) => {
                         const matched = rows.filter((row) => filters.every((filter) => filter(row)));
                         matched.forEach((row) => Object.assign(row, changes));
                         return matched.length;
                    },
               };
               return query;
          }) as unknown as Knex;
          const registry = new TenantRegistry(db);
          expect(await registry.migrateLegacyTenantNumbers()).toEqual([
               { organizationIdentifier: 'PLS20154', oldTenantId: 3, tenantId: 654321 },
               { organizationIdentifier: 'PLS20155', oldTenantId: 4, tenantId: 827461 },
          ]);
          expect(mocks.randomInt).toHaveBeenCalledWith(100000, 1000000);
          expect(rows.map((row) => row.id)).toEqual(['PLS20154', 'PLS20155', 'EXISTING']);
          expect(new Set(rows.map((row) => row.tenant_number)).size).toBe(3);
          expect(rows.every((row) => row.tenant_number >= 100000 && row.tenant_number <= 999999)).toBe(true);
          expect(mocks.config.defaultTenantId).toBe(654321);
          expect(await registry.migrateLegacyTenantNumbers()).toEqual([]);
     });
});

describe('registry cache invalidation during status changes', () => {
     it('does not cache a refresh that started before invalidate (e.g. a concurrent suspension)', async () => {
          vi.spyOn(TenantRegistry, 'ensureReady').mockResolvedValue(undefined);
          TenantRegistry.invalidate();
          let release!: () => void;
          let status = 'active';
          const row = () => ({ id: 'NRAM11', tenant_number: 654321, status, company_name: 'Lab', database_name: 'PLS654321' });
          let calls = 0;
          const db = ((_table: string) => {
               let missingNumbers = false;
               const query: any = {
                    whereNull: () => { missingNumbers = true; return query; }, orderBy: () => query, whereNotNull: () => query,
                    select: async () => {
                         if (missingNumbers) return [];
                         calls++;
                         const snapshot = [row()]; // read before the status change commits
                         if (calls === 1) await new Promise<void>((resolve) => { release = resolve; });
                         return snapshot;
                    },
               };
               return query;
          }) as unknown as Knex;
          const registry = new TenantRegistry(db);
          const stale = registry.listTenants();
          await vi.waitFor(() => expect(calls).toBe(1));
          status = 'suspended';
          TenantRegistry.invalidate();
          release();
          expect((await stale)[0].isActive).toBe(true); // the in-flight caller still sees its own snapshot
          const fresh = await registry.listTenants();
          expect(fresh[0]).toMatchObject({ status: 'suspended', isActive: false });
     });
});