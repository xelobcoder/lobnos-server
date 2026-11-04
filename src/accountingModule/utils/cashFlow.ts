import { minorUnits } from './money';
import { AccountingError } from '../errors/AccountingErrors';

export const cashFlowCategories = ['operating', 'investing', 'financing'] as const;
export type CashFlowCategory = typeof cashFlowCategories[number];
export interface CashFlowAllocation { category: CashFlowCategory; inflow: number; outflow: number }
export interface CashFlowReviewInput {
     operating?: number; investing?: number; financing?: number;
     allocations?: CashFlowAllocation[];
}
/** Gross amounts observed on journal cash lines, expressed in integer minor units. */
export interface CashFlowEvidence { inflowMinor: number; outflowMinor: number }

/** Explicit gross allocations can represent receipts and payments in the same category. */
export function cashFlowReview(input: CashFlowReviewInput, netMinor: number, evidence: CashFlowEvidence) {
     const invalid = () => { throw new AccountingError('Reviewed cash-flow allocations must be nonnegative gross amounts whose net must exactly equal the journal cash movement', 'INVALID_CASH_FLOW_CLASSIFICATION', 400); };
     let allocations: CashFlowAllocation[];
     try {
          allocations = input.allocations === undefined
               ? cashFlowCategories.map(category => {
                    const amount = minorUnits(input[category] ?? 0);
                    return { category, inflow: Math.max(0, amount) / 100, outflow: Math.max(0, -amount) / 100 };
               })
               : input.allocations;
          if (!Array.isArray(allocations) || !allocations.length || allocations.length > 100) return invalid();
          allocations = allocations.map(row => {
               if (!row || !cashFlowCategories.includes(row.category)) return invalid();
               const inflow = minorUnits(row.inflow), outflow = minorUnits(row.outflow);
               if (inflow < 0 || outflow < 0) return invalid();
               return { category: row.category, inflow: inflow / 100, outflow: outflow / 100 };
          });
     } catch { return invalid(); }
     if (!allocations.some(row => row.inflow || row.outflow)) return invalid();
     const totals = { operating: 0, investing: 0, financing: 0 };
     let gross = 0, inflowMinor = 0, outflowMinor = 0;
     for (const row of allocations) {
          totals[row.category] += minorUnits(row.inflow) - minorUnits(row.outflow);
          inflowMinor += minorUnits(row.inflow);
          outflowMinor += minorUnits(row.outflow);
          gross += minorUnits(row.inflow) + minorUnits(row.outflow);
          if (!Number.isSafeInteger(gross) || !Number.isSafeInteger(totals[row.category]) || Math.abs(totals[row.category]) > 99999999999999) return invalid();
     }
     if (Object.values(totals).reduce((a, b) => a + b, 0) !== netMinor) return invalid();
     if (!evidence || !Number.isSafeInteger(evidence.inflowMinor) || !Number.isSafeInteger(evidence.outflowMinor) ||
          evidence.inflowMinor < 0 || evidence.outflowMinor < 0 || evidence.inflowMinor - evidence.outflowMinor !== netMinor) return invalid();
     if (inflowMinor > evidence.inflowMinor || outflowMinor > evidence.outflowMinor) {
          throw new AccountingError('Reviewed inflows/outflows cannot exceed the journal cash debit/credit evidence', 'CASH_FLOW_GROSS_EXCEEDS_EVIDENCE', 400);
     }
     for (const category of cashFlowCategories) {
          if (input[category] !== undefined && minorUnits(input[category]!) !== totals[category]) return invalid();
     }
     return { allocations, operating: totals.operating / 100, investing: totals.investing / 100, financing: totals.financing / 100 };
}

export function readCashFlowReview(row: any, netMinor: number, evidence: CashFlowEvidence): CashFlowAllocation[] | null {
     if (!row) return null;
     try {
          return cashFlowReview({ operating: row.operating, investing: row.investing, financing: row.financing,
               ...(row.gross_allocations ? { allocations: typeof row.gross_allocations === 'string' ? JSON.parse(row.gross_allocations) : row.gross_allocations } : {}) }, netMinor, evidence).allocations;
     } catch { return null; }
}
