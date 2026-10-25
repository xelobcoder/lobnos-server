import { configuration } from '../../hooks/configuration';
import { systemConfigConnection } from '../../database/connection';
import { MODULE_CONFIG_TABLE, validateModuleConfiguration } from '../Tenancy/FacilityModules';
import { z } from 'zod';
import { assertPatient, assertEncounter, practitioner, patientScope, manager, ownsEncounter, triageRoles, branchCareScope } from './ConsultationPolicy';
import { clinicalError, clinicalAudit } from './ConsultationSchema';
import { roleAllowed } from '../../middleware/roles';
const id = z.coerce.number().int().positive();
const note = z.object({ consultation_notes: z.string().max(50000), record_type: z.enum(['Old Record', 'In-Process (Today)', 'IPD Review', 'OPD New Cases']).default('OPD New Cases'), revision: z.number().int().positive(), action: z.enum(['save', 'sign', 'amend']).default('save'), reason: z.string().trim().max(2000).default('') });
export const finiteOptional = z.preprocess(v => v === '' || v == null ? null : typeof v === 'string' && v.trim() !== '' ? Number(v) : v, z.number().finite().nullable());
export const vitalInput = z.object({
    blood_pressure_upperLimit: finiteOptional.refine(v => v == null || (v > 0 && v < 1000), 'Enter a positive systolic pressure below 1000'), blood_pressure_lowerLimit: finiteOptional.refine(v => v == null || (v > 0 && v < 1000), 'Enter a positive diastolic pressure below 1000'),
    temperature: finiteOptional.refine(v => v == null || (v > 0 && v < 100), 'Enter temperature in Celsius'), pulse: finiteOptional.refine(v => v == null || (v > 0 && v < 1000), 'Enter a positive pulse below 1000'), respiration: finiteOptional.refine(v => v == null || (v > 0 && v < 1000), 'Enter a positive respiratory rate below 1000'), spo2: finiteOptional.refine(v => v == null || (v >= 0 && v <= 100), 'SpO₂ must be between 0 and 100'), weight_kg: finiteOptional.refine(v => v == null || (v > 0 && v < 2000), 'Enter weight in kg'), height_cm: finiteOptional.refine(v => v == null || (v > 0 && v < 500), 'Enter height in cm'),
    missing_reason: z.string().trim().max(500).default(''), encounter_id: z.number().int().positive().nullable().default(null), observed_at: z.string().datetime({ offset: true }).optional(), revision: z.number().int().positive().optional(), reason: z.string().trim().max(2000).default(''),
}).superRefine((v, c) => {
    for(const key of ['blood_pressure_upperLimit','blood_pressure_lowerLimit','temperature','weight_kg','height_cm'] as const){if(v[key]!=null&&Number(v[key]!.toFixed(2))!==v[key])c.addIssue({code:'custom',path:[key],message:'Use at most two decimal places'});}
    for(const key of ['pulse','respiration','spo2'] as const){if(v[key]!=null&&!Number.isInteger(v[key]))c.addIssue({code:'custom',path:[key],message:'Use a whole number for '+key});}
    const fields = ['blood_pressure_upperLimit', 'blood_pressure_lowerLimit', 'temperature', 'pulse', 'respiration', 'spo2'] as const;
    if (fields.every(k => v[k] == null) && v.weight_kg == null && v.height_cm == null)
        c.addIssue({ code: 'custom', message: 'Record at least one observation' });
    if (fields.some(k => v[k] == null) && !v.missing_reason)
        c.addIssue({ code: 'custom', path: ['missing_reason'], message: 'Explain why some observations were not recorded' });
    if ((v.blood_pressure_upperLimit == null) !== (v.blood_pressure_lowerLimit == null))
        c.addIssue({ code: 'custom', message: 'Record both blood pressure values or leave both blank' });
    if (v.blood_pressure_upperLimit != null && v.blood_pressure_lowerLimit != null && v.blood_pressure_upperLimit <= v.blood_pressure_lowerLimit)
        c.addIssue({ code: 'custom', message: 'Systolic pressure must exceed diastolic pressure' });
    if (v.observed_at && Date.parse(v.observed_at) > Date.now() + 300000)
        c.addIssue({ code: 'custom', path: ['observed_at'], message: 'Observation time cannot be in the future' });
});
export class ConsultationService {
    constructor(private db: any) { }
    async capabilities(actor: any) {
        let access: any = null;
        try {
            access = await practitioner(this.db, actor);
        }
        catch (e) {
            if (!manager(actor) && !roleAllowed(actor.role, triageRoles))
                throw e;
        }
        const settings = await this.db('applicationsettings').where({ keyid: 1 }).first();
        let local: any = null, platform: any = null;
        try {
            local = settings?.moduleConfiguration ? validateModuleConfiguration(JSON.parse(settings.moduleConfiguration)) : null;
            if (configuration.isMultiTenant) {
                const row = await systemConfigConnection(MODULE_CONFIG_TABLE).where({ tenant_id: actor.tenantId }).first('configuration');
                platform = row ? validateModuleConfiguration(JSON.parse(row.configuration)) : null;
            }
        }
        catch {
            clinicalError('Facility modules could not be verified', 503);
        }
        const enabled = (key: string) => { const active = key === 'pharmacy' ? !local || !!local.modules.pharmacy.enabled : !!local?.modules[key]?.enabled; return active && (!configuration.isMultiTenant || !!platform?.modules[key]?.enabled); };
        const company = await this.db('companyprofile').select('NAME as name').first();
        return { companyName: company?.name || 'Practitioner portal', canManage: manager(actor), consultationsEnabled: enabled('consultations') && (!!access || manager(actor)), canRecordVitals: !!Number(access?.can_consult) || manager(actor) || roleAllowed(actor.role, triageRoles), canConsult: !!Number(access?.can_consult) && enabled('consultations'), canLab: !!Number(access?.can_lab) && enabled('laboratoryOperations'), canPrescribe: !!Number(access?.can_prescribe) && enabled('pharmacy'), canReadResults: !!access, clinicianid: access?.clinicianid || null, practiceType: access?.practice_type || (manager(actor) ? 'oversight' : 'triage'), staffLinked: access?.author_type === 'staff' };
    }
    async patients(actor: any, input: any) {
        if (!manager(actor) && roleAllowed(actor.role, triageRoles) && actor.branch == null)
            clinicalError('An operating branch is required', 403);
        const access = manager(actor) || roleAllowed(actor.role, triageRoles) ? null : await practitioner(this.db, actor);
        let q = this.db('new_patients as np');
        if (access)
            q = patientScope(q, this.db, actor, access);
        else if (actor.branch != null)
            branchCareScope(q, this.db, actor.branch);
        const search = String(input.search || '').trim().slice(0, 100);
        if (search)
            q.where(function (this: any) { this.where('np.fullpatientid', 'like', `%${search}%`).orWhere('np.firstname', 'like', `%${search}%`).orWhere('np.lastname', 'like', `%${search}%`); });
        return q.select('np.patientid', 'np.fullpatientid', 'np.firstname', 'np.lastname', 'np.gender', 'np.dob').orderBy('np.firstname').orderBy('np.patientid').limit(30);
    }
    async list(actor: any, input: any) {
        const access = manager(actor) ? null : await practitioner(this.db, actor);
        const page = z.coerce.number().int().min(1).parse(input.page || 1);
        let q = this.db('medicalrecords as mr').join('new_patients as np', 'np.patientid', 'mr.patientid').whereNull('mr.deleted_at');
        if (access)
            q = patientScope(q, this.db, actor, access);
        else if (actor.branch != null)
            q.whereExists(function (this: any) { this.select('b.billingid').from('billing as b').whereRaw('b.patientid=mr.patientid').where('b.branchid', actor.branch); });
        if (actor.role === 'clinician')
            q.where({ 'mr.author_type': 'clinician', 'mr.consulationby': actor.employeeid });
        if (input.today === 'true')
            q.whereRaw('DATE(mr.created_at) = CURRENT_DATE');
        if (input.patientid)
            q.where('mr.patientid', id.parse(input.patientid));
        if (input.status && input.status !== 'all')
            q.where('mr.encounter_status', z.enum(['draft', 'signed', 'legacy']).parse(input.status));
        const search = String(input.search || '').slice(0, 100);
        if (search)
            q.where(function (this: any) { this.where('np.firstname', 'like', `%${search}%`).orWhere('np.lastname', 'like', `%${search}%`).orWhere('np.fullpatientid', 'like', `%${search}%`); });
        const total = Number((await q.clone().count('* as count').first())?.count || 0);
        const data = await q.select('mr.id', 'mr.patientid', 'mr.record_type', 'mr.encounter_status', 'mr.created_at', 'mr.updated_at', 'mr.revision', 'np.firstname', 'np.lastname', 'np.fullpatientid').orderBy('mr.id', 'desc').limit(20).offset((page - 1) * 20);
        return { data, total, page, count: 20 };
    }
    async pending(actor: any, input: any) { const access = manager(actor) ? null : await practitioner(this.db, actor); const page = z.coerce.number().int().min(1).parse(input.page || 1); let q = this.db('dboservices as ds').join('billing as b', 'b.billingid', 'ds.billingid').join('new_patients as np', 'np.patientid', 'b.patientid').where({ 'ds.serviceCategory': 'SERVICES', 'ds.categoryTrackId': 5, 'ds.trackId': 1 }).whereRaw('COALESCE(ds.isDeleted,0)=0').whereNotExists(function (this: any) { this.select('mr.id').from('medicalrecords as mr').whereRaw('mr.associatedTransactionid=ds.serviceid').whereNull('mr.deleted_at').where(function (this: any) { this.where('mr.encounter_status', 'signed').orWhere(function (this: any) { this.where('mr.encounter_status', 'legacy').whereRaw('LENGTH(TRIM(mr.progress_report)) > 0'); }); }); }); if (actor.branch != null)
        q.where('b.branchid', actor.branch); if (access)
        q = patientScope(q, this.db, actor, access); if (actor.role === 'clinician')
        q.where('ds.clinicianId', access.clinicianid); const total = Number((await q.clone().count('* as count').first())?.count || 0); return { data: await q.select('ds.serviceid', 'b.billingid', 'np.patientid', 'np.firstname', 'np.lastname', 'np.fullpatientid', this.db.raw("(SELECT draft.id FROM medicalrecords draft WHERE draft.associatedTransactionid=ds.serviceid AND draft.author_type=? AND draft.consulationby=? AND draft.encounter_status='draft' AND draft.deleted_at IS NULL ORDER BY draft.id DESC LIMIT 1) as draft_id", [actor.role === 'clinician' ? 'clinician' : 'staff', actor.employeeid])).orderBy('ds.serviceid', 'desc').limit(20).offset((page - 1) * 20), page, total, count: 20 }; }
    async start(actor: any, input: any) {
        const data = z.object({ patientid: id, requestKey: z.string().uuid(), associatedTransactionid: z.number().int().positive().nullable().optional() }).parse(input);
        const access = await practitioner(this.db, actor);
        if (!(await this.capabilities(actor)).canConsult)
            clinicalError('Consultation permission and an enabled consultation module are required', 403);
        await assertPatient(this.db, actor, data.patientid, access);
        return this.db.transaction(async (trx: any) => {
            await trx('practitioner_access').where({ clinicianid: access.clinicianid }).forUpdate().first();
            const old = await trx('medicalrecords').where({ request_key: data.requestKey }).first();
            if (old) {
                if (!ownsEncounter(actor, old) || Number(old.patientid) !== data.patientid)
                    clinicalError('Request key belongs to another encounter', 409);
                return old;
            }
            if (data.associatedTransactionid) {
                const service = await trx('dboservices as ds').join('billing as b', 'b.billingid', 'ds.billingid').where('ds.serviceid', data.associatedTransactionid).where('b.patientid', data.patientid).first();
                if (!service)
                    clinicalError('Consultation service does not belong to this patient');
            }
            const row = { patientid: data.patientid, consulationby: actor.employeeid, author_type: access.author_type, progress_report: '', record_type: 'OPD New Cases', associatedTransactionid: data.associatedTransactionid || null, request_key: data.requestKey, encounter_status: 'draft', revision: 1, created_at: new Date(), updated_at: new Date() };
            const ids = await trx('medicalrecords').insert(row);
            await clinicalAudit(trx, actor, 'encounter', Number(ids[0]), 'created');
            return { id: Number(ids[0]), ...row };
        });
    }
    async detail(actor: any, encounterId: number) { const row = await assertEncounter(this.db, actor, encounterId); const patient = await assertPatient(this.db, actor, Number(row.patientid)); return { ...row, consultation_notes: row.progress_report, patient, canEdit: ownsEncounter(actor, row), history: await this.db('consultation_audit').where({ entity: 'encounter', entity_id: encounterId }).orderBy('id', 'desc').limit(100) }; }
    async save(actor: any, encounterId: number, input: any) {
        const data = note.parse(input);
        await assertEncounter(this.db, actor, encounterId, true);
        const access = await practitioner(this.db, actor);
        if (!Number(access.can_consult))
            clinicalError('Consultation permission is required', 403);
        return this.db.transaction(async (trx: any) => {
            const old = await trx('medicalrecords').where({ id: encounterId }).forUpdate().first();
            if (Number(old.revision) !== data.revision)
                clinicalError('This consultation changed. Reload and review it before saving. Your draft is kept.', 409);
            if (old.encounter_status === 'signed' && data.action !== 'amend')
                clinicalError('Signed notes require an amendment and a reason', 409);
            if (data.action === 'amend' && (old.encounter_status !== 'signed' || data.reason.length < 3))
                clinicalError('Provide a reason to amend a signed consultation');
            if (data.action === 'sign' && !data.consultation_notes.replace(/<[^>]*>/g, '').trim())
                clinicalError('Add consultation notes before signing');
            const changes = { progress_report: data.consultation_notes, record_type: data.record_type, revision: data.revision + 1, encounter_status: data.action === 'sign' || data.action === 'amend' ? 'signed' : 'draft', signed_at: data.action === 'sign' ? new Date() : old.signed_at, updated_at: new Date() };
            await trx('medicalrecords').where({ id: encounterId }).update(changes);
            await clinicalAudit(trx, actor, 'encounter', encounterId, data.action, { before: old, reason: data.reason });
            return { ...old, ...changes, consultation_notes: changes.progress_report };
        });
    }
    async remove(actor: any, encounterId: number, revision: number) { await assertEncounter(this.db, actor, encounterId, true); return this.db.transaction(async (trx: any) => { const old = await trx('medicalrecords').where({ id: encounterId }).forUpdate().first(); if (old.encounter_status !== 'draft' || old.revision !== revision)
        clinicalError('Only the current unsigned draft can be discarded', 409); if (await trx('entity_orders').where({ consultation_id: encounterId }).first() || await trx('prescriptions').where({ consultation_id: encounterId }).first())
        clinicalError('This draft has linked orders; retain it for the clinical record'); await trx('medicalrecords').where({ id: encounterId }).update({ deleted_at: new Date(), revision: revision + 1 }); await clinicalAudit(trx, actor, 'encounter', encounterId, 'discarded'); return true; }); }
    async vitals(actor: any, patientid: number, input: any) { await assertPatient(this.db, actor, patientid); const page = z.coerce.number().int().min(1).parse(input.page || 1), count = z.coerce.number().int().min(1).max(100).parse(input.count || 20); const q = this.db('dbovitalsigns').where({ patientid }); for (const [key, operator] of [['filterFrom', '>='], ['filterTo', '<=']] as const)
        if (input[key]) {
            const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v).parse(input[key]);
            q.whereRaw('DATE(??) '+operator+' ?',['date',date]);
        } if (input.filterFrom && input.filterTo && input.filterFrom > input.filterTo)
        clinicalError('Start date must not follow end date'); const total = Number((await q.clone().count('* as count').first())?.count || 0); const rows = await q.select('dbovitalsigns.*', this.db.raw("CASE observer_type WHEN 'clinician' THEN (SELECT c.name FROM clinicianbasicinfo c WHERE c.id=dbovitalsigns.employeeid) WHEN 'staff' THEN (SELECT r.username FROM roles r WHERE r.employeeid=dbovitalsigns.employeeid) ELSE NULL END as observer_name")).orderBy('date', 'desc').orderBy('time', 'desc').orderBy('vitalsignid', 'desc').limit(count).offset((page - 1) * count); return { data: rows.map((row: any) => ({ ...row, canCorrect: manager(actor) || (row.observer_type === (actor.role === 'clinician' ? 'clinician' : 'staff') && Number(row.employeeid) === Number(actor.employeeid)) })), total, page, count }; }
    async vitalHistory(actor: any, patientid: number, vitalId: number) { await assertPatient(this.db, actor, patientid); if (!await this.db('dbovitalsigns').where({ vitalsignid: vitalId, patientid }).first())
        clinicalError('Observation not found', 404); return this.db('consultation_audit').where({ entity: 'vitals', entity_id: vitalId }).select('id', 'action', 'actor_type', 'actor_id', 'details', 'created_at').orderBy('id', 'desc').limit(100); }
    async recordVitals(actor: any, patientid: number, input: any, vitalId?: number) {
        const data = vitalInput.parse(input);
        if (!manager(actor) && !roleAllowed(actor.role, triageRoles)) {
            const access = await practitioner(this.db, actor);
            if (!Number(access.can_consult))
                clinicalError('Vital-sign recording permission required', 403);
        }
        await assertPatient(this.db, actor, patientid);
        if (data.encounter_id) {
            const encounter = await assertEncounter(this.db, actor, data.encounter_id);
            if (Number(encounter.patientid) !== patientid)
                clinicalError('Encounter and patient do not match');
        }
        const observed = data.observed_at ? new Date(data.observed_at) : new Date();
        return this.db.transaction(async (trx: any) => {
            let old: any = null;
            if (vitalId) {
                old = await trx('dbovitalsigns').where({ vitalsignid: vitalId, patientid }).forUpdate().first();
                if (!old)
                    clinicalError('Observation not found', 404);
                if (old.revision !== data.revision)
                    clinicalError('Observation changed. Reload before correcting it.', 409);
                if (data.reason.length < 3)
                    clinicalError('A correction reason is required');
                if (!manager(actor) && (old.observer_type !== (actor.role === 'clinician' ? 'clinician' : 'staff') || Number(old.employeeid) !== actor.employeeid))
                    clinicalError('Only the original observer or a manager may correct this observation', 403);
            }
            const row: any = { patientid, bp: data.blood_pressure_upperLimit == null ? null : `${data.blood_pressure_upperLimit}/${data.blood_pressure_lowerLimit}`, temperature: data.temperature, pulse: data.pulse, respiration: data.respiration, spo2: data.spo2, weight_kg: data.weight_kg, height_cm: data.height_cm, encounter_id: old ? old.encounter_id : data.encounter_id, missing_reason: data.missing_reason, employeeid: old?.employeeid || actor.employeeid, observer_type: old?.observer_type || (actor.role === 'clinician' ? 'clinician' : 'staff'), observed_at: old ? old.observed_at : observed, revision: old ? Number(old.revision) + 1 : 1 };
            if (old)
                row.corrected_at = new Date();
            else {
                row.date = observed.toISOString().slice(0, 10);
                row.time = observed.toISOString().slice(11, 19);
            }
            const newId = vitalId || Number((await trx('dbovitalsigns').insert(row))[0]);
            if (vitalId)
                await trx('dbovitalsigns').where({ vitalsignid: vitalId, patientid }).update(row);
            await clinicalAudit(trx, actor, 'vitals', newId, old ? 'corrected' : 'recorded', { before: old, reason: data.reason });
            return { vitalsignid: newId, ...row };
        });
    }
}
