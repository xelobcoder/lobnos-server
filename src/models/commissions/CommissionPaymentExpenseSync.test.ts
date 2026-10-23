import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../Expenses/ExpenseInvoiceRepo', () => ({ default: class { createExpensesAndInvoice = mocks.create; } }));
import KnexConnection from '../../database/KnexConnections';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
import { CommissionPaymentExpenseSync } from './CommissionPaymentExpenseSync';
beforeEach(() => { vi.clearAllMocks(); mocks.create.mockResolvedValue({ expenseIds: [5], invoiceId: 6 }); });
describe('commission request to expense', () => {
     it('creates the full payable liability pending approval without automatic approval or payment', async () => {
          const store = transactionalDatabase({ commission_batch_payments: [{ id: 8, total_commission_amount: 100, payment_amount: 0, waived_amount: 0, recipient_type: 'clinician', recipient_id: 7, batch_reference: 'REQ-8', notes: JSON.stringify({ workflow: 'controlled_expense', requested_payment: 70 }) }], dboexpensecategory: [{ id: 2, category: 'commission_payments' }], expense_merchants: [{ id: 3, name: 'COMMISSION PAYMENTS' }], clinicianbasicinfo: [{ id: 7, name: 'Recipient' }] });
          vi.mocked(KnexConnection).mockResolvedValue(store.db);
          const result = await store.db.transaction((trx: any) => CommissionPaymentExpenseSync.markCommissionPaymentAsExpense(1, { batchPaymentId: 8, employeeid: 9, branchid: 4 }, trx));
          expect(result).toMatchObject({ success: true, requiresApproval: true, expense_id: 5, expense_payment_id: null });
          expect(mocks.create).toHaveBeenCalledWith([expect.objectContaining({ amount: 100, employeeid: 9, branchid: 4 })], expect.objectContaining({ total_amount: 100, status: 'Pending' }), expect.any(Function));
          expect(store.rows('expense_payments')).toHaveLength(0);
          expect(store.rows('commission_batch_payments')[0].expense_payment_id).toBeNull();
     });
});
