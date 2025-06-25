"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimeBillingEnterprise = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const appset_1 = __importDefault(require("../application/appsettings/appset"));
const billingstrategy_1 = __importDefault(require("../clincians/billingstrategy"));
const ReferralCodingRepo_1 = require("../referral/repositories/ReferralCodingRepo");
const services_1 = __importDefault(require("../services/services"));
const SalesSessionRepo_1 = require("./repositories/SalesSessionRepo");
class PrimeBillingEnterprise {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(this.tenantId);
    }
    async getAppSettings() {
        return await new appset_1.default().getAllAppSettings(this.tenantId);
    }
    async getAppBillSettings() {
        return await new appset_1.default().getAppBillSettings(this.tenantId);
    }
    async getCustomerOutstandingDebt(patientId) {
        const conn = await (0, KnexConnections_1.default)(this.tenantId);
        const result = await conn("billing").where("patientid", patientId).sum("outstanding as totalOutstanding").first();
        return (result === null || result === void 0 ? void 0 : result.totalOutstanding) || 0;
    }
    async hasOutstandingDebt(patientId) {
        return await this.getCustomerOutstandingDebt(patientId) > 0;
    }
    async validateActiveSession(branchid, errorMsg = 'No active session') {
        const sessionRepo = new SalesSessionRepo_1.SalesSessionRepo(this.tenantId);
        const today = new Date();
        const sessionExists = await sessionRepo.hasActiveSessionForDate(today, branchid);
        if (!sessionExists)
            return errorMsg;
        return null;
    }
    async validateNoOutstandingDebt(patientId, errorMsg = 'Outstanding debt found') {
        const conn = await (0, KnexConnections_1.default)(this.tenantId);
        const result = await conn("billing").where("patientid", patientId).sum("outstanding as totalOutstanding").first();
        if ((result === null || result === void 0 ? void 0 : result.totalOutstanding) && Number(result.totalOutstanding) > 0)
            return errorMsg;
        return null;
    }
    async getReferralByCode(referalCode) {
        return await new ReferralCodingRepo_1.ReferralCodingRepo(this.tenantId).findByCode(parseInt(referalCode.toString(), 10));
    }
    async getAllServices() {
        return await new services_1.default(0).getAllservices(this.tenantId, undefined, undefined);
    }
    async getBillingHandler(entityType, entityId) {
        return await new billingstrategy_1.default().getProvidentialBillingHandler(this.tenantId, entityType, entityId, true);
    }
    async applyDiscountsToTests(tests, type) {
        return tests.map(test => {
            var _a;
            const discount = test.discount || 0;
            const base = type === 'test' ? test.actualPrice : ((_a = test.servicePrice) !== null && _a !== void 0 ? _a : 0);
            const discountedValue = base - discount;
            return Object.assign(Object.assign({}, test), { discountedValue, discount });
        });
    }
    static applyPromoToItems(items, promo) {
        if (!Array.isArray(items) || !promo || !promo.value || promo.value <= 0)
            return items;
        if (items.length === 0)
            return items;
        if (promo.type === 'percentage') {
            return items.map(item => {
                const base = item.discountedValue || 0;
                const share = Number(((base * promo.value) / 100).toFixed(2));
                return Object.assign(Object.assign({}, item), { promoDiscount: share, discountedValue: Number((base - share).toFixed(2)), discount: Number(((item.discount || 0) + share).toFixed(2)) });
            });
        }
        else if (promo.type === 'flat') {
            const totalPromoDiscount = Number(promo.value);
            const perItem = Number((totalPromoDiscount / items.length).toFixed(2));
            let distributed = 0;
            return items.map((item, idx) => {
                const base = item.discountedValue || 0;
                const share = idx === items.length - 1
                    ? Number((totalPromoDiscount - distributed).toFixed(2))
                    : perItem;
                distributed += share;
                return Object.assign(Object.assign({}, item), { promoDiscount: share, discountedValue: Number((base - share).toFixed(2)), discount: Number(((item.discount || 0) + share).toFixed(2)) });
            });
        }
        return items;
    }
    static calculatePromoDiscount(subtotal, promoDetails) {
        if (!promoDetails || !promoDetails.discount_value || promoDetails.discount_value <= 0)
            return 0;
        if (promoDetails.discount_type === 'percentage') {
            return Number(((subtotal * promoDetails.discount_value) / 100).toFixed(2));
        }
        else if (promoDetails.discount_type === 'flat') {
            return Number(promoDetails.discount_value);
        }
        return 0;
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
    static isNightTime(billingsettings) {
        const { startTime, endTime } = billingsettings;
        const now = new Date();
        const currentHour = now.getHours();
        const [startHour] = (startTime || "0:00").split(":").map(Number);
        const [endHour] = (endTime || "0:00").split(":").map(Number);
        const sHour = startHour % 24;
        const eHour = endHour % 24;
        if (sHour > eHour)
            return currentHour >= sHour || currentHour < eHour;
        return currentHour >= sHour && currentHour < eHour;
    }
    static applyNightAdjustmentsToTests(tests, billingsettings, type) {
        if (!Array.isArray(tests) || !billingsettings || !billingsettings.hasNightAdjustment)
            return tests;
        const { nightAdjustmentValue, nightAdjustmentMode } = billingsettings;
        const isNight = this.isNightTime(billingsettings);
        return tests.map(test => {
            const base = test.discountedValue;
            const discount = Number(test.discount || 0);
            const discountedBase = base - discount;
            if (!isNight) {
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
    static applyDiscountsToTests(tests) {
        return tests.map(test => {
            console.log("Applying discount to test:", test);
            const discount = test.discount || 0;
            const base = test.discountedValue;
            const discountedValue = base - discount;
            return Object.assign(Object.assign({}, test), { discountedValue, discount });
        });
    }
    static applyTaxToTests(tests, taxValue) {
        if (!Array.isArray(tests) || !taxValue || taxValue <= 0)
            return tests;
        return tests.map(test => {
            const preDiscountValue = test.discountedValue;
            const taxAmount = Number(((preDiscountValue * taxValue) / 100).toFixed(2));
            const totalcost = Number((preDiscountValue + taxAmount).toFixed(2));
            const discount = Number(test.discount || 0);
            const promo = Number(test.promoDiscount || 0);
            const totalpayable = Number((totalcost - discount - promo).toFixed(2));
            return Object.assign(Object.assign({}, test), { amountIncurredDueTax: taxAmount, totalcost,
                totalpayable, discountedValue: totalpayable });
        });
    }
    static calculatePackageConcessionDiscountedValue(price, concessionMode, concessionValue) {
        if (!price || !concessionMode || !concessionValue)
            return price;
        const value = typeof concessionValue === 'string' ? parseFloat(concessionValue) : concessionValue;
        if (concessionMode === 'absolute') {
            return Math.max(0, price - value);
        }
        else if (concessionMode === 'percentage') {
            return Math.max(0, price - (price * value / 100));
        }
        return price;
    }
    static validateBillingInput({ patientId, branchid, billingSource, errorCodes }) {
        if (!patientId)
            return errorCodes.NO_PATIENT_ID;
        if (branchid === undefined || branchid === null)
            return errorCodes.NO_BRANCH_ID;
        if (billingSource === undefined || billingSource === null)
            return errorCodes.NO_BILLING_SOURCE;
        return null;
    }
    static reformatServicesList(servicesList, isNightTime, taxList, taxValue) {
        if (!Array.isArray(servicesList))
            return [];
        return servicesList.map(service => (Object.assign(Object.assign({}, service), { id: service.serviceid, name: service.serviceName, price: service.servicePrice, originalPrice: service.servicePrice, totalpayable: service.servicePrice, totalcost: service.servicePrice, discountedValue: service.servicePrice, actualPrice: service.servicePrice, concessionMode: "absolute", concessionValue: 0, discount: 0, hasNightAdjustment: false, nightAdjustmentEndTime: '', nightAdjustmentMode: 'none', nightAdjustmentStartTime: '', nightAdjustmentValue: 0, isoutsourced: 0, amountIncurredDueTax: 0, isNightTime: isNightTime, pricingType: 'service', trackId: service.keyid, taxList,
            taxValue })));
    }
    static calculateBillingTotals({ usedPackage, recalculatedPackageList, recalculatedCart, recalculatedServicesList }) {
        let subtotal = 0, totaldiscount = 0, totalAmountIncurredDueTax = 0, totalServiceAmount = 0;
        if (usedPackage) {
            recalculatedPackageList.forEach(item => {
                subtotal += item.discountedValue;
                totaldiscount += item.discount || 0;
            });
        }
        else {
            recalculatedCart.forEach(item => {
                subtotal += item.discountedValue || item.servicePrice || 0;
                totaldiscount += item.discount || 0;
                totalAmountIncurredDueTax += item.amountIncurredDueTax || 0;
            });
        }
        if (recalculatedServicesList && Array.isArray(recalculatedServicesList)) {
            recalculatedServicesList.forEach(item => {
                subtotal += item.discountedValue || item.servicePrice || 0;
                totaldiscount += item.discount || 0;
                totalAmountIncurredDueTax += item.amountIncurredDueTax || 0;
                totalServiceAmount += item.discountedValue || item.price || item.servicePrice || 0;
            });
        }
        return { subtotal, totaldiscount, totalAmountIncurredDueTax, totalServiceAmount };
    }
    static addNightAdjustmentInfo(items, billingsettings) {
        if (!Array.isArray(items))
            return items;
        return items.map(item => (Object.assign(Object.assign({}, item), { hasNightAdjustment: !!(billingsettings && billingsettings.hasNightAdjustment), nightAdjustmentValue: billingsettings && billingsettings.hasNightAdjustment ? Number(billingsettings.nightAdjustmentValue) : undefined, nightAdjustmentMode: billingsettings && billingsettings.hasNightAdjustment ? billingsettings.nightAdjustmentMode : undefined, nightAdjustmentStartTime: billingsettings && billingsettings.hasNightAdjustment ? billingsettings.startTime : undefined, nightAdjustmentEndTime: billingsettings && billingsettings.hasNightAdjustment ? billingsettings.endTime : undefined })));
    }
    async handleServices(defaultCustomerInitData, appsettings, taxation, includeServices) {
        if (!includeServices)
            return;
        const servicesList = await this.recalculateInitServicesList(appsettings, taxation);
        defaultCustomerInitData.servicesList = servicesList;
    }
    async recalculateInitServicesList(appsettings, taxation) {
        let servicesList = await new services_1.default(0).getAllservices(this.tenantId, undefined, undefined);
        if (servicesList && Array.isArray(servicesList) && servicesList.length > 0) {
            servicesList = PrimeBillingEnterprise.reformatServicesList(servicesList, PrimeBillingEnterprise.isNightTime(appsettings.billingsettings), '', taxation.taxValue);
            servicesList = PrimeBillingEnterprise.applyNightAdjustmentsToTests(servicesList, appsettings.billingsettings, 'services');
            servicesList = PrimeBillingEnterprise.applyDiscountsToTests(servicesList);
            if (appsettings.includeTax && appsettings.includeTax === 1 && taxation && taxation.taxValue > 0) {
                servicesList = PrimeBillingEnterprise.applyTaxToTests(servicesList, taxation.taxValue);
            }
        }
        return servicesList;
    }
    static async recalculateInitServicesList(tenantId, appsettings, taxation) {
        let servicesList = await new services_1.default(0).getAllservices(tenantId, undefined, undefined);
        if (servicesList && Array.isArray(servicesList) && servicesList.length > 0) {
            servicesList = PrimeBillingEnterprise.reformatServicesList(servicesList, PrimeBillingEnterprise.isNightTime(appsettings.billingsettings), '', taxation.taxValue);
            servicesList = PrimeBillingEnterprise.applyNightAdjustmentsToTests(servicesList, appsettings.billingsettings, 'services');
            servicesList = PrimeBillingEnterprise.applyDiscountsToTests(servicesList);
            if (appsettings.includeTax && appsettings.includeTax === 1 && taxation && taxation.taxValue > 0) {
                servicesList = PrimeBillingEnterprise.applyTaxToTests(servicesList, taxation.taxValue);
            }
        }
        return servicesList;
    }
    static async recalculateServicesList({ billing, servicesList, billingsettings, isPromo, promoValid, promoCode, promoDetails, includeTax, taxation }) {
        if (!servicesList || !Array.isArray(servicesList) || servicesList.length === 0)
            return [];
        const selectedServiceIds = servicesList.map((item) => { var _a; return (_a = item.id) !== null && _a !== void 0 ? _a : item.keyid; });
        const allServices = await billing.getAllServices();
        if (!Array.isArray(allServices) || allServices.length === 0)
            return [];
        let recalculatedServicesList = allServices
            .filter((service) => { var _a; return selectedServiceIds.includes((_a = service.id) !== null && _a !== void 0 ? _a : service.keyid); })
            .map((service) => (Object.assign(Object.assign({}, service), { discountedValue: service.servicePrice, discount: service.discount || 0, amountIncurredDueTax: 0, totalcost: null, totalpayable: null, promoDiscount: 0, isNightTime: false })));
        if (billingsettings && billingsettings.hasNightAdjustment) {
            recalculatedServicesList = PrimeBillingEnterprise.applyNightAdjustmentsToTests(recalculatedServicesList, billingsettings, 'services');
        }
        recalculatedServicesList = PrimeBillingEnterprise.applyDiscountsToTests(recalculatedServicesList);
        if (isPromo && promoValid && promoCode && promoDetails) {
            recalculatedServicesList = PrimeBillingEnterprise.applyPromoToItems(recalculatedServicesList, { type: promoDetails.discount_type, value: promoDetails.discount_value });
        }
        if (includeTax && includeTax === 1 && taxation && taxation.taxValue > 0) {
            recalculatedServicesList = PrimeBillingEnterprise.applyTaxToTests(recalculatedServicesList, taxation.taxValue);
        }
        return PrimeBillingEnterprise.addNightAdjustmentInfo(recalculatedServicesList, billingsettings);
    }
}
exports.PrimeBillingEnterprise = PrimeBillingEnterprise;
