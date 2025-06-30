"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerBillingInit = void 0;
const SalesSessionRepo_1 = require("../repositories/SalesSessionRepo");
const billing_shared_types_1 = require("./billing_shared_types");
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const billingstrategy_1 = __importDefault(require("../../clincians/billingstrategy"));
const appset_1 = __importDefault(require("../../application/appsettings/appset"));
const ReferralCodingRepo_1 = require("../../referral/repositories/ReferralCodingRepo");
const billingTypes_1 = require("./billingTypes");
const packageBillingHelper_1 = require("./packageBillingHelper");
const PrimeBillingEnterprise_1 = require("./PrimeBillingEnterprise");
class CustomerBillingInitSingleton extends PrimeBillingEnterprise_1.PrimeBillingEnterprise {
    constructor(tenantId) {
        super(tenantId);
        this.tenantId = tenantId;
    }
    static getInstance(tenantId) {
        if (!CustomerBillingInitSingleton.instance || CustomerBillingInitSingleton.instance.tenantId !== tenantId) {
            CustomerBillingInitSingleton.instance = new CustomerBillingInitSingleton(tenantId);
        }
        return CustomerBillingInitSingleton.instance;
    }
    async init(params) {
        const validationError = CustomerBillingInitSingleton.validateBillingInput({
            patientId: params.patientId,
            branchid: params.branchid,
            billingSource: params.billingSource,
            cart: [],
            servicesList: [],
            errorCodes: {
                NO_PATIENT_ID: billingTypes_1.BillingModuleCodes.MODULE_NO_PATIENT_ID,
                NO_BRANCH_ID: billingTypes_1.BillingModuleCodes.BRANCH_ID_NOT_PROVIDED,
                NO_BILLING_SOURCE: billingTypes_1.BillingModuleCodes.BILLINGSOURCE_NOT_PROVIDED,
                CART_AND_SERVICES_EMPTY: "Cart and servicesList are both empty"
            }
        });
        if (validationError)
            return validationError;
        if (!params.patientId)
            return billingTypes_1.BillingModuleCodes.MODULE_NO_PATIENT_ID;
        if (params.billingSource === undefined || params.billingSource === null)
            return billingTypes_1.BillingModuleCodes.BILLINGSOURCE_NOT_PROVIDED;
        if (params.branchid === undefined || params.branchid === null)
            return billingTypes_1.BillingModuleCodes.BRANCH_ID_NOT_PROVIDED;
        const [sessionExists, hasDebt, appsettings, taxation, paymentModes] = await Promise.all([
            this.hasActiveSession(params.branchid),
            this.hasOutstandingDebt(params.patientId),
            new appset_1.default().getAllAppSettings(this.tenantId),
            new appset_1.default().getAppBillSettings(this.tenantId),
            this.getPaymentModes()
        ]);
        // if (!sessionExists) return BillingModuleCodes.MODULE_NO_SESSION;
        let previousRecordsSummary = null;
        if (params.billingid) {
            previousRecordsSummary = this.previousBillingSummary(params.billingid);
        }
        if (hasDebt)
            return billingTypes_1.BillingModuleCodes.MODULE_DEBT;
        if (!appsettings)
            return [];
        if (params.billingid !== undefined && (typeof params.billingid !== 'number' || isNaN(params.billingid)))
            return billingTypes_1.BillingModuleCodes.MODULE_NO_VALID_BILLING_ID;
        if (params.isPackageUsed && !params.packageid)
            return billingTypes_1.BillingModuleCodes.NO_PACKAGE_ID_SPECIFIED;
        let defaultCustomerInitData = this.getDefaultCustomerInitData(params, previousRecordsSummary);
        if (params.isPackageUsed && params.packageid) {
            return await packageBillingHelper_1.PackageBillingHelper.handlePackageInit({
                tenantId: this.tenantId,
                packageid: params.packageid,
                patientId: params.patientId,
                billingid: params.billingid,
                defaultCustomerInitData,
                getConstantCustomerInitData: this.getConstantCustomerInitData.bind(this)
            });
        }
        await this.handleReferralCode(defaultCustomerInitData);
        await this.handleApplicableTests(defaultCustomerInitData, appsettings, taxation, params.isPackageUsed);
        await this.handleServices(defaultCustomerInitData, appsettings, taxation, params.includeServices);
        await this.finalizePromoLogic(defaultCustomerInitData);
        this.setSummaryAndPayment(defaultCustomerInitData, previousRecordsSummary, paymentModes, params);
        return defaultCustomerInitData;
    }
    async hasActiveSession(branchid) {
        const sessionRepo = new SalesSessionRepo_1.SalesSessionRepo(this.tenantId);
        const today = new Date();
        return await sessionRepo.hasActiveSessionForDate(today, branchid);
    }
    getDefaultCustomerInitData(params, previousRecordsSummary) {
        return {
            testList: [],
            billingSource: params.billingSource,
            previousRecords: [],
            previousRecordsSummary: previousRecordsSummary,
            refundList: [],
            previousPaymentHistory: [],
            subtotal: 0,
            packageTestList: [],
            totalServiceAmount: 0,
            cart: [],
            totaldiscount: 0,
            totalAmountIncurredDueTax: 0,
            paid: 0,
            includeServices: !!params.includeServices,
            branchid: params.branchid,
            balance: 0,
            promoCode: undefined,
            servicesProvided: [],
            taxIncluded: false,
            billingid: params.billingid,
            packageid: params.packageid,
            isPackageUsed: params.isPackageUsed,
            hasNightAdjustment: false,
            nightAdjustmentValue: 0,
            nightAdjustmentMode: 'none',
            patientId: params.patientId,
            taxValue: 0,
            entityId: params.entityId,
            entityType: params.entityType,
            referalCode: params.referalCode,
            totalcost: 0,
            totalServiceAmountPayable: 0,
            amountPayable: 0,
        };
    }
    async handleReferralCode(defaultCustomerInitData) {
        if (defaultCustomerInitData.referalCode) {
            const referalRepo = await new ReferralCodingRepo_1.ReferralCodingRepo(this.tenantId).findByCode(parseInt(defaultCustomerInitData.referalCode.toString(), 10));
            if (referalRepo) {
                defaultCustomerInitData.entityType = referalRepo.entity_type;
                defaultCustomerInitData.entityId = referalRepo.entity_id;
            }
        }
    }
    async handleApplicableTests(defaultCustomerInitData, appsettings, taxation, isPackageUsed) {
        let ApplicableTest = [];
        if ((!defaultCustomerInitData.entityType || defaultCustomerInitData.entityType == "general") && (!defaultCustomerInitData.entityId && !defaultCustomerInitData.referalCode)) {
            ApplicableTest = await new billingstrategy_1.default().getProvidentialBillingHandler(this.tenantId, 'general', null, true);
        }
        else {
            ApplicableTest = await new billingstrategy_1.default().getProvidentialBillingHandler(this.tenantId, defaultCustomerInitData.entityType, defaultCustomerInitData.entityId, true);
        }
        if (defaultCustomerInitData.promoCode && defaultCustomerInitData.promoCode.value && defaultCustomerInitData.promoCode.type) {
            // Only apply promo, not regular discounts
            ApplicableTest = PrimeBillingEnterprise_1.PrimeBillingEnterprise.applyPromoToItems(ApplicableTest, defaultCustomerInitData.promoCode);
        }
        else {
            ApplicableTest = PrimeBillingEnterprise_1.PrimeBillingEnterprise.applyDiscountsToTests(ApplicableTest);
        }
        if (appsettings.billingsettings && appsettings.billingsettings.hasNightAdjustment && !isPackageUsed) {
            ApplicableTest = PrimeBillingEnterprise_1.PrimeBillingEnterprise.applyNightAdjustmentsToTests(ApplicableTest, appsettings.billingsettings, 'test');
            defaultCustomerInitData.hasNightAdjustment = true;
            defaultCustomerInitData.nightAdjustmentValue = appsettings.billingsettings.nightAdjustmentValue ? Number(appsettings.billingsettings.nightAdjustmentValue) : undefined;
            defaultCustomerInitData.nightAdjustmentMode = appsettings.billingsettings.nightAdjustmentMode;
            defaultCustomerInitData.startTime = appsettings.billingsettings.startTime;
            defaultCustomerInitData.endTime = appsettings.billingsettings.endTime;
        }
        if (appsettings.includeTax && appsettings.includeTax === 1 && taxation && taxation.taxValue > 0) {
            ApplicableTest = PrimeBillingEnterprise_1.PrimeBillingEnterprise.applyTaxToTests(ApplicableTest, taxation.taxValue);
            defaultCustomerInitData.taxIncluded = true;
            taxation.taxValue = taxation.taxValue || 0;
        }
        defaultCustomerInitData.testList = ApplicableTest;
    }
    async handleServices(defaultCustomerInitData, appsettings, taxation, includeServices) {
        if (!includeServices)
            return;
        const servicesList = await PrimeBillingEnterprise_1.PrimeBillingEnterprise.recalculateInitServicesList(this.tenantId, appsettings, taxation);
        defaultCustomerInitData.servicesList = servicesList;
    }
    async finalizePromoLogic(defaultCustomerInitData) {
        if (!defaultCustomerInitData || !defaultCustomerInitData.testList || !Array.isArray(defaultCustomerInitData.testList))
            return;
        let items = defaultCustomerInitData.testList;
        const billingsettings = defaultCustomerInitData.billingsettings || {};
        const promo = defaultCustomerInitData.promoCode;
        const taxValue = defaultCustomerInitData.taxValue || 0;
        if (billingsettings && billingsettings.hasNightAdjustment) {
            items = PrimeBillingEnterprise_1.PrimeBillingEnterprise.applyNightAdjustmentsToTests(items, billingsettings, 'test');
        }
        items = PrimeBillingEnterprise_1.PrimeBillingEnterprise.applyDiscountsToTests(items);
        if (promo && promo.value && promo.type) {
            items = PrimeBillingEnterprise_1.PrimeBillingEnterprise.applyPromoToItems(items, promo);
        }
        if (taxValue > 0) {
            items = PrimeBillingEnterprise_1.PrimeBillingEnterprise.applyTaxToTests(items, taxValue);
        }
        defaultCustomerInitData.testList = items;
    }
    setSummaryAndPayment(defaultCustomerInitData, previousRecordsSummary, paymentModes, params) {
        defaultCustomerInitData.subtotal = 0;
        defaultCustomerInitData.totaldiscount = 0;
        defaultCustomerInitData.totalAmountIncurredDueTax = 0;
        defaultCustomerInitData.totalcost = 0;
        defaultCustomerInitData.cost = 0;
        defaultCustomerInitData.amountPayable = 0;
        defaultCustomerInitData.totalAmountIncurredDueTax = 0;
        defaultCustomerInitData.previousRecordsSummary = previousRecordsSummary;
        defaultCustomerInitData.paid = (previousRecordsSummary === null || previousRecordsSummary === void 0 ? void 0 : previousRecordsSummary.paid) || 0;
        defaultCustomerInitData.balance = (previousRecordsSummary === null || previousRecordsSummary === void 0 ? void 0 : previousRecordsSummary.balance) || 0;
        if (!params.entityType || !params.entityId) {
            defaultCustomerInitData.entityType = "general";
            defaultCustomerInitData.entityId = null;
            defaultCustomerInitData.registrationType = "self";
        }
        defaultCustomerInitData.paymentModes = paymentModes;
    }
    async getPaymentModes() {
        const conn = await (0, KnexConnections_1.default)(this.tenantId);
        return await conn('paymentModes').select();
    }
    async getConstantCustomerInitData(patientId, billingid) {
        const conn = await (0, KnexConnections_1.default)(this.tenantId);
        const paymentModes = await conn('paymentModes').select();
        let previousRecords = [];
        if (billingid) {
            previousRecords = await conn('dboservices').where('billingid', billingid).select();
        }
        let previousPaymentHistory = [];
        if (billingid) {
            previousPaymentHistory = await conn('billinghx').where('billingid', billingid).select();
        }
        let previousRecordsSummary = null;
        const summary = await conn('billing').where('patientid', patientId).orderBy('billingid', 'desc').first();
        if (summary)
            previousRecordsSummary = summary;
        return { paymentModes, previousRecords, previousRecordsSummary, previousPaymentHistory };
    }
}
CustomerBillingInitSingleton.BillingModuleCodes = billingTypes_1.BillingModuleCodes;
CustomerBillingInitSingleton.BillErrors = billing_shared_types_1.BillErrors;
exports.CustomerBillingInit = CustomerBillingInitSingleton;
