import { q_get_company_information, q_truncate_company_information } from "./companyprofileQueries";
import logger from "../../hooks/logger";
import { promisifyQuery } from "../../hooks/helper";
import KnexConnection from "../../database/KnexConnections";
import { companyInfoCache } from "../../services/cache/testPanelCache";
import { ensureGeographyColumns } from "../geography/FacilityLocation";
import { DEFAULT_COUNTRY_ISO } from "../geography/WestAfricaGeographyData";
import { GeographyService } from "../geography/GeographyService";

export type companyInfo = {
    name: string;
    email: string;
    motto: string;
    phonenumber: string;
    address: string;
    website: string;
    additionalInfo?: string;
    country_code?: string;
    state?: string | null;
    street: string;
    alternativenumber: string;
};

export class CompanyProfileGeographyError extends Error {}

export const truncateCompanyProfile = async (tenantId: number): Promise<void> => {
    await promisifyQuery(tenantId, q_truncate_company_information);
    await companyInfoCache.invalidate(tenantId);
};

export const insertCompanyProfile = async (tenantId: number, parameters: companyInfo): Promise<boolean> => {
    const connection = await KnexConnection(tenantId);
    await ensureGeographyColumns(connection, String(tenantId));
    const inserted = await connection.transaction(async (trx) => {
        const previous = await trx('companyprofile').first('country_code', 'state');
        const exists = await trx('companyprofile').count('* as count').first();
        const country = GeographyService.getCountry(parameters.country_code || previous?.country_code || DEFAULT_COUNTRY_ISO);
        if (!country) throw new CompanyProfileGeographyError('Country not supported');
        const state = parameters.state === undefined ? previous?.state ?? null : String(parameters.state || '').trim() || null;
        if (state && !GeographyService.isValidDivision(country.iso2, state)) {
            throw new CompanyProfileGeographyError(`${state} is not a ${country.divisionLabel.toLowerCase()} of ${country.name}`);
        }
        if (parseInt(exists?.count as string) > 0) {
            await trx('companyprofile').del();
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
        additionalInfo,
            country_code: country.iso2,
            state
        });
        return result.length > 0;
    });
    if (inserted) await companyInfoCache.invalidate(tenantId);
    return inserted;
};

export const getAllCompanyProfiles = async (tenantId: number): Promise<companyInfo | null> => {
    return companyInfoCache.getOrLoad(tenantId, 'company-profile', {}, async () => {
        await ensureGeographyColumns(await KnexConnection(tenantId), String(tenantId));
        const packets = await promisifyQuery(tenantId, q_get_company_information);
        return packets.length > 0 ? packets[0] : null;
    });
};
