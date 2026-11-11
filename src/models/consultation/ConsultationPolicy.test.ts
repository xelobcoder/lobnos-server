import { beforeEach, describe, expect, it, vi } from 'vitest';
import knex from 'knex';
import { ownsEncounter, patientScope, practitioner } from './ConsultationPolicy';
import { clinicianRouteAllowed, staffPractitionerAccountRoute, practitionerBoundary } from '../../middleware/practitionerBoundary';
import { vitalInput } from './ConsultationService';
describe('Clinical identity and API boundary', () => {
    it('denies external practitioners access to staff PIN verification', () => {
        expect(clinicianRouteAllowed('POST', '/api/v1/prime/validate-user-pin', 7)).toBe(false);
    });
    it('lets an already authenticated staff doctor validate their login and reach setup status without a practitioner profile',async()=>{
        for(const path of ['/api/v1/prime/validate-token','/api/v1/prime/my-roles','/api/v1/consultation/capabilities']){
            const next=vi.fn(),res={status:vi.fn().mockReturnThis(),json:vi.fn()};
            await practitionerBoundary({method:'GET',path,authUser:{employeeid:3,role:'pharmacy_doctor',tenantId:2,branch:2},query:{},body:{}},res,next);
            expect(next).toHaveBeenCalledOnce();expect(res.status).not.toHaveBeenCalled();
        }
    });
    it('does not require a clinical profile to restore staff identity or read setup status, and never exempts patient data',()=>{
        for(const path of ['/api/v1/prime/validate-token','/api/v1/prime/my-roles','/api/v1/consultation/capabilities'])expect(staffPractitionerAccountRoute('GET',path,'pharmacy_doctor')).toBe(true);
        expect(staffPractitionerAccountRoute('POST','/api/v1/prime/refresh-role-session','doctor')).toBe(true);
        expect(staffPractitionerAccountRoute('POST','/api/v1/prime/switch-role','doctor')).toBe(true);
        for(const path of ['/api/v1/consultation/patients','/api/v1/consultation/encounters','/api/v1/prescriptions','/api/v1/consultation/staff/3/access'])expect(staffPractitionerAccountRoute('GET',path,'doctor')).toBe(false);
        expect(staffPractitionerAccountRoute('GET','/api/v1/consultation/capabilities','clinician')).toBe(false);
    });
    it('does not confuse a staff author with an external practitioner sharing the same ID', () => { expect(ownsEncounter({ role: 'clinician', employeeid: 7 }, { author_type: 'staff', consulationby: 7 })).toBe(false); expect(ownsEncounter({ role: 'doctor', employeeid: 7 }, { author_type: 'clinician', consulationby: 7 })).toBe(false); expect(ownsEncounter({ role: 'clinician', employeeid: 7 }, { author_type: 'legacy', consulationby: 7 })).toBe(false); expect(ownsEncounter({ role: 'doctor', employeeid: 7 }, { author_type: 'staff', consulationby: 7 })).toBe(true); });
    it('requires a live configured and enabled profile', async () => { const db: any = () => ({ where: () => ({ first: async () => null }) }); await expect(practitioner(db, { role: 'clinician', employeeid: 7 })).rejects.toThrow('disabled'); });
    it('scopes patient queries to grants or live referrals using bound IDs', () => { const db = knex({ client: 'mysql2' }); const sql = patientScope(db('new_patients as np'), db, { role: 'clinician' }, { clinicianid: 7 }).toSQL(); expect(sql.sql).toContain('practitioner_patient_access'); expect(sql.sql).toContain('clinicianId'); expect(sql.sql).toContain('revoked_at'); expect(sql.bindings.filter(v => v === 7)).toHaveLength(2); expect(sql.sql).toContain('COALESCE(ds.isDeleted,0)=0'); });
    it.each([['POST', '/api/v1/records/consulation'], ['GET', '/api/v1/consultation/patients/4'], ['PUT', '/api/v1/consultation/encounters/4'], ['GET', '/api/v1/clinician-portal/results/3'], ['POST', '/api/v1/entityorders/8/submit']])('allows supported clinical paths %s %s', (method, path) => expect(clinicianRouteAllowed(method, path, 7)).toBe(true));
    it.each([['GET', '/api/v1/customers'], ['POST', '/api/v1/entityorders/8/approve'], ['POST', '/api/v1/prescriptions/abc/fulfill'], ['PUT', '/api/v1/consultation/practitioners/7'], ['GET', '/api/v1/billing/testpanel/strategies/panels/clinician/8'], ['GET', '/api/v1/settings/users']])('denies unrelated or privileged paths %s %s', (method, path) => expect(clinicianRouteAllowed(method, path, 7)).toBe(false));
});
describe('Vital observation validation', () => {
    const full = { blood_pressure_upperLimit: '120', blood_pressure_lowerLimit: '80', temperature: '36.8', pulse: '80', respiration: '20', spo2: '98', weight_kg: '', height_cm: '' };
    it('strictly rejects malformed, nonfinite and out-of-unit observations', () => { for (const value of ['80bpm', 'NaN', 'Infinity', ' '])
        expect(vitalInput.safeParse({ ...full, pulse: value }).success).toBe(false); expect(vitalInput.safeParse({ ...full, spo2: 101 }).success).toBe(false); });
    it('retains zero oxygen saturation rather than treating it as missing', () => { expect(vitalInput.parse({ ...full, spo2: '0' }).spo2).toBe(0); });
    it('preserves decimal temperatures and rejects precision that storage cannot retain', () => {
        expect(vitalInput.parse({ ...full, temperature: '36.85' }).temperature).toBe(36.85);
        expect(vitalInput.safeParse({ ...full, temperature: '36.855' }).success).toBe(false);
        for (const field of ['pulse', 'respiration', 'spo2']) expect(vitalInput.safeParse({ ...full, [field]: '20.5' }).success).toBe(false);
    });
    it('allows partial observations only with an explicit reason', () => { expect(vitalInput.safeParse({ temperature: 36.8 }).success).toBe(false); expect(vitalInput.parse({ temperature: 36.8, missing_reason: 'Patient declined remaining observations' }).pulse).toBeNull(); });
    it('rejects half a blood pressure pair and inverted values', () => { expect(vitalInput.safeParse({ blood_pressure_upperLimit: 120, missing_reason: 'Not obtained' }).success).toBe(false); expect(vitalInput.safeParse({ ...full, blood_pressure_lowerLimit: 130 }).success).toBe(false); });
    it('rejects future observation timestamps', () => { expect(vitalInput.safeParse({ ...full, observed_at: new Date(Date.now() + 86400000).toISOString() }).success).toBe(false); });
});
