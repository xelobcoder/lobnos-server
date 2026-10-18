import knex from 'knex';
import { describe, expect, it } from 'vitest';
import { parsePositiveId } from './ClinicianOrganizationService';
import { joinReferralClinicianOrganization, REFERRAL_CLINICIAN_ORGANIZATION_SQL } from './clinicianReferralOrganization';
import { normalizeQuickReferralEntity } from './quickReferralEntity';

describe('clinician organizations', () => {
     it('parses only positive integer ids', () => {
          expect(parsePositiveId('12')).toBe(12);
          expect(parsePositiveId(7)).toBe(7);
          for (const value of ['0', '-3', '1.5', 'abc', '', null, undefined, '12; DROP']) {
               expect(parsePositiveId(value)).toBeNull();
          }
     });

     it('quick-add clinician accepts an optional organization to link', () => {
          expect(normalizeQuickReferralEntity('clinician', { name: 'Dr Mensah', organizationId: '4' }).value)
               .toEqual({ name: 'Dr Mensah', phone: null, email: null, organizationId: 4 });
          expect(normalizeQuickReferralEntity('clinician', { name: 'Dr Mensah', organizationId: '' }).value)
               .toEqual({ name: 'Dr Mensah', phone: null, email: null });
          expect(normalizeQuickReferralEntity('clinician', { name: 'Dr Mensah', organizationId: 'x' }).error).toBeTruthy();
          expect(normalizeQuickReferralEntity('organization', { name: 'Ridge', organizationId: 4 }).value)
               .toEqual({ name: 'Ridge', phone: null, email: null });
     });

     it('commission uses the sale organization when the clinician is linked to it, else the main organization', () => {
          const db = knex({ client: 'mysql2' });
          const sql = joinReferralClinicianOrganization(db('dboservices')
               .leftJoin('clinicianbasicinfo as commission_clinician', 'dboservices.clinicianId', 'commission_clinician.id'))
               .where({ billingid: 9 })
               .select('dboservices.serviceid', db.raw(REFERRAL_CLINICIAN_ORGANIZATION_SQL))
               .toSQL().sql;
          expect(sql).toContain('left join `clinician_organizations` as `referral_affiliation` on `referral_affiliation`.`clinician_id` = `dboservices`.`clinicianId` and `referral_affiliation`.`organization_id` = `dboservices`.`organizationId`');
          expect(sql).toContain('COALESCE(referral_affiliation.organization_id, commission_clinician.organization) AS clinicianOrganizationId');
     });
});
