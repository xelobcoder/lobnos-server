import bcrypt from 'bcrypt';
import { clearLoginAttempts } from '../auth/LoginAttemptSecurity';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { clinicalError, clinicalAudit } from './ConsultationSchema';
import { manager, careRoles } from './ConsultationPolicy';
import { roleAllowed } from '../../middleware/roles';
import { formatTenantLoginUsername } from '../auth/TenantLoginUsername';
import { TenantRegistry } from '../Tenancy/TenantRegistry';
import { effectiveTenantId } from '../../hooks/configuration';
import { PortalInvitationDelivery } from '../patient-portal/PortalInvitationDelivery';
import { validatePortalPassword } from '../patient-portal/PatientPortalAccountService';
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
export const accessInput = z.object({ version: z.number().int().min(0), enabled: z.boolean(), staff_employeeid: z.number().int().positive().nullable(), branchid: z.number().int().positive().nullable(), practice_type: z.enum(['external', 'facility', 'pharmacy']), can_consult: z.boolean(), can_lab: z.boolean(), can_prescribe: z.boolean() });
export class PractitionerAccessService {
    constructor(private db: any, private tenantId: number) { }
    private async scope(actor: any, clinicianid: number) { this.admin(actor); const row = await this.db('practitioner_access').where({ clinicianid }).first(); if (actor.branch != null && row?.branchid != null && Number(row.branchid) !== Number(actor.branch))
        clinicalError('Practitioner is outside your branch', 403); }
    private admin(actor: any) { if (!manager(actor))
        clinicalError('Only administrators and managers may manage practitioner access', 403); }
    async staffDetails(actor:any,employeeid:number){
        this.admin(actor);
        const staff=await this.db('roles').where({employeeid}).select('employeeid','username','role','branch').first();
        if(!staff)clinicalError('Staff account not found',404);
        if(actor.branch!=null&&Number(staff.branch)!==Number(actor.branch))clinicalError('Switch to the staff member’s operating location before configuring practitioner access',403);
        const access=await this.db('practitioner_access').where({staff_employeeid:employeeid}).first();
        if(access&&actor.branch!=null&&Number(access.branchid)!==Number(actor.branch))clinicalError('Practitioner is outside your branch',403);
        return {staff,access:access?{...access,enabled:!!Number(access.enabled),can_consult:!!Number(access.can_consult),can_lab:!!Number(access.can_lab),can_prescribe:!!Number(access.can_prescribe)}:{version:0,enabled:false,branchid:staff.branch,practice_type:String(staff.role).startsWith('pharmacy')?'pharmacy':'facility',can_consult:false,can_lab:false,can_prescribe:false}};
    }
    async configureStaff(actor:any,employeeid:number,input:any){
        this.admin(actor);
        const data=accessInput.parse({...input,staff_employeeid:employeeid});
        if(data.practice_type==='external'||data.branchid==null)clinicalError('Choose a facility or pharmacy practice and operating location');
        if(actor.branch!=null&&Number(actor.branch)!==data.branchid)clinicalError('Choose your operating branch',403);
        return this.db.transaction(async(trx:any)=>{
            const staff=await trx('roles').where({employeeid}).forUpdate().first();
            if(!staff||Number(staff.activation)!==1)clinicalError('Choose an active staff account');
            const assigned=await trx('staff_role_access').where({employeeid,branchid:data.branchid}).whereIn('role',careRoles).first();
            if(Number(staff.branch)!==data.branchid||(!roleAllowed(staff.role,[...careRoles,'admin','manager'])&&!assigned))clinicalError('The staff account needs an assigned practitioner role at this location',403);
            const old=await trx('practitioner_access').where({staff_employeeid:employeeid}).first();
            if(old&&actor.branch!=null&&Number(old.branchid)!==Number(actor.branch))clinicalError('Practitioner is outside your branch',403);
            if(Number(old?.version||0)!==data.version)clinicalError('Practitioner settings changed. Reload before saving.',409);
            let clinicianid=old?.clinicianid;
            if(!clinicianid){
                if(await trx('clinicianbasicinfo').where({phone:staff.mobile}).first())clinicalError('A practitioner already uses this mobile number. Link the existing profile in Practitioner access instead of creating a duplicate.');
                if(String(staff.email||'').length>100)clinicalError('Use a practitioner contact email of at most 100 characters');
                const ids=await trx('clinicianbasicinfo').insert({name:staff.username,phone:staff.mobile,email:staff.email||null,identifier:`STAFF${employeeid}`,occupation:'Medical practitioner'});
                clinicianid=Number(ids[0]);
            }
            const row={...data,clinicianid,version:data.version+1,updated_by:actor.employeeid,updated_at:new Date()};
            if(old)await trx('practitioner_access').where({clinicianid}).update(row);else await trx('practitioner_access').insert(row);
            await clinicalAudit(trx,actor,'practitioner',clinicianid,'staff_access_configured',{before:old||null,after:row});
            return row;
        });
    }
    baseUrl() { return (process.env.PRACTITIONER_PORTAL_URL || process.env.FRONTEND_URL || process.env.PATIENT_PORTAL_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:2377' : '')).replace(/\/$/, ''); }
    async list(actor: any, search = '') { this.admin(actor); const q = this.db('clinicianbasicinfo as c').leftJoin('practitioner_access as a', 'a.clinicianid', 'c.id'); if (actor.branch != null)
        q.where(function (this: any) { this.where('a.branchid', actor.branch).orWhereNull('a.branchid'); }); return q.where(function (this: any) { this.where('c.name', 'like', `%${search.slice(0, 100)}%`).orWhere('c.id', Number(search) || 0); }).select('c.id', 'c.name', 'c.email', 'c.phone', 'a.enabled', 'a.practice_type', 'a.staff_employeeid').orderBy('c.name').limit(50); }
    async details(actor: any, clinicianid: number) { await this.scope(actor, clinicianid); const clinician = await this.db('clinicianbasicinfo').where({ id: clinicianid }).select('id', 'name', 'email', 'phone').first(); if (!clinician)
        clinicalError('Practitioner not found', 404); const access = await this.db('practitioner_access').where({ clinicianid }).first(); return { clinician, access: access ? { ...access, enabled: !!Number(access.enabled), can_consult: !!Number(access.can_consult), can_lab: !!Number(access.can_lab), can_prescribe: !!Number(access.can_prescribe) } : { version: 0, enabled: false, staff_employeeid: null, branchid: null, practice_type: 'external', can_consult: true, can_lab: true, can_prescribe: true }, username: await formatTenantLoginUsername(this.tenantId, 'clinician', clinicianid), channels: await new PortalInvitationDelivery(this.tenantId).availability(this.db, { email: clinician.email, mobile_number: clinician.phone }, this.baseUrl()), invitations: await this.db('practitioner_invitations').where({ clinicianid }).select('id', 'expires_at', 'used_at', 'revoked_at', 'created_at', 'channel', 'delivery_status').orderBy('id', 'desc').limit(20), patients: await this.db('practitioner_patient_access as a').join('new_patients as p', 'p.patientid', 'a.patientid').where('a.clinicianid', clinicianid).whereNull('a.revoked_at').select('p.patientid', 'p.fullpatientid', 'p.firstname', 'p.lastname') }; }
    async configure(actor: any, clinicianid: number, input: any) {
        await this.scope(actor, clinicianid);
        const data = accessInput.parse(input);
        if (actor.branch != null && data.branchid !== Number(actor.branch))
            clinicalError('Choose your operating branch', 403);
        if (data.practice_type === 'external' && data.staff_employeeid)
            clinicalError('External practitioners use their own portal account');
        if (data.practice_type !== 'external' && !data.staff_employeeid)
            clinicalError('Link an active staff account for an internal practitioner');
        const result = await this.db.transaction(async (trx: any) => {
            if (!await trx('clinicianbasicinfo').where({ id: clinicianid }).forUpdate().first())
                clinicalError('Practitioner not found', 404);
            const old = await trx('practitioner_access').where({ clinicianid }).first();
            if (Number(old?.version || 0) !== data.version)
                clinicalError('Access settings changed. Reload before saving.', 409);
            if (data.staff_employeeid) {
                const staff = await trx('roles').where({ employeeid: data.staff_employeeid }).first();
                if (!staff || Number(staff.activation) !== 1)
                    clinicalError('Choose an active staff account');
                if (!roleAllowed(staff.role, [...careRoles, 'admin', 'manager']))
                    clinicalError('Link an account with a practitioner role, or an explicitly authorized administrator');
                if (data.branchid != null && Number(staff.branch) !== data.branchid)
                    clinicalError('Staff account and practitioner branch must match');
                if (await trx('practitioner_access').where({ staff_employeeid: data.staff_employeeid }).whereNot('clinicianid', clinicianid).first())
                    clinicalError('This staff account is linked to another practitioner');
            }
            const row = { ...data, clinicianid, version: data.version + 1, updated_by: actor.employeeid, updated_at: new Date() };
            if (old)
                await trx('practitioner_access').where({ clinicianid }).update(row);
            else
                await trx('practitioner_access').insert(row);
            if (!data.enabled) {
                await trx('practitioner_invitations').where({ clinicianid }).whereNull('used_at').whereNull('revoked_at').update({ revoked_at: new Date() });
                await trx('clinicianscredentials').where({ clinicianid }).update({ password: await bcrypt.hash(randomBytes(32).toString('hex'), 10), ispasswordUpdated: 1 });
            }
            await clinicalAudit(trx, actor, 'practitioner', clinicianid, 'access_updated', { before: old, after: row });
            return row;
        });
        return result;
    }
    async grant(actor: any, clinicianid: number, patientid: number, enabled: boolean) { await this.scope(actor, clinicianid); return this.db.transaction(async (trx: any) => { if (!await trx('clinicianbasicinfo').where({ id: clinicianid }).forUpdate().first())
        clinicalError('Practitioner not found', 404); if (!await trx('new_patients').where({ patientid }).first())
        clinicalError('Patient not found', 404); if (actor.branch != null && await trx('billing').where({ patientid }).first() && !await trx('billing').where({ patientid, branchid: actor.branch }).first())
        clinicalError('Patient is outside your branch', 403); await trx('practitioner_patient_access').insert({ clinicianid, patientid, granted_by: actor.employeeid, created_at: new Date(), revoked_at: enabled ? null : new Date() }).onConflict(['clinicianid', 'patientid']).merge(['granted_by', 'created_at', 'revoked_at']); await clinicalAudit(trx, actor, 'practitioner', clinicianid, enabled ? 'patient_granted' : 'patient_revoked', { patientid }); return true; }); }
    async invite(actor: any, clinicianid: number, channel: 'link' | 'email' | 'sms') {
        await this.scope(actor, clinicianid);
        const base = this.baseUrl();
        try {
            if (!['http:', 'https:'].includes(new URL(base).protocol))
                throw Error();
        }
        catch {
            clinicalError('Configure FRONTEND_URL or PRACTITIONER_PORTAL_URL before inviting a practitioner');
        }
        const clinician = await this.db('clinicianbasicinfo').where({ id: clinicianid }).select('name', 'email', 'phone').first();
        if (!clinician)
            clinicalError('Practitioner not found', 404);
        const delivery = new PortalInvitationDelivery(this.tenantId, 'practitioner');
        const channels = await delivery.availability(this.db, { email: clinician.email, mobile_number: clinician.phone }, base);
        if (channel !== 'link' && !channels[channel].available)
            clinicalError(channels[channel].reason || 'Delivery channel unavailable');
        const registry = await new TenantRegistry().requireTenant(effectiveTenantId(this.tenantId));
        const token = `${registry.platformId}.${randomBytes(32).toString('base64url')}`, expiresAt = new Date(Date.now() + 24 * 3600000);
        const invitationId = await this.db.transaction(async (trx: any) => {
            await trx('clinicianbasicinfo').where({ id: clinicianid }).forUpdate().first();
            const access = await trx('practitioner_access').where({ clinicianid }).first();
            if (!access)
                clinicalError('Save practitioner permissions before sending an invitation');
            if (access.staff_employeeid)
                clinicalError('Internal practitioners sign in with their linked staff account');
            const last = await trx('practitioner_invitations').where({ clinicianid }).orderBy('id', 'desc').first();
            if (last && Date.now() - new Date(last.created_at).getTime() < 60000)
                clinicalError('Wait 60 seconds before resending an invitation', 429);
            await trx('practitioner_invitations').where({ clinicianid }).whereNull('used_at').whereNull('revoked_at').update({ revoked_at: new Date() });
            const ids = await trx('practitioner_invitations').insert({ clinicianid, token_hash: digest(token), expires_at: expiresAt, created_at: new Date(), created_by: actor.employeeid, channel, delivery_status: 'not_requested' });
            await clinicalAudit(trx, actor, 'practitioner', clinicianid, 'invited', { invitationId: Number(ids[0]), channel });
            return Number(ids[0]);
        });
        const link = `${base}/practitioner-access/invite?token=${encodeURIComponent(token)}`;
        const result = channel === 'link' ? { channel, status: 'not_requested', reason: null } : await delivery.send(channel, { email: clinician.email, mobile_number: clinician.phone }, link, expiresAt);
        await this.db('practitioner_invitations').where({ id: invitationId }).update({ delivery_status: result.status });
        return { id: invitationId, link, expiresAt, delivery: result };
    }
    async revoke(actor: any, clinicianid: number, invitationId: number) { await this.scope(actor, clinicianid); await this.db('practitioner_invitations').where({ id: invitationId, clinicianid }).whereNull('used_at').update({ revoked_at: new Date() }); await clinicalAudit(this.db, actor, 'practitioner', clinicianid, 'invitation_revoked', { invitationId }); return true; }
    async verify(token: string) { const invitation = await this.db('practitioner_invitations').where({ token_hash: digest(token) }).first(); if (!invitation || invitation.used_at || invitation.revoked_at || new Date(invitation.expires_at).getTime() <= Date.now())
        clinicalError('This invitation is invalid, expired or already used', 400); const access = await this.db('practitioner_access').where({ clinicianid: invitation.clinicianid }).first(); if (!access || access.staff_employeeid)
        clinicalError('This invitation is unavailable'); return { invitation, username: await formatTenantLoginUsername(this.tenantId, 'clinician', invitation.clinicianid) }; }
    async accept(token: string, password: unknown) { const validPassword = validatePortalPassword(password); const verified = await this.verify(token); const hash = await bcrypt.hash(validPassword, 10); return this.db.transaction(async (trx: any) => { await trx('clinicianbasicinfo').where({ id: verified.invitation.clinicianid }).forUpdate().first(); const invitation = await trx('practitioner_invitations').where({ id: verified.invitation.id }).forUpdate().first(); if (invitation.used_at || invitation.revoked_at || new Date(invitation.expires_at).getTime() <= Date.now())
        clinicalError('This invitation is invalid, expired or already used'); const access = await trx('practitioner_access').where({ clinicianid: invitation.clinicianid }).first(); if (!access || access.staff_employeeid)
        clinicalError('Invitation is unavailable'); const credentials = { password: hash, ispasswordUpdated: 1, login_username: verified.username }; const updated = await trx('clinicianscredentials').where({ clinicianid: invitation.clinicianid }).update(credentials); if (!updated)
        clinicalError('Practitioner credentials are unavailable');
        await clearLoginAttempts(trx, 'clinician', Number(invitation.clinicianid));
        await trx('practitioner_access').where({ clinicianid: invitation.clinicianid }).update({ enabled: true, version: Number(access.version) + 1, updated_at: new Date() }); await trx('practitioner_invitations').where({ id: invitation.id }).update({ used_at: new Date() }); await clinicalAudit(trx, { employeeid: invitation.clinicianid, role: 'clinician' }, 'practitioner', invitation.clinicianid, 'activated'); return { username: verified.username }; }); }
}
