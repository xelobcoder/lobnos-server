import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
vi.mock('../application/appsettings/result-settings/resultSettings', () => ({ default: { canStaffApproveResult: vi.fn().mockResolvedValue(true) } }));
import { CriticalActionService, assertCriticalRelease, criticalHoldApplies, evaluateCriticalActions } from './CriticalActionService';
import { encrypt_value } from '../../utils/encryptionModels';
const actor: any = { employeeid: 7, tenantId: 1, role: 'scientist', branch: 4 };
const supervisor: any = { ...actor, employeeid: 8, role: 'admin' };
const actions = { acknowledge: true, communicate: true, hold_print: true, hold_release: true, supervisor_clearance: true };
function event(extra: any = {}) { return { id: 1, ascensionid: 3, testid: 5, billingid: 2, revision: 4, version: 1, policy_snapshot: JSON.stringify(actions), ...extra }; }
function fixture(extra: any = {}) { const store = transactionalDatabase({ lab_critical_events: [event()], ...extra }); const service = new CriticalActionService(store.db); vi.spyOn(service, 'detail').mockResolvedValue(event()); return { store, service }; }
beforeEach(() => vi.clearAllMocks());
describe('critical result holds', () => {
 it('separates printing and electronic release while preserving unresolved older-revision holds', () => {
  expect(criticalHoldApplies(event({ policy_snapshot: JSON.stringify({ hold_print: true }) }), 'print')).toBe(true);
  expect(criticalHoldApplies(event({ policy_snapshot: JSON.stringify({ hold_print: true }) }), 'release')).toBe(false);
  expect(criticalHoldApplies(event({ revision: 1 }), 'release')).toBe(true);
  expect(criticalHoldApplies(event({ resolved_at: new Date() }), 'release')).toBe(false);
 });
 it('does not release a hold just because an alert is acknowledged', async () => {
  const { service, store } = fixture(); await service.act(actor, 1, { action: 'acknowledge', version: 1, reason: 'Finding checked' });
  await expect(store.db.transaction(async trx => { await trx('lab_critical_events').forUpdate().first(); await assertCriticalRelease(trx, 3, 'print'); })).rejects.toThrow('hold');
  expect(store.rows('lab_critical_events')[0].resolved_at).toBeUndefined();
 });
 it('records unsuccessful contact attempts without satisfying mandatory communication', async () => {
  const { service, store } = fixture(); await service.act(actor, 1, { action: 'communicate', version: 1, reason: 'Called clinician', recipient: 'Ordering clinician', method: 'phone', outcome: 'No answer', confirmed: false });
  expect(store.rows('lab_critical_events')[0].communicated_at).toBeUndefined();
  await expect(service.act(supervisor, 1, { action: 'resolve', version: 2, reason: 'Attempt to clear' })).rejects.toThrow('Acknowledge');
  expect(store.rows('lab_control_audit')).toHaveLength(1);
 });
 it('requires acknowledgement, successful communication and the configured supervisor clearance', async () => {
  const { service, store } = fixture();
  await service.act(actor, 1, { action: 'acknowledge', version: 1, reason: 'Checked the critical value' });
  await expect(service.act(supervisor, 1, { action: 'resolve', version: 2, reason: 'Review complete' })).rejects.toThrow('communication');
  await service.act(actor, 1, { action: 'communicate', version: 2, reason: 'Read back confirmed', recipient: 'Ordering clinician', method: 'phone', outcome: 'Confirmed receipt', confirmed: true });
  await expect(service.act(actor, 1, { action: 'resolve', version: 3, reason: 'Review complete' })).rejects.toThrow('supervisor');
  await service.act(supervisor, 1, { action: 'resolve', version: 3, reason: 'Review and communication verified' });
  expect(store.rows('lab_critical_events')[0]).toMatchObject({ resolved_by: 8, version: 4 });
  await expect(service.act(supervisor, 1, { action: 'resolve', version: 3, reason: 'Retry clearance' })).rejects.toThrow('changed');
  expect(store.rows('lab_control_audit')).toHaveLength(3);
 });
 it('persists the matched policy and raw value atomically, including fields omitted from a partial device update', async () => {
  const store = transactionalDatabase({ 'testconditions as rule': [{ id: 9, testId: 5, parameter: 'Potassium', conditionId: 1, conditionConstraint: 'greater', target: '6', actions: JSON.stringify(actions) }],
   test_results: [{ ascensionid: 3, testid: 5, field: 'Potassium', value: encrypt_value('See note'), originalvalue: encrypt_value('7.2') }], dbotestresultapproval: [{ ascensionid: 3, approval_revision: 4 }] });
  await store.db.transaction(async trx => { await trx('test_results').forUpdate().first(); await evaluateCriticalActions(trx, { testid: 5, billingid: 2, ascensionid: 3, employeeid: 7 }, [{ field: 'Other parameter', value: 1 }]); });
  expect(store.rows('lab_critical_events')).toHaveLength(1);
  const recorded = store.rows('lab_critical_events')[0]; expect(recorded).toMatchObject({ revision: 4, created_by: 7, rule_id: 9 });
  expect(JSON.parse(recorded.policy_snapshot)).toEqual(actions); expect(recorded.statement).toContain('7.2');
  expect(store.rows('in_app_notifications')).toHaveLength(1);
 });
 it('rolls result edits back when critical-policy evaluation fails', async () => {
  const store = transactionalDatabase({ 'testconditions as rule': [{ id: 9, testId: 5, parameter: 'Value', conditionConstraint: 'greater', target: '10', actions: '{invalid json' }], test_results: [{ ascensionid: 3, testid: 5, field: 'Value', originalvalue: encrypt_value('100') }] });
  await expect(store.db.transaction(async trx => { await trx('test_results').forUpdate().first(); await trx('test_results').where({ ascensionid: 3 }).update({ field: 'Value', originalvalue: encrypt_value('120') }); await evaluateCriticalActions(trx, { testid: 5, billingid: 2, ascensionid: 3, employeeid: 7 }, []); })).rejects.toThrow();
  expect(store.rows('lab_critical_events')).toHaveLength(0); expect(store.events).toContain('rollback');
 });
 it('prevents staff from changing hold policies and rejects stale policy updates', async () => {
  const { service } = fixture({ testconditions: [{ id: 9, testId: 5 }], lab_critical_policies: [{ rule_id: 9, version: 2 }] });
  await expect(service.savePolicy(actor, 5, 9, { actions, version: 2, reason: 'Change policy' })).rejects.toThrow('supervisors');
  await expect(service.savePolicy(supervisor, 5, 9, { actions, version: 1, reason: 'Change policy' })).rejects.toThrow('changed');
 });
});
