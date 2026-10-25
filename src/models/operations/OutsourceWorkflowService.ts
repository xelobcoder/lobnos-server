import { z } from 'zod';
import { createHash } from 'crypto';
import type { AuthUser } from '../../middleware/authority';
import { controlsFail, labSupervisor, assertLabTestAccess, scopeLabWork } from './LabAccessPolicy';
import { controlAudit, assertCriticalRelease } from './CriticalActionService';
import { testPanelCache } from '../../services/cache/testPanelCache';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
export const providerSchema = z.object({ outsourceid: z.number().int().positive(), cost: z.number().min(0).max(10000000), currency: z.literal('GHS').default('GHS'),
     tat_hours: z.number().int().min(1).max(8760), preferred: z.boolean(), active: z.boolean(), effective_from: date, effective_to: date.nullable() });
export const outsourceTransitions: Record<string, string[]> = {
     legacy_pending: ['awaiting_dispatch', 'sent', 'awaiting_results', 'returned', 'cancelled'],
     awaiting_dispatch: ['sent', 'cancelled'], sent: ['awaiting_results', 'returned', 'cancelled'], awaiting_results: ['returned', 'cancelled'],
     returned: ['completed', 'awaiting_results', 'cancelled'], completed: [], cancelled: [],
};
export class OutsourceWorkflowService {
     constructor(private db: any) {}
     async providerOptions() { return this.db('outsourcingorganization').select('outsourceid', 'name', 'contactNumber', 'contactPerson', 'organizationType').orderBy('name'); }
     async organizationServices(actor: AuthUser, outsourceid: number) {
          if (!labSupervisor(actor)) return controlsFail('Only supervisors may configure outsourcing providers', 403);
          if (!await this.db('outsourcingorganization').where({ outsourceid }).first()) return controlsFail('Organization not found', 404);
          const [tests, configured, legacy] = await Promise.all([
               this.db('test_panels').select('id', 'name', 'lab_outsource_version').orderBy('name'),
               this.db('lab_outsource_providers').where({ outsourceid }),
               this.db('outsourceorganizationservices').where({ outsourceid }),
          ]);
          return { tests, configured, legacy };
     }
     async saveOrganizationServices(actor: AuthUser, outsourceid: number, input: any) {
          if (!labSupervisor(actor)) return controlsFail('Only supervisors may configure outsourcing providers', 403);
          const data = z.object({ reason: z.string().trim().min(3).max(2000), services: z.array(z.object({
               testid: z.number().int().positive(), version: z.number().int().min(0), provider: providerSchema,
          })).min(1).max(1000) }).parse(input);
          if (new Set(data.services.map(row => row.testid)).size !== data.services.length) return controlsFail('Choose each test once');
          if (data.services.some(row => row.provider.outsourceid !== outsourceid)) return controlsFail('Provider must match this organization');
          const result = await this.db.transaction(async (trx: any) => {
               const results = [];
               // Lock panels in a stable order. A conflict rolls the entire batch back.
               for (const item of [...data.services].sort((a, b) => a.testid - b.testid)) {
                    const panel = await trx('test_panels').where({ id: item.testid }).forUpdate().first();
                    if (!panel) return controlsFail('Test panel not found', 404);
                    const others = await trx('lab_outsource_providers').where({ testid: item.testid });
                    const providers = others.filter((row: any) => Number(row.outsourceid) !== outsourceid).map((row: any) => ({
                         outsourceid: Number(row.outsourceid), cost: Number(row.cost), currency: row.currency,
                         tat_hours: Number(row.tat_hours), preferred: item.provider.preferred && item.provider.active ? false : Boolean(row.preferred),
                         active: Boolean(row.active), effective_from: this.dateOnly(row.effective_from), effective_to: row.effective_to ? this.dateOnly(row.effective_to) : null,
                    }));
                    providers.push(item.provider);
                    results.push(await this.saveProvidersInTransaction(trx, actor, item.testid, { providers, version: item.version, reason: data.reason }));
               }
               return results;
          });
          await testPanelCache.invalidate(actor.tenantId);
          return result;
     }
     private dateOnly(value: any) { return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10); }
     async providers(testid: number) {
          const configured = await this.db('lab_outsource_providers as provider').join('outsourcingorganization as org', 'org.outsourceid', 'provider.outsourceid').where('provider.testid', testid).select('provider.*', 'org.name');
          const legacy = await this.db('outsourceorganizationservices as service').join('outsourcingorganization as org', 'org.outsourceid', 'service.outsourceid').where('service.generalTestId', testid).select('service.outsourceid', 'service.outsourcePrice', 'org.name');
          return { configured, legacy, options: await this.providerOptions(), version: Number((await this.db('test_panels').where({ id: testid }).first())?.lab_outsource_version || 0) };
     }
     async saveProviders(actor: AuthUser, testid: number, input: any) {
          const result = await this.db.transaction((trx: any) => this.saveProvidersInTransaction(trx, actor, testid, input));
          await testPanelCache.invalidate(actor.tenantId); return result;
     }
     private async saveProvidersInTransaction(trx: any, actor: AuthUser, testid: number, input: any) {
          if (!labSupervisor(actor)) return controlsFail('Only supervisors may configure outsourcing providers', 403);
          const data = z.object({ providers: z.array(providerSchema).max(100), reason: z.string().trim().min(3).max(2000), version: z.number().int().min(0) }).parse(input);
          if (new Set(data.providers.map(p => p.outsourceid)).size !== data.providers.length) return controlsFail('Choose each organization once');
          if (data.providers.filter(p => p.active && p.preferred).length > 1) return controlsFail('Choose only one active preferred provider');
          for (const row of data.providers) if (row.effective_to && row.effective_to < row.effective_from) return controlsFail('Provider end date precedes its start date');
               const panel = await trx('test_panels').where({ id: testid }).forUpdate().first();
               if (!panel) return controlsFail('Test panel not found', 404);
               const before = await trx('lab_outsource_providers').where({ testid }).forUpdate();
               const version = Number(panel.lab_outsource_version || 0);
               if (version !== data.version) return controlsFail('Provider settings changed. Reload before saving.', 409);
               for (const provider of data.providers) if (!await trx('outsourcingorganization').where({ outsourceid: provider.outsourceid }).first()) return controlsFail('Organization not found');
               // Keep removed configurations as inactive audit/history. Existing case snapshots never change.
               await trx('lab_outsource_providers').where({ testid }).update({ active: false, preferred: false, version: version + 1 });
               for (const provider of data.providers) {
                    const key = { testid, outsourceid: provider.outsourceid };
                    const row = { ...key, ...provider, version: version + 1, updated_by: actor.employeeid, updated_at: new Date() };
                    if (before.some((r: any) => Number(r.outsourceid) === provider.outsourceid)) await trx('lab_outsource_providers').where(key).update(row); else await trx('lab_outsource_providers').insert(row);
                    const serviceKey = { outsourceid: provider.outsourceid, generalTestId: testid };
                    if (await trx('outsourceorganizationservices').where(serviceKey).first()) {
                         await trx('outsourceorganizationservices').where(serviceKey).update({ outsourcePrice: provider.cost, updatedby: actor.employeeid });
                    } else await trx('outsourceorganizationservices').insert({ ...serviceKey, outsourcePrice: provider.cost, addedby: actor.employeeid });
               }
               await trx('test_panels').where({ id: testid }).update({ lab_outsource_version: version + 1 });
               await trx('testdetails').where({ testid }).update({ OutSourcingList: data.providers.filter(p => p.active).map(p => p.outsourceid).join(',') });
               await controlAudit(trx, actor.employeeid, 'outsource_providers', testid, 'updated', data.reason, { before, providers: data.providers });
               return { version: version + 1 };
     }
     private async base(actor: AuthUser) {
          const db = this.db;
          const q = db('outsourcedtesttracking as tracking').join('dboservices as service', 'service.serviceid', 'tracking.serviceid')
               .join('billing as bill', 'bill.billingid', 'service.billingid').join('new_patients as patient', 'patient.patientid', 'bill.patientid')
               .join('test_panels as panel', 'panel.id', 'tracking.testid').join('outsourcingorganization as org', 'org.outsourceid', 'tracking.outsourceid')
               .leftJoin('test_ascension as test', function (this: any) { this.on('test.serviceid', '=', 'tracking.serviceid').andOn('test.testid', '=', 'tracking.testid'); })
               .whereRaw('(test.id IS NULL OR test.id = (SELECT MIN(t.id) FROM test_ascension t WHERE t.serviceid = tracking.serviceid AND t.testid = tracking.testid))')
               .whereRaw('COALESCE(service.isDeleted, 0) = 0');
          if (actor.branch != null) q.where('bill.branchid', actor.branch);
          await scopeLabWork(q, db, actor, 'test.id'); return { query: q };
     }
     async list(actor: AuthUser, input: any) {
          const page = z.coerce.number().int().min(1).parse(input.page || 1), { query } = await this.base(actor);
          if (input.stage === 'open') query.whereNotIn('tracking.workflow_status', ['completed', 'cancelled']);
          else if (input.stage && input.stage !== 'all') query.where('tracking.workflow_status', input.stage);
          if (input.overdue === 'true') query.where('tracking.due_at', '<', new Date()).whereNotIn('tracking.workflow_status', ['completed', 'cancelled']);
          if (input.organization) query.where('tracking.outsourceid', Number(input.organization));
          if (input.search) query.where((q: any) => q.where('patient.fullpatientid', 'like', `%${String(input.search).slice(0, 80)}%`).orWhere('patient.lastname', 'like', `%${String(input.search).slice(0, 80)}%`).orWhere('panel.name', 'like', `%${String(input.search).slice(0, 80)}%`).orWhere('tracking.external_reference', 'like', `%${String(input.search).slice(0, 80)}%`));
          const total = Number((await query.clone().count('* as count').first())?.count || 0);
          const data = await query.select('tracking.*', 'panel.name as test_name', 'org.name as organization_name', 'patient.fullpatientid', 'test.id as ascensionid', 'bill.billingid', this.db.raw("CONCAT_WS(' ', patient.firstname, patient.lastname) as patient_name"))
               .orderByRaw("tracking.workflow_status IN ('completed', 'cancelled') ASC").orderByRaw('tracking.due_at IS NULL').orderBy('tracking.due_at').orderBy('tracking.id', 'desc').limit(25).offset((page - 1) * 25);
          return { data, total, page, count: 25 };
     }
     async detail(actor: AuthUser, id: number) {
          const row = await (await this.base(actor)).query.where('tracking.id', id).select('tracking.*', 'panel.name as test_name', 'org.name as organization_name', 'org.contactNumber', 'org.contactPerson', 'bill.billingid', 'test.id as ascensionid', 'test.resultEntryEnd', 'bill.patientid', 'patient.fullpatientid', this.db.raw('(SELECT COUNT(*) FROM test_ascension tally WHERE tally.serviceid = tracking.serviceid AND tally.testid = tracking.testid) as ascension_count'), this.db.raw("CONCAT_WS(' ', patient.firstname, patient.lastname) as patient_name")).first();
          if (!row) return controlsFail('Outsourced case not found in your scope', 404);
          return { ...row, reports: await this.db('lab_outsource_reports').where({ tracking_id: id }).select('id', 'filename', 'mime', 'uploaded_by', 'uploaded_at'),
               history: await this.db('lab_control_audit').where({ entity: 'outsource_case', entity_id: id }).orderBy('id', 'desc').limit(100), history_limit: 100 };
     }
     async requestCandidates(actor: AuthUser, patientid: number, outsourceid: number) {
          return (await this.base(actor)).query.where('bill.patientid', patientid).where('tracking.outsourceid', outsourceid)
               .whereNotIn('tracking.workflow_status', ['completed', 'cancelled'])
               .select('tracking.id', 'tracking.serviceid', 'panel.name as test_name', 'tracking.workflow_status').orderBy('tracking.id');
     }
     async transition(actor: AuthUser, id: number, input: any) {
          const data = z.object({ status: z.enum(['awaiting_dispatch', 'sent', 'awaiting_results', 'returned', 'completed', 'cancelled']), version: z.number().int().positive(),
               reason: z.string().trim().min(3).max(2000), external_reference: z.string().trim().max(150).optional(), assigned_employeeid: z.number().int().positive().nullable().optional() }).parse(input);
          const scoped = await this.detail(actor, id);
          if (!scoped.ascensionid && !labSupervisor(actor)) return controlsFail('A supervisor must review legacy cases without a linked ordered test', 403);
          if (scoped.ascensionid) await assertLabTestAccess(this.db, actor, scoped.ascensionid, true);
          return this.db.transaction(async (trx: any) => {
               const row = await trx('outsourcedtesttracking').where({ id }).forUpdate().first();
               if (Number(row.workflow_version) !== data.version) return controlsFail('Case changed. Reload before updating.', 409);
               if (!outsourceTransitions[row.workflow_status]?.includes(data.status)) return controlsFail('Invalid outsourcing transition', 409);
               const changes: any = { workflow_status: data.status, workflow_version: data.version + 1, comments: data.reason, updatedOn: new Date() };
               if (data.external_reference !== undefined) changes.external_reference = data.external_reference;
               if (data.assigned_employeeid !== undefined) {
                    if (!labSupervisor(actor)) return controlsFail('Only a supervisor may change the case owner', 403);
                    if (data.assigned_employeeid) {
                         const staff = await trx('roles').where({ employeeid: data.assigned_employeeid }).first();
                         if (!staff || Number(staff.activation) === 0 || actor.branch != null && Number(staff.branch) !== Number(actor.branch)) return controlsFail('Choose active staff in your branch');
                    }
                    changes.assigned_employeeid = data.assigned_employeeid;
               }
               if (data.status === 'sent') {
                    const provider = await trx('lab_outsource_providers').where({ testid: row.testid, outsourceid: row.outsourceid, active: true }).first();
                    const today = new Date().toISOString().slice(0, 10), day = (v: any) => v instanceof Date ? v.toISOString().slice(0, 10) : String(v || '').slice(0, 10);
                    if (!provider || day(provider.effective_from) > today || provider.effective_to && day(provider.effective_to) < today) return controlsFail('Configure a currently valid provider, cost and turnaround time before dispatch');
                    if (!data.external_reference && !row.external_reference) return controlsFail('Record a dispatch / laboratory reference');
                    changes.dispatched_at = new Date(); changes.due_at = new Date(Date.now() + Number(provider.tat_hours) * 3600000);
                    if (row.snapshot_cost == null) { changes.snapshot_cost = provider.cost; changes.snapshot_currency = provider.currency; }
               }
               if (data.status === 'returned' && !await trx('lab_outsource_reports').where({ tracking_id: id }).first()) return controlsFail('Attach the returned report before marking results returned');
               if (data.status === 'completed') {
                    if (scoped.ascension_count != null && Number(scoped.ascension_count) !== 1) return controlsFail('This case has ambiguous ordered tests; ask a supervisor to reconcile the order', 409);
                    if (!scoped.ascensionid || !scoped.resultEntryEnd) return controlsFail('Enter and validate the returned results first');
                    const approval = await trx('dbotestresultapproval').where({ ascensionid: scoped.ascensionid }).first();
                    if (Number(approval?.isapproved) !== 1 || Number(approval?.requires_revalidation) === 1) return controlsFail('Validate the current result revision first');
                    await assertCriticalRelease(trx, scoped.ascensionid, 'release');
                    changes.status = 1; changes.completedconfirmedby = actor.employeeid;
               }
               if (data.status === 'cancelled' && !labSupervisor(actor)) return controlsFail('A supervisor must cancel an outsourced case', 403);
               await trx('outsourcedtesttracking').where({ id }).update(changes);
               await controlAudit(trx, actor.employeeid, 'outsource_case', id, data.status, data.reason, { before: row, changes }); return changes;
          });
     }
     async upload(actor: AuthUser, id: number, input: any) {
          const data = z.object({ filename: z.string().trim().min(1).max(180), base64: z.string().max(2800000).regex(/^[A-Za-z0-9+/]+={0,2}$/) }).parse(input);
          const row = await this.detail(actor, id); if (row.ascensionid) await assertLabTestAccess(this.db, actor, row.ascensionid, true);
          const content = Buffer.from(data.base64, 'base64');
          if (content.length > 2 * 1024 * 1024 || content.subarray(0, 5).toString() !== '%PDF-') return controlsFail('Upload a PDF report up to 2 MB');
          return this.db.transaction(async (trx: any) => {
               const current = await trx('outsourcedtesttracking').where({ id }).forUpdate().first();
               if (['completed', 'cancelled'].includes(current.workflow_status)) return controlsFail('This case is closed');
               const sha256 = createHash('sha256').update(content).digest('hex');
               const existing = await trx('lab_outsource_reports').where({ tracking_id: id, sha256 }).first(); if (existing) return { id: existing.id };
               const [reportId] = await trx('lab_outsource_reports').insert({ tracking_id: id, filename: data.filename.replace(/[\\/\r\n"]/g, '_'), mime: 'application/pdf', content, sha256, uploaded_by: actor.employeeid, uploaded_at: new Date() });
               await controlAudit(trx, actor.employeeid, 'outsource_case', id, 'report_uploaded', data.filename, { report_id: reportId, sha256 }); return { id: reportId };
          });
     }
     async download(actor: AuthUser, id: number, reportId: number) {
          await this.detail(actor, id); const report = await this.db('lab_outsource_reports').where({ id: reportId, tracking_id: id }).first();
          if (!report) return controlsFail('Report not found', 404); return report;
     }
}
