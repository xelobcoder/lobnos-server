import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../referral/QuickReferralEntityService', () => ({ QuickReferralEntityService: class {} }));
vi.mock('../application/appsettings/appset', () => ({ default: class { async getAllAppSettings() { return { commissionRecipientPolicy: 'clinician' }; } } }));
import KnexConnection from '../../database/KnexConnections';
import { CrmWorkflowService } from './CrmWorkflowService';
import { CrmService } from './CrmService';
import { applyNegotiatedTerms } from './negotiatedTerms';
const actor: any = { employeeid: 7, role: 'marketer', tenantId: 1, branch: 4 };
const admin: any = { ...actor, employeeid: 8, role: 'admin' };
const now = new Date().toISOString().slice(0, 10);
const config = { id: 10, name: 'Plan', is_active: true, commission_type: 'percentage', percentage_rate: 10, effective_from: '2026-01-01', effective_to: null, crm_agreement_proposal_id: null };
function setup(extra: any = {}) {
 const store = transactionalDatabase({ leads: [{ id: 1, assigned_to: 7, branchid: 4, prospect_type: 'clinician', referrer_id: 11, version: 1, acquisition_stage: 'acquired' }],
  crm_commission_proposals: [{ id: 2, lead_id: 1, status: 'approved', proposed_by: 8, commission_config_id: 10, effective_from: now, effective_to: null, version: 1 }], commission_configs: [config],
  roles: [{ employeeid: 7, role: 'marketer', activation: 1, branch: 4 }, { employeeid: 8, role: 'admin', activation: 1, branch: 4 }], ...extra });
 const transaction = store.db.transaction;
 store.db.transaction = (callback: any) => transaction(async (trx: any) => { await trx('roles').forUpdate().first(); return callback(trx); });
 vi.mocked(KnexConnection).mockResolvedValue(store.db);
 return { store, service: new CrmWorkflowService(1) };
}
beforeEach(() => vi.clearAllMocks());
describe('CRM relationship workflow', () => {
 it('records onboarding evidence, completion actor and reopening while rejecting stale saves', async () => {
  const { service, store } = setup();
  const input = { proposal_id: 2, step: 'terms_communicated', completed: true, notes: 'Terms confirmed by phone', version: 0, due_date: now };
  await service.onboarding(actor, 1, input);
  expect(store.rows('crm_onboarding')[0]).toMatchObject({ completed_by: 7, version: 1, due_date: now });
  await expect(service.onboarding(actor, 1, input)).rejects.toThrow('changed');
  await service.onboarding(actor, 1, { ...input, completed: false, version: 1, notes: 'Referrer asked for clarification' });
  expect(store.rows('crm_onboarding')[0]).toMatchObject({ completed_by: null, completed_at: null, version: 2 });
  expect(store.rows('crm_activities')).toHaveLength(2);
 });
 it('prevents another portfolio user from changing onboarding', async () => {
  const { service } = setup();
  await expect(service.onboarding({ ...actor, employeeid: 9 }, 1, { proposal_id: 2, step: 'terms_communicated', completed: true, notes: 'Completed', version: 0 })).rejects.toThrow('portfolio');
 });
 it('requires actual referral evidence in the signed-in branch and after the agreement begins', async () => {
  const { service, store } = setup({ dboservices: [{ serviceid: 4, clinicianId: 11, branchid: 9, status: 'active', serviceAddedOn: now }, { serviceid: 5, clinicianId: 11, branchid: 4, status: 'active', serviceAddedOn: '2025-01-01' }] });
  await expect(service.onboarding(actor, 1, { proposal_id: 2, step: 'first_referral_verified', completed: true, notes: 'Verified referral', version: 0 })).rejects.toThrow('No active referral');
  expect(store.rows('crm_onboarding')).toHaveLength(0);
 });
 it('amends delayed pending proposals with audit history and a new proposer/version', async () => {
  const pending = { id: 2, lead_id: 1, status: 'pending', proposed_by: 7, commission_config_id: 10, effective_from: '2026-01-01', version: 1, terms_snapshot: JSON.stringify({ config, tiers: [] }) };
  const { service, store } = setup({ crm_commission_proposals: [pending] });
  await service.amend(admin, 1, 2, { effective_from: now, notes: 'Start date moved after discussion', version: 1 });
  expect(store.rows('crm_commission_proposals')[0]).toMatchObject({ status: 'pending', effective_from: now, proposed_by: 8, version: 2 });
  expect(JSON.parse(store.rows('crm_activities')[0].metadata).before).toMatchObject({ effective_from: '2026-01-01', proposed_by: 7 });
  await expect(service.amend(admin, 1, 2, { effective_from: now, notes: 'Stale edit', version: 1 })).rejects.toThrow('changed');
 });
 it('cannot amend an already approved agreement', async () => {
  const { service } = setup();
  await expect(service.amend(admin, 1, 2, { effective_from: now, notes: 'Change approved terms', version: 1 })).rejects.toThrow('Only pending');
 });
 it('retains acquired status when a renewal is rejected', async () => {
  const { store } = setup({ crm_commission_proposals: [{ id: 2, lead_id: 1, status: 'approved' }, { id: 3, lead_id: 1, status: 'pending', proposed_by: 7, version: 1 }] });
  await new CrmService(1).reviewProposal(admin, 1, 3, { decision: 'rejected', notes: 'Keep existing agreement', version: 1 });
  expect(store.rows('leads')[0].acquisition_stage).toBe('acquired');
 });
 it('freezes negotiated administrator rates rather than the template rate', async () => {
  const { store } = setup({ clinicianbasicinfo: [{ id: 11 }], commission_tiers: [], crm_commission_proposals: [{ id: 2, lead_id: 1, status: 'pending', proposed_by: 8, commission_config_id: 10, effective_from: now, version: 1, terms_snapshot: JSON.stringify({ config, tiers: [], negotiated: { percentage_rate: 15 } }) }] });
  await new CrmService(1).reviewProposal(admin, 1, 2, { decision: 'approved', notes: 'Negotiated fifteen percent confirmed', version: 1 });
  expect(store.rows('commission_configs').find(row => row.crm_agreement_proposal_id === 2)?.percentage_rate).toBe(15);
  expect(store.rows('commission_configs').find(row => row.id === 10)?.percentage_rate).toBe(10);
 });
 it('cannot approve a stale proposal after an amendment', async () => {
  setup({ crm_commission_proposals: [{ id: 2, lead_id: 1, status: 'pending', proposed_by: 7, version: 2 }] });
  await expect(new CrmService(1).reviewProposal(admin, 1, 2, { decision: 'approved', notes: 'Stale approval', version: 1 })).rejects.toThrow('changed');
 });
 it('preserves dated marketer ownership when a referrer is reassigned', async () => {
  const { store } = setup({ crm_ownership_history: [{ id: 3, entity_type: 'clinician', entity_id: 11, marketer_id: 7, branchid: 4, valid_from: new Date('2026-01-01'), valid_to: null }], crm_referrer_portfolios: [{ entity_type: 'clinician', entity_id: 11, marketer_id: 7 }] });
  await new CrmService(1).save(admin, { assigned_to: 8, version: 1 }, 1);
  const history = store.rows('crm_ownership_history');
  expect(history).toHaveLength(2); expect(history[0].valid_to).toBeInstanceOf(Date);
  expect(history[1]).toMatchObject({ marketer_id: 8, entity_id: 11 });
  expect(history[0].valid_to.getTime()).toBe(history[1].valid_from.getTime());
 });
});
describe('binding negotiated rates', () => {
 it('uses explicit administrator overrides without changing the template', () => {
  expect(applyNegotiatedTerms(config, { percentage_rate: 15 }, admin).percentage_rate).toBe(15);
  expect(config.percentage_rate).toBe(10);
 });
 it('rejects unauthorized, invalid and incompatible overrides', () => {
  expect(() => applyNegotiatedTerms(config, { percentage_rate: 15 }, actor)).toThrow('administrators');
  expect(() => applyNegotiatedTerms(config, { percentage_rate: 101 }, admin)).toThrow();
  expect(() => applyNegotiatedTerms(config, { fixed_component: 15 }, admin)).toThrow('plan type');
  expect(() => applyNegotiatedTerms(config, { min_commission: 20, max_commission: 10 }, admin)).toThrow('Minimum');
 });
});
