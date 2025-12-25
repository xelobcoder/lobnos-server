import { q_get_company_information, q_truncate_company_information } from "./companyprofileQueries";
import logger from "../../hooks/logger";
import { promisifyQuery } from "../../hooks/helper";
import KnexConnection from "../../database/KnexConnections";

export type companyInfo = {
    name: string;
    email: string;
    motto: string;
    phonenumber: string;
    address: string;
    website: string;
    additionalInfo?: string;
    street: string;
    alternativenumber: string;
};

export const truncateCompanyProfile = async (tenantId: number): Promise<void> => {
    await promisifyQuery(tenantId, q_truncate_company_information);
};

export const insertCompanyProfile = async (tenantId: number, parameters: companyInfo): Promise<boolean> => {
    const connection = await KnexConnection(tenantId);
    return connection.transaction(async (trx) => {
        const exists = await trx('companyprofile').count('* as count').first();
        if (parseInt(exists.count as string) > 0) {
            await trx('companyprofile').truncate();
        }
        const { name, email, motto, phonenumber, additionalInfo, address, website, street, alternativenumber } = parameters;
        const result = await trx('companyprofile').insert({
            name,
            email,
            motto,
            phonenumber,
            address,
            website,
            street,
            alternativenumber,
        additionalInfo
        });
        return result.length > 0;
    });
};

export const getAllCompanyProfiles = async (tenantId: number): Promise<companyInfo | null> => {
    const packets = await promisifyQuery(tenantId, q_get_company_information);
    return packets.length > 0 ? packets[0] : null;
};
