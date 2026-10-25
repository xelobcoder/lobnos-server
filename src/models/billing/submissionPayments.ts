// Benefit coverage is authorized by StaffFocService, never a cash receipt.
export function normalizeSubmissionPayments(payload: any) {
    // Adjustments have their own existing reconciliation and excess-payment rules.
    if (payload.isAdjustment) return payload;
    const entries = Array.isArray(payload.payments) ? payload.payments : [];
    const mode = payload.paymentDetails?.mode || (entries.some((p: any) => p?.mode === 'free') ? 'free' : undefined);
    const payments = entries.filter((p: any) => !['free', 'foc', 'nhis'].includes(String(p?.mode)) && !(Number(payload.billingSource) === 4 && p?.amount === 0));
    for (const payment of payments) {
        if (!payment?.mode || !Number.isFinite(payment.amount) || payment.amount <= 0) {
            throw new Error('Each cash payment needs a valid mode and positive amount.');
        }
    }
    const received = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
    if (mode !== 'foc' && Math.abs(received - Number(payload.paid || 0)) > 0.009) {
        throw new Error('Payment entries do not match the amount received.');
    }
    if (mode === 'foc' && !(Number(payload.focStaffId || payload.paymentDetails?.focStaffId) > 0)) {
        throw new Error('Select an eligible staff member for FOC benefit.');
    }
    return { ...payload, payments, paid: received, paymentDetails: { ...payload.paymentDetails, ...(mode ? { mode } : {}), amount: received } };
}
