import { describe, expect, it } from 'vitest';
import { resolveCommissionRecipient } from './CommissionRecipientPolicy';

describe('resolveCommissionRecipient', () => {
     it('uses the configured recipient when both linked IDs are provided', () => {
          const input = { clinician_id: 12, clinician_organization_id: 34, organization_id: 0 };

          expect(resolveCommissionRecipient(input, 'clinician')).toEqual({ recipientType: 'clinician', recipientId: 12 });
          expect(resolveCommissionRecipient(input, 'organization')).toEqual({ recipientType: 'organization', recipientId: 34 });
     });

     it('keeps clinician-only billing assigned to the clinician', () => {
          expect(resolveCommissionRecipient({ clinician_id: 12, organization_id: 0 }, 'organization'))
               .toEqual({ recipientType: 'clinician', recipientId: 12 });
     });

     it('keeps organization-only billing assigned to the organization', () => {
          expect(resolveCommissionRecipient({ clinician_id: null, organization_id: 34 }, 'clinician'))
               .toEqual({ recipientType: 'organization', recipientId: 34 });
     });

     it('uses the clinician affiliation instead of an unrelated billing organization for organization policy', () => {
          expect(resolveCommissionRecipient({ clinician_id: 12, clinician_organization_id: 56, organization_id: 34 }, 'organization'))
               .toEqual({ recipientType: 'organization', recipientId: 56 });
     });
});