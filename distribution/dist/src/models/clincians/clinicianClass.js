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
const appLevelTriggers_1 = require("../../database/appLevelTriggers");
class ClinicianClass {
    /**
     * Build WHERE clause and parameters for filtering clinicians
     */
    buildFilterQuery(filters) {
        const params = [];
        const conditions = [];
        // Full text search - searches across multiple fields
        if (filters.searchText && filters.searchText.toString().trim() !== "") {
            const searchTerm = `%${filters.searchText}%`;
            conditions.push(`(name LIKE ? OR phone LIKE ? OR email LIKE ? OR location LIKE ? OR address LIKE ? OR occupation LIKE ? OR identifier LIKE ?)`);
            for (let i = 0; i < 7; i++) {
                params.push(searchTerm);
            }
        }
        // Individual field filters
        if (filters.id) {
            conditions.push("id = ?");
            params.push(filters.id);
        }
        if (filters.name && filters.name.toString().trim() !== "") {
            conditions.push("name LIKE ?");
            params.push(`%${filters.name}%`);
        }
        if (filters.location && filters.location.toString().trim() !== "") {
            conditions.push("location LIKE ?");
            params.push(`%${filters.location}%`);
        }
        if (filters.address && filters.address.toString().trim() !== "") {
            conditions.push("address LIKE ?");
            params.push(`%${filters.address}%`);
        }
        if (filters.occupation && filters.occupation.toString().trim() !== "") {
            conditions.push("occupation LIKE ?");
            params.push(`%${filters.occupation}%`);
        }
        if (filters.organization) {
            conditions.push("organization = ?");
            params.push(filters.organization);
        }
        if (filters.phone && filters.phone.toString().trim() !== "") {
            conditions.push("phone LIKE ?");
            params.push(`%${filters.phone}%`);
        }
        if (filters.email && filters.email.toString().trim() !== "") {
            conditions.push("email LIKE ?");
            params.push(`%${filters.email}%`);
        }
        if (filters.identifier && filters.identifier.toString().trim() !== "") {
            conditions.push("identifier LIKE ?");
            params.push(`%${filters.identifier}%`);
        }
        if (filters.created_on && filters.created_on.toString().trim() !== "") {
            conditions.push("DATE(created_on) = ?");
            params.push(filters.created_on);
        }
        if (filters.updated_on && filters.updated_on.toString().trim() !== "") {
            conditions.push("DATE(updated_on) = ?");
            params.push(filters.updated_on);
        }
        const whereClause = conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";
        return { whereClause, params };
    }
    async insertCliniciansBulk(tenantId, clinicians) {
        var _a;
        const results = [];
        const connection = await (0, KnexConnections_1.default)(tenantId);
        for (const record of clinicians) {
            const { name, phone, email, location, address, occupation, organization } = record;
            if (!name || !phone) {
                results.push("Missing required fields: name or phone");
                continue;
            }
            try {
                const values = [name, phone, email ? email : null, location, address, occupation, organization];
                const trx = await connection.transaction();
                try {
                    const [result] = await trx.raw(queries_1.default.insertClinicianBasicInfo, values);
                    const insertId = (result === null || result === void 0 ? void 0 : result.insertId) || ((_a = result === null || result === void 0 ? void 0 : result[0]) === null || _a === void 0 ? void 0 : _a.insertId);
                    if (insertId !== 0 && insertId !== undefined) {
                        const row = await trx("clinicianbasicinfo").select("identifier").where({ id: insertId }).first();
                        const identifier = (row === null || row === void 0 ? void 0 : row.identifier) ? String(row.identifier) : "";
                        await (0, appLevelTriggers_1.applyClinicianAfterInsert)(tenantId, trx, { clinicianid: Number(insertId), identifier });
                        await trx.commit();
                        results.push(insertId);
                    }
                    else {
                        await trx.rollback();
                        results.push("Insert failed");
                    }
                }
                catch (err) {
                    await trx.rollback();
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
    async getClinicians(tenantId, filters) {
        const { count = 10, page = 1, role } = filters || {};
        // Check if any filters are applied
        const hasFilters = filters && Object.keys(filters).some(key => key !== 'page' && key !== 'count' && key !== 'role' && filters[key]);
        // If no filters, use the original logic
        if (!hasFilters) {
            if (role && role.toString().trim() === "admin") {
                return (count && page) ? await (0, helper_1.paginationQuery)({ page: parseInt(page.toString()), count: parseInt(count.toString()) }, queries_1.default.getCliniciansWithExtendedPagination, [], tenantId) :
                    await (0, helper_1.promisifyQuery)(tenantId, queries_1.default.getAllCliniciansWithPaymentInfo);
            }
            else {
                return (count && page) ? await (0, helper_1.paginationQuery)({ page: parseInt(page.toString()), count: parseInt(count.toString()) }, queries_1.default.getCliniciansWithPagination, [], tenantId) :
                    await (0, helper_1.promisifyQuery)(tenantId, queries_1.default.getAllClinicians);
            }
        }
        // Build filter query
        const { whereClause, params } = this.buildFilterQuery(filters);
        // Construct base query with filters
        let baseQuery = "SELECT * FROM clinicianbasicinfo" + whereClause;
        // Add payment info for admin users
        if (role && role.toString().trim() === "admin") {
            baseQuery = `SELECT cbi.*, cbi.id as clinicianid,cpi.id as clinicianpaymentid, cpi.* FROM clinicianbasicinfo AS cbi
				LEFT JOIN clinicianpaymentinfo AS cpi ON cbi.id = cpi.clinicianid${whereClause}`;
        }
        // Execute query with pagination
        if (count && page) {
            const pageNum = parseInt(page.toString());
            const countNum = parseInt(count.toString());
            const offset = (pageNum - 1) * countNum;
            const paginatedQuery = baseQuery + ` LIMIT ? OFFSET ?`;
            params.push(countNum, offset);
            return await (0, helper_1.promisifyQuery)(tenantId, paginatedQuery, params);
        }
        else {
            return await (0, helper_1.promisifyQuery)(tenantId, baseQuery, params);
        }
    }
    static getAllClinicians(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, queries_1.default.getAllClinicians);
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
                const isClinicianExist = await this.isClinicianExist(tenantId, email, phone);
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
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const trx = await connection.transaction();
        try {
            const deleted = await trx("clinicianbasicinfo").where({ id }).del();
            if (deleted > 0) {
                await (0, appLevelTriggers_1.applyClinicianAfterDelete)(trx, id);
            }
            await trx.commit();
            return deleted > 0;
        }
        catch (err) {
            await trx.rollback();
            throw err;
        }
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
                const row = await trx("clinicianbasicinfo").select("identifier").where({ id: insertId }).first();
                const identifier = (row === null || row === void 0 ? void 0 : row.identifier) ? String(row.identifier) : "";
                await (0, appLevelTriggers_1.applyClinicianAfterInsert)(tenantIdP, trx, { clinicianid: Number(insertId), identifier });
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
