"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = __importDefault(require("../../hooks/logger"));
const queries_1 = __importDefault(require("./queries"));
const helper_1 = require("../../hooks/helper");
const TiifuWorkingClass_1 = require("../../database/TiifuWorkingClass");
class ClinicianClass {
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
    async postClinicianBasicInfo(req, res) {
        const TenantId = req.query.tenantId;
        const { id, name, phone, email, location, address, occupation, organization } = req.body;
        if (!phone)
            return "Phone number and email required";
        const isPhoneValid = TiifuWorkingClass_1.TiifuWorkingClass.isNumberPhoneNumber(phone);
        const isEmailValid = TiifuWorkingClass_1.TiifuWorkingClass.isEmailValidEmail(email);
        if (!isPhoneValid)
            return "Valid phone number required" /* OperationsFailures.invalidPhoneNumber */;
        if (email && !isEmailValid)
            return "Valid  email required" /* OperationsFailures.invalidEmail */;
        const tenantIdP = parseInt(TenantId.toString());
        const isClinicianExist = await this.isClinicianExist(tenantIdP, email, phone);
        if (isClinicianExist)
            return "This resource already exist" /* OperationsFailures.resourceExist */ + " " + "Email or phone number is already registered with a clinician";
        const values = [name, phone, email ? email : null, location, address, occupation, organization];
        try {
            const result = await (0, helper_1.promisifyQuery)(tenantIdP, queries_1.default.insertClinicianBasicInfo, values);
            const { insertId } = result;
            if (insertId !== 0) {
                const random = require("crypto").randomBytes(5).toString("hex");
                const tempCredentials = `UPDATE clinicianscredentials SET password  = ?`;
                await (0, helper_1.promisifyQuery)(tenantIdP, tempCredentials, [random]);
                return insertId;
            }
            return "Adding new clinician failed";
        }
        catch (err) {
            console.log(err);
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
}
exports.default = ClinicianClass;
