import { describe, expect, it, vi } from 'vitest';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
import { syncCommissionExpenseSettlement } from './CommissionExpenseSettlement';
function fixture(paid: number) { return transactionalDatabase({
     expensesrecord: [{ id: 5 }],
     commission_batch_payments: [{ id: 8, expense_id: 5, total_commission_amount: 100, waived_amount: 0, notes: JSON.stringify({ workflow: 'controlled_expense' }) }],
     commission_batch_payment_services: [{ id: 9, batch_payment_id: 8, serviceid: 1, commission_due: 100, amount_allocated: 0, waived_amount: 0 }],
     commission_tracking: [{ id: 10, service_id: 1, status: 'approved' }],
     expense_payments: [{ id: 11, expense_id: 5, status: 'Paid', amount: paid, is_reversed: false }],
}); }
describe('controlled commission expense settlement', () => {
     it('retains the unpaid balance after a partial authorized expense payment', async () => {
          const store = fixture(70);
          await store.db.transaction((trx: any) => syncCommissionExpenseSettlement(trx, 5));
          expect(store.rows('commission_batch_payments')[0]).toMatchObject({ payment_amount: 70, waived_amount: 0, status: 'pending' });
          expect(store.rows('commission_batch_payment_services')[0]).toMatchObject({ amount_allocated: 70, waived_amount: 0, status: 'partial' });
          expect(store.rows('commission_tracking')[0].status).toBe('approved');
     });
     it('marks the commission paid only when actual payments cover the obligation', async () => {
          const store = fixture(100);
          await store.db.transaction((trx: any) => syncCommissionExpenseSettlement(trx, 5));
          expect(store.rows('commission_batch_payments')[0].status).toBe('completed');
          expect(store.rows('commission_tracking')[0].status).toBe('paid');
     });
     it('reopens the balance after reversal while retaining batch and allocation history', async () => {
          const store = fixture(70);
          await store.db.transaction(async (trx: any) => { await trx('expensesrecord').where({ id: 5 }).forUpdate().first(); await trx('expense_payments').where({ id: 11 }).update({ is_reversed: true }); await syncCommissionExpenseSettlement(trx, 5); });
          expect(store.rows('commission_batch_payments')[0]).toMatchObject({ payment_amount: 0, status: 'pending' });
          expect(store.rows('commission_batch_payment_services')[0]).toMatchObject({ amount_allocated: 0, waived_amount: 0 });
          expect(store.rows('commission_tracking')[0].status).toBe('approved');
     });
});
