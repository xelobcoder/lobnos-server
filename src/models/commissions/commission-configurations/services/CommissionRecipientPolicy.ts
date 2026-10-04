import { CommissionInput } from '../interfaces';

export type CommissionRecipientPolicyValue = 'clinician' | 'organization';

export function resolveCommissionRecipient(
     input: Pick<CommissionInput, 'clinician_id' | 'organization_id' | 'clinician_organization_id'>,
     policy: CommissionRecipientPolicyValue
): { recipientType: CommissionRecipientPolicyValue; recipientId: number } {
     const clinicianId = Number(input.clinician_id) > 0 ? Number(input.clinician_id) : null;
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