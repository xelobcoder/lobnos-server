import { describe, expect, it, vi } from 'vitest';

vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));

import { canTransitionFinancialDay, FinancialDayCloseService } from './FinancialDayCloseService';
import type { AuthUser } from '../../middleware/authority';

describe('financial day close transitions', () => {
     it('allows the three authorization levels in order', () => {
          expect(canTransitionFinancialDay('draft', 'accountant_submitted')).toBe(true);
          expect(canTransitionFinancialDay('accountant_submitted', 'manager_approved')).toBe(true);
          expect(canTransitionFinancialDay('manager_approved', 'finalized')).toBe(true);
     });

     describe('daily close separation of duties for administrators', () => {
          const actor: AuthUser = { employeeid: 8, role: 'admin', branch: 1, tenantId: 1, email: 'admin@example.test' };
          function serviceFor(status: string, preparer: number, reviewer: number | null = null) {
               const closure = { id: 7, branchid: 1, status, workflow_version: 1, accountant_employeeid: preparer, manager_employeeid: reviewer };
               const query = { where: vi.fn().mockReturnThis(), forUpdate: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue(closure) };
               const trx = vi.fn(() => query);
               return new FinancialDayCloseService(1, { transaction: (callback: (transaction: typeof trx) => unknown) => callback(trx) });
          }

          it.each(['approve', 'reject'] as const)('explains why an admin preparer cannot %s their own submission', async decision => {
               await expect(serviceFor('accountant_submitted', 8).managerDecision(actor, 7, { decision, pin: '1234', reason: 'Please resubmit', expectedVersion: 1 }))
                    .rejects.toMatchObject({ code: 'SEGREGATION_OF_DUTIES', message: expect.stringContaining('explicitly confirm an administrator override') });
          });

          it.each([[8, 9], [9, 8]])('prevents an admin involved in preparation or review from finalizing', async (preparer, reviewer) => {
               await expect(serviceFor('manager_approved', preparer, reviewer).finalize(actor, 7, { pin: '1234', expectedVersion: 1 }))
                    .rejects.toMatchObject({ code: 'SEGREGATION_OF_DUTIES', message: expect.stringContaining('explicitly confirm an administrator override') });
          });
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
