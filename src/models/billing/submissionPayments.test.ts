import { describe, it, expect } from 'vitest';
import { normalizeSubmissionPayments } from './submissionPayments';

describe('billing receipt normalization', () => {
    it('keeps partial cash receipts and split payments', () => {
        const result = normalizeSubmissionPayments({ amountPayable: 100, paid: 30, payments: [{ mode: 1, amount: 10 }, { mode: 2, amount: 20 }] });
        expect(result.paid).toBe(30);
        expect(result.paymentDetails.amount).toBe(30);
        expect(result.payments).toHaveLength(2);
    });
    it('never books staff FOC coverage as cash', () => {
        const result = normalizeSubmissionPayments({ paid: 80, payments: [{ mode: 'foc', amount: 80 }], paymentDetails: { mode: 'foc', focStaffId: 7, amount: 80 } });
        expect(result.paid).toBe(0);
        expect(result.paymentDetails.amount).toBe(0);
        expect(result.paymentDetails.focStaffId).toBe(7);
        expect(result.payments).toEqual([]);
    });
    it('retains free-mode intent without inserting a zero cash receipt', () => {
        const result = normalizeSubmissionPayments({ paid: 0, payments: [{ mode: 'free', amount: 0 }] });
        expect(result.paymentDetails.mode).toBe('free');
        expect(result.payments).toEqual([]);
    });
    it('allows an NHIS claim with no cash receipt', () => {
        expect(normalizeSubmissionPayments({ billingSource: 4, paid: 0, payments: [{ mode: 9, amount: 0 }] }).payments).toEqual([]);
    });
    it('rejects invalid cash and mismatched paid totals', () => {
        expect(() => normalizeSubmissionPayments({ paid: 0, payments: [{ mode: 1, amount: -1 }] })).toThrow();
        expect(() => normalizeSubmissionPayments({ paid: 50, payments: [{ mode: 1, amount: 20 }] })).toThrow();
        expect(() => normalizeSubmissionPayments({ paid: 0, paymentDetails: { mode: 'foc' } })).toThrow();
    });
});
