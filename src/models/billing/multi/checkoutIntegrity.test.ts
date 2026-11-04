import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../database/KnexConnections', () => ({ default: vi.fn(async () => ({})) }));
vi.mock('../../../LobnosAuth/user', () => ({ default: class { async getUserRole() { return 'admin'; } } }));
vi.mock('../billing-services/discount-limit', () => ({ default: { getRoleLimitInfo: vi.fn(async () => null) } }));
vi.mock('./packageBillingHelper', () => ({ PackageBillingHelper: {
    handlePackageCheckout: vi.fn(async () => ({ success: true, recalculatedPackageList: [{ testid: 22, totalpayable: 100, totalcost: 100, discountedValue: 100, actualPrice: 100, amountIncurredDueTax: 0 }] }))
} }));
import { CustomerBillingCheckout } from './customerBillingCheckout';
import { PrimeBillingEnterprise } from './PrimeBillingEnterprise';
let tenant = 100;
beforeEach(() => {
    tenant++;
    vi.spyOn(PrimeBillingEnterprise.prototype, 'getAppSettings').mockResolvedValue({ includeTax: 0, billingsettings: { hasNightAdjustment: false } } as any);
    vi.spyOn(PrimeBillingEnterprise.prototype, 'getAppBillSettings').mockResolvedValue({ taxValue: 10 } as any);
    vi.spyOn(PrimeBillingEnterprise.prototype, 'getBillingHandler').mockResolvedValue([{ testid: 22, price: 100, actualPrice: 100, originalPrice: 100, discountedValue: 100, discount: 0 }] as any);
    vi.spyOn(PrimeBillingEnterprise.prototype, 'getAllServices').mockResolvedValue([{ keyid: 8, servicePrice: 100, discountedValue: 100 }] as any);
});
afterEach(() => { vi.restoreAllMocks(); });
const input = (extra: any = {}) => ({ tenantId: tenant, patientId: 7, branchid: 2, billingSource: 1, ispricingcheckout: true,
    cart: [{ testid: 22 }], servicesList: [], paymentDetails: { amount: 0 }, ...extra });
describe('checkout payable and outstanding share the same authoritative basis', () => {
    it('does not count a 10 surcharge twice on a 100 test', async () => {
        const result = await CustomerBillingCheckout.checkoutCustomerBilling(input({ cart: [{ testid: 22, userAdjustmentType: 'surcharge', userAdjustedValue: 10 }] }));
        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({ amountPayable: 110, outstanding: 110, balance: 0, totalsurcharge: 10 });
    });
    it('includes additional services in package outstanding', async () => {
        const result = await CustomerBillingCheckout.checkoutCustomerBilling(input({ isPackageUsed: true, packageid: 3, servicesList: [{ keyid: 8 }] }));
        expect(result.success).toBe(true); expect(result.data).toMatchObject({ amountPayable: 200, outstanding: 200, balance: 0 });
    });
    it('uses the same basis for partial package payments and rejects overpayment', async () => {
        const result = await CustomerBillingCheckout.checkoutCustomerBilling(input({ isPackageUsed: true, packageid: 3, servicesList: [{ keyid: 8 }], paymentDetails: { amount: 50 } }));
        expect(result.data).toMatchObject({ amountPayable: 200, outstanding: 150, balance: 0 });
        expect((await CustomerBillingCheckout.checkoutCustomerBilling(input({ paymentDetails: { amount: 100.01 } }))).success).toBe(false);
    });
    it('applies one flat promo across test and additional service before tax', async () => {
        vi.spyOn(CustomerBillingCheckout.getInstance(tenant) as any, 'validatePromo').mockResolvedValue({ valid: true, promo: { id: 1, discount_type: 'flat', discount_value: 10 } });
        vi.mocked(PrimeBillingEnterprise.prototype.getAppSettings).mockResolvedValue({ includeTax: 1, billingsettings: { hasNightAdjustment: false } } as any);
        const result = await CustomerBillingCheckout.checkoutCustomerBilling(input({ isPromo: true, promoCode: 'FLAT10', servicesList: [{ keyid: 8 }] }));
        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({ amountPayable: 209, outstanding: 209, totaldiscount: 10, totalAmountIncurredDueTax: 19 });
        expect(result.data.cart[0].totalpayable).toBe(104.5); expect(result.data.servicesList[0].totalpayable).toBe(104.5);
    });
});
