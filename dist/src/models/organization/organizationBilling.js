"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const TiifuWorkingClass_1 = require("../../database/TiifuWorkingClass");
const helper_1 = require("../../hooks/helper");
const customTestEntry_1 = require("../resultentry/customTestEntry");
const organization_1 = __importDefault(require("./organization"));
const queries_1 = require("./queries");
/**
 * Class representing the organizational billing management.
 * Inherits from the Organization class and manages billing-related operations
 * such as loading pricing information and applying concessions.
 */
class OrganizationalBilling extends organization_1.default {
    /**
     * Creates an instance of OrganizationalBilling.
     * @param organizationid - The ID of the organization.
     */
    constructor(organizationid) {
        super(organizationid);
        this.organizationid = organizationid;
    }
    /**
     * Loads organizational billing information into the database table.
     * @param data - An object containing various properties related to organizational pricing and concessions.
     * @returns A promise that resolves to the result of the database operation.
     */
    async loadToTableOrganizationInfo(tenantId, data) {
        const { concessionMode, concessionValue, hasConcessionAppliedAcross, haveDifferentPriceList, testList, organizationid, priceType, useCustomLetterHeadings, employeeid } = data;
        if (!organizationid)
            return "such id not found" /* OperationsFailures.unfoundID */;
        const validTestPricing = testList.length === 0 ? "{}" : JSON.stringify(testList);
        const validHaveDiff = haveDifferentPriceList ? 1 : 0;
        const validHaveConcession = hasConcessionAppliedAcross ? 1 : 0;
        const values = [
            priceType,
            organizationid,
            validTestPricing,
            useCustomLetterHeadings,
            concessionValue,
            concessionMode,
            validHaveDiff,
            validHaveConcession,
            employeeid
        ];
        const inserted_data = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_load_to_organizationalBilling_Table, values);
        return (0, helper_1.rowAffected)(inserted_data);
    }
    /**
     * Creates organizational pricing based on the provided rules.
     * @param creationRule - An object containing rules for creating organizational pricing, including concessions and test lists.
     * @returns A promise that resolves to the result of the pricing creation operation.
     */
    async createOrganizationalPricing(tenantId, creationRule) {
        const { concessionValue, hasConcessionAppliedAcross, haveDifferentPriceList, testList, organizationid } = creationRule;
        if (!this.isProvidedOrganizationIdValid(tenantId, organizationid)) {
            return "such id not found" /* OperationsFailures.unfoundID */;
        }
        if (!haveDifferentPriceList)
            return "Different Pricing not selected" /* OperationsFailures.NothaveDifferentPriceList */;
        if (haveDifferentPriceList && hasConcessionAppliedAcross && concessionValue) {
            return await this.handleGeneralConcessionApplied(tenantId, creationRule);
        }
        if (!(Array.isArray(testList) && testList.length > 0)) {
            return "Empty TestList Provided" /* OperationsFailures.EmptyTestList */;
        }
        if (haveDifferentPriceList && !hasConcessionAppliedAcross) {
            return await this.handleNoGeneralConcessionApplied(tenantId, testList, creationRule);
        }
    }
    /**
     * Handles the case where a general concession is applied.
     * @param creationRule - An object containing rules for creating organizational pricing.
     * @returns A promise that resolves to the result of loading the information to the database table.
     */
    async handleGeneralConcessionApplied(tenantId, creationRule) {
        return await this.loadToTableOrganizationInfo(tenantId, creationRule);
    }
    /**
     * Handles the case where no general concession is applied, but specific test pricing is provided.
     * @param testList - An array of test objects with individual pricing details.
     * @param creationRule - An object containing rules for creating organizational pricing.
     * @returns A promise that resolves to the result of loading the information to the database table.
     */
    async handleNoGeneralConcessionApplied(tenantId, testList, creationRule) {
        const refinedTestArray = await this.getRefinedTestArray(tenantId, testList);
        if (refinedTestArray.length === 0) {
            return "There is an issue with the organizational pricing discounted values provided" /* OperationsFailures.organizationalPricingDiscountedIssue */;
        }
        const loadingData = Object.assign(Object.assign({}, creationRule), { testList: refinedTestArray, concessionMode: "none" /* concesMode.none */, concessionValue: 0 });
        return await this.loadToTableOrganizationInfo(tenantId, loadingData);
    }
    /**
     * Refines the test list by calculating discounted values based on the provided test list.
     * @param testList - An array of test objects with pricing details.
     * @returns A promise that resolves to the refined test array with discounted values.
     */
    async getRefinedTestArray(tenantId, testList) {
        const allTest = await new customTestEntry_1.CustomTest(0, '').loadTestWithDetails(tenantId);
        const refinedTestArray = [];
        for (const test of testList) {
            const matchingTest = allTest.find(t => t.testid == test.id);
            if (matchingTest) {
                const { price, testid } = matchingTest;
                const discountedValue = this.calculateDiscountedValue(price, test.concessionMode, test.concessionValue);
                refinedTestArray.push({
                    id: testid,
                    discountedValue: parseFloat(discountedValue.toString()),
                    concessionMode: test.concessionMode,
                    concessionValue: parseFloat(test.concessionValue),
                });
            }
        }
        return refinedTestArray;
    }
    /**
     * Loads organizational billing data from the database table.
     * @param organizationid - The ID of the organization to load billing data for.
     * @returns A promise that resolves to the loaded data from the database.
     */
    async loadOrganizationalBillingTable(tenantId, organizationid) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_load_from_organizationalBilling_Table, [organizationid]);
    }
    /**
     * Retrieves organizational billing information.
     * @returns A promise that resolves to the organizational billing information, or an empty array if no data is found.
     */
    async getOrganizationalBilling(tenantId) {
        const getTableData = await this.loadOrganizationalBillingTable(tenantId, this.organizationid);
        if (getTableData.length === 0)
            return getTableData;
        const allTest = await new customTestEntry_1.CustomTest(null, null).loadTestWithDetails(tenantId);
        const row = getTableData[0];
        const { concessionMode, useCustomLetterHeadings, concessionValue, haveDifferentPriceList, hasConcessionAppliedAcross } = row;
        const reGroupReturning = (refinedTestItems) => {
            const isTruthy = (value) => parseInt(value.toString()) === 1;
            return {
                testList: refinedTestItems,
                useCustomLetterHeadings: isTruthy(useCustomLetterHeadings),
                concessionMode,
                concessionValue,
                haveDifferentPriceList: isTruthy(haveDifferentPriceList),
                hasConcessionAppliedAcross: isTruthy(hasConcessionAppliedAcross),
                saved: true
            };
        };
        if (haveDifferentPriceList === 1 &&
            hasConcessionAppliedAcross === 1 &&
            allTest.length > 0) {
            const refinedTestItems = allTest.map((item) => {
                const { price, name, id, isoutsourced, testid } = item;
                console.log(item, { hasConcessionAppliedAcross, concessionMode, concessionValue });
                const discountedValue = this.calculateDiscountedValue(price, concessionMode, concessionValue);
                return { discountedValue, price, name, id, testid, concessionMode, isoutsourced };
            });
            return reGroupReturning(refinedTestItems);
        }
        else if (haveDifferentPriceList === 1 &&
            hasConcessionAppliedAcross === 0 &&
            allTest.length > 0) {
            let allTestRefactored = allTest;
            let testPricing = row['testpricing'];
            if (typeof testPricing === 'string' && testPricing.trim() !== '' && TiifuWorkingClass_1.TiifuWorkingClass.isJson(testPricing)) {
                testPricing = JSON.parse(testPricing);
            }
            if (Array.isArray(testPricing) && testPricing.length > 0) {
                for (let i = 0; i < testPricing.length; i++) {
                    const itemMatched = allTestRefactored.find((item) => item.testid == testPricing[i]['id']);
                    if (itemMatched) {
                        const { name, testid, price } = itemMatched;
                        reformatSavedPricing(testPricing, i, name, testid, price);
                    }
                    allTestRefactored = allTestRefactored.filter((item) => item.id !== itemMatched.id);
                }
            }
            const refinedTestItems = allTestRefactored.map((item) => {
                const { id, name, price } = item;
                return { id, name, price, discountedValue: price };
            });
            return reGroupReturning([...refinedTestItems, ...testPricing]);
        }
        else {
            return [];
        }
        /**
         * Reformats saved pricing for a test item.
         * @param testPricing - Array of test pricing details.
         * @param index - Index of the test item in the array.
         * @param name - Name of the test.
         * @param id - ID of the test.
         * @param price - Price of the test.
         */
        function reformatSavedPricing(testPricing, index, name, id, price) {
            testPricing[index] = {
                name,
                id,
                discountedValue: testPricing[index].discountedValue,
                price,
                concessionMode: testPricing[index].concessionMode,
                concessionValue: testPricing[index].concessionValue
            };
        }
    }
    /**
     * Calculates the discounted value of a test based on price, concession mode, and concession value.
     * @param price - Original price of the item.
     * @param concessionMode - Mode of concession ("absolute" or "percentage").
     * @param concessionValue - Value of the concession.
     * @returns The calculated discounted value.
     */
    calculateDiscountedValue(price, concessionMode, concessionValue) {
        const parsedConcessionValue = parseFloat(concessionValue.toString());
        const parsedPrice = parseFloat(price.toString());
        console.log('PARSED-PRICE', parsedPrice);
        console.log(parsedConcessionValue, parsedPrice, price, concessionMode, concessionValue);
        if (concessionMode === "absolute" && parsedPrice > parsedConcessionValue) {
            return parsedPrice - parsedConcessionValue;
        }
        else if (concessionMode === "percentage") {
            const discount = parsedPrice * (parsedConcessionValue / 100);
            return parsedPrice - discount;
        }
        else {
            return 0;
        }
    }
}
exports.default = OrganizationalBilling;
