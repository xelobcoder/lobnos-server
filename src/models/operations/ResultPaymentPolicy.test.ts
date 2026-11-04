import { describe, expect, it, vi } from 'vitest';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
import { allowsUnpaidResultAction, assertResultPaymentPolicy, canPerformResultAction, ResultPaymentAction } from './ResultPaymentPolicy';
import { captureReportRevision, assertReportRevision } from './ResultReleaseGuard';

vi.mock('./CriticalActionService', () => ({ assertCriticalRelease: vi.fn().mockResolvedValue(undefined) }));
const fields = { entry: 'allowResultEnteringUpaid', validation: 'allowValidationUpaid', print: 'allowPrintingUnpaid' };
const actions: ResultPaymentAction[] = ['entry', 'validation', 'print'];
function fixture(status: string, settings: any = {}, approval: any = {}) {
     return transactionalDatabase({
          applicationsettings: [settings],
          test_ascension: [{ id: 1, serviceid: 6, resultEntryEnd: new Date() }],
          dboservices: [{ serviceid: 6, paymentstatus: status }],
          dbotestresultapproval: [{ ascensionid: 1, approval_revision: 2, requires_revalidation: 0, isapproved: 1, ...approval }],
     });
}

describe.each(actions)('%s payment policy', action => {
     for (const status of ['paid', 'partial', 'pending', 'unpaid', ' PAID ', 'partail']) {
          it.each([0, 1])(`checks ${status} with its own setting %s`, async enabled => {
               const store = fixture(status, { allowResultEnteringUpaid: 1, allowValidationUpaid: 1, allowPrintingUnpaid: 1, [fields[action]]: enabled });
               const expected = enabled === 1 || status.trim().toLowerCase() === 'paid';
               expect(await store.db.transaction(trx => canPerformResultAction(trx, 1, action, true))).toBe(expected);
               if (!expected) await expect(store.db.transaction(trx => assertResultPaymentPolicy(trx, 1, action, true))).rejects.toMatchObject({ statusCode: 403 });
               expect(store.rows('dbotestresultapproval')[0].approval_revision).toBe(2);
          });
     }
     it.each([undefined, null, false, '0'])('defaults to denying unpaid access for setting %s', async value => {
          const store = fixture('pending', { [fields[action]]: value });
          expect(await store.db.transaction(trx => canPerformResultAction(trx, 1, action))).toBe(false);
     });
     it.each([1, '1', true])('accepts the persisted enabled setting %s', value => {
          expect(allowsUnpaidResultAction({ [fields[action]]: value }, action)).toBe(true);
     });
     it('does not use another tenant connection or another service payment', async () => {
          const unpaid = fixture('pending'), paid = fixture('paid');
          expect(await unpaid.db.transaction(trx => canPerformResultAction(trx, 1, action))).toBe(false);
          expect(await paid.db.transaction(trx => canPerformResultAction(trx, 1, action))).toBe(true);
     });
});

describe('final report checks', () => {
     it('requires final approval even when the result has not been amended', async () => {
          const store = fixture('paid', {}, { isapproved: 0, approvedBy: '7', minvalidation: 2 });
          await expect(store.db.transaction(trx => captureReportRevision(trx, 1))).rejects.toMatchObject({ statusCode: 409 });
     });
     it('retains valid historical minimum-validator approvals and configured initial bypass', async () => {
          const historical = fixture('paid', {}, { isapproved: 0, approvedBy: '7,8', minvalidation: 2 });
          expect(await historical.db.transaction(trx => captureReportRevision(trx, 1))).toBe(2);
          const bypass = fixture('paid', {}, { isapproved: 1, approvedBy: '7', minvalidation: 3 });
          expect(await bypass.db.transaction(trx => captureReportRevision(trx, 1))).toBe(2);
     });
     it('does not count duplicate validators toward the minimum', async () => {
          const store = fixture('paid', {}, { isapproved: 0, approvedBy: '7,7', minvalidation: 2 });
          await expect(store.db.transaction(trx => captureReportRevision(trx, 1))).rejects.toThrow('validation');
     });
     it('rechecks payment before returning a final printed report', async () => {
          const store = fixture('pending');
          await expect(store.db.transaction(trx => assertReportRevision(trx, 1, 2, 'print'))).rejects.toMatchObject({ statusCode: 403 });
     });
     it('keeps independent portal release policies separate from staff printing permission', async () => {
          const store = fixture('pending');
          await expect(store.db.transaction(trx => assertReportRevision(trx, 1, 2, 'release'))).resolves.toBeUndefined();
     });
     it('requires revalidation even with unpaid printing enabled', async () => {
          const store = fixture('pending', { allowPrintingUnpaid: 1 }, { requires_revalidation: 1 });
          await expect(store.db.transaction(trx => assertReportRevision(trx, 1, 2, 'print'))).rejects.toMatchObject({ statusCode: 409 });
     });
});
