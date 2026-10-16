import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FacilityError } from './FacilityInput';
import {
     buildPlanModuleConfiguration, ensureFacilitySubscriptionPlanTables, FACILITY_PLAN_UPGRADE_REQUESTS_TABLE,
     FACILITY_SUBSCRIPTION_TIERS_TABLE, FacilitySubscriptionTierService, validateFacilitySubscriptionTier,
} from './FacilitySubscriptionTiers';
import { FACILITY_MODULES } from './FacilityModules';

const mocks = vi.hoisted(() => ({ tenantConnection: vi.fn(), ensureReady: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.tenantConnection }));
vi.mock('./TenantRegistry', () => ({
     TENANTS_TABLE: 'prime_tenants',
     TenantRegistry: class { static ensureReady = mocks.ensureReady; },
}));

const now = '2026-10-16T12:00:00.000Z';

function memoryMaster(initial: Record<string, any[]> = {}) {
     let tables = JSON.parse(JSON.stringify(initial)) as Record<string, any[]>;
     const next: Record<string, number> = {};
     const same = (a: any, b: any) => String(a) === String(b);
     const db: any = (name: string) => {
          const filters: Array<(row: any) => boolean> = [];
          const ordering: Array<[string, string]> = [];
          let maxRows: number | undefined;
          let pending: any[] = [];
          let operation = '';
          let conflictColumns: string[] | undefined;
          const rows = () => {
               let result = (tables[name] ||= []).filter(row => filters.every(filter => filter(row)));
               result = [...result].sort((a, b) => {
                    for (const [column, direction] of ordering) {
                         if (a[column] < b[column]) return direction === 'desc' ? 1 : -1;
                         if (a[column] > b[column]) return direction === 'desc' ? -1 : 1;
                    }
                    return 0;
               });
               return maxRows === undefined ? result : result.slice(0, maxRows);
          };
          const query: any = {
               where(value: any) {
                    if (typeof value === 'object') filters.push(row => Object.entries(value).every(([key, expected]) => same(row[key], expected)));
                    return query;
               },
               whereIn(column: string, values: any[]) { filters.push(row => values.some(value => same(row[column], value))); return query; },
               orderBy(column: string, direction = 'asc') { ordering.push([column, direction]); return query; },
               limit(value: number) { maxRows = value; return query; },
               forUpdate() { return query; },
               async first() { const row = rows()[0]; return row ? { ...row } : undefined; },
               select() { operation = 'select'; return query; },
               insert(value: any) { operation = 'insert'; pending = Array.isArray(value) ? value : [value]; return query; },
               onConflict(columns: string | string[]) {
                    conflictColumns = Array.isArray(columns) ? columns : [columns];
                    const conflict = async (mode: 'ignore' | 'merge', updateColumns?: string[]) => {
                         const table = tables[name] ||= [];
                         for (const input of pending) {
                              const existing = table.find(row => conflictColumns!.every(column => same(row[column], input[column])));
                              if (existing && mode === 'merge') {
                                   for (const column of updateColumns || []) existing[column] = input[column];
                              }
                              else if (!existing) table.push({ ...input });
                         }
                    };
                    return {
                         ignore: () => conflict('ignore'),
                         merge: (columns?: string[]) => conflict('merge', columns),
                    };
               },
               async update(value: any) {
                    const selected = rows();
                    selected.forEach(row => Object.assign(row, value));
                    return selected.length;
               },
               then(resolve: any, reject: any) {
                    if (operation === 'select') {
                         return Promise.resolve(rows().map(row => ({ ...row }))).then(resolve, reject);
                    }
                    try {
                         const table = tables[name] ||= [];
                         const ids: number[] = [];
                         for (const input of pending) {
                              const id = next[name] = (next[name] || 0) + 1;
                              table.push({ id, created_at: now, requested_at: now, ...input });
                              ids.push(id);
                         }
                         return Promise.resolve(ids).then(resolve, reject);
                    } catch (error) { return Promise.reject(error).then(resolve, reject); }
               },
          };
          return query;
     };
     db.schema = { hasTable: async () => true };
     db.fn = { now: () => now };
     db.transaction = async (work: any) => {
          const snapshot = JSON.stringify(tables);
          try { return await work(db); }
          catch (error) { tables = JSON.parse(snapshot); throw error; }
     };
     db.table = (name: string) => tables[name] || [];
     return db;
}

function config(planCode: string, planName: string, modules = ['inventory']) {
     return buildPlanModuleConfiguration({
          code: planCode, name: planName, description: 'Tier', currency: 'GHS', monthlyPrice: '10.00',
          modules: modules as any, branchMode: 'single', rank: 1, active: true,
     });
}

const actor = { tenantId: 111111, employeeId: 8 };
const CLIENT = 222222;

