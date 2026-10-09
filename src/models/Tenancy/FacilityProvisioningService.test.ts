import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
     connect: vi.fn(), tenantConnection: vi.fn(), release: vi.fn(), bootstrap: vi.fn(), seeds: vi.fn(),
     createWindow: vi.fn(), validateLicense: vi.fn(), hash: vi.fn(), logError: vi.fn(),
}));
vi.mock('../../hooks/logger', () => ({ default: { error: mocks.logError, warn: vi.fn() } }));
vi.mock('mysql2/promise', () => ({ default: { createConnection: mocks.connect } }));
vi.mock('bcrypt', () => ({ default: { hash: mocks.hash } }));
vi.mock('../../database/connection', () => ({
     systemConfigConnection: {},
     singleTenantKnexInstance: { client: { config: { connection: { database: 'Local_Control_DB' } } } },
}));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.tenantConnection }));
vi.mock('./tenantConnections', () => ({ releaseTenantConnection: mocks.release }));
vi.mock('../../bootstrap/applicationStartup', () => ({ runApplicationBootstrappers: mocks.bootstrap }));
vi.mock('./FacilityReferenceSeeds', () => ({ seedFacilityReferences: mocks.seeds }));
vi.mock('../settings/users/PrimeWindowAccessRepository', () => ({
     default: class {
          createWindow = mocks.createWindow;
          validateLicense = mocks.validateLicense;
     },
}));
vi.mock('./TenantRegistry', async importOriginal => {
     // Keep real facility-code generation but not registry/global DB startup.
     const actual: any = await importOriginal();
     return { ...actual, TenantRegistry: class { static ensureReady = vi.fn(); static invalidate = vi.fn(); } };
});

import { FacilityProvisioningService, assertNotControlAssignment } from './FacilityProvisioningService';
import { configuration } from '../../hooks/configuration';
import { validateFacilityInput } from './FacilityInput';

const input = validateFacilityInput({
     companyName: 'Example Lab', email: 'lab@example.test', phone: '0201234567', address: 'Example Street',
     countryId: 1, stateId: 2, districtId: 3, adminName: 'Administrator',
     adminEmail: 'admin@example.test', adminPassword: 'a-long-test-password',
});
const actor = { tenantId: 123456, employeeId: 9 };

function databaseHarness(firstOverrides: Record<string, any> = {}) {
     const writes: Array<{ table: string; action: string; value: any }> = [];
     const district = { id: 3, country_id: 1, state_id: 2, district_code: 'AM', district_name: 'Example District' };
     const db: any = (table: string) => {
          const query: any = {
               where: () => query, whereNull: () => query, whereIn: () => query,
               forUpdate: () => query, max: () => query,
               first: async () => {
                    if (table in firstOverrides) return firstOverrides[table];
                    if (table === 'platform_users') return { role: 'system' };
                    if (table === 'platform_countries') return { id: 1, country_code: 'GH' };
                    if (table === 'platform_states') return { id: 2, state_code: 'NR', state_name: 'Northern Region' };
                    if (table === 'platform_districts') return district;
                    if (table === 'regions') return { id: 9 };
                    if (table === 'districts') return { id: 173 };
                    return undefined;
               },
               insert: async (value: any) => { writes.push({ table, action: 'insert', value }); return [1]; },
               update: async (value: any) => { writes.push({ table, action: 'update', value }); return 1; },
          };
          return query;
     };
     db.schema = { hasTable: async () => true };
     db.fn = { now: () => 'NOW' };
     db.on = vi.fn();
     db.removeListener = vi.fn();
     db.transaction = async (action: any) => action(db);
     return { db, writes };
}

function schemaConnection() {
     return {
          end: vi.fn().mockResolvedValue(undefined),
          query: vi.fn(async (_sql: string, _bindings?: string[]) => [[]]),
     };
}

