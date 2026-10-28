import { AccountingError } from '../errors/AccountingErrors';

/** Validate persisted currency at its two-decimal boundary; tolerate only binary float noise. */
export function minorUnits(value: unknown): number {
  if (value === null || value === '' || typeof value === 'boolean' || !['number', 'string'].includes(typeof value)) throw new AccountingError('Invalid monetary amount', 'INVALID_AMOUNT', 400);
  if (typeof value === 'string' && !/^[+-]?\d+(?:\.\d{1,2})?$/.test(value.trim())) throw new AccountingError('Invalid monetary amount', 'INVALID_AMOUNT', 400);
  const amount = Number(value), scaled = amount * 100, cents = Math.round(scaled);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(cents) || Math.abs(scaled - cents) > 0.00001 || Math.abs(cents) > 99999999999999) throw new AccountingError('Amounts must be finite and have at most two decimal places', 'INVALID_AMOUNT', 400);
  return cents;
}
export function sumMinor(values: unknown[]): number {
  const total = values.reduce<number>((sum, value) => sum + minorUnits(value), 0);
  if (!Number.isSafeInteger(total)) throw new AccountingError('Monetary total is too large', 'INVALID_AMOUNT', 400);
  return total;
}
/** Whole-pesewa allocation, with deterministic ties and an exact sum. */
export function allocateMinor(total: number, weights: number[]): number[] {
  if (!Number.isSafeInteger(total) || weights.some(n => !Number.isSafeInteger(n) || n < 0)) throw new AccountingError('Invalid allocation', 'INVALID_AMOUNT', 400);
  const denominator = weights.reduce((a, b) => a + BigInt(b), BigInt(0));
  if (!denominator) {
    if (total) throw new AccountingError('Cash flow has no counterpart', 'UNRECONCILED_CASH_FLOW', 409);
    return weights.map(() => 0);
  }
  const sign = Math.sign(total), magnitude = BigInt(Math.abs(total));
  const shares = weights.map((weight, index) => ({ index, amount: Number(magnitude * BigInt(weight) / denominator), remainder: magnitude * BigInt(weight) % denominator }));
  let left = Math.abs(total) - shares.reduce((sum, share) => sum + share.amount, 0);
  for (const share of [...shares].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1)) { if (left-- <= 0) break; share.amount++; }
  return shares.map(share => sign * share.amount);
}
