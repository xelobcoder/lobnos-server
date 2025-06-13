"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllCompanyProfiles = exports.insertCompanyProfile = exports.truncateCompanyProfile = void 0;
const companyprofileQueries_1 = require("./companyprofileQueries");
const helper_1 = require("../../hooks/helper");
const truncateCompanyProfile = async (tenantId) => {
    await (0, helper_1.promisifyQuery)(tenantId, companyprofileQueries_1.q_truncate_company_information);
};
exports.truncateCompanyProfile = truncateCompanyProfile;
const insertCompanyProfile = async (tenantId, parameters) => {
    const { name, email, motto, phonenumber, address, website, street, alternativenumber } = parameters;
    const packets = await (0, helper_1.promisifyQuery)(tenantId, companyprofileQueries_1.q_insert_into_company_information, [
        name,
        email,
        motto,
        phonenumber,
        address,
        website,
        street,
        alternativenumber,
    ]);
    return (0, helper_1.rowAffected)(packets);
};
exports.insertCompanyProfile = insertCompanyProfile;
const getAllCompanyProfiles = async (tenantId) => {
    const packets = await (0, helper_1.promisifyQuery)(tenantId, companyprofileQueries_1.q_get_company_information);
    return packets.length > 0 ? packets[0] : null;
};
exports.getAllCompanyProfiles = getAllCompanyProfiles;
