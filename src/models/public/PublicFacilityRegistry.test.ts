import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
     tables: {} as Record<string, any[]>, tenant: vi.fn(), connection: vi.fn(), duplicate: false, auditFailure: false,
}));
vi.mock('../../database/connection', () => {
     const db: any = (table: string) => {
          const filters: Record<string, unknown>[] = [];
          const rows = () => (state.tables[table] || []).filter(row =>
               filters.every(filter => Object.entries(filter).every(([key, value]) => row[key] === value)));
          const query: any = {
               where: (filter: any) => { filters.push(filter); return query; },
               select: () => query, forUpdate: () => query, first: async () => rows()[0],
               insert: async (value: any) => {
                    if (table === 'public_facility_profiles' && state.duplicate) throw Object.assign(new Error('synthetic duplicate'), { code: 'ER_DUP_ENTRY' });
                    if (table === 'public_facility_profile_audit' && state.auditFailure) throw new Error('synthetic audit failure');
                    (state.tables[table] ||= []).push(value); return [1];
               },
               update: async (value: any) => { rows().forEach(row => Object.assign(row, value)); return rows().length; },
               then: (resolve: any, reject: any) => Promise.resolve(rows()).then(resolve, reject),
          };
          return query;
     };
     db.fn = { now: () => 'NOW' };
     db.transaction = async (callback: any) => {
          const snapshot = structuredClone(state.tables);
          try { return await callback(db); }
          catch (error) { state.tables = snapshot; throw error; }
     };
     return { systemConfigConnection: db };
});
vi.mock('../../database/KnexConnections', () => ({ default: state.connection }));
vi.mock('../Tenancy/TenantRegistry', () => ({
     TENANTS_TABLE: 'prime_tenants',
     TenantRegistry: class { requireTenant = state.tenant; },
}));
vi.mock('../Tenancy/tenancyRepo', () => ({
     TenancyRepository: class { validateTenantStanding = async () => true; },
}));

import { configuration } from '../../hooks/configuration';
import { PublicFacilityRegistry } from './PublicFacilityRegistry';
import { PublicFacilityCatalog } from './PublicFacilityCatalog';

const profile = {
     slug: 'synthetic-lab', name: 'Synthetic laboratory', region: 'Region', locality: 'Town',
     description: 'Public description', currency: 'GHS', published: true, catalogPublished: true,
     facilityLoginUrl: 'https://lab.example/login',
};
const actor = { tenantId: 99, employeeId: 9 };

beforeEach(() => {
     configuration.isMultiTenant = true;
     vi.stubEnv('PUBLIC_FACILITY_DIRECTORY_JSON', '');
     state.tables = { prime_tenants: [{ tenant_number: 7, status: 'active' }, { tenant_number: 8, status: 'active' }],
          public_facility_profiles: [], public_facility_profile_audit: [], marketplace_facilities: [] };
     state.tenant.mockReset().mockResolvedValue({ isActive: true });
     state.connection.mockReset();
     state.duplicate = false;
     state.auditFailure = false;
});

