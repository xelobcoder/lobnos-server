import { promisifyQuery, rowAffected, paginationQuery } from '../../../hooks/helper';
import User from '../../../LobnosAuth/user';
import { OperationsFailures } from "../../operations/types";
import { CustomTest } from '../../resultentry/customTestEntry';
import { FilterParams, IOutSourcing, organizationDataServiceData, OutSourcingOrganization, serviceProvidedSummary } from "./outsourcingTypes";
import {
    q_check_an_outsource_organization_provided_test,
    q_create_an_outsource_organization,
    q_get_all_outsourced_organization_stage_organization,
    q_get_outsource_organization_basic,
    q_get_outsourceorganizationservices,
    q_get_test_outsourcing_organizations,
    q_insert_into_outsource_org_services_table,
    q_outsource_organization_exist,
    q_outsource_organization_exist_usingid,
    q_update_an_outsource_organization_basic,
    q_update_testdetails_outsourcing,
    q_update_to_resolve_outsourced
} from "./queries";

export default class Outsourcing implements IOutSourcing {
    name: string;
    contactNumber: number;

    constructor(name: string, contactNumber: number) {
        this.name = name;
        this.contactNumber = contactNumber;
    }

    private async checkForExistenceOutsourceOrganization(tenantId: number, organizationName: string) {
        const packets = await promisifyQuery(tenantId, q_outsource_organization_exist, [organizationName]);
        return packets[0]['count'] > 0;
    }

    private async checkForExistenceOutsourceOrganizationid(tenantId: number, organizationid: number) {
        const packets = await promisifyQuery(tenantId, q_outsource_organization_exist_usingid, [organizationid]);
        return packets[0]['count'] > 0;
    }

    public async createOutSourceOrganization(tenantId: number, outsource: OutSourcingOrganization): Promise<boolean | string> {
        const { billingAddress, address, email, name, organizationType, employeeid, contactNumber, contactPerson } = outsource;
        const hasOrganization = await this.checkForExistenceOutsourceOrganization(tenantId, name);
        if (hasOrganization) return OperationsFailures.OrganizationExist;
        const values = [name, organizationType, email, address, billingAddress, contactNumber, contactPerson, employeeid];
        const rows = await promisifyQuery(tenantId, q_create_an_outsource_organization, values);
        return rowAffected(rows);
    }

    async getOrganizationBasicInformation(tenantId: number, outsourceid: number): Promise<[]> {
        const packets = await promisifyQuery(tenantId, q_get_outsource_organization_basic, [outsourceid]);
        return packets;
    }

    private async getOrganizationServicesInformation(tenantId: number, outsourceid: number): Promise<[]> {
        const packets = await promisifyQuery(tenantId, q_get_outsourceorganizationservices, [outsourceid]);
        return packets;
    }

    async updateOutsourceOrganization(tenantId: number, outsource: OutSourcingOrganization): Promise<boolean | string> {
        const { billingAddress, address, email, outsourceid, name, organizationType, employeeid, contactNumber, contactPerson } = outsource;
        const values = [name, organizationType, email, address, billingAddress, contactNumber, contactPerson, employeeid, outsourceid];
        const hasOrganization = await this.checkForExistenceOutsourceOrganizationid(tenantId, parseInt(outsourceid.toString()));
        if (!hasOrganization) return OperationsFailures.unfoundID;
        const result = await promisifyQuery(tenantId, q_update_an_outsource_organization_basic, values);
        return rowAffected(result);
    }

    async loadoutsourcingOrganizationTable(tenantId: number, outsourceid: number, employeeid: number, data: organizationDataServiceData) {
        const { generalTestId, outsourcePrice } = data;
        const insertedPackets = await promisifyQuery(tenantId, q_insert_into_outsource_org_services_table, [outsourceid, generalTestId, outsourcePrice, employeeid]);
        return rowAffected(insertedPackets);
    }

