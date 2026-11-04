import { allocateMinor, minorUnits, sumMinor } from '../../accountingModule/utils/money';

/** Browser amounts and per-line payment flags are never persisted as financial authority. */
export function authoritativeSubmission(payload: any, checkout: any): any {
    const tests = payload.isPackageUsed ? checkout.packageTestList : checkout.cart;
    const services = checkout.servicesList || [];
    if (!Array.isArray(tests)) throw new Error('Refresh the billing catalogue');
    if (!payload.isPackageUsed && (tests.length !== payload.cart.length ||
        new Set(payload.cart.map((i: any) => i.testid)).size !== payload.cart.length))
        throw new Error('A selected test is unavailable or duplicated');
    if (services.length !== (payload.servicesProvided || []).length ||
        new Set((payload.servicesProvided || []).map((i: any) => i.keyid ?? i.id)).size !== services.length)
        throw new Error('An additional service is unavailable or duplicated');
    const rows = [...tests, ...services];
    const weights = rows.map(r => minorUnits(r.totalpayable));
    if (weights.some(n => n < 0)) throw new Error('Negative service prices are not allowed');
    const total = sumMinor(rows.map(r => r.totalpayable));
    const received = minorUnits(payload.paid);
    if (received < 0 || received > total) throw new Error('Payment exceeds the authoritative bill total');
    const allocated = allocateMinor(received, weights);
    const settled = rows.map((row, i) => ({ ...row,
        ...(i < tests.length ? {
            isoutsourced: (payload.cart || []).find((r: any) => Number(r.testid) === Number(row.testid))?.isoutsourced === 1 ? 1 : 0,
            outsourceid: (payload.cart || []).find((r: any) => Number(r.testid) === Number(row.testid))?.outsourceid || null
        } : {}),
        paidamount: allocated[i] / 100,
        outstanding: (weights[i] - allocated[i]) / 100,
        paymentstatus: allocated[i] === weights[i] ? 'paid' : allocated[i] ? 'partial' : 'pending' }));
    return { ...payload, amountPayable: total / 100, cart: settled.slice(0, tests.length),
        servicesProvided: settled.slice(tests.length), taxIncluded: checkout.taxIncluded, taxList: checkout.taxList, taxValue: checkout.taxValue || 0 };
}
