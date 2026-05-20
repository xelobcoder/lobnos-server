import { concesMode, createRule } from "../../controllers/organization/organizationalPricing";
import KnexConnection from "../../database/KnexConnections";
import { TiifuWorkingClass } from "../../database/TiifuWorkingClass";
import { promisifyQuery, rowAffected } from "../../hooks/helper";
import { OperationsFailures } from "../operations/types";
import { CustomTest } from "../resultentry/customTestEntry";
import Organization from "./organization";
import { q_load_from_organizationalBilling_Table, q_load_to_organizationalBilling_Table } from "./queries";

/**
 * Class representing the organizational billing management.
 * Inherits from the Organization class and manages billing-related operations
 * such as loading pricing information and applying concessions.
 */
export default class OrganizationalBilling extends Organization {
    /**
     * ID of the organization.
     */
    readonly organizationid: number;

    /**
     * Creates an instance of OrganizationalBilling.
     * @param organizationid - The ID of the organization.
     */
    constructor(organizationid: number) {
        super(organizationid);
        this.organizationid = organizationid;
    }

    /**
     * Loads organizational billing information into the database table.
     * @param data - An object containing various properties related to organizational pricing and concessions.
     * @returns A promise that resolves to the result of the database operation.
     */
    async loadToTableOrganizationInfo(tenantId: number, data: createRule) {
        const {
            concessionMode,
            concessionValue,
            hasConcessionAppliedAcross,
            haveDifferentPriceList,
            testList,
            organizationid,
            priceType,
            useCustomLetterHeadings,
            employeeid
        } = data;

        if (!organizationid) return OperationsFailures.unfoundID;

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

        const inserted_data = await promisifyQuery(tenantId, q_load_to_organizationalBilling_Table, values);
        return rowAffected(inserted_data);
    }

    /**
     * Creates organizational pricing based on the provided rules.
     * @param creationRule - An object containing rules for creating organizational pricing, including concessions and test lists.
     * @returns A promise that resolves to the result of the pricing creation operation.
     */
    async createOrganizationalPricing(tenantId: number, creationRule: createRule) {
        const {
            concessionValue,
            hasConcessionAppliedAcross,
            haveDifferentPriceList,
            testList,
            organizationid
        } = creationRule;

        if (!this.isProvidedOrganizationIdValid(tenantId, organizationid)) {
            return OperationsFailures.unfoundID;
        }

        if (!haveDifferentPriceList) return OperationsFailures.NothaveDifferentPriceList;

        if (haveDifferentPriceList && hasConcessionAppliedAcross && concessionValue) {
            return await this.handleGeneralConcessionApplied(tenantId, creationRule);
        }

        if (!(Array.isArray(testList) && testList.length > 0)) {
            return OperationsFailures.EmptyTestList;
        }

        if (haveDifferentPriceList && !hasConcessionAppliedAcross) {
            return await this.handleNoGeneralConcessionApplied(tenantId,
                testList, creationRule);
        }
    }

    /**
     * Handles the case where a general concession is applied.
     * @param creationRule - An object containing rules for creating organizational pricing.
     * @returns A promise that resolves to the result of loading the information to the database table.
     */
    private async handleGeneralConcessionApplied(tenantId: number, creationRule: createRule) {
        return await this.loadToTableOrganizationInfo(tenantId, creationRule);
    }

    /**
     * Handles the case where no general concession is applied, but specific test pricing is provided.
     * @param testList - An array of test objects with individual pricing details.
     * @param creationRule - An object containing rules for creating organizational pricing.
     * @returns A promise that resolves to the result of loading the information to the database table.
     */
    private async handleNoGeneralConcessionApplied(tenantId: number, testList: any[], creationRule: createRule) {
        const refinedTestArray = await this.getRefinedTestArray(tenantId, testList);

        if (refinedTestArray.length === 0) {
            return OperationsFailures.organizationalPricingDiscountedIssue;
        }

        const loadingData = {
            ...creationRule,
            testList: refinedTestArray,
            concessionMode: concesMode.none,
            concessionValue: 0
        };

        return await this.loadToTableOrganizationInfo(tenantId, loadingData);
    }

