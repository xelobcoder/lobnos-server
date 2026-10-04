import { describe, expect, it, vi } from 'vitest';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));

import { AuthUser } from '../../middleware/authority';
import { SuspendedBillingDraftInput, SuspendedBillingService } from './SuspendedBillingService';

const actor: AuthUser = {
     employeeid: 12,
     email: 'cashier@example.com',
     role: 'customer service representative',
     branch: 4,
     tenantId: 3,
};

const baseDraft: SuspendedBillingDraftInput = {
     patientid: 101,
     billingSource: 1,
     selectedTestIds: [50],
     selectedServiceIds: [],
};

function validate(actorInput: AuthUser, draft: SuspendedBillingDraftInput) {
     return (new SuspendedBillingService(3) as any).validate(actorInput, draft);
}

describe('SuspendedBillingService validation', () => {
     it('accepts a patient-bound, branch-scoped new sale draft', () => {
          expect(() => validate(actor, baseDraft)).not.toThrow();
     });

     it('accepts a patientless price quote only when explicitly marked', () => {
          expect(() => validate(actor, {
               ...baseDraft,
               patientid: null,
               isPricingQuote: true,
          })).not.toThrow();

          expect(() => validate(actor, {
               ...baseDraft,
               patientid: null,
          })).toThrow('Select a patient');
     });

     it('requires a selected test, service, or package', () => {
          expect(() => validate(actor, {
               ...baseDraft,
               selectedTestIds: [],
          })).toThrow('Select at least one');

          expect(() => validate(actor, {
               ...baseDraft,
               selectedTestIds: [],
               isPackageUsed: true,
               packageid: 8,
          })).not.toThrow();
     });

     it('requires NHIS member and claim codes for an NHIS draft', () => {
          expect(() => validate(actor, {
               ...baseDraft,
               billingSource: 4,
          })).toThrow('NHIS membership and claim check codes');

          expect(() => validate(actor, {
               ...baseDraft,
               billingSource: 4,
               nhismembershipid: 12345,
               claimscheckcode: 67890,
          })).not.toThrow();
     });

     it('requires an employee branch for all suspended records', () => {
          expect(() => validate({ ...actor, branch: null }, baseDraft)).toThrow('assigned branch is required');
     });
});
