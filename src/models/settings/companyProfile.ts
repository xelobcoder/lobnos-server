import { q_get_company_information, q_insert_into_company_information, q_truncate_company_information } from "./companyprofileQueries";
import logger from "../../hooks/logger";
import { promisifyQuery, rowAffected } from "../../hooks/helper";

export type companyInfo = {
    name: string;
    email: string;
    motto: string;
    phonenumber: string;
    address: string;
    website: string;
    street: string;
    alternativenumber: string;
};

export const truncateCompanyProfile = async (tenantId: number): Promise<void> => {
    await promisifyQuery(tenantId, q_truncate_company_information);
};

export const insertCompanyProfile = async (tenantId: number, parameters: companyInfo): Promise<boolean> => {
    const { name, email, motto, phonenumber, address, website, street, alternativenumber } = parameters;
    const packets = await promisifyQuery(tenantId, q_insert_into_company_information, [
        name,
        email,
        motto,
        phonenumber,
        address,
        website,
        street,
        alternativenumber,
    ]);
    return rowAffected(packets);
};

export const getAllCompanyProfiles = async (tenantId: number): Promise<companyInfo | null> => {
    const packets = await promisifyQuery(tenantId, q_get_company_information);
    return packets.length > 0 ? packets[0] : null;
};
