"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiBillingRepo = void 0;
const clinicianBilling_1 = require("../clincians/clinicianBilling");
const SalesSessionRepo_1 = require("./repositories/SalesSessionRepo");
const billingclientTypes_1 = require("./billingclientTypes");
const queries_1 = require("./queries");
const billing_shared_1 = require("./billing_shared");
class MultiBillingRepo {
    constructor() { }
    async billNewTransaction(billingData) {
        let billingID;
        await this.db.transaction(async (trx) => {
            // 1. Check for active session
            const sessionRepo = new SalesSessionRepo_1.SalesSessionRepo(trx);
            const today = new Date();
            const sessionExists = await sessionRepo.hasActiveSessionForDate(today, billingData.samplingCenter);
            if (!sessionExists)
                throw new Error("SESSION_NOT_FOUND");
            const valid = await billing_shared_1.BillingSharedRepo.validateBillingRequestBody(billingData, this.tenantId);
            if (valid !== true)
                throw new Error(String(valid));
            const taxValue = billingData.taxValue;
            const taxList = billingData.taxList || null;
            // Generate billing ID inside transaction
            billingID = await MultiBillingRepo.generateBillingID(trx, billingData.patientid);
            // Insert test cart
            await MultiBillingRepo.processTestCart(trx, billingData, billingID, taxValue, taxList);
            // Insert non-test services
            await MultiBillingRepo.processNonTestServices(trx, billingData, billingID, taxValue, taxList);
            // Load all entries for billing calculation
            const allEntries = await trx("dboservices").where("billingid", billingID);
            // Split entries into tests and services
            const testEntries = allEntries.filter(e => !e.serviceCategory || e.serviceCategory !== "SERVICES");
            const serviceEntries = allEntries.filter(e => e.serviceCategory === "SERVICES");
            if (allEntries.length > 0) {
                // Calculate billing final values (implement this function as needed)
                const billingFinalValues = await MultiBillingRepo.calculateBillingVariablesFinal(serviceEntries, testEntries, taxValue, 5, billingData.billingSource, billingData.paid);
                // Update billing record
                const updateData = {
                    totalTransactionCost: billingFinalValues.totalCost,
                    totalcost: billingFinalValues.totalCost,
                    paid: billingData.paid,
                    payable: billingFinalValues.payable,
                    discount: billingFinalValues.totalDiscount,
                    amountIncurredDueTax: billingFinalValues.amountIncurredDueTax,
                    outstanding: billingFinalValues.outstanding,
                    balance: 0,
                    totalRefunded: 0,
                };
                const result = await trx("billing").where("billingid", billingID).update(updateData);
                if (!result)
                    throw new Error("unable to update billing record");
                // Insert billing history
                await (0, queries_1.insertBillHistory)(trx, billingID, billingData.paymentmode, billingData.paid, billingData.employeeid, billingData.type);
            }
        });
        return billingID;
    }
    static async generateBillingID(trx, patientid) {
        const [id] = await trx("billing").insert({ patientid }).returning("billingid");
        return typeof id === "number" ? id : id.billingid;
    }
    static async processTestCart(trx, billingData, billingID, taxValue, taxList) {
        var _a, _b;
        let entityType = "general";
        let entityId = 0;
        if (billingData.billingSource > 1 && billingData.entityid) {
            switch (billingData.billingSource) {
                case 2:
                    entityType = "organization";
                    entityId = billingData.entityid;
                    break;
                case 3:
                case 4:
                    entityType = "insurance";
                    entityId = billingData.entityid;
                    break;
                case 6:
                    entityType = "clinician";
                    entityId = billingData.entityid;
                    break;
            }
        }
        const strategySvc = new clinicianBilling_1.BillingStrategyService(trx);
        for (const item of billingData.cart) {
            if (item.totalcost == null)
                throw new Error("TotalCost is required for each cart item (use 0 if not applicable)");
            if (item.payable == null)
                throw new Error("payable (totalpayable) is required for each cart item (use 0 if not applicable)");
            // --- Price verification ---
            const correctPrice = await strategySvc.getProvidentialTestPrice(entityType, entityId, item.testid, true);
            if (item.discountedValue !== correctPrice) {
                throw new Error(`Incorrect price for TestID ${item.testid}: expected ${correctPrice}, got ${item.discountedValue}`);
            }
            // Promo fields from billingData
            const promoCode = billingData.promocode || null;
            const promoType = billingData.promoType || null;
            const isPromo = billingData.isPromo || false;
            const promoValue = billingData.promoValue || 0;
            const amountIncurredDueTax = (_b = (_a = item.amountIncurredDueTax) !== null && _a !== void 0 ? _a : billingData.amountIncurredDueTax) !== null && _b !== void 0 ? _b : 0;
            const now = new Date();
            const dboService = {
                billingid: billingID,
                trackId: item.testid,
                cost: item.discountedValue,
                employeeid: billingData.employeeid,
                serviceCategory: null,
                categoryTrackId: billingData.billingSource,
                clinicianId: null,
                organizationId: null,
                registrationType: null,
                branchid: billingData.samplingCenter,
                isoutsourced: item.isOutsourced === 1,
                outsourceid: item.outsourceid,
                serviceAddedOn: now,
                taxList: typeof taxList === "string" ? taxList : null,
                taxValue,
                amountIncurredDueTax,
                taxIncluded: billingData.taxIncluded,
                discount: item.discount,
                totalcost: item.totalcost,
                payable: item.payable,
                isNHIS: billingData.billingSource === 4,
                isPHIS: billingData.billingSource === 3,
                insuranceid: null,
                claimCode: null,
                hasNightAdjustment: item.hasNightAdjustment === true,
                nightAdjustmentMode: "none",
                nightAdjustmentValue: 0,
                isPackageUsed: billingData.isPackageUsed,
                packageid: item.package_id,
                promocode: promoCode,
                isPromo,
                promoValue,
                promoType,
            };
            if (billingclientTypes_1.ServiceCategory[billingData.billingSource]) {
                dboService.serviceCategory = billingclientTypes_1.ServiceCategory[billingData.billingSource];
            }
            if (billingData.type) {
                dboService.registrationType = billingData.type;
            }
            if (billingData.entityid) {
                switch (billingData.billingSource) {
                    case 2:
                        dboService.organizationId = billingData.entityid;
                        break;
                    case 3:
                    case 4:
                        dboService.insuranceid = billingData.entityid;
                        break;
                    case 6:
                        dboService.clinicianId = billingData.entityid;
                        break;
                }
            }
            await trx("dboservices").insert(dboService);
        }
    }
    static async processNonTestServices(trx, billingData, billingID, taxValue, taxList) {
        for (const service of billingData.servicesProvided) {
            if (service.servicePrice === 0)
                throw new Error("ServicePrice is required for each additional service (use 0 if not applicable)");
            // Promo fields from billingData
            const promoCode = billingData.promocode || null;
            const promoType = billingData.promoType || null;
            const isPromo = billingData.isPromo || false;
            const promoValue = billingData.promoValue || 0;
            const now = new Date();
            const dboService = {
                billingid: billingID,
                trackId: service.keyid,
                cost: service.servicePrice,
                employeeid: billingData.employeeid,
                serviceCategory: "SERVICES",
                categoryTrackId: billingData.billingSource,
                clinicianId: null,
                organizationId: null,
                registrationType: billingData.type || null,
                branchid: billingData.samplingCenter,
                isoutsourced: false,
                outsourceid: null,
                serviceAddedOn: now,
                taxList: typeof taxList === "string" ? taxList : null,
                taxValue,
                amountIncurredDueTax: 0,
                taxIncluded: billingData.taxIncluded,
                discount: service.discount,
                totalcost: service.servicePrice,
                payable: service.servicePrice,
                isNHIS: billingData.billingSource === 4,
                isPHIS: billingData.billingSource === 3,
                insuranceid: null,
                claimCode: null,
                hasNightAdjustment: service.hasNightAdjustment,
                nightAdjustmentMode: service.nightAdjustmentMode,
                nightAdjustmentValue: service.nightAdjustmentValue,
                isPackageUsed: billingData.isPackageUsed,
                packageid: service.package_id,
                promocode: promoCode,
                isPromo,
                promoValue,
                promoType,
            };
            if (billingData.billingSource === 2 && billingData.entityid) {
                dboService.organizationId = billingData.entityid;
            }
            else if (billingData.billingSource === 6 && billingData.entityid) {
                dboService.clinicianId = billingData.entityid;
            }
            await trx("dboservices").insert(dboService);
        }
    }
}
exports.MultiBillingRepo = MultiBillingRepo;
