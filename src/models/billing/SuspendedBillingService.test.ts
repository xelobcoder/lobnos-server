import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));

import { AuthUser } from '../../middleware/authority';
import { SuspendedBillingDraftInput, SuspendedBillingService } from './SuspendedBillingService';
import KnexConnection from '../../database/KnexConnections';

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

     it('rejects malformed selections, incomplete packages and existing billing adjustments', () => {
          expect(() => validate(actor, { ...baseDraft, selectedTestIds: [NaN] })).toThrow('valid identifiers');
          expect(() => validate(actor, { ...baseDraft, isPackageUsed: true })).toThrow('valid package');
          expect(() => validate(actor, { ...baseDraft, isAdjustment: 1 })).toThrow('adjustments cannot be suspended');
     });

     it.each([0, 5, 7, NaN])('rejects invalid billing source %s', billingSource => {
          expect(() => validate(actor, { ...baseDraft, billingSource })).toThrow('valid billing source');
     });
});

describe('SuspendedBillingService persistence and finalization', () => {
     const insert = vi.fn();
     const update = vi.fn();
     const where = vi.fn();
     const first = vi.fn();
     const billFirst = vi.fn();
     const query = { insert, update, where, first };
     const connection = Object.assign(vi.fn((table: string) => table === 'billing'
          ? { where: vi.fn().mockReturnValue({ first: billFirst }) }
          : query), {
          transaction: vi.fn(async callback => callback(connection)),
     });
     beforeEach(() => {
          vi.clearAllMocks();
          where.mockReturnValue(query);
          insert.mockResolvedValue([7]);
          update.mockResolvedValue(1);
          vi.mocked(KnexConnection).mockResolvedValue(connection as unknown as Awaited<ReturnType<typeof KnexConnection>>);
     });
     it.each([false, true])('saves canonical sale/quote fields separately from billing records (quote=%s)', async isPricingQuote => {
          const draft = { ...baseDraft, patientid: isPricingQuote ? null : 101, isPricingQuote, notes: 'Return later' };
          expect(await new SuspendedBillingService(3).suspend(actor, draft)).toEqual({ id: 7, status: 'suspended' });
          const row = insert.mock.calls[0][0];
          expect(row.billing_source).toBe(1);
          expect(row.branchid).toBe(4);
          expect(JSON.parse(row.draft_data)).toEqual(draft);
          expect(connection.mock.calls.map(([table]) => table)).toEqual(['suspended_billing_transactions']);
     });
     it('updates the resumed draft in the actor branch instead of inserting a new draft', async () => {
          await new SuspendedBillingService(3).suspend(actor, baseDraft, 7);
          expect(where).toHaveBeenCalledWith({ id: 7, branchid: 4, status: 'suspended' });
          expect(update).toHaveBeenCalledOnce();
          expect(insert).not.toHaveBeenCalled();
     });
     it('loads the serialized draft only within the actor branch', async () => {
          first.mockResolvedValue({ id: 7, draft_data: JSON.stringify(baseDraft) });
          const loaded = await new SuspendedBillingService(3).get(actor, 7);
          expect(where).toHaveBeenCalledWith({ id: 7, branchid: 4, status: 'suspended' });
          expect(loaded.draft_data).toEqual(baseDraft);
     });
     it('finalizes a patientless quote only after a matching branch sale exists', async () => {
          first.mockResolvedValue({ id: 7, branchid: 4, status: 'suspended', patientid: null, draft_data: JSON.stringify({ ...baseDraft, patientid: null, isPricingQuote: true }) });
          billFirst.mockResolvedValue({ billingid: 555, patientid: 101, branchid: 4 });
          await new SuspendedBillingService(3).finalize(actor, 7, 555);
          expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'finalized', patientid: 101, finalized_billingid: 555 }));
          expect(insert).not.toHaveBeenCalled();
     });
     it.each([
          { patientid: 102, branchid: 4 },
          { patientid: 101, branchid: 5 },
          null,
     ])('rejects mismatching or missing final sales %j', async bill => {
          first.mockResolvedValue({ id: 7, branchid: 4, status: 'suspended', patientid: 101, draft_data: JSON.stringify(baseDraft) });
          billFirst.mockResolvedValue(bill);
          await expect(new SuspendedBillingService(3).finalize(actor, 7, 555)).rejects.toThrow('does not match');
          expect(update).not.toHaveBeenCalled();
     });
     it('allows same-sale finalize retries but rejects other branches even for finalized records', async () => {
          first.mockResolvedValue({ id: 7, branchid: 4, status: 'finalized', finalized_billingid: 555 });
          await expect(new SuspendedBillingService(3).finalize(actor, 7, 555)).resolves.toBeUndefined();
          expect(update).not.toHaveBeenCalled();
          await expect(new SuspendedBillingService(3).finalize({ ...actor, branch: 5 }, 7, 555)).rejects.toThrow('your branch');
     });
});
