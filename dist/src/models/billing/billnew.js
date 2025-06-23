"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiBillingRepo = void 0;
const SalesSessionRepo_1 = require("./repositories/SalesSessionRepo");
const billing_shared_types_1 = require("./billing_shared_types");
const billing_shared_1 = require("./billing_shared");
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const PrimeBillingPromoCodeRepo_1 = require("./repositories/PrimeBillingPromoCodeRepo");
class MultiBillingRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async billNewTransaction(billingData) {
        let trx;
        try {
            let billingID;
            // 1. Check for active session
            const sessionRepo = new SalesSessionRepo_1.SalesSessionRepo(this.tenantId);
            const today = new Date();
            const sessionExists = await sessionRepo.hasActiveSessionForDate(today, billingData.samplingCenter);
            if (!sessionExists) {
                return billing_shared_types_1.BillErrors.NoBillingSession;
            }
            const valid = await billing_shared_1.BillingSharedRepo.validateBillingRequestBody(billingData, this.tenantId);
            if (valid !== true)
                throw new Error(String(valid));
            const taxValue = billingData.taxValue;
            const taxList = billingData.taxList || null;
            const conn = await this.connection;
            trx = await conn.transaction();
            // Generate billing ID inside transaction
            billingID = await billing_shared_1.BillingSharedRepo.generateBillingID(billingData.patientid, this.tenantId, trx);
            // Insert test cart
            const testResult = await billing_shared_1.BillingSharedRepo.processTestCart(this.tenantId, billingData, billingID, taxValue, taxList, trx);
            // Insert non-test services
            const Multi = new billing_shared_1.BillingSharedRepo();
            const serviceProvided = await Multi.verificationOfServicesAndNightAdjustment(this.tenantId, billingData.servicesProvided, 5, taxValue, billingData.isPackageUsed);
            const serviceEntries = await billing_shared_1.BillingSharedRepo.processNonTestServices(billingData, serviceProvided, billingID, taxValue, taxList);
            const allEntries = [...testResult, ...serviceEntries];
            if (allEntries.length > 0) {
                // ENFORCEMENT: Each item totalcost is after night adjustment and item discount, but before promo. Tax is calculated per item and summed.
                const billing_final_values = billing_shared_1.BillingSharedRepo.calculateBillingVariablesFinal(serviceEntries, testResult, billingData.paid);
                const loadAllServices = await new billing_shared_1.BillingSharedRepo()
                    .mapAndInsertServices(this.tenantId, allEntries, billingID, trx);
                if (loadAllServices.length > 0) {
                    throw new Error(billing_shared_types_1.BillErrors.UnableToLoadServices);
                }
                // Prepare update data
                // Use shared function to apply promo to payable
                let promoValue = 0;
                let promoMethod = null;
                let promoCodeId = null;
                let payableAfterPromo = billing_final_values.payable;
                if (billingData.isPromo && billingData.promo && billingData.promo.id && billingData.promoMethod && billingData.promo.discount_value) {
                    const promoAmount = Number(billingData.promo.discount_value);
                    const { promoValue: calcPromoValue, amountAfterPromo } = billing_shared_1.BillingSharedRepo.applyPromoCodeToAmount(billing_final_values.payable, billingData.promoMethod, promoAmount);
                    promoValue = Number(calcPromoValue) || 0;
                    payableAfterPromo = Number(amountAfterPromo) || billing_final_values.payable;
                    promoMethod = billingData.promoMethod;
                    promoCodeId = billingData.promo.id;
                }
                const updateData = {
                    totalTransactionCost: billing_final_values.totalcost,
                    totalcost: billing_final_values.totalcost,
                    paid: billingData.paid,
                    payable: payableAfterPromo,
                    discount: billing_final_values.totalDiscount,
                    amountIncurredDueTax: billing_final_values.amountIncurredDueTax,
                    outstanding: Number((payableAfterPromo - billingData.paid).toFixed(2)),
                    totalrefunded: 0,
                    isPromo: billingData.isPromo || false,
                    promoValue: promoValue,
                    promoMethod: promoMethod,
                    promoCodeId: promoCodeId,
                };
                const result = await trx("billing")
                    .where("billingid", billingID)
                    .update(updateData);
                if (!result)
                    throw new Error("unable to update billing record");
                // Increment promo usage if promo applied
                if (billingData.isPromo && billingData.promo && billingData.promo.id) {
                    const promoRepo = new PrimeBillingPromoCodeRepo_1.PrimeBillingPromoCodeRepo(this.tenantId);
                    await promoRepo.incrementUsage(billingData.promo.id, trx);
                }
                await billing_shared_1.BillingSharedRepo.insertBillHistory(trx, billingID, billingData.paymentmode, billingData.paid, billingData.employeeid, "credit");
                await trx.commit();
            }
            return billingID;
        }
        catch (error) {
            if (trx) {
                await trx.rollback();
            }
            console.error("Error in billNewTransaction:", error);
            return billing_shared_types_1.BillErrors.Error;
        }
    }
    async billNewTransactionSimpleApproach(billingData) {
        let trx;
        try {
            let billingID;
            // 1. Check for active session
            const sessionRepo = new SalesSessionRepo_1.SalesSessionRepo(this.tenantId);
            const today = new Date();
            const sessionExists = await sessionRepo.hasActiveSessionForDate(today, billingData.samplingCenter);
            if (!sessionExists) {
                return billing_shared_types_1.BillErrors.NoBillingSession;
            }
            const valid = await billing_shared_1.BillingSharedRepo.validateBillingRequestBody(billingData, this.tenantId);
            if (valid !== true)
                throw new Error(String(valid));
            const taxValue = billingData.taxValue;
            const taxList = billingData.taxList || null;
            const conn = await this.connection;
            trx = await conn.transaction();
            // Generate billing ID inside transaction
            billingID = await billing_shared_1.BillingSharedRepo.generateBillingID(billingData.patientid, this.tenantId, trx);
            console.log("billingID", billingID);
            // Insert test cart
        }
        catch (error) {
            if (trx) {
                await trx.rollback();
            }
            console.error("Error in billNewTransactionSimpleApproach:", error);
            return billing_shared_types_1.BillErrors.Error;
        }
    }
}
exports.MultiBillingRepo = MultiBillingRepo;
