import { minorUnits } from '../../accountingModule/utils/money';
import { withBillingClosure } from './BillingFinancialGuard';

/** Snapshot/preview only: the refund writer always repeats these checks under locks. */
export async function billingRefundQuote(db: any, billingid: number, branchid: number) {
    return db.transaction(async trx => {
        const bill = await trx('billing').where({ billingid, branchid }).first();
        if (!bill) throw new Error('Billing record not found');
        const [decorated] = await withBillingClosure(trx, [bill]);
        const rows = await trx('dboservices').where({ billingid }).orderBy('serviceid');
        const services = rows.filter(r => Number(r.isDeleted) !== 1 && r.status !== 'voided').map(r => ({
            serviceid: Number(r.serviceid),
            remaining_refundable_amount: minorUnits(r.paidamount || 0) / 100,
            remaining_voidable_amount: minorUnits(r.totalpayable || 0) / 100
        }));
        const cash = services.reduce((n, r) => n + minorUnits(r.remaining_refundable_amount), 0);
        const gross = services.reduce((n, r) => n + minorUnits(r.remaining_voidable_amount), 0);
        const tax = rows.filter(r => Number(r.isDeleted) !== 1 && r.status !== 'voided')
            .reduce((n, r) => n + minorUnits(r.amountIncurredDueTax || 0), 0);
        const refunded = minorUnits(bill.totalrefunded || 0);
        return { billingid, remaining_refundable_amount: cash / 100, remaining_voidable_amount: gross / 100,
            remaining_tax_amount: tax / 100, total_refunded_amount: refunded / 100,
            refund_state: gross === 0 && (refunded > 0 || bill.status === 'voided') ? 'FULLY_REFUNDED' : refunded > 0 ? 'PARTIALLY_REFUNDED' : 'NOT_REFUNDED',
            can_refund_all: decorated.closed_status === 'OPEN' && Number(bill.islocked) !== 1 &&
                gross > 0 && cash >= 0 && cash <= gross &&
                gross === minorUnits(bill.payable || 0) && cash === minorUnits(bill.paid || 0) &&
                !rows.some(r => Number(r.foc_amount || 0) > 0),
            closed_status: decorated.closed_status, closure_evidence: decorated.closure_evidence, services };
    });
}
