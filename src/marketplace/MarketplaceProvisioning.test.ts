import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
     tables: {} as Record<string, any[]>, profiles: [] as any[], provision: vi.fn(), retry: vi.fn(),
}));
vi.mock('../database/connection', () => {
     const db: any = (table: string) => {
          const filters: Record<string, unknown>[] = [];
          const rows = () => (state.tables[table] || []).filter(row =>
               filters.every(filter => Object.entries(filter).every(([key, value]) => row[key] === value)));
          const query: any = {
               where: (filter: any) => { filters.push(filter); return query; },
               forUpdate: () => query, select: () => query,
               first: async () => rows()[0],
               update: async (values: any) => { rows().forEach(row => Object.assign(row, values)); return rows().length; },
               insert: async (values: any) => { (state.tables[table] ||= []).push(values); return [1]; },
               then: (resolve: any, reject: any) => Promise.resolve(rows()).then(resolve, reject),
          };
          return query;
     };
     db.transaction = async (callback: any) => {
          const snapshot = structuredClone(state.tables);
          try { return await callback(db); }
          catch (error) { state.tables = snapshot; throw error; }
     };
     return { systemConfigConnection: db };
});
vi.mock('../models/public/PublicFacilityRegistry', () => ({
     PublicFacilityRegistry: class { all = async () => state.profiles; },
}));
vi.mock('../models/public/PublicFacilityCatalog', () => ({
     PublicFacilityCatalog: class {},
     PublicCatalogError: class extends Error {},
}));
vi.mock('../models/Tenancy/FacilityProvisioningService', () => ({
     FacilityProvisioningService: class { provision = state.provision; retry = state.retry; },
}));

import { MarketplaceService } from './MarketplaceService';
import { systemConfigConnection } from '../database/connection';
import { FacilityError } from '../models/Tenancy/FacilityInput';

const input = {
     identityConfirmed: true, companyName: 'Synthetic lab', email: 'lab@example.test',
     phone: '0201234567', address: 'Synthetic address', countryId: 1, stateId: 2, districtId: 3,
     adminName: 'Synthetic admin', adminEmail: 'admin@example.test', adminPassword: 'synthetic-long-password',
};
const actor = { tenantId: 99, employeeId: 9 };
const provisioned = { tenantId: 1234, organizationIdentifier: 'SYN1', databaseName: 'primetenant1234', adminUsername: 'syn-admin' };

beforeEach(() => {
     state.tables = {
          marketplace_facilities: [{ id: 1, slug: 'synthetic-lab', status: 'approved', integration_state: 'independent', linked_tenant_id: null }],
          marketplace_catalog_items: [], marketplace_bookings: [], marketplace_audit: [],
     };
     state.profiles = [];
     state.provision.mockReset();
     state.retry.mockReset();
     state.provision.mockImplementation(async (_input, _actor, activate) => {
          await systemConfigConnection.transaction(async trx => activate(trx, provisioned));
          return provisioned;
     });
     state.retry.mockImplementation(async (_tenantId, _input, _actor, activate) => {
          await systemConfigConnection.transaction(async trx => activate(trx, provisioned));
          return provisioned;
     });
});

