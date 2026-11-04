import { describe, expect, it, vi } from 'vitest';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
import { authoritativeSubmission } from './authoritativeSubmission';
import { PrimeBillingEnterprise } from './multi/PrimeBillingEnterprise';
import { billingFingerprint, billingRequestKey } from './BillingRequestIdentity';

describe('authoritative line and received-cash allocations', () => {
    const checkout = { cart: [{ testid: 1, totalpayable: 100, actualPrice: 100, amountIncurredDueTax: 0 }],
        servicesList: [{ keyid: 8, totalpayable: 100, servicePrice: 100 }], taxValue: 0 };
    const payload = (paid = 0) => ({ cart: [{ testid: 1, totalpayable: 1, paidamount: 100, paymentstatus: 'paid' }],
        servicesProvided: [{ keyid: 8, totalpayable: 1, paidamount: 100 }], paid, amountPayable: 2 });
    it('replaces browser prices, totals and fabricated paid flags with recalculated rows', () => {
        const result = authoritativeSubmission(payload(), checkout);
        expect(result).toMatchObject({ amountPayable: 200, cart: [{ totalpayable: 100, paidamount: 0, outstanding: 100, paymentstatus: 'pending' }],
            servicesProvided: [{ totalpayable: 100, paidamount: 0 }] });
    });
    it.each([0.01, 0.03, 1, 100, 199.99, 200])('allocates exactly %s received across tests and services', paid => {
        const result = authoritativeSubmission(payload(paid), checkout);
        expect(Math.round([...result.cart, ...result.servicesProvided].reduce((n, r) => n + r.paidamount, 0) * 100)).toBe(Math.round(paid * 100));
        expect([...result.cart, ...result.servicesProvided].every(r => r.paidamount <= r.totalpayable && r.outstanding >= 0)).toBe(true);
    });
    it('rejects unavailable/duplicate selection and overpayment', () => {
        expect(() => authoritativeSubmission(payload(200.01), checkout)).toThrow('exceeds');
        expect(() => authoritativeSubmission({ ...payload(), cart: [{ testid: 1 }, { testid: 1 }] }, checkout)).toThrow('duplicated');
    });
    it('uses package allocations rather than browser package prices', () => {
        const result = authoritativeSubmission({ ...payload(50), isPackageUsed: true }, { ...checkout,
            packageTestList: [{ testid: 1, totalpayable: 25 }, { testid: 2, totalpayable: 75 }] });
        expect(result.amountPayable).toBe(200);
        expect(result.cart.map(r => r.paidamount)).toEqual([6.25, 18.75]);
    });
});
describe('single invoice promo allocation and request identity', () => {
    it('allocates flat 10 once across test 100 plus additional service 100', () => {
        const rows = PrimeBillingEnterprise.applyPromoToItems([{ discountedValue: 100 }, { discountedValue: 100 }], { type: 'flat', value: 10 });
        expect(rows.map((r: any) => r.totalpayable)).toEqual([95, 95]);
    });
    it('uses proportional nonnegative cent allocation for unequal and capped lines', () => {
        const source = [{ discountedValue: 1 }, { discountedValue: 99 }];
        expect(PrimeBillingEnterprise.applyPromoToItems(source, { type: 'flat', value: 10 }).map((r: any) => r.totalpayable)).toEqual([0.9, 89.1]);
        expect(PrimeBillingEnterprise.applyPromoToItems(source, { type: 'flat', value: 110 }).map((r: any) => r.totalpayable)).toEqual([0, 0]);
    });
    it('applies tax after allocated promo and prevents percentage discounts over 100%', () => {
        const rows = PrimeBillingEnterprise.applyPromoToItems([{ discountedValue: 100 }, { discountedValue: 100 }], { type: 'flat', value: 10 });
        expect(PrimeBillingEnterprise.applyTaxToTests(rows, 10).map((r: any) => r.totalpayable)).toEqual([104.5, 104.5]);
        expect(() => PrimeBillingEnterprise.applyPromoToItems(rows, { type: 'percentage', value: 101 })).toThrow('percentage');
    });
    it('canonicalizes object ordering but detects changed financial inputs', () => {
        expect(billingFingerprint({ paid: 1, cart: [2], request_key: 'one' })).toBe(billingFingerprint({ cart: [2], paid: 1, request_key: 'two' }));
        expect(billingFingerprint({ paid: 1 })).not.toBe(billingFingerprint({ paid: 2 }));
        expect(billingRequestKey('12345678-1234-1234-1234-123456789abc')).toBeTruthy();
        expect(() => billingRequestKey('missing')).toThrow('request_key');
    });
});
