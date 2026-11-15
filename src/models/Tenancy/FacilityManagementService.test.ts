import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
     invalidate: vi.fn(), ready: vi.fn(), connect: vi.fn(), release: vi.fn(), query: vi.fn(), end: vi.fn(),
     tenantConnection: vi.fn(), getModulePricing: vi.fn(),
}));
vi.mock('mysql2/promise', () => ({ default: { createConnection: mocks.connect } }));
vi.mock('./tenantConnections', () => ({ releaseTenantConnection: mocks.release }));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.tenantConnection }));
vi.mock('../../database/connection', () => ({
     systemConfigConnection: {},
     singleTenantKnexInstance: { client: { config: { connection: { database: 'control_db' } } } },
}));
vi.mock('./TenantRegistry', () => ({
     TENANTS_TABLE: 'prime_tenants',
     TenantRegistry: class { static ensureReady = mocks.ready; static invalidate = mocks.invalidate; },
}));
vi.mock('./FacilityModulePricingCatalog', async importOriginal => {
     const actual: any = await importOriginal();
     return {
          ...actual,
          FacilityModulePricingCatalog: class { get = mocks.getModulePricing; },
     };
});

import {
     FacilityManagementService, EVENTS_TABLE, PAYMENTS_TABLE, PLANS_TABLE, PROVISIONING_EVENTS_TABLE, sanitizeAuditDetails,
} from './FacilityManagementService';
import { parseAuditQuery, validateSubscriptionPlan } from './FacilityManagementInput';
import { FacilityError } from './FacilityInput';
import { configuration } from '../../hooks/configuration';
import { FACILITY_MODULES, validateModuleConfiguration } from './FacilityModules';
import { validateMedicalDeviceInput } from './FacilityMedicalDeviceInput';

const CONTROL = 123456;
const CLIENT = 654321;
const actor = { tenantId: CONTROL, employeeId: 9 };
const NOW = new Date('2026-10-09T10:00:00Z');

/** Minimal in-memory knex: where/whereNull/orderBy/limit/forUpdate/first/select/insert/update + rollback. */
function memoryMaster(seed: Record<string, any[]>) {
     let tables: Record<string, any[]> = JSON.parse(JSON.stringify(seed));
     const nextId: Record<string, number> = {};
     const same = (a: any, b: any) => (a === null || a === undefined || b === null || b === undefined) ? a == b : String(a) === String(b);
     const compare = (a: any, op: string, b: any) => op === '<=' ? a <= b : op === '>=' ? a >= b : op === '<' ? a < b : op === '>' ? a > b : same(a, b);
     const db: any = (name: string) => {
          const filters: Array<(row: any) => boolean> = [];
          const order: Array<[string, string]> = [];
          let limit: number | undefined;
          const rows = () => {
               const result = (tables[name] ||= []).filter(row => filters.every(f => f(row)));
               result.sort((x, y) => {
                    for (const [column, direction] of order) {
                         if (x[column] < y[column]) return direction === 'desc' ? 1 : -1;
                         if (x[column] > y[column]) return direction === 'desc' ? -1 : 1;
                    }
                    return 0;
               });
               return limit === undefined ? result : result.slice(0, limit);
          };
          const query: any = {
               where(a: any, op?: any, value?: any) {
                    if (typeof a === 'object') filters.push(row => Object.entries(a).every(([k, v]) => same(row[k], v)));
                    else filters.push(row => value === undefined ? same(row[a], op) : compare(row[a], op, value));
                    return query;
               },
               whereNull(column: string) { filters.push(row => row[column] === null || row[column] === undefined); return query; },
               whereIn(column: string, values: unknown[]) { filters.push(row => values.some(value => same(row[column], value))); return query; },
               orderBy(column: string, direction = 'asc') { order.push([column, direction]); return query; },
               limit(n: number) { limit = n; return query; },
               forUpdate() { db.locks.push(name); return query; },
               async first() { const row = rows()[0]; return row ? { ...row } : undefined; },
               async select() { return rows().map(row => ({ ...row })); },
               async count() { return [{ n: rows().length }]; },
               async columnInfo() { return { is_effective: { nullable: false } }; },
               async insert(value: any) {
                    const table = (tables[name] ||= []);
                    if (name === EVENTS_TABLE && db.failNextEventInsert) {
                         db.failNextEventInsert = false;
                         throw new Error('Audit unavailable');
                    }
                    if (name === PAYMENTS_TABLE && db.failNextPaymentInsert) {
                         db.failNextPaymentInsert = false;
                         throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
                    }
                    if (name === PAYMENTS_TABLE && value.active_period_key
                         && table.some(row => same(row.tenant_id, value.tenant_id) && row.active_period_key === value.active_period_key)) {
                         throw Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
                    }
                    const id = nextId[name] = (nextId[name] || 0) + 1;
                    table.push({ id, created_at: NOW.toISOString(), notes: '', voided_at: null, ...value });
                    return [id];
               },
               async update(value: any) {
                    const matched = rows();
                    for (const row of matched) Object.assign(row, value);
                    return matched.length;
               },
               async delete() {
                    const matched = new Set(rows());
                    tables[name] = (tables[name] || []).filter(row => !matched.has(row));
                    return matched.size;
               },
               async del() { return query.delete(); },
          };
          return query;
     };
     db.locks = [] as string[];
     db.fn = { now: () => NOW.toISOString() };
     db.schema = { hasTable: async () => true, hasColumn: async () => true };
     /** Emulates the audit UNION ALL query: (management ? provisioning) for one tenant, newest first, LIMIT/OFFSET. */
     db.raw = async (sql: string, bindings: any[]) => {
          db.lastRaw = { sql, bindings };
          const [limit, offset] = bindings.slice(-2);
          const pick = (table: string, tenantId: number, source: string, map: (row: any) => any) =>
               (tables[table] || []).filter(row => same(row.tenant_id, tenantId)).map(row => ({ source, ...map(row) }));
          const rows = [
               ...pick(bindings[0], bindings[1], 'management', row => ({ ...row })),
               ...(bindings.length === 6 ? pick(bindings[2], bindings[3], 'provisioning', row => ({
                    id: row.id, action: row.stage, created_at: row.created_at, actor_tenant_id: row.actor_tenant_id,
                    actor_employee_id: row.actor_employee_id, reason: null, from_status: null, to_status: null, details: null, plan_id: null, payment_id: null,
               })) : []),
          ].sort((x, y) => x.created_at < y.created_at ? 1 : x.created_at > y.created_at ? -1
               : x.source !== y.source ? (x.source < y.source ? -1 : 1) : y.id - x.id);
          return [rows.slice(offset, offset + limit)];
     };
     db.transaction = async (work: any) => {
          const snapshot = JSON.stringify(tables);
          try { return await work(db); } catch (error) { tables = JSON.parse(snapshot); throw error; }
     };
     db.table = (name: string) => tables[name] || [];
     return db;
}

function memoryFacilityTenant(seed: Record<string, any[]>) {
     let tables: Record<string, any[]> = JSON.parse(JSON.stringify(seed));
     let transactionCount = 0;
     const db: any = (name: string) => {
          const filters: Array<(row: any) => boolean> = [];
          const rows = () => (tables[name] ||= []).filter(row => filters.every(filter => filter(row)));
          const query: any = {
               where(criteria: Record<string, unknown>) {
                    filters.push(row => Object.entries(criteria).every(([key, value]) => String(row[key]) === String(value)));
                    return query;
               },
               forUpdate() { return query; },
               async first() { const row = rows()[0]; return row ? { ...row } : undefined; },
               async update(value: any) {
                    for (const row of rows()) Object.assign(row, value);
                    return rows().length;
               },
          };
          return query;
     };
     db.transactionCount = () => transactionCount;
     db.failTransactionAt = 0;
     db.transaction = async (work: any) => {
          transactionCount++;
          if (transactionCount === db.failTransactionAt) throw new Error('Tenant database unavailable');
          const snapshot = JSON.stringify(tables);
          try { return await work(db); }
          catch (error) { tables = JSON.parse(snapshot); throw error; }
     };
     db.table = (name: string) => tables[name] || [];
     return db;
}