    /**
     * Refines the test list by calculating discounted values based on the provided test list.
     * @param testList - An array of test objects with pricing details.
     * @returns A promise that resolves to the refined test array with discounted values.
     */
    public async getRefinedTestArray(tenantId: number, testList: any[]): Promise<{ id: number, discountedValue: number, concessionMode: string, concessionValue: number }[]> {
        const allTest = await new CustomTest(0,'').loadTestWithDetails(tenantId);
        const refinedTestArray: { id: number, discountedValue: number, concessionMode: string, concessionValue: number }[] = [];

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
    private async loadOrganizationalBillingTable(tenantId: number, organizationid: number) {
        return await promisifyQuery(tenantId, q_load_from_organizationalBilling_Table, [organizationid]);
    }


    /**
     * Retrieves organizational billing information.
     * @returns A promise that resolves to the organizational billing information, or an empty array if no data is found.
     */
    public async getOrganizationalBilling(tenantId: number) {
        const getTableData = await this.loadOrganizationalBillingTable(tenantId, this.organizationid);
        if (getTableData.length === 0) return getTableData;

        const allTest = await new CustomTest(null, null).loadTestWithDetails(tenantId);
        const row = getTableData[0];

        const {
            concessionMode,
            useCustomLetterHeadings,
            concessionValue,
            haveDifferentPriceList,
            hasConcessionAppliedAcross
        } = row;

        const reGroupReturning = (refinedTestItems: any) => {
            const isTruthy = (value: number | string) => parseInt(value.toString()) === 1;
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

        if (
            haveDifferentPriceList === 1 &&
            hasConcessionAppliedAcross === 1 &&
            allTest.length > 0
        ) {
            const refinedTestItems = allTest.map((item: any) => {
                const { price, name, id, isoutsourced, testid } = item;
                console.log(item, { hasConcessionAppliedAcross, concessionMode, concessionValue })
                const discountedValue = this.calculateDiscountedValue(price, concessionMode, concessionValue);
                return { discountedValue, price, name, id, testid, concessionMode, isoutsourced };
            });

            return reGroupReturning(refinedTestItems);

        } else if (
            haveDifferentPriceList === 1 &&
            hasConcessionAppliedAcross === 0 &&
            allTest.length > 0
        ) {
            let allTestRefactored = allTest;
            let testPricing = row['testpricing'];
            if (typeof testPricing === 'string' && testPricing.trim() !== '' && TiifuWorkingClass.isJson(testPricing)) {
                testPricing = JSON.parse(testPricing);
            }
            if (Array.isArray(testPricing) && testPricing.length > 0) {
                for (let i = 0; i < testPricing.length; i++) {
                    const itemMatched = allTestRefactored.find((item: any) => item.testid == testPricing[i]['id']);
                    if (itemMatched) {
                        const { name, testid, price } = itemMatched;
                        reformatSavedPricing(testPricing as any, i, name, testid, price);
                    }
                    allTestRefactored = allTestRefactored.filter((item: any) => item.id !== itemMatched.id);
                }
            }

            const refinedTestItems = allTestRefactored.map((item: any) => {
                const { id, name, price } = item;
                return { id, name, price, discountedValue: price };
            });

            return reGroupReturning([...refinedTestItems, ...testPricing]);
        } else {
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
        function reformatSavedPricing(
            testPricing: { id: number, discountedValue: number },
            index: number,
            name: string,
            id: number,
            price: number,
        ) {
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
    public calculateDiscountedValue(
        price: number,
        concessionMode: string,
        concessionValue: number
    ): number {
        const parsedConcessionValue = parseFloat(concessionValue.toString());
        const parsedPrice = parseFloat(price.toString());
        console.log('PARSED-PRICE', parsedPrice)
        console.log(parsedConcessionValue, parsedPrice, price, concessionMode, concessionValue)

        if (concessionMode === "absolute" && parsedPrice > parsedConcessionValue) {
            return parsedPrice - parsedConcessionValue;
        } else if (concessionMode === "percentage") {
            const discount = parsedPrice * (parsedConcessionValue / 100);
            return parsedPrice - discount;
        } else {
            return 0;
        }
    }
}


