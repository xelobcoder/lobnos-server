import { z } from 'zod';
import KnexConnection from '../../database/KnexConnections';
import type { AuthUser } from '../../middleware/authority';
import { crmManager } from '../../middleware/crmAuthority';
import { roleAllowed } from '../../middleware/roles';
import { CrmService, crmDate, crmFail } from './CrmService';
import ApplicationSettings from '../application/appsettings/appset';
import { CommissionCalculator } from '../commissions/commission-configurations/utils/CommissionCalculator';

import { negotiatedTerms, applyNegotiatedTerms } from './negotiatedTerms';

export class CrmWorkflowService {
     constructor(private tenantId: number) {}
     private async audit(db: any, actor: AuthUser, leadId: number, action: string, notes: string, metadata: any) {
          await db('crm_activities').insert({ lead_id: leadId, action, employeeid: actor.employeeid, notes, metadata: JSON.stringify(metadata), created_at: new Date() });
     }
     async onboarding(actor: AuthUser, id: number, input: any) {
          const data = z.object({ proposal_id: z.number().int().positive(), step: z.enum(['terms_communicated', 'reception_informed', 'first_referral_verified']),
               completed: z.boolean(), notes: z.string().trim().min(3).max(2000), due_date: crmDate.nullable().optional(), version: z.number().int().min(0) }).parse(input);
          const db = await KnexConnection(this.tenantId);
          return db.transaction(async trx => {
               const lead = await new CrmService(this.tenantId).lead(trx, actor, id, true);
               const proposal = await trx('crm_commission_proposals').where({ id: data.proposal_id, lead_id: id, status: 'approved' }).first();
               if (!proposal) return crmFail('An approved agreement is required');
               const key = { lead_id: id, proposal_id: data.proposal_id, step: data.step };
               const old = await trx('crm_onboarding').where(key).forUpdate().first();
               if (Number(old?.version || 0) !== data.version) return crmFail('Onboarding changed. Reload before saving.', 409);
               if (data.completed && data.step === 'first_referral_verified') {
                    let query = trx('dboservices').where(lead.prospect_type === 'clinician' ? 'clinicianId' : 'organizationId', lead.referrer_id)
                         .where('status', 'active').whereRaw('COALESCE(isRefunded, 0) = 0').where('serviceAddedOn', '>=', proposal.effective_from);
                    if (actor.branch != null) query = query.where('branchid', actor.branch);
                    const assignment = proposal.assignment_id ? await trx('commission_assignments').where({ id: proposal.assignment_id }).first() : null;
                    const until = assignment?.assigned_to || proposal.effective_to;
                    if (until) query = query.whereRaw('serviceAddedOn < DATE_ADD(?, INTERVAL 1 DAY)', [until]);
                    if (!await query.first()) return crmFail('No active referral exists within this agreement period and your branch scope');
               }
               const record = { ...key, notes: data.notes, due_date: data.due_date || null, completed_by: data.completed ? actor.employeeid : null,
                    completed_at: data.completed ? new Date() : null, version: data.version + 1 };
               if (old) await trx('crm_onboarding').where({ id: old.id }).update(record); else await trx('crm_onboarding').insert(record);
               await this.audit(trx, actor, id, 'onboarding_updated', data.notes, { before: old, changes: record, responsible_employeeid: lead.assigned_to });
               return record;
          });
     }
     async amend(actor: AuthUser, id: number, proposalId: number, input: any) {
          const data = z.object({ effective_from: crmDate, effective_to: crmDate.nullable().optional(), notes: z.string().trim().min(3).max(2000), version: z.number().int().positive() }).parse(input);
          if (data.effective_from < new Date().toISOString().slice(0, 10) || data.effective_to && data.effective_to < data.effective_from) return crmFail('Use a current or future valid date range');
          const db = await KnexConnection(this.tenantId);
          return db.transaction(async trx => {
               await new CrmService(this.tenantId).lead(trx, actor, id, true);
               const old = await trx('crm_commission_proposals').where({ id: proposalId, lead_id: id }).forUpdate().first();
               if (!old || old.status !== 'pending') return crmFail('Only pending proposals can be amended', 409);
               if (!crmManager(actor) && Number(old.proposed_by) !== Number(actor.employeeid)) return crmFail('Only the proposer or a manager can amend this proposal', 403);
               if (Number(old.version || 1) !== data.version) return crmFail('Proposal changed. Reload before amending.', 409);
               const config = await trx('commission_configs').where({ id: old.commission_config_id, is_active: true }).first();
               if (!config) return crmFail('Commission plan is unavailable');
               const day = (v: any) => v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
               if (data.effective_from < day(config.effective_from) || config.effective_to && (!data.effective_to || data.effective_to > day(config.effective_to))) return crmFail('Dates must fit the plan validity');
               const previousSnapshot = typeof old.terms_snapshot === 'string' ? JSON.parse(old.terms_snapshot) : old.terms_snapshot;
               const tiers = await trx('commission_tiers').where({ commission_config_id: config.id }).orderBy('sort_order');
               // Refresh the template explicitly, retaining any negotiated rates; the amendment is a new submission by this actor.
               const terms = previousSnapshot.negotiated || {};
               if (Object.keys(terms).length && !roleAllowed(actor.role, ['admin'])) return crmFail('An administrator must amend negotiated calculation terms', 403);
               applyNegotiatedTerms(config, terms, actor);
               const changes = { effective_from: data.effective_from, effective_to: data.effective_to || null, notes: data.notes,
                    terms_snapshot: JSON.stringify({ config, tiers, ...(Object.keys(terms).length ? { negotiated: terms } : {}) }), proposed_by: actor.employeeid, version: data.version + 1 };
               await trx('crm_commission_proposals').where({ id: proposalId }).update(changes);
               await this.audit(trx, actor, id, 'proposal_amended', data.notes, { proposal_id: proposalId, before: old, changes });
               return { id: proposalId, version: data.version + 1 };
          });
     }
     async history(actor: AuthUser, id: number, input: any) {
          const data = z.object({ kind: z.enum(['activities', 'followups', 'proposals']), page: z.coerce.number().int().min(1).default(1) }).parse(input);
          const db = await KnexConnection(this.tenantId); await new CrmService(this.tenantId).lead(db, actor, id);
          const tables = { activities: 'crm_activities', followups: 'lead_followups', proposals: 'crm_commission_proposals' };
          const query = db(tables[data.kind]).where({ lead_id: id });
          if (data.kind === 'followups') query.whereNull('archived_at');
          const total = Number((await query.clone().count('* as count').first())?.count || 0);
          return { data: await query.orderBy('id', 'desc').limit(25).offset((data.page - 1) * 25), total, page: data.page, totalPages: Math.ceil(total / 25), kind: data.kind };
     }
     async preview(actor: AuthUser, id: number, input: any) {
          const data = z.object({ commission_config_id: z.number().int().positive(), effective_from: crmDate, amount: z.number().min(0).max(10000000), negotiated: negotiatedTerms.optional() }).parse(input);
          const db = await KnexConnection(this.tenantId); const lead = await new CrmService(this.tenantId).lead(db, actor, id);
          const template = await db('commission_configs').where({ id: data.commission_config_id, is_active: true }).whereNull('crm_agreement_proposal_id').first();
          if (!template) return crmFail('Commission plan unavailable');
          const config = applyNegotiatedTerms(template, data.negotiated, actor);
          const settings = await new ApplicationSettings().getAllAppSettings(this.tenantId);
          const policy = settings?.commissionRecipientPolicy === 'organization' ? 'organization' : 'clinician';
          const assignments = lead.referrer_id ? await db('commission_assignments').where({ scope_type: lead.prospect_type, scope_id: lead.referrer_id, is_active: true })
               .where('assigned_from', '<=', data.effective_from).where((q: any) => q.whereNull('assigned_to').orWhere('assigned_to', '>=', data.effective_from)).orderBy('priority', 'desc') : [];
          const validDay = (value: any) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10);
          const outsideValidity = config.effective_from && data.effective_from < validDay(config.effective_from) || config.effective_to && data.effective_from > validDay(config.effective_to);
          const raw = ['percentage', 'fixed', 'hybrid'].includes(config.commission_type) ? CommissionCalculator.calculateRawCommission(config, data.amount) : null;
          const capped = raw == null ? null : Math.min(config.max_commission == null ? Infinity : Number(config.max_commission), Math.max(Number(config.min_commission || 0), raw));
          return { policy, linked: Boolean(lead.referrer_id), config, sample_amount: data.amount, sample_commission_before_period_limits: capped,
               existing_assignments: assignments.map(row => ({ id: row.id, priority: row.priority, service_id: row.service_id, service_category: row.service_category, commission_config_id: row.commission_config_id })),
               warnings: [outsideValidity ? 'The preview date falls outside the plan validity; choose valid dates before submitting.' : null, !lead.referrer_id ? 'Link the referrer before submitting.' : null,
                    policy !== lead.prospect_type ? 'Recipient selection depends on clinician/organization attribution and facility policy; this agreement may not be the recipient on a case.' : null,
                    assignments.some(row => Number(row.priority) >= 50 || row.service_id || row.service_category) ? 'Existing assignments may compete with this agreement. Review assignment priority and scope.' : null,
                    'Illustration only: actual completion date, outsourcing costs, tiers, volume, quotas and period caps can change eligibility or amount. No commission has been recorded.'].filter(Boolean) };
     }
     async reconciliation(actor: AuthUser, id: number) {
          const db = await KnexConnection(this.tenantId); const lead = await new CrmService(this.tenantId).lead(db, actor, id);
          const proposals = await db('crm_commission_proposals').where({ lead_id: id, status: 'approved' }).orderBy('effective_from', 'desc');
          const results: any[] = [];
          for (const proposal of proposals.slice(0, 10)) {
               const assignment = await db('commission_assignments').where({ id: proposal.assignment_id }).first();
               let query = db('dboservices').where(lead.prospect_type === 'clinician' ? 'clinicianId' : 'organizationId', lead.referrer_id)
                    .where('status', 'active').whereRaw('COALESCE(isRefunded, 0) = 0').where('serviceAddedOn', '>=', proposal.effective_from);
               if (actor.branch != null) query = query.where('branchid', actor.branch);
               const until = assignment?.assigned_to || proposal.effective_to;
               if (until) query = query.whereRaw('serviceAddedOn < DATE_ADD(?, INTERVAL 1 DAY)', [until]);
               const first = await query.orderBy('serviceAddedOn').select('serviceid', 'serviceAddedOn').first();
               const tracking = first ? await db('commission_tracking').where({ service_id: first.serviceid }).whereNotIn('status', ['voided', 'adjusted']).select('recipient_type', 'recipient_id', 'assignment_id', 'final_commission', 'status') : [];
               results.push({ proposal_id: proposal.id, first_referral_date: first?.serviceAddedOn || null,
                    status: !first ? 'awaiting_referral' : !tracking.length ? 'awaiting_calculation' : tracking.some(row => Number(row.assignment_id) === Number(proposal.assignment_id) && row.recipient_type === lead.prospect_type && Number(row.recipient_id) === Number(lead.referrer_id)) ? 'agreement_applied' : 'different_rule_or_recipient',
                    commission: tracking.filter(row => row.recipient_type === lead.prospect_type && Number(row.recipient_id) === Number(lead.referrer_id)).reduce((sum, row) => sum + Number(row.final_commission || 0), 0) });
          }
          return { data: results, limit: 10, total: proposals.length, note: 'Checks the first active service ordered in each assignment window. Calculation eligibility uses actual completion dates; a different rule requires finance review.' };
     }
}
