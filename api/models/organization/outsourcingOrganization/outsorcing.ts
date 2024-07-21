import { IOutSourcing, IOutsourcingOrganization } from "./outsourcingTypes";

class Outsourcing implements IOutSourcing {
    createOutSourceOrganization(outsource: IOutsourcingOrganization): boolean {
        throw new Error("Method not implemented.");
    }
    updateOutsourceOrganization(outsource: IOutsourcingOrganization): boolean {
        throw new Error("Method not implemented.");
    }
    calculateProfit(outorganizationid: number): number {
        throw new Error("Method not implemented.");
    }
    getOrganizationTest(testid: number, organizationid: number): [] {
        throw new Error("Method not implemented.");
    }

}