import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { refundPost, paymentPost } = vi.hoisted(() => ({ refundPost: vi.fn(), paymentPost: vi.fn() }));
vi.mock('../../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../../../accountingModule/integrations/BillingAccounting', () => ({ enqueueBillingRefund: refundPost, enqueueBillingPayment: paymentPost }));
vi.mock('../WriteOff', () => ({ WriteOff: class {} }));
import { TransactionManagementService } from './TransactionManagementService';
import { billingIntegrityDatabase } from '../../../testSupport/billingIntegrityDatabase';
let db: any, service: TransactionManagementService;
const correction = (extra: any = {}) => ({ KeyID: 1, PaymentMode: 2, Amount: 110, employeeid: 8,
    reason: 'Correct tender classification', request_key: 'receipt-correction-0001', ...extra });
beforeEach(async () => {
    vi.clearAllMocks(); ({ db } = await billingIntegrityDatabase(1));
    await db('billinghx').insert({ KeyID: 1, billingid: 1, paymentmode: 1, amount: 110, type: 'credit', employeeid: 8 });
    service = new TransactionManagementService({ startTransaction: () => db.transaction() } as any, 1);
});
afterEach(async () => { await db.destroy(); });
describe('immutable linked receipt corrections', () => {
    it('preserves original receipt, cash total and header while adding linked reversal/replacement', async () => {
        const original = await db('billinghx').where({ KeyID: 1 }).first();
        await service.updatePaymentHistory(correction());
        expect(await db('billinghx').where({ KeyID: 1 }).first()).toEqual(original);
        expect(await db('billinghx')).toHaveLength(3);
        expect(await db('billing').first()).toMatchObject({ paid: 110, payable: 110 });
        expect(await db('billing_receipt_corrections').first()).toMatchObject({ original_history_id: 1, reversal_history_id: 2, replacement_history_id: 3 });
        expect(refundPost).toHaveBeenCalledOnce(); expect(paymentPost).toHaveBeenCalledOnce();
    });
    it('serializes concurrent keyed retries and rejects a different payload', async () => {
        await Promise.all([service.updatePaymentHistory(correction()), service.updatePaymentHistory(correction())]);
        expect(await db('billinghx')).toHaveLength(3);
        await expect(service.updatePaymentHistory(correction({ PaymentMode: 1 }))).rejects.toThrow('different');
    });
    it.each([{ Amount: 10 }, { Date: '2026-11-07' }, { reason: '' }])('rejects silent historical amount/date/reason changes %j', async changes => {
        await expect(service.updatePaymentHistory(correction(changes))).rejects.toThrow();
        expect(await db('billinghx')).toHaveLength(1);
    });
    it('rejects closed source receipts even if a newer date is supplied', async () => {
        await db('financial_day_closures').insert({ branchid: 2, financial_date: '2026-10-01', status: 'finalized' });
        await expect(service.updatePaymentHistory(correction({ Date: '2026-11-07' }))).rejects.toThrow('immutable');
        expect(await db('billinghx')).toHaveLength(1);
    });
    it('rolls back both correction receipts and permits retry when posting enqueue fails', async () => {
        paymentPost.mockRejectedValueOnce(new Error('Synthetic enqueue failure'));
        await expect(service.updatePaymentHistory(correction())).rejects.toThrow('Synthetic');
        expect(await db('billinghx')).toHaveLength(1); expect(await db('billing_receipt_corrections')).toHaveLength(0);
        await service.updatePaymentHistory(correction()); expect(await db('billinghx')).toHaveLength(3);
    });
    it('rejects direct financial header and service edits rather than overwriting history', async () => {
        await expect(service.editTransaction({ billingid: 1, updates: { paid: 1 } } as any, [])).rejects.toThrow('Direct financial');
        expect(await db('billing').first()).toMatchObject({ paid: 110 });
    });
    it('blocks metadata and service-price edits of a CLOSED source sale', async () => {
        await db('billing').update({ record_validated_and_signed_off: 1 });
        await expect(service.editTransaction({ billingid: 1, updates: { additionalinformation: 'New date attempt' } } as any, [])).rejects.toThrow('immutable');
        await expect(service.editTransaction({ billingid: 1, updates: {} } as any, [{ serviceid: 1, updates: { totalpayable: 1 } }] as any)).rejects.toThrow('immutable');
        expect(await db('dboservices').first()).toMatchObject({ totalpayable: 110 });
    });
});
