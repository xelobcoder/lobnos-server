import { MultiTBillingDataShared } from './multi/billing_shared_types';
import { SubmitCustomerBilling } from './billing-new-client-multi';

/** Compatibility entry point: additions use exactly the same authoritative writer as checkout. */
export class BillingUpdateRepo {
    static async updateBillingTransaction(tenantId: number, billingID: number, data: MultiTBillingDataShared): Promise<void> {
        const payload: any = data;
        if (payload.adjustmentType !== 'addition') throw new Error('Legacy financial edits are disabled; submit an explicit service addition or linked refund');
        const result = await new SubmitCustomerBilling({ ...payload, tenantId, billingid: billingID,
            patientId: payload.patientId ?? payload.patientid, isAdjustment: true, adjustmentType: 'addition',
            amountPayable: payload.amountPayable ?? payload.payable,
            payments: payload.payments || (Number(payload.paid) > 0 ? [{ mode: payload.paymentmode, amount: payload.paid }] : []),
            paymentDetails: payload.paymentDetails || { mode: payload.paymentmode, amount: payload.paid }
        }, tenantId).submit();
        if (!result.status) throw new Error(result.message);
    }
}
