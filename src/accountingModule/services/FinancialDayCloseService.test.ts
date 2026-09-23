import { describe, expect, it, vi } from 'vitest';

vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));

import { canTransitionFinancialDay } from './FinancialDayCloseService';

describe('financial day close transitions', () => {
     it('allows the three authorization levels in order', () => {
          expect(canTransitionFinancialDay('draft', 'accountant_submitted')).toBe(true);
          expect(canTransitionFinancialDay('accountant_submitted', 'manager_approved')).toBe(true);
          expect(canTransitionFinancialDay('manager_approved', 'finalized')).toBe(true);
     });

     it('allows a manager return followed by accountant resubmission', () => {
          expect(canTransitionFinancialDay('accountant_submitted', 'returned_to_accountant')).toBe(true);
          expect(canTransitionFinancialDay('returned_to_accountant', 'accountant_submitted')).toBe(true);
     });

     it('does not permit skipped levels or regression', () => {
          expect(canTransitionFinancialDay('draft', 'manager_approved')).toBe(false);
          expect(canTransitionFinancialDay('accountant_submitted', 'finalized')).toBe(false);
          expect(canTransitionFinancialDay('manager_approved', 'accountant_submitted')).toBe(false);
     });

     it('keeps finalized days terminal', () => {
          expect(canTransitionFinancialDay('finalized', 'draft')).toBe(false);
          expect(canTransitionFinancialDay('finalized', 'accountant_submitted')).toBe(false);
          expect(canTransitionFinancialDay('finalized', 'manager_approved')).toBe(false);
     });
});
