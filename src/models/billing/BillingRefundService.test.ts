import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { post, adjustment } = vi.hoisted(() => ({ post: vi.fn(), adjustment: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../../accountingModule/integrations/BillingAccounting', () => ({ enqueueBillingRefund: post }));
vi.mock('../../database/appLevelTriggers', () => ({ applyDboservicesAfterUpdate: vi.fn() }));
vi.mock('../commissions/commission-configurations/repositories/CommissionTrackingRepository', () => ({
    CommissionTrackingRepository: class { async findByServiceId() { return [{ id: 8, status: 'earned', final_commission: 10 }]; }
        createAdjustment(...args: any[]) { return adjustment(...args); } }
}));
import { BillingRefundService } from './BillingRefundService';
import { billingIntegrityDatabase } from '../../testSupport/billingIntegrityDatabase';
import { withBillingClosure, assertBillingDateOpen } from './BillingFinancialGuard';
import { billingRefundQuote } from './BillingRefundQuote';

let db: any, service: BillingRefundService;
const partial = (overrides: any = {}) => ({ billingid: 1, serviceid: 1, refundAmount: 20,
    employeeid: 8, selectedPaymentMode: 1, branchid: 2, request_key: 'partial-refund-key-0001', ...overrides });
const all = (overrides: any = {}) => ({ billingid: 1, employeeid: 8, selectedPaymentMode: 1,
    branchid: 2, request_key: 'full-refund-key-000001', all: true, ...overrides });
beforeEach(async () => {
    vi.clearAllMocks(); ({ db } = await billingIntegrityDatabase()); service = new BillingRefundService(1, db);
    post.mockImplementation(async (_t: any, _b: any, voided: any, cash: any, _e: any, trx: any, historyid: any, _m: any, tax: any) =>
        trx('test_postings').insert({ voided, cash, tax, historyid }));
});
afterEach(async () => { await db.destroy(); });
describe('atomic cumulative laboratory refunds using real SQL', () => {
    it('refunds one of four services then all remaining services exactly once', async () => {
        await service.refund(partial({ refundAmount: 110 }));
        expect(await billingRefundQuote(db, 1, 2)).toMatchObject({ remaining_refundable_amount: 330, remaining_voidable_amount: 330,
            total_refunded_amount: 110, refund_state: 'PARTIALLY_REFUNDED', can_refund_all: true });
        await service.refund(all());
        expect(await db('billing').first()).toMatchObject({ paid: 0, payable: 0, totalrefunded: 440, amountIncurredDueTax: 0, islocked: 1 });
        expect(await db('billinghx')).toHaveLength(4);
        expect(await billingRefundQuote(db, 1, 2)).toMatchObject({ remaining_refundable_amount: 0, remaining_voidable_amount: 0,
            total_refunded_amount: 440, refund_state: 'FULLY_REFUNDED', can_refund_all: false });
        expect((await db('billing_refund_events')).reduce((n: number, r: any) => n + r.amount, 0)).toBe(440);
        expect((await db('test_postings')).reduce((n: number, r: any) => n + r.tax, 0)).toBe(40);
        expect(await service.refund(all())).toBe(true);
        expect(await db('billinghx')).toHaveLength(4);
    });
    it('preserves proportional tax on partial refunds and exhausts rounding on the final refund', async () => {
        await service.refund(partial());
        expect(await db('dboservices').where({ serviceid: 1 }).first()).toMatchObject({ paidamount: 90, totalpayable: 90, amountIncurredDueTax: 8.18 });
        expect(adjustment).toHaveBeenCalledWith(8, 1.82, expect.stringContaining('Refund event'), 'refund', true);
        expect(await db('billing').first()).toMatchObject({ paid: 420, payable: 420, amountIncurredDueTax: 38.18 });
        await service.refund(partial({ refundAmount: 30, request_key: 'partial-refund-key-0002' }));
        await service.refund(all());
        expect(await db('billing').first()).toMatchObject({ totalrefunded: 440, amountIncurredDueTax: 0 });
    });
    it('serializes same-key partial retries without a second cash debit', async () => {
        expect(await Promise.all([service.refund(partial()), service.refund(partial())])).toEqual([true, true]);
        expect(await db('billinghx')).toHaveLength(1);
        expect(await db('billing').first()).toMatchObject({ totalrefunded: 20, paid: 420 });
    });
    it('serializes concurrent partial and full requests without over-refunding', async () => {
        const outcomes = await Promise.allSettled([service.refund(partial()), service.refund(all())]);
        expect(outcomes.some(o => o.status === 'fulfilled')).toBe(true);
        expect(await db('billing').first()).toMatchObject({ totalrefunded: 440, paid: 0, payable: 0 });
    });
    it('rejects changed-key retries against a fully refunded service', async () => {
        await service.refund(partial({ refundAmount: 110 }));
        await expect(service.refund(partial({ request_key: 'partial-refund-key-0002' }))).rejects.toThrow('remaining');
        expect(await db('billinghx')).toHaveLength(1);
    });
    it('rejects changed payloads using the same key', async () => {
        await service.refund(partial());
        await expect(service.refund(partial({ refundAmount: 21 }))).rejects.toThrow('different');
        expect(await db('billinghx')).toHaveLength(1);
    });
    it.each([-1, 0, 110.01, 0.001, Infinity, NaN])('rejects invalid/excessive amounts %s atomically', async refundAmount => {
        await expect(service.refund(partial({ refundAmount }))).rejects.toThrow();
        expect(await db('billinghx')).toHaveLength(0);
        expect(await db('billing_refund_requests')).toHaveLength(0);
    });
    it('rejects branch mismatch and unapproved partial requests', async () => {
        await expect(service.refund(partial({ branchid: 9 }))).rejects.toThrow('Branch');
        await db('dbobillingrefundtable').where({ serviceid: 1 }).update({ isRefundApproved: 0 });
        await expect(service.refund(partial())).rejects.toThrow('approved');
        expect(await db('billinghx')).toHaveLength(0);
    });
    it.each(['posting', 'commission'])('rolls back cash, service, totals and retry reservation on %s failure', async failure => {
        (failure === 'posting' ? post : adjustment).mockRejectedValueOnce(new Error('Synthetic dependency failure'));
        await expect(service.refund(partial())).rejects.toThrow('Synthetic');
        expect(await db('billinghx')).toHaveLength(0); expect(await db('billing_refund_events')).toHaveLength(0);
        expect(await db('billing_refund_requests')).toHaveLength(0);
        expect(await db('billing').first()).toMatchObject({ paid: 440, payable: 440 });
        expect(await service.refund(partial())).toBe(true);
    });
    it.each(['signed', 'day', 'manifest'])('blocks source-%s closure despite a later submitted date', async kind => {
        if (kind === 'signed') await db('billing').update({ record_validated_and_signed_off: 1 });
        if (kind === 'day') await db('financial_day_closures').insert({ id: 7, branchid: 2, financial_date: '2026-10-01', status: 'finalized' });
        if (kind === 'manifest') await db('financial_record_locks').insert({ source_table: 'billing', source_ref: '1', closure_id: 7 });
        await expect(service.refund(partial({ refundDate: '2026-11-07' }))).rejects.toThrow(/immutable|finalized/);
        await expect(service.refund(all({ refundDate: '2026-11-07' }))).rejects.toThrow(/immutable|finalized/);
        expect(await db('billinghx')).toHaveLength(0);
        expect((await withBillingClosure(db, await db('billing')))[0].closed_status).toBe('CLOSED');
    });
    it('blocks new/backdated transactions on an already finalized source date', async () => {
        await db('financial_day_closures').insert({ branchid: 2, financial_date: '2026-10-01', status: 'finalized' });
        await expect(db.transaction((trx: any) => assertBillingDateOpen(trx, 1, 2, '2026-10-01'))).rejects.toThrow('finalized');
    });
    it('refuses to void a header with unmatched service balances', async () => {
        await db('billing').update({ payable: 450 });
        await expect(service.refund(all())).rejects.toThrow('reconcile');
        expect(await db('billinghx')).toHaveLength(0);
    });
});
