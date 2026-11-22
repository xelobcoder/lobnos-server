import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
     createConnection: vi.fn(),
     connection: vi.fn(),
     initializeSchema: vi.fn(),
     installObjects: vi.fn(),
     loadStructure: vi.fn(),
     loadCatalog: vi.fn(),
     seedReferences: vi.fn(),
}));

vi.mock('mysql2/promise', () => ({ default: { createConnection: mocks.createConnection } }));
vi.mock('../../database/tls', () => ({ databaseTlsOptions: vi.fn(() => ({})) }));
vi.mock('../../database/connection', () => ({
     singleTenantKnexInstance: {
          client: { config: { connection: {
               host: '127.0.0.1', user: 'test-user', password: 'test-password',
               database: 'local_database', port: 3306,
          } } },
     },
}));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('./FacilitySchema', () => ({
     initializeEmptyFacilitySchema: mocks.initializeSchema,
     installFacilityProgrammableObjects: mocks.installObjects,
}));
vi.mock('./FacilityStructureExports', () => ({
     loadFacilityStructureExports: mocks.loadStructure,
}));
vi.mock('./FacilityCatalogSeeds', () => ({
     FACILITY_CATALOG_TABLES: ['test_panels'],
     loadFacilityCatalogSeeds: mocks.loadCatalog,
}));
vi.mock('./FacilityReferenceSeeds', () => ({
     seedFacilityReferences: mocks.seedReferences,
}));

import { initializeEmptyTenantDatabase } from './EmptyTenantBootstrapper';

function fakeConnection(initialTables: string[] = [], initialStage = '') {
     const tables = [...initialTables];
     let stage = initialStage;
     const query = vi.fn(async (sql: string) => {
          if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }], []];
          if (sql.includes('RELEASE_LOCK')) return [[{ released: 1 }], []];
          if (sql.includes('SELECT TABLE_NAME')) {
               return [tables.map(TABLE_NAME => ({ TABLE_NAME })), []];
          }
          if (sql.includes('CREATE TABLE IF NOT EXISTS')) {
               if (!tables.includes('pls_empty_tenant_bootstrap_state')) {
                    tables.push('pls_empty_tenant_bootstrap_state');
               }
               return [[], []];
          }
          if (sql.includes('SELECT stage')) return [stage ? [{ stage }] : [], []];
          if (sql.includes('INSERT INTO `pls_empty_tenant_bootstrap_state`')) {
               stage = 'schema';
               return [[], []];
          }
          if (sql.includes('UPDATE `pls_empty_tenant_bootstrap_state`')) {
               stage = 'references';
               return [[], []];
          }
          return [[], []];
     });
     return { tables, query, end: vi.fn().mockResolvedValue(undefined) };
}

function tenant() {
     return {
          tenantId: 42,
          databaseName: 'local_database',
          status: 'provisioning',
     } as any;
}

describe('empty tenant database bootstrap', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          mocks.loadStructure.mockReturnValue({ tables: [{ name: 'branch', ddl: 'CREATE TABLE `branch` (`id` int)' }], objects: [] });
          mocks.loadCatalog.mockReturnValue([]);
          mocks.initializeSchema.mockResolvedValue(undefined);
          mocks.installObjects.mockResolvedValue(undefined);
          mocks.seedReferences.mockResolvedValue(undefined);
          const trx: any = (table: string) => ({
               delete: vi.fn().mockResolvedValue(0),
          });
          trx.raw = vi.fn().mockResolvedValue([]);
          mocks.connection.mockResolvedValue({
               transaction: (work: (trx: any) => Promise<unknown>) => work(trx),
          });
     });

     it('uses the existing facility schema and reference seeds for an empty database', async () => {
          const connection = fakeConnection();
          mocks.createConnection.mockResolvedValue(connection);

          await initializeEmptyTenantDatabase(tenant());

          expect(mocks.initializeSchema).toHaveBeenCalledWith(
               connection,
               expect.any(Object),
               'local_database',
               true,
          );
          expect(mocks.installObjects).toHaveBeenCalledOnce();
          expect(mocks.seedReferences).toHaveBeenCalledWith(
               expect.any(Object),
               [],
               'Platform administrator',
          );
          expect(connection.tables).toContain('pls_empty_tenant_bootstrap_state');
          expect(connection.end).toHaveBeenCalledOnce();
     });

     it('refuses a non-empty database without its initialization marker', async () => {
          const connection = fakeConnection(['roles']);
          mocks.createConnection.mockResolvedValue(connection);

          await expect(initializeEmptyTenantDatabase(tenant()))
               .rejects.toThrow('existing tables and no bootstrap state');
          expect(mocks.initializeSchema).not.toHaveBeenCalled();
          expect(connection.end).toHaveBeenCalledOnce();
     });

     it('resumes after reference seeding without clearing or reseeding it', async () => {
          const connection = fakeConnection(['pls_empty_tenant_bootstrap_state', 'branch'], 'references');
          mocks.createConnection.mockResolvedValue(connection);

          await initializeEmptyTenantDatabase(tenant());

          expect(mocks.initializeSchema).not.toHaveBeenCalled();
          expect(mocks.installObjects).not.toHaveBeenCalled();
          expect(mocks.seedReferences).not.toHaveBeenCalled();
     });
});
