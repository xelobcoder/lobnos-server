import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../services/AccountingOutboxService', () => ({ enqueuePosting: vi.fn() }));
vi.mock('../services/SubledgerService', () => ({ recordSubledgerEntry: vi.fn() }));
import { enqueuePosting } from '../services/AccountingOutboxService';
import { enqueueSupplierPayment } from './SupplierAccounting';

function database(payment: any) {
     const query: any = { select: () => query, where: () => query, first: async () => payment };
     return () => query;
}
const payment = { id: 'SP-1', payment_amount: 250, payment_method: 'bank_transfer', payment_status: 'completed',
     payment_account_id: 5, payment_account_gl_code: 'acc-bank-2', branchid: 4, approved_by: '22', payment_date: '2026-10-23' };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(enqueuePosting).mockResolvedValue(undefined); });
describe('supplier payment journal', () => {
     it('credits the selected source ledger account and debits payable without creating another expense', async () => {
          await enqueueSupplierPayment(1, 'SP-1', database(payment));
          expect(enqueuePosting).toHaveBeenCalledWith(1, expect.objectContaining({
               lines: [
                    { accountCode: 'acc-2000', direction: 'debit', amount: 250, branchid: 4 },
                    { accountCode: 'acc-bank-2', direction: 'credit', amount: 250, branchid: 4 },
               ],
          }), expect.any(Function));
     });
     it('does not post pending payments', async () => {
          await enqueueSupplierPayment(1, 'SP-1', database({ ...payment, payment_status: 'pending' }));
          expect(enqueuePosting).not.toHaveBeenCalled();
     });
     it('rejects a selected account without its ledger snapshot', async () => {
          await expect(enqueueSupplierPayment(1, 'SP-1', database({ ...payment, payment_account_gl_code: null }))).rejects.toThrow('ledger account');
     });
     it('preserves legacy cash posting when a historical payment has no account selection', async () => {
          await enqueueSupplierPayment(1, 'SP-1', database({ ...payment, payment_account_id: null, payment_account_gl_code: null, payment_method: 'cash' }));
          expect(vi.mocked(enqueuePosting).mock.calls[0][1].lines[1].accountCode).toBe('acc-1000');
     });
});
