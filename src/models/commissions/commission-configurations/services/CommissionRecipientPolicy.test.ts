import { describe, expect, it } from 'vitest';
import { resolveCommissionRecipient } from './CommissionRecipientPolicy';

describe('resolveCommissionRecipient', () => {
     it.each([1, 3, 4])('uses the selected transaction parties for billing source %i', billing_source => {
          const input = { billing_source, clinician_id: 12, organization_id: 34, clinician_organization_id: 56 };
          expect(resolveCommissionRecipient(input, 'clinician')).toEqual({ recipientType: 'clinician', recipientId: 12 });
          expect(resolveCommissionRecipient(input, 'organization')).toEqual({ recipientType: 'organization', recipientId: 34 });
     });

     it.each([1, 3, 4])('keeps a sole clinician as recipient for billing source %i', billing_source => {
          expect(resolveCommissionRecipient({ billing_source, clinician_id: 12, organization_id: 0, clinician_organization_id: 56 }, 'organization'))
               .toEqual({ recipientType: 'clinician', recipientId: 12 });
     });

     it('always assigns organization billing to its organization', () => {
          const input = { billing_source: 2, clinician_id: 12, organization_id: 34, clinician_organization_id: 56 };
          expect(resolveCommissionRecipient(input, 'clinician')).toEqual({ recipientType: 'organization', recipientId: 34 });
     });

     it('always assigns clinician special billing to its clinician', () => {
          const input = { billing_source: 6, clinician_id: 12, organization_id: 34, clinician_organization_id: 56 };
          expect(resolveCommissionRecipient(input, 'organization')).toEqual({ recipientType: 'clinician', recipientId: 12 });
     });

     it.each([1, 3, 4])('keeps a sole selected organization as recipient for billing source %i', billing_source => {
          expect(resolveCommissionRecipient({ billing_source, clinician_id: null, organization_id: 34 }, 'clinician'))
               .toEqual({ recipientType: 'organization', recipientId: 34 });
     });

     it('does not substitute a different party when a fixed source recipient is missing', () => {
          expect(resolveCommissionRecipient({ billing_source: 2, clinician_id: 12, organization_id: 0 }, 'clinician'))
               .toEqual({ recipientType: 'organization', recipientId: 0 });
          expect(resolveCommissionRecipient({ billing_source: 6, clinician_id: null, organization_id: 34 }, 'organization'))
               .toEqual({ recipientType: 'clinician', recipientId: 0 });
     });

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
