"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscountLimitService = exports.BillingSharedRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const TiifuWorkingClass_1 = require("../../database/TiifuWorkingClass");
const helper_1 = require("../../hooks/helper");
const billingstrategy_1 = __importDefault(require("../clincians/billingstrategy"));
const billing_shared_types_1 = require("./multi/billing_shared_types");
const billingclientTypes_1 = require("./billingclientTypes");
const queries_1 = require("./queries");
const PrimeBillingPromoCodeRepo_1 = require("./repositories/PrimeBillingPromoCodeRepo");
const ascension_1 = require("../operations/ascension");
const FinanceLedgerService_1 = require("../../services/finance/FinanceLedgerService");
const financeLedgerInit_1 = require("../../services/finance/financeLedgerInit");
const user_1 = __importDefault(require("../../LobnosAuth/user"));
const appLevelTriggers_1 = require("../../database/appLevelTriggers");
const resultDelivery_1 = __importDefault(require("../../controllers/result/resultDelivery"));
class BillingSharedRepo {
    static calculateTotalDiscount(data) {
        return parseFloat(TiifuWorkingClass_1.TiifuWorkingClass.reduceListInOF(data, 'discount') || 0);
    }
    static calculateTotalServicesValue(categoryTrackId, data) {
        if (data.length === 0)
            return 0;
        if (!(categoryTrackId && billingclientTypes_1.serviceCategory[categoryTrackId])) {
            throw new Error(`categoryTrackId ${categoryTrackId} not found`);
        }
        const amount = parseFloat(TiifuWorkingClass_1.TiifuWorkingClass.reduceListInOF(data, 'discountedValue'));
        return amount;
    }
    static amountIncurredDueTaxes(totalServiceCost, taxValue) {
        return (totalServiceCost) * (taxValue / 100);
    }
    static calulateTotalPayableServices(categoryTrackId, data, taxValue) {
        let totalServiceCost = 0;
        let totalcost = 0;
        let totalDiscount = 0;
        let payable = 0;
        let amountIncurredDueTax = 0;
        totalServiceCost = this.calculateTotalServicesValue(categoryTrackId, data);
        totalDiscount = this.calculateTotalDiscount(data);
        // Correct order: apply discount first, then tax
        const discounted = totalServiceCost - totalDiscount;
        if (taxValue === 0) {
            payable = parseFloat((discounted).toFixed(2));
            totalcost = parseFloat((discounted).toFixed(2));
            amountIncurredDueTax = 0;
        }
        else {
            amountIncurredDueTax = parseFloat((discounted * (taxValue / 100)).toFixed(2));
            totalcost = parseFloat((discounted + amountIncurredDueTax).toFixed(2));
            payable = totalcost;
        }
        return { amountIncurredDueTax, payable, totalServiceCost, totalDiscount, totalcost };
    }
    // Ensures numeric fields are numbers, mutates the data object
    static ensureNumericFields(data) {
        const fields = [
            { value: data.outstanding, set: v => (data.outstanding = v) },
            { value: data.paid, set: v => (data.paid = v) },
            { value: data.payable, set: v => (data.payable = v) },
        ];
        for (const field of fields) {
            if (typeof field.value === "string") {
                const parsed = parseFloat(field.value);
                if (isNaN(parsed))
                    return billing_shared_types_1.BillErrors.BadParams;
                field.set(parsed);
            }
            else if (typeof field.value === "number") {
                // ok
            }
            else if (typeof field.value === "bigint") {
                field.set(Number(field.value));
            }
            else {
                return billing_shared_types_1.BillErrors.BadParams;
            }
        }
        return "";
    }
    static async validateBillingRequestBody(billingData, tenantId) {
        const { cart, servicesProvided, employeeid, paymentmode, samplingCenter, isPromo, isPromoValid, isPackageUsed, promo, billingSource, patientid, ispromo, promocode } = billingData;
        if (!Array.isArray(cart) || !Array.isArray(servicesProvided)) {
            return "InvalidCartOrServices" /* BillingValidationResult.INVALID_CART_OR_SERVICES */;
        }
        if (cart.length === 0 && servicesProvided.length === 0) {
            return "EmptyCartAndServices" /* BillingValidationResult.EMPTY_CART_AND_SERVICES */;
        }
        if (!employeeid || typeof employeeid !== "number") {
            return "InvalidEmployeeID" /* BillingValidationResult.INVALID_EMPLOYEE_ID */;
        }
        if (!paymentmode || !(await this.validatePaymentModeId(tenantId, parseInt(paymentmode.toString(), 10)))) {
            return "InvalidPaymentMode" /* BillingValidationResult.INVALID_PAYMENT_MODE */;
        }
        if (!samplingCenter || typeof samplingCenter !== "number") {
            return "MissingBranchID" /* BillingValidationResult.MISSING_BRANCH_ID */;
        }
        if (this.ensureNumericFields(billingData) !== "") {
            return "InvalidPayableOrPaid: Field should be a valid number (payable, paid, or discount)" /* BillingValidationResult.INVALID_PAYABLE_OR_PAID */;
        }
        if (!patientid || typeof patientid !== "number") {
            return "MissingPatientID" /* BillingValidationResult.MISSING_PATIENT_ID */;
        }
        if (!(await this.checkPatientIdExist(patientid, tenantId))) {
            return "PatientId Invalid" /* BillingValidationResult.INVALID_PATIENT_ID */;
        }
        if (!billingclientTypes_1.serviceCategory[billingSource]) {
            return "Billingsource missing or invalid" /* BillingValidationResult.INVALID_MISSING_BILLING_SOURCE */;
        }
        if (billingSource > 1) {
            if (!billingData.entityId || billingData.entityId === 0) {
                return "Provided Billing Source and Detail do not match" /* BillingValidationResult.INVALID_BILLING_SOURCE_MATCH */;
            }
        }
        if (isPromo && promo.code && isPromoValid) {
            const promoRepo = new PrimeBillingPromoCodeRepo_1.PrimeBillingPromoCodeRepo(tenantId);
            const promoResult = await promoRepo.validatePromoCode(promo.code);
            if (!promoResult.valid) {
                return "InvalidPromoCode" /* BillingValidationResult.INVALID_PROMO_CODE */;
            }
        }
        if (isPromo && !promo.code) {
            return "InvalidPromoCode" /* BillingValidationResult.INVALID_PROMO_CODE */;
        }
        return true;
    }
    static async checkValidityOfBillingID(billingid, tenantId) {
        const db = await (0, KnexConnections_1.default)(tenantId);
        const bill = await db("billing").where("billingid", billingid).first();
        return !!bill;
    }
    static async getOriginalBillingData(billingid, tenantId) {
        const db = await (0, KnexConnections_1.default)(tenantId);
        return await db("billing").where("billingid", billingid).first();
    }
    static async canAdjustBilling(billingid, tenantId) {
        const originalBilling = await this.getOriginalBillingData(billingid, tenantId);
        if (!originalBilling) {
            return { status: false, message: "Original billing not found." };
        }
        if (['voided', 'written-off', 'corrected'].includes(originalBilling.status)) {
            return { status: false, message: `Cannot adjust billing with status: ${originalBilling.status}` };
        }
        return { status: true };
    }
    static applyPromoCodeToAmount(totalpayable, promoMethod, promoValue) {
        let promoAmount = 0;
        if (promoMethod === 'flat') {
            promoAmount = promoValue;
        }
        else if (promoMethod === 'percentage') {
            promoAmount = (promoValue / 100) * totalpayable;
        }
        // Defensive: Ensure promoAmount is a valid number
        if (isNaN(promoAmount) || !isFinite(promoAmount))
            promoAmount = 0;
        const amountAfterPromo = Math.max(0, totalpayable - promoAmount);
        return { promoValue: promoAmount, amountAfterPromo };
    }
    static async checkPatientIdExist(patientid, tenantId) {
        const db = await (0, KnexConnections_1.default)(tenantId);
        const result = await db("new_patients").where("patientid", patientid).count("*");
        return Number(result[0]['count(*)']) > 0;
    }
    static async validatePaymentModeId(paymentModeId, tenantId) {
        const db = await (0, KnexConnections_1.default)(tenantId);
        const result = await db("paymentmodes").where("KeyID", paymentModeId).count("*");
        return Number(result[0]['count(*)']) > 0;
    }
    static async generateBillingID(patientid, tenantId, branchid, employeeid, trx) {
        try {
            const db = trx || (await (0, KnexConnections_1.default)(tenantId));
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();
            const currentDay = new Date().getDate();
            const [id] = await db("billing")
                .insert({
                patientid,
                month: currentMonth,
                year: currentYear,
                day: currentDay,
                discount: 0.0,
                branchid: branchid,
                lastupdatedby: employeeid,
            }).returning("billingid");
            return typeof id === "number" ? id : id.billingid;
        }
        catch (error) {
            if (trx) {
                await trx.rollback();
            }
            throw new Error("Failed to generate billing ID");
        }
    }
    static async insertBillHistory(tenantId, trx, billingID, paymentMode, paid, employeeID, billingType) {
        var _a;
        try {
            await (0, financeLedgerInit_1.ensureFinanceLedgerTables)(tenantId);
            const insertion = await trx.raw("INSERT INTO billinghx(billingid, paymentmode, amount, employeeid, type) VALUES (?, ?, ?, ?, ?)", [billingID, paymentMode, paid, employeeID, billingType]);
            const inserted = (0, helper_1.rowAffected)(insertion);
            if (inserted) {
                const historyId = ((_a = insertion === null || insertion === void 0 ? void 0 : insertion[0]) === null || _a === void 0 ? void 0 : _a.insertId) || (insertion === null || insertion === void 0 ? void 0 : insertion.insertId);
                const billingRow = await trx('billing')
                    .select('branchid', 'billedon')
                    .where({ billingid: billingID })
                    .first();
                if (historyId) {
                    await FinanceLedgerService_1.FinanceLedgerService.recordEntry({
                        tenantId,
                        trx,
                        occurredAt: (billingRow === null || billingRow === void 0 ? void 0 : billingRow.billedon) || new Date(),
                        direction: billingType,
                        amount: Number(paid || 0),
                        accountRef: FinanceLedgerService_1.FinanceLedgerService.mapPaymentModeToAccountRef(paymentMode),
                        sourceModule: 'billing',
                        sourceTable: 'billinghx',
                        sourcePk: Number(historyId),
                        billingid: billingID,
                        employeeid: employeeID ? Number(employeeID) : null,
                        branchid: (billingRow === null || billingRow === void 0 ? void 0 : billingRow.branchid) ? Number(billingRow.branchid) : null,
                    });
                }
            }
            return inserted;
        }
        catch (error) {
            console.error("Error inserting billing history:", error);
            return false;
        }
    }
    static async removeDuplicateServiceFromNewCart(services, categoryTrackId, billingid, isTestCart, tenantId) {
        var _a;
        const db = await (0, KnexConnections_1.default)(tenantId);
        const unique = [];
        if (isTestCart) {
            for (const item of services) {
                const trackId = item.testid || item.id;
                const has = await this.hasServiceWithBillingIdAndTrackId(billingid, categoryTrackId, trackId, tenantId);
                if (!has)
                    unique.push(item);
            }
        }
        else {
            for (const item of services) {
                const trackId = item.keyid || ((_a = item.package_id) !== null && _a !== void 0 ? _a : 0);
                const has = await this.hasServiceWithBillingIdAndTrackId(billingid, categoryTrackId, trackId, tenantId);
                if (!has)
                    unique.push(item);
            }
        }
        return unique;
    }
    static async hasServiceWithBillingIdAndTrackId(billingid, categoryTrackId, trackId, tenantId) {
        const db = await (0, KnexConnections_1.default)(tenantId);
        const result = await db("dboservices").where({ billingid, categorytrackid: categoryTrackId, trackid: trackId }).count("*");
        return Number(result[0].count) > 0;
    }
    // Applies night adjustment logic to a slice of servicesProvided.
    static applyNightAdjustmentToItems(services) {
        return services.map(item => {
            if (item.hasNightAdjustment) {
                const adjValue = item.nightAdjustmentValue || 0;
                const mode = item.nightAdjustmentMode || "none";
                if (adjValue !== 0) {
                    if (mode === "percentage") {
                        item.discountedValue += (item.discountedValue * adjValue) / 100;
                    }
                    else if (mode === "absolute") {
                        item.discountedValue += adjValue;
                    }
                }
            }
            return item;
        });
    }
    static async verificationOfServicesAndNightAdjustment(services, categoryTrackId, taxValue, isPackageUsed, tenantId) {
        if (!isPackageUsed) {
            const adjusted = BillingSharedRepo.applyNightAdjustmentToItems(services);
            return await Promise.all(adjusted.map(async (item) => item));
        }
        else {
            return services.map(item => item);
        }
    }
    async verificationAndReformatingOfServics(tenantId, item) {
        const { keyid, discount } = item;
        const serviceItem = await new TiifuWorkingClass_1.TiifuWorkingClass('additionalservices').findOne(tenantId, "keyid", keyid);
        const { servicePrice } = serviceItem;
        return { discountedValue: servicePrice, discount: discount | 0 };
    }
    async verificationOfServicesAndNightAdjustment(tenantId, servicesProvided, billingSource = 5, taxValue, isPackageUsed) {
        if (!Array.isArray(servicesProvided) || servicesProvided.length === 0) {
            return [];
        }
        let verifyAndReformatServices = servicesProvided;
        if (!isPackageUsed) {
            verifyAndReformatServices = await Promise.all(servicesProvided.map(async (item, index) => {
                const result = await this.verificationAndReformatingOfServics(tenantId, item);
                return Object.assign(Object.assign({}, item), result);
            }));
            const applyNightAdjustmentToServiceItems = BillingSharedRepo.applyNightAdjustmentToItems(verifyAndReformatServices);
            return applyNightAdjustmentToServiceItems.map((item, index) => {
                const summary = BillingSharedRepo.calulateTotalPayableServices(billingSource, [item], taxValue);
                return Object.assign(Object.assign({}, summary), item);
            });
        }
        else {
            return servicesProvided.map((item, index) => {
                const summary = BillingSharedRepo.calulateTotalPayableServices(billingSource, [item], taxValue);
                return Object.assign(Object.assign({}, summary), item);
            });
        }
    }
    static calculateBillingVariablesFinal(services, test, paid) {
        const all = [...(services || []), ...(test || [])];
        const payable = all.reduce((sum, item) => sum + (item.totalpayable || 0), 0);
        const totalcost = all.reduce((sum, item) => sum + (item.totalcost || 0), 0);
        const totalDiscount = all.reduce((sum, item) => sum + (item.discount || 0), 0);
        const amountIncurredDueTax = all.reduce((sum, item) => sum + (item.amountIncurredDueTax || 0), 0);
        const outstanding = payable - (paid || 0);
        const balance = paid > payable ? paid - payable : 0;
        return { payable, outstanding, totalDiscount, amountIncurredDueTax, totalcost, balance };
    }
    static async applyNightAdjustmentToTestCart(tenantId, trx, cart, billingSource, entityId) {
        let entityType = "general";
        let entityVal = 0;
        if (billingSource > 1 && entityId) {
            switch (billingSource) {
                case 2:
                    entityType = "organization";
                    entityVal = entityId;
                    break;
                case 3:
                case 4:
                    entityType = "insurance";
                    entityVal = entityId;
                    break;
                case 6:
                    entityType = "clinician";
                    entityVal = entityId;
                    break;
            }
        }
        const strategySvc = new billingstrategy_1.default();
        const adjusted = [];
        for (const item of cart) {
            const price = await strategySvc.getProvidentialTestPrice(tenantId, entityType, entityVal, item.testid, true, trx);
            if (item.discountedValue !== price) {
                item.discountedValue = price;
            }
            if (item.hasNightAdjustment) {
                const adjValue = item.nightAdjustmentValue || 0;
                const mode = item.nightAdjustmentMode || "none";
                if (adjValue !== 0) {
                    if (mode === "percentage") {
                        item.discountedValue += (item.discountedValue * adjValue) / 100;
                    }
                    else if (mode === "absolute") {
                        item.discountedValue += adjValue;
                    }
                }
            }
            adjusted.push(item);
        }
        return adjusted;
    }
    static async processTestCart(tenantId, billingData, billingID, taxValue, taxList, trx) {
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
        const strategySvc = new billingstrategy_1.default();
        const result = await Promise.all(billingData.cart.map(async (item) => {
            if (!billingData.isPackageUsed) {
                if (item.totalcost == null)
                    item.totalcost = item.discountedValue;
                if (item.payable == null)
                    item.payable = item.discountedValue;
                // --- Price verification ---
                const correctPrice = await strategySvc.getProvidentialTestPrice(tenantId, entityType, entityId, item.testid, true, trx);
                if (item.discountedValue !== correctPrice) {
                    item.discountedValue = correctPrice;
                }
                // --- Night adjustment ---
                const nightAdjustmentApplied = item.hasNightAdjustment
                    ? this.applyNightAdjustmentToItems([item]) :
                    [item];
                item.discountedValue = nightAdjustmentApplied[0].discountedValue;
            }
            const summary = BillingSharedRepo.calulateTotalPayableServices(billingData.billingSource, [item], taxValue);
            const { amountIncurredDueTax, totalcost, totalServiceCost, payable, totalDiscount } = summary;
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
                isoutsourced: item.isOutsourced === true || item.isoutsourced === 1 ? 1 : 0,
                outsourceid: item.outsourceid || null,
                serviceAddedOn: new Date(),
                taxList: typeof taxList === "string" ? taxList : null,
                taxValue,
                amountIncurredDueTax: amountIncurredDueTax,
                taxIncluded: billingData.taxIncluded,
                discount: totalDiscount,
                totalcost: totalcost,
                totalpayable: payable,
                isNHIS: billingData.billingSource === 4 ? 1 : 0,
                isPHIS: billingData.billingSource === 3 ? 1 : 0,
                insuranceid: insuranceId,
                claimCode: null,
                hasNightAdjustment: item.hasNightAdjustment === true,
                nightAdjustmentMode: item.nightAdjustmentMode || "none",
                nightAdjustmentValue: item.nightAdjustmentValue || 0,
                isPackageUsed: billingData.isPackageUsed ? 1 : 0,
                packageid: item.package_id || null
            };
        }));
        return result;
    }
    static async processNonTestServices(billingData, servicesProvided, billingID, taxValue, taxList) {
        let organizationId = null;
        let clinicianId = null;
        let insuranceId = null;
        const entityId = billingData.entityId ? parseInt(billingData.entityId.toString()) : null;
        switch (billingData.billingSource) {
            case 2:
                organizationId = entityId;
                break;
            case 3:
            case 4:
                insuranceId = entityId;
                break;
            case 6:
                clinicianId = entityId;
                break;
        }
        const { employeeid, samplingCenter, taxIncluded, type, billingSource, isPackageUsed } = billingData;
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
                registrationType: type,
                branchid: samplingCenter,
                isoutsourced: 0,
                outsourceid: 0,
                serviceAddedOn: new Date(),
                taxList,
                taxValue,
                amountIncurredDueTax: item.amountIncurredDueTax,
                taxIncluded,
                discount: item.totalDiscount,
                totalcost: item.totalcost,
                totalpayable: item.payable,
                isNHIS: billingSource === 4 ? 1 : 0,
                isPHIS: billingSource === 3 ? 1 : 0,
                insuranceid: insuranceId || null,
                claimCode: null,
                hasNightAdjustment: item.hasNightAdjustment,
                nightAdjustmentMode: item.nightAdjustmentMode,
                nightAdjustmentValue: item.nightAdjustmentValue,
                isPackageUsed: isPackageUsed ? 1 : 0,
                packageid: (item === null || item === void 0 ? void 0 : item.packageid) || null,
            };
        }));
    }
    async mapAndInsertServices(tenantId, allEntries, billingid, patientId, result_delivery, trx) {
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
                    service.packageid,
                    service.paymentstatus,
                    service.paidamount,
                    service.outstanding,
                    service.outsourceprice,
                    service.nhismembershipid ? service.nhismembershipid : null,
                    service.claimscheckcode ? service.claimscheckcode : null,
                    service.relatedbillingid ? service.relatedbillingid : null,
                    service.userAdjustedValue ? service.userAdjustedValue : 0,
                    service.userAdjustmentType ? service.userAdjustmentType : null,
                ];
            });
            const loadAllServices = await this.loadMultipleServices(servicesMap, billingid, tenantId, patientId, result_delivery, trx);
            return loadAllServices;
        }
        catch (err) {
            await trx.rollback();
            throw err;
        }
    }
    async loadMultipleServices(services, billingid, tenantId, patientId, result_delivery, trx) {
        const insertionErrors = [];
        const queryRunner = trx || await (0, KnexConnections_1.default)(tenantId);
        for (const item of services) {
            try {
                const [billingid, trackId, cost, employeeid, serviceCategory, categoryTrackId, clinicianId, organizationId, registrationType, branchid, isoutsourced, outsourceid, serviceAddedOn, taxList, taxValue, amountIncurredDueTax, taxIncluded, discount, totalcost, totalpayable, isNHIS, isPHIS, insuranceid, claimCode, hasNightAdjustment, nightAdjustmentMode, nightAdjustmentValue, isPackageUsed, packageid, paymentstatus, paidamount, outstanding, outsourceprice, nhismembershipid, claimscheckcode, relatedbillingid, userAdjustedValue, userAdjustmentType] = item;
                const actualDiscount = userAdjustmentType === "discount" ? userAdjustedValue : 0;
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
                    discount: actualDiscount,
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
                    packageid,
                    paymentstatus,
                    paidamount,
                    outstanding,
                    outsourceprice,
                    nhismembershipid,
                    claimscheckcode,
                    relatedbillingid,
                    userAdjustedValue,
                    userAdjustmentType
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
                        discount: actualDiscount,
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
                        packageid,
                        userAdjustedValue,
                        userAdjustmentType
                    }, employeeid ? employeeid.toString() : undefined);
                }
                else {
                    throw new Error("Unable to load service" /* OperationsFailures.unableToLoadService */);
                }
                if (serviceid && item[5] != 5 && item[1]) {
                    try {
                        const ascensionid = await BillingSharedRepo.AddtoTestAscenstion(tenantId, serviceid, billingid, item[1], queryRunner);
                        if (!ascensionid || typeof ascensionid !== "number") {
                            throw new Error(billingclientTypes_1.billErrors.unableToLoadTestAscension);
                        }
                        if (Array.isArray(result_delivery.preferences)) {
                            const findPrefernceforAscension = result_delivery.preferences.find((item) => item.testid == trackId);
                            if (findPrefernceforAscension)
                                await new resultDelivery_1.default(billingid, tenantId).setMultipleTestResultDeliveryPreferences({
                                    updated_by_employeeid: findPrefernceforAscension.employeeid,
                                    requested_mode: findPrefernceforAscension.requested_mode,
                                    requested_mode_detail: findPrefernceforAscension.requested_mode_detail,
                                    patientid: patientId, billingid,
                                    ascension: ascensionid
                                }, queryRunner);
                        }
                        // we must insert into resultdeliverydialog too
                        await ascension_1.TestAscension.initialdbogeneraltestEdit(billingid, ascensionid, queryRunner);
                        await ascension_1.TestAscension.systemLaboratoryByPass(tenantId, ascensionid, 'byPassCollection', employeeid, queryRunner);
                        await ascension_1.TestAscension.systemLaboratoryByPass(tenantId, ascensionid, 'byPassSampleValidation', employeeid, queryRunner);
                        await ascension_1.TestAscension.systemLaboratoryByPass(tenantId, ascensionid, 'byPassProcessing', employeeid, queryRunner);
                    }
                    catch (err) {
                        console.log(err);
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
    static async AddtoTestAscenstion(tenantId, serviceid, billingid, testid, trx) {
        var _a;
        if (!billingid || !serviceid || !testid) {
            throw new Error(billingclientTypes_1.billErrors.unableToLoadTestAscension);
        }
        const queryRunner = trx || await (0, KnexConnections_1.default)(tenantId);
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const isInserted = await queryRunner.raw(queries_1.AddtoTestAscenstionQuery, [testid, serviceid, billingid, currentMonth, currentYear]);
        const ascensionid = ((_a = isInserted === null || isInserted === void 0 ? void 0 : isInserted[0]) === null || _a === void 0 ? void 0 : _a.insertId) || (isInserted === null || isInserted === void 0 ? void 0 : isInserted.insertId) || false;
        if (!ascensionid || typeof ascensionid !== "number") {
            throw new Error(billingclientTypes_1.billErrors.unableToLoadTestAscension);
        }
        await (0, appLevelTriggers_1.applyTestAscensionAfterInsertApprovalSettings)(queryRunner, ascensionid);
        await queryRunner.raw("INSERT IGNORE INTO samplestatus(testid,approvalstatus,ascensionid) VALUES(?,?,?)", [testid, null, ascensionid]);
        return ascensionid;
    }
    /**
     * Calculates the price of a test/service given all required parameters.
     * This is the backend-only, auditable, DRY utility for price calculation.
     *
     * @param opts - { tenantId, testuid, entity_type, entityid, discount, isNight, taxValue, promo, ... }
     * @returns Detailed breakdown of all calculation steps and final price.
     */
    static async calculateTestOrServicePrice(opts) {
        const { tenantId, testuid, entity_type, entityid, discount = 0, isNight = false, nightAdjustmentMode = 'none', nightAdjustmentValue = 0, taxValue = 0, promo, trx } = opts;
        const strategySvc = new billingstrategy_1.default();
        // 1. Fetch base price
        const basePrice = await strategySvc.getProvidentialTestPrice(tenantId, entity_type, Number(entityid), Number(testuid), true, trx);
        // 2. Night adjustment
        let nightAdjustedPrice = basePrice;
        if (isNight && nightAdjustmentValue && nightAdjustmentMode !== 'none') {
            if (nightAdjustmentMode === 'percentage') {
                nightAdjustedPrice += (basePrice * nightAdjustmentValue) / 100;
            }
            else if (nightAdjustmentMode === 'absolute') {
                nightAdjustedPrice += nightAdjustmentValue;
            }
        }
        // 3. Discount
        let discountedPrice = nightAdjustedPrice;
        if (discount && discount > 0) {
            discountedPrice -= (nightAdjustedPrice * discount) / 100;
        }
        // 4. Promo
        let promoValue = 0;
        let afterPromo = discountedPrice;
        if (promo && promo.value > 0) {
            if (promo.method === 'flat') {
                promoValue = promo.value;
            }
            else if (promo.method === 'percentage') {
                promoValue = (promo.value / 100) * discountedPrice;
            }
            if (isNaN(promoValue) || !isFinite(promoValue))
                promoValue = 0;
            afterPromo = Math.max(0, discountedPrice - promoValue);
        }
        // 5. Tax
        let taxAmount = 0;
        let finalPrice = afterPromo;
        if (taxValue && taxValue > 0) {
            taxAmount = parseFloat(((afterPromo * taxValue) / 100).toFixed(2));
            finalPrice = parseFloat((afterPromo + taxAmount).toFixed(2));
        }
        else {
            finalPrice = parseFloat(afterPromo.toFixed(2));
        }
        // Defensive rounding
        return {
            basePrice: parseFloat(basePrice.toFixed(2)),
            nightAdjustedPrice: parseFloat(nightAdjustedPrice.toFixed(2)),
            discountedPrice: parseFloat(discountedPrice.toFixed(2)),
            promoValue: parseFloat(promoValue.toFixed(2)),
            afterPromo: parseFloat(afterPromo.toFixed(2)),
            taxAmount,
            finalPrice,
            breakdown: {
                basePrice,
                nightAdjustedPrice,
                discountedPrice,
                promoValue,
                afterPromo,
                taxAmount,
                finalPrice
            }
        };
    }
}
exports.BillingSharedRepo = BillingSharedRepo;
class DiscountLimitService {
    static allowedRoles() {
        return new Set([
            'crm',
            'customer representative',
            'customer service representative',
            'manager',
            'accountant',
            'admin',
            'super-admin',
            'superadmin',
            'super admin'
        ]);
    }
    static normalizeRole(role) {
        if (!role)
            return null;
        return String(role).trim().toLowerCase().replace(/\s+/g, ' ');
    }
    static getNextRoleInHierarchy(currentRole) {
        if (!currentRole)
            return null;
        const hierarchy = ['crm', 'customer representative', 'customer service representative', 'manager', 'accountant', 'admin', 'super-admin', 'superadmin', 'super admin'];
        const idx = hierarchy.indexOf(currentRole);
        if (idx === -1)
            return null;
        return hierarchy[idx + 1] || null;
    }
    static todayLocalISODate() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    static async getRoleLimitInfo(opts) {
        const { tenantId, employeeid, trx } = opts;
        const conn = trx || (await (0, KnexConnections_1.default)(tenantId));
        const roleRaw = await new user_1.default().getUserRole(employeeid, tenantId);
        const role = DiscountLimitService.normalizeRole(roleRaw);
        const allowedRole = role ? DiscountLimitService.allowedRoles().has(role) : false;
        const usageDate = DiscountLimitService.todayLocalISODate();
        if (!role || !allowedRole) {
            return {
                role,
                allowedRole,
                ruleFound: false,
                rule: null,
                usageDate,
                dailyUsedDiscount: 0,
                dailyRemainingDiscount: null,
                dailyUsedSurcharge: 0,
                dailyRemainingSurcharge: null
            };
        }
        const rule = await conn('discount_limit_rules')
            .where({ role, is_active: 1 })
            .first();
        const currentUsage = await conn('discount_daily_usage')
            .where({ usage_date: usageDate, employeeid, role })
            .first();
        const dailyUsedDiscount = currentUsage ? Number(currentUsage.discount_total || 0) : 0;
        const dailyUsedSurcharge = currentUsage ? Number(currentUsage.surcharge_total || 0) : 0;
        const maxDiscountDay = rule && rule.max_discount_per_day != null ? Number(rule.max_discount_per_day) : null;
        const maxSurchargeDay = rule && rule.max_surcharge_per_day != null ? Number(rule.max_surcharge_per_day) : null;
        return {
            role,
            allowedRole,
            ruleFound: !!rule,
            rule: rule || null,
            usageDate,
            dailyUsedDiscount,
            dailyRemainingDiscount: maxDiscountDay == null ? null : Math.max(0, Number((maxDiscountDay - dailyUsedDiscount).toFixed(2))),
            dailyUsedSurcharge,
            dailyRemainingSurcharge: maxSurchargeDay == null ? null : Math.max(0, Number((maxSurchargeDay - dailyUsedSurcharge).toFixed(2)))
        };
    }
    static async enforceAndRecord(opts) {
        const { tenantId, trx, employeeid, billingid, subtotal, payable, discountTotal, surchargeTotal, branchid } = opts;
        let dTotal = Math.abs(Number(discountTotal || 0));
        let sTotal = Math.abs(Number(surchargeTotal || 0));
        if (!isFinite(dTotal))
            dTotal = 0;
        if (!isFinite(sTotal))
            sTotal = 0;
        if (dTotal <= 0 && sTotal <= 0)
            return;
        const roleRaw = await new user_1.default().getUserRole(employeeid, tenantId);
        const role = DiscountLimitService.normalizeRole(roleRaw);
        if (!role)
            throw new Error('Unable to determine employee role for discount validation.');
        if (!DiscountLimitService.allowedRoles().has(role))
            throw new Error('Your role is not permitted to apply discounts or surcharges.');
        const rule = await trx('discount_limit_rules')
            .where({ role, is_active: 1 })
            .first();
        if (!rule)
            throw new Error('No discount limit rule configured for your role. Please contact admin.');
        const baseAmount = typeof subtotal === 'number' ? subtotal : (typeof payable === 'number' ? payable : null);
        const minDiscountTotal = rule.min_transaction_total_for_discount != null ? Number(rule.min_transaction_total_for_discount) : null;
        const maxDiscountTxn = rule.max_discount_per_transaction != null ? Number(rule.max_discount_per_transaction) : null;
        const maxDiscountDay = rule.max_discount_per_day != null ? Number(rule.max_discount_per_day) : null;
        const minSurchargeTotal = rule.min_transaction_total_for_surcharge != null ? Number(rule.min_transaction_total_for_surcharge) : null;
        const maxSurchargeTxn = rule.max_surcharge_per_transaction != null ? Number(rule.max_surcharge_per_transaction) : null;
        const maxSurchargeDay = rule.max_surcharge_per_day != null ? Number(rule.max_surcharge_per_day) : null;
        if (dTotal > 0) {
            if (minDiscountTotal != null && baseAmount != null && baseAmount < minDiscountTotal) {
                const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
                throw new Error(nextRole ? `Discount not allowed at your level for this transaction. Please escalate to ${nextRole}.` : `Discount not allowed at your level for this transaction.`);
            }
            if (maxDiscountTxn != null && dTotal > maxDiscountTxn) {
                const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
                throw new Error(nextRole ? `Discount exceeds your per-transaction limit. Please escalate to ${nextRole}.` : `Discount exceeds your per-transaction limit.`);
            }
        }
        if (sTotal > 0) {
            if (minSurchargeTotal != null && baseAmount != null && baseAmount < minSurchargeTotal) {
                const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
                throw new Error(nextRole ? `Surcharge not allowed at your level for this transaction. Please escalate to ${nextRole}.` : `Surcharge not allowed at your level for this transaction.`);
            }
            if (maxSurchargeTxn != null && sTotal > maxSurchargeTxn) {
                const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
                throw new Error(nextRole ? `Surcharge exceeds your per-transaction limit. Please escalate to ${nextRole}.` : `Surcharge exceeds your per-transaction limit.`);
            }
        }
        const usageDate = DiscountLimitService.todayLocalISODate();
        const currentUsage = await trx('discount_daily_usage')
            .where({ usage_date: usageDate, employeeid, role })
            .first();
        const currentDiscount = currentUsage ? Number(currentUsage.discount_total || 0) : 0;
        const currentSurcharge = currentUsage ? Number(currentUsage.surcharge_total || 0) : 0;
        if (dTotal > 0 && maxDiscountDay != null && currentDiscount + dTotal > maxDiscountDay) {
            const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
            throw new Error(nextRole ? `Daily discount limit reached for your level. Please escalate to ${nextRole}.` : `Daily discount limit reached for your level.`);
        }
        if (sTotal > 0 && maxSurchargeDay != null && currentSurcharge + sTotal > maxSurchargeDay) {
            const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
            throw new Error(nextRole ? `Daily surcharge limit reached for your level. Please escalate to ${nextRole}.` : `Daily surcharge limit reached for your level.`);
        }
        await trx('discount_adjustment_log').insert({
            billingid,
            employeeid,
            role,
            branchid: branchid !== null && branchid !== void 0 ? branchid : null,
            subtotal: typeof subtotal === 'number' ? subtotal : null,
            payable: typeof payable === 'number' ? payable : null,
            discount_total: dTotal,
            surcharge_total: sTotal,
            occurred_at: trx.fn.now()
        });
        if (currentUsage) {
            await trx('discount_daily_usage')
                .where({ usage_date: usageDate, employeeid, role })
                .update({
                discount_total: trx.raw('discount_total + ?', [dTotal]),
                surcharge_total: trx.raw('surcharge_total + ?', [sTotal]),
                updated_at: trx.fn.now()
            });
        }
        else {
            await trx('discount_daily_usage').insert({
                usage_date: usageDate,
                employeeid,
                role,
                discount_total: dTotal,
                surcharge_total: sTotal,
                created_at: trx.fn.now(),
                updated_at: trx.fn.now()
            });
        }
    }
    static async enforceOnly(opts) {
        const { tenantId, employeeid, subtotal, payable, discountTotal, surchargeTotal } = opts;
        let dTotal = Math.abs(Number(discountTotal || 0));
        let sTotal = Math.abs(Number(surchargeTotal || 0));
        if (!isFinite(dTotal))
            dTotal = 0;
        if (!isFinite(sTotal))
            sTotal = 0;
        if (dTotal <= 0 && sTotal <= 0)
            return;
        const conn = await (0, KnexConnections_1.default)(tenantId);
        const roleRaw = await new user_1.default().getUserRole(employeeid, tenantId);
        const role = DiscountLimitService.normalizeRole(roleRaw);
        if (!role)
            throw new Error('Unable to determine employee role for discount validation.');
        if (!DiscountLimitService.allowedRoles().has(role))
            throw new Error('Your role is not permitted to apply discounts or surcharges.');
        const rule = await conn('discount_limit_rules')
            .where({ role, is_active: 1 })
            .first();
        if (!rule)
            throw new Error('No discount limit rule configured for your role. Please contact admin.');
        const baseAmount = typeof subtotal === 'number' ? subtotal : (typeof payable === 'number' ? payable : null);
        const minDiscountTotal = rule.min_transaction_total_for_discount != null ? Number(rule.min_transaction_total_for_discount) : null;
        const maxDiscountTxn = rule.max_discount_per_transaction != null ? Number(rule.max_discount_per_transaction) : null;
        const maxDiscountDay = rule.max_discount_per_day != null ? Number(rule.max_discount_per_day) : null;
        const minSurchargeTotal = rule.min_transaction_total_for_surcharge != null ? Number(rule.min_transaction_total_for_surcharge) : null;
        const maxSurchargeTxn = rule.max_surcharge_per_transaction != null ? Number(rule.max_surcharge_per_transaction) : null;
        const maxSurchargeDay = rule.max_surcharge_per_day != null ? Number(rule.max_surcharge_per_day) : null;
        if (dTotal > 0) {
            if (minDiscountTotal != null && baseAmount != null && baseAmount < minDiscountTotal) {
                const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
                throw new Error(nextRole ? `Discount not allowed at your level for this transaction. Please escalate to ${nextRole}.` : `Discount not allowed at your level for this transaction.`);
            }
            if (maxDiscountTxn != null && dTotal > maxDiscountTxn) {
                const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
                throw new Error(nextRole ? `Discount exceeds your per-transaction limit. Please escalate to ${nextRole}.` : `Discount exceeds your per-transaction limit.`);
            }
        }
        if (sTotal > 0) {
            if (minSurchargeTotal != null && baseAmount != null && baseAmount < minSurchargeTotal) {
                const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
                throw new Error(nextRole ? `Surcharge not allowed at your level for this transaction. Please escalate to ${nextRole}.` : `Surcharge not allowed at your level for this transaction.`);
            }
            if (maxSurchargeTxn != null && sTotal > maxSurchargeTxn) {
                const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
                throw new Error(nextRole ? `Surcharge exceeds your per-transaction limit. Please escalate to ${nextRole}.` : `Surcharge exceeds your per-transaction limit.`);
            }
        }
        const usageDate = DiscountLimitService.todayLocalISODate();
        const currentUsage = await conn('discount_daily_usage')
            .where({ usage_date: usageDate, employeeid, role })
            .first();
        const currentDiscount = currentUsage ? Number(currentUsage.discount_total || 0) : 0;
        const currentSurcharge = currentUsage ? Number(currentUsage.surcharge_total || 0) : 0;
        if (dTotal > 0 && maxDiscountDay != null && currentDiscount + dTotal > maxDiscountDay) {
            const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
            throw new Error(nextRole ? `Daily discount limit reached for your level. Please escalate to ${nextRole}.` : `Daily discount limit reached for your level.`);
        }
        if (sTotal > 0 && maxSurchargeDay != null && currentSurcharge + sTotal > maxSurchargeDay) {
            const nextRole = DiscountLimitService.getNextRoleInHierarchy(role);
            throw new Error(nextRole ? `Daily surcharge limit reached for your level. Please escalate to ${nextRole}.` : `Daily surcharge limit reached for your level.`);
        }
    }
}
exports.DiscountLimitService = DiscountLimitService;
