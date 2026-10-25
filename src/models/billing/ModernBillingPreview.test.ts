import { describe, expect, it, vi } from 'vitest';
vi.mock('./multi/initCustomerBilling', () => ({ CustomerBillingInit: {} }));
vi.mock('./multi/customerBillingCheckout', () => ({ CustomerBillingCheckout: {} }));
vi.mock('../organization/outsourcingOrganization/outsourcing', () => ({ default: class {} }));
import { ModernBillingPreview } from './ModernBillingPreview';

const actor = { employeeid: 7, tenantId: 3, branch: 4, role: 'admin', email: 'test@example.test' };
function setup(overrides: any = {}) {
    const catalog = { testList: [{ id: 10, testid: 10, name: 'FBC', price: 100, discountedValue: 100 }], servicesList: [{ keyid: 20, serviceName: 'Collection', servicePrice: 15 }], previousRecords: [], ...overrides };
    const initialize = vi.fn().mockResolvedValue(catalog);
    const organizations = vi.fn().mockResolvedValue([{ outsourceid: 8, name: 'Partner laboratory' }]);
    const price = vi.fn(async params => ({ success: true, data: {
        amountPayable: 115, subtotal: 115, totaldiscount: 0, totalsurcharge: 0, totalAmountIncurredDueTax: 0,
        cart: params.isPackageUsed ? [] : params.cart.map((row: any) => ({ ...row, totalpayable: 100, organization: undefined, outsourceid: undefined })),
        packageTestList: params.isPackageUsed ? params.cart : undefined,
        servicesList: params.servicesList,
    } }));
    return { service: new ModernBillingPreview({ initialize, price, organizations }), catalog, initialize, price, organizations };
}
const body = () => ({ context: { patientId: 101, billingSource: 1 }, items: [{ kind: 'test', id: 10 }, { kind: 'service', id: 20 }] });
describe('Modern billing bulk review', () => {
    it('hydrates IDs from the catalogue and calls the same pricing engine once for all items', async () => {
        const h = setup(); const result = await h.service.review(actor, body());
        expect(h.price).toHaveBeenCalledTimes(1);
        expect(h.price).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 3, employeeid: 7, branchid: 4, patientId: 101, cart: [expect.objectContaining({ testid: 10, price: 100 })], servicesList: [expect.objectContaining({ keyid: 20, servicePrice: 15 })], paymentDetails: null }));
        expect(result).toMatchObject({ amountPayable: 115, cart: [{ testid: 10, totalpayable: 100 }], servicesProvided: [{ keyid: 20 }], reviewedAt: expect.any(String) });
    });
    it('never uses client prices, amounts, actor or tenant identifiers', async () => {
        const h = setup(); const input: any = body(); input.tenantId = 99; input.employeeid = 99; input.branchid = 99; input.amountPayable = 1; input.items[0].price = 1; input.items[0].row = { price: 1 };
        await h.service.review(actor, input);
        const params = h.price.mock.calls[0][0]; expect(params.tenantId).toBe(3); expect(params.employeeid).toBe(7); expect(params.branchid).toBe(4); expect(params.cart[0].price).toBe(100); expect(params.amountPayable).toBeUndefined();
    });
    it.each([[1, 'general'], [2, 'organization'], [3, 'insurance'], [4, 'nhis'], [6, 'clinician']])('keeps payer %s on the existing pricing strategy', async (billingSource, entityType) => {
        const h = setup(); await h.service.review(actor, { ...body(), context: { patientId: 101, billingSource, entityId: 9, nhisMembershipId: 123, claimCheckCode: 456 } });
        expect(h.initialize).toHaveBeenCalledWith(3, expect.objectContaining({ billingSource, entityType, nhismembershipid: 123, claimscheckcode: 456 }));
        expect(h.price.mock.calls[0][0]).toMatchObject({ entitytype: entityType, billingSource });
    });
    it('keeps approved outsourcing metadata even when pricing omits it', async () => {
        const h = setup({ testList: [{ id: 10, testid: 10, name: 'FBC', isoutsourced: 1 }] });
        const result = await h.service.review(actor, { ...body(), items: [{ kind: 'test', id: 10, outsourceId: 8, prioritised: true }] });
        expect(result.cart[0]).toMatchObject({ outsourceid: 8, organization: { outsourceid: 8, name: 'Partner laboratory' }, prioritised: true });
    });
    it('allows outsourced tests without an assigned or configured organization', async () => {
        const h = setup({ testList: [{ id: 10, testid: 10, name: 'FBC', isoutsourced: 1, outsourceid: 99 }] });
        h.organizations.mockResolvedValue([]);
        const result = await h.service.review(actor, { ...body(), items: [{ kind: 'test', id: 10 }] });
        expect(h.price).toHaveBeenCalledTimes(1); expect(h.organizations).not.toHaveBeenCalled();
        expect(result.cart[0]).toMatchObject({ isoutsourced: 1, outsourceid: null });
        expect(result.cart[0].organization).toBeUndefined();
    });
    it('rejects an explicitly supplied unrelated organization without inventing an assignment', async () => {
        const h = setup({ testList: [{ id: 10, testid: 10, name: 'FBC', isoutsourced: 1 }] });
        await expect(h.service.review(actor, { ...body(), items: [{ kind: 'test', id: 10, outsourceId: 99 }] })).rejects.toThrow(/outsourcing organization/i);
        expect(h.price).not.toHaveBeenCalled();
    });
    it('rejects duplicates, removed catalogue items and empty selections instead of dropping them', async () => {
        for (const items of [[{ kind: 'test', id: 10 }, { kind: 'test', id: 10 }], [{ kind: 'test', id: 99 }], []]) { const h = setup(); await expect(h.service.review(actor, { ...body(), items })).rejects.toThrow(); expect(h.price).not.toHaveBeenCalled(); }
    });
    it('requires the patient, payer, NHIS context and actor branch', async () => {
        for (const context of [{ patientId: 0, billingSource: 1 }, { patientId: 101, billingSource: 2 }, { patientId: 101, billingSource: 4 }]) { const h = setup(); await expect(h.service.review(actor, { ...body(), context })).rejects.toThrow(); expect(h.price).not.toHaveBeenCalled(); }
        await expect(setup().service.review({ ...actor, branch: null }, body())).rejects.toThrow(/branch/);
    });
    it('allows patientless quotations while preserving the quote flag', async () => {
        const h = setup(); await h.service.review(actor, { ...body(), context: { patientId: 0, billingSource: 1, quote: true } }); expect(h.price.mock.calls[0][0]).toMatchObject({ ispricingcheckout: true, patientId: 0 });
    });
    it('hydrates full packages and rejects partial packages', async () => {
        const h = setup({ packageTestList: [{ id: 10, testid: 10, name: 'Package FBC' }, { id: 11, testid: 11, name: 'Package glucose' }] });
        const input = { context: { patientId: 101, billingSource: 1, packageId: 2 }, items: [{ kind: 'test', id: 10 }] };
        await expect(h.service.review(actor, input)).rejects.toThrow(/all of its tests/);
        const result = await h.service.review(actor, { ...input, items: [...input.items, { kind: 'test', id: 11 }] }); expect(result.cart).toHaveLength(2); expect(h.price.mock.calls[0][0].isPackageUsed).toBe(true);
    });
    it('loads services separately when package initialization omits the service catalogue', async () => {
        const h = setup({ servicesList: undefined });
        h.initialize.mockResolvedValueOnce(h.catalog).mockResolvedValueOnce({ testList: [], servicesList: [{ keyid: 20, serviceName: 'Collection', servicePrice: 15 }] });
        const result = await h.service.review(actor, { ...body(), context: { patientId: 101, billingSource: 1, packageId: 2 } });
        expect(h.initialize).toHaveBeenCalledTimes(2);
        expect(h.initialize.mock.calls[1][1]).toMatchObject({ isPackageUsed: false, includeServices: true });
        expect(result.servicesProvided[0].keyid).toBe(20);
    });
    it('uses the resolved payer from catalogue initialization and forwards adjustments and promotion options', async () => {
        const h = setup({ entityType: 'organization', entityId: 42 }); await h.service.review(actor, { context: { patientId: 101, billingSource: 2, entityId: 9, referralCode: 'REF', promoCode: 'PROMO' }, items: [{ kind: 'test', id: 10, adjustment: { type: 'discount', value: 5 } }] });
        expect(h.price.mock.calls[0][0]).toMatchObject({ entitytype: 'organization', entityid: 42, referalCode: 'REF', promoCode: 'PROMO', isPromo: true, cart: [expect.objectContaining({ userAdjustmentType: 'discount', userAdjustedValue: 5 })] });
    });
    it('does not return a successful preview when pricing fails or drops a selected item', async () => {
        for (const response of [{ success: false, message: 'Discount limit exceeded' }, { success: true, data: { cart: [], servicesList: [], amountPayable: 0 } }]) { const h = setup(); h.price.mockResolvedValueOnce(response as any); await expect(h.service.review(actor, body())).rejects.toThrow(); }
    });
});
