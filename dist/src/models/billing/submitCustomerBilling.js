"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmitCustomerBilling = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const billing_shared_1 = require("./billing_shared");
const billingclientTypes_1 = require("./billingclientTypes");
const initCustomerBilling_1 = require("./initCustomerBilling");
class SubmitCustomerBilling {
    constructor(payload, tenantId) {
        this.payload = payload;
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(this.tenantId);
    }
    async submit() {
        const _a = this.payload, { tenantId, patientId, billingid, cart, servicesProvided, paymentDetails, branchid, billingSource, referalCode, promoCode, isPromo, isPackageUsed, packageid, amountPayable, employeeid, samplingCenter, payments, status, isConditionsUnderstood, hasNightAdjustment, promoMethod } = _a, rest = __rest(_a, ["tenantId", "patientId", "billingid", "cart", "servicesProvided", "paymentDetails", "branchid", "billingSource", "referalCode", "promoCode", "isPromo", "isPackageUsed", "packageid", "amountPayable", "employeeid", "samplingCenter", "payments", "status", "isConditionsUnderstood", "hasNightAdjustment", "promoMethod"]);
        // Step 1: Re-evaluate billing using checkout logic
        const billingInit = new initCustomerBilling_1.CustomerBillingInit(tenantId);
        const checkoutResult = await billingInit.checkoutCustomerBilling({
            patientId,
            billingid,
            cart,
            servicesList: servicesProvided,
            paymentDetails,
            branchid,
            billingSource,
            referalCode,
            promoCode,
            isPromo,
            isPackageUsed,
            packageid
        });
        if (!checkoutResult.success) {
            return { success: false, message: `Checkout validation failed: ${checkoutResult.message}` };
        }
        const data = checkoutResult.data;
        // Step 2: Compare recalculated summary fields with submitted payload (excluding 'paid')
        const summaryFields = [
            'subtotal',
            'totaldiscount',
            'totalAmountIncurredDueTax',
            'totalServiceAmount',
            'amountPayable',
        ];
        for (const field of summaryFields) {
            if (typeof data[field] === 'number' &&
                typeof this.payload[field] === 'number' &&
                Math.abs(data[field] - this.payload[field]) > 0.01) {
                return { success: false, message: `Submitted ${field} (${this.payload[field]}) does not match recalculated value (${data[field]}).` };
            }
        }
        const isValid = await SubmitCustomerBilling.validateBillingRequestBody(this.payload, tenantId);
        if (isValid !== true) {
            return { success: false, message: `Validation failed: ${isValid}` };
        }
        let updatedBillingData = this.payload;
        if (updatedBillingData.isPackageUsed && !updatedBillingData.packageid) {
            updatedBillingData.cart = checkoutResult.data.packageTestList;
        }
        const conn = await this.connection;
        const trx = await conn.transaction();
        // Generate billing ID inside transaction
        const billingID = await billing_shared_1.BillingSharedRepo.generateBillingID(this.payload.patientid, this.tenantId, trx);
        await SubmitCustomerBilling.processTestCartWithoutRecalculation(updatedBillingData, billingID, updatedBillingData.taxValue, trx);
    }
    static async validateBillingRequestBody(billingData, tenantId) {
        const { cart, servicesProvided, employeeid, paymentmode, branchid, isPromo, promo, billingSource, patientId, entityId, amountPayable, paid, payments } = billingData;
        if (!Array.isArray(cart) || !Array.isArray(servicesProvided)) {
            return "Cart and servicesProvided must be arrays.";
        }
        if (cart.length === 0 && servicesProvided.length === 0) {
            return "Both cart and servicesProvided cannot be empty.";
        }
        if (!employeeid || typeof employeeid !== "number") {
            return "Invalid or missing employeeid.";
        }
        if (!branchid || typeof branchid !== "number") {
            return "Missing or invalid samplingCenter (branch id).";
        }
        if (typeof amountPayable !== "number" || typeof paid !== "number") {
            return "Amount payable and paid must be numbers.";
        }
        if (!patientId || typeof patientId !== "number") {
            return "Missing or invalid patientId.";
        }
        if (!(await billing_shared_1.BillingSharedRepo.checkPatientIdExist(patientId, tenantId))) {
            return "Patient does not exist.";
        }
        if (isPromo && (!promo || !promo.code)) {
            return "Promo code is required when isPromo is true.";
        }
        // Validate payments array and each payment's paymentmode
        if (payments && Array.isArray(payments)) {
            for (const payment of payments) {
                if (!payment.mode || !(await billing_shared_1.BillingSharedRepo.validatePaymentModeId(parseInt(payment.mode.toString(), 10), tenantId))) {
                    return "Invalid payment mode in payments array.";
                }
            }
        }
        return true;
    }
    static async processTestCartWithoutRecalculation(billingData, billingID, taxValue, taxList) {
        let entityType = "general";
        let entityId = 0;
        let organizationId = null;
        let clinicianId = null;
        let insuranceId = null;
        let registrationType = "self";
        if (billingData.billingSource > 1 && billingData.entityId) {
            entityId = parseInt(billingData.entityId.toString());
            switch (billingData.billingSource) {
                case 2:
                    entityType = "organization";
                    organizationId = entityId;
                    registrationType = "organization";
                    break;
                case 4:
                    entityType = "insurance";
                    insuranceId = entityId;
                    registrationType = "insurance";
                    break;
                case 3:
                    entityType = "insurance";
                    insuranceId = entityId;
                    registrationType = "self";
                    break;
                case 6:
                    entityType = "clinician";
                    clinicianId = entityId;
                    registrationType = "clinician";
                    break;
                default:
                    registrationType = "self";
            }
        }
        else if (!billingData.billingSource || billingData.billingSource === 0) {
            registrationType = "self";
        }
        const result = await Promise.all(billingData.cart.map(async (item) => {
            return {
                billingid: billingID,
                trackId: item.testid,
                cost: item.discountedValue,
                employeeid: billingData.employeeid,
                serviceCategory: billingclientTypes_1.serviceCategory[billingData.billingSource],
                categoryTrackId: billingData.billingSource,
                clinicianId,
                organizationId,
                registrationType,
                branchid: billingData.samplingCenter,
                isoutsourced: item.isoutsourced === 1 ? 1 : 0,
                outsourceid: item.outsourceid || null,
                serviceAddedOn: new Date(),
                taxList: typeof taxList === "string" ? taxList : null,
                taxValue,
                amountIncurredDueTax: item.amountIncurredDueTax,
                taxIncluded: billingData.taxIncluded,
                discount: item.discount,
                totalcost: item.totalcost,
                totalpayable: item.discountedValue || item.totalpayable,
                isNHIS: billingData.billingSource === 4 ? 1 : 0,
                isPHIS: billingData.billingSource === 3 ? 1 : 0,
                insuranceid: insuranceId,
                claimCode: null,
                hasNightAdjustment: item.hasNightAdjustment,
                nightAdjustmentMode: item.nightAdjustmentMode,
                nightAdjustmentValue: item.nightAdjustmentValue || 0,
                isPackageUsed: billingData.isPackageUsed ? 1 : 0,
                packageid: billingData.packageid || null
            };
        }));
        console.log(result);
        return result;
    }
}
exports.SubmitCustomerBilling = SubmitCustomerBilling;
