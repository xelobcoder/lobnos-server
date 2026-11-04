import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../middleware/authority';
import type { FinancialCloseActionInput } from '../interfaces/IFinancialDayCloseService';

const mocks = vi.hoisted(() => ({ pin: vi.fn(), snapshot: vi.fn(), authority: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('./FinancialPinVerificationService', () => ({ FinancialPinVerificationService: class { verify = mocks.pin; } }));
vi.mock('./FinancialSnapshotService', () => ({ FinancialSnapshotService: class { create = mocks.snapshot; } }));
vi.mock('./AuthorityService', async importOriginal => ({
     ...await importOriginal<typeof import('./AuthorityService')>(),
     AuthorityService: class { can = mocks.authority; },
}));
import { FinancialDayCloseService } from './FinancialDayCloseService';

const actor: AuthUser = { employeeid: 8, role: 'admin', branch: 1, tenantId: 1, email: 'admin@example.test' };
const override: FinancialCloseActionInput = { pin: '1234', expectedVersion: 1, overrideSegregationOfDuties: true, overrideReason: 'No independent reviewer is available for this small facility.' };
function setup(status = 'accountant_submitted', records: Record<string, any[]> = {}) {
     let tables: Record<string, any[]> = { financial_day_closures: [{ id: 7, branchid: 1, financial_date: '2026-11-04', status, workflow_version: 1, accountant_employeeid: 8, manager_employeeid: status === 'manager_approved' ? 8 : null, latest_snapshot_hash: 'same-snapshot' }], ...records };
     const db = { transaction: async (callback: (trx: any) => Promise<unknown>) => {
          const local = structuredClone(tables);
          const trx: any = (name: string) => {
               const table = name.split(' as ')[0];
               let filters: Record<string, unknown> = {};
               let count = false;
               const rows = () => (local[table] || []).filter(row => Object.entries(filters).every(([key, value]) => row[key] === value));
               const q: any = {
                    where(value: Record<string, unknown>) { if (typeof value === 'object') filters = { ...filters, ...value }; return q; },
                    whereRaw: () => q, whereExists: () => q, join: () => q, select: () => q, orderBy: () => q, forUpdate: () => q,
                    first: async () => count ? { count: rows().length } : rows()[0],
                    count: () => { count = true; return q; },
                    update: async (value: Record<string, unknown>) => {
                         for (const row of rows()) {
                              const key = table === 'billing' ? 'billingid' : table === 'dboservices' ? 'serviceid' : undefined;
                              if (key && ((local.financial_record_locks || []).some(lock => lock.source_table === table && lock.source_ref === String(row[key])) || local.financial_day_closures.some(close => close.status === 'finalized'))) {
                                   throw Object.assign(new Error('FINANCIAL_RECORD_FINALIZED'), { code: 'ER_SIGNAL_EXCEPTION', sqlMessage: 'FINANCIAL_RECORD_FINALIZED' });
                              }
                              Object.assign(row, value);
                         }
                    },
                    insert(value: Record<string, unknown>) {
                         (local[table] ||= []).push(value);
                         const insertion: any = Promise.resolve([1]);
                         insertion.onConflict = () => insertion;
                         insertion.ignore = () => insertion;
                         return insertion;
                    },
                    then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) { return Promise.resolve(rows()).then(resolve, reject); },
               };
               return q;
          };
          const result = await callback(trx);
          tables = local;
          return result;
     } };
     return { service: new FinancialDayCloseService(1, db), rows: (table: string) => tables[table] || [] };
}
beforeEach(() => {
     vi.clearAllMocks();
     mocks.pin.mockResolvedValue(undefined);
     mocks.authority.mockResolvedValue({ allowed: false, reason: 'No delegated authority', source: 'denied', delegationId: null });
     mocks.snapshot.mockResolvedValue({ hash: 'same-snapshot', discrepancies: [], totals: {}, recordCounts: {} });
});

describe('explicit administrator financial-close exceptions', () => {
     it.each(['approve', 'finalize'])('allows %s with verified PIN and records override identities and reason atomically', async action => {
          const h = setup(action === 'finalize' ? 'manager_approved' : 'accountant_submitted');
          if (action === 'finalize') await h.service.finalize(actor, 7, override);
          else await h.service.managerDecision(actor, 7, { ...override, decision: 'approve' });
          expect(mocks.pin).toHaveBeenCalledWith(actor, '1234', expect.objectContaining({ resourceId: '7' }));
          expect(mocks.authority).not.toHaveBeenCalled();
          const audit = h.rows('financial_day_close_actions')[0];
          expect(audit.reason).toContain(`Administrator override: ${override.overrideReason}`);
          expect(audit.actor_employeeid).toBe(8);
          expect(audit.authority_source).toBe('role');
          expect(JSON.parse(audit.metadata_json).administratorOverride).toMatchObject({ reason: override.overrideReason, preparerEmployeeId: 8 });
          expect(h.rows('financial_day_closures')[0].status).toBe(action === 'finalize' ? 'finalized' : 'manager_approved');
     });
     it('never grants an accountant an administrator exception', async () => {
          const h = setup();
          await expect(h.service.managerDecision({ ...actor, role: 'accountant' }, 7, { ...override, decision: 'approve' })).rejects.toMatchObject({ code: 'DAILY_CLOSE_OVERRIDE_DENIED' });
          expect(h.rows('financial_day_close_actions')).toEqual([]);
     });
     it.each(['', 'short', 'x'.repeat(501)])('requires a bounded meaningful reason', async reason => {
          await expect(setup().service.managerDecision(actor, 7, { ...override, overrideReason: reason, decision: 'approve' })).rejects.toMatchObject({ code: 'DAILY_CLOSE_OVERRIDE_REASON_REQUIRED' });
     });
     it('cannot bypass PIN verification', async () => {
          mocks.pin.mockRejectedValue(new Error('Invalid PIN'));
          const h = setup();
          await expect(h.service.managerDecision(actor, 7, { ...override, decision: 'approve' })).rejects.toThrow('Invalid PIN');
          expect(h.rows('financial_day_close_actions')).toEqual([]);
          expect(h.rows('financial_day_closures')[0].status).toBe('accountant_submitted');
     });
     it('requires a boolean explicit override, not a truthy string', async () => {
          await expect(setup().service.managerDecision(actor, 7, { ...override, overrideSegregationOfDuties: JSON.parse('"true"'), decision: 'approve' }))
               .rejects.toMatchObject({ code: 'INVALID_DAILY_CLOSE_OVERRIDE' });
     });
     it.each([
          { hash: 'changed', discrepancies: [], code: 'FINANCIAL_DAY_SNAPSHOT_CHANGED' },
          { hash: 'same-snapshot', discrepancies: [{ message: 'Ledger mismatch' }], code: 'FINANCIAL_DAY_NOT_RECONCILED' },
     ])('keeps snapshot/reconciliation safeguards', async snapshot => {
          mocks.snapshot.mockResolvedValue(snapshot);
          const h = setup();
          await expect(h.service.managerDecision(actor, 7, { ...override, decision: 'approve' })).rejects.toMatchObject({ code: snapshot.code });
          expect(h.rows('financial_day_close_actions')).toEqual([]);
     });
     it('keeps branch scope, workflow ordering and immutable finalization', async () => {
          await expect(setup().service.managerDecision({ ...actor, branch: 2 }, 7, { ...override, decision: 'approve' })).rejects.toMatchObject({ code: 'BRANCH_SCOPE_DENIED' });
          await expect(setup().service.finalize(actor, 7, override)).rejects.toMatchObject({ code: 'INVALID_DAILY_CLOSE_TRANSITION' });
          await expect(setup('finalized').service.finalize(actor, 7, override)).rejects.toMatchObject({ code: 'FINANCIAL_DAY_FINALIZED' });
          await expect(setup().service.managerDecision(actor, 7, { ...override, expectedVersion: 0, decision: 'approve' })).rejects.toMatchObject({ code: 'STALE_DAILY_CLOSE' });
     });
     it('sets source sign-off flags before installing immutable manifests, so finalization does not trigger its own lock', async () => {
          const h = setup('manager_approved', {
               billing: [{ billingid: 18, branchid: 1, billedon: '2026-11-04', islocked: 0, record_validated_and_signed_off: 0 }],
               dboservices: [{ serviceid: 23, branchid: 1, serviceAddedOn: '2026-11-04', isLocked: 0 }],
          });
          await h.service.finalize(actor, 7, override);
          expect(h.rows('billing')[0]).toMatchObject({ islocked: 1, record_validated_and_signed_off: 1, record_validated_and_signed_off_by: 8 });
          expect(h.rows('dboservices')[0].isLocked).toBe(1);
          expect(h.rows('financial_record_locks')).toEqual(expect.arrayContaining([
               expect.objectContaining({ source_table: 'billing', source_ref: '18' }),
               expect.objectContaining({ source_table: 'dboservices', source_ref: '23' }),
          ]));
          expect(h.rows('financial_day_closures')[0].status).toBe('finalized');
          await expect(h.service.finalize(actor, 7, { ...override, expectedVersion: 2 })).rejects.toMatchObject({ code: 'FINANCIAL_DAY_FINALIZED' });
     });
});
