import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
const referrals = vi.hoisted(() => ({ createClinician: vi.fn(), createOrganization: vi.fn() }));
vi.mock('../referral/QuickReferralEntityService', () => ({ QuickReferralEntityService: class { createClinician = referrals.createClinician; createOrganization = referrals.createOrganization; } }));
import KnexConnection from '../../database/KnexConnections';
import { CrmService } from './CrmService';
const actor: any = { employeeid: 7, role: 'marketer', branch: 4, tenantId: 1 };
const manager: any = { employeeid: 8, role: 'manager', branch: 4, tenantId: 1 };
const now = new Date().toISOString().slice(0, 10);
const draft = () => ({ display_name: 'Doctor One', prospect_type: 'clinician', contact_person: 'Doctor One', contact_phone: '0241234567', contact_email: '', location: 'Accra', lead_source: 'referral', priority: 'medium', acquisition_stage: 'prospect', assigned_to: 7, created_by: 999 });
function setup(extra: Record<string, any[]> = {}) {
     const store = transactionalDatabase({ leads: [{ id: 1, display_name: 'Doctor One', prospect_type: 'clinician', assigned_to: 7, branchid: 4, version: 1, archived_at: null }],
          roles: [{ employeeid: 7, role: 'marketer', activation: 1, branch: 4 }, { employeeid: 8, role: 'manager', activation: 1, branch: 4 }], ...extra });
     const transact = store.db.transaction;
     store.db.transaction = (callback: any) => transact(async (trx: any) => { await trx('roles').forUpdate().first(); return callback(trx); });
     vi.mocked(KnexConnection).mockResolvedValue(store.db);
     return { store, service: new CrmService(1) };
}
beforeEach(() => vi.clearAllMocks());
describe('referrer acquisition integrity', () => {
     it('creates an unassigned-capable referrer prospect using the signed-in creator and empty email as null', async () => {
          const { store, service } = setup();
          await service.save(actor, draft());
          expect(store.rows('leads')[1]).toMatchObject({ created_by: 7, assigned_to: 7, prospect_type: 'clinician', contact_email: null });
          expect(store.rows('crm_activities')[0]).toMatchObject({ employeeid: 7, action: 'prospect_created' });
     });
     it('prevents ownership spoofing, stale saves and viewing another portfolio', async () => {
          const { service } = setup();
          await expect(service.save(actor, { ...draft(), assigned_to: 8 })).rejects.toThrow('manager');
          await expect(service.save(actor, { version: 0, notes: 'Changed' }, 1)).rejects.toThrow('changed');
          await expect(service.save({ ...actor, employeeid: 9 }, { version: 1, notes: 'Changed' }, 1)).rejects.toThrow('portfolio');
          await expect(service.save({ ...actor, branch: 5 }, { version: 1 }, 1)).rejects.toThrow('portfolio');
     });
     it('does not activate an unlinked prospect or allow a marketer to approve commission', async () => {
          const { service } = setup();
          await expect(service.save(actor, { version: 1, acquisition_stage: 'active' }, 1)).rejects.toThrow('approve an agreement');
          await expect(service.reviewProposal(actor, 1, 1, { decision: 'approved', version: 1, notes: 'Agreed' })).rejects.toThrow('Only');
     });
     it('links the correct referrer and rejects ambiguous clinician matches on a shared contact phone', async () => {
          const { service, store } = setup({ leads: [{ id: 1, display_name: 'Doctor One', contact_phone: '0241234567', contact_email: null, prospect_type: 'clinician', assigned_to: 7, branchid: 4, version: 1 }], clinicianbasicinfo: [{ id: 11, name: 'Doctor One' }] });
          referrals.createClinician.mockResolvedValue({ id: 12, name: 'Another clinician', created: false });
          await expect(service.link(manager, 1, { create_entity: true })).rejects.toThrow('another clinician name');
          expect(store.rows('crm_referrer_portfolios')).toHaveLength(0);
          referrals.createClinician.mockResolvedValue({ id: 11, name: 'Doctor One', created: false });
          await service.link(manager, 1, { create_entity: true });
          expect(store.rows('crm_referrer_portfolios')[0]).toMatchObject({ entity_type: 'clinician', entity_id: 11, marketer_id: 7, lead_id: 1 });
          expect(store.rows('leads')[0].referrer_id).toBe(11);
     });
     it('records a follow-up once on identical retries and rejects changed retry contents', async () => {
          const { service, store } = setup();
          const task = { lead_id: 1, followup_type: 'visit', notes: 'Pitch diagnostic services', priority: 'high', status: 'pending', next_followup_date: now, idempotency_key: 'visit-key', created_by: 999 };
          await service.saveFollowup(actor, task); await service.saveFollowup(actor, task);
          expect(store.rows('lead_followups')).toHaveLength(1);
          expect(store.rows('lead_followups')[0].created_by).toBe(7);
          await expect(service.saveFollowup(actor, { ...task, notes: 'Another visit' })).rejects.toThrow('retry key');
     });
     it('requires a date for pending follow-ups and a valid version for updates', async () => {
          const { service } = setup({ lead_followups: [{ id: 3, lead_id: 1, version: 2, assigned_to: 7, status: 'pending' }] });
          await expect(service.saveFollowup(actor, { lead_id: 1, followup_type: 'call', status: 'pending', priority: 'medium', notes: 'Call doctor' })).rejects.toThrow('next-action date');
          await expect(service.saveFollowup(actor, { version: 1, status: 'completed' }, 3)).rejects.toThrow('changed');
     });
     it('requires an independent reviewer for managers and retains pending state after failure', async () => {
          const { service, store } = setup({ crm_commission_proposals: [{ id: 2, lead_id: 1, status: 'pending', proposed_by: 8 }] });
          await expect(service.reviewProposal(manager, 1, 2, { decision: 'approved', version: 1, notes: 'Agreed' })).rejects.toThrow('different');
          expect(store.rows('crm_commission_proposals')[0].status).toBe('pending');
     });
     it.each(['manager', 'admin', 'super_admin'])('freezes terms and prevents double approval for %s, including administrator self approval', async (role) => {
          const reviewer = { ...manager, role };
          const config = { id: 10000, name: 'Ten percent', commission_type: 'percentage', percentage_rate: '10.00', effective_from: '2026-01-01', effective_to: null, is_active: true, crm_agreement_proposal_id: null };
          const reversed = Object.fromEntries(Object.entries(config).reverse());
          const { service, store } = setup({ leads: [{ id: 1, assigned_to: 7, branchid: 4, version: 1, prospect_type: 'clinician', referrer_id: 11 }],
               clinicianbasicinfo: [{ id: 11 }], commission_configs: [config], commission_tiers: [],
               crm_commission_proposals: [{ id: 2, lead_id: 1, status: 'pending', proposed_by: role === 'manager' ? 7 : 8, commission_config_id: 10000, effective_from: now, effective_to: null, terms_snapshot: JSON.stringify({ config: reversed, tiers: [] }) }],
               commission_assignments: [{ id: 5, scope_type: 'clinician', scope_id: 11, is_active: true, service_id: null, service_category: null, assigned_from: '2026-01-01', assigned_to: null }],
          });
          await service.reviewProposal(reviewer, 1, 2, { decision: 'approved', version: 1, notes: 'Negotiated terms verified' });
          const frozen = store.rows('commission_configs').find(row => row.crm_agreement_proposal_id === 2)!;
          expect(frozen).toMatchObject({ percentage_rate: '10.00', effective_from: now });
          expect(frozen.id).not.toBe(10000);
          expect(store.rows('commission_assignments')[0]).toMatchObject({ is_active: true });
          expect(store.rows('commission_assignments')[0].assigned_to).not.toBeNull();
          expect(store.rows('commission_assignments')[1].commission_config_id).toBe(frozen.id);
          expect(store.rows('crm_commission_proposals')[0]).toMatchObject({ status: 'approved', reviewed_by: 8 });
          await expect(service.reviewProposal(reviewer, 1, 2, { decision: 'approved', version: 1, notes: 'Retry' })).rejects.toThrow('already reviewed');
          expect(store.rows('commission_configs')).toHaveLength(2);
     });
});