describe('complete facility provisioning lifecycle', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          vi.stubEnv('PRIME_WINDOWS_KEY', 'test-only-key');
          vi.stubEnv('FACILITY_PROVISIONING_PLATFORM_USER_ID', '1');
          vi.stubEnv('DB_HOST', 'localhost');
          vi.stubEnv('DB_PORT', '3306');
          vi.stubEnv('DB_USERNAME', 'test-only-user');
          configuration.isMultiTenant = true;
          mocks.bootstrap.mockResolvedValue({ accountingReady: true });
          mocks.seeds.mockResolvedValue(undefined);
          mocks.createWindow.mockResolvedValue(1);
          mocks.validateLicense.mockResolvedValue(true);
          mocks.hash.mockResolvedValue('HASHED_PASSWORD');
          mocks.release.mockResolvedValue(undefined);
     });

     it('reserves nonactive, runs strict bootstrap, hashes admin and verifies license before activation', async () => {
          const { db, writes } = databaseHarness();
          const connection = schemaConnection();
          mocks.connect.mockResolvedValue(connection);
          mocks.tenantConnection.mockResolvedValue(db);
          const result = await new FacilityProvisioningService(db).provision(input, actor);
          expect(result).toEqual({
               organizationIdentifier: 'NRAM1', tenantId: expect.any(Number),
               databaseName: expect.stringMatching(/^pls_nram1_\d{6}$/), adminUsername: 'NRAM1S001',
          });
          expect(result.tenantId).toBeGreaterThanOrEqual(100000);
          expect(result.tenantId).toBeLessThanOrEqual(999999);
          expect(result.databaseName).toBe(`pls_${result.organizationIdentifier.toLowerCase()}_${result.tenantId}`);
          expect(writes.find(write => write.table === 'prime_tenants' && write.action === 'insert')!.value)
               .toMatchObject({ database_name: result.databaseName,
                    db_connection_string: `mysql://${process.env.DB_HOST}:${process.env.DB_PORT}/${result.databaseName}` });
          expect(connection.query).toHaveBeenCalledWith(
               'CREATE DATABASE ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', [result.databaseName],
          );
          expect(mocks.bootstrap).toHaveBeenCalledWith(result.tenantId, true);
          expect(mocks.hash).toHaveBeenCalledWith(input.adminPassword, 10);
          const registry = writes.filter(write => write.table === 'prime_tenants');
          expect(registry.map(write => write.value.status)).toEqual(['provisioning', 'active']);
          const account = writes.find(write => write.table === 'roles')!.value;
          expect(account).toMatchObject({ role: 'admin', password: 'HASHED_PASSWORD', pin: null, login_username: result.adminUsername });
          expect(JSON.stringify(writes)).not.toContain(input.adminPassword);
          expect(writes.filter(write => write.table === 'facility_provisioning_events').map(write => write.value.stage))
               .toEqual(['reserved', 'schema_cloned', 'programmable_objects_installed', 'reference_seeded', 'runtime_bootstrapped', 'initialized', 'active']);
          expect(mocks.createWindow.mock.calls[0][3]).toBe(true);
          expect(connection.end).toHaveBeenCalled();
     });

     it('finishes reference seeds and awaits tenant-scoped bootstrappers before initializing or activating', async () => {
          const { db, writes } = databaseHarness();
          mocks.connect.mockResolvedValue(schemaConnection());
          mocks.tenantConnection.mockResolvedValue(db);
          mocks.bootstrap.mockImplementationOnce(async (tenantId: number, strict: boolean) => {
               const registry = writes.find(write => write.table === 'prime_tenants' && write.action === 'insert')!;
               expect(tenantId).toBe(registry.value.tenant_number);
               expect(strict).toBe(true);
               expect(mocks.seeds).toHaveBeenCalledWith(db, expect.any(Array), input.adminName);
               expect(writes.some(write => write.table === 'facility_provisioning_events' &&
                    write.value.stage === 'reference_seeded')).toBe(true);
               expect(writes.some(write => write.table === 'roles' || write.table === 'companyprofile')).toBe(false);
               expect(writes.some(write => write.table === 'prime_tenants' && write.value.status === 'active')).toBe(false);
               expect(mocks.createWindow).not.toHaveBeenCalled();
               return { accountingReady: true };
          });
          await new FacilityProvisioningService(db).provision(input, actor);
          expect(mocks.bootstrap).toHaveBeenCalledTimes(1);
          expect(writes.some(write => write.table === 'prime_tenants' && write.value.status === 'active')).toBe(true);
     });

     it.each(['clone', 'seeds', 'bootstrap', 'license', 'objects'])('marks failed, audits and never returns success after %s failure', async failure => {
          const { db, writes } = databaseHarness();
          const connection = schemaConnection();
          mocks.connect.mockResolvedValue(connection);
          mocks.tenantConnection.mockResolvedValue(db);
          if (failure === 'clone') connection.query.mockImplementation(async sql => {
               if (sql.startsWith('CREATE DATABASE')) throw new Error('SQL details must not be exposed');
               return [[]];
          });
          if (failure === 'seeds') mocks.seeds.mockRejectedValue(new Error('sensitive SQL'));
          if (failure === 'bootstrap') mocks.bootstrap.mockRejectedValue(new Error('sensitive SQL'));
          if (failure === 'license') mocks.validateLicense.mockResolvedValue(false);
          if (failure === 'objects') connection.query.mockImplementation(async sql => {
               if (sql.startsWith('CREATE PROCEDURE')) throw new Error('SQL details must not be exposed');
               return [[]];
          });
          await expect(new FacilityProvisioningService(db).provision(input, actor)).rejects.toThrow(/onboarding failed during/);
          expect(mocks.logError).toHaveBeenCalledWith('Facility onboarding failed', expect.objectContaining({
               code: 'FACILITY_PROVISIONING_ERROR', organizationIdentifier: 'NRAM1',
          }));
          expect(JSON.stringify(mocks.logError.mock.calls)).not.toContain('sensitive SQL');
          expect(JSON.stringify(mocks.logError.mock.calls)).not.toContain(input.adminPassword);
          expect(writes.filter(write => write.table === 'prime_tenants').map(write => write.value.status)).toEqual(['provisioning', 'failed']);
          const events = writes.filter(write => write.table === 'facility_provisioning_events');
          expect(events[events.length - 1]?.value.stage).toMatch(/^failed:/);
          expect(connection.query.mock.calls.some(([sql]) => /DROP DATABASE/.test(sql))).toBe(false);
          expect(mocks.release).toHaveBeenCalledWith(expect.any(Number));
          expect(connection.end).toHaveBeenCalled();
     });

     it('refuses single-tenant mode before connecting or allocating', async () => {
          configuration.isMultiTenant = false;
          await expect(new FacilityProvisioningService(databaseHarness().db).provision(input, actor)).rejects.toThrow('multi-tenant');
          expect(mocks.connect).not.toHaveBeenCalled();
     });
     it('treats even a swallowed bootstrap query error as a failed facility', async () => {
          const { db, writes } = databaseHarness();
          mocks.connect.mockResolvedValue(schemaConnection());
          mocks.tenantConnection.mockResolvedValue(db);
          mocks.bootstrap.mockImplementationOnce(async () => {
               db.on.mock.calls[0][1]();
               return { accountingReady: true };
          });
          await expect(new FacilityProvisioningService(db).provision(input, actor)).rejects.toThrow('runtime_bootstrap');
          expect(writes.filter(write => write.table === 'prime_tenants').map(write => write.value.status)).toEqual(['provisioning', 'failed']);
          expect(db.removeListener).toHaveBeenCalled();
     });
     it.each([
          { platform_districts: null },
          { prime_tenants: { id: 'ALREADYREGISTERED' } },
     ])('rejects invalid location or duplicate email before creating a database %j', async overrides => {
          const { db, writes } = databaseHarness(overrides);
          const connection = schemaConnection();
          mocks.connect.mockResolvedValue(connection);
          await expect(new FacilityProvisioningService(db).provision(input, actor)).rejects.toThrow();
          expect(writes.some(write => write.table === 'prime_tenants')).toBe(false);
          expect(connection.query.mock.calls.some(([sql]) => sql.startsWith('CREATE DATABASE'))).toBe(false);
          expect(mocks.bootstrap).not.toHaveBeenCalled();
     });

     it('returns numeric location IDs and excludes children of unavailable parents', async () => {
          const rows: Record<string, any[]> = {
               platform_countries: [{ id: '1', country_name: 'Ghana' }],
               platform_states: [{ id: '2', country_id: '1', state_name: 'Northern Region' }, { id: '8', country_id: '99', state_name: 'Unavailable country' }],
               platform_districts: [{ id: '3', state_id: '2', district_name: 'Example District' }, { id: '9', state_id: '8', district_name: 'Unavailable state' }],
          };
          const db: any = (table: string) => {
               const query: any = {
                    where: () => query, whereNull: () => query, select: () => query,
                    orderBy: async () => rows[table],
               };
               return query;
          };
          expect(await new FacilityProvisioningService(db).options()).toEqual({
               countries: [{ id: 1, country_name: 'Ghana' }],
               states: [{ id: 2, country_id: 1, state_name: 'Northern Region' }],
               districts: [{ id: 3, state_id: 2, district_name: 'Example District' }],
          });
     });
});

