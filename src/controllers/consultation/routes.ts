import { Router } from 'express';
import { z } from 'zod';
import { getAuthUser } from '../../middleware/authority';
import { consultationDb, clinicalError, clinicalAudit } from '../../models/consultation/ConsultationSchema';
import { ConsultationService } from '../../models/consultation/ConsultationService';
import { PractitionerAccessService } from '../../models/consultation/PractitionerAccessService';
import { manager, assertEncounter, assertPatient, practitioner } from '../../models/consultation/ConsultationPolicy';
import { resolvePublicTenant } from '../../middleware/resolveLoginTenant';
import { configuration, effectiveTenantId } from '../../hooks/configuration';
import { parseInvitationToken } from '../../models/patient-portal/PatientPortalAccountService';
import { createRateLimiter } from '../../middleware/rateLimiter';
import { licenseMode } from '../../licensing/storage';
import { requireOperationalLicense } from '../../licensing/enforcement';
import { tenantId as licensedTenantId } from '../../licensing/certificate';
import { EntityOrderService } from '../../models/entityorders/EntityOrderService';
const positive = z.coerce.number().int().positive();
export const clinicalRun = (operation: (db: any, actor: any, req: any) => Promise<any>) => async (req: any, res: any) => { res.setHeader('Cache-Control', 'private, no-store'); try {
    const actor = getAuthUser(req);
    if (!actor)
        clinicalError('Authentication required', 401);
    const db = await consultationDb(actor!.tenantId);
    const data = await operation(db, actor, req);
    return res.json({ success: true, data });
}
catch (e: any) {
    const status = e.name === 'ZodError' ? 400 : Number(e.statusCode) || 500;
    return res.status(status).json({ success: false, message: status === 500 ? 'Unable to complete the clinical action' : e.name === 'ZodError' ? e.issues.map((i: any) => i.message).join('; ') : e.message });
} };
export const consultationRouter = Router(), publicPractitionerRouter = Router();
const base = '/api/v1/consultation';
consultationRouter.get(`${base}/capabilities`, clinicalRun((db, a) => new ConsultationService(db).capabilities(a)));
consultationRouter.get(`${base}/staff/:id/access`,clinicalRun((db,a,r)=>new PractitionerAccessService(db,a.tenantId).staffDetails(a,positive.parse(r.params.id))));
consultationRouter.put(`${base}/staff/:id/access`,clinicalRun((db,a,r)=>new PractitionerAccessService(db,a.tenantId).configureStaff(a,positive.parse(r.params.id),r.body)));
consultationRouter.get(`${base}/patients/:id`, clinicalRun((db, a, r) => assertPatient(db, a, positive.parse(r.params.id))));
consultationRouter.get(`${base}/catalogue`, clinicalRun(async (db, a) => { const capabilities = await new ConsultationService(db).capabilities(a); if (!capabilities.canLab)
    clinicalError('Laboratory referral permission required', 403); return new EntityOrderService(a.tenantId).getCatalogueForEntity('clinician', capabilities.clinicianid); }));
consultationRouter.get(`${base}/patients`, clinicalRun((db, a, r) => new ConsultationService(db).patients(a, r.query)));
consultationRouter.get(`${base}/pending`, clinicalRun((db, a, r) => new ConsultationService(db).pending(a, r.query)));
consultationRouter.get(`${base}/encounters`, clinicalRun((db, a, r) => new ConsultationService(db).list(a, r.query)));
consultationRouter.post(`${base}/encounters`, clinicalRun((db, a, r) => new ConsultationService(db).start(a, r.body)));
consultationRouter.get(`${base}/encounters/:id`, clinicalRun((db, a, r) => new ConsultationService(db).detail(a, positive.parse(r.params.id))));
consultationRouter.put(`${base}/encounters/:id`, clinicalRun((db, a, r) => new ConsultationService(db).save(a, positive.parse(r.params.id), r.body)));
consultationRouter.delete(`${base}/encounters/:id`, clinicalRun((db, a, r) => new ConsultationService(db).remove(a, positive.parse(r.params.id), positive.parse(r.body.revision))));
consultationRouter.get(`${base}/patients/:id/vitals`, clinicalRun((db, a, r) => new ConsultationService(db).vitals(a, positive.parse(r.params.id), r.query)));
consultationRouter.post(`${base}/patients/:id/vitals`, clinicalRun((db, a, r) => new ConsultationService(db).recordVitals(a, positive.parse(r.params.id), r.body)));
consultationRouter.get(`${base}/patients/:id/vitals/:vitalId/history`, clinicalRun((db, a, r) => new ConsultationService(db).vitalHistory(a, positive.parse(r.params.id), positive.parse(r.params.vitalId))));
consultationRouter.put(`${base}/patients/:id/vitals/:vitalId`, clinicalRun((db, a, r) => new ConsultationService(db).recordVitals(a, positive.parse(r.params.id), r.body, positive.parse(r.params.vitalId))));
consultationRouter.get(`${base}/practitioners`, clinicalRun((db, a, r) => new PractitionerAccessService(db, a.tenantId).list(a, String(r.query.search || ''))));
consultationRouter.get(`${base}/branch-options`, clinicalRun(async (db, a) => { if (!manager(a))
    clinicalError('Manager access required', 403); const q = db('branch'); if (a.branch != null)
    q.where('branchid', a.branch); return q.select('branchid', 'name').orderBy('name'); }));
