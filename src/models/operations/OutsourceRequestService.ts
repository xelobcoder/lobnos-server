import { z } from 'zod';
import type { AuthUser } from '../../middleware/authority';
import { controlsFail } from './LabAccessPolicy';
import { OutsourceWorkflowService } from './OutsourceWorkflowService';

export const outsourceRequestSchema = z.object({
	requestKey: z.string().uuid(), priority: z.enum(['routine', 'urgent']),
	clinicalNotes: z.string().trim().max(3000).default(''),
	requestedBy: z.string().trim().max(150).default(''), contact: z.string().trim().max(150).default(''),
	items: z.array(z.object({
		trackingId: z.number().int().positive(), sampleType: z.string().trim().min(1).max(120),
		sampleId: z.string().trim().min(1).max(120), collectedAt: z.string().datetime({ offset: true }).nullable(),
		handling: z.string().trim().max(300).default('')
	})).min(1).max(100),
}).refine(data => new Set(data.items.map(row => row.trackingId)).size === data.items.length, 'Select each test once');

/** Immutable request snapshots live in the existing laboratory case audit, alongside dispatch history. */
export class OutsourceRequestService {
	constructor(private db: any, private workflow = new OutsourceWorkflowService(db)) { }
	async context(actor: AuthUser, id: number) {
		const anchor = await this.workflow.detail(actor, id);
		const candidates = await this.workflow.requestCandidates(actor, Number(anchor.patientid), Number(anchor.outsourceid));
		const saved = await this.db('lab_control_audit').where({ entity: 'outsource_case', entity_id: id, action: 'referral_created' }).select('id', 'created_at', 'employeeid').orderBy('id', 'desc');
		return { anchor, candidates, saved };
	}
	async create(actor: AuthUser, id: number, input: unknown) {
		const data = outsourceRequestSchema.parse(input);
		if (!data.items.some(row => row.trackingId === id)) return controlsFail('Include the case from which this request was opened');
		// Recheck every test through the existing branch and assigned-work policy.
		const cases = await Promise.all(data.items.map(row => this.workflow.detail(actor, row.trackingId)));
		const anchor = cases.find(row => Number(row.id) === id)!;
		if (cases.some(row => Number(row.patientid) !== Number(anchor.patientid) || Number(row.outsourceid) !== Number(anchor.outsourceid))) return controlsFail('A request must contain one patient and one receiving facility');
		if (cases.some(row => ['completed', 'cancelled'].includes(row.workflow_status))) return controlsFail('Completed or cancelled cases cannot be added to a new request');
		return this.db.transaction(async (trx: any) => {
			for (const row of [...cases].sort((a, b) => Number(a.id) - Number(b.id))) {
				const current = await trx('outsourcedtesttracking').where({ id: row.id }).forUpdate().first();
				if (!current || Number(current.workflow_version) !== Number(row.workflow_version)) return controlsFail('A case changed. Reload before creating the request.', 409);
			}
			const old = await trx('lab_control_audit').where({ entity: 'outsource_case', entity_id: id, action: 'referral_created', reason: data.requestKey }).first();
			if (old) return { id: old.id, ...this.decode(old.metadata) };
			const patient = await trx('new_patients').where({ patientid: anchor.patientid }).select('firstname', 'middlename', 'lastname', 'fullpatientid', 'dob', 'gender', 'age', 'agetype').first();
			if (!patient) return controlsFail('Patient not found', 404);
			const company = await trx('companyprofile').select('NAME as name', 'ADDRESS as address', 'EMAIL as email', 'PHONENUMBER as phone').orderBy('ID').first();
			const facility = await trx('outsourcingorganization').where({ outsourceid: anchor.outsourceid }).select('name', 'address', 'contactPerson', 'contactNumber', 'email').first();
			if (!facility) return controlsFail('Receiving facility not found', 404);
			const snapshot = {
				createdAt: new Date().toISOString(), createdBy: actor.employeeid, patient, company: company || {}, facility,
				priority: data.priority, clinicalNotes: data.clinicalNotes, requestedBy: data.requestedBy, contact: data.contact,
				items: data.items.map(item => { const row = cases.find(row => Number(row.id) === item.trackingId)!; return { ...item, testName: row.test_name, serviceId: row.serviceid, billingId: row.billingid, externalReference: row.external_reference || '' }; })
			};
			const ids = await trx('lab_control_audit').insert({
				entity: 'outsource_case', entity_id: id, action: 'referral_created', employeeid: actor.employeeid,
				reason: data.requestKey, metadata: JSON.stringify(snapshot), created_at: new Date()
			});
			return { id: Number(ids[0]), ...snapshot };
		});
	}
	private decode(value: any) { return typeof value === 'string' ? JSON.parse(value) : value; }
	async get(actor: AuthUser, id: number, requestId: number) {
		await this.workflow.detail(actor, id);
		const row = await this.db('lab_control_audit').where({ id: requestId, entity: 'outsource_case', entity_id: id, action: 'referral_created' }).first();
		if (!row) return controlsFail('Request not found', 404);
		const snapshot = this.decode(row.metadata);
		for (const item of snapshot.items) await this.workflow.detail(actor, item.trackingId);
		return { id: row.id, ...snapshot };
	}
}
