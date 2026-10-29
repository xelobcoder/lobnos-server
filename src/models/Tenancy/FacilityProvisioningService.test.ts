import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
     connect: vi.fn(), tenantConnection: vi.fn(), release: vi.fn(), bootstrap: vi.fn(), seeds: vi.fn(),
     createWindow: vi.fn(), validateLicense: vi.fn(), hash: vi.fn(), logError: vi.fn(),
     getModulePricing: vi.fn(), getPlan: vi.fn(),
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
vi.mock('./FacilityModulePricingCatalog', async importOriginal => {
     const actual: any = await importOriginal();
     return {
          ...actual,
          FacilityModulePricingCatalog: class { get = mocks.getModulePricing; },
     };
});
vi.mock('./FacilitySubscriptionTiers', async importOriginal => {
     const actual: any = await importOriginal();
     return {
          ...actual,
          FacilitySubscriptionTierService: class { getPlan = mocks.getPlan; },
     };
});
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

// Parse the real checked-in exports once for this lifecycle suite. Parser behavior has
// dedicated coverage; repeated synchronous parsing can exhaust individual test deadlines
// when the complete backend suite runs concurrently.
vi.mock('./FacilityCatalogSeeds', async importOriginal => {
     const actual: any = await importOriginal();
     const snapshot = actual.loadFacilityCatalogSeeds();
     return { ...actual, loadFacilityCatalogSeeds: () => structuredClone(snapshot) };
});
vi.mock('./FacilityStructureExports', async importOriginal => {
     const actual: any = await importOriginal();
     const snapshot = actual.loadFacilityStructureExports();
     return { ...actual, loadFacilityStructureExports: () => structuredClone(snapshot) };
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
          let excludesTenant = false;
          const query: any = {
               where: () => query, whereNot: () => { excludesTenant = true; return query; },
               whereNull: () => query, whereIn: () => query,
               forUpdate: () => query, max: () => query,
               first: async () => {
                    if (table === 'prime_tenants' && excludesTenant) return undefined;
                    if (table in firstOverrides) return firstOverrides[table];
                    if (table === 'platform_users') return { role: 'system' };
                    if (table === 'platform_countries') return { id: 1, country_code: 'GH' };
                    if (table === 'platform_states') return { id: 2, state_code: 'NR', state_name: 'Northern Region' };
                    if (table === 'platform_districts') return district;
                    if (table === 'regions') return { id: 9 };
                    if (table === 'districts') return { id: 173 };
                    return undefined;
               },
               insert: async (value: any) => {
                    if (table === 'prime_tenants' && db.failReservationColumn) {
                         throw Object.assign(new Error(`Unknown column '${db.failReservationColumn}' in 'field list'`), { code: 'ER_BAD_FIELD_ERROR' });
                    }
                    if (table === 'facility_provisioning_events' && value.stage.startsWith('failed:') && db.failFailureAudit) {
                         throw new Error('Failure audit unavailable');
                    }
                    writes.push({ table, action: 'insert', value }); return [1];
               },
               update: async (value: any) => {
                    if (table === 'prime_tenants' && ((value.status === 'failed' && (db.failStatusUpdates || (db.failActorUpdate && 'updated_by' in value))) ||
                         (value.status === 'active' && db.failActivationColumn))) {
                         throw Object.assign(new Error(`Unknown column '${db.failActivationColumn || 'updated_by'}' in 'field list'`), { code: 'ER_BAD_FIELD_ERROR' });
                    }
                    writes.push({ table, action: 'update', value }); return 1;
               },
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
          query: vi.fn(async (sql: string, _bindings?: string[]) => [sql.includes('GET_LOCK') ? [{ acquired: 1 }] : []]),
     };
}

describe('complete facility provisioning lifecycle', () => {
     it('executes external linkage in the master activation transaction after license validation', async () => {
          const { db, writes } = databaseHarness();
          mocks.connect.mockResolvedValue(schemaConnection());
          mocks.tenantConnection.mockResolvedValue(db);
          const activate = vi.fn(async (trx: any, facility: any) => {
               expect(trx).toBe(db);
               expect(mocks.validateLicense).toHaveBeenCalled();
               expect(writes.filter(write => write.table === 'prime_tenants').map(write => write.value.status))
                    .toEqual(['provisioning', 'active']);
               expect(facility).toMatchObject({ tenantId: expect.any(Number), adminUsername: 'NRAM1S001' });
          });
          await new FacilityProvisioningService(db).provision(input, actor, activate);
          expect(activate).toHaveBeenCalledTimes(1);
     });

     it('marks the tenant failed and releases its connection if final linkage fails', async () => {
          const { db, writes } = databaseHarness();
          mocks.connect.mockResolvedValue(schemaConnection());
          mocks.tenantConnection.mockResolvedValue(db);
          await expect(new FacilityProvisioningService(db).provision(input, actor, async () => {
               throw new Error('Synthetic linkage failed');
          })).rejects.toMatchObject({ statusCode: 500 });
          expect(writes.filter(write => write.table === 'prime_tenants').map(write => write.value.status))
               .toEqual(['provisioning', 'active', 'failed']);
          expect(mocks.release).toHaveBeenCalled();
     });

     it('removes a failed facility database before rebuilding the same reservation', async () => {
          const failed = {
               id: 'NRAM1', tenant_number: 654321, database_name: 'pls_nram1_654321', status: 'failed',
               company_name: input.companyName, email: input.email, phone: input.phone,
               country_id: input.countryId, state_id: input.stateId, district_id: input.districtId,
          };
          const { db, writes } = databaseHarness({ prime_tenants: failed });
          const connection = schemaConnection();
          mocks.connect.mockResolvedValue(connection);
          mocks.tenantConnection.mockResolvedValue(db);

          const result = await new FacilityProvisioningService(db).retry(654321, input, actor);

          expect(result).toMatchObject({
               organizationIdentifier: 'NRAM1', tenantId: 654321, databaseName: 'pls_nram1_654321',
          });
          expect(mocks.release).toHaveBeenCalledWith(654321);
          const sql = connection.query.mock.calls.map(([statement]) => statement);
          expect(sql.indexOf('DROP DATABASE IF EXISTS ??')).toBeLessThan(sql.indexOf(
               'CREATE DATABASE ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
          ));
          expect(connection.query).toHaveBeenCalledWith('DROP DATABASE IF EXISTS ??', ['pls_nram1_654321']);
          expect(writes.filter(write => write.table === 'prime_tenants').map(write => write.value.status))
               .toEqual(['provisioning', 'active']);
          expect(writes.filter(write => write.table === 'facility_provisioning_events').map(write => write.value.stage))
               .toEqual(['retry_started', 'retry_database_removed', 'schema_cloned', 'programmable_objects_installed',
                    'reference_seeded', 'runtime_bootstrapped', 'initialized', 'active']);
     });

     it('allows company details to change while retrying the same failed reservation', async () => {
          const failed = {
               id: 'NRAM1', tenant_number: 654321, database_name: 'pls_nram1_654321', status: 'failed',
               company_name: input.companyName, email: input.email, phone: input.phone,
               country_id: input.countryId, state_id: input.stateId, district_id: input.districtId,
          };
          const { db, writes } = databaseHarness({ prime_tenants: failed });
          mocks.connect.mockResolvedValue(schemaConnection());
          mocks.tenantConnection.mockResolvedValue(db);
          const editedInput = validateFacilityInput({
               ...input, companyName: 'Updated Lab', email: 'updated@example.test', phone: '0207654321',
               moduleConfiguration: undefined,
          });

          await new FacilityProvisioningService(db).retry(654321, editedInput, actor);

          expect(writes.find(write => write.table === 'prime_tenants' && write.action === 'update')?.value)
               .toMatchObject({
                    status: 'provisioning', company_name: editedInput.companyName,
                    email: editedInput.email, phone: editedInput.phone,
               });
     });

     it('refuses to retry anything except the exact failed facility reservation', async () => {
          const failed = {
               id: 'NRAM1', tenant_number: 654321, database_name: 'pls_nram1_654321', status: 'active',
               company_name: input.companyName, email: input.email, phone: input.phone,
               country_id: input.countryId, state_id: input.stateId, district_id: input.districtId,
          };
          const { db } = databaseHarness({ prime_tenants: failed });
          mocks.connect.mockResolvedValue(schemaConnection());

          await expect(new FacilityProvisioningService(db).retry(654321, input, actor))
               .rejects.toThrow('only failed facilities can be retried');
          expect(mocks.release).not.toHaveBeenCalled();
          expect(mocks.connect.mock.results[0]?.value).toBeDefined();
     });

     it('refuses a concurrent retry before changing the registry or dropping data', async () => {
          const { db, writes } = databaseHarness();
          const connection = schemaConnection();
          connection.query.mockResolvedValueOnce([[{ acquired: 0 }]]);
          mocks.connect.mockResolvedValue(connection);
          await expect(new FacilityProvisioningService(db).retry(654321, input, actor)).rejects.toThrow('still running');
          expect(writes).toHaveLength(0);
          expect(connection.query).not.toHaveBeenCalledWith('DROP DATABASE IF EXISTS ??', expect.anything());
          expect(connection.end).toHaveBeenCalled();
     });

     it.each([
          { provisioned_at: '2026-01-01' },
          { deleted_at: '2026-01-01' },
          { database_name: 'other_tenant_database' },
     ])('never rebuilds an unsafe or previously activated failed reservation %j', async fields => {
          const { db } = databaseHarness({ prime_tenants: {
               id: 'NRAM1', tenant_number: 654321, database_name: 'pls_nram1_654321', status: 'failed',
               country_id: 1, state_id: 2, district_id: 3, email: input.email, ...fields,
          } });
          const connection = schemaConnection();
          mocks.connect.mockResolvedValue(connection);
          await expect(new FacilityProvisioningService(db).retry(654321, input, actor)).rejects.toThrow('cannot be safely cleaned up');
          expect(connection.query).not.toHaveBeenCalledWith('DROP DATABASE IF EXISTS ??', expect.anything());
          expect(connection.end).toHaveBeenCalled();
     });

     it('takes the worker lock before exposing a new reservation and releases it when reservation fails', async () => {
          const { db, writes } = databaseHarness();
          db.failReservationColumn = 'sequence_number';
          const connection = schemaConnection();
          mocks.connect.mockResolvedValue(connection);
          await expect(new FacilityProvisioningService(db).provision(input, actor)).rejects.toThrow(
               /reservation \(ER_BAD_FIELD_ERROR: missing schema column sequence_number/);
          expect(connection.query.mock.calls[0][0]).toBe('SELECT GET_LOCK(?, 0) AS acquired');
          expect(connection.query.mock.calls[1][0]).toBe('SELECT RELEASE_LOCK(?)');
          expect(writes.some(write => write.value.status === 'failed')).toBe(false);
          expect(connection.end).toHaveBeenCalled();
     });

     it('falls back to a status-only update when activation and failure actor writes hit legacy schema', async () => {
          const { db, writes } = databaseHarness();
          db.failActorUpdate = true;
          db.failActivationColumn = 'updated_by';
          mocks.connect.mockResolvedValue(schemaConnection());
          mocks.tenantConnection.mockResolvedValue(db);
          await expect(new FacilityProvisioningService(db).provision(input, actor)).rejects.toThrow(
               /activation \(ER_BAD_FIELD_ERROR: missing schema column updated_by/);
          expect(writes.find(write => write.table === 'prime_tenants' && write.value.status === 'failed')?.value)
               .toEqual({ status: 'failed' });
          expect(mocks.logError).toHaveBeenCalledWith('Facility failure status update failed; attempting status-only recovery', expect.anything());
     });

     it('retains the failed status when the failure audit is unavailable', async () => {
          const { db, writes } = databaseHarness();
          db.failFailureAudit = true;
          mocks.connect.mockResolvedValue(schemaConnection());
          mocks.tenantConnection.mockResolvedValue(db);
          mocks.bootstrap.mockRejectedValueOnce(new Error('Bootstrap failed'));
          await expect(new FacilityProvisioningService(db).provision(input, actor)).rejects.toThrow('retry provisioning or delete');
          expect(writes.some(write => write.table === 'prime_tenants' && write.value.status === 'failed')).toBe(true);
          expect(mocks.logError).toHaveBeenCalledWith('Facility failure audit could not be recorded', expect.anything());
     });

     it('directs operators to recovery and logs explicitly when both failure status writes fail', async () => {
          const { db } = databaseHarness();
          db.failStatusUpdates = true;
          mocks.connect.mockResolvedValue(schemaConnection());
          mocks.tenantConnection.mockResolvedValue(db);
          mocks.bootstrap.mockRejectedValueOnce(new Error('Bootstrap failed'));
          await expect(new FacilityProvisioningService(db).provision(input, actor)).rejects.toThrow('Recover interrupted setup');
          expect(mocks.logError).toHaveBeenCalledWith('Facility remains provisioning; operator recovery is required', expect.anything());
     });

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

     it('saves module activations, branch mode, exact monthly costs and report address per facility', async () => {
          const { db, writes } = databaseHarness();
          mocks.connect.mockResolvedValue(schemaConnection());
          mocks.tenantConnection.mockResolvedValue(db);
          mocks.getModulePricing.mockResolvedValue({
               currency: 'GHS',
               modules: {
                    pharmacy: '12.50', email: '8.25', sms: '50.00', inventory: '3.25', deviceInterfacing: '0.00',
                    commissions: '0.00', analytics: '0.00', appointments: '0.00', expenses: '0.00',
                    consultations: '0.00', imaging: '0.00',
               },
          });

          const configured = validateFacilityInput({ ...input, street: 'New Street', gpsAddress: 'XX-123',
               moduleConfiguration: {
                    branchMode: 'multiple', currency: 'GHS', modules: {
                         pharmacy: { enabled: true, monthlyPrice: '100.25' },
                         email: { enabled: true, monthlyPrice: '20.25' },
                         sms: { enabled: false, monthlyPrice: '50' },
                         inventory: { enabled: true, monthlyPrice: '10' },
                         deviceInterfacing: { enabled: false, monthlyPrice: '0' },
                    },
               },
          });
          const result = await new FacilityProvisioningService(db).provision(configured, actor);
          const profile = writes.find(write => write.table === 'companyprofile')!.value;
          expect(profile).toMatchObject({ ADDRESS: input.address, STREET: 'New Street' });
          expect(JSON.parse(profile.additionalInfo)).toMatchObject({ gpsAddress: 'XX-123', branchMode: 'multiple' });
          expect(writes.filter(write => write.table === 'branch')).toHaveLength(1);
          const settings = writes.find(write => write.table === 'applicationsettings' && write.value.moduleConfiguration)!.value;
          expect(settings).toMatchObject({ emailModuleActivated: 1, smsActivated: 0 });
          expect(JSON.parse(settings.services)).toMatchObject({ isConnectedInventory: 1, isEmailServicesConnected: 1, isSmsServicesConnected: 0 });
          expect(JSON.parse(settings.moduleConfiguration).modules).toMatchObject({
               pharmacy: { enabled: true, monthlyPrice: '12.50' },
               email: { enabled: true, monthlyPrice: '8.25' },
               inventory: { enabled: true, monthlyPrice: '3.25' },
          });
          const modules = writes.find(write => write.table === 'facility_module_configuration')!.value;
          expect(modules.tenant_id).toBe(result.tenantId);
          expect(JSON.parse(modules.configuration)).toMatchObject({ monthlyTotal: '24.00', branchMode: 'multiple' });
          expect(mocks.getModulePricing).toHaveBeenCalledWith('GHS');
          expect(writes.findIndex(write => write.table === 'facility_module_configuration')).toBeLessThan(
               writes.findIndex(write => write.table === 'prime_tenants' && write.value.status === 'active'),
          );
     });

     it('uses an active plan snapshot instead of submitted module selections and prices during provisioning', async () => {
          const { db, writes } = databaseHarness();
          mocks.connect.mockResolvedValue(schemaConnection());
          mocks.tenantConnection.mockResolvedValue(db);
          mocks.getPlan.mockResolvedValue({
               code: 'professional', name: 'Professional', description: 'Tier', currency: 'GHS',
               monthlyPrice: '125.00', modules: ['inventory', 'email', 'appointments'],
               branchMode: 'multiple', rank: 2, active: true,
          });
          const configured = validateFacilityInput({
               ...input, planCode: 'professional',
               moduleConfiguration: { invalid: 'ignored because planCode is authoritative' },
          });
          const result = await new FacilityProvisioningService(db).provision(configured, actor);
          const settings = writes.find(write => write.table === 'applicationsettings' && write.value.moduleConfiguration)!.value;
          const snapshot = JSON.parse(settings.moduleConfiguration);
          expect(mocks.getPlan).toHaveBeenCalledWith('professional', true);
          expect(snapshot).toMatchObject({
               plan: { code: 'professional', name: 'Professional' },
               monthlyTotal: '125.00', currency: 'GHS', branchMode: 'multiple',
          });
          expect(snapshot.modules.email).toEqual({ enabled: true, monthlyPrice: '0.00' });
          expect(snapshot.modules.pharmacy).toEqual({ enabled: false, monthlyPrice: '0.00' });
          const masterSnapshot = JSON.parse(writes.find(write => write.table === 'facility_module_configuration')!.value.configuration);
          expect(masterSnapshot).toEqual(snapshot);
          expect(result.tenantId).toBeGreaterThan(0);
     });

     it.each(['clone', 'seeds', 'bootstrap', 'license', 'objects'])('marks failed, audits and never returns success after %s failure', async failure => {
          const { db, writes } = databaseHarness();
          const connection = schemaConnection();
          mocks.connect.mockResolvedValue(connection);
          mocks.tenantConnection.mockResolvedValue(db);
          if (failure === 'clone') connection.query.mockImplementation(async sql => {
               if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]];
               if (sql.startsWith('CREATE DATABASE')) throw new Error('SQL details must not be exposed');
               return [[]];
          });
          if (failure === 'seeds') mocks.seeds.mockRejectedValue(new Error('sensitive SQL'));
          if (failure === 'bootstrap') mocks.bootstrap.mockRejectedValue(new Error('sensitive SQL'));
          if (failure === 'license') mocks.validateLicense.mockResolvedValue(false);
          if (failure === 'objects') connection.query.mockImplementation(async sql => {
               if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]];
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

     it('names only the denied privilege when the provisioning account lacks a table privilege', async () => {
          const { db } = databaseHarness();
          const connection = schemaConnection();
          mocks.connect.mockResolvedValue(connection);
          mocks.tenantConnection.mockResolvedValue(db);
          connection.query.mockImplementation(async sql => {
               if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]];
               if (sql.startsWith('CREATE TABLE')) {
                    throw Object.assign(new Error("REFERENCES command denied to user 'pls'@'10.0.0.5' for table 'roles'"), {
                         code: 'ER_TABLEACCESS_DENIED_ERROR',
                         sqlMessage: "REFERENCES command denied to user 'pls'@'10.0.0.5' for table 'roles'",
                    });
               }
               return [[]];
          });
          const failure = new FacilityProvisioningService(db).provision(input, actor);
          await expect(failure).rejects.toThrow(/schema_creation \(ER_TABLEACCESS_DENIED_ERROR: REFERENCES privilege missing for the DB_USERNAME account\)/);
          await expect(failure).rejects.not.toThrow(/10\.0\.0\.5|'pls'/);
     });

     it('names the MySQL setting when binary logging blocks routine installation', async () => {
          const { db } = databaseHarness();
          const connection = schemaConnection();
          mocks.connect.mockResolvedValue(connection);
          mocks.tenantConnection.mockResolvedValue(db);
          connection.query.mockImplementation(async sql => {
               if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]];
               if (/^CREATE\s+(?:PROCEDURE|FUNCTION|TRIGGER)/i.test(sql)) {
                    throw Object.assign(new Error('You do not have the SUPER privilege and binary logging is enabled'), {
                         code: 'ER_BINLOG_CREATE_ROUTINE_NEED_SUPER',
                    });
               }
               return [[]];
          });
          await expect(new FacilityProvisioningService(db).provision(input, actor)).rejects.toThrow(
               /programmable_objects \(ER_BINLOG_CREATE_ROUTINE_NEED_SUPER: binary logging blocks routine creation; set log_bin_trust_function_creators = 1\)/);
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
