"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerBillingInit = void 0;
const SalesSessionRepo_1 = require("./repositories/SalesSessionRepo");
const billing_shared_types_1 = require("./billing_shared_types");
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const Billlingpackages_1 = require("./packages/Billlingpackages");
const billingstrategy_1 = __importDefault(require("../clincians/billingstrategy"));
const appset_1 = __importDefault(require("../application/appsettings/appset"));
const ReferralCodingRepo_1 = require("../referral/repositories/ReferralCodingRepo");
const services_1 = __importDefault(require("../services/services"));
const PrimeBillingPromoCodeRepo_1 = require("./repositories/PrimeBillingPromoCodeRepo");
const BillingModuleCodes = {
    MODULE_DEBT: 'outstanding debt found',
    MODULE_NO_SESSION: 'no active sales session found',
    MODULE_NO_VALID_BILLING_ID: 'no valid billing ID provided',
    MODULE_NO_PATIENT_ID: 'no patient ID provided',
    BILLINGSOURCE_NOT_PROVIDED: 'billing source not provided',
    NO_PACKAGES_FOUND_FOR_ENTITY: 'no packages found for entity',
    NO_PACKAGE_ID_SPECIFIED: 'no package id specified',
    INVALID_PACKAGE_PROVIDED: 'invalid package provided',
    BRANCH_ID_NOT_PROVIDED: 'branch id not provided',
};
class CustomerBillingInit {
    constructor(tenantId) {
        this.tenantId = tenantId;
    }
    async initCustomerBilling({ entityId, entityType, packageid, patientId, includeServices = false, isPackageUsed = false, billingid, branchid, billingSource, referalCode }) {
        const validationError = CustomerBillingInit.validateBillingInput({
            patientId,
            branchid,
            billingSource,
            cart: [], // No cart in init, but required by signature
            servicesList: [], // No servicesList in init, but required by signature
            errorCodes: {
                NO_PATIENT_ID: BillingModuleCodes.MODULE_NO_PATIENT_ID,
                NO_BRANCH_ID: BillingModuleCodes.BRANCH_ID_NOT_PROVIDED,
                NO_BILLING_SOURCE: BillingModuleCodes.BILLINGSOURCE_NOT_PROVIDED,
                CART_AND_SERVICES_EMPTY: "Cart and servicesList are both empty"
            }
        });
        if (validationError)
            return validationError;
        // Validate session
        const sessionError = await this.validateActiveSession(branchid, 'No active session');
        // if (sessionError) return sessionError;
        // Validate outstanding debt
        const debtError = await this.validateNoOutstandingDebt(patientId, BillingModuleCodes.MODULE_DEBT);
        if (debtError)
            return debtError;
        // Only check for required fields, not cart/servicesList, in initCustomerBilling
        if (!patientId)
            return BillingModuleCodes.MODULE_NO_PATIENT_ID;
        if (billingSource === undefined || billingSource === null)
            return BillingModuleCodes.BILLINGSOURCE_NOT_PROVIDED;
        if (branchid === undefined || branchid === null)
            return BillingModuleCodes.BRANCH_ID_NOT_PROVIDED;
        let defaultCustomerInitData = {
            testList: [],
            billingSource: billingSource,
            previousRecords: [],
            previousRecordsSummary: null,
            refundList: [],
            previousPaymentHistory: [],
            subtotal: 0,
            totalServiceAmount: 0,
            cart: [],
            totaldiscount: 0,
            totalAmountIncurredDueTax: 0,
            paid: 0,
            includeServices: !!includeServices,
            branchid,
            balance: 0,
            promoCode: undefined,
            servicesProvided: [],
            taxIncluded: false,
            billingid: billingid,
            packageid: packageid,
            isPackageUsed: isPackageUsed,
            hasNightAdjustment: false,
            nightAdjustmentValue: undefined,
            nightAdjustmentMode: undefined,
            patientId: patientId,
            taxValue: undefined,
            entityId: entityId,
            entityType: entityType,
            referalCode: referalCode,
        };
        const appsettings = await new appset_1.default().getAllAppSettings(this.tenantId);
        if (!appsettings)
            return [];
        const { includeTax, PaidBillsBeforeTransaction, billingsettings } = appsettings;
        if (PaidBillsBeforeTransaction === 1) {
            const outstanding = await this.calculateCustomerOutstandingDebt(patientId);
            if (outstanding && outstanding != 0)
                return BillingModuleCodes.MODULE_DEBT;
        }
        if (billingid !== undefined && (typeof billingid !== 'number' || isNaN(billingid)))
            return BillingModuleCodes.MODULE_NO_VALID_BILLING_ID;
        if (billingid !== undefined) {
            const conn = await (0, KnexConnections_1.default)(this.tenantId);
            const existing = await conn('billing').where('billingid', billingid).first();
            if (!existing)
                return BillingModuleCodes.MODULE_NO_VALID_BILLING_ID;
        }
        const hasDebt = await this.calculateCustomerOutstandingDebt(patientId);
        if (hasDebt)
            return BillingModuleCodes.MODULE_DEBT;
        const sessionRepo = new SalesSessionRepo_1.SalesSessionRepo(this.tenantId);
        const today = new Date();
        const sessionExists = await sessionRepo.hasActiveSessionForDate(today, branchid);
        // if (!sessionExists) return BillErrors.NoBillingSession;
        if (billingid !== undefined) {
            const conn = await (0, KnexConnections_1.default)(this.tenantId);
            const billing = await conn('billing').where('billingid', billingid).first();
            return billing;
        }
        if (isPackageUsed && !packageid)
            return BillingModuleCodes.NO_PACKAGE_ID_SPECIFIED;
        if (isPackageUsed && packageid) {
            const isPackageValid = await Billlingpackages_1.Packages.verifyPackageId(this.tenantId, packageid);
            if (!isPackageValid)
                return BillingModuleCodes.INVALID_PACKAGE_PROVIDED;
            const packageData = await Billlingpackages_1.Packages.getPackagesForEntity({
                entityId,
                entitytype: entityType,
                tenantId: this.tenantId,
                categorytrackid: billingSource
            });
            if (Array.isArray(packageData) && packageData.length === 0)
                return BillingModuleCodes.NO_PACKAGES_FOUND_FOR_ENTITY;
            else {
                const ApplicableTest = await Billlingpackages_1.Packages.getPackageTests(this.tenantId, packageid);
                if (Array.isArray(ApplicableTest) && ApplicableTest.length > 0) {
                    const reformattedTest = ApplicableTest.map(test => (Object.assign(Object.assign({}, test), { discountedValue: test.price, testid: test.test_id, discount: test.discount || 0 })));
                    // DRY: Always include constant data
                    const constants = await this.getConstantCustomerInitData(patientId, billingid);
                    return Object.assign(Object.assign(Object.assign({}, defaultCustomerInitData), constants), { packageid: packageid, isPackageUsed: true, testList: reformattedTest });
                }
                return [];
            }
        }
        if (defaultCustomerInitData.referalCode) {
            const referalCode = defaultCustomerInitData.referalCode;
            const referalRepo = await new ReferralCodingRepo_1.ReferralCodingRepo(this.tenantId).findByCode(parseInt(referalCode.toString(), 10));
            if (referalRepo) {
                defaultCustomerInitData.entityType = referalRepo.entity_type;
                defaultCustomerInitData.entityId = referalRepo.entity_id;
            }
        }
        let ApplicableTest = [];
        if ((!defaultCustomerInitData.entityType || defaultCustomerInitData.entityType == "general") && (!defaultCustomerInitData.entityId && !defaultCustomerInitData.referalCode)) {
            ApplicableTest = await new billingstrategy_1.default().getProvidentialBillingHandler(this.tenantId, 'general', null, true);
            defaultCustomerInitData.testList = ApplicableTest;
        }
        else {
            ApplicableTest = await new billingstrategy_1.default().getProvidentialBillingHandler(this.tenantId, defaultCustomerInitData.entityType, defaultCustomerInitData.entityId, true);
            defaultCustomerInitData.testList = ApplicableTest;
        }
        let previousRecords = [];
        if (billingid) {
            const conn = await (0, KnexConnections_1.default)(this.tenantId);
            previousRecords = await conn('dboservices').where('billingid', billingid).select();
        }
        defaultCustomerInitData.previousRecords = previousRecords;
        let previousPaymentHistory = [];
        if (billingid) {
            const conn = await (0, KnexConnections_1.default)(this.tenantId);
            previousPaymentHistory = await conn('billinghx').where('billingid', billingid).select();
        }
        defaultCustomerInitData.previousPaymentHistory = previousPaymentHistory;
        if (ApplicableTest && ApplicableTest.length > 0) {
            ApplicableTest = CustomerBillingInit.applyDiscountsToTests(ApplicableTest);
            defaultCustomerInitData.testList = ApplicableTest;
        }
        if (billingsettings && billingsettings.hasNightAdjustment) {
            ApplicableTest = CustomerBillingInit.applyNightAdjustmentsToTests(ApplicableTest, billingsettings);
            defaultCustomerInitData.testList = ApplicableTest;
            defaultCustomerInitData.hasNightAdjustment = true;
            defaultCustomerInitData.nightAdjustmentValue = billingsettings.nightAdjustmentValue ? Number(billingsettings.nightAdjustmentValue) : undefined;
            defaultCustomerInitData.nightAdjustmentMode = billingsettings.nightAdjustmentMode;
            defaultCustomerInitData.startTime = billingsettings.startTime;
            defaultCustomerInitData.endTime = billingsettings.endTime;
        }
        const taxation = await new appset_1.default().getAppBillSettings(this.tenantId);
        if (includeTax && includeTax === 1 && taxation && taxation.taxValue > 0) {
            ApplicableTest = CustomerBillingInit.applyTaxToTests(ApplicableTest, taxation.taxValue);
            defaultCustomerInitData.testList = ApplicableTest;
            defaultCustomerInitData.taxIncluded = true;
            taxation.taxValue = taxation.taxValue || 0;
        }
        if (includeServices) {
            let servicesList = await new services_1.default(0).getAllservices(this.tenantId, undefined, undefined);
            if (servicesList && Array.isArray(servicesList) && servicesList.length > 0) {
                // Always apply discount first
                servicesList = CustomerBillingInit.applyDiscountsToTests(servicesList);
                // Then night adjustment
                if (billingsettings && billingsettings.hasNightAdjustment) {
                    servicesList = CustomerBillingInit.applyNightAdjustmentsToTests(servicesList, billingsettings);
                }
                // Then tax
                if (includeTax && includeTax === 1 && taxation && taxation.taxValue > 0) {
                    servicesList = CustomerBillingInit.applyTaxToTests(servicesList, taxation.taxValue);
                }
            }
            defaultCustomerInitData.servicesList = servicesList;
        }
        defaultCustomerInitData.subtotal = 0;
        defaultCustomerInitData.totaldiscount = 0;
        defaultCustomerInitData.totalAmountIncurredDueTax = 0;
        let previousRecordsSummary = null;
        const conn = await (0, KnexConnections_1.default)(this.tenantId);
        const summary = await conn('billing').where('patientid', patientId).orderBy('billingid', 'desc').first();
        if (summary)
            previousRecordsSummary = summary;
        defaultCustomerInitData.previousRecordsSummary = previousRecordsSummary;
        defaultCustomerInitData.paid = (previousRecordsSummary === null || previousRecordsSummary === void 0 ? void 0 : previousRecordsSummary.paid) || 0;
        defaultCustomerInitData.balance = (previousRecordsSummary === null || previousRecordsSummary === void 0 ? void 0 : previousRecordsSummary.balance) || 0;
        if (!entityType || !entityId) {
            defaultCustomerInitData.entityType = "general";
            defaultCustomerInitData.entityId = null;
            defaultCustomerInitData.registrationType = "self";
        }
        let paymentModes = [];
        {
            const conn = await (0, KnexConnections_1.default)(this.tenantId);
            paymentModes = await conn('paymentModes').select();
        }
        defaultCustomerInitData.paymentModes = paymentModes;
        return defaultCustomerInitData;
    }
    async checkoutCustomerBilling({ patientId, billingid, cart, servicesList, paymentDetails, branchid, billingSource, referalCode, promoCode, isPromo, isPackageUsed, packageid }) {
        const validationError = CustomerBillingInit.validateBillingInput({
            patientId,
            branchid,
            billingSource,
            cart,
            servicesList,
            errorCodes: {
                NO_PATIENT_ID: 'No patientId provided',
                NO_BRANCH_ID: 'No branchid provided',
                NO_BILLING_SOURCE: 'No billingSource provided',
                CART_AND_SERVICES_EMPTY: 'Cart and servicesList are both empty'
            }
        });
        if (validationError)
            return { success: false, message: validationError };
        // Validate session
        const sessionError = await this.validateActiveSession(branchid, 'No active session');
        // if (sessionError) return { success: false, message: sessionError };
        // Validate outstanding debt
        const debtError = await this.validateNoOutstandingDebt(patientId, 'Outstanding debt found');
        if (debtError)
            return { success: false, message: debtError };
        // Get app settings for recalculation
        const appsettings = await new appset_1.default().getAllAppSettings(this.tenantId);
        const { includeTax, billingsettings } = appsettings || {};
        const taxation = appsettings ? await new appset_1.default().getAppBillSettings(this.tenantId) : {};
        let recalculatedCart = [];
        let recalculatedPackageList = [];
        let usedPackage = false;
        let taxIncluded = false;
        let taxList = undefined;
        let taxValue = undefined;
        // Helper to add night adjustment info to each item
        function addNightAdjustmentInfo(items, billingsettings) {
            if (!Array.isArray(items))
                return items;
            return items.map(item => (Object.assign(Object.assign({}, item), { hasNightAdjustment: !!(billingsettings && billingsettings.hasNightAdjustment), nightAdjustmentValue: billingsettings && billingsettings.hasNightAdjustment ? Number(billingsettings.nightAdjustmentValue) : undefined, nightAdjustmentMode: billingsettings && billingsettings.hasNightAdjustment ? billingsettings.nightAdjustmentMode : undefined, nightAdjustmentStartTime: billingsettings && billingsettings.hasNightAdjustment ? billingsettings.startTime : undefined, nightAdjustmentEndTime: billingsettings && billingsettings.hasNightAdjustment ? billingsettings.endTime : undefined })));
        }
        // If package billing, fetch and recalculate only selected package tests
        if (isPackageUsed && packageid) {
            const isPackageValid = await Billlingpackages_1.Packages.verifyPackageId(this.tenantId, packageid);
            if (!isPackageValid)
                return { success: false, message: 'Invalid package provided' };
            const allPackageTests = await Billlingpackages_1.Packages.getPackageTests(this.tenantId, packageid);
            if (!Array.isArray(allPackageTests) || allPackageTests.length === 0) {
                return { success: false, message: 'No tests found for package' };
            }
            // Only keep selected tests
            const selectedTestIds = cart.map(item => item.testid);
            recalculatedPackageList = allPackageTests
                .filter(test => selectedTestIds.includes(test.test_id))
                .map(test => {
                const cartItem = cart.find((c) => c.testid === test.test_id);
                let price = cartItem && typeof cartItem.price === 'number' ? cartItem.price : test.price;
                let discount = cartItem ? Number(cartItem.discount) : Number(test.discount) || 0;
                if (isNaN(discount))
                    discount = 0;
                return Object.assign(Object.assign({}, test), { price, discountedValue: price - discount, testid: test.test_id, discount });
            });
            recalculatedPackageList = CustomerBillingInit.applyDiscountsToTests(recalculatedPackageList);
            if (billingsettings && billingsettings.hasNightAdjustment) {
                recalculatedPackageList = CustomerBillingInit.applyNightAdjustmentsToTests(recalculatedPackageList, billingsettings);
            }
            if (includeTax && includeTax === 1 && taxation && taxation.taxValue > 0) {
                recalculatedPackageList = CustomerBillingInit.applyTaxToTests(recalculatedPackageList, taxation.taxValue);
                // defaultCustomerInitData.taxIncluded = true;
                // defaultCustomerInitData.taxList = taxation;
                taxIncluded = true;
                taxList = taxation;
            }
            recalculatedPackageList = addNightAdjustmentInfo(recalculatedPackageList, billingsettings);
            usedPackage = true;
        }
        else {
            // For each testid in cart, fetch from billing strategy/provincial billing
            const selectedTestIds = cart.map(item => item.testid);
            let allTests = [];
            if (selectedTestIds.length > 0) {
                // Try to get all available tests for this entity (provincial or general)
                let entityType = 'general';
                let entityId = null;
                if (referalCode) {
                    const referalRepo = await new ReferralCodingRepo_1.ReferralCodingRepo(this.tenantId).findByCode(parseInt(referalCode.toString(), 10));
                    if (referalRepo) {
                        entityType = referalRepo.entity_type;
                        entityId = referalRepo.entity_id;
                    }
                }
                allTests = await new billingstrategy_1.default().getProvidentialBillingHandler(this.tenantId, entityType, entityId, true);
            }
            recalculatedCart = allTests
                .filter(test => selectedTestIds.includes(test.testid))
                .map(test => {
                const cartItem = cart.find((c) => c.testid === test.testid);
                let price = cartItem && typeof cartItem.price === 'number' ? cartItem.price : test.price;
                let discount = cartItem ? Number(cartItem.discount) : Number(test.discount) || 0;
                if (isNaN(discount))
                    discount = 0;
                return Object.assign(Object.assign({}, test), { price, discountedValue: price - discount, discount });
            });
            recalculatedCart = CustomerBillingInit.applyDiscountsToTests(recalculatedCart);
            if (billingsettings && billingsettings.hasNightAdjustment) {
                recalculatedCart = CustomerBillingInit.applyNightAdjustmentsToTests(recalculatedCart, billingsettings);
            }
            if (includeTax && includeTax === 1 && taxation && taxation.taxValue > 0) {
                recalculatedCart = CustomerBillingInit.applyTaxToTests(recalculatedCart, taxation.taxValue);
                taxIncluded = true;
                taxList = taxation;
            }
            recalculatedCart = addNightAdjustmentInfo(recalculatedCart, billingsettings);
        }
        // For each id in servicesList, fetch from services
        let recalculatedServicesList = [];
        if (servicesList && Array.isArray(servicesList) && servicesList.length > 0) {
            // Support both 'id' and 'keyid' for matching
            const selectedServiceIds = servicesList.map(item => { var _a; return (_a = item.id) !== null && _a !== void 0 ? _a : item.keyid; });
            let allServices = await new services_1.default(0).getAllservices(this.tenantId, undefined, undefined);
            recalculatedServicesList = allServices
                .filter(service => { var _a; return selectedServiceIds.includes((_a = service.id) !== null && _a !== void 0 ? _a : service.keyid); })
                .map(service => {
                const serviceItem = servicesList.find((s) => { var _a, _b; return ((_a = s.id) !== null && _a !== void 0 ? _a : s.keyid) === ((_b = service.id) !== null && _b !== void 0 ? _b : service.keyid); });
                let servicePrice = serviceItem && typeof serviceItem.servicePrice === 'number' ? serviceItem.servicePrice : service.servicePrice;
                let discount = serviceItem ? Number(serviceItem.discount) : Number(service.discount) || 0;
                if (isNaN(discount))
                    discount = 0;
                return Object.assign(Object.assign({}, service), { servicePrice, discountedValue: servicePrice - discount, discount });
            });
            recalculatedServicesList = CustomerBillingInit.applyDiscountsToTests(recalculatedServicesList);
            if (billingsettings && billingsettings.hasNightAdjustment) {
                recalculatedServicesList = CustomerBillingInit.applyNightAdjustmentsToTests(recalculatedServicesList, billingsettings);
            }
            if (includeTax && includeTax === 1 && taxation && taxation.taxValue > 0) {
                recalculatedServicesList = CustomerBillingInit.applyTaxToTests(recalculatedServicesList, taxation.taxValue);
                taxIncluded = true;
                taxValue = taxation.taxValue;
            }
            recalculatedServicesList = addNightAdjustmentInfo(recalculatedServicesList, billingsettings);
        }
        // Calculate totals
        let subtotal = 0, totaldiscount = 0, totalAmountIncurredDueTax = 0, totalServiceAmount = 0;
        if (usedPackage) {
            recalculatedPackageList.forEach(item => {
                if (typeof item.discountedValue !== 'number') {
                    throw new Error('discountedValue must be present for all items in recalculatedPackageList');
                }
                subtotal += item.discountedValue;
                totaldiscount += item.discount || 0;
                totalAmountIncurredDueTax += item.amountIncurredDueTax || 0;
            });
        }
        else {
            recalculatedCart.forEach(item => {
                if (typeof item.discountedValue !== 'number') {
                    throw new Error('discountedValue must be present for all items in recalculatedCart');
                }
                subtotal += item.discountedValue;
                totaldiscount += item.discount || 0;
                totalAmountIncurredDueTax += item.amountIncurredDueTax || 0;
            });
        }
        if (recalculatedServicesList && Array.isArray(recalculatedServicesList)) {
            recalculatedServicesList.forEach(item => {
                if (typeof item.discountedValue !== 'number') {
                    throw new Error('discountedValue must be present for all items in recalculatedServicesList');
                }
                subtotal += item.discountedValue;
                totaldiscount += item.discount || 0;
                totalAmountIncurredDueTax += item.amountIncurredDueTax || 0;
                totalServiceAmount += item.discountedValue;
            });
        }
        // --- PROMO CODE VALIDATION ---
        let promoDiscount = 0;
        let promoValid = false;
        let promoDetails = null;
        if (isPromo && promoCode) {
            const promoRepo = new PrimeBillingPromoCodeRepo_1.PrimeBillingPromoCodeRepo(this.tenantId);
            const promoResult = await promoRepo.validatePromoCode(promoCode);
            promoValid = promoResult.valid;
            promoDetails = promoResult.promo;
            if (!promoValid) {
                return { success: false, message: promoResult.reason || 'Invalid promo code', data: { promoCode } };
            }
        }
        // --- APPLY BUSINESS RULES IN CORRECT ORDER ---
        // 1. Discounts
        // 2. Night Adjustment
        // 3. Promo (per item)
        // 4. Tax (last)
        // Helper to apply all steps to a list (cart, services, package)
        const applyAllSteps = (items) => {
            let result = CustomerBillingInit.applyDiscountsToTests(items);
            if (billingsettings && billingsettings.hasNightAdjustment) {
                result = CustomerBillingInit.applyNightAdjustmentsToTests(result, billingsettings);
            }
            // Apply promo per item if valid
            if (isPromo && promoValid && promoCode && promoDetails) {
                let totalPromo = 0;
                if (promoDetails.discount_type === 'percentage') {
                    const subtotal = result.reduce((sum, item) => sum + (item.discountedValue || 0), 0);
                    totalPromo = Number(((subtotal * promoDetails.discount_value / 100)).toFixed(2));
                }
                else if (promoDetails.discount_type === 'flat') {
                    totalPromo = Number(promoDetails.discount_value);
                }
                result = CustomerBillingInit.applyPromoToItems(result, totalPromo);
            }
            // Tax is always last
            if (includeTax && includeTax === 1 && taxation && taxation.taxValue > 0) {
                result = CustomerBillingInit.applyTaxToTests(result, taxation.taxValue);
            }
            return result;
        };
        // --- RECALCULATE CART, SERVICES, PACKAGE ---
        if (usedPackage) {
            recalculatedPackageList = applyAllSteps(recalculatedPackageList);
        }
        else {
            recalculatedCart = applyAllSteps(recalculatedCart);
        }
        if (recalculatedServicesList && Array.isArray(recalculatedServicesList)) {
            recalculatedServicesList = applyAllSteps(recalculatedServicesList);
        }
        // --- CALCULATE TOTALS ---
        // Remove duplicate variable declarations
        subtotal = 0;
        totaldiscount = 0;
        totalAmountIncurredDueTax = 0;
        totalServiceAmount = 0;
        if (usedPackage) {
            recalculatedPackageList.forEach(item => {
                subtotal += item.discountedValue || item.price || 0;
                totaldiscount += item.discount || 0;
                totalAmountIncurredDueTax += item.amountIncurredDueTax || 0;
            });
        }
        else {
            recalculatedCart.forEach(item => {
                subtotal += item.discountedValue || item.price || item.servicePrice || 0;
                totaldiscount += item.discount || 0;
                totalAmountIncurredDueTax += item.amountIncurredDueTax || 0;
            });
        }
        if (recalculatedServicesList && Array.isArray(recalculatedServicesList)) {
            recalculatedServicesList.forEach(item => {
                subtotal += item.discountedValue || item.price || item.servicePrice || 0;
                totaldiscount += item.discount || 0;
                totalAmountIncurredDueTax += item.amountIncurredDueTax || 0;
                totalServiceAmount += item.discountedValue || item.price || item.servicePrice || 0;
            });
        }
        // --- PROMO DISCOUNT (for reporting only) ---
        if (isPromo && promoValid && promoCode && promoDetails) {
            if (promoDetails.discount_type === 'percentage') {
                promoDiscount = Number(((subtotal * promoDetails.discount_value / 100)).toFixed(2));
            }
            else if (promoDetails.discount_type === 'flat') {
                promoDiscount = Number(promoDetails.discount_value);
            }
        }
        // --- FINAL AMOUNT PAYABLE ---
        const paid = paymentDetails && paymentDetails.amount ? paymentDetails.amount : 0;
        const amountPayable = subtotal + totalAmountIncurredDueTax;
        const balance = amountPayable - paid;
        // --- RETURN ---
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
    // --- REUSABLE BUSINESS RULES ---
    static applyAllBusinessRules(items, billingsettings, includeTax, taxation) {
        let result = CustomerBillingInit.applyDiscountsToTests(items);
        if (billingsettings && billingsettings.hasNightAdjustment) {
            result = CustomerBillingInit.applyNightAdjustmentsToTests(result, billingsettings);
        }
        if (includeTax && includeTax === 1 && taxation && taxation.taxValue > 0) {
            result = CustomerBillingInit.applyTaxToTests(result, taxation.taxValue);
        }
        return result;
    }
    static applyDiscountsToTests(tests) {
        return tests.map(test => {
            var _a;
            const discount = test.discount || 0;
            // Use servicePrice for services, price for tests
            const base = typeof test.servicePrice === 'number' ? test.servicePrice : ((_a = test.price) !== null && _a !== void 0 ? _a : 0);
            const discountedValue = base - discount;
            return Object.assign(Object.assign({}, test), { discountedValue, discount });
        });
    }
    // Refactored applyTaxToTests to compute totalcost and totalpayable correctly
    static applyTaxToTests(tests, taxValue) {
        if (!Array.isArray(tests) || !taxValue || taxValue <= 0)
            return tests;
        return tests.map(test => {
            var _a;
            // cost: base price before any discount/adjustment
            const cost = typeof test.servicePrice === 'number' ? test.servicePrice : ((_a = test.price) !== null && _a !== void 0 ? _a : 0);
            // Only apply night adjustment if isNightTime is true
            let nightAdjustment = 0;
            if (test.isNightTime) {
                if (typeof test.nightAdjustmentValue === 'number' && test.nightAdjustmentMode) {
                    if (test.nightAdjustmentMode === 'percentage') {
                        nightAdjustment = cost * (Number(test.nightAdjustmentValue) / 100);
                    }
                    else if (test.nightAdjustmentMode === 'absolute') {
                        nightAdjustment = Number(test.nightAdjustmentValue);
                    }
                }
            }
            // totalcost: cost + nightAdjustment + tax
            const preDiscountValue = cost + nightAdjustment;
            const taxAmount = Number(((preDiscountValue * taxValue) / 100).toFixed(2));
            const totalcost = Number((preDiscountValue + taxAmount).toFixed(2));
            // totalpayable: totalcost - discount - promo
            const discount = Number(test.discount || 0);
            const promo = Number(test.promoDiscount || 0);
            const totalpayable = Number((totalcost - discount - promo).toFixed(2));
            return Object.assign(Object.assign({}, test), { amountIncurredDueTax: taxAmount, totalcost,
                totalpayable,
                cost, discountedValue: totalpayable // Set discountedValue to totalpayable for frontend
             });
        });
    }
    static convertTo24Hour(hour, period) {
        if (typeof hour !== 'number')
            return 0;
        if (hour > 23)
            return hour % 24;
        if ((period === null || period === void 0 ? void 0 : period.toLowerCase()) === 'pm')
            return hour === 12 ? 12 : hour + 12;
        else if ((period === null || period === void 0 ? void 0 : period.toLowerCase()) === 'am')
            return hour === 12 ? 0 : hour;
        return hour;
    }
    static isNightTime(currentHour, startHour, endHour) {
        currentHour = currentHour % 24;
        startHour = startHour % 24;
        endHour = endHour % 24;
        if (startHour > endHour)
            return currentHour >= startHour || currentHour < endHour;
        return currentHour >= startHour && currentHour < endHour;
    }
    static applyNightAdjustmentsToTests(tests, billingsettings) {
        if (!Array.isArray(tests) || !billingsettings || !billingsettings.hasNightAdjustment)
            return tests;
        const { nightAdjustmentValue, nightAdjustmentMode, startTime, endTime } = billingsettings;
        const [startHour] = (startTime || "0:00").split(":").map(Number);
        const [endHour] = (endTime || "0:00").split(":").map(Number);
        const now = new Date();
        const currentHour = now.getHours();
        const isNight = this.isNightTime(currentHour, startHour, endHour);
        return tests.map(test => {
            var _a;
            // Always use the original base (servicePrice or price) minus discount
            const base = typeof test.servicePrice === 'number' ? test.servicePrice : ((_a = test.price) !== null && _a !== void 0 ? _a : 0);
            const discount = Number(test.discount || 0);
            const discountedBase = base - discount;
            if (!isNight) {
                // If not night, do NOT apply night adjustment, and set discountedValue to discountedBase
                return Object.assign(Object.assign({}, test), { discountedValue: discountedBase, isNightTime: false });
            }
            let adjustedValue = discountedBase;
            if (nightAdjustmentMode === "percentage") {
                adjustedValue = Number((discountedBase + (discountedBase * Number(nightAdjustmentValue) / 100)).toFixed(2));
            }
            else if (nightAdjustmentMode === "absolute") {
                adjustedValue = Number((discountedBase + Number(nightAdjustmentValue)).toFixed(2));
            }
            return Object.assign(Object.assign({}, test), { discountedValue: adjustedValue, isNightTime: true });
        });
    }
    async calculateCustomerOutstandingDebt(patientId) {
        const conn = await (0, KnexConnections_1.default)(this.tenantId);
        const result = await conn("billing").where("patientid", patientId).sum("outstanding as totalOutstanding").first();
        return result === null || result === void 0 ? void 0 : result.totalOutstanding;
    }
    async hasOutstandingDebt(patientId) {
        return await this.calculateCustomerOutstandingDebt(patientId) > 0;
    }
    /**
    * Validates if there is an active session for the branch today.
    */
    async validateActiveSession(branchid, errorMsg = 'No active session') {
        const sessionRepo = new SalesSessionRepo_1.SalesSessionRepo(this.tenantId);
        const today = new Date();
        const sessionExists = await sessionRepo.hasActiveSessionForDate(today, branchid);
        if (!sessionExists)
            return errorMsg;
        return null;
    }
    /**
     * Validates that the patient has no outstanding debt.
     */
    async validateNoOutstandingDebt(patientId, errorMsg = 'Outstanding debt found') {
        const conn = await (0, KnexConnections_1.default)(this.tenantId);
        const result = await conn("billing").where("patientid", patientId).sum("outstanding as totalOutstanding").first();
        if ((result === null || result === void 0 ? void 0 : result.totalOutstanding) && Number(result.totalOutstanding) > 0)
            return errorMsg;
        return null;
    }
    /**
    * Static utility for validating billing input fields.
    */
    static validateBillingInput({ patientId, branchid, billingSource, cart, servicesList, errorCodes }) {
        if (!patientId)
            return errorCodes.NO_PATIENT_ID;
        if (branchid === undefined || branchid === null)
            return errorCodes.NO_BRANCH_ID;
        if (billingSource === undefined || billingSource === null)
            return errorCodes.NO_BILLING_SOURCE;
        return null;
    }
    // DRY: Helper to fetch constant data for init response
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
    /**
    * Distribute promo discount proportionally to each item based on discountedValue
    */
    static applyPromoToItems(items, totalPromoDiscount) {
        if (!Array.isArray(items) || !totalPromoDiscount || totalPromoDiscount <= 0)
            return items;
        const total = items.reduce((sum, item) => sum + (item.discountedValue || 0), 0);
        if (total === 0)
            return items;
        let distributed = 0;
        const result = items.map((item, idx) => {
            const share = idx === items.length - 1
                ? totalPromoDiscount - distributed // last item gets the remainder
                : Number(((item.discountedValue || 0) / total * totalPromoDiscount).toFixed(2));
            distributed += share;
            return Object.assign(Object.assign({}, item), { promoDiscount: share, discountedValue: Number(((item.discountedValue || 0) - share).toFixed(2)), discount: Number(((item.discount || 0) + share).toFixed(2)) });
        });
        return result;
    }
}
exports.CustomerBillingInit = CustomerBillingInit;
CustomerBillingInit.BillingModuleCodes = BillingModuleCodes;
CustomerBillingInit.BillErrors = billing_shared_types_1.BillErrors;