describe('facility subscription tiers and upgrade requests', () => {
     let db: any;
     let service: FacilitySubscriptionTierService;
     let management: any;
     beforeEach(() => {
          vi.clearAllMocks();
          db = memoryMaster({
               prime_tenants: [{
                    id: 'PLAT01', company_name: 'Example Lab', tenant_number: CLIENT, status: 'active', deleted_at: null,
               }],
               facility_module_configuration: [{ tenant_id: CLIENT, configuration: JSON.stringify(config('basic', 'Basic')) }],
          });
          management = {
               ensureSchema: vi.fn().mockResolvedValue(undefined),
               recordPlanLifecycleEvent: vi.fn(async (trx: any, tenantId: number, eventActor: any, action: string, details: any, reason: any) => {
                    await trx('facility_management_events').insert({
                         tenant_id: tenantId, action, details: JSON.stringify(details), reason,
                         actor_tenant_id: eventActor.tenantId, actor_employee_id: eventActor.employeeId,
                    });
               }),
               setModuleConfiguration: vi.fn(async (tenantId: number, moduleConfig: any, eventActor: any, assignment: any) =>
                    ({ tenantId, moduleConfiguration: { ...moduleConfig, plan: assignment } })),
          };
          service = new FacilitySubscriptionTierService(db, management);
     });

     const upsert = (code: string, overrides: Record<string, unknown> = {}) => service.upsertPlan(code, {
          name: code[0].toUpperCase() + code.slice(1), description: `${code} tier`, currency: 'GHS',
          monthlyPrice: '10.00', modules: ['inventory'], branchMode: 'single', rank: code === 'basic' ? 1 : 2,
          active: true, ...overrides,
     }, actor);

     it('validates plan codes, module membership and activation prices', () => {
          const valid = {
               name: 'Basic', description: 'Tier', currency: 'GHS', monthlyPrice: '10.00',
               modules: ['inventory'], branchMode: 'single', rank: 1, active: true,
          };
          expect(validateFacilitySubscriptionTier('basic', valid)).toMatchObject({ code: 'basic', monthlyPrice: '10.00' });
          expect(() => validateFacilitySubscriptionTier('Bad', valid)).toThrow(FacilityError);
          expect(() => validateFacilitySubscriptionTier('basic', { ...valid, modules: ['unknown'] })).toThrow(/modules/);
          expect(() => validateFacilitySubscriptionTier('basic', { ...valid, monthlyPrice: '0', active: true })).toThrow(/cannot be activated/);
          expect(() => validateFacilitySubscriptionTier('basic', { ...valid, monthlyPrice: '0', active: false })).not.toThrow();
     });

     it('seeds all default tiers idempotently without overwriting an edited tier', async () => {
          await ensureFacilitySubscriptionPlanTables(db);
          const defaults = db.table(FACILITY_SUBSCRIPTION_TIERS_TABLE);
          expect(defaults.map((row: any) => row.code)).toEqual(['basic', 'professional', 'enterprise']);
          expect(JSON.parse(defaults.find((row: any) => row.code === 'enterprise').modules)).toEqual(FACILITY_MODULES);
          expect(JSON.parse(defaults.find((row: any) => row.code === 'professional').modules)).toEqual([
               'inventory', 'email', 'sms', 'appointments', 'expenses', 'consultations',
          ]);
          await upsert('basic', { monthlyPrice: '15.00', active: true });
          await ensureFacilitySubscriptionPlanTables(db);
          expect(db.table(FACILITY_SUBSCRIPTION_TIERS_TABLE).find((row: any) => row.code === 'basic').monthly_price).toBe('15.00');
          expect(db.table(FACILITY_PLAN_UPGRADE_REQUESTS_TABLE)).toEqual([]);
     });

     it('upserts and lists tiers in rank order, including inactive tiers', async () => {
          const professional = await upsert('professional', { rank: 2 });
          const basic = await upsert('basic', { rank: 1, active: false, monthlyPrice: '0.00' });
          expect((await service.listPlans()).map(plan => plan.code)).toEqual(['basic', 'professional', 'enterprise']);
          expect(professional.active).toBe(true);
          expect(basic.active).toBe(false);
     });

     it('creates only eligible same-currency upgrades, rejects duplicates and returns a tenant-scoped history', async () => {
          await upsert('basic', { rank: 1 });
          await upsert('professional', { rank: 2, modules: ['inventory', 'email'], branchMode: 'multiple' });
          await upsert('dollar-plan', { currency: 'USD', rank: 3 });
          const view = await service.tenantPlanView(CLIENT);
          expect(view.current).toMatchObject({ planCode: 'basic', planName: 'Basic', currency: 'GHS' });
          expect(view.plans.find(plan => plan.code === 'professional')).toMatchObject({ isUpgrade: true, isCurrent: false });
          expect(view.plans.find(plan => plan.code === 'dollar-plan')).toMatchObject({ isUpgrade: false, isDowngrade: false });
          const customTenant = 444444;
          const customModules = Object.fromEntries(FACILITY_MODULES.map(module => [module, {
               enabled: ['inventory', 'email'].includes(module), monthlyPrice: '0.00',
          }]));
          await db('facility_module_configuration').insert({
               tenant_id: customTenant,
               configuration: JSON.stringify({ branchMode: 'single', currency: 'GHS', modules: customModules, monthlyTotal: '0.00' }),
          });
          const customView = await service.tenantPlanView(customTenant);
          expect(customView.current.planCode).toBeNull();
          expect(customView.plans.find(plan => plan.code === 'professional')?.isUpgrade).toBe(true);

          const request = await service.createUpgradeRequest(CLIENT, 'professional', 'admin@example.test', actor);
          expect(request).toMatchObject({
               tenantId: CLIENT, fromPlanCode: 'basic', toPlanCode: 'professional', status: 'pending',
               requestedByEmail: 'admin@example.test',
          });
          await expect(service.createUpgradeRequest(CLIENT, 'professional', 'admin@example.test', actor))
               .rejects.toMatchObject({ statusCode: 409 });
          await expect(service.createUpgradeRequest(CLIENT, 'basic', 'admin@example.test', actor))
               .rejects.toThrow(/not an upgrade/);
          await expect(service.createUpgradeRequest(CLIENT, 'dollar-plan', 'admin@example.test', actor))
               .rejects.toThrow(/not an upgrade/);
          expect(await service.tenantUpgradeRequests(CLIENT)).toHaveLength(1);
          expect(await service.platformUpgradeRequests()).toMatchObject([{
               tenantId: CLIENT, platformId: 'PLAT01', organizationName: 'Example Lab',
               fromPlanCode: 'basic', toPlanCode: 'professional',
          }]);
          await expect(service.platformUpgradeRequests('all')).rejects.toThrow(/status/);
          expect(management.recordPlanLifecycleEvent).toHaveBeenCalledWith(
               expect.anything(), CLIENT, actor, 'plan_upgrade_requested',
               expect.objectContaining({ toPlanCode: 'professional' }),
          );
     });

     it('approves by invoking the fail-closed module sync, audits, and is safe to retry; reject records a reason', async () => {
          await upsert('basic', { rank: 1 });
          await upsert('professional', { rank: 2, modules: ['inventory', 'email'], branchMode: 'multiple' });
          const request = await service.createUpgradeRequest(CLIENT, 'professional', 'admin@example.test', actor);
          const approved = await service.decideUpgradeRequest(request.id, 'approve', actor);
          expect(approved).toMatchObject({ id: request.id, status: 'approved', toPlanCode: 'professional' });
          expect(management.setModuleConfiguration).toHaveBeenCalledWith(CLIENT,
               expect.objectContaining({ plan: { code: 'professional', name: 'Professional' }, monthlyTotal: '10.00' }),
               actor, { code: 'professional', name: 'Professional', monthlyPrice: '10.00' });
          await service.decideUpgradeRequest(request.id, 'approve', actor);
          expect(management.setModuleConfiguration).toHaveBeenCalledOnce();
          expect(db.table('facility_management_events').map((row: any) => row.action)).toEqual([
               'subscription_tier_updated', 'subscription_tier_updated',
               'plan_upgrade_requested', 'plan_upgrade_approved',
          ]);

          const secondTenant = 333333;
          await db('prime_tenants').insert({
               id: 'PLAT02', company_name: 'Second Lab', tenant_number: secondTenant, status: 'active', deleted_at: null,
          });
          await db('facility_module_configuration').insert({
               tenant_id: secondTenant, configuration: JSON.stringify(config('basic', 'Basic')),
          });
          const pending = await service.createUpgradeRequest(secondTenant, 'professional', 'other@example.test',
               { tenantId: secondTenant, employeeId: 9 });
          await expect(service.decideUpgradeRequest(pending.id, 'reject', actor, '  not eligible  '))
               .resolves.toMatchObject({ status: 'rejected', decisionReason: 'not eligible' });
          await expect(service.decideUpgradeRequest(999999, 'reject', actor, 'valid reason')).rejects.toMatchObject({ statusCode: 404 });
          await expect(service.decideUpgradeRequest(pending.id + 100, 'reject', actor, 'x')).rejects.toThrow(/3-500/);
     });

     it('platform assignment uses an active tier and delegates to the existing sync path', async () => {
          await upsert('professional', { rank: 2, modules: ['inventory', 'email'], branchMode: 'multiple' });
          const result = await service.assignPlan(CLIENT, 'professional', actor);
          expect(result).toMatchObject({ tenantId: CLIENT, plan: { code: 'professional', name: 'Professional' } });
          expect(management.setModuleConfiguration).toHaveBeenCalledOnce();
          await expect(service.assignPlan(CLIENT, 'enterprise', actor)).rejects.toThrow(/inactive/);
     });
});
