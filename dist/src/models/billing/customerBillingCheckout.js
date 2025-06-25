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
    static async checkoutCustomerBilling({ patientId, billingid, cart, servicesList, paymentDetails, branchid, billingSource, referalCode, promoCode, isPromo, isPackageUsed, packageid, tenantId }) {
        const billing = CustomerBillingCheckoutSingleton.getInstance(tenantId);
        // --- VALIDATION ---
        if (!patientId)
            return { success: false, message: 'No patientId provided' };
        if (branchid === undefined || branchid === null)
            return { success: false, message: 'No branchid provided' };
        if (billingSource === undefined || billingSource === null)
            return { success: false, message: 'No billingSource provided' };
        // Validate outstanding debt
        const totalOutstanding = await billing.getCustomerOutstandingDebt(patientId);
        if (totalOutstanding > 0)
            return { success: false, message: 'Outstanding debt found' };
        // Get app settings for recalculation
        const appsettings = await billing.getAppSettings();
        const { includeTax, billingsettings } = appsettings || {};
        const taxation = appsettings ? await billing.getAppBillSettings() : {};
        let recalculatedCart = [];
        let recalculatedPackageList = [];
        let usedPackage = false;
        let taxIncluded = false;
        let taxList = undefined;
        let taxValue = undefined;
        // --- PROMO CODE VALIDATION ---
        let promoDiscount = 0;
        let promoValid = false;
        let promoDetails = null;
        if (isPromo && promoCode) {
            const promoRepo = new PrimeBillingPromoCodeRepo_1.PrimeBillingPromoCodeRepo(tenantId);
            const promoResult = await promoRepo.validatePromoCode(promoCode);
            promoValid = promoResult.valid;
            promoDetails = promoResult.promo;
            if (!promoValid) {
                return { success: false, message: promoResult.reason || 'Invalid promo code', data: { promoCode } };
            }
        }
        // --- ALWAYS FETCH ORIGINAL DATA FOR TESTS/SERVICES ---
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
            const selectedTestIds = cart.map(item => item.testid);
            let allTests = [];
            if (selectedTestIds.length > 0) {
                let entityType = 'general';
                let entityId = null;
                if (referalCode) {
                    const referalRepo = await billing.getReferralByCode(referalCode);
                    if (referalRepo) {
                        entityType = referalRepo.entity_type;
                        entityId = referalRepo.entity_id;
                    }
                }
                allTests = await billing.getBillingHandler(entityType, entityId);
            }
            recalculatedCart = allTests
                .filter(test => selectedTestIds.includes(test.testid))
                .map(test => (Object.assign(Object.assign({}, test), { price: test.price, discount: test.discount || 0 })));
            if (billingsettings && billingsettings.hasNightAdjustment) {
                recalculatedCart = PrimeBillingEnterprise_1.PrimeBillingEnterprise.applyNightAdjustmentsToTests(recalculatedCart, billingsettings, 'test');
            }
            // Discount
            recalculatedCart = PrimeBillingEnterprise_1.PrimeBillingEnterprise.applyDiscountsToTests(recalculatedCart);
            // Promo
            if (isPromo && promoValid && promoCode && promoDetails) {
                recalculatedCart = PrimeBillingEnterprise_1.PrimeBillingEnterprise.applyPromoToItems(recalculatedCart, { type: promoDetails.discount_type, value: promoDetails.discount_value });
            }
            // Tax
            if (includeTax && includeTax === 1 && taxation && taxation.taxValue > 0) {
                recalculatedCart = PrimeBillingEnterprise_1.PrimeBillingEnterprise.applyTaxToTests(recalculatedCart, taxation.taxValue);
                taxIncluded = true;
                taxList = taxation;
            }
            recalculatedCart = PrimeBillingEnterprise_1.PrimeBillingEnterprise.addNightAdjustmentInfo(recalculatedCart, billingsettings);
        }
        let recalculatedServicesList = await CustomerBillingCheckoutSingleton.recalculateServicesList({
            billing,
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
        return {
            success: true,
            message: 'Checkout recalculation successful. No payment has been received yet.',
            data: {
                subtotal,
                totaldiscount,
                totalAmountIncurredDueTax,
                totalServiceAmount,
                amountPayable,
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
    static async recalculateServicesList(params) {
        return PrimeBillingEnterprise_1.PrimeBillingEnterprise.recalculateServicesList(params);
    }
}
exports.CustomerBillingCheckout = CustomerBillingCheckoutSingleton;
