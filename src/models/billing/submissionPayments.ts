import { minorUnits, sumMinor } from '../../accountingModule/utils/money';
// Benefit coverage is authorized by StaffFocService, never a cash receipt.
export function normalizeSubmissionPayments(payload: any) {
    const entries = Array.isArray(payload.payments) ? payload.payments : [];
    const mode = payload.paymentDetails?.mode || (entries.some((p: any) => p?.mode === 'free') ? 'free' : undefined);
    const payments = entries.filter((p: any) => !['free', 'foc', 'nhis'].includes(String(p?.mode)) && !(Number(payload.billingSource) === 4 && p?.amount === 0));
    for (const payment of payments) {
        if (!payment?.mode || !Number.isFinite(payment.amount) || payment.amount <= 0) {
            throw new Error('Each cash payment needs a valid mode and positive amount.');
        }
    }
    for (const payment of payments) minorUnits(payment.amount);
    const received = sumMinor(payments.map((p: any) => p.amount)) / 100;
    if (mode !== 'foc' && Math.abs(received - Number(payload.paid || 0)) > 0.009) {
        throw new Error('Payment entries do not match the amount received.');
    }
    if (mode === 'foc' && !(Number(payload.focStaffId || payload.paymentDetails?.focStaffId) > 0)) {
        throw new Error('Select an eligible staff member for FOC benefit.');
    }
    return { ...payload, payments, paid: received, paymentDetails: { ...payload.paymentDetails, ...(mode ? { mode } : {}), amount: received } };
}
