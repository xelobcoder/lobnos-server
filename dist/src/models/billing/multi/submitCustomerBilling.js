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
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const billing_shared_1 = require("../billing_shared");
const billing_shared_types_1 = require("./billing_shared_types");
const billingclientTypes_1 = require("../billingclientTypes");
const customerBillingCheckout_1 = require("./customerBillingCheckout");
const PrimeBillingPromoCodeRepo_1 = require("../repositories/PrimeBillingPromoCodeRepo");
const appLevelTriggers_1 = require("../../../database/appLevelTriggers");
class SubmitCustomerBilling {
    constructor(payload, tenantId) {
        this.payload = payload;
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(this.tenantId);
    }
    async submit() {
        let trx;
        try {
            const _a = this.payload, { tenantId, patientId, billingid, cart, servicesProvided, paymentDetails, branchid, billingSource, referalCode, promoCode, isPromo, isPackageUsed, packageid, amountPayable, employeeid, samplingCenter, payments, status, entitytype, entityId, entityid, isConditionsUnderstood, hasNightAdjustment, promoMethod } = _a, rest = __rest(_a, ["tenantId", "patientId", "billingid", "cart", "servicesProvided", "paymentDetails", "branchid", "billingSource", "referalCode", "promoCode", "isPromo", "isPackageUsed", "packageid", "amountPayable", "employeeid", "samplingCenter", "payments", "status", "entitytype", "entityId", "entityid", "isConditionsUnderstood", "hasNightAdjustment", "promoMethod"]);
            const checkoutResult = await customerBillingCheckout_1.CustomerBillingCheckout.checkoutCustomerBilling({
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
                packageid,
                entityid,
                entitytype,
                employeeid,
                tenantId
            });
            if (typeof checkoutResult === 'string' || Array.isArray(checkoutResult)) {
                return { status: false, message: `Checkout validation failed: ${checkoutResult}` };
            }
            const data = checkoutResult.data;
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
                    return { status: false, message: `Submitted ${field} (${this.payload[field]}) does not match recalculated value (${data[field]}).` };
                }
            }
            let updatedBillingData = this.payload;
            if (updatedBillingData.isPackageUsed && !updatedBillingData.packageid) {
                updatedBillingData.cart = data.packageTestList;
            }
            const conn = await this.connection;
            trx = await conn.transaction();
            const billingID = await billing_shared_1.BillingSharedRepo.generateBillingID(this.payload.patientid, this.tenantId, this.payload.branchid, this.payload.employeeid, trx);
            const computeAdjustmentTotals = (items) => {
                let discountTotal = 0;
                let surchargeTotal = 0;
                if (!Array.isArray(items))
                    return { discountTotal, surchargeTotal };
                for (const item of items) {
                    const adjType = typeof (item === null || item === void 0 ? void 0 : item.userAdjustmentType) === 'string' ? item.userAdjustmentType.toLowerCase() : item === null || item === void 0 ? void 0 : item.userAdjustmentType;
                    const adjValue = Math.abs(Number((item === null || item === void 0 ? void 0 : item.userAdjustedValue) || 0));
                    if (adjType === 'discount' && adjValue > 0) {
                        discountTotal += adjValue;
                        continue;
                    }
                    if (adjType === 'surcharge' && adjValue > 0) {
                        surchargeTotal += adjValue;
                        continue;
                    }
                    const promoDiscount = Number((item === null || item === void 0 ? void 0 : item.promoDiscount) || 0);
                    if (promoDiscount > 0)
                        continue;
                    const itemDiscount = Math.abs(Number((item === null || item === void 0 ? void 0 : item.discount) || 0));
                    if (itemDiscount > 0) {
                        discountTotal += itemDiscount;
                    }
                }
                return { discountTotal, surchargeTotal };
            };
            const adjustmentItems = [
                ...(Array.isArray(data.cart) ? data.cart : []),
                ...(Array.isArray(data.servicesList) ? data.servicesList : []),
                ...(Array.isArray(data.packageTestList) ? data.packageTestList : [])
            ];
            const computedAdjustments = computeAdjustmentTotals(adjustmentItems);
            const totalDiscountFromCheckout = !data.isPromo && typeof data.totaldiscount === 'number' ? data.totaldiscount : 0;
            const totalSurchargeFromCheckout = typeof data.totalsurcharge === 'number' ? data.totalsurcharge : 0;
            const effectiveDiscountTotal = Math.max(Number(totalDiscountFromCheckout || 0), Number(computedAdjustments.discountTotal || 0));
            const effectiveSurchargeTotal = Math.max(Number(totalSurchargeFromCheckout || 0), Number(computedAdjustments.surchargeTotal || 0));
            await billing_shared_1.DiscountLimitService.enforceAndRecord({
                tenantId: this.tenantId,
                trx,
                employeeid: this.payload.employeeid,
                billingid: billingID,
                subtotal: typeof data.subtotal === 'number' ? data.subtotal : undefined,
                payable: typeof data.amountPayable === 'number' ? data.amountPayable : undefined,
                discountTotal: effectiveDiscountTotal || 0,
                surchargeTotal: effectiveSurchargeTotal || 0,
                branchid: updatedBillingData.branchid
            });
            const taxValue = updatedBillingData.taxValue || 0;
            const taxList = updatedBillingData.taxList || null;
            const taxIncluded = updatedBillingData.taxIncluded || false;
            const processTestCart = await SubmitCustomerBilling.processTestCartWithoutRecalculation(updatedBillingData, billingID, taxValue, taxIncluded, taxList);
            const processNonTestServices = await SubmitCustomerBilling.processNonTestServices(updatedBillingData, updatedBillingData.servicesProvided, billingID, taxValue, taxList);
            const allEntries = [...processNonTestServices, ...processTestCart];
            const Multi = new billing_shared_1.BillingSharedRepo();
            if (allEntries.length > 0) {
                const loadAllServicesInsertionErrors = await Multi
                    .mapAndInsertServices(this.tenantId, allEntries, billingID, trx);
                if (loadAllServicesInsertionErrors.length > 0) {
                    throw new Error(billing_shared_types_1.BillErrors.UnableToLoadServices);
                }
                const totalcost = data.totalcost;
                const totalservicesAmount = data.totalServiceAmountPayable;
                const totalAmountPayable = data.amountPayable;
                const testPayableAmount = data.testPayableAmount || 0;
                const totaldiscount = data.totaldiscount || 0;
                const totalAmountIncurredDueTax = data.totalAmountIncurredDueTax;
                const totalOutstanding = amountPayable > this.payload.paid ? amountPayable - this.payload.paid : 0;
                const balance = totalOutstanding > 0 ? 0 : this.payload.paid - totalAmountPayable;
                const updateData = {
                    totalTransactionCost: totalcost,
                    totalcost: totalcost,
                    totalServiceAmountPayable: totalservicesAmount,
                    amountPayable: totalAmountPayable,
                    testPayableAmount: testPayableAmount,
                    totaldiscount: totaldiscount,
                    totalAmountIncurredDueTax: totalAmountIncurredDueTax,
                    outstanding: totalOutstanding,
                    paid: updatedBillingData.paid,
                    balance: balance,
                    totalrefunded: 0,
                    isPromo: data.isPromo || false,
                    promoValue: data.promoValue || 0,
                    promoMethod: data.promoMethod || promoMethod,
                    promoCodeId: data.promoCodeId || promoCode,
                };
                const result = await trx("billing")
                    .where("billingid", billingID)
                    .update({
                    billingid: billingID,
                    patientid: updatedBillingData.patientId,
                    totalcost: updateData.totalcost,
                    totalTransactionCost: updateData.totalTransactionCost,
                    totalrefunded: updateData.totalrefunded,
                    discount: updateData.totaldiscount,
                    paid: this.payload.paid,
                    payable: updateData.amountPayable,
                    outstanding: updateData.outstanding,
                    balance: updateData.balance,
                    clientstatus: status || "normal",
                    amountIncurredDueTax: updateData.totalAmountIncurredDueTax,
                    branchid: updatedBillingData.branchid,
                    isPromo: updateData.isPromo,
                    promoValue: updateData.promoValue,
                    promoMethod: updateData.promoMethod,
                    promoCodeId: updateData.promoCodeId,
                });
                if (!result)
                    throw new Error("unable to update billing record");
                if (data.isPromo && data.promoCode && data.promoDetails.id) {
                    const promoRepo = new PrimeBillingPromoCodeRepo_1.PrimeBillingPromoCodeRepo(this.tenantId);
                    await promoRepo.incrementUsage(data.promoDetails.id, trx);
                }
                const paymentsArr = Array.isArray(this.payload.payments) ? this.payload.payments : [];
                if (Array.isArray(paymentsArr) && paymentsArr.length > 0) {
                    for (const payment of paymentsArr) {
                        const paymentMode = payment.mode;
                        const paymentAmount = payment.amount;
                        const employeeId = payment.employeeid || this.payload.employeeid;
                        if (!paymentMode || !employeeId) {
                            throw new Error("Missing mode or employeeid in payment record.");
                        }
                        await billing_shared_1.BillingSharedRepo.insertBillHistory(this.tenantId, trx, billingID, paymentMode, paymentAmount, employeeId, "credit");
                    }
                }
                await trx.commit();
            }
            return { status: true, message: "Billing submitted successfully", billingid: billingID };
        }
        catch (error) {
            if (trx) {
                try {
                    await trx.rollback();
                }
                catch (_b) {
                    // ignore rollback errors
                }
            }
            console.log("Error in submitCustomerBilling:", error);
            return { status: false, message: error && error.message ? error.message : "Unknown error in billing submission" };
        }
    }
    static async validateBillingRequestBody(billingData, tenantId) {
        const { cart, servicesProvided, employeeid, branchid, isPromo, promo, patientId, amountPayable, paid, payments } = billingData;
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
        if (payments && Array.isArray(payments)) {
            for (const payment of payments) {
                if (!payment.mode || !(await billing_shared_1.BillingSharedRepo.validatePaymentModeId(parseInt(payment.mode.toString(), 10), tenantId))) {
                    return "Invalid payment mode in payments array.";
                }
            }
        }
        return true;
    }
    static async processTestCartWithoutRecalculation(billingData, billingID, taxValue, taxIncluded, taxList = null) {
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
                cost: item.actualPrice,
                employeeid: billingData.employeeid,
                serviceCategory: billingclientTypes_1.serviceCategory[billingData.billingSource],
                categoryTrackId: billingData.billingSource,
                clinicianId,
                organizationId,
                registrationType,
                branchid: billingData.branchid,
                isoutsourced: item.isoutsourced === 1 ? 1 : 0,
                outsourceid: item.outsourceid || null,
                serviceAddedOn: new Date(),
                taxList: typeof taxList === "string" ? taxList : null,
                taxValue,
                amountIncurredDueTax: item.amountIncurredDueTax,
                taxIncluded: taxIncluded == true ? 1 : 0,
                discount: item.discount,
                totalcost: item.totalcost,
                totalpayable: item.totalpayable,
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
        return result;
    }
    static async processNonTestServices(billingData, servicesProvided, billingID, taxValue, taxList) {
        let organizationId = null;
        let clinicianId = null;
        let insuranceId = null;
        let registrationType = "self";
        const entityId = billingData.entityId ? parseInt(billingData.entityId.toString()) : null;
        switch (billingData.billingSource) {
            case 2:
                organizationId = entityId;
                registrationType = "organization";
                break;
            case 3:
            case 4:
                insuranceId = entityId;
                registrationType = "insurance";
                break;
            case 6:
                clinicianId = entityId;
                registrationType = "clinician";
                break;
        }
        const { employeeid, branchid, taxIncluded, billingSource, isPackageUsed } = billingData;
        return await Promise.all(servicesProvided
            .map(async (item) => {
            return {
                billingid: billingID,
                trackId: item.keyid,
                cost: item.servicePrice,
                employeeid,
                serviceCategory: billingclientTypes_1.serviceCategory[5],
                categoryTrackId: 5,
                clinicianId,
                organizationId,
                registrationType,
                branchid,
                isoutsourced: 0,
                outsourceid: 0,
                serviceAddedOn: new Date(),
                taxList,
                taxValue,
                amountIncurredDueTax: item.amountIncurredDueTax,
                taxIncluded,
                discount: item.discount,
                totalcost: item.totalcost,
                totalpayable: item.totalpayable,
                isNHIS: billingSource === 4 ? 1 : 0,
                isPHIS: billingSource === 3 ? 1 : 0,
                insuranceid: insuranceId || null,
                claimCode: null,
                hasNightAdjustment: item.isNightTime,
                nightAdjustmentMode: item.nightAdjustmentMode,
                nightAdjustmentValue: item.nightAdjustmentValue,
                isPackageUsed: isPackageUsed ? 1 : 0,
                packageid: item.packageid || null,
            };
        }));
    }
    async loadMultipleServices(services, billingid, tenantId, trx) {
        const insertionErrors = [];
        const queryRunner = trx || await (0, KnexConnections_1.default)(tenantId);
        for (const item of services) {
            try {
                const [billingid, trackId, cost, employeeid, serviceCategory, categoryTrackId, clinicianId, organizationId, registrationType, branchid, isoutsourced, outsourceid, serviceAddedOn, taxList, taxValue, amountIncurredDueTax, taxIncluded, discount, totalcost, totalpayable, isNHIS, isPHIS, insuranceid, claimCode, hasNightAdjustment, nightAdjustmentMode, nightAdjustmentValue, isPackageUsed, packageid] = item;
                const outcome = await queryRunner("dboservices").insert({
                    billingid,
                    trackId,
                    cost,
                    employeeid,
                    serviceCategory,
                    categoryTrackId,
                    clinicianId,
                    organizationId,
                    registrationType,
                    branchid,
                    isoutsourced,
                    outsourceid,
                    serviceAddedOn,
                    taxList,
                    taxValue,
                    amountIncurredDueTax,
                    taxIncluded,
                    discount,
                    totalcost,
                    totalpayable,
                    isNHIS,
                    isPHIS,
                    insuranceid,
                    claimCode,
                    hasNightAdjustment,
                    nightAdjustmentMode,
                    nightAdjustmentValue,
                    isPackageUsed,
                    packageid
                });
                const serviceid = typeof outcome === "number"
                    ? outcome
                    : Array.isArray(outcome)
                        ? outcome[0]
                        : outcome === null || outcome === void 0 ? void 0 : outcome.serviceid;
                if (serviceid && typeof serviceid === "number") {
                    await (0, appLevelTriggers_1.applyDboservicesAfterInsert)(queryRunner, {
                        serviceid,
                        billingid,
                        trackId,
                        cost,
                        employeeid,
                        serviceCategory,
                        categoryTrackId,
                        clinicianId,
                        organizationId,
                        registrationType,
                        branchid,
                        isoutsourced,
                        outsourceid,
                        serviceAddedOn,
                        taxList,
                        taxValue,
                        amountIncurredDueTax,
                        taxIncluded,
                        discount,
                        totalcost,
                        totalpayable,
                        isNHIS,
                        isPHIS,
                        insuranceid,
                        claimCode,
                        hasNightAdjustment,
                        nightAdjustmentMode,
                        nightAdjustmentValue,
                        isPackageUsed,
                        packageid
                    }, employeeid ? employeeid.toString() : undefined);
                }
                if (serviceid && item[5] != 5 && item[1]) {
                    try {
                        await billing_shared_1.BillingSharedRepo.AddtoTestAscenstion(tenantId, serviceid, billingid, item[1], queryRunner);
                    }
                    catch (err) {
                        throw new Error(billingclientTypes_1.billErrors.unableToLoadTestAscension);
                    }
                }
            }
            catch (err) {
                insertionErrors.push(err);
            }
        }
        return insertionErrors;
    }
    async mapAndInsertServices(tenantId, allEntries, billingid, trx) {
        try {
            const servicesMap = allEntries.map((service) => {
                return [
                    service.billingid,
                    service.trackId,
                    service.cost,
                    service.employeeid,
                    service.serviceCategory,
                    service.categoryTrackId,
                    service.clinicianId,
                    service.organizationId,
                    service.registrationType,
                    service.branchid,
                    service.isoutsourced || 0,
                    service.outsourceid || null,
                    service.serviceAddedOn,
                    service.taxList,
                    service.taxValue,
                    service.amountIncurredDueTax,
                    service.taxIncluded,
                    service.discount,
                    service.totalcost,
                    service.totalpayable,
                    service.isNHIS,
                    service.isPHIS,
                    service.insuranceid,
                    service.claimCode,
                    service.hasNightAdjustment,
                    service.nightAdjustmentMode,
                    service.nightAdjustmentValue,
                    service.isPackageUsed,
                    service.packageid
                ];
            });
            const loadAllServices = await this.loadMultipleServices(servicesMap, billingid, tenantId, trx);
            return loadAllServices;
        }
        catch (err) {
            console.log('Error Loading services ');
            throw err;
        }
    }
}
exports.SubmitCustomerBilling = SubmitCustomerBilling;