describe('facility list', () => {
     it('adds isControlTenant without changing existing registry fields', async () => {
          const { TenantRegistry } = await import('./TenantRegistry') as any;
          TenantRegistry.prototype.listTenants = vi.fn(async () => [
               { tenantId: 123456, platformId: 'CTRL1', status: 'active' }, { tenantId: 654321, platformId: 'NRAM11', status: 'suspended' },
          ]);
          configuration.defaultTenantId = 123456;
          expect(await new FacilityProvisioningService({} as any).list()).toEqual([
               { tenantId: 123456, platformId: 'CTRL1', status: 'active', isControlTenant: true },
               { tenantId: 654321, platformId: 'NRAM11', status: 'suspended', isControlTenant: false },
          ]);
          expect(TenantRegistry.invalidate).toHaveBeenCalled();
     });
});

describe('control-tenant assignment guard', () => {
     it('never lets a new facility take the control tenant ID or this installation\'s own database', () => {
          configuration.defaultTenantId = 990556;
          expect(() => assertNotControlAssignment(990556, 'PLS990556')).toThrow(/control tenant/);
          expect(() => assertNotControlAssignment(185826, 'local_control_db')).toThrow(/control tenant/);
          expect(() => assertNotControlAssignment(185826, 'PLS185826', 'other_db')).not.toThrow();
          expect(() => assertNotControlAssignment(185826, 'PLS185826', undefined)).not.toThrow();
     });
});
