"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageBillingHelper = void 0;
const Billlingpackages_1 = require("./packages/Billlingpackages");
const PrimeBillingEnterprise_1 = require("./PrimeBillingEnterprise");
class PackageBillingHelper extends PrimeBillingEnterprise_1.PrimeBillingEnterprise {
    static async getFormattedPackageTestList({ tenantId, packageid, }) {
        const isPackageValid = await Billlingpackages_1.Packages.verifyPackageId(tenantId, packageid);
        if (!isPackageValid)
            return null;
        const allPackageTests = await Billlingpackages_1.Packages.getPackageTests(tenantId, packageid);
        if (!Array.isArray(allPackageTests) || allPackageTests.length === 0)
            return null;
        let reformttedPackage = allPackageTests.map((_package, index) => {
            const discountedValue = PrimeBillingEnterprise_1.PrimeBillingEnterprise.calculatePackageConcessionDiscountedValue(_package.price, _package.concession_mode, _package.concession_value);
            return Object.assign(Object.assign({}, _package), { discountedValue, discount: _package.discount || 0, testid: _package.test_id });
        });
        reformttedPackage = reformttedPackage.map(item => (Object.assign(Object.assign({}, item), { hasNightAdjustment: false, isNightTime: false, amountIncurredDueTax: 0, totalcost: item.discountedValue, totalpayable: item.discountedValue, cost: item.discountedValue })));
        return reformttedPackage;
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
    static async handlePackageCheckout({ tenantId, packageid, cart }) {
        const isPackageValid = await Billlingpackages_1.Packages.verifyPackageId(tenantId, packageid);
        if (!isPackageValid)
            return { success: false, message: 'Invalid package provided' };
        const allPackageTests = await Billlingpackages_1.Packages.getPackageTests(tenantId, packageid);
        if (!Array.isArray(allPackageTests) || allPackageTests.length === 0) {
            return { success: false, message: 'No tests found for package' };
        }
        const selectedTestIds = cart.map(item => item.testid);
        let recalculatedPackageList = allPackageTests
            .filter(test => selectedTestIds.includes(test.test_id))
            .map(test => (Object.assign(Object.assign({}, test), { price: test.price, discount: test.discount || 0, testid: test.test_id })));
        recalculatedPackageList = PackageBillingHelper.applyDiscountsToTests(recalculatedPackageList);
        recalculatedPackageList = recalculatedPackageList.map(item => (Object.assign(Object.assign({}, item), { hasNightAdjustment: false, isNightTime: false, amountIncurredDueTax: 0, totalcost: item.discountedValue, totalpayable: item.discountedValue, cost: item.discountedValue })));
        return { success: true, recalculatedPackageList };
    }
    static async handlePackageInit({ tenantId, packageid, patientId, billingid, defaultCustomerInitData, getConstantCustomerInitData }) {
        const reformattedTest = await PackageBillingHelper.getFormattedPackageTestList({
            tenantId,
            packageid,
            cart: []
        });
        if (!reformattedTest)
            return { error: 'INVALID_PACKAGE_PROVIDED' };
        const constants = await getConstantCustomerInitData(patientId, billingid);
        return Object.assign(Object.assign(Object.assign({}, defaultCustomerInitData), constants), { packageid: packageid, isPackageUsed: true, testList: reformattedTest, taxValue: 0, hasNightAdjustment: false, nightAdjustmentValue: 0, nightAdjustmentMode: 'none', promoCode: null, taxIncluded: false, taxList: null });
    }
}
exports.PackageBillingHelper = PackageBillingHelper;