describe('admin-managed public facility registry', () => {
     it('has no automatic publication permission and exposes no fabricated destination', async () => {
          expect(await new PublicFacilityCatalog().list()).toEqual({ facilities: [] });
          const result = await new PublicFacilityRegistry().put(7, { ...profile, facilityLoginUrl: undefined }, actor);
          expect(result.profile.facilityLoginUrl).toBeUndefined();
          expect((await new PublicFacilityCatalog().list()).facilities[0]).not.toHaveProperty('tenantId');
          expect(state.connection).not.toHaveBeenCalled();
     });
     it('persists explicit approvals and audit atomically for the path tenant only', async () => {
          const result = await new PublicFacilityRegistry().put(7, profile, actor);
          expect(result.profile).toMatchObject({ tenantId: 7, ...profile, panelIds: [] });
          expect(await new PublicFacilityRegistry().get(8)).toEqual({ profile: null });
          expect(state.tables.public_facility_profile_audit[0]).toMatchObject({ tenant_id: 7, actor_tenant_id: 99, actor_employee_id: 9 });
     });
     it('uses only stored profiles even if an environment entry exists', async () => {
          vi.stubEnv('PUBLIC_FACILITY_DIRECTORY_JSON', JSON.stringify([{ ...profile, tenantId: 7 }]));
          expect(await new PublicFacilityCatalog().list()).toEqual({ facilities: [] });
          await new PublicFacilityRegistry().put(7, profile, actor);
          expect((await new PublicFacilityCatalog().list()).facilities).toHaveLength(1);
          await new PublicFacilityRegistry().put(7, { ...profile, published: false, catalogPublished: false }, actor);
          expect(await new PublicFacilityCatalog().list()).toEqual({ facilities: [] });
     });
     it.each([
          { published: undefined }, { catalogPublished: undefined }, { tenantId: 8 }, { currency: 'ghs' },
          { facilityLoginUrl: 'http://lab.example/login' }, { facilityLoginUrl: 'https://lab.example/login?token=synthetic' },
          { panelIds: [1, 1] }, { panelIds: ['1'] },
     ])('rejects unsafe or unauthorized profile values %j', async changes => {
          await expect(new PublicFacilityRegistry().put(7, { ...profile, ...changes }, actor)).rejects.toMatchObject({ statusCode: 400 });
          expect(state.tables.public_facility_profiles).toEqual([]);
     });
     it('refuses publication of inactive tenants and catalog publication without facility publication', async () => {
          state.tables.prime_tenants[0].status = 'suspended';
          await expect(new PublicFacilityRegistry().put(7, profile, actor)).rejects.toMatchObject({ statusCode: 409 });
          await expect(new PublicFacilityRegistry().put(7, { ...profile, published: false }, actor)).rejects.toMatchObject({ statusCode: 400 });
     });
     it('never overwrites another tenant on a slug collision, including a concurrent unique-index conflict', async () => {
          await new PublicFacilityRegistry().put(7, profile, actor);
          await expect(new PublicFacilityRegistry().put(8, profile, actor)).rejects.toMatchObject({ statusCode: 409 });
          state.duplicate = true;
          await expect(new PublicFacilityRegistry().put(8, { ...profile, slug: 'second-lab' }, actor)).rejects.toMatchObject({ statusCode: 409 });
          expect(state.tables.public_facility_profiles).toHaveLength(1);
          expect(state.tables.public_facility_profiles[0].tenant_id).toBe(7);
     });
     it('rolls back publication if its audit cannot be recorded', async () => {
          state.auditFailure = true;
          await expect(new PublicFacilityRegistry().put(7, profile, actor)).rejects.toThrow('synthetic audit failure');
          expect(state.tables.public_facility_profiles).toEqual([]);
     });
     it('hides linked suspended facilities and refuses mismatching application slugs', async () => {
          await new PublicFacilityRegistry().put(7, profile, actor);
          state.tables.marketplace_facilities = [{ linked_tenant_id: 7, slug: profile.slug, status: 'suspended', integration_state: 'linked' }];
          expect(await new PublicFacilityCatalog().list()).toEqual({ facilities: [] });
          await expect(new PublicFacilityRegistry().put(7, profile, actor)).rejects.toMatchObject({ statusCode: 409 });
          state.tables.marketplace_facilities[0].status = 'approved';
          await expect(new PublicFacilityRegistry().put(7, { ...profile, slug: 'wrong-lab' }, actor)).rejects.toMatchObject({ statusCode: 409 });
     });
     it('validates panel IDs against configured tariffs in the exact target tenant', async () => {
          const query = { whereIn: vi.fn().mockReturnThis(), whereExists: vi.fn().mockReturnThis(),
               select: vi.fn().mockResolvedValue([{ id: 12 }]) };
          const details = { select: vi.fn().mockReturnThis(), whereRaw: vi.fn().mockReturnThis() };
          state.connection.mockResolvedValue(Object.assign((table: string) => table.startsWith('test_panels') ? query : details, { raw: vi.fn() }));
          await new PublicFacilityRegistry().put(7, { ...profile, panelIds: [12] }, actor);
          expect(state.connection).toHaveBeenCalledWith(7);
          query.select.mockResolvedValue([]);
          await expect(new PublicFacilityRegistry().put(8, { ...profile, slug: 'second-lab', panelIds: [12] }, actor)).rejects.toMatchObject({ statusCode: 400 });
     });
});
