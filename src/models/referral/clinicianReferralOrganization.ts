import type { Knex } from 'knex';

/**
 * Joins the organization a referring clinician worked at for this sale. When the sale's
 * organization is one the clinician is linked to, it is used; otherwise the clinician's main
 * organization (clinicianbasicinfo.organization) is used, exactly as before.
 * Expects `dboservices` joined to `clinicianbasicinfo as commission_clinician`.
 */
export function joinReferralClinicianOrganization<T extends Knex.QueryBuilder>(query: T): T {
     return query.leftJoin('clinician_organizations as referral_affiliation', function () {
          this.on('referral_affiliation.clinician_id', '=', 'dboservices.clinicianId')
               .andOn('referral_affiliation.organization_id', '=', 'dboservices.organizationId');
     }) as T;
}

export const REFERRAL_CLINICIAN_ORGANIZATION_SQL =
     'COALESCE(referral_affiliation.organization_id, commission_clinician.organization) AS clinicianOrganizationId';
