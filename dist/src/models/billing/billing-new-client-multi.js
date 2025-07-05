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
const billing_shared_types_1 = require("./multi/billing_shared_types");
const billingclientTypes_1 = require("./billingclientTypes");
const PrimeBillingPromoCodeRepo_1 = require("./repositories/PrimeBillingPromoCodeRepo");
const customerBillingCheckout_1 = require("./multi/customerBillingCheckout");
const correctionalUtil_1 = require("./correctionalUtil");
class SubmitCustomerBilling {
    constructor(payload, tenantId) {
        this.payload = payload;
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(this.tenantId);
    }
    async submit() {
        try {
            const _a = this.payload, { tenantId, patientId, billingid, cart, servicesProvided, paymentDetails, branchid, billingSource, referalCode, promoCode, isPromo, writeOffOutstanding, isPackageUsed, packageid, amountPayable, employeeid, samplingCenter, isAdjustment, adjustmentdate, adjustmentType, adjustmentReason, payments, status, entitytype, entityId, entityid, isConditionsUnderstood, hasNightAdjustment, promoMethod } = _a, rest = __rest(_a, ["tenantId", "patientId", "billingid", "cart", "servicesProvided", "paymentDetails", "branchid", "billingSource", "referalCode", "promoCode", "isPromo", "writeOffOutstanding", "isPackageUsed", "packageid", "amountPayable", "employeeid", "samplingCenter", "isAdjustment", "adjustmentdate", "adjustmentType", "adjustmentReason", "payments", "status", "entitytype", "entityId", "entityid", "isConditionsUnderstood", "hasNightAdjustment", "promoMethod"]);
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
                tenantId
            });
            if (checkoutResult.success == false) {
                return { status: false, message: `Checkout validation failed: ${checkoutResult.message}` };
            }
            let previousBillingSummary = null;
            const excessAction = this.payload.excessAction;
            let currentAmountPayable = 0;
            let previousPaidAmount = 0;
            let outstandingBtnPreviousPaidAndCurenntPayable = 0;
            let isExcessAmount = false;
            let currentPaymentMade = 0;
            let totalPaymentMade = 0;
            if (this.payload.billingid && isAdjustment == 1 && adjustmentType === "correction" && checkoutResult) {
                previousBillingSummary = checkoutResult.data.previousBilling;
                const { newPayments, totalPaid, currentPayable, outstandingToWriteOff, isExcess, previousPaid } = (0, correctionalUtil_1.calculateCorrectionalAdjustment)({
                    previousRecordsSummary: previousBillingSummary,
                    amountPayable: checkoutResult.data.amountPayable, payments: this.payload.payments
                });
                totalPaymentMade = totalPaid;
                currentAmountPayable = currentPayable;
                totalPaymentMade = totalPaid;
                previousPaidAmount = previousPaid;
                isExcessAmount = isExcess;
                outstandingBtnPreviousPaidAndCurenntPayable = outstandingToWriteOff;
                currentPaymentMade = newPayments;
            }
            let hasRelatedBilling = false;
            if (this.payload.billingid) {
                const isBillingIdValid = await billing_shared_1.BillingSharedRepo.checkValidityOfBillingID(this.payload.billingid, this.tenantId);
                if (!isBillingIdValid)
                    return { status: false, message: billingclientTypes_1.billErrors.NoValidBilling };
                hasRelatedBilling = true;
            }
            if (hasRelatedBilling) {
                const canAdjust = await billing_shared_1.BillingSharedRepo.canAdjustBilling(this.payload.billingid, this.tenantId);
                if (!canAdjust.status) {
                    return { status: false, message: canAdjust.message };
                }
            }
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
                if (typeof data[field] === 'number' && typeof this.payload[field] === 'number' && Math.abs(data[field] - this.payload[field]) > 0.01) {
                    return { status: false, message: `Submitted ${field} (${this.payload[field]}) does not match recalculated value (${data[field]}).` };
                }
            }
            let updatedBillingData = this.payload;
            if (updatedBillingData.isPackageUsed && !updatedBillingData.packageid) {
                updatedBillingData.cart = data.packageTestList;
            }
            const conn = await this.connection;
            const trx = await conn.transaction();
            const billingID = await billing_shared_1.BillingSharedRepo.generateBillingID(this.payload.patientid, this.tenantId, trx);
            const taxValue = updatedBillingData.taxValue || 0;
            const taxList = updatedBillingData.taxList || null;
            const taxIncluded = updatedBillingData.taxIncluded || false;
            const processTestCart = await SubmitCustomerBilling.processTestCartWithoutRecalculation(updatedBillingData, billingID, taxValue, taxIncluded, taxList);
            const processNonTestServices = await SubmitCustomerBilling.processNonTestServices(updatedBillingData, updatedBillingData.servicesProvided, billingID, taxValue, taxList);
            const allEntries = [...processNonTestServices, ...processTestCart];
            const Multi = new billing_shared_1.BillingSharedRepo();
            if (allEntries.length > 0) {
                const loadAllServices = await Multi
                    .mapAndInsertServices(this.tenantId, allEntries, billingID, trx);
                if (loadAllServices.length > 0) {
                    throw new Error(billing_shared_types_1.BillErrors.UnableToLoadServices);
                }
                let totalcost = 0;
                let totalservicesAmount = 0;
                let totalAmountPayable = 0;
                let testPayableAmount = 0;
                let totaldiscount = 0;
                let totalAmountIncurredDueTax = 0;
                let totalOutstanding = 0;
                let balance = 0;
                let writeOffAmount = 0;
                let overallPaymentsMade = updatedBillingData.paid;
                let status = 'pending';
                testPayableAmount = data.testPayableAmount || 0;
                totalcost = data.totalcost;
                totalservicesAmount = data.totalServiceAmountPayable;
                totaldiscount = data.totaldiscount || 0;
                totalAmountIncurredDueTax = data.totalAmountIncurredDueTax;
                if (this.payload.isAdjustment == 1 && this.payload.adjustmentType === "correction") {
                    totalAmountPayable = Number(currentAmountPayable.toFixed(2));
                    if (isExcessAmount && this.payload.writeOffOutstanding) {
                        totalOutstanding = 0;
                        writeOffAmount = Number(outstandingBtnPreviousPaidAndCurenntPayable.toFixed(2));
                    }
                    else {
                        totalOutstanding = Number(outstandingBtnPreviousPaidAndCurenntPayable.toFixed(2));
                        writeOffAmount = 0;
                    }
                    overallPaymentsMade = totalPaymentMade;
                    balance = totalPaymentMade > totalAmountPayable ? 0 : Number((totalAmountPayable - totalPaymentMade).toFixed(2));
                }
                else {
                    totalAmountPayable = Number(data.amountPayable ? Number(data.amountPayable).toFixed(2) : 0);
                    totalOutstanding = Number((amountPayable - this.payload.paid).toFixed(2));
                    balance = this.payload.paid > totalAmountPayable ? 0 : Number((totalAmountPayable - this.payload.paid).toFixed(2));
                }
                const updateData = {
                    totalTransactionCost: totalcost,
                    totalcost: totalcost,
                    totalServiceAmountPayable: totalservicesAmount,
                    amountPayable: totalAmountPayable,
                    testPayableAmount: testPayableAmount,
                    totaldiscount: totaldiscount,
                    totalAmountIncurredDueTax: totalAmountIncurredDueTax,
                    outstanding: totalOutstanding,
                    paid: overallPaymentsMade,
                    balance: balance,
                    status,
                    totalrefunded: 0,
                    isPromo: data.isPromo || false,
                    promoValue: data.promoValue || 0,
                    promoMethod: data.promoMethod || promoMethod,
                    promoCodeId: data.promoCodeId || promoCode,
                };
                const { adjustmentType, isAdjustment, adjustmentReason } = this.payload;
                if (isAdjustment && adjustmentType === "correction" && this.payload.billingid) {
                    await trx("billing")
                        .where({ billingid: this.payload.billingid })
                        .update({
                        adjustmentType: "correction",
                        adjustmentReason,
                        adjustedBy: employeeid || this.payload.employeeid,
                        adjustmentdate: new Date(),
                        isAdjustment: 1,
                        islocked: 1,
                    });
                    await trx("dboservices")
                        .where({ billingid: this.payload.billingid })
                        .update({
                        isAdjustment: 1,
                        isCorrected: 1,
                        relatedBillingid: parseInt(this.payload.billingid),
                        isLocked: 1,
                    });
                }
                const result = await trx("billing")
                    .update({
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
                    status: totalOutstanding == 0 ? "paid" : "pending",
                    amountIncurredDueTax: updateData.totalAmountIncurredDueTax,
                    branchid: updatedBillingData.branchid,
                    isPromo: updateData.isPromo,
                    promoValue: updateData.promoValue,
                    additionalinformation: this.payload.additioninformation || null,
                    promoMethod: updateData.promoMethod,
                    promoCodeId: updateData.promoCodeId,
                    isAdjustment: hasRelatedBilling ? 1 : 0,
                    adjustmentType: hasRelatedBilling ? "addition" : null,
                    adjustedBy: hasRelatedBilling ? employeeid || this.payload.employeeid : null,
                    adjustmentdate: hasRelatedBilling ? new Date() : null,
                    adjustmentReason: hasRelatedBilling ? 'New Billing service added' : null,
                    relatedBillingId: hasRelatedBilling ? parseInt(this.payload.billingid) : null,
                    writeoff: writeOffOutstanding ? writeOffAmount : 0,
                }).where({ billingid: billingID });
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
                        await billing_shared_1.BillingSharedRepo.insertBillHistory(trx, billingID, paymentMode, paymentAmount, employeeId, "credit");
                    }
                }
                // await trx.commit();
            }
            return { status: true, message: "Billing submitted successfully", billingid: billingID };
        }
        catch (error) {
            return { status: false, message: error && error.message ? error.message : "Unknown error in billing submission" };
        }
    }
    static async validateBillingRequestBody(billingData, tenantId) {
        const { cart, servicesProvided, employeeid, branchid, isPromo, promo, patientId, amountPayable, paid, payments } = billingData;
        if (!Array.isArray(cart) || !Array.isArray(servicesProvided)) {
            return billingclientTypes_1.ValidationError.CartAndServicesNotArrays;
        }
        if (cart.length === 0 && servicesProvided.length === 0) {
            return billingclientTypes_1.ValidationError.CartAndServicesEmpty;
        }
        if (!employeeid || typeof employeeid !== "number") {
            return billingclientTypes_1.ValidationError.InvalidEmployeeId;
        }
        if (!branchid || typeof branchid !== "number") {
            return billingclientTypes_1.ValidationError.InvalidBranchId;
        }
        if (typeof amountPayable !== "number" || typeof paid !== "number") {
            return billingclientTypes_1.ValidationError.InvalidAmounts;
        }
        if (!patientId || typeof patientId !== "number") {
            return billingclientTypes_1.ValidationError.InvalidPatientId;
        }
        if (!(await billing_shared_1.BillingSharedRepo.checkPatientIdExist(patientId, tenantId))) {
            return billingclientTypes_1.ValidationError.PatientDoesNotExist;
        }
        if (isPromo && (!promo || !promo.code)) {
            return billingclientTypes_1.ValidationError.PromoCodeRequired;
        }
        if (payments && Array.isArray(payments)) {
            for (const payment of payments) {
                if (!payment.mode || !(await billing_shared_1.BillingSharedRepo.validatePaymentModeId(parseInt(payment.mode.toString(), 10), tenantId))) {
                    return billingclientTypes_1.ValidationError.InvalidPaymentMode;
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
                if (outcome && item[5] != 5 && item[1]) {
                    try {
                        await billing_shared_1.BillingSharedRepo.AddtoTestAscenstion(tenantId, outcome[0], billingid, item[1], queryRunner);
                    }
                    catch (err) {
                        throw new Error(billingclientTypes_1.billErrors.unableToLoadTestAscension);
                    }
                }
            }
            catch (err) {
                console.error("Error inserting service:", err);
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