const tenant = (tenant_number: number, id: string, status: string) => ({ id, tenant_number, status, deleted_at: null, suspended_at: null });

describe('platform facility status and subscription management', () => {
     let db: any;
     let tenantDb: any;
     let service: FacilityManagementService;
     const originalMultiTenant = configuration.isMultiTenant;
     const originalMasterDatabase = configuration.masterControlDatabase;
     afterEach(() => {
          configuration.isMultiTenant = originalMultiTenant;
          configuration.masterControlDatabase = originalMasterDatabase;
          vi.unstubAllEnvs();
     });
     beforeEach(() => {
          vi.clearAllMocks();
          mocks.query.mockReset().mockImplementation(async (sql: string) => [sql.includes('GET_LOCK') ? [{ acquired: 1 }] : []]);
          mocks.release.mockReset().mockResolvedValue(undefined);
          mocks.end.mockReset().mockResolvedValue(undefined);
          mocks.connect.mockReset().mockResolvedValue({ query: mocks.query, end: mocks.end });
          configuration.defaultTenantId = CONTROL;
          configuration.isMultiTenant = true;
          vi.stubEnv('DB_HOST', 'localhost');
          vi.stubEnv('DB_PORT', '3306');
          vi.stubEnv('DB_USERNAME', 'test');
          db = memoryMaster({
               prime_tenants: [
                    tenant(CONTROL, 'CTRL1', 'active'), tenant(CLIENT, 'NRAM11', 'active'),
                    { ...tenant(222222, 'NRAM12', 'failed'), database_name: 'pls_nram12_222222' },
                    tenant(333333, 'NRAM13', 'provisioning'), tenant(444444, 'NRAM14', 'suspended'),
                    { ...tenant(555555, 'NRAM15', 'active'), deleted_at: '2026-01-01' },
               ],
          });
          const currentConfiguration = {
               branchMode: 'multiple', currency: 'GHS',
               modules: {
                    pharmacy: { enabled: true, monthlyPrice: '100' },
                    email: { enabled: true, monthlyPrice: '20' },
                    sms: { enabled: true, monthlyPrice: '50' },
                    inventory: { enabled: true, monthlyPrice: '10' },
                    deviceInterfacing: { enabled: false, monthlyPrice: '0' },
               },
          };
          tenantDb = memoryFacilityTenant({
               applicationsettings: [{
                    keyid: 1, moduleConfiguration: JSON.stringify(currentConfiguration),
                    smsActivated: 1, emailModuleActivated: 1,
                    services: JSON.stringify({
                         retainedServiceSetting: 'keep', isConnectedInventory: 1,
                         isSmsServicesConnected: 1, isEmailServicesConnected: 1,
                    }),
               }],
               companyprofile: [{
                    ID: 1, NAME: 'Existing Facility',
                    additionalInfo: JSON.stringify({ preservedProfileField: 'keep', branchMode: 'multiple' }),
               }],
          });
          mocks.tenantConnection.mockResolvedValue(tenantDb);
          service = new FacilityManagementService(db, () => NOW);
     });
     const plan = (body: any, tenantId = CLIENT) => service.setPlan(tenantId, validateSubscriptionPlan(body), actor);
     const pay = (periodStart: string, extra: any = {}, tenantId = CLIENT) =>
          service.recordPayment(tenantId, { periodStart, paidAt: '2026-10-01', reference: 'MOMO-1', notes: 'n', ...extra }, actor);
     const expectError = async (promise: Promise<unknown>, statusCode: number, message?: RegExp) => {
          const error: any = await promise.catch(e => e);
          expect(error).toBeInstanceOf(FacilityError);
          expect(error.statusCode).toBe(statusCode);
          if (message) expect(error.message).toMatch(message);
     };

     describe('facility medical devices', () => {
          const input = () => validateMedicalDeviceInput({
               name: 'MindRay', ip: '192.168.1.20', dial_port: '5000', listen_port: '5001',
               connection_mode: 'server', use_tls: false, active: true, testid: '11,12',
          });
          it('lists, creates, updates and deletes only in the selected tenant database and audits the platform actor', async () => {
               const target = memoryMaster({
                    medicalinterfacingdevices: [{ id: 20, name: 'Existing', testid: '' }],
               });
               mocks.tenantConnection.mockResolvedValue(target);
               expect(await service.getMedicalDevices(CLIENT)).toMatchObject([{ id: 20, name: 'Existing' }]);
               const created = await service.saveMedicalDevice(CLIENT, null, input(), actor);
               expect(created.id).toBe(1);
               await service.saveMedicalDevice(CLIENT, created.id, { ...input(), active: 0 }, actor);
               expect(target.table('medicalinterfacingdevices').find((row: any) => row.id === created.id)).toMatchObject({
                    name: 'MindRay', active: 0, testid: '11,12',
               });
               await service.deleteMedicalDevice(CLIENT, created.id, actor);
               expect(target.table('medicalinterfacingdevices')).toHaveLength(1);
               expect(db.table('medicalinterfacingdevices')).toHaveLength(0);
               expect(mocks.tenantConnection.mock.calls.every(([id]) => id === CLIENT)).toBe(true);
               expect(db.table(EVENTS_TABLE).map((event: any) => event.action)).toEqual([
                    'medical_device_created', 'medical_device_updated', 'medical_device_deleted',
               ]);
               for (const event of db.table(EVENTS_TABLE)) expect(event).toMatchObject({
                    tenant_id: CLIENT, actor_tenant_id: CONTROL, actor_employee_id: 9,
               });
          });
          it('does not open a database for absent, deleted, failed or provisioning tenants', async () => {
               for (const id of [999999, 555555, 222222, 333333]) {
                    await expect(service.getMedicalDevices(id)).rejects.toBeInstanceOf(FacilityError);
                    await expect(service.saveMedicalDevice(id, null, input(), actor)).rejects.toBeInstanceOf(FacilityError);
                    await expect(service.deleteMedicalDevice(id, 1, actor)).rejects.toBeInstanceOf(FacilityError);
               }
               expect(mocks.tenantConnection).not.toHaveBeenCalled();
          });
          it('reports a missing device instead of acknowledging a successful mutation', async () => {
               mocks.tenantConnection.mockResolvedValue(memoryMaster({}));
               await expectError(service.saveMedicalDevice(CLIENT, 99, input(), actor), 404);
               await expectError(service.deleteMedicalDevice(CLIENT, 99, actor), 404);
               expect(db.table(EVENTS_TABLE)).toHaveLength(0);
          });
          it('keeps identical device IDs isolated when the platform administrator switches facilities', async () => {
               const first = memoryMaster({ medicalinterfacingdevices: [{ id: 12, name: 'First lab', testid: '' }] });
               const second = memoryMaster({ medicalinterfacingdevices: [{ id: 12, name: 'Second lab', testid: '' }] });
               mocks.tenantConnection.mockImplementation(async id => id === CLIENT ? first : second);
               await service.saveMedicalDevice(444444, 12, input(), actor);
               expect(first.table('medicalinterfacingdevices')[0].name).toBe('First lab');
               expect(second.table('medicalinterfacingdevices')[0].name).toBe('MindRay');
               await service.deleteMedicalDevice(444444, 12, actor);
               expect(first.table('medicalinterfacingdevices')).toHaveLength(1);
               expect(second.table('medicalinterfacingdevices')).toHaveLength(0);
               expect(db.table(EVENTS_TABLE).every((event: any) => event.tenant_id === 444444)).toBe(true);
          });
     });

     describe('post-provision module configuration', () => {
          const requested = {
               branchMode: 'single', currency: 'GHS',
               modules: {
                    pharmacy: { enabled: false, monthlyPrice: '100.00' },
                    email: { enabled: true, monthlyPrice: '25.50' },
                    sms: { enabled: false, monthlyPrice: '50.00' },
                    inventory: { enabled: false, monthlyPrice: '10.00' },
                    deviceInterfacing: { enabled: true, monthlyPrice: '4.25' },
                    commissions: { enabled: false, monthlyPrice: '0.00' },
                    analytics: { enabled: false, monthlyPrice: '0.00' },
                    appointments: { enabled: false, monthlyPrice: '0.00' },
                    expenses: { enabled: false, monthlyPrice: '0.00' },
                    consultations: { enabled: false, monthlyPrice: '0.00' },
                    imaging: { enabled: false, monthlyPrice: '0.00' },
               },
          };

          beforeEach(() => {
               mocks.getModulePricing.mockResolvedValue({
                    currency: 'GHS',
                    modules: {
                         ...Object.fromEntries(FACILITY_MODULES.map(module => [module, '0.00'])),
                         pharmacy: '100.00', email: '25.50', sms: '50.00', inventory: '10.00', deviceInterfacing: '4.25',
                         commissions: '0.00', analytics: '0.00', appointments: '0.00', expenses: '0.00',
                         consultations: '0.00', imaging: '0.00',
                    },
               });
          });

          it.each(['Old company notes', 'null', '["legacy"]', '   '])('preserves legacy company additionalInfo %s when changing modules', async legacy => {
               tenantDb.table('companyprofile')[0].additionalInfo = legacy;
               await service.setModuleConfiguration(CLIENT, requested as any, actor);
               expect(JSON.parse(tenantDb.table('companyprofile')[0].additionalInfo)).toMatchObject({ legacyAdditionalInfo: legacy, branchMode: 'single' });
          });

          it('synchronizes both databases, preserves unrelated JSON and audits the authenticated actor', async () => {
               const result = await service.setModuleConfiguration(CLIENT, requested as any, actor);
               const expected = { ...validateModuleConfiguration(requested)!, monthlyTotal: '29.75' };
               expect(result).toEqual({ tenantId: CLIENT, moduleConfiguration: expected, monthlyTotal: '29.75' });
               expect(JSON.parse(db.table('facility_module_configuration')[0].configuration)).toEqual(expected);
               const settings = tenantDb.table('applicationsettings')[0];
               expect(JSON.parse(settings.moduleConfiguration)).toEqual(expected);
               expect(settings).toMatchObject({ smsActivated: 0, emailModuleActivated: 1 });
               expect(JSON.parse(settings.services)).toEqual({
                    retainedServiceSetting: 'keep', isConnectedInventory: 0,
                    isSmsServicesConnected: 0, isEmailServicesConnected: 1,
               });
               expect(JSON.parse(tenantDb.table('companyprofile')[0].additionalInfo)).toEqual({
                    preservedProfileField: 'keep', branchMode: 'single',
               });
               expect(db.table(EVENTS_TABLE).map((event: any) => [
                    event.action, event.actor_tenant_id, event.actor_employee_id,
               ])).toEqual([
                    ['module_configuration_sync_started', CONTROL, actor.employeeId],
                    ['module_configuration_updated', CONTROL, actor.employeeId],
               ]);
          });

          it('replaces submitted rates with catalog rates only when the module configuration is explicitly saved', async () => {
               const modified = {
                    ...requested,
                    modules: { ...requested.modules, email: { enabled: true, monthlyPrice: '999.99' } },
               };
               const result = await service.setModuleConfiguration(CLIENT, modified as any, actor);
               expect(result.moduleConfiguration.modules.email).toEqual({ enabled: true, monthlyPrice: '25.50' });
               expect(result.monthlyTotal).toBe('29.75');
               expect(mocks.getModulePricing).toHaveBeenCalledWith('GHS');
          });

          it('stores plan metadata and single tier pricing, then drops plan metadata on a custom module save', async () => {
               const planConfig = {
                    ...requested, branchMode: 'multiple', monthlyTotal: '0.00',
                    plan: { code: 'professional', name: 'Professional' },
               };
               const assignment = { code: 'professional', name: 'Professional', monthlyPrice: '125.00' };
               const assigned = await service.setModuleConfiguration(CLIENT, planConfig as any, actor, assignment);
               expect(assigned.moduleConfiguration).toMatchObject({
                    plan: { code: 'professional', name: 'Professional' }, monthlyTotal: '125.00',
               });
               expect(Object.values(assigned.moduleConfiguration.modules).every(module =>
                    module.monthlyPrice === '0.00')).toBe(true);
               expect(JSON.parse(db.table('facility_module_configuration')[0].configuration)).toMatchObject({
                    plan: { code: assignment.code, name: assignment.name }, monthlyTotal: '125.00',
               });

               const custom = await service.setModuleConfiguration(CLIENT, requested as any, actor);
               expect(custom.moduleConfiguration).not.toHaveProperty('plan');
               expect(JSON.parse(db.table('facility_module_configuration')[0].configuration)).not.toHaveProperty('plan');
          });

          it('requires an explicit catalog for a non-GHS currency before writing either database', async () => {
               mocks.getModulePricing.mockRejectedValueOnce(new FacilityError('No complete module pricing catalog exists for USD', 404));
               const usd = { ...requested, currency: 'USD' };
               await expectError(service.setModuleConfiguration(CLIENT, usd as any, actor), 404, /USD/);
               expect(db.table('facility_module_configuration')).toHaveLength(0);
               expect(db.table(EVENTS_TABLE)).toHaveLength(0);
          });

          it('keeps tenant access restrictive and records partial sync if the final tenant write fails', async () => {
               tenantDb.failTransactionAt = 2;
               await expect(service.setModuleConfiguration(CLIENT, requested as any, actor))
                    .rejects.toThrow('Tenant database unavailable');

               const local = tenantDb.table('applicationsettings')[0];
               const intermediate = JSON.parse(local.moduleConfiguration);
               expect(intermediate.branchMode).toBe('single');
               expect(FACILITY_MODULES.filter(module => intermediate.modules[module].enabled)).toEqual(['email']);
               expect(local).toMatchObject({ smsActivated: 0, emailModuleActivated: 1 });
               expect(JSON.parse(tenantDb.table('companyprofile')[0].additionalInfo).branchMode).toBe('single');
               expect(JSON.parse(db.table('facility_module_configuration')[0].configuration).monthlyTotal).toBe('29.75');
               expect(db.table(EVENTS_TABLE).map((event: any) => event.action)).toEqual([
                    'module_configuration_sync_started', 'module_configuration_sync_failed',
               ]);
               expect(db.table(EVENTS_TABLE)[1]).toMatchObject({
                    actor_tenant_id: CONTROL, actor_employee_id: actor.employeeId,
               });
          });

          it('retains restrictive tenant state when the platform write fails', async () => {
               db.failNextEventInsert = true;
               await expect(service.setModuleConfiguration(CLIENT, requested as any, actor)).rejects.toThrow('Audit unavailable');

               const local = tenantDb.table('applicationsettings')[0];
               const intermediate = JSON.parse(local.moduleConfiguration);
               expect(FACILITY_MODULES.filter(module => intermediate.modules[module].enabled)).toEqual(['email']);
               expect(db.table('facility_module_configuration')).toHaveLength(0);
               expect(db.table(EVENTS_TABLE).map((event: any) => event.action)).toEqual(['module_configuration_sync_failed']);
               expect(db.table(EVENTS_TABLE)[0].details).toContain('platform_copy_unchanged');
          });

          it('rejects unmanageable facilities before connecting to their tenant database', async () => {
               await expectError(service.setModuleConfiguration(222222, requested as any, actor), 409, /only active or suspended/);
               expect(mocks.tenantConnection).not.toHaveBeenCalled();
               expect(db.table('facility_module_configuration')).toHaveLength(0);
          });
     });

     describe('registry deletion', () => {
          it.each([[CLIENT, 'NRAM11'], [222222, 'NRAM12'], [444444, 'NRAM14']] as const)(
               'deletes active, failed or suspended tenant %s and audits without deleting billing history', async (id, confirmation) => {
                    await db(PAYMENTS_TABLE).insert({ tenant_id: id, reference: 'Preserve payment' });
                    await db(PLANS_TABLE).insert({ tenant_id: id });
                    const result = await service.deleteTenant(id, confirmation, 'Testing cleanup', actor);
                    expect(result).toMatchObject({ deleted: true, databasePreserved: id !== 222222, tenantId: id });
                    expect(db.table('prime_tenants').some((row: any) => row.tenant_number === id)).toBe(false);
                    expect(db.table('prime_tenants').some((row: any) => row.tenant_number === CONTROL)).toBe(true);
                    expect(db.table(EVENTS_TABLE)[0]).toMatchObject({
                         action: 'tenant_deleted', reason: 'Testing cleanup', actor_tenant_id: CONTROL, actor_employee_id: 9,
                         details: JSON.stringify({ databasePreserved: id !== 222222 }),
                    });
                    if (id === 222222) {
                         expect(mocks.release).toHaveBeenCalledWith(id);
                         expect(mocks.query).toHaveBeenNthCalledWith(1, 'SELECT GET_LOCK(?, 0) AS acquired', ['pls-facility-provisioning-222222']);
                         expect(mocks.query).toHaveBeenNthCalledWith(2, 'DROP DATABASE IF EXISTS ??', ['pls_nram12_222222']);
                         expect(mocks.release.mock.invocationCallOrder[0]).toBeLessThan(mocks.query.mock.invocationCallOrder[1]);
                         expect(mocks.end).toHaveBeenCalledOnce();
                    } else {
                         expect(mocks.connect).not.toHaveBeenCalled();
                         expect(mocks.release).not.toHaveBeenCalled();
                    }
                    expect(mocks.invalidate).toHaveBeenCalledOnce();
                    expect(db.table(PAYMENTS_TABLE)).toHaveLength(1);
                    expect(db.table(PLANS_TABLE)).toHaveLength(1);
               },
          );
          it('clears only failed marketplace links so fresh provisioning can reserve a new tenant', async () => {
               await db('marketplace_facilities').insert({ linked_tenant_id: 222222, integration_state: 'provision_failed' });
               await db('marketplace_facilities').insert({ linked_tenant_id: CLIENT, integration_state: 'linked' });
               await service.deleteTenant(222222, 'NRAM12', 'Retry from scratch', actor);
               expect(db.table('marketplace_facilities')[0]).toMatchObject({
                    linked_tenant_id: null, integration_state: 'provision_failed',
               });
               expect(db.table('marketplace_facilities')[1]).toMatchObject({ linked_tenant_id: CLIENT });
          });
          it('allows retrying confirmed deletion after a cleanup failure', async () => {
               mocks.query.mockRejectedValueOnce(new Error('Cleanup unavailable'));
               await expect(service.deleteTenant(222222, 'NRAM12', 'Retry from scratch', actor)).rejects.toThrow('Cleanup unavailable');
               const result = await service.deleteTenant(222222, 'NRAM12', 'Retry from scratch', actor);
               expect(result).toMatchObject({ deleted: true, databasePreserved: false });
               expect(mocks.query).toHaveBeenCalledTimes(3);
               expect(mocks.query).toHaveBeenLastCalledWith('DROP DATABASE IF EXISTS ??', ['pls_nram12_222222']);
          });
          it('protects the master database even if its name matches the failed reservation', async () => {
               configuration.masterControlDatabase = 'PLS_NRAM12_222222';
               await expectError(service.deleteTenant(222222, 'NRAM12', 'Retry from scratch', actor), 409);
               expect(mocks.connect).not.toHaveBeenCalled();
          });
          it.each(['drop', 'release', 'connect', 'audit'])('retains the failed reservation and reports a %s failure', async failure => {
               if (failure === 'drop') mocks.query.mockRejectedValueOnce(new Error('Cleanup unavailable'));
               if (failure === 'release') mocks.release.mockRejectedValueOnce(new Error('Cleanup unavailable'));
               if (failure === 'connect') mocks.connect.mockRejectedValueOnce(new Error('Cleanup unavailable'));
               if (failure === 'audit') db.failNextEventInsert = true;
               await expect(service.deleteTenant(222222, 'NRAM12', 'Retry from scratch', actor)).rejects.toThrow(
                    failure === 'audit' ? 'Audit unavailable' : 'Cleanup unavailable',
               );
               expect(db.table('prime_tenants').find((row: any) => row.tenant_number === 222222).status).toBe('failed');
               expect(db.table(EVENTS_TABLE)).toHaveLength(0);
               expect(mocks.invalidate).not.toHaveBeenCalled();
               if (failure === 'audit' || failure === 'connect') expect(mocks.query).not.toHaveBeenCalled();
               if (failure === 'drop' || failure === 'release') expect(mocks.end).toHaveBeenCalledOnce();
          });
          it.each(['control_db', 'other_tenant', 'pls_nram12_222222;DROP DATABASE mysql', null])(
               'refuses unsafe failed database %s without deleting the reservation', async databaseName => {
                    await db('prime_tenants').where({ tenant_number: 222222 }).update({ database_name: databaseName });
                    await expectError(service.deleteTenant(222222, 'NRAM12', 'Retry from scratch', actor), 409);
                    expect(mocks.connect).not.toHaveBeenCalled();
                    expect(db.table('prime_tenants')).toHaveLength(6);
               },
          );
          it('refuses failed database cleanup in single-tenant mode or without connection settings', async () => {
               configuration.isMultiTenant = false;
               await expectError(service.deleteTenant(222222, 'NRAM12', 'Retry from scratch', actor), 409);
               configuration.isMultiTenant = true;
               vi.stubEnv('DB_HOST', '');
               await expectError(service.deleteTenant(222222, 'NRAM12', 'Retry from scratch', actor), 503);
               expect(mocks.connect).not.toHaveBeenCalled();
          });
          it('keeps the tenant if recording the audit fails', async () => {
               db.failNextEventInsert = true;
               await expect(service.deleteTenant(CLIENT, 'NRAM11', 'Testing cleanup', actor)).rejects.toThrow('Audit unavailable');
               expect(db.table('prime_tenants')).toHaveLength(6);
               expect(mocks.invalidate).not.toHaveBeenCalled();
          });
          it('refuses partial database deletion while a provisioning worker still holds the lock', async () => {
               mocks.query.mockResolvedValueOnce([[{ acquired: 0 }]]);
               await expectError(service.deleteTenant(222222, 'NRAM12', 'Testing cleanup', actor), 409);
               expect(mocks.query).not.toHaveBeenCalledWith('DROP DATABASE IF EXISTS ??', expect.anything());
               expect(mocks.release).not.toHaveBeenCalled();
               expect(db.table('prime_tenants').some((row: any) => row.tenant_number === 222222)).toBe(true);
               expect(db.table(EVENTS_TABLE)).toHaveLength(0);
               expect(mocks.end).toHaveBeenCalled();
          });
          it('never deletes a failed reservation database that was previously activated', async () => {
               await db('prime_tenants').where({ tenant_number: 222222 }).update({ provisioned_at: NOW.toISOString() });
               await expectError(service.deleteTenant(222222, 'NRAM12', 'Testing cleanup', actor), 409);
               expect(mocks.connect).not.toHaveBeenCalled();
          });
          it('protects platform home and provisioning tenants and requires exact confirmation', async () => {
               await expectError(service.deleteTenant(CONTROL, 'CTRL1', 'Testing cleanup', actor), 403);
               await expectError(service.deleteTenant(333333, 'NRAM13', 'Testing cleanup', actor), 409);
               await expectError(service.deleteTenant(CLIENT, 'nram11', 'Testing cleanup', actor), 400);
               await expectError(service.deleteTenant(222222, 'nram12', 'Testing cleanup', actor), 400);
               expect(mocks.connect).not.toHaveBeenCalled();
               expect(db.table('prime_tenants')).toHaveLength(6);
               expect(db.table(EVENTS_TABLE)).toHaveLength(0);
               expect(mocks.invalidate).not.toHaveBeenCalled();
          });

          describe('interrupted provisioning recovery', () => {
               beforeEach(async () => {
                    await db('prime_tenants').where({ tenant_number: 333333 }).update({ database_name: 'pls_nram13_333333' });
               });

               it('marks an interrupted reservation failed without dropping data, then allows confirmed deletion', async () => {
                    await db('marketplace_facilities').insert({ linked_tenant_id: 333333, integration_state: 'provisioning' });
                    const result = await service.recoverProvisioning(333333, 'NRAM13', 'Worker stopped during setup', actor);
                    expect(result).toMatchObject({ tenantId: 333333, status: 'failed', databasePreserved: true });
                    expect(db.table('prime_tenants').find((row: any) => row.tenant_number === 333333).status).toBe('failed');
                    expect(db.table(EVENTS_TABLE)[0]).toMatchObject({
                         action: 'provisioning_recovered', from_status: 'provisioning', to_status: 'failed',
                         actor_tenant_id: CONTROL, actor_employee_id: 9, reason: 'Worker stopped during setup',
                    });
                    expect(db.table('marketplace_facilities')[0].integration_state).toBe('provision_failed');
                    expect(mocks.query).toHaveBeenCalledExactlyOnceWith('SELECT GET_LOCK(?, 0) AS acquired', ['pls-facility-provisioning-333333']);
                    expect(mocks.end).toHaveBeenCalled();
                    expect(await service.deleteTenant(333333, 'NRAM13', 'Remove failed setup', actor))
                         .toMatchObject({ deleted: true, databasePreserved: false });
                    expect(mocks.query).toHaveBeenCalledWith('DROP DATABASE IF EXISTS ??', ['pls_nram13_333333']);
               });

               it('cannot recover a running worker, regardless of how old its registry row is', async () => {
                    mocks.query.mockResolvedValueOnce([[{ acquired: 0 }]]);
                    await db('prime_tenants').where({ tenant_number: 333333 }).update({ created_at: '2020-01-01' });
                    await expectError(service.recoverProvisioning(333333, 'NRAM13', 'Interrupted setup', actor), 409);
                    expect(db.table('prime_tenants').find((row: any) => row.tenant_number === 333333).status).toBe('provisioning');
                    expect(db.table(EVENTS_TABLE)).toHaveLength(0);
                    expect(mocks.end).toHaveBeenCalled();
               });

               it('rolls back recovery if its audit cannot be recorded', async () => {
                    db.failNextEventInsert = true;
                    await expect(service.recoverProvisioning(333333, 'NRAM13', 'Interrupted setup', actor)).rejects.toThrow('Audit unavailable');
                    expect(db.table('prime_tenants').find((row: any) => row.tenant_number === 333333).status).toBe('provisioning');
                    expect(mocks.end).toHaveBeenCalled();
               });

               it('protects the home facility and non-provisioning tenants and requires exact confirmation', async () => {
                    await expectError(service.recoverProvisioning(CONTROL, 'CTRL1', 'Interrupted setup', actor), 403);
                    await expectError(service.recoverProvisioning(CLIENT, 'NRAM11', 'Interrupted setup', actor), 409);
                    await expectError(service.recoverProvisioning(222222, 'NRAM12', 'Interrupted setup', actor), 409);
                    await expectError(service.recoverProvisioning(333333, 'nram13', 'Interrupted setup', actor), 400);
                    expect(mocks.connect).not.toHaveBeenCalled();
               });

               it.each([
                    { provisioned_at: '2026-01-01' }, { database_name: 'control_db' }, { database_name: 'other_tenant' },
               ])('rejects unsafe recovery %j', async fields => {
                    await db('prime_tenants').where({ tenant_number: 333333 }).update(fields);
                    await expectError(service.recoverProvisioning(333333, 'NRAM13', 'Interrupted setup', actor), 409);
                    expect(mocks.connect).not.toHaveBeenCalled();
               });
          });
     });

     describe('status', () => {
          it('suspends and reactivates with locking, audit of the authenticated actor and cache invalidation', async () => {
               const suspended = await service.setStatus(CLIENT, { status: 'suspended', reason: 'Unpaid since August' }, actor);
               expect(suspended).toEqual({ tenantId: CLIENT, organizationIdentifier: 'NRAM11', previousStatus: 'active', status: 'suspended', changed: true, isControlTenant: false });
               const row = db.table('prime_tenants').find((t: any) => t.tenant_number === CLIENT);
               expect(row).toMatchObject({ status: 'suspended', suspended_at: NOW.toISOString() });
               expect(db.locks).toContain('prime_tenants');
               expect(mocks.invalidate).toHaveBeenCalledOnce();
               await service.setStatus(CLIENT, { status: 'active', reason: 'Paid in full' }, actor);
               expect(row).toMatchObject({ status: 'active', suspended_at: null });
               expect(db.table(EVENTS_TABLE).map((e: any) => [e.action, e.from_status, e.to_status, e.reason, e.actor_tenant_id, e.actor_employee_id]))
                    .toEqual([
                         ['status_changed', 'active', 'suspended', 'Unpaid since August', CONTROL, 9],
                         ['status_changed', 'suspended', 'active', 'Paid in full', CONTROL, 9],
                    ]);
          });
          it('refuses control-tenant self-suspension before touching the database', async () => {
               db.locks.length = 0;
               await expectError(service.setStatus(CONTROL, { status: 'suspended', reason: 'oops' }, actor), 403, /control tenant/);
               await expectError(service.setStatus(CONTROL, { status: 'active', reason: 'oops' }, actor), 403);
               expect(db.locks).toEqual([]);
               expect(db.table('prime_tenants').find((t: any) => t.tenant_number === CONTROL).status).toBe('active');
          });
          it.each([222222, 333333])('refuses to activate failed/provisioning tenant %i', async tenantId => {
               await expectError(service.setStatus(tenantId, { status: 'active', reason: 'try it' }, actor), 409, /only active or suspended/);
               await expectError(service.setStatus(tenantId, { status: 'suspended', reason: 'try it' }, actor), 409);
               expect(db.table(EVENTS_TABLE)).toHaveLength(0);
          });
          it('reports no-op changes without audit rows and 404 for unknown/deleted tenants', async () => {
               expect(await service.setStatus(444444, { status: 'suspended', reason: 'again' }, actor)).toMatchObject({ changed: false });
               expect(db.table(EVENTS_TABLE)).toHaveLength(0);
               await expectError(service.setStatus(999999, { status: 'active', reason: 'xyz' }, actor), 404);
               await expectError(service.setStatus(555555, { status: 'suspended', reason: 'xyz' }, actor), 404);
          });
          it('keeps manual access independent of overdue periods', async () => {
               await plan({ frequency: 'monthly', amount: '150', currency: 'GHS', startDate: '2026-01-31' });
               const view = await service.getSubscription(CLIENT);
               expect(view.periods.some(p => p.status === 'overdue')).toBe(true);
               expect(view.facilityStatus).toBe('active');
          });
     });

     describe('subscription', () => {
          it('returns itemized module costs even before a separate payment schedule is configured', async () => {
               await db('facility_module_configuration').insert({ tenant_id: CLIENT, configuration: JSON.stringify({
                    branchMode: 'multiple', currency: 'GHS', modules: {}, monthlyTotal: '130.50',
               }) });
               const result = await service.getSubscription(CLIENT);
               expect(result.moduleConfiguration).toMatchObject({ monthlyTotal: '130.50', branchMode: 'multiple' });
               expect(result.plan).toBeNull();
          });
          it('returns an empty contract when no plan exists', async () => {
               expect(await service.getSubscription(CLIENT)).toEqual({
                    moduleConfiguration: null,
                    tenantId: CLIENT, organizationIdentifier: 'NRAM11', facilityStatus: 'active', isControlTenant: false,
                    asOf: '2026-10-09', plan: null, schedule: [], window: null, periods: [], overdueBeforeWindow: 0,
                    history: [], historyTruncated: false,
               });
               expect((await service.getSubscription(CONTROL)).isControlTenant).toBe(true);
          });
          it('derives monthly paid/unpaid/overdue periods anchored on Jan 31 in a bounded window', async () => {
               const created = await plan({ frequency: 'monthly', amount: '150', currency: 'GHS', startDate: '2026-01-31' });
               expect(created).toMatchObject({ changed: true, mode: 'create', plan: { frequency: 'monthly', amount: '150.00', currency: 'GHS', startDate: '2026-01-31' } });
               const paid = await pay('2026-09-30');
               expect(paid.payment).toEqual({
                    id: 1, periodStart: '2026-09-30', periodEnd: '2026-10-30', amount: '150.00', currency: 'GHS',
                    paidAt: '2026-10-01', reference: 'MOMO-1', notes: 'n', voidedAt: null, voidReason: null,
               });
               const view = paid;
               expect(view.window).toMatchObject({ from: '2026-01-31', to: '2027-01-30', currentPeriodStart: '2026-09-30', pastPeriods: 12, futurePeriods: 3 });
               expect(view.window!.label).toMatch(/monthly/);
               expect(view.periods.map(p => [p.periodStart, p.periodEnd, p.status])).toEqual([
                    ['2026-01-31', '2026-02-27', 'overdue'], ['2026-02-28', '2026-03-30', 'overdue'], ['2026-03-31', '2026-04-29', 'overdue'],
                    ['2026-04-30', '2026-05-30', 'overdue'], ['2026-05-31', '2026-06-29', 'overdue'], ['2026-06-30', '2026-07-30', 'overdue'],
                    ['2026-07-31', '2026-08-30', 'overdue'], ['2026-08-31', '2026-09-29', 'overdue'], ['2026-09-30', '2026-10-30', 'paid'],
                    ['2026-10-31', '2026-11-29', 'unpaid'], ['2026-11-30', '2026-12-30', 'unpaid'], ['2026-12-31', '2027-01-30', 'unpaid'],
               ]);
               expect(view.periods[8]).toMatchObject({ dueDate: '2026-09-30', amount: '150.00', currency: 'GHS', payment: { id: 1, paidAt: '2026-10-01', reference: 'MOMO-1', notes: 'n' } });
               expect(view.periods[9]).toMatchObject({ dueDate: '2026-10-31', payment: null });
               // A period due exactly on asOf is unpaid, not overdue (billing in advance).
               expect((await service.getSubscription(CLIENT, '2026-10-31')).periods.find(p => p.periodStart === '2026-10-31')!.status).toBe('unpaid');
          });
          it('bounds daily periods and counts overdue periods before the window', async () => {
               await plan({ frequency: 'daily', amount: '5.5', currency: 'GHS', startDate: '2026-01-01' });
               await pay('2026-01-01');
               const view = await service.getSubscription(CLIENT);
               expect(view.periods).toHaveLength(38);
               expect(view.window).toMatchObject({ from: '2026-09-09', to: '2026-10-16' });
               expect(view.overdueBeforeWindow).toBe(251 - 1); // 2026-01-01..2026-09-08 (251 days) minus one paid day
               expect(view.periods[0].amount).toBe('5.50');
          });
          it('handles yearly Feb 29 anchors and asOf before the plan starts', async () => {
               await plan({ frequency: 'yearly', amount: '1200.00', currency: 'USD', startDate: '2024-02-29' });
               const view = await service.getSubscription(CLIENT, '2025-03-01');
               expect(view.periods.map(p => [p.periodStart, p.periodEnd])).toEqual([['2024-02-29', '2025-02-27'], ['2025-02-28', '2026-02-27'], ['2026-02-28', '2027-02-27']]);
               const early = await service.getSubscription(CLIENT, '2023-01-01');
               expect(early.window).toMatchObject({ currentPeriodStart: null, from: '2024-02-29', to: '2025-02-27' });
               expect(early.periods[0].status).toBe('unpaid');
               await expectError(service.getSubscription(CLIENT, '2023-02-29'), 400);
          });
          it('rejects duplicates, voids with audit, preserves history and allows a corrected payment', async () => {
               await plan({ frequency: 'monthly', amount: '150.00', currency: 'GHS', startDate: '2026-01-31' });
               await pay('2026-08-31', { reference: 'WRONG' });
               await expectError(pay('2026-08-31'), 409, /already marked paid \(payment 1\)/);
               const voided = await service.voidPayment(CLIENT, 1, { reason: 'Wrong reference' }, actor);
               expect(voided.payment).toMatchObject({ id: 1, voidedAt: NOW.toISOString(), voidReason: 'Wrong reference' });
               expect(voided.periods.find(p => p.periodStart === '2026-08-31')!.status).toBe('overdue');
               await expectError(service.voidPayment(CLIENT, 1, { reason: 'again' }, actor), 409, /already voided/);
               await expectError(service.voidPayment(CLIENT, 99, { reason: 'missing' }, actor), 404);
               await expectError(service.voidPayment(444444, 1, { reason: 'other tenant' }, actor), 404);
               const corrected = await pay('2026-08-31', { reference: 'RIGHT' });
               expect(corrected.periods.find(p => p.periodStart === '2026-08-31')).toMatchObject({ status: 'paid', payment: { id: 2, reference: 'RIGHT' } });
               expect(corrected.history.map(h => [h.id, h.reference, h.voidedAt !== null])).toEqual([[2, 'RIGHT', false], [1, 'WRONG', true]]);
               expect(db.table(PAYMENTS_TABLE)).toHaveLength(2);
               expect(db.table(EVENTS_TABLE).map((e: any) => e.action)).toEqual(['plan_create', 'payment_recorded', 'payment_voided', 'payment_recorded']);
               expect(db.table(EVENTS_TABLE)[2]).toMatchObject({ payment_id: 1, reason: 'Wrong reference', actor_employee_id: 9 });
          });
          it('rolls back when the unique active-period index rejects a concurrent duplicate', async () => {
               await plan({ frequency: 'monthly', amount: '150.00', currency: 'GHS', startDate: '2026-01-31' });
               // Simulate a concurrent writer: the pre-check misses, the unique index rejects the insert.
               db.failNextPaymentInsert = true;
               await expectError(pay('2026-07-31'), 409, /already marked paid/);
               expect(db.table(PAYMENTS_TABLE)).toHaveLength(0);
               expect(db.table(EVENTS_TABLE).filter((e: any) => e.action === 'payment_recorded')).toHaveLength(0);
          });
          it('validates payment periods against the schedule and advance limit', async () => {
               await expectError(pay('2026-09-30'), 409, /Configure a subscription plan/);
               await plan({ frequency: 'monthly', amount: '150.00', currency: 'GHS', startDate: '2026-01-31' });
               await expectError(pay('2026-02-01'), 400, /first day of a period/);
               await expectError(pay('2026-01-30'), 400);
               await expectError(pay('2027-01-31'), 400, /up to the period starting 2026-12-31/);
               expect((await pay('2026-12-31')).payment.periodEnd).toBe('2027-01-30');
               await expectError(pay('2026-09-30', { paidAt: '2026-10-11' }), 400, /future/);
          });
          it('allows the control tenant its own subscription and payments (self-suspension stays refused)', async () => {
               const view = await plan({ frequency: 'monthly', amount: '5', currency: 'GHS', startDate: '2026-01-01' }, CONTROL);
               expect(view).toMatchObject({ changed: true, isControlTenant: true, plan: { amount: '5.00' } });
               const paid = await pay('2026-09-01', {}, CONTROL);
               expect(paid.payment).toMatchObject({ periodStart: '2026-09-01', amount: '5.00' });
               const voided = await service.voidPayment(CONTROL, paid.payment.id, { reason: 'duplicate' }, actor);
               expect(voided.payment.voidReason).toBe('duplicate');
               const events = db.table(EVENTS_TABLE);
               expect(events.map((e: any) => e.tenant_id)).toEqual([CONTROL, CONTROL, CONTROL]);
               expect(events.map((e: any) => e.action)).toEqual([expect.stringMatching(/^plan_/), 'payment_recorded', 'payment_voided']);
               await expectError(service.setStatus(CONTROL, { status: 'suspended', reason: 'oops' }, actor), 403, /control tenant/);
          });
          it('refuses subscription writes for non-manageable tenants', async () => {
               await expectError(plan({ frequency: 'monthly', amount: '1', currency: 'GHS', startDate: '2026-01-01' }, 222222), 409);
               await expectError(plan({ frequency: 'monthly', amount: '1', currency: 'GHS', startDate: '2026-01-01' }, 333333), 409);
               expect(db.table(PLANS_TABLE)).toHaveLength(0);
               // Suspended clients may still be billed and paid.
               await plan({ frequency: 'monthly', amount: '1', currency: 'GHS', startDate: '2026-01-01' }, 444444);
               expect((await pay('2026-09-01', {}, 444444)).payment.amount).toBe('1.00');
          });
     });

     describe('plan changes preserve history and obligations', () => {
          beforeEach(async () => {
               await plan({ frequency: 'monthly', amount: '150.00', currency: 'GHS', startDate: '2026-01-31' });
               await pay('2026-09-30');
          });
          it('treats an identical PUT as a no-op', async () => {
               expect(await plan({ frequency: 'monthly', amount: '150', currency: 'GHS', startDate: '2026-01-31' })).toMatchObject({ changed: false, mode: 'unchanged' });
               expect(db.table(PLANS_TABLE)).toHaveLength(1);
          });
          it('schedules a future price change without rewriting earlier periods or payment snapshots', async () => {
               const view = await plan({ frequency: 'monthly', amount: '175.00', currency: 'GHS', startDate: '2026-11-30' });
               expect(view).toMatchObject({ changed: true, mode: 'append' });
               expect(view.schedule).toEqual([
                    { frequency: 'monthly', amount: '150.00', currency: 'GHS', startDate: '2026-01-31', endDate: '2026-11-29' },
                    { frequency: 'monthly', amount: '175.00', currency: 'GHS', startDate: '2026-11-30', endDate: null },
               ]);
               expect(view.plan).toMatchObject({ amount: '150.00', startDate: '2026-01-31' });
               const byStart: Record<string, any> = {};
               for (const p of view.periods) byStart[p.periodStart] = p;
               expect(byStart['2026-08-31']).toMatchObject({ status: 'overdue', amount: '150.00' });
               expect(byStart['2026-09-30']).toMatchObject({ status: 'paid', amount: '150.00' });
               // The new segment anchors on its own startDate day (30th).
               expect(byStart['2026-11-30']).toMatchObject({ status: 'unpaid', amount: '175.00', periodEnd: '2026-12-29' });
               expect(db.table(PLANS_TABLE).map((p: any) => p.is_effective)).toEqual([1, 1]);
               expect((await service.getSubscription(CLIENT, '2026-12-05')).plan).toMatchObject({ amount: '175.00' });
          });
          it('keeps the paid snapshot when the latest segment is corrected', async () => {
               const view = await plan({ frequency: 'monthly', amount: '200.00', currency: 'GHS', startDate: '2026-01-31' });
               expect(view.mode).toBe('replace');
               expect(view.periods.find(p => p.periodStart === '2026-09-30')).toMatchObject({ status: 'paid', amount: '150.00' });
               expect(view.periods.find(p => p.periodStart === '2026-08-31')).toMatchObject({ status: 'overdue', amount: '200.00' });
               expect(db.table(PLANS_TABLE).map((p: any) => [p.amount, p.is_effective, p.replaced_by_employee_id ?? null]))
                    .toEqual([['150.00', 0, 9], ['200.00', 1, null]]);
               expect(view.history).toHaveLength(1);
          });
          it('refuses changes that would orphan an active payment or split a period', async () => {
               await expectError(plan({ frequency: 'yearly', amount: '1500.00', currency: 'GHS', startDate: '2026-09-30' }), 409, /payment IDs: 1/);
               await expectError(plan({ frequency: 'yearly', amount: '1500.00', currency: 'GHS', startDate: '2026-12-01' }), 400, /next boundary: 2026-12-31/);
               expect(db.table(PLANS_TABLE)).toHaveLength(1);
               const view = await plan({ frequency: 'yearly', amount: '1500.00', currency: 'GHS', startDate: '2026-12-31' });
               expect(view.periods[view.periods.length - 1]).toMatchObject({ periodStart: '2026-12-31', periodEnd: '2027-12-30', amount: '1500.00' });
          });
     });

     describe('audit', () => {
          const prov = (id: number, tenant_id: number, stage: string, created_at: string) => ({
               id, tenant_id, organization_identifier: 'X', stage, created_at, actor_tenant_id: CONTROL, actor_employee_id: 9,
          });
          beforeEach(() => {
               const seed = memoryMaster({
                    prime_tenants: db.table('prime_tenants'),
                    [PROVISIONING_EVENTS_TABLE]: [
                         prov(1, CLIENT, 'reserved', '2026-10-01T10:00:00.000Z'),
                         prov(2, CLIENT, 'failed:reference_seeds:ER_TOO_LONG_IDENT', '2026-10-01T10:00:05.000Z'),
                         prov(3, 222222, 'reserved', '2026-10-01T10:00:00.000Z'),
                    ],
                    [EVENTS_TABLE]: [
                         { id: 1, tenant_id: CLIENT, organization_identifier: 'NRAM11', action: 'status_changed', from_status: 'active', to_status: 'suspended',
                              reason: 'Unpaid', plan_id: null, payment_id: null, details: null, actor_tenant_id: CONTROL, actor_employee_id: 9, created_at: '2026-10-02T09:00:00.000Z' },
                         { id: 2, tenant_id: CLIENT, organization_identifier: 'NRAM11', action: 'payment_recorded', from_status: null, to_status: null, reason: null,
                              plan_id: 4, payment_id: 7, actor_tenant_id: CONTROL, actor_employee_id: 9, created_at: '2026-10-02T09:00:00.000Z',
                              details: JSON.stringify({ periodStart: '2026-09-01', amount: '1.00', password: 'p', nested: { apiKey: 'k', ok: 1 } }) },
                         { id: 3, tenant_id: 444444, organization_identifier: 'NRAM14', action: 'status_changed', from_status: 'active', to_status: 'suspended',
                              reason: 'other tenant', plan_id: null, payment_id: null, details: null, actor_tenant_id: CONTROL, actor_employee_id: 9, created_at: '2026-10-03T09:00:00.000Z' },
                    ],
               });
               db = seed;
               service = new FacilityManagementService(db, () => NOW);
          });

          it('merges both tables for one tenant newest first with safe structured details', async () => {
               const page = await service.listAudit(CLIENT, parseAuditQuery({}));
               expect(page).toMatchObject({ page: 1, pageSize: 25, total: 4 });
               expect(page.events.map(e => [e.source, e.id, e.action])).toEqual([
                    ['management', 2, 'payment_recorded'], ['management', 1, 'status_changed'],
                    ['provisioning', 2, 'failed:reference_seeds'], ['provisioning', 1, 'reserved'],
               ]);
               expect(page.events[0]).toEqual({
                    id: 2, source: 'management', action: 'payment_recorded', createdAt: '2026-10-02T09:00:00.000Z',
                    actorTenantId: CONTROL, actorEmployeeId: 9, reason: null, fromStatus: null, toStatus: null,
                    details: { planId: 4, paymentId: 7, periodStart: '2026-09-01', amount: '1.00', nested: { ok: 1 } },
               });
               expect(page.events[1]).toMatchObject({ reason: 'Unpaid', fromStatus: 'active', toStatus: 'suspended', details: null });
               expect(page.events[2]).toMatchObject({ details: { stage: 'failed:reference_seeds', failed: true, errorCode: 'ER_TOO_LONG_IDENT' }, reason: null });
               expect(JSON.stringify(page)).not.toMatch(/password|apiKey|other tenant/);
               expect(db.lastRaw.bindings).toEqual([EVENTS_TABLE, CLIENT, PROVISIONING_EVENTS_TABLE, CLIENT, 25, 0]);
               expect(db.lastRaw.sql).toMatch(/UNION ALL[\s\S]*ORDER BY created_at DESC, source ASC, id DESC LIMIT \? OFFSET \?$/);
          });

          it('paginates with total across both sources and returns an empty page past the end', async () => {
               const second = await service.listAudit(CLIENT, parseAuditQuery({ page: '2', pageSize: '3' }));
               expect(second).toMatchObject({ page: 2, pageSize: 3, total: 4 });
               expect(second.events.map(e => [e.source, e.id])).toEqual([['provisioning', 1]]);
               expect(db.lastRaw.bindings.slice(-2)).toEqual([3, 3]);
               expect((await service.listAudit(CLIENT, parseAuditQuery({ page: '9' }))).events).toEqual([]);
               expect(await service.listAudit(CONTROL, parseAuditQuery({}))).toEqual({ events: [], page: 1, pageSize: 25, total: 0 });
          });

          it('omits provisioning when its table does not exist yet and 404s unknown or deleted tenants', async () => {
               db.schema.hasTable = async (name: string) => name !== PROVISIONING_EVENTS_TABLE;
               const page = await service.listAudit(CLIENT, parseAuditQuery({}));
               expect(page.total).toBe(2);
               expect(page.events.every(e => e.source === 'management')).toBe(true);
               expect(db.lastRaw.sql).not.toMatch(/UNION/);
               await expectError(service.listAudit(999999, parseAuditQuery({})), 404);
               await expectError(service.listAudit(555555, parseAuditQuery({})), 404);
          });

          it('sanitizes secret-like keys at any depth and bounds depth', () => {
               expect(sanitizeAuditDetails({ a: { b: { c: { d: { e: 1 } } } }, db_connection_string: 'x', passwordHash: 'y', token: 'z' }))
                    .toEqual({ a: { b: { c: { d: null } } } });
          });
     });
});

