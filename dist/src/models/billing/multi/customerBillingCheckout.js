"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerBillingCheckout = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const billing_1 = require("../billing");
const billingclientTypes_1 = require("../billingclientTypes");
const PrimeBillingPromoCodeRepo_1 = require("../repositories/PrimeBillingPromoCodeRepo");
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
    async handleCheckout({ patientId, billingid, cart, servicesList, paymentDetails, branchid, billingSource, referalCode, promoCode, ispricingcheckout, isPromo, isPackageUsed, packageid, entitytype, entityid, tenantId }) {
        if (!patientId && !ispricingcheckout)
            return { success: false, message: 'No patientId provided' };
        if (branchid === undefined || branchid === null)
            return { success: false, message: 'No branchid provided' };
        if (billingSource === undefined || billingSource === null)
            return { success: false, message: 'No billingSource provided' };
        let previousBilling = null;
        let previousServices = null;
        if (billingid) {
            const conn = await this.connection;
            previousBilling = await this.previousBillingSummary(billingid);
            previousServices = await conn('dboservices').where('billingid', billingid).select();
        }
        let totalOutstanding = 0;
        if (!ispricingcheckout) {
            totalOutstanding = await this.getCustomerOutstandingDebt(patientId);
            if (totalOutstanding > 0)
                return { success: false, message: 'Outstanding debt found' };
        }
        const appsettings = await this.getAppSettings();
        const { includeTax, billingsettings } = appsettings || {};
        const taxation = appsettings ? await this.getAppBillSettings() : {};
        let recalculatedCart = [];
        let recalculatedPackageList = [];
        let usedPackage = false;
        let taxIncluded = false;
        let taxList = undefined;
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
                tenantId,
                packageid
            });
            if (!pkgResult.success)
                return { success: false, message: pkgResult.message };
            recalculatedPackageList = pkgResult.recalculatedPackageList || [];
            usedPackage = true;
        }
        else {
            recalculatedCart = await this.getRecalculatedCart(cart, referalCode, billingsettings, isPromo, promoValid, promoCode, promoDetails, includeTax, taxation, entitytype, entityid);
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
            taxation,
            entityid,
            entitytype
        });
        const { subtotal, totaldiscount, totalpayable, totalAmountIncurredDueTax, totalServiceAmount } = PrimeBillingEnterprise_1.PrimeBillingEnterprise.calculateBillingTotals({
            usedPackage,
            recalculatedPackageList,
            recalculatedCart,
            recalculatedServicesList
        });
        const toFixed2 = (num) => {
            if (typeof num !== 'number' || isNaN(num))
                return 0;
            const fixed = Number(num.toFixed(2));
            return isNaN(fixed) ? 0 : fixed;
        };
        const paid = toFixed2(paymentDetails && paymentDetails.amount ? paymentDetails.amount : 0);
        const totalTestAmountPayable = toFixed2(recalculatedCart.reduce((sum, item) => sum + (item.totalpayable || 0), 0));
        const totalServiceAmountPayable = toFixed2(recalculatedServicesList.reduce((sum, item) => sum + (item.totalpayable || 0), 0));
        console.log(recalculatedCart);
        const amountPayable = toFixed2(totalpayable);
        const outstanding = toFixed2(amountPayable - paid);
        const balance = paid > amountPayable ? toFixed2(paid - amountPayable) : 0;
        if (balance < 0) {
            return { success: false, message: 'Paid amount exceeds total payable amount', data: { balance } };
        }
        return {
            success: true,
            message: 'Checkout recalculation successful. No payment has been received yet.',
            data: {
                subtotal: toFixed2(subtotal),
                totalcost: amountPayable,
                totaldiscount: toFixed2(totaldiscount),
                totalAmountIncurredDueTax: toFixed2(totalAmountIncurredDueTax),
                totalServiceAmount: toFixed2(totalServiceAmount),
                amountPayable,
                outstanding,
                totalTestAmountPayable,
                totalServiceAmountPayable,
                paid,
                balance,
                cart: recalculatedCart.map(item => (Object.assign(Object.assign({}, item), { totalpayable: toFixed2(item.totalpayable), totalcost: toFixed2(item.totalcost), discountedValue: toFixed2(item.discountedValue), amountIncurredDueTax: toFixed2(item.amountIncurredDueTax), price: toFixed2(item.price), actualPrice: toFixed2(item.actualPrice), originalPrice: toFixed2(item.originalPrice), entitytype: item.entitytype || entitytype, entityId: item.entityId || entityid }))),
                servicesList: recalculatedServicesList.map(item => (Object.assign(Object.assign({}, item), { totalpayable: toFixed2(item.totalpayable), totalcost: toFixed2(item.totalcost), discountedValue: toFixed2(item.discountedValue), amountIncurredDueTax: toFixed2(item.amountIncurredDueTax), servicePrice: toFixed2(item.servicePrice), entitytype: item.entitytype || entitytype, entityId: item.entityId || entityid }))),
                promoCode: promoCode || undefined,
                promoDiscount: toFixed2(promoDiscount),
                isPromo: !!isPromo,
                isPackageUsed: !!isPackageUsed,
                packageid: packageid || undefined,
                packageTestList: usedPackage ? recalculatedPackageList : undefined,
                promoDetails: promoValid ? promoDetails : undefined,
                paymentStatus: 'pending',
                paymentReceived: false,
                taxIncluded,
                taxList,
                entitytype,
                entityId: entityid,
                ispricingcheckout,
                entityid,
                previousBilling,
                previousServices
            }
        };
    }
    async getRecalculatedCart(cart, referalCode, billingsettings, isPromo, promoValid, promoCode, promoDetails, includeTax, taxation, entitytype, entityId) {
        const selectedTestIds = cart.map((item) => item.testid);
        let allTests = [];
        if (selectedTestIds.length > 0) {
            let entityType = entitytype || 'general';
            let entityIdValue = entityId || null;
            if (referalCode) {
                const referalRepo = await this.getReferralByCode(referalCode);
                if (referalRepo) {
                    entityType = referalRepo.entity_type;
                    entityIdValue = referalRepo.entity_id;
                }
            }
            allTests = await this.getBillingHandler(entityType, entityIdValue);
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
        if (isPromo && promoValid && promoCode && promoDetails) {
            recalculatedCart = PrimeBillingEnterprise_1.PrimeBillingEnterprise.applyPromoToItems(recalculatedCart, { type: promoDetails.discount_type, value: promoDetails.discount_value });
        }
        else {
            recalculatedCart = PrimeBillingEnterprise_1.PrimeBillingEnterprise.applyDiscountsToTests(recalculatedCart);
        }
        if (includeTax && includeTax === 1 && taxation && taxation.taxValue > 0) {
            recalculatedCart = PrimeBillingEnterprise_1.PrimeBillingEnterprise.applyTaxToTests(recalculatedCart, taxation.taxValue);
        }
        else {
            recalculatedCart = PrimeBillingEnterprise_1.PrimeBillingEnterprise.applyTaxToTests(recalculatedCart, 0);
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
    static determineBillingSourceUsingEntityType(entity_type) {
        switch (entity_type) {
            case 'general':
                return 1;
            case 'clinician':
                return 6;
            case 'organization':
                return 2;
            case 'phis':
                return 3;
            case 'insurance':
                return 4;
            default:
                return null;
        }
    }
    static async correctRefererErrorPostRegistration(tenantId, employeeId, entity_type, entity_id, billingid, branchid) {
        if (!entity_type || !entity_id)
            return { success: false, message: 'No entity_type or entity_id provided' };
        if (billingid === undefined || billingid === null)
            return { success: false, message: 'No billingid provided' };
        const isBillingIdValid = await billing_1.Billing.checkValidityOfBillingid(tenantId, billingid);
        if (!isBillingIdValid)
            return { success: false, message: 'Invalid billingid provided' };
        if (branchid === undefined || branchid === null)
            return { success: false, message: 'No branchid provided' };
        const billingSource = this.determineBillingSourceUsingEntityType(entity_type);
        if (billingSource === undefined || billingSource === null)
            return { success: false, message: 'No billingSource provided' };
        const conn = await (0, KnexConnections_1.default)(tenantId);
        const transaction = await conn.transaction();
        try {
            const transactionServices = await transaction('dboservices')
                .where('billingid', billingid);
            if (transactionServices.length === 0) {
                await transaction.rollback();
                return { success: false, message: 'No services found for the provided billingid' };
            }
            for (const service of transactionServices) {
                await transaction('dboservices')
                    .where('billingid', service.serviceid)
                    .update({
                    serviceCategory: billingclientTypes_1.serviceCategory[billingSource],
                    trackid: entity_id,
                    clinicianId: billingSource === 6 ? entity_id : null,
                    organizationId: billingSource === 2 ? entity_id : null,
                    categoryTrackId: entity_id,
                    isNHIS: billingSource === 4 ? 1 : 0,
                    isPHIS: billingSource === 3 ? 1 : 0,
                    insuranceid: billingSource === 4 || billingSource === 3 ? entity_id : null,
                    isLocked: 1,
                    isCorrected: 1,
                });
            }
            await transaction('billing')
                .where('billingid', billingid)
                .update({
                adjustmentType: 'referer-error',
                adjustmentReason: 'Referer error correction',
                adjustmentdate: new Date(),
                isAdjustment: 1,
                islocked: 1,
                adjustedBy: employeeId,
            });
            await transaction.commit();
            return { success: true, message: 'Referer error correction successful', data: { billingid, billingSource } };
        }
        catch (error) {
            await transaction.rollback();
            return { success: false, message: error.message || 'Transaction failed' };
        }
    }
}
exports.CustomerBillingCheckout = CustomerBillingCheckoutSingleton;
