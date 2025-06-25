"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerBillingCheckout = void 0;
const PrimeBillingPromoCodeRepo_1 = require("./repositories/PrimeBillingPromoCodeRepo");
const packageBillingHelper_1 = require("./packageBillingHelper");
const PrimeBillingEnterprise_1 = require("./PrimeBillingEnterprise");
class CustomerBillingCheckoutSingleton extends PrimeBillingEnterprise_1.PrimeBillingEnterprise {
    constructor(tenantId) {
        super(tenantId);
    }
    static getInstance(tenantId) {
        if (!CustomerBillingCheckoutSingleton.instance || CustomerBillingCheckoutSingleton.instance.tenantId !== tenantId) {
            CustomerBillingCheckoutSingleton.instance = new CustomerBillingCheckoutSingleton(tenantId);
        }
        return CustomerBillingCheckoutSingleton.instance;
    }
    static async checkoutCustomerBilling(params) {
        const billing = CustomerBillingCheckoutSingleton.getInstance(params.tenantId);
        return billing.handleCheckout(params);
    }
    async handleCheckout({ patientId, billingid, cart, servicesList, paymentDetails, branchid, billingSource, referalCode, promoCode, isPromo, isPackageUsed, packageid, tenantId }) {
        if (!patientId)
            return { success: false, message: 'No patientId provided' };
        if (branchid === undefined || branchid === null)
            return { success: false, message: 'No branchid provided' };
        if (billingSource === undefined || billingSource === null)
            return { success: false, message: 'No billingSource provided' };
        const totalOutstanding = await this.getCustomerOutstandingDebt(patientId);
        if (totalOutstanding > 0)
            return { success: false, message: 'Outstanding debt found' };
        const appsettings = await this.getAppSettings();
        const { includeTax, billingsettings } = appsettings || {};
        const taxation = appsettings ? await this.getAppBillSettings() : {};
        let recalculatedCart = [];
        let recalculatedPackageList = [];
        let usedPackage = false;
        let taxIncluded = false;
        let taxList = undefined;
        let taxValue = undefined;
        let promoDiscount = 0;
        let promoValid = false;
        let promoDetails = null;
        if (isPromo && promoCode) {
            const promoResult = await this.validatePromo(tenantId, promoCode);
            promoValid = promoResult.valid;
            promoDetails = promoResult.promo;
            if (!promoValid) {
                return { success: false, message: promoResult.reason || 'Invalid promo code', data: { promoCode } };
            }
        }
        if (isPackageUsed && packageid) {
            const pkgResult = await packageBillingHelper_1.PackageBillingHelper.handlePackageCheckout({
                tenantId: tenantId,
                packageid,
                cart
            });
            if (!pkgResult.success)
                return { success: false, message: pkgResult.message };
            recalculatedPackageList = pkgResult.recalculatedPackageList || [];
            usedPackage = true;
        }
        else {
            recalculatedCart = await this.getRecalculatedCart(cart, referalCode, billingsettings, isPromo, promoValid, promoCode, promoDetails, includeTax, taxation);
        }
        let recalculatedServicesList = await CustomerBillingCheckoutSingleton.recalculateServicesList({
            billing: this,
            servicesList,
            billingsettings,
            isPromo,
            promoValid,
            promoCode,
            promoDetails,
            includeTax,
            taxation
        });
        const { subtotal, totaldiscount, totalAmountIncurredDueTax, totalServiceAmount } = PrimeBillingEnterprise_1.PrimeBillingEnterprise.calculateBillingTotals({
            usedPackage,
            recalculatedPackageList,
            recalculatedCart,
            recalculatedServicesList
        });
        if (isPromo && promoValid && promoCode && promoDetails) {
            promoDiscount = PrimeBillingEnterprise_1.PrimeBillingEnterprise.calculatePromoDiscount(subtotal, promoDetails);
        }
        const paid = paymentDetails && paymentDetails.amount ? paymentDetails.amount : 0;
        const amountPayable = subtotal + totalAmountIncurredDueTax;
        const balance = amountPayable - paid;
        const totalcost = subtotal + totalServiceAmount;
        const totalTestAmountPayable = subtotal + totalAmountIncurredDueTax;
        const totalServiceAmountPayable = totalServiceAmount;
        return {
            success: true,
            message: 'Checkout recalculation successful. No payment has been received yet.',
            data: {
                subtotal,
                totalcost,
                totaldiscount,
                totalAmountIncurredDueTax,
                totalServiceAmount,
                amountPayable,
                totalTestAmountPayable,
                totalServiceAmountPayable,
                paid,
                balance,
                cart: recalculatedCart,
                servicesList: recalculatedServicesList,
                promoCode: promoCode || undefined,
                promoDiscount,
                isPromo: !!isPromo,
                isPackageUsed: !!isPackageUsed,
                packageid: packageid || undefined,
                packageTestList: usedPackage ? recalculatedPackageList : undefined,
                promoDetails: promoValid ? promoDetails : undefined,
                paymentStatus: 'pending',
                paymentReceived: false,
                taxIncluded,
                taxList
            }
        };
    }
    async getRecalculatedCart(cart, referalCode, billingsettings, isPromo, promoValid, promoCode, promoDetails, includeTax, taxation) {
        const selectedTestIds = cart.map((item) => item.testid);
        let allTests = [];
        if (selectedTestIds.length > 0) {
            let entityType = 'general';
            let entityId = null;
            if (referalCode) {
                const referalRepo = await this.getReferralByCode(referalCode);
                if (referalRepo) {
                    entityType = referalRepo.entity_type;
                    entityId = referalRepo.entity_id;
                }
            }
            allTests = await this.getBillingHandler(entityType, entityId);
        }
        let recalculatedCart = allTests
            .filter((test) => selectedTestIds.includes(test.testid))
            .map((test) => (Object.assign(Object.assign({}, test), { price: test.price, discount: test.discount || 0 })));
        recalculatedCart = this.applyAllBillingRulesToCart(recalculatedCart, billingsettings, isPromo, promoValid, promoCode, promoDetails, includeTax, taxation);
        return recalculatedCart;
    }
    applyAllBillingRulesToCart(recalculatedCart, billingsettings, isPromo, promoValid, promoCode, promoDetails, includeTax, taxation) {
        if (billingsettings && billingsettings.hasNightAdjustment) {
            recalculatedCart = PrimeBillingEnterprise_1.PrimeBillingEnterprise.applyNightAdjustmentsToTests(recalculatedCart, billingsettings, 'test');
        }
        recalculatedCart = PrimeBillingEnterprise_1.PrimeBillingEnterprise.applyDiscountsToTests(recalculatedCart);
        if (isPromo && promoValid && promoCode && promoDetails) {
            recalculatedCart = PrimeBillingEnterprise_1.PrimeBillingEnterprise.applyPromoToItems(recalculatedCart, { type: promoDetails.discount_type, value: promoDetails.discount_value });
        }
        if (includeTax && includeTax === 1 && taxation && taxation.taxValue > 0) {
            recalculatedCart = PrimeBillingEnterprise_1.PrimeBillingEnterprise.applyTaxToTests(recalculatedCart, taxation.taxValue);
        }
        recalculatedCart = PrimeBillingEnterprise_1.PrimeBillingEnterprise.addNightAdjustmentInfo(recalculatedCart, billingsettings);
        return recalculatedCart;
    }
    static async recalculateServicesList(params) {
        return PrimeBillingEnterprise_1.PrimeBillingEnterprise.recalculateServicesList(params);
    }
    async validatePromo(tenantId, promoCode) {
        const promoRepo = new PrimeBillingPromoCodeRepo_1.PrimeBillingPromoCodeRepo(tenantId);
        const promoResult = await promoRepo.validatePromoCode(promoCode);
        return {
            valid: promoResult.valid,
            promo: promoResult.promo || null,
            reason: promoResult.reason
        };
    }
}
exports.CustomerBillingCheckout = CustomerBillingCheckoutSingleton;
