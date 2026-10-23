import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
const authority = vi.hoisted(() => ({ can: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../../accountingModule/integrations/SupplierAccounting', () => ({ enqueueSupplierPayment: vi.fn() }));
vi.mock('../../accountingModule/services/AuthorityService', () => ({ AuthorityService: class { can = authority.can; } }));
import KnexConnection from '../../database/KnexConnections';
import { enqueueSupplierPayment } from '../../accountingModule/integrations/SupplierAccounting';
import { SupplierPaymentModel } from './SupplierPayment';

const actor: any = { employeeid: 22, branch: 4, tenantId: 1, role: 'accountant' };
function setup(options: { account?: any; access?: boolean; payment?: any; ledger?: boolean } = {}) {
     const store = transactionalDatabase({
          inv_supplier_payments: [{ id: 'SP-1', payment_amount: 250, payment_status: 'pending', payment_account_id: 5,
               payment_method: 'bank_transfer', branchid: 4, ...options.payment }],
          payment_accounts: [{ id: 5, name: 'Main Bank', is_active: true, account_type: 'bank', currency: 'GHS', branchid: 4, gl_account_code: 'acc-bank-2', ...options.account }],
          payment_account_users: options.access === false ? [] : [{ payment_account_id: 5, employeeid: 22, can_pay: true, is_active: true }],
          acc_accounts: options.ledger === false ? [] : [{ account_code: 'acc-bank-2', type: 'asset', is_active: true }],
     });
     vi.mocked(KnexConnection).mockResolvedValue(store.db);
     const model = new SupplierPaymentModel(1);
     vi.spyOn(model, 'findById').mockImplementation(async id => store.rows('inv_supplier_payments').find(payment => payment.id === id));
     return { model, store };
}
beforeEach(() => {
     vi.clearAllMocks();
     authority.can.mockResolvedValue({ allowed: true });
     vi.mocked(enqueueSupplierPayment).mockResolvedValue(undefined);
});

describe('supplier payment funding', () => {
     it('records the selected source and authenticated payer, checking authority against the stored amount', async () => {
          const { model, store } = setup();
          await model.approve('SP-1', actor);
          expect(store.rows('inv_supplier_payments')[0]).toMatchObject({
               payment_status: 'completed', payment_account_id: 5, payment_account_gl_code: 'acc-bank-2', approved_by: '22', branchid: 4,
          });
          expect(authority.can).toHaveBeenCalledWith(22, 'purchase_order.pay', 250, 4);
          expect(enqueueSupplierPayment).toHaveBeenCalledWith(1, 'SP-1', expect.any(Function));
     });
     it('requires a source for legacy pending payments', async () => {
          const { model } = setup({ payment: { payment_account_id: null } });
          await expect(model.approve('SP-1', actor)).rejects.toThrow('Select a payment source');
          await expect(model.approve('SP-1', actor, { payment_account_id: 5 })).resolves.toMatchObject({ payment_status: 'completed' });
     });
     it.each([
          [{ access: false }, 'not authorized'],
          [{ account: { is_active: false } }, 'inactive'],
          [{ account: { branchid: 9 } }, 'another branch'],
          [{ account: { currency: 'USD' } }, 'GHS'],
          [{ account: { account_type: 'cash' } }, 'method'],
          [{ ledger: false }, 'ledger account'],
     ] as const)('rejects invalid funding: %s', async (options, message) => {
          const { model, store } = setup(options);
          await expect(model.approve('SP-1', actor)).rejects.toThrow(message);
          expect(store.rows('inv_supplier_payments')[0].payment_status).toBe('pending');
          expect(enqueueSupplierPayment).not.toHaveBeenCalled();
     });
     it('rolls back completion if the accounting outbox cannot be written', async () => {
          const { model, store } = setup();
          vi.mocked(enqueueSupplierPayment).mockRejectedValue(new Error('Outbox unavailable'));
          await expect(model.approve('SP-1', actor)).rejects.toThrow('Outbox unavailable');
          expect(store.rows('inv_supplier_payments')[0]).toMatchObject({ payment_status: 'pending' });
          expect(store.rows('inv_supplier_payments')[0].payment_account_gl_code).toBeUndefined();
     });
     it('does not post twice when two approval requests compete', async () => {
          const { model } = setup();
          await Promise.all([model.approve('SP-1', actor), model.approve('SP-1', actor)]);
          expect(enqueueSupplierPayment).toHaveBeenCalledTimes(1);
     });
     it('blocks completion through the generic update endpoint', async () => {
          const { model } = setup();
          await expect(model.update('SP-1', { payment_status: 'completed' }, actor)).rejects.toThrow('approval workflow');
          expect(enqueueSupplierPayment).not.toHaveBeenCalled();
     });
     it('checks the authority ceiling before completing a payment', async () => {
          const { model, store } = setup();
          authority.can.mockResolvedValue({ allowed: false, reason: 'Amount exceeds delegated ceiling' });
          await expect(model.approve('SP-1', actor)).rejects.toThrow('ceiling');
          expect(store.rows('inv_supplier_payments')[0].payment_status).toBe('pending');
     });
});