    async loadoutsourceOrganizationServices(tenantId: number, data: serviceProvidedSummary): Promise<boolean | OperationsFailures.unfoundID> {
        try {
            const { outsourceid, testList, employeeid } = data;
            if (!outsourceid) {
                throw new Error('outsourceid not provided');
            }
            if (!await this.checkForExistenceOutsourceOrganizationid(tenantId, outsourceid)) return OperationsFailures.unfoundID;
            console.log(data);
            if (Array.isArray(testList) && testList.length > 0) {
                for (const test of testList) {
                    await this.loadoutsourcingOrganizationTable(tenantId, outsourceid, employeeid, { ...test, outsourceid, employeeid });
                }
            }
            return true;
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
              
            }
            return false;
        }
    }

    async getOrganizationOursourcePricing(tenantId: number, outsourceid: number) {
        if (!await this.checkForExistenceOutsourceOrganizationid(tenantId, outsourceid)) {
            return OperationsFailures.unfoundID;
        }
        const services_data = await this.getOrganizationServicesInformation(tenantId, outsourceid);
        if (services_data.length == 0) return [];
        const allTest = await new CustomTest(tenantId, null).getAllCustomTestList(tenantId);
        if (allTest.length === 0) return [];
        let testList = [];
        for (const service of services_data) {
            const data = allTest.filter((item: any) => item.id === service['generalTestId']);
            if (data.length > 0) {
                const { outserviceid, outsourceid, generalTestId, outsourcePrice } = service;
                const priceDifference = data[0]['price'] - outsourcePrice;
                const generatedData = { outserviceid, outsourceid, testid: generalTestId, name: data[0]['name'], priceDifference, price: outsourcePrice };
                testList.push(generatedData);
            }
        }
        return testList;
    }

    async getAllOutsourcingOrganization(tenantId: number, data: FilterParams) {
        let query = `SELECT * FROM outsourcingorganization`;
        const filters: string[] = [];
        const params: any[] = [];
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
        let result = await paginationQuery({ page, count }, query, params, tenantId);
        if (result.length > 0) {
            result = await Promise.all(
                result.map(async (item: any) => {
                    const employeeid = item['outsourceCreatedBy'];
                    if (employeeid && !isNaN(employeeid)) {
                        const packet = await new User(null, null, null, null, null).getUserDataById(tenantId, employeeid);
                        if (packet.length > 0) {
                            item.createdby = packet[0]['username'];
                        }
                    }
                    return item;
                })
            );
        }
        return result;
    }

    calculateProfit(outorganizationid: number): number {
        throw new Error("Method not implemented.");
    }

    getOrganizationTest(testid: number, organizationid: number): [] {
        throw new Error("Method not implemented.");
    }

    async checkOrganizationProvideServicesForATest(tenantId: number, testid: number, outsourceid: number) {
        return await promisifyQuery(tenantId, q_check_an_outsource_organization_provided_test, [outsourceid, testid]);
    }

    async updateTestOutSourcingOrganization(tenantId: number, organization: number[], testid: number) {
        if (organization.length === 0 || !testid) return false;
        const stringedOrganizations = organization.join(",");
        const result = await promisifyQuery(tenantId, q_update_testdetails_outsourcing, [stringedOrganizations, testid]);
        return rowAffected(result);
    }

    async getTestOutSourcingOrganizations(tenantId: number, testid: number): Promise<[]> {
        const result = await promisifyQuery(tenantId, q_get_test_outsourcing_organizations, [testid]);
        if (result.length > 0) {
            const organizationsString = result[0]['outSourcingList'];
            if (organizationsString) {
                const q_getTestPanelTestFromList = `SELECT * FROM outsourcingorganization WHERE outsourceid IN (${organizationsString})`;
                return await promisifyQuery(tenantId, q_getTestPanelTestFromList);
            }
            return [];
        }
        return [];
    }

    static async getOutsourcedTestBasedOnstage(tenantId: number, stage: "resolved" | "unresolved", page: number = 1, count: number = 10) {
        const status = stage == "resolved" ? 1 : 0;
        console.log(stage, status);
        return await paginationQuery({ count, page }, q_get_all_outsourced_organization_stage_organization, [status], tenantId);
    }

    static async updateToResolveOutsourced(tenantId: number, serviceid: number, employeeid: number): Promise<boolean> {
        if (serviceid && employeeid) {
            const result = await promisifyQuery(tenantId, q_update_to_resolve_outsourced, [1, employeeid, serviceid]);
            return rowAffected(result);
        }
        throw new Error("employeeid or serviceid not provided");
    }
}
