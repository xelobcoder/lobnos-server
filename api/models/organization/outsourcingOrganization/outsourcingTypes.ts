export type OutSourcingOrganization = {
    name: string;
    type: string,
    email: string,
    address: string,
    billingAddress: string,
    contactNumber: number,
    contactPerson: string
}



export type OutSourcingContract = {
    startdate: Date,
    enddate: Date,
    servicesConvered: string,
    BillingTerms: string,
    Discount: string,
}


export type ServicesItem = {
    test: string,
    testid: number,
    price: number
}


export interface IOutsourcingOrganization {
    basicInfo: OutSourcingOrganization,
    contract: OutSourcingContract,
    services: ServicesItem[]
}

export interface IOutSourcing {
    createOutSourceOrganization(outsource: IOutsourcingOrganization): boolean;
    updateOutsourceOrganization(outsource:IOutsourcingOrganization): boolean;
    calculateProfit(outorganizationid:number) :number;
    getOrganizationTest(testid:number,organizationid:number) : [];
    
}