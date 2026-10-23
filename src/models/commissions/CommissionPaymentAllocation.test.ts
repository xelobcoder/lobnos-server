import { describe, expect, it } from 'vitest';
import { allocateCommissionPayment } from './CommissionPaymentAllocation';

describe('commission payment allocation', () => {
     it('bounds unequal service allocations and reconciles payment and waiver totals', () => {
          expect(allocateCommissionPayment([5, 95], 100, 50).services).toEqual([
               { due: 5, allocated: 2.5, waived: 0 }, { due: 95, allocated: 47.5, waived: 0 },
          ]);
     });
     it('distributes rounding remainders without losing cents', () => {
          const result = allocateCommissionPayment(['0.01', '0.01', '0.01'], 0.03, 0.02);
          expect(result.services.map(row => row.allocated)).toEqual([0.01, 0.01, 0]);
          expect(result.waived).toBe(0);
          expect(result.outstanding).toBe(0.01);
     });
     it('supports full waivers and zero-value settlements', () => {
          expect(allocateCommissionPayment([10, 0], 10, 0, 10).services.map(row => row.waived)).toEqual([10, 0]);
          expect(allocateCommissionPayment([0], 0, 0).services[0]).toEqual({ due: 0, allocated: 0, waived: 0 });
     });
     it('retains a partial balance unless a waiver is explicitly specified', () => {
          expect(allocateCommissionPayment([100], 100, 70)).toMatchObject({ paid: 70, waived: 0, outstanding: 30 });
          expect(allocateCommissionPayment([100], 100, 70, 30)).toMatchObject({ paid: 70, waived: 30, outstanding: 0 });
          expect(() => allocateCommissionPayment([100], 100, 70, 31)).toThrow('cannot exceed');
     });
     it.each([-1, Infinity, NaN, 1.001, null, '', true])('rejects invalid payment %s', payment => {
          expect(() => allocateCommissionPayment([10], 10, payment)).toThrow();
     });
     it('rejects overpayments and stale submitted totals', () => {
          expect(() => allocateCommissionPayment([60], 100, 60)).toThrow('does not match');
          expect(() => allocateCommissionPayment([60], 60, 61)).toThrow('cannot exceed');
     });
});
