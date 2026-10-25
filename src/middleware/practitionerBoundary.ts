import { normalizeRole, roleAllowed } from './roles';
import { consultationDb, clinicalError } from '../models/consultation/ConsultationSchema';
import { practitioner, assertPatient, assertEncounter, careRoles } from '../models/consultation/ConsultationPolicy';
import { ConsultationService } from '../models/consultation/ConsultationService';
export function clinicianRouteAllowed(method: string, path: string, clinicianid: number) {
    const p = path.split('?')[0].replace(/\/$/, '');
    if (method === 'GET' && ['/api/v1/prime/validate-token', '/api/v1/settings/companyprofile/images', '/api/v1/notifications/inbox', '/api/v1/notifications/inbox/unread-count', '/api/v1/user/permissions'].includes(p))
        return true;
    if (method === 'POST' && ['/api/v1/logins/logout', '/api/v1/logins/reset-password', '/api/v1/prime/validate-user-pin'].includes(p))
        return true;
    if (/^\/api\/v1\/consultation\/(?:capabilities|catalogue|pending|patients(?:\/\d+(?:\/vitals(?:\/\d+(?:\/history)?)?)?)?|encounters(?:\/\d+)?)$/.test(p))
        return true;
    if (/^\/api\/v1\/records\/consul(?:t)?ation/.test(p))
        return ['GET', 'POST', 'PUT'].includes(method);
    if (p === '/api/v1/customers/vitalsigns/create')
        return method === 'GET' || method === 'POST';
    if (method === 'GET' && (/^\/api\/v1\/clinician-portal\/(?:requests|results\/\d+)$/.test(p) || false))
        return true;
    if (method === 'GET' && p === `/api/v1/commission-payments/clinician/${clinicianid}/portal`)
        return true;
    if (method === 'GET' && (p === `/api/v1/billing/strategies/clinician/${clinicianid}/has-strategy` || p === `/api/v1/billing/testpanel/strategies/panels/clinician/${clinicianid}` || p === '/api/v1/pharmacy/catalogue'))
        return true;
    if (/^\/api\/v1\/entityorders(?:\/summary|\/\d+)?$/.test(p))
        return method === 'GET' || (p === '/api/v1/entityorders' && method === 'POST');
    if (/^\/api\/v1\/entityorders\/\d+\/(?:submit|cancel|revise)$/.test(p))
        return method === 'POST';
    if (p === '/api/v1/entityorders/link-consultation')
        return method === 'PUT';
    if (/^\/api\/v1\/prescriptions(?:\/summary|\/patients\/search|\/[A-Za-z0-9-]+(?:\/referral-slip)?)?$/.test(p))
        return method === 'GET' || (p === '/api/v1/prescriptions' && method === 'POST');
    if (p === '/api/v1/prescriptions/link-consultation')
        return method === 'PUT';
    return false;
}
export async function practitionerBoundary(req: any, res: any, next: any) {
    try {
        const actor = req.authUser;
        if (!actor)
            return next();
        const role = normalizeRole(actor.role), path = req.path;
        if (role === 'clinician' || careRoles.some(value => normalizeRole(value) === role)) {
            const db = await consultationDb(actor.tenantId), access = await practitioner(db, actor);
            req.practitioner = access;
            if (path.startsWith('/api/v1/clinician-portal/')) {
                if (req.query.clinicianid && Number(req.query.clinicianid) !== Number(access.clinicianid))
                    clinicalError('Only your practitioner results are available', 403);
                req.query.clinicianid = String(access.clinicianid);
            }
            if (!clinicianRouteAllowed(req.method, path, access.clinicianid))
                clinicalError('This action is not available to practitioner portal accounts', 403);
        }
        const orderPath = /^\/api\/v1\/(entityorders|prescriptions|pharmacy\/catalogue|billing\/(?:strategies\/clinician|testpanel\/strategies\/panels\/clinician))/.test(path);
        if (!orderPath)
            return next();
        const clinical = req.query.practitionerContext === 'self' || req.body?.practitionerContext === true || role === 'clinician' || careRoles.some(value => normalizeRole(value) === role) || req.body?.consultationId != null || (path === '/api/v1/prescriptions' && req.method === 'POST');
        if (!clinical) {
            if ((path.includes('entityorders') || path.includes('/billing/')) && !roleAllowed(role, ['admin', 'manager', 'accountant', 'customer service representative']))
                clinicalError('Billing or practitioner authorization is required', 403);
            return next();
        }
        const db = await consultationDb(actor.tenantId), access = req.practitioner || await practitioner(db, actor);
        req.practitioner = access;
        const capabilities = await new ConsultationService(db).capabilities(actor);
        const lab = path.includes('entityorders') || path.includes('/billing/');
        if (lab ? !capabilities.canLab : !capabilities.canPrescribe)
            clinicalError(lab ? 'Laboratory referral permission is disabled' : 'Prescribing permission is disabled', 403);
        const catalogueId = path.match(/\/clinician\/(\d+)/)?.[1];
        if (catalogueId && Number(catalogueId) !== Number(access.clinicianid))
            clinicalError('Only your own catalogue is available', 403);
        if (req.query.clinicianId && Number(req.query.clinicianId) !== Number(access.clinicianid))
            clinicalError('You can only access your own orders', 403);
        if (req.method === 'GET' && (path === '/api/v1/entityorders' || path === '/api/v1/entityorders/summary' || path === '/api/v1/prescriptions' || path === '/api/v1/prescriptions/summary'))
            req.query.clinicianId = String(access.clinicianid);
        const patientid = Number(req.body?.patientId || req.query?.patientId || 0);
        if (patientid)
            await assertPatient(db, actor, patientid, access);
        if (req.body?.consultationId) {
            const encounter = await assertEncounter(db, actor, Number(req.body.consultationId), true);
            if (Number(encounter.patientid) !== patientid)
                clinicalError('Consultation and patient do not match');
        }
        if (path === '/api/v1/prescriptions' && req.method === 'POST') {
            if (!Array.isArray(req.body.items) || !req.body.items.length)
                clinicalError('Select at least one medicine');
            for (const item of req.body.items)
                for (const field of ['dose', 'frequency', 'route', 'duration'])
                    if (typeof item[field] !== 'string' || !item[field].trim() || item[field].length > 300)
                        clinicalError(`Provide valid ${field} directions for every medicine`);
        }
        if (path === '/api/v1/entityorders' && req.method === 'POST') {
            req.body.entityType = 'clinician';
            req.body.entityId = access.clinicianid;
            req.body.orderedByEmployeeId = access.clinicianid;
            req.body.branchId = access.branchid ?? actor.branch;
        }
        return next();
    }
    catch (e: any) {
        return res.status(e.statusCode || 500).json({ success: false, message: e.statusCode ? e.message : 'Unable to verify practitioner access' });
    }
}
