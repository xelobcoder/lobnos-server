"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../../hooks/helper");
const user_1 = __importDefault(require("../../../LobnosAuth/user"));
const customTestEntry_1 = require("../../resultentry/customTestEntry");
const queries_1 = require("./queries");
class Outsourcing {
    constructor(name, contactNumber) {
        this.name = name;
        this.contactNumber = contactNumber;
    }
    async checkForExistenceOutsourceOrganization(tenantId, organizationName) {
        const packets = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_outsource_organization_exist, [organizationName]);
        return packets[0]['count'] > 0;
    }
    async checkForExistenceOutsourceOrganizationid(tenantId, organizationid) {
        const packets = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_outsource_organization_exist_usingid, [organizationid]);
        return packets[0]['count'] > 0;
    }
    async createOutSourceOrganization(tenantId, outsource) {
        const { billingAddress, address, email, name, organizationType, employeeid, contactNumber, contactPerson } = outsource;
        const hasOrganization = await this.checkForExistenceOutsourceOrganization(tenantId, name);
        if (hasOrganization)
            return "Organization With Such Name Already Exist" /* OperationsFailures.OrganizationExist */;
        const values = [name, organizationType, email, address, billingAddress, contactNumber, contactPerson, employeeid];
        const rows = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_create_an_outsource_organization, values);
        return (0, helper_1.rowAffected)(rows);
    }
    async getOrganizationBasicInformation(tenantId, outsourceid) {
        const packets = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_outsource_organization_basic, [outsourceid]);
        return packets;
    }
    async getOrganizationServicesInformation(tenantId, outsourceid) {
        const packets = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_outsourceorganizationservices, [outsourceid]);
        return packets;
    }
    async updateOutsourceOrganization(tenantId, outsource) {
        const { billingAddress, address, email, outsourceid, name, organizationType, employeeid, contactNumber, contactPerson } = outsource;
        const values = [name, organizationType, email, address, billingAddress, contactNumber, contactPerson, employeeid, outsourceid];
        const hasOrganization = await this.checkForExistenceOutsourceOrganizationid(tenantId, parseInt(outsourceid.toString()));
        if (!hasOrganization)
            return "such id not found" /* OperationsFailures.unfoundID */;
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_an_outsource_organization_basic, values);
        return (0, helper_1.rowAffected)(result);
    }
    async loadoutsourcingOrganizationTable(tenantId, outsourceid, employeeid, data) {
        const { generalTestId, outsourcePrice } = data;
        const insertedPackets = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_insert_into_outsource_org_services_table, [outsourceid, generalTestId, outsourcePrice, employeeid]);
        return (0, helper_1.rowAffected)(insertedPackets);
    }
    async loadoutsourceOrganizationServices(tenantId, data) {
        try {
            const { outsourceid, testList, employeeid } = data;
            if (!outsourceid) {
                throw new Error('outsourceid not provided');
            }
            if (!await this.checkForExistenceOutsourceOrganizationid(tenantId, outsourceid))
                return "such id not found" /* OperationsFailures.unfoundID */;
            console.log(data);
            if (Array.isArray(testList) && testList.length > 0) {
                for (const test of testList) {
                    await this.loadoutsourcingOrganizationTable(tenantId, outsourceid, employeeid, Object.assign(Object.assign({}, test), { outsourceid, employeeid }));
                }
            }
            return true;
        }
        catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
            }
            return false;
        }
    }
    async getOrganizationOursourcePricing(tenantId, outsourceid) {
        if (!await this.checkForExistenceOutsourceOrganizationid(tenantId, outsourceid)) {
            return "such id not found" /* OperationsFailures.unfoundID */;
        }
        const services_data = await this.getOrganizationServicesInformation(tenantId, outsourceid);
        if (services_data.length == 0)
            return [];
        const allTest = await new customTestEntry_1.CustomTest(tenantId, null).getAllCustomTestList(tenantId);
        if (allTest.length === 0)
            return [];
        let testList = [];
        for (const service of services_data) {
            const data = allTest.filter((item) => item.id === service['generalTestId']);
            if (data.length > 0) {
                const { outserviceid, outsourceid, generalTestId, outsourcePrice } = service;
                const priceDifference = data[0]['price'] - outsourcePrice;
                const generatedData = { outserviceid, outsourceid, testid: generalTestId, name: data[0]['name'], priceDifference, price: outsourcePrice };
                testList.push(generatedData);
            }
        }
        return testList;
    }
    async getAllOutsourcingOrganization(tenantId, data) {
        let query = `SELECT * FROM outsourcingorganization`;
        const filters = [];
        const params = [];
        if (data.searchValue) {
            const searchFilter = `%${data.searchValue}%`;
            filters.push(`(name LIKE ? OR organizationType LIKE ? OR email LIKE ? OR address LIKE ? OR billingAddress LIKE ? OR contactNumber LIKE ? OR contactPerson LIKE ?)`);
            params.push(searchFilter, searchFilter, searchFilter, searchFilter, searchFilter, searchFilter, searchFilter);
        }
        if (filters.length > 0) {
            query += ` WHERE ` + filters.join(' AND ');
        }
        query += ` LIMIT ? OFFSET ?`;
        const page = data.page | 1;
        const count = data.count | 10;
        let result = await (0, helper_1.paginationQuery)({ page, count }, query, params, tenantId);
        if (result.length > 0) {
            result = await Promise.all(result.map(async (item) => {
                const employeeid = item['outsourceCreatedBy'];
                if (employeeid && !isNaN(employeeid)) {
                    const packet = await new user_1.default(null, null, null, null, null).getUserDataById(tenantId, employeeid);
                    if (packet.length > 0) {
                        item.createdby = packet[0]['username'];
                    }
                }
                return item;
            }));
        }
        return result;
    }
    calculateProfit(outorganizationid) {
        throw new Error("Method not implemented.");
    }
    getOrganizationTest(testid, organizationid) {
        throw new Error("Method not implemented.");
    }
    async checkOrganizationProvideServicesForATest(tenantId, testid, outsourceid) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_check_an_outsource_organization_provided_test, [outsourceid, testid]);
    }
    async updateTestOutSourcingOrganization(tenantId, organization, testid) {
        if (organization.length === 0 || !testid)
            return false;
        const stringedOrganizations = organization.join(",");
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_testdetails_outsourcing, [stringedOrganizations, testid]);
        return (0, helper_1.rowAffected)(result);
    }
    async getTestOutSourcingOrganizations(tenantId, testid) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_test_outsourcing_organizations, [testid]);
        if (result.length > 0) {
            const organizationsString = result[0]['outSourcingList'];
            if (organizationsString) {
                const q_getTestPanelTestFromList = `SELECT * FROM outsourcingorganization WHERE outsourceid IN (${organizationsString})`;
                return await (0, helper_1.promisifyQuery)(tenantId, q_getTestPanelTestFromList);
            }
            return [];
        }
        return [];
    }
    static async getOutsourcedTestBasedOnstage(tenantId, stage, page = 1, count = 10) {
        const status = stage == "resolved" ? 1 : 0;
        console.log(stage, status);
        return await (0, helper_1.paginationQuery)({ count, page }, queries_1.q_get_all_outsourced_organization_stage_organization, [status], tenantId);
    }
    static async updateToResolveOutsourced(tenantId, serviceid, employeeid) {
        if (serviceid && employeeid) {
            const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_to_resolve_outsourced, [1, employeeid, serviceid]);
            return (0, helper_1.rowAffected)(result);
        }
        throw new Error("employeeid or serviceid not provided");
    }
}
exports.default = Outsourcing;
