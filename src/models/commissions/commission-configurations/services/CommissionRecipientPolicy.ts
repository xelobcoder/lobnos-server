import { CommissionInput } from '../interfaces';

export type CommissionRecipientPolicyValue = 'clinician' | 'organization';

export function resolveCommissionRecipient(
     input: Pick<CommissionInput, 'clinician_id' | 'organization_id' | 'clinician_organization_id' | 'billing_source'>,
     policy: CommissionRecipientPolicyValue
): { recipientType: CommissionRecipientPolicyValue; recipientId: number } {
     const clinicianId = Number(input.clinician_id) > 0 ? Number(input.clinician_id) : null;
     const selectedOrganizationId = Number(input.organization_id) > 0 ? Number(input.organization_id) : null;
     const source = Number(input.billing_source);

     if (source === 2) return { recipientType: 'organization', recipientId: selectedOrganizationId || 0 };
     if (source === 6) return { recipientType: 'clinician', recipientId: clinicianId || 0 };

     if ([1, 3, 4].includes(source)) {
          if (selectedOrganizationId && (!clinicianId || policy === 'organization')) {
               return { recipientType: 'organization', recipientId: selectedOrganizationId };
          }
          if (clinicianId) return { recipientType: 'clinician', recipientId: clinicianId };
          return { recipientType: 'organization', recipientId: 0 };
     }

     // Preserve affiliation-based resolution for historical callers without a billing source.
     const candidateOrganizationId = clinicianId
          ? policy === 'organization' ? input.clinician_organization_id : null
          : input.organization_id;
     const organizationId = Number(candidateOrganizationId) > 0 ? Number(candidateOrganizationId) : null;

     if (clinicianId && organizationId) {
          return policy === 'organization'
               ? { recipientType: 'organization', recipientId: organizationId }
               : { recipientType: 'clinician', recipientId: clinicianId };
     }

     if (clinicianId) return { recipientType: 'clinician', recipientId: clinicianId };
     return { recipientType: 'organization', recipientId: organizationId || 0 };
}
