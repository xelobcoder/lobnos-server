export interface TableFilteringType {
    filtering: string;
    tenantId: string;
    value: string;
    original: string;
    limit: number;
}




export type smsTemplatesCorrepondingsTypes = {
    organization: string,
    staffs: string,
    clinicians: string,
    outsourcing: string,
    clients: string,
    tenantId:string
}

export type smsTemplatePlaceholdersOptions = "staffs" | "clients" | "organization" | "outsourcing" | "clinicians"


export const categoryColumnMapper = {
    staffs: "roles",
    clients: "new_patients",
    organization: "organization",
    outsourcing: "outsourcingorganization",
    clinicians: "clinicianbasicinfo"
}


export type smsTemplatesCorrepondingsTypeSingle = Partial<smsTemplatesCorrepondingsTypes>