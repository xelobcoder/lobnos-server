import Decimal from 'decimal.js';

export class CommissionPaymentValidationError extends Error {
     readonly statusCode = 400;
}

function cents(value: unknown): number {
     try {
          if (value === null || value === undefined || value === '' || typeof value === 'boolean') throw new Error();
          const amount = new Decimal(value as Decimal.Value);
          const scaled = amount.mul(100);
          if (!amount.isFinite() || amount.isNegative() || !scaled.isInteger() || scaled.gt(Number.MAX_SAFE_INTEGER)) throw new Error();
          return scaled.toNumber();
     } catch {
          throw new CommissionPaymentValidationError('Commission amounts must be finite, nonnegative amounts with at most two decimal places');
     }
}

/** Allocate the actual payment proportionally; distribute remaining cents deterministically. */
export function allocateCommissionPayment(dues: unknown[], submittedTotal: unknown, payment: unknown, waiver: unknown = 0) {
     if (!dues.length) throw new CommissionPaymentValidationError('At least one payable service is required');
     const dueCents = dues.map(cents);
     const total = dueCents.reduce((sum, due) => sum + due, 0);
     if (!Number.isSafeInteger(total)) throw new CommissionPaymentValidationError('Commission total is too large');
     if (cents(submittedTotal) !== total) throw new CommissionPaymentValidationError('Commission total does not match the current payable service amounts. Refresh and try again.');
     const paid = cents(payment);
     const waived = cents(waiver);
     if (paid + waived > total) throw new CommissionPaymentValidationError('Payment and waiver cannot exceed the payable commission');
     const shares = dueCents.map((due, index) => {
          const exact = total ? new Decimal(due).mul(paid).div(total) : new Decimal(0);
          const allocated = exact.floor().toNumber();
          return { index, allocated, remainder: exact.minus(allocated) };
     });
     let remaining = paid - shares.reduce((sum, share) => sum + share.allocated, 0);
     for (const share of [...shares].sort((a, b) => b.remainder.comparedTo(a.remainder) || a.index - b.index)) {
          if (remaining <= 0) break;
          if (share.allocated < dueCents[share.index]) { share.allocated++; remaining--; }
     }
     const remainingDues = dueCents.map((due, index) => due - shares[index].allocated);
     const waiverShares = waived ? allocateCommissionPayment(remainingDues.map(value => value / 100), (total - paid) / 100, waived / 100).services : [];
     return {
          total: total / 100, paid: paid / 100, waived: waived / 100, outstanding: (total - paid - waived) / 100,
          services: shares.map(share => ({
               due: dueCents[share.index] / 100,
               allocated: share.allocated / 100,
               waived: waiverShares[share.index]?.allocated || 0,
          })),
     };
}
