import { negotiatedTerms, applyNegotiatedTerms } from './negotiatedTerms';
import { relationshipHandover } from './relationshipHandover';
import { z } from 'zod';
import { createHash } from 'crypto';
import KnexConnection from '../../database/KnexConnections';
import type { AuthUser } from '../../middleware/authority';
import { crmManager } from '../../middleware/crmAuthority';
import { roleAllowed } from '../../middleware/roles';
import { QuickReferralEntityService } from '../referral/QuickReferralEntityService';
import { normalizeQuickReferralEntity } from '../referral/quickReferralEntity';

export const crmFail = (message: string, statusCode = 400): never => { throw Object.assign(new Error(message), { statusCode }); };
export const crmDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const date = new Date(`${value}T00:00:00Z`); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; }, 'Invalid calendar date');
const optionalDate = z.preprocess(value => value === '' ? null : value, crmDate.nullable().optional());
const owner = z.number().int().positive().nullable().optional();
const leadSchema = z.object({
     display_name: z.string().trim().min(2).max(255), prospect_type: z.enum(['clinician', 'organization']),
     contact_person: z.string().trim().min(1).max(255), contact_phone: z.string().trim().min(5).max(50),
     contact_email: z.preprocess(value => value === '' ? null : value, z.string().trim().email().max(255).nullable().optional()),
     company_name: z.string().trim().max(255).optional(), location: z.string().trim().min(1).max(255),
     lead_source: z.enum(['website', 'referral', 'social_media', 'cold_call', 'trade_show']), priority: z.enum(['low', 'medium', 'high', 'urgent']),
     acquisition_stage: z.enum(['prospect', 'contacted', 'pitched', 'negotiation', 'agreement_pending', 'acquired', 'active', 'lost']),
     assigned_to: owner, notes: z.string().max(10000).optional()
});
const followSchema = z.object({
     lead_id: z.number().int().positive(), followup_type: z.enum(['call', 'email', 'meeting', 'visit', 'other']),
     notes: z.string().trim().min(1).max(10000), followup_date: optionalDate, next_followup_date: optionalDate,
     assigned_to: owner, priority: z.enum(['low', 'medium', 'high', 'urgent']), status: z.enum(['pending', 'completed', 'cancelled'])
});
const stable = (value: any) => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.keys(item).sort().reduce((result, key) => { result[key] = item[key]; return result; }, {} as any) : item);
const today = () => new Date().toISOString().slice(0, 10);
export class CrmService {
     constructor(private tenantId: number) { }
     private scoped(db: any, actor: AuthUser, alias = 'lead') {
          let query = db(`leads as ${alias}`).whereNull(`${alias}.archived_at`);
          if (!crmManager(actor)) query = query.where(`${alias}.assigned_to`, actor.employeeid);
          if (actor.branch != null) query = query.where((q: any) => q.where(`${alias}.branchid`, actor.branch).orWhereNull(`${alias}.branchid`));
          return query;
     }
     async lead(db: any, actor: AuthUser, id: number, lock = false) {
          if (!Number.isSafeInteger(id) || id <= 0) crmFail('Invalid prospect ID');
          let query = this.scoped(db, actor).where('lead.id', id).select('lead.*');
          if (lock) query = query.forUpdate();
          const row = await query.first();
          if (!row) crmFail('Prospect not found in your portfolio', 404);
          return row;
     }
     private async audit(db: any, actor: AuthUser, id: number, action: string, notes?: string, metadata?: any) {
          await db('crm_activities').insert({ lead_id: id, action, employeeid: actor.employeeid, notes: notes || null, metadata: metadata ? JSON.stringify(metadata) : null, created_at: new Date() });
     }
     private async validateOwner(db: any, actor: AuthUser, id: number | null | undefined) {
          if (!id) return;
          const staff = await db('roles').where({ employeeid: id }).first();
          if (!staff || Number(staff.activation) === 0 || !roleAllowed(staff.role, ['marketer', 'admin', 'manager', 'customer service representative']) || actor.branch != null && Number(staff.branch) !== Number(actor.branch)) crmFail('Choose an active CRM owner in your branch');
     }
     async options(actor: AuthUser, search = '') {
          const db = await KnexConnection(this.tenantId);
          let staffQuery = db('roles').select('employeeid', 'username', 'role', 'branch', 'activation');
          if (actor.branch != null) staffQuery = staffQuery.where('branch', actor.branch);
          if (!crmManager(actor)) staffQuery = staffQuery.where('employeeid', actor.employeeid);
          const staff = (await staffQuery).filter(row => Number(row.activation) !== 0 && roleAllowed(row.role, ['marketer', 'admin', 'manager', 'customer service representative']));
          const lookup = (table: string) => db(table).select('id', 'name').where('name', 'like', `%${search.trim().slice(0, 80)}%`).orderBy('name').limit(50);
          const [clinicians, organizations, configs] = await Promise.all([lookup('clinicianbasicinfo'), lookup('organization'), db('commission_configs').where({ is_active: true }).whereNull('crm_agreement_proposal_id').select('id', 'name', 'commission_type', 'percentage_rate', 'fixed_component', 'effective_from', 'effective_to').orderBy('name')]);
          return { staff, clinicians, organizations, configs, manager: crmManager(actor), canApproveOwnAgreement: roleAllowed(actor.role, ['admin']), tenantId: actor.tenantId };
     }
     async list(actor: AuthUser, filters: any = {}) {
          const db = await KnexConnection(this.tenantId);
          const page = Math.max(1, Math.floor(Number(filters.page) || 1)), count = Math.min(100, Math.max(1, Math.floor(Number(filters.count) || 20)));
          let query = this.scoped(db, actor);
          if (filters.search) query = query.where((q: any) => { for (const column of ['display_name', 'firstname', 'lastname', 'company_name', 'contact_phone', 'contact_email']) q.orWhere(`lead.${column}`, 'like', `%${String(filters.search).slice(0, 100)}%`); });
          if (filters.stage) query = query.where('lead.acquisition_stage', filters.stage);
          if (filters.owner && crmManager(actor)) query = query.where('lead.assigned_to', Number(filters.owner));
          const total = Number((await query.clone().count('* as count').first())?.count || 0);
          const data = await query.leftJoin('roles as owner', 'owner.employeeid', 'lead.assigned_to').select('lead.*', 'owner.username as owner_name').orderBy('lead.updated_at', 'desc').limit(count).offset((page - 1) * count);
          return { data, total, page, totalPages: Math.ceil(total / count) };
     }
     async detail(actor: AuthUser, id: number) {
          const db = await KnexConnection(this.tenantId); const lead = await this.lead(db, actor, id);
          const [activities, followups, proposals] = await Promise.all([
               db('crm_activities as activity').leftJoin('roles as staff', 'staff.employeeid', 'activity.employeeid').where('activity.lead_id', id).select('activity.*', 'staff.username').orderBy('activity.id', 'desc').limit(100),
               db('lead_followups').where({ lead_id: id }).whereNull('archived_at').orderBy('created_at', 'desc').limit(100),
               db('crm_commission_proposals').where({ lead_id: id }).orderBy('id', 'desc').limit(50),
          ]);
          const assignments = lead.referrer_id ? await db('commission_assignments').where({ scope_type: lead.prospect_type, scope_id: lead.referrer_id }).whereNull('service_id').whereNull('service_category').orderBy('assigned_from', 'desc') : [];
          let referralQuery = lead.referrer_id ? db('dboservices').where(lead.prospect_type === 'organization' ? 'organizationId' : 'clinicianId', lead.referrer_id).where('status', 'active').whereRaw('COALESCE(isRefunded, 0) = 0') : null;
          if (referralQuery && actor.branch != null) referralQuery = referralQuery.where('branchid', actor.branch);
          const firstReferral = referralQuery ? await referralQuery.orderBy('serviceAddedOn', 'asc').select('serviceAddedOn').first() : null;
          const pendingProposal = await db('crm_commission_proposals').where({ lead_id: id, status: 'pending' }).first();
          const onboarding = await db('crm_onboarding').where({ lead_id: id });
          const approvedAgreements = await db('crm_commission_proposals').where({ lead_id: id, status: 'approved' }).select('id', 'effective_from', 'effective_to', 'assignment_id').orderBy('effective_from', 'desc');
          return { lead, activities, followups, proposals, pendingProposal, onboarding, approvedAgreements, historyLimits: { activities: 100, followups: 100, proposals: 50 }, handover: relationshipHandover(lead, assignments, firstReferral) };
     }
     async save(actor: AuthUser, input: any, id?: number) {
          const data = (id ? leadSchema.partial() : leadSchema).parse(input);
          const db = await KnexConnection(this.tenantId);
          return db.transaction(async trx => {
               const prior = id ? await this.lead(trx, actor, id, true) : null;
               if (prior && Number(input.version) !== Number(prior.version)) crmFail('Prospect changed. Reload before saving.', 409);
               if (!crmManager(actor) && data.assigned_to !== undefined && data.assigned_to !== actor.employeeid) crmFail('Only a manager can reassign a prospect', 403);
               if (data.prospect_type && prior?.referrer_id && data.prospect_type !== prior.prospect_type) crmFail('A linked referrer type cannot be changed');
               if (data.acquisition_stage === 'active' || data.acquisition_stage === 'acquired') {
                    const agreement = prior?.referrer_id && await trx('crm_commission_proposals').where({ lead_id: id, status: 'approved' }).first();
                    if (!agreement) crmFail('Link the referrer and approve an agreement before marking it active');
               }
               const assigned_to = data.assigned_to === undefined ? prior?.assigned_to ?? actor.employeeid : data.assigned_to;
               await this.validateOwner(trx, actor, assigned_to);
               const now = new Date();
               const record: any = { ...data, ...(data.acquisition_stage === 'active' ? { acquisition_stage: 'acquired' } : {}), assigned_to, updated_at: now };
               const merged = { ...prior, ...data };
               if (merged.display_name && ['clinician', 'organization'].includes(merged.prospect_type)) {
                    record.fingerprint = createHash('sha256').update(`${merged.prospect_type}:${merged.display_name.trim().toLowerCase().replace(/\s+/g, ' ')}:${String(merged.contact_phone || '').replace(/[^\d+]/g, '')}`).digest('hex');
                    const duplicate = await trx('leads').where({ fingerprint: record.fingerprint }).first();
                    if (duplicate && Number(duplicate.id) !== Number(id)) crmFail('A matching referrer prospect already exists. Ask a manager to check its assignment.', 409);
               }
               if (!prior) Object.assign(record, { firstname: data.display_name, lastname: '-', industry_type: 'healthcare', status: 'new', branchid: actor.branch, created_by: actor.employeeid, created_at: now });
               else record.version = Number(prior.version) + 1;
               let leadId = id;
               if (leadId) await trx('leads').where({ id: leadId }).update(record); else[leadId] = await trx('leads').insert(record);
               if (prior?.referrer_id && assigned_to && Number(prior.assigned_to) !== Number(assigned_to)) {
                    await trx('crm_ownership_history').where({ entity_type: prior.prospect_type, entity_id: prior.referrer_id }).whereNull('valid_to').update({ valid_to: now });
                    await trx('crm_ownership_history').insert({ entity_type: prior.prospect_type, entity_id: prior.referrer_id, marketer_id: assigned_to, branchid: prior.branchid, valid_from: now });
               }
               if (prior?.referrer_id && assigned_to) await trx('crm_referrer_portfolios').where({ entity_type: prior.prospect_type, entity_id: prior.referrer_id }).update({ marketer_id: assigned_to, updated_at: now });
               if (prior?.referrer_id && !assigned_to) crmFail('Assign an owner before removing a linked portfolio owner');
               if (prior && prior.assigned_to !== assigned_to) await trx('lead_followups').where({ lead_id: id, status: 'pending', assigned_to: prior.assigned_to }).update({ assigned_to, updated_at: now, version: trx.raw('version + 1') });
               await this.audit(trx, actor, leadId!, prior ? 'prospect_updated' : 'prospect_created', input.change_reason, { before: prior, changes: record });
               return this.lead(trx, actor, leadId!);
          });
     }
     async link(actor: AuthUser, id: number, input: any) {
          if (!crmManager(actor)) crmFail('A manager must link or reassign active referrers', 403);
          const createEntity = z.boolean().optional().parse(input.create_entity) || false;
          let entityId = createEntity ? 0 : z.number().int().positive().parse(Number(input.entity_id));
          const db = await KnexConnection(this.tenantId);
          return db.transaction(async trx => {
               const lead = await this.lead(trx, actor, id, true);
               if (!['clinician', 'organization'].includes(lead.prospect_type)) crmFail('Classify this prospect before linking it');
               if (!lead.assigned_to) crmFail('Assign a marketer before linking the referrer');
               if (createEntity) {
                    const normalized = normalizeQuickReferralEntity(lead.prospect_type, { name: lead.display_name || lead.firstname, email: lead.contact_email });
                    if (!normalized.value) return crmFail(normalized.error || 'Invalid referrer details');
                    if (lead.contact_phone && !/^\+?[\d\s().-]{5,50}$/.test(lead.contact_phone)) crmFail('Enter a valid referrer contact phone before creating the entity');
                    normalized.value.phone = lead.contact_phone || null;
                    const creator = new QuickReferralEntityService(this.tenantId);
                    const entity = lead.prospect_type === 'clinician' ? await creator.createClinician(normalized.value, trx) : await creator.createOrganization(normalized.value, trx);
                    if (!entity.created && lead.prospect_type === 'clinician' && entity.name.trim().toLowerCase().replace(/\s+/g, ' ') !== normalized.value.name.toLowerCase().replace(/\s+/g, ' ')) crmFail('This phone matches another clinician name. Search and select the correct referrer explicitly, or correct the contact details.', 409);
                    entityId = entity.id;
               }
               if (lead.referrer_id && Number(lead.referrer_id) !== entityId) crmFail('This prospect is already linked to another referrer', 409);
               const entity = await trx(lead.prospect_type === 'clinician' ? 'clinicianbasicinfo' : 'organization').where({ id: entityId }).forUpdate().first();
               if (!entity) crmFail('Referrer not found', 404);
               const existing = await trx('crm_referrer_portfolios').where({ entity_type: lead.prospect_type, entity_id: entityId }).first();
               if (existing && Number(existing.lead_id) !== id) crmFail('This referrer is already linked to another prospect', 409);
               if (!existing) await trx('crm_referrer_portfolios').insert({ entity_type: lead.prospect_type, entity_id: entityId, marketer_id: lead.assigned_to, branchid: lead.branchid, lead_id: id, updated_at: new Date() });
               if (!existing) await trx('crm_ownership_history').insert({ entity_type: lead.prospect_type, entity_id: entityId, marketer_id: lead.assigned_to, branchid: lead.branchid, valid_from: new Date() });
               await trx('leads').where({ id }).update({ referrer_id: entityId, version: Number(lead.version) + 1, updated_at: new Date() });
               await this.audit(trx, actor, id, 'referrer_linked', input.notes, { entity_type: lead.prospect_type, entity_id: entityId });
               return this.lead(trx, actor, id);
          });
     }
     async archive(actor: AuthUser, id: number) {
          if (!crmManager(actor)) crmFail('Only a manager can archive prospects', 403);
          const db = await KnexConnection(this.tenantId);
          await db.transaction(async trx => { const lead = await this.lead(trx, actor, id, true); if (lead.referrer_id) crmFail('Linked referrers must remain in the portfolio; mark an inactive prospect lost instead'); await trx('leads').where({ id }).update({ archived_at: new Date() }); await this.audit(trx, actor, id, 'prospect_archived'); });
          return { archived: true };
     }
     async followups(actor: AuthUser, filters: any = {}) {
          const db = await KnexConnection(this.tenantId);
          let query = this.scoped(db, actor).join('lead_followups as followup', 'followup.lead_id', 'lead.id').whereNull('followup.archived_at');
          if (!crmManager(actor)) query = query.where('followup.assigned_to', actor.employeeid);
          if (filters.id) query = query.where('followup.id', Number(filters.id));
          if (filters.due === 'due') query = query.where('followup.status', 'pending').where('followup.next_followup_date', '<=', today());
          if (filters.lead_id) query = query.where('lead.id', Number(filters.lead_id));
          if (filters.status) query = query.where('followup.status', filters.status);
          if (filters.search) query = query.where((q: any) => q.where('lead.display_name', 'like', `%${String(filters.search).slice(0, 100)}%`).orWhere('followup.notes', 'like', `%${String(filters.search).slice(0, 100)}%`));
          const all = query.clone();
          if (filters.due === 'overdue') query = query.where('followup.status', 'pending').where('followup.next_followup_date', '<', today());
          if (filters.due === 'today') query = query.where('followup.status', 'pending').where('followup.next_followup_date', today());
          const summary = await all.select(db.raw("SUM(followup.status = 'pending' AND followup.next_followup_date < ?) as overdue, SUM(followup.status = 'pending' AND followup.next_followup_date = ?) as today, SUM(followup.status = 'pending') as pending", [today(), today()])).first();
          const page = Math.max(1, Math.floor(Number(filters.page) || 1)), count = Math.min(100, Math.max(1, Math.floor(Number(filters.count) || 20)));
          const total = Number((await query.clone().count('* as count').first())?.count || 0);
          const data = await query.select('followup.*', 'lead.display_name', 'lead.firstname', 'lead.company_name').orderByRaw("CASE followup.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END").orderBy('followup.next_followup_date', 'asc').limit(count).offset((page - 1) * count);
          return { data, summary, total, page, totalPages: Math.ceil(total / count) };
     }
     async saveFollowup(actor: AuthUser, input: any, id?: number) {
          const data = (id ? followSchema.partial().omit({ lead_id: true }) : followSchema).parse(input);
          const db = await KnexConnection(this.tenantId);
          return db.transaction(async trx => {
               let old = id ? await trx('lead_followups').where({ id }).first() : null;
               if (id && (!old || old.archived_at)) crmFail('Follow-up not found', 404);
               const lead = await this.lead(trx, actor, old?.lead_id || (data as any).lead_id, true);
               if (id) {
                    old = await trx('lead_followups').where({ id }).forUpdate().first();
                    if (Number(input.version) !== Number(old.version)) crmFail('Follow-up changed. Reload before saving.', 409);
               }
               if (!crmManager(actor) && old && old.assigned_to != null && Number(old.assigned_to) !== actor.employeeid) crmFail('This follow-up belongs to another CRM user', 403);
               const assigned_to = data.assigned_to === undefined ? old?.assigned_to || lead.assigned_to || actor.employeeid : data.assigned_to;
               if (!lead.assigned_to || Number(assigned_to) !== Number(lead.assigned_to)) crmFail('Assign the follow-up to the prospect owner, or reassign the prospect first');
               if (!crmManager(actor) && assigned_to !== actor.employeeid) crmFail('Only a manager can assign another CRM user', 403);
               await this.validateOwner(trx, actor, assigned_to);
               if ((data.status || old?.status) === 'pending' && !(data.next_followup_date === undefined ? old?.next_followup_date : data.next_followup_date)) crmFail('Pending follow-ups require a next-action date');
               const record: any = { ...data, assigned_to, updated_at: new Date() };
               if (id) record.version = Number(old.version) + 1;
               else if (input.idempotency_key) {
                    const key = z.string().min(1).max(100).parse(input.idempotency_key);
                    const hash = createHash('sha256').update(stable({ ...data, assigned_to })).digest('hex');
                    const prior = await trx('lead_followups').where({ request_key: key }).first();
                    if (prior) { if (prior.request_hash !== hash || Number(prior.lead_id) !== Number(lead.id)) crmFail('This retry key was used for another follow-up', 409); return prior; }
                    record.request_key = key; record.request_hash = hash;
               }
               if (id) await trx('lead_followups').where({ id }).update(record);
               else { record.created_by = actor.employeeid; record.created_at = new Date();[id] = await trx('lead_followups').insert(record); }
               await this.audit(trx, actor, lead.id, old ? 'followup_updated' : 'followup_recorded', data.notes, { followup_id: id, before: old, changes: record });
               return trx('lead_followups').where({ id }).first();
          });
     }
     async propose(actor: AuthUser, id: number, input: any) {
          const data = z.object({ commission_config_id: z.number().int().positive(), effective_from: crmDate, effective_to: optionalDate, notes: z.string().trim().min(3).max(2000), negotiated: negotiatedTerms.optional() }).parse(input);
          if (data.effective_from < today() || data.effective_to && data.effective_to < data.effective_from) crmFail('Use a current or future agreement date range');
          const db = await KnexConnection(this.tenantId);
          return db.transaction(async trx => {
               const lead = await this.lead(trx, actor, id, true);
               if (!lead.referrer_id) crmFail('Ask a manager to link the clinician or organization first');
               if (await trx('crm_commission_proposals').where({ lead_id: id, status: 'pending' }).first()) crmFail('A commission proposal is already awaiting review', 409);
               const config = await trx('commission_configs').where({ id: data.commission_config_id, is_active: true }).whereNull('crm_agreement_proposal_id').first();
               if (!config) crmFail('Commission configuration is unavailable');
               const configFrom = new Date(config.effective_from).toISOString().slice(0, 10), configTo = config.effective_to ? new Date(config.effective_to).toISOString().slice(0, 10) : null;
               if (data.effective_from < configFrom || configTo && (!data.effective_to || data.effective_to > configTo)) crmFail('Agreement dates must be within the commission plan validity');
               const tiers = await trx('commission_tiers').where({ commission_config_id: config.id }).orderBy('sort_order');
               applyNegotiatedTerms(config, data.negotiated, actor);
               const { negotiated, ...proposalData } = data;
               const [proposalId] = await trx('crm_commission_proposals').insert({ ...proposalData, lead_id: id, proposed_by: actor.employeeid, status: 'pending', terms_snapshot: JSON.stringify({ config, tiers, ...(negotiated ? { negotiated } : {}) }), created_at: new Date() });
               await trx('leads').where({ id }).update({ acquisition_stage: (await trx('crm_commission_proposals').where({ lead_id: id, status: 'approved' }).first()) ? 'acquired' : 'agreement_pending', version: Number(lead.version) + 1, updated_at: new Date() });
               await this.audit(trx, actor, id, 'commission_proposed', data.notes, { proposal_id: proposalId, ...data });
               return { id: proposalId };
          });
     }
     async reviewProposal(actor: AuthUser, id: number, proposalId: number, input: any) {
          if (!crmManager(actor)) crmFail('Only an administrator or manager can approve agreements', 403);
          const data = z.object({ decision: z.enum(['approved', 'rejected']), notes: z.string().trim().min(3).max(2000), version: z.number().int().positive() }).parse(input);
          const db = await KnexConnection(this.tenantId);
          return db.transaction(async trx => {
               const lead = await this.lead(trx, actor, id, true);
               const proposal = await trx('crm_commission_proposals').where({ id: proposalId, lead_id: id }).forUpdate().first();
               if (!proposal) crmFail('Proposal not found', 404);
               if (proposal.status !== 'pending') crmFail('This proposal was already reviewed', 409);
               if (Number(proposal.version || 1) !== data.version) return crmFail('Proposal changed. Reload and review the revised terms.', 409);
               if (Number(proposal.proposed_by) === Number(actor.employeeid) && !roleAllowed(actor.role, ['admin'])) crmFail('A different administrator or manager must review this proposal', 403);
               let assignmentId: number | null = null;
               if (data.decision === 'approved') {
                    const from = String(proposal.effective_from instanceof Date ? proposal.effective_from.toISOString().slice(0, 10) : proposal.effective_from).slice(0, 10);
                    if (from < today()) crmFail('The proposed start date has passed. Reject and submit new current terms');
                    const config = await trx('commission_configs').where({ id: proposal.commission_config_id, is_active: true }).forUpdate().first();
                    const snapshot = typeof proposal.terms_snapshot === 'string' ? JSON.parse(proposal.terms_snapshot) : proposal.terms_snapshot;
                    const tiers = await trx('commission_tiers').where({ commission_config_id: proposal.commission_config_id }).orderBy('sort_order');
                    if (!config || stable(config) !== stable(snapshot.config) || stable(tiers) !== stable(snapshot.tiers)) crmFail('Commission terms changed. Reject and submit a new proposal', 409);
                    // Freeze negotiated terms in a dedicated configuration; later template edits must not change this agreement.
                    const agreedConfig = applyNegotiatedTerms(config, snapshot.negotiated, { ...actor, role: 'admin' });
                    const { id: templateId, created_at: _created, updated_at: _updated, ...frozenTerms } = agreedConfig;
                    const [approvedConfigId] = await trx('commission_configs').insert({
                         ...frozenTerms, name: `CRM agreement ${proposalId}: ${config.name}`.slice(0, 255),
                         crm_agreement_proposal_id: proposalId, effective_from: from, effective_to: proposal.effective_to || null, created_at: new Date(), updated_at: new Date()
                    });
                    if (tiers.length) await trx('commission_tiers').insert(tiers.map(({ id: tierId, commission_config_id: _configId, created_at: _tierCreated, ...tier }) => ({ ...tier, commission_config_id: approvedConfigId, created_at: new Date() })));
                    const entityTable = lead.prospect_type === 'clinician' ? 'clinicianbasicinfo' : 'organization';
                    if (!lead.referrer_id || !await trx(entityTable).where({ id: lead.referrer_id }).forUpdate().first()) crmFail('Linked referrer is unavailable');
                    const existing = trx('commission_assignments').where({ scope_type: lead.prospect_type, scope_id: lead.referrer_id, is_active: true }).whereNull('service_id').whereNull('service_category');
                    if (await existing.clone().where('assigned_from', '>=', from).first()) crmFail('An agreement already starts on or after this date; resolve it in commission settings', 409);
                    const previousEnd = new Date(`${from}T00:00:00Z`); previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
                    await existing.clone().where((q: any) => q.whereNull('assigned_to').orWhere('assigned_to', '>=', from)).update({ assigned_to: previousEnd.toISOString().slice(0, 10) });
                    [assignmentId] = await trx('commission_assignments').insert({
                         commission_config_id: approvedConfigId, scope_type: lead.prospect_type, scope_id: lead.referrer_id,
                         service_id: null, service_category: null, priority: 50, assigned_from: from, assigned_to: proposal.effective_to || null, is_active: true, created_at: new Date()
                    });
               }
               await trx('crm_commission_proposals').where({ id: proposalId }).update({ status: data.decision, review_notes: data.notes, reviewed_by: actor.employeeid, reviewed_at: new Date(), assignment_id: assignmentId, version: data.version + 1 });
               await trx('leads').where({ id }).update({ acquisition_stage: data.decision === 'approved' || await trx('crm_commission_proposals').where({ lead_id: id, status: 'approved' }).first() ? 'acquired' : 'negotiation', version: Number(lead.version) + 1, updated_at: new Date() });
               await this.audit(trx, actor, id, `commission_${data.decision}`, data.notes, { proposal_id: proposalId, assignment_id: assignmentId });
               return { status: data.decision, assignment_id: assignmentId };
          });
     }
}