consultationRouter.get(`${base}/staff-options`, clinicalRun(async (db, a) => { if (!manager(a))
    clinicalError('Manager access required', 403); const q = db('roles').where({ activation: 1 }); if (a.branch != null)
    q.where('branch', a.branch); return q.whereIn('role', ['doctor', 'medical_officer', 'medical officer', 'consultant', 'pharmacy_doctor', 'pharmacy doctor', 'admin', 'manager', 'super admin', 'super_admin']).select('employeeid', 'username', 'role', 'branch').orderBy('username'); }));
consultationRouter.get(`${base}/practitioners/:id`, clinicalRun((db, a, r) => new PractitionerAccessService(db, a.tenantId).details(a, positive.parse(r.params.id))));
consultationRouter.put(`${base}/practitioners/:id`, clinicalRun((db, a, r) => new PractitionerAccessService(db, a.tenantId).configure(a, positive.parse(r.params.id), r.body)));
consultationRouter.post(`${base}/practitioners/:id/invitations`, clinicalRun((db, a, r) => new PractitionerAccessService(db, a.tenantId).invite(a, positive.parse(r.params.id), z.enum(['email', 'sms', 'link']).parse(r.body.channel))));
consultationRouter.delete(`${base}/practitioners/:id/invitations/:invitationId`, clinicalRun((db, a, r) => new PractitionerAccessService(db, a.tenantId).revoke(a, positive.parse(r.params.id), positive.parse(r.params.invitationId))));
consultationRouter.put(`${base}/practitioners/:id/patients/:patientid`, clinicalRun((db, a, r) => new PractitionerAccessService(db, a.tenantId).grant(a, positive.parse(r.params.id), positive.parse(r.params.patientid), z.boolean().parse(r.body.enabled))));
consultationRouter.post(`${base}/encounters/:id/reconcile`, clinicalRun(async (db, a, r) => { if (!manager(a))
    clinicalError('Manager access required', 403); const id = positive.parse(r.params.id), data = z.object({ clinicianid: positive, reason: z.string().trim().min(10).max(2000), revision: positive }).parse(r.body); await assertEncounter(db, a, id); return db.transaction(async (trx: any) => { const old = await trx('medicalrecords').where({ id }).forUpdate().first(); if (old.author_type !== 'legacy' || Number(old.revision) !== data.revision)
    clinicalError('Only an unchanged historical record can be reconciled', 409); const access = await trx('practitioner_access').where({ clinicianid: data.clinicianid }).first(); if (!access)
    clinicalError('Configure the practitioner first'); if (a.branch != null && Number(access.branchid) !== Number(a.branch))
    clinicalError('Practitioner is outside your branch', 403); const row = { author_type: access.staff_employeeid ? 'staff' : 'clinician', consulationby: access.staff_employeeid || access.clinicianid, encounter_status: 'signed', signed_at: old.created_at, revision: Number(old.revision) + 1 }; await trx('medicalrecords').where({ id }).update(row); await clinicalAudit(trx, a, 'encounter', id, 'legacy_reconciled', { before: old, reason: data.reason, after: row }); return row; }); }));
const limiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
for (const action of ['verify', 'accept'])
    publicPractitionerRouter.post(`/api/v1/practitioner-access/public/${action}`, limiter, async (req, res) => { res.setHeader('Cache-Control', 'no-store'); try {
        const token = z.string().max(150).parse(req.body.token), parsed = parseInvitationToken(token);
        if (!parsed)
            clinicalError('Invitation is invalid');
        const tenant = await resolvePublicTenant(parsed!.organization);
        if (!tenant)
            clinicalError('Invitation is unavailable');
        if (licenseMode() !== 'legacy')
            await requireOperationalLicense(effectiveTenantId(licensedTenantId(tenant!.tenantId)));
        const tid = configuration.isMultiTenant ? tenant!.tenantId : configuration.defaultTenantId;
        const svc = new PractitionerAccessService(await consultationDb(tid), tid);
        const result = action === 'accept' ? await svc.accept(token, req.body.password) : { username: (await svc.verify(token)).username };
        res.json({ success: true, data: result });
    }
    catch (e: any) {
        res.status(Number(e.statusCode) || 400).json({ success: false, message: e.statusCode ? e.message : 'Invitation could not be verified. Request a new invitation.' });
    } });
