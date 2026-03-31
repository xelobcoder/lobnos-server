"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllCompanyProfiles = exports.insertCompanyProfile = exports.truncateCompanyProfile = void 0;
const companyprofileQueries_1 = require("./companyprofileQueries");
const helper_1 = require("../../hooks/helper");
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const truncateCompanyProfile = async (tenantId) => {
    await (0, helper_1.promisifyQuery)(tenantId, companyprofileQueries_1.q_truncate_company_information);
};
exports.truncateCompanyProfile = truncateCompanyProfile;
const insertCompanyProfile = async (tenantId, parameters) => {
    const connection = await (0, KnexConnections_1.default)(tenantId);
    return connection.transaction(async (trx) => {
        const exists = await trx('companyprofile').count('* as count').first();
        if (parseInt(exists.count) > 0) {
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
exports.insertCompanyProfile = insertCompanyProfile;
const getAllCompanyProfiles = async (tenantId) => {
    const packets = await (0, helper_1.promisifyQuery)(tenantId, companyprofileQueries_1.q_get_company_information);
    return packets.length > 0 ? packets[0] : null;
};
exports.getAllCompanyProfiles = getAllCompanyProfiles;
