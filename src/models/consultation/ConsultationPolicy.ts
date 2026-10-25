import { normalizeRole, roleAllowed } from '../../middleware/roles';
import { clinicalError } from './ConsultationSchema';
export const careRoles = ['doctor', 'medical_officer', 'consultant', 'pharmacy_doctor'];
export const triageRoles = ['nurse', 'nursing', 'pharmacy_nurse', 'scientist', 'phlebotomist', 'phelobotomist'];
export const manager = (actor: any) => roleAllowed(actor.role, ['admin', 'manager']);
export async function practitioner(db: any, actor: any) {
    if (!actor)
        clinicalError('Authentication required', 401);
    if (['patient', 'organization', 'outsourced'].includes(normalizeRole(actor.role)) || !actor.role)
        clinicalError('A practitioner or linked staff account is required', 403);
    const external = normalizeRole(actor.role) === 'clinician';
    const query = db('practitioner_access').where(external ? { clinicianid: Number(actor.clinicianid || actor.employeeid) } : { staff_employeeid: actor.employeeid });
    const access = await query.first();
    if (external && access?.staff_employeeid)
        clinicalError('Use the linked staff account to sign in', 403);
    if (!access || !Number(access.enabled))
        clinicalError('Practitioner access is disabled or has not been configured', 403);
    if (!external) {
        const staff = await db('roles').where({ employeeid: actor.employeeid }).first();
        if (!staff || Number(staff.activation) !== 1 || normalizeRole(staff.role) !== normalizeRole(actor.role) || !roleAllowed(staff.role, [...careRoles, 'admin', 'manager']))
            clinicalError('The linked staff account is inactive or no longer has a practitioner role', 403);
    }
    if (access.branchid != null && actor.branch != null && Number(access.branchid) !== Number(actor.branch))
        clinicalError('Practitioner branch does not match your session', 403);
    return { ...access, author_type: external ? 'clinician' : 'staff', author_id: Number(actor.employeeid) };
}
export function patientScope(query: any, db: any, actor: any, access: any, column = 'np.patientid') {
    if (manager(actor) && !access)
        return query;
    return query.where(function (this: any) {
        this.whereExists(function (this: any) { this.select(db.raw('1')).from('practitioner_patient_access as grant').whereRaw('grant.patientid = ??', [column]).where('grant.clinicianid', access.clinicianid).whereNull('grant.revoked_at'); })
            .orWhereExists(function (this: any) { this.select(db.raw('1')).from('dboservices as ds').join('billing as b', 'b.billingid', 'ds.billingid').whereRaw('b.patientid = ??', [column]).where('ds.clinicianId', access.clinicianid).modify((q: any) => { if (access.branchid != null)
            q.where('b.branchid', access.branchid); }).whereRaw('COALESCE(ds.isDeleted,0)=0').whereRaw("COALESCE(b.status,'') <> 'voided'").whereRaw("COALESCE(ds.status,'') NOT IN ('cancelled','voided','refunded')"); });
    });
}
export function branchCareScope(query: any, db: any, branch: number, column = 'np.patientid') { return query.where(function (this: any) { this.whereExists(function (this: any) { this.select(db.raw('1')).from('billing as b').whereRaw('b.patientid=??', [column]).where('b.branchid', branch); }).orWhereExists(function (this: any) { this.select(db.raw('1')).from('practitioner_patient_access as care').join('practitioner_access as pa', 'pa.clinicianid', 'care.clinicianid').whereRaw('care.patientid=??', [column]).where('pa.branchid', branch).where('pa.enabled', true).whereNull('care.revoked_at'); }); }); }
export async function assertPatient(db: any, actor: any, patientid: number, access?: any) {
    if (!Number.isSafeInteger(patientid) || patientid <= 0)
        clinicalError('A valid patient is required');
    if (!access && !manager(actor) && !roleAllowed(actor.role, triageRoles))
        access = await practitioner(db, actor);
    if (!access && !manager(actor) && actor.branch == null)
        clinicalError('An operating branch is required', 403);
    let query = db('new_patients as np').where('np.patientid', patientid);
    if (access)
        query = patientScope(query, db, actor, access);
    else if (actor.branch != null)
        branchCareScope(query, db, actor.branch);
    const patient = await query.select('np.patientid', 'np.fullpatientid', 'np.firstname', 'np.middlename', 'np.lastname', 'np.gender', 'np.dob', 'np.age', 'np.agetype').first();
    if (!patient)
        clinicalError('Patient is not available in your care scope', 404);
    return patient;
}
export function ownsEncounter(actor: any, row: any) { return row.author_type === (normalizeRole(actor.role) === 'clinician' ? 'clinician' : 'staff') && Number(row.consulationby) === Number(actor.employeeid); }
export async function assertEncounter(db: any, actor: any, id: number, write = false) {
    const row = await db('medicalrecords').where({ id }).whereNull('deleted_at').first();
    if (!row)
        clinicalError('Consultation not found', 404);
    const access = manager(actor) && !write ? null : await practitioner(db, actor);
    await assertPatient(db, actor, Number(row.patientid), access);
    if ((write || normalizeRole(actor.role) === 'clinician') && !ownsEncounter(actor, row))
        clinicalError('This consultation belongs to another practitioner', 403);
    return row;
}
