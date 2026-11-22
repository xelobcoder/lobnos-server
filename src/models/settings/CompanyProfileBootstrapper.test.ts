import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ connection: vi.fn(), tenant: vi.fn(), info: vi.fn(), invalidate: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('../../hooks/logger', () => ({ default: { info: mocks.info } }));
vi.mock('../Tenancy/TenantRegistry', () => ({
     TenantRegistry: class { getTenant = mocks.tenant; },
}));
vi.mock('../../services/cache/testPanelCache', () => ({
     companyInfoCache: { invalidate: mocks.invalidate },
}));

import { bootstrapTenantCompanyProfile } from './CompanyProfileBootstrapper';

function harness(initialProfiles: Array<Record<string, unknown>> = []) {
     const profiles = [...initialProfiles];
     const query: any = {
          forUpdate: () => query,
          first: async () => profiles[0],
          insert: async (profile: Record<string, unknown>) => {
               profiles.push(profile);
               return [1];
          },
     };
     const trx: any = () => query;
     const connection = {
          schema: { hasTable: vi.fn().mockResolvedValue(true) },
          transaction: async (work: (trx: any) => Promise<unknown>) => work(trx),
     };
     return { profiles, connection };
}

describe('tenant company profile bootstrap', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          mocks.tenant.mockResolvedValue({
               status: 'active',
               isActive: true,
               name: 'Example Laboratory',
               email: 'lab@example.test',
               phone: '0241234567',
               databaseName: 'example_lab',
          });
     });

     it('seeds the required company profile fields from the active registry tenant', async () => {
          const { profiles, connection } = harness();
          mocks.connection.mockResolvedValue(connection);

          await bootstrapTenantCompanyProfile(42);

          expect(profiles).toEqual([{
               NAME: 'Example Laboratory',
               EMAIL: 'lab@example.test',
               MOTTO: '',
               PHONENUMBER: '0241234567',
               ADDRESS: '',
               STREET: '',
          }]);
          expect(mocks.invalidate).toHaveBeenCalledWith(42);
     });

     it('does not replace company information that already exists', async () => {
          const existing = { NAME: 'Existing Laboratory' };
          const { profiles, connection } = harness([existing]);
          mocks.connection.mockResolvedValue(connection);

          await bootstrapTenantCompanyProfile(42);

          expect(profiles).toEqual([existing]);
          expect(mocks.tenant).not.toHaveBeenCalled();
          expect(mocks.invalidate).not.toHaveBeenCalled();
     });

     it('fails explicitly when the company profile table is missing', async () => {
          mocks.connection.mockResolvedValue({
               schema: { hasTable: vi.fn().mockResolvedValue(false) },
               transaction: vi.fn(),
          });

          await expect(bootstrapTenantCompanyProfile(42)).rejects.toThrow('companyprofile table is missing');
     });
});
