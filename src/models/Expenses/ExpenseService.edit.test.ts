import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../../accountingModule/services/FinancialFinalizationGuard', () => ({ FinancialFinalizationGuard: class { assertRecordMutable = vi.fn(); assertDateOpen = vi.fn(); } }));
import KnexConnection from '../../database/KnexConnections';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
import Expenses from './ExpenseService';
const draft: any = { name: 'Corrected electricity bill', amount: 125, merchant: 3, category: 2, date: '2026-10-23', description: 'October utilities' };
const initial = { id: 10, employeeid: 7, branchid: 4, amount: 100, approved: 2, workflow_status: 'rejected', workflow_version: 2, date: '2026-10-20' };
beforeEach(() => vi.clearAllMocks());
describe('expense editing and resubmission', () => {
     it('uses the scoped expense ID and resubmits a rejected expense for approval', async () => {
          const store = transactionalDatabase({ expensesrecord: [initial] });
          vi.mocked(KnexConnection).mockResolvedValue(store.db);
          await expect(new Expenses(7, 4, 1, 10).updateExpenseRecord(draft)).resolves.toBe(true);
          expect(store.rows('expensesrecord')[0]).toMatchObject({ id: 10, amount: 125, approved: 0, workflow_status: 'pending_approval', workflow_version: 3, submitted_by: 7 });
          expect(store.rows('expense_approval_actions')[0]).toMatchObject({ expense_id: 10, action: 'resubmitted', from_status: 'rejected', authority_source: 'submitter' });
     });
     it.each([{ employeeid: 8 }, { branchid: 9 }, { approved: 1, workflow_status: 'approved' }])('does not edit expenses outside ownership or editable states: %j', async (override) => {
          const store = transactionalDatabase({ expensesrecord: [{ ...initial, ...override }] });
          vi.mocked(KnexConnection).mockResolvedValue(store.db);
          expect(typeof await new Expenses(7, 4, 1, 10).updateExpenseRecord(draft)).toBe('string');
          expect(store.rows('expensesrecord')[0].amount).toBe(100);
          expect(store.rows('expense_approval_actions')).toHaveLength(0);
     });
});
