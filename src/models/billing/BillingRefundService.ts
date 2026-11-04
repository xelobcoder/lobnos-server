import Decimal from 'decimal.js';
import KnexConnection from '../../database/KnexConnections';
import { minorUnits } from '../../accountingModule/utils/money';
import { enqueueBillingRefund } from '../../accountingModule/integrations/BillingAccounting';
import { applyDboservicesAfterUpdate } from '../../database/appLevelTriggers';
import { CommissionTrackingRepository } from '../commissions/commission-configurations/repositories/CommissionTrackingRepository';
import { lockMutableBill } from './BillingFinancialGuard';
import { billingFingerprint, billingRequestKey, reserveBillingRequest } from './BillingRequestIdentity';

export class BillingRefundService {
    constructor(private tenantId: number, private connection?: any) {}

    async refund(input: { billingid: number; serviceid?: number; refundAmount?: number; employeeid: number;
        selectedPaymentMode: number; request_key: string; all?: boolean; reason?: string; branchid?: number }): Promise<boolean> {
        const key = billingRequestKey(input.request_key), hash = billingFingerprint(input);
        for (const id of [input.billingid, input.employeeid, input.selectedPaymentMode, ...(input.all ? [] : [input.serviceid])])
            if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid refund document');
        const requested = input.all ? 0 : minorUnits(input.refundAmount);
        if (!input.all && requested <= 0) throw new Error('Refund amount must be positive');
        const db = this.connection || await KnexConnection(this.tenantId);
        return db.transaction(async trx => {
            const replay = await reserveBillingRequest(trx, 'billing_refund_requests', key, hash);
            if (replay) return true;
            const bill = await lockMutableBill(trx, this.tenantId, input.billingid);
            if (input.branchid !== undefined && Number(bill.branchid) !== Number(input.branchid)) throw new Error('Branch access denied');
            if (Number(bill.islocked) === 1 || ['voided', 'written-off'].includes(bill.status)) throw new Error('Transaction is locked');
            if (!await trx('paymentmodes').where({ KeyID: input.selectedPaymentMode }).first()) throw new Error('Unknown refund payment mode');
            const query = trx('dboservices').where({ billingid: input.billingid }).orderBy('serviceid').forUpdate();
            if (!input.all) query.where({ serviceid: input.serviceid });
            const services = await query;
            if (!services.length) throw new Error('No matching services found');
            let cashTotal = 0, grossTotal = 0, taxTotal = 0;
            for (const service of services) {
                if (Number(service.isDeleted) === 1 || service.status === 'voided') continue;
                if (minorUnits(service.foc_amount || 0) > 0) throw new Error('Reverse staff benefit coverage before issuing a cash refund');
                let approval = await trx('dbobillingrefundtable').where({ serviceid: service.serviceid }).forUpdate().first();
                if (!approval) {
                    if (!input.all) throw new Error('Refund is not approved');
                    await trx('dbobillingrefundtable').insert({ serviceid: service.serviceid, isRefundApproved: 1, amountRefunded: 0 });
                    approval = { amountRefunded: 0 };
                }
                if (!input.all && Number(approval.isRefundApproved) !== 1) throw new Error('Refund is not approved');
                // paidamount is the NET balance after prior refunds. amountRefunded is historical,
                // and must never be subtracted a second time.
                const paid = minorUnits(service.paidamount || 0), gross = minorUnits(service.totalpayable || 0);
                const cash = input.all ? paid : requested;
                const voided = input.all ? gross : cash;
                if (cash < 0 || cash > paid || voided > gross) throw new Error('Refund exceeds the remaining amount received');
                if (!cash && !voided) continue; // already fully refunded: harmless in refund-all
                const tax = voided === gross ? minorUnits(service.amountIncurredDueTax || 0)
                    : new Decimal(minorUnits(service.amountIncurredDueTax || 0)).mul(voided).div(gross).toDecimalPlaces(0).toNumber();
                const remainingGross = gross - voided, remainingPaid = paid - cash;
                const [historyId] = cash ? await trx('billinghx').insert({ billingid: input.billingid, paymentmode: input.selectedPaymentMode,
                    amount: cash / 100, employeeid: input.employeeid, type: 'debit' }) : [0];
                await trx('dboservices').where({ serviceid: service.serviceid }).update({
                    totalpayable: remainingGross / 100, totalcost: Math.max(0, minorUnits(service.totalcost || 0) - voided) / 100,
                    paidamount: remainingPaid / 100, outstanding: (remainingGross - remainingPaid) / 100,
                    amountIncurredDueTax: (minorUnits(service.amountIncurredDueTax || 0) - tax) / 100,
                    isRefunded: remainingGross === 0 ? 1 : 0, isLocked: remainingGross === 0 ? 1 : 0,
                    status: remainingGross === 0 ? 'refunded' : 'active',
                    paymentstatus: remainingPaid === remainingGross ? 'paid' : remainingPaid ? 'partial' : 'pending'
                });
                await trx('dbobillingrefundtable').where({ serviceid: service.serviceid }).update({
                    amountRefunded: (minorUnits(approval.amountRefunded || 0) + cash) / 100,
                    isRefundApproved: 1, isRefundCompleted: remainingPaid === 0 ? 1 : 0,
                    isRefundMatterClosed: remainingPaid === 0 ? 1 : 0, refundedBy: input.employeeid
                });
                const [eventId] = await trx('billing_refund_events').insert({ request_key: key, billingid: input.billingid,
                    serviceid: service.serviceid, history_id: Number(historyId || 0), amount: cash / 100, tax_amount: tax / 100, employeeid: input.employeeid });
                await enqueueBillingRefund(this.tenantId, input.billingid, voided / 100, cash / 100, input.employeeid, trx,
                    Number(historyId || 0) || undefined, input.selectedPaymentMode, tax / 100, Number(eventId));
                const updated = await trx('dboservices').where({ serviceid: service.serviceid }).first();
                await applyDboservicesAfterUpdate(trx, updated, String(input.employeeid));
                const tracking = new CommissionTrackingRepository(this.tenantId, trx);
                const history = await tracking.findByServiceId(service.serviceid, true);
                const seen = new Set<string>();
                for (const original of history.filter(t => t.status !== 'adjusted' && t.status !== 'voided' && Number(t.final_commission) > 0)) {
                    const recipient = `${original.recipient_type}:${original.recipient_id}:${original.config_id}`;
                    if (seen.has(recipient)) continue;
                    seen.add(recipient);
                    const prior = history.filter(t => t.status === 'adjusted' && t.recipient_type === original.recipient_type &&
                        t.recipient_id === original.recipient_id && t.config_id === original.config_id)
                        .reduce((n, t) => n + minorUnits(Number(t.final_commission)), 0);
                    const remaining = Math.max(0, minorUnits(Number(original.final_commission)) + prior);
                    const clawback = voided === gross ? remaining : new Decimal(remaining).mul(voided).div(gross).toDecimalPlaces(0).toNumber();
                    if (clawback) await tracking.createAdjustment(original.id, clawback / 100, `Refund event ${eventId}`, 'refund', true);
                }
                cashTotal += cash; grossTotal += voided; taxTotal += tax;
            }
            if (!input.all && !cashTotal) throw new Error('No refundable balance remains');
            const paid = minorUnits(bill.paid || 0) - cashTotal, payable = minorUnits(bill.payable || 0) - grossTotal;
            if (paid < 0 || payable < 0 || (input.all && (paid !== 0 || payable !== 0)) ||
                minorUnits(bill.amountIncurredDueTax || 0) < taxTotal)
                throw new Error('Bill and service totals disagree; reconcile before refunding');
            await trx('billing').where({ billingid: input.billingid }).update({
                paid: paid / 100, payable: payable / 100, outstanding: Math.max(0, payable - paid) / 100,
                balance: Math.max(0, paid - payable) / 100,
                amountIncurredDueTax: (minorUnits(bill.amountIncurredDueTax || 0) - taxTotal) / 100,
                totalcost: Math.max(0, minorUnits(bill.totalcost || 0) - grossTotal) / 100,
                totalrefunded: (minorUnits(bill.totalrefunded || 0) + cashTotal) / 100,
                ...(input.all ? { status: 'voided', islocked: 1 } : {}),
                lastupdatedby: input.employeeid
            });
            await trx('billing_refund_requests').where({ request_key: key }).update({ result_json: JSON.stringify({ success: true }) });
            return true;
        });
    }
}
