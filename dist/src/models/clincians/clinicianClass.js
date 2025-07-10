"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = __importDefault(require("../../hooks/logger"));
const queries_1 = __importDefault(require("./queries"));
const helper_1 = require("../../hooks/helper");
const TiifuWorkingClass_1 = require("../../database/TiifuWorkingClass");
const ReferralCodingRepo_1 = require("../referral/repositories/ReferralCodingRepo");
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class ClinicianClass {
    async insertCliniciansBulk(tenantId, clinicians) {
        const results = [];
        for (const record of clinicians) {
            const { name, phone, email, location, address, occupation, organization } = record;
            if (!name || !phone) {
                results.push("Missing required fields: name or phone");
                continue;
            }
            try {
                const values = [name, phone, email ? email : null, location, address, occupation, organization];
                const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.default.insertClinicianBasicInfo, values);
                const { insertId } = result;
                if (insertId !== 0) {
                    results.push(insertId);
                }
                else {
                    results.push("Insert failed");
                }
            }
            catch (err) {
                if (err && err.sqlState === '23000' && err.sqlMessage && err.sqlMessage.includes('Duplicate entry')) {
                    results.push("Duplicate entry error: " + err.sqlMessage);
                    continue;
                }
                results.push("Error: " + ((err === null || err === void 0 ? void 0 : err.message) || err));
            }
        }
        return results;
    }
    async getClinicians(tenantId, pagination) {
        const { count = 10, page = 1, role } = pagination;
        if (role && role.toString().trim() === "admin") {
            return (count && page) ? await (0, helper_1.paginationQuery)({ page, count }, queries_1.default.getCliniciansWithExtendedPagination, [], tenantId) :
                await (0, helper_1.promisifyQuery)(tenantId, queries_1.default.getAllCliniciansWithPaymentInfo);
        }
        else {
            return (count && page) ? await (0, helper_1.paginationQuery)({ page, count }, queries_1.default.getCliniciansWithPagination, [], tenantId) :
                await (0, helper_1.promisifyQuery)(tenantId, queries_1.default.getAllClinicians);
        }
    }
    async getClinicianBasicInfo(tenantId, clinicianid) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.default.getClinicianBasicInfo, [clinicianid]);
    }
    async getClinicianBatch(tenantId, page, count) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.default.getClinicianBatch, [count, page]);
    }
    async putCliniciansBasic(tenantId, records) {
        const { name, phone, email, location, address, occupation, id } = records;
        const isPhoneValid = TiifuWorkingClass_1.TiifuWorkingClass.isNumberPhoneNumber(phone);
        const isEmailValid = TiifuWorkingClass_1.TiifuWorkingClass.isEmailValidEmail(email);
        if (!isPhoneValid)
            return "Valid phone number required" /* OperationsFailures.invalidPhoneNumber */;
        if (email && !isEmailValid)
            return "Valid  email required" /* OperationsFailures.invalidEmail */;
        let oldRecordsPackets = await this.getSingleClinician(tenantId, id);
        if (Array.isArray(oldRecordsPackets) && oldRecordsPackets.length > 0) {
            oldRecordsPackets = oldRecordsPackets[0];
            const { email: OldEmail, phone: oldPhone } = oldRecordsPackets;
            if (oldPhone != phone) {
                const isClinicianExist = await this.isClinicianExist(tenantId, email, phone.toString());
                if (isClinicianExist)
                    return "This resource already exist" /* OperationsFailures.resourceExist */;
            }
        }
        const values = [name, phone, email, location, address, occupation, id];
        const isUpdated = await (0, helper_1.promisifyQuery)(tenantId, queries_1.default.updateClinicianBasicInfo, values);
        return (0, helper_1.rowAffected)(isUpdated);
    }
    static async getTotalClinicians(tenantId) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.default.getTotalClinicians);
        if (result.length > 0) {
            return result[0].total;
        }
        return 0;
    }
    async deleteClinicians(tenantId, id) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.default.deleteClinicianById, [id]);
        return (0, helper_1.rowAffected)(result);
    }
    async isClinicianExist(tenantId, email, mobile) {
        if (!email || !mobile)
            return false;
        const matched = await (0, helper_1.promisifyQuery)(tenantId, `SELECT * FROM clinicianbasicinfo WHERE EMAIL = ? OR phone = ?`, [email, mobile]);
        return matched.length > 0 ? true : false;
    }
    async postClinicianBasicInfo(reqbody) {
        var _a;
        const tenantIdP = parseFloat(reqbody.tenantId.toString());
        const { name, phone, email, location, address, occupation, organization } = reqbody;
        const values = [name, phone, email ? email : null, location, address, occupation, organization];
        const connection = await (0, KnexConnections_1.default)(tenantIdP);
        const trx = await connection.transaction();
        try {
            const [result] = await trx.raw(queries_1.default.insertClinicianBasicInfo, values);
            const insertId = (result === null || result === void 0 ? void 0 : result.insertId) || ((_a = result === null || result === void 0 ? void 0 : result[0]) === null || _a === void 0 ? void 0 : _a.insertId);
            if (insertId !== 0 && insertId !== undefined) {
                const random = require("crypto").randomBytes(5).toString("hex");
                const tempCredentials = `UPDATE clinicianscredentials SET password  = ?`;
                await trx.raw(tempCredentials, [random]);
                const referralRepo = new ReferralCodingRepo_1.ReferralCodingRepo(tenantIdP);
                await referralRepo.create({ entity_id: insertId, entity_type: 'clinician', code: 0 }, trx);
                await trx.commit();
                return insertId;
            }
            else {
                await trx.rollback();
                return "Adding new clinician failed";
            }
        }
        catch (err) {
            await trx.rollback();
            console.error("Error adding new clinician:", err);
            return "Error adding new clinician";
        }
    }
    async getSingleClinician(tenantId, id) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.default.getSingleClinicianById, [id]);
    }
    async getClinicianResult(tenantId, clinicianid, startdate, enddate) {
        try {
            let values = [clinicianid];
            let query = queries_1.default.getClinicianResult;
            if (startdate && enddate) {
                query += ` AND DATE(b.billedon) BETWEEN ? AND ?`;
                values.push(startdate);
                values.push(enddate);
            }
            else {
                query += ` AND DATE(b.billedon) = DATE(CURRENT_DATE) ORDER BY b.billedon DESC`;
            }
            const tenantIdP = parseInt(tenantId.toString());
            const result = await (0, helper_1.promisifyQuery)(tenantIdP, query, values);
            return result;
        }
        catch (error) {
            logger_1.default.error(error);
            return [];
        }
    }
    async getBillingTestBasedByClinician(tenantId, billingid, clinicianid) {
        const query = queries_1.default.getBillingTestBasedByClinician;
        const result = await (0, helper_1.promisifyQuery)(tenantId, query, [clinicianid, billingid]);
        return result;
    }
    async verifyClinicianPhoneNumberAndEmail(tenantId, email, phone) {
        const isPhoneValid = TiifuWorkingClass_1.TiifuWorkingClass.isNumberPhoneNumber(phone);
        const isEmailValid = TiifuWorkingClass_1.TiifuWorkingClass.isEmailValidEmail(email);
        if (!isPhoneValid)
            return "Valid phone number required" /* OperationsFailures.invalidPhoneNumber */;
        if (email && !isEmailValid)
            return "Valid  email required" /* OperationsFailures.invalidEmail */;
        const isClinicianExist = await this.isClinicianExist(tenantId, email, phone);
        if (isClinicianExist) {
            return "This resource already exist" /* OperationsFailures.resourceExist */ + " Email or phone number is already registered with a clinician";
        }
        return true;
    }
}
exports.default = ClinicianClass;