describe('legacy facility_subscription_plans reconciliation', () => {
     function schemaRecorder(columns: Record<string, { nullable: boolean }>) {
          const calls: string[] = [];
          const updates: any[] = [];
          const builder = (log: string[]) => {
               const column = (kind: string, name: string) => {
                    const c: any = { nullable: () => { log.push(`${kind} ${name} null`); return c; }, notNullable: () => c, unsigned: () => c,
                         defaultTo: () => c, alter: () => { log.push(`alter ${name} not null`); return c; } };
                    return c;
               };
               return {
                    boolean: (n: string) => column('bool', n), timestamp: (n: string) => column('ts', n), integer: (n: string) => column('int', n),
                    index: (cols: string[], name: string) => log.push(`index ${name}`),
               };
          };
          const master: any = (table: string) => ({
               columnInfo: async () => columns,
               whereNull: (column: string) => ({ update: async (value: any) => { updates.push({ table, column, value }); return 1; } }),
          });
          master.raw = (sql: string, bindings: string[]) => ({ sql, bindings });
          master.schema = {
               hasColumn: async (_t: string, name: string) => name in columns,
               alterTable: async (_t: string, cb: (t: any) => void) => { const log: string[] = []; cb(builder(log)); calls.push(log.join('; ')); },
          };
          return { master, calls, updates };
     }

     it('adds the current columns, backfills from legacy columns, indexes, then enforces NOT NULL', async () => {
          const legacy = { is_current: { nullable: false }, superseded_at: { nullable: true }, superseded_by_employee_id: { nullable: true } };
          const { master, calls, updates } = schemaRecorder(legacy as any);
          const columns = legacy as any;
          master.schema.alterTable = (orig => async (t: string, cb: any) => {
               await orig(t, cb);
               // After the first ALTER the new columns exist (nullable is_effective).
               Object.assign(columns, { is_effective: { nullable: true }, replaced_at: { nullable: true }, replaced_by_employee_id: { nullable: true } });
          })(master.schema.alterTable);
          await new FacilityManagementService(master).reconcileLegacyPlansTable();
          expect(calls).toEqual([
               'bool is_effective null; ts replaced_at null; int replaced_by_employee_id null',
               'index idx_fsp_tenant_effective',
               'alter is_effective not null',
          ]);
          expect(updates).toEqual([{ table: PLANS_TABLE, column: 'is_effective', value: {
               is_effective: { sql: '??', bindings: ['is_current'] },
               replaced_at: { sql: 'COALESCE(??, ??)', bindings: ['replaced_at', 'superseded_at'] },
               replaced_by_employee_id: { sql: 'COALESCE(??, ??)', bindings: ['replaced_by_employee_id', 'superseded_by_employee_id'] },
          } }]);
     });

     it('is a no-op on an already current table', async () => {
          const { master, calls, updates } = schemaRecorder({
               is_effective: { nullable: false }, replaced_at: { nullable: true }, replaced_by_employee_id: { nullable: true },
          });
          await new FacilityManagementService(master).reconcileLegacyPlansTable();
          expect(calls).toEqual([]);
          expect(updates).toEqual([]);
     });

     it('uses fresh schema builders when only the effective column has been added', async () => {
          const columns = {
               is_current: { nullable: false }, superseded_at: { nullable: true },
               superseded_by_employee_id: { nullable: true }, is_effective: { nullable: true },
          };
          const { master, calls, updates } = schemaRecorder(columns);
          const original = master.schema;
          Object.defineProperty(master, 'schema', { get: () => {
               let used = false;
               const once = () => {
                    if (used) throw new Error('Schema builder reused');
                    used = true;
               };
               return {
                    hasColumn: async (table: string, name: string) => { once(); return original.hasColumn(table, name); },
                    alterTable: async (table: string, callback: (builder: unknown) => void) => {
                         once();
                         await original.alterTable(table, callback);
                         Object.assign(columns, { replaced_at: { nullable: true }, replaced_by_employee_id: { nullable: true } });
                    },
               };
          } });
          await new FacilityManagementService(master).reconcileLegacyPlansTable();
          expect(calls).toEqual([
               'ts replaced_at null; int replaced_by_employee_id null',
               'index idx_fsp_tenant_effective', 'alter is_effective not null',
          ]);
          expect(updates[0].value.is_effective).toEqual({ sql: '??', bindings: ['is_current'] });
     });

     it('resumes a partially applied run (columns present, is_effective still nullable) and tolerates a duplicate index', async () => {
          const { master, calls, updates } = schemaRecorder({
               is_effective: { nullable: true }, replaced_at: { nullable: true }, replaced_by_employee_id: { nullable: true },
          });
          const alter = master.schema.alterTable;
          master.schema.alterTable = async (t: string, cb: any) => {
               await alter(t, cb);
               if (calls[calls.length - 1].startsWith('index')) throw Object.assign(new Error('dup'), { code: 'ER_DUP_KEYNAME' });
          };
          await new FacilityManagementService(master).reconcileLegacyPlansTable();
          expect(updates[0].value).toEqual({ is_effective: 1 });
          expect(calls).toEqual(['index idx_fsp_tenant_effective', 'alter is_effective not null']);
     });
});
