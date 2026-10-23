import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';

vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('./CommissionPaymentExpenseSync', () => ({ default: { markCommissionPaymentAsExpense: vi.fn() } }));
vi.mock('../../accountingModule/services/AuthorityService', () => ({ AuthorityService: class { can = vi.fn().mockResolvedValue({ allowed: true }); } }));
import KnexConnection from '../../database/KnexConnections';
import ExpenseSync from './CommissionPaymentExpenseSync';
import { CommissionBatchPaymentsRepo } from './CommissionBatchPaymentsRepo';

const data = (): any => ({ startDate: new Date('2026-10-01'), endDate: new Date('2026-10-31'), commissionDue: 60, amountPaid: 60,
     services: [1], recipientId: 7, recipientType: 'clinician', employeeid: 1, branchid: 1, paymentMethod: 'cash', actor: { employeeid: 1, tenantId: 1, branch: 1, role: 'admin' } });
function setup() {
     const store = transactionalDatabase({
          dboservices: [{ serviceid: 1, billingid: 4, serviceAddedOn: '2026-10-15' }], billing: [{ billingid: 4, branchid: 1 }], commission_tracking: [{ id: 10, service_id: 1, recipient_type: 'clinician', recipient_id: 7,
               commission_due: 100, final_commission: '60.00', status: 'approved' }],
     });
     vi.mocked(KnexConnection).mockResolvedValue(store.db);
     return { store, repo: new CommissionBatchPaymentsRepo(1) };
}
beforeEach(() => {
     vi.clearAllMocks();
     vi.mocked(ExpenseSync.markCommissionPaymentAsExpense).mockResolvedValue({ success: true, expense_id: 3, invoice_id: 4, expense_payment_id: 5 } as any);
});

describe('commission settlement integrity', () => {
     it('reserves a capped commission and creates a request without falsely marking it paid', async () => {
          const { store, repo } = setup();
          await repo.createBatchPaymentWithServices(data());
          expect(store.rows('commission_batch_payment_services')[0]).toMatchObject({ commission_due: 60, amount_allocated: 0, waived_amount: 0 });
          expect(store.rows('commission_tracking')[0].status).toBe('approved');
          expect(store.rows('commission_batch_payments')[0]).toMatchObject({ payment_amount: 0, status: 'pending' });
          expect(store.events[0]).toBe('lock:dboservices');
          expect(store.events[store.events.length - 1]).toBe('commit');
     });
     it('rejects stale totals and payments above the final commission', async () => {
          const { store, repo } = setup();
          await expect(repo.createBatchPaymentWithServices({ ...data(), commissionDue: 100 })).rejects.toThrow('does not match');
          await expect(repo.createBatchPaymentWithServices({ ...data(), amountPaid: 61 })).rejects.toThrow('cannot exceed');
          expect(store.rows('commission_batch_payments')).toEqual([]);
     });
     it('rejects a recipient mismatch and duplicate service IDs', async () => {
          const { store, repo } = setup();
          await expect(repo.createBatchPaymentWithServices({ ...data(), recipientId: 8 })).rejects.toThrow('recipient');
          await expect(repo.createBatchPaymentWithServices({ ...data(), services: [1, 1] })).rejects.toThrow('unique');
          expect(store.rows('commission_batch_payments')).toEqual([]);
     });
     it('allows only one simultaneous batch for the same service', async () => {
          const { store, repo } = setup();
          const results = await Promise.allSettled([repo.createBatchPaymentWithServices(data()), repo.createBatchPaymentWithServices(data())]);
          expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
          expect(store.rows('commission_batch_payments')).toHaveLength(1);
          expect(ExpenseSync.markCommissionPaymentAsExpense).toHaveBeenCalledTimes(1);
     });
     it('rolls back the batch and allocation if expense sync fails', async () => {
          const { store, repo } = setup();
          vi.mocked(ExpenseSync.markCommissionPaymentAsExpense).mockResolvedValue({ success: false, message: 'failed' } as any);
          await expect(repo.createBatchPaymentWithServices(data())).rejects.toThrow('failed');
          expect(store.rows('commission_batch_payments')).toEqual([]);
          expect(store.rows('commission_batch_payment_services')).toEqual([]);
          expect(store.rows('commission_tracking')[0].status).toBe('approved');
          expect(store.events[store.events.length - 1]).toBe('rollback');
     });
     it('records a full waiver without creating a zero-value expense', async () => {
          const { store, repo } = setup();
          await repo.createBatchPaymentWithServices({ ...data(), amountPaid: 0, settlementMode: 'waiver', waiverReason: 'Administrator-approved write-off' });
          expect(store.rows('commission_batch_payment_services')[0]).toMatchObject({ amount_allocated: 0, waived_amount: 60, status: 'waived' });
          expect(ExpenseSync.markCommissionPaymentAsExpense).not.toHaveBeenCalled();
     });
     it('rejects unsigned actors, silent zero payments and waivers without a reason', async () => {
          const { repo } = setup();
          await expect(repo.createBatchPaymentWithServices({ ...data(), actor: undefined })).rejects.toThrow('Authenticated');
          await expect(repo.createBatchPaymentWithServices({ ...data(), amountPaid: 0 })).rejects.toThrow('positive');
          await expect(repo.createBatchPaymentWithServices({ ...data(), amountPaid: 0, settlementMode: 'waiver' })).rejects.toThrow('reason');
     });
     it('rejects a service outside the requested period or operating branch', async () => {
          const { repo } = setup();
          await expect(repo.createBatchPaymentWithServices({ ...data(), startDate: new Date('2026-10-16') })).rejects.toThrow('date range');
          await expect(repo.createBatchPaymentWithServices({ ...data(), branchid: 2, actor: { ...data().actor, branch: 2 } })).rejects.toThrow('branch');
     });
});