describe('controlled marketplace provisioning', () => {
     it('validates the existing core payload, then links only inside the final activation transaction', async () => {
          const result = await new MarketplaceService().provisionFacility('1', input, actor);
          expect(result).toEqual({ facilityId: 1, slug: 'synthetic-lab', integrationState: 'linked', ...provisioned });
          expect(state.provision).toHaveBeenCalledWith(expect.objectContaining({ companyName: input.companyName }), actor, expect.any(Function));
          expect(state.tables.marketplace_facilities[0]).toMatchObject({ status: 'approved', integration_state: 'linked', linked_tenant_id: 1234 });
          expect(state.tables.marketplace_audit.map(row => row.event_type)).toEqual(['facility_provisioning_started', 'facility_provisioned_and_linked']);
          expect(JSON.stringify(state.tables.marketplace_audit)).not.toContain(input.adminPassword);
     });
     it.each(['pending', 'suspended'])('never approves or provisions a %s application', async status => {
          state.tables.marketplace_facilities[0].status = status;
          await expect(new MarketplaceService().provisionFacility(1, input, actor)).rejects.toMatchObject({ statusCode: 409 });
          expect(state.provision).not.toHaveBeenCalled();
          expect(state.tables.marketplace_facilities[0].status).toBe(status);
     });
     it.each(['marketplace_catalog_items', 'marketplace_bookings'])('refuses unsafe history migration from %s', async table => {
          state.tables[table].push({ id: 5, facility_id: 1 });
          await expect(new MarketplaceService().provisionFacility(1, input, actor)).rejects.toMatchObject({ statusCode: 409 });
          expect(state.provision).not.toHaveBeenCalled();
     });
     it('requires explicit identity confirmation and validates before claiming an application', async () => {
          await expect(new MarketplaceService().provisionFacility(1, { ...input, identityConfirmed: false }, actor)).rejects.toMatchObject({ statusCode: 400 });
          await expect(new MarketplaceService().provisionFacility(1, { ...input, countryId: '../1' }, actor)).rejects.toMatchObject({ statusCode: 400 });
          expect(state.tables.marketplace_audit).toEqual([]);
          expect(state.provision).not.toHaveBeenCalled();
     });
     it('directs existing public slug identities to the reviewed link workflow', async () => {
          state.profiles = [{ slug: 'synthetic-lab', tenantId: 1234 }];
          await expect(new MarketplaceService().provisionFacility(1, input, actor)).rejects.toMatchObject({ statusCode: 409 });
          expect(state.provision).not.toHaveBeenCalled();
     });
     it('blocks duplicate attempts after a durable provisioning claim', async () => {
          state.tables.marketplace_facilities[0].integration_state = 'provisioning';
          await expect(new MarketplaceService().provisionFacility(1, input, actor)).rejects.toMatchObject({ statusCode: 409 });
          expect(state.provision).not.toHaveBeenCalled();
     });
     it('retains failure state for operator review, never silently retrying DDL', async () => {
          state.provision.mockRejectedValue(new FacilityError('Synthetic preflight unavailable', 503));
          await expect(new MarketplaceService().provisionFacility(1, input, actor)).rejects.toMatchObject({ statusCode: 503 });
          expect(state.tables.marketplace_facilities[0]).toMatchObject({ integration_state: 'provision_failed', linked_tenant_id: null });
          await expect(new MarketplaceService().provisionFacility(1, input, actor)).rejects.toMatchObject({ statusCode: 409 });
          expect(state.provision).toHaveBeenCalledTimes(1);
     });
     it('retries and relinks the failed tenant reserved by the original attempt', async () => {
          state.tables.marketplace_facilities[0].integration_state = 'provision_failed';
          state.tables.marketplace_facilities[0].linked_tenant_id = 1234;
          state.tables.marketplace_facilities[0].name = input.companyName;
          state.tables.marketplace_facilities[0].contact_email = input.email;
          state.tables.prime_tenants = [{
               tenant_number: 1234, status: 'failed', company_name: input.companyName, email: input.email,
          }];
          const result = await new MarketplaceService().retryFacilityProvisioning(1, input, actor);
          expect(state.retry).toHaveBeenCalledWith(1234, expect.objectContaining({ companyName: input.companyName }),
               actor, expect.any(Function));
          expect(state.provision).not.toHaveBeenCalled();
          expect(result).toMatchObject({ facilityId: 1, integrationState: 'linked', tenantId: 1234 });
          expect(state.tables.marketplace_facilities[0]).toMatchObject({
               integration_state: 'linked', linked_tenant_id: 1234,
          });
     });
     it('restarts provisioning when the failed attempt ended before reserving a tenant', async () => {
          state.tables.marketplace_facilities[0].integration_state = 'provision_failed';
          state.tables.marketplace_facilities[0].name = input.companyName;
          state.tables.marketplace_facilities[0].contact_email = input.email;
          const result = await new MarketplaceService().retryFacilityProvisioning(1, input, actor);
          expect(state.provision).toHaveBeenCalledWith(expect.objectContaining({ companyName: input.companyName }),
               actor, expect.any(Function));
          expect(state.retry).not.toHaveBeenCalled();
          expect(result).toMatchObject({ integrationState: 'linked' });
     });
     it('does not link if application approval changes during provisioning', async () => {
          state.provision.mockImplementation(async (_input, _actor, activate) => {
               state.tables.marketplace_facilities[0].status = 'suspended';
               await systemConfigConnection.transaction(async trx => activate(trx, provisioned));
          });
          await expect(new MarketplaceService().provisionFacility(1, input, actor)).rejects.toMatchObject({ statusCode: 409 });
          expect(state.tables.marketplace_facilities[0]).toMatchObject({ status: 'suspended', integration_state: 'provision_failed', linked_tenant_id: null });
     });
});
