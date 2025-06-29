"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const TiifuWorkingClass_1 = require("../../database/TiifuWorkingClass");
const helper_1 = require("../../hooks/helper");
const logger_1 = __importDefault(require("../../hooks/logger"));
const appset_1 = __importDefault(require("../application/appsettings/appset"));
const queries_1 = require("./queries");
class Registration {
    static async getPatientID(tenantId, patientid) {
        if (typeof patientid !== "number") {
            throw new TypeError("number required as insertedId");
        }
        const information = await new TiifuWorkingClass_1.TiifuWorkingClass("new_patients").findOne(tenantId, "patientid", patientid);
        if (!information)
            return null;
        return information.patientid;
    }
    static async generatePatientFullUniqueId(tenantId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const lastPatient = await connection("new_patients")
            .select("patientid")
            .orderBy("patientid", "desc")
            .first();
        const lastId = lastPatient ? lastPatient.patientid + 1 : 1;
        const paddedId = String(lastId).padStart(6, "0");
        const codeValues = await appset_1.default.getLabRegionalAndDistrictCodeAbbreviations(tenantId);
        console.log(codeValues, lastId);
        if (!codeValues)
            return null;
        return `${codeValues.region}-${paddedId}-${codeValues.district}`;
    }
    static async getPatientDataUsingPatientId(tenantId, patientid) {
        if (!patientid)
            return "No Arguments Provided" /* OperationsFailures.noArgumentsProvided */;
        return await new TiifuWorkingClass_1.TiifuWorkingClass("new_patients").findOne(tenantId, "patientid", patientid);
    }
    checkEmailOrMobileExist(tenantId, email, mobile) {
        throw new Error("Method not implemented.");
    }
    static registeredPatientIdOnDatabaseTable(tenantId, generatedId) {
        throw new Error("Method not implemented.");
    }
    static async checkPatientIdExist(tenantId, patientid) {
        let result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_patient_data, [patientid]);
        return result.length > 0;
    }
    async getPatientBasicData(tenantId, patientid) {
        const rows = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_patient_data, [patientid]);
        return rows.length > 0 ? rows[0] : null;
    }
    static async addPersonalInformation(tenantId, records) {
        const generatedId = await this.generatePatientFullUniqueId(tenantId);
        if (generatedId) {
            const { firstname, lastname, middlename, age, ageType, gender, email, mobile, days, months, maritalstatus, occupation, patientOrganization, years, mobileownership = "self", } = records;
            const values = [
                firstname,
                lastname,
                middlename,
                email,
                age,
                ageType,
                `${years}-${months}-${days}`,
                maritalstatus,
                mobile,
                occupation,
                gender,
                patientOrganization,
                generatedId,
                mobileownership,
            ];
            const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_new_registation, values);
            return result.insertId;
        }
    }
    static async emmergencyInformation(tenantId, id, records) {
        const { emmergencyContactName, emmergencyContactNumber, relationship, address, occupation } = records;
        const values = [emmergencyContactName, emmergencyContactNumber, relationship, occupation, address, id];
        return (0, helper_1.rowAffected)(await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_patient_update_emmergency_information, values));
    }
    async getCustomersRecords(tenantId, data) {
        const { count = 10, mobile, page = 1, fullname, email, patientid, from, to } = data;
        var query = queries_1.q_filter_patients;
        if (patientid) {
            const is_valid_ptid = await Registration.checkPatientIdExist(tenantId, patientid);
            if (is_valid_ptid) {
                return await this.getPatientBasicData(tenantId, patientid);
            }
        }
        const values = [];
        let conditions = [];
        const mob_str = `${mobile}`;
        var isMobright = mobile && mob_str.length == 10 && mob_str.charAt(0) == "0" && !isNaN(mobile);
        var mobileNum;
        if (mobile && !isMobright && mob_str.length == 9 && mob_str.charAt(0) != "0") {
            mobileNum = mob_str.padStart(10, "0");
            conditions.push(`mobile_number = ?`);
            values.push(mobileNum);
        }
        if (fullname && fullname.length > 2) {
            conditions.push(`CONCAT(firstname, ' ', COALESCE(middlename, ''), ' ', lastname) LIKE ?`);
            values.push(`%${fullname}%`);
        }
        if (email && email.includes("@")) {
            conditions.push(` email = ?`);
            values.push(email);
        }
        if (from) {
            conditions.push(`date >= ?`);
            values.push(from);
        }
        if (to) {
            conditions.push(`date <= ?`);
            values.push(to);
        }
        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(" AND ");
        }
        const offset = (page - 1) * count;
        values.push(parseInt(count.toString()));
        values.push(offset);
        query += ` ORDER BY patientid DESC LIMIT ? OFFSET ? `;
        try {
            let result = await (0, helper_1.promisifyQuery)(tenantId, query, values);
            return result;
        }
        catch (err) {
            return [];
        }
    }
    addressingInformation(tenantId, paientid, records) {
        throw new Error("Method not implemented.");
    }
    static async UpdatePersonalInformation(tenantId, clientdata, patientid) {
        const isPatientId = await this.checkPatientIdExist(tenantId, patientid);
        if (!isPatientId)
            return "Resource not found." /* OperationsFailures.notFound */;
        const { designation, firstname, lastname, middlename, age, ageType, gender, email, mobile, days, months, maritalstatus, occupation, patientOrganization, years, whatAppcontact } = clientdata;
        const values = [
            firstname,
            designation,
            lastname,
            middlename,
            email,
            age,
            ageType,
            `${years}-${months}-${days}`,
            maritalstatus,
            mobile,
            occupation,
            gender,
            patientOrganization,
            whatAppcontact,
            patientid,
        ];
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_patient_update_personal_information, values);
        return (0, helper_1.rowAffected)(result);
    }
    async getPatientInfoUsingBillingId(tenantId, billingid) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_filter_patient_using_billingid_query, [billingid]);
        return result;
    }
    static async isBulkRegistration(tenantId) {
        try {
            const query = `SELECT bulkregistration FROM applicationsettings`;
            const result = await (0, helper_1.promisifyQuery)(tenantId, query);
            if (result.length === 0)
                return false;
            const { bulkregistration } = result[0];
            return bulkregistration === 1;
        }
        catch (err) {
            throw new Error(err);
        }
    }
    static async addressingInformationStatic(tenantId, id, records) {
        try {
            const { area, region, gpsLocation, address, country, districtCode } = records;
            const values = [area, country, districtCode, region, gpsLocation, address, id];
            const result = (0, helper_1.rowAffected)(await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_patient_update_patient_addressing, values));
            return result;
        }
        catch (err) {
            throw new Error((err === null || err === void 0 ? void 0 : err.message) || err);
        }
    }
    static async isClientSame(tenantId, clientdata) {
        try {
            const { mobile, mobileownership, email } = clientdata;
            const verifyOwnerShip = (result) => {
                if (result.length > 0) {
                    if (mobileownership == 'relative') {
                        return false;
                    }
                    else {
                        return true;
                    }
                }
                else {
                    return false;
                }
            };
            if (mobile && mobile.toString().length > 0) {
                const result = await (0, helper_1.promisifyQuery)(tenantId, `SELECT mobile_number AS mobile FROM new_patients WHERE mobile_number = ?`, [parseInt(mobile.toString())]);
                return verifyOwnerShip(result);
            }
            if (email && email.toString().length > 0 && email.includes("@")) {
                const result = await (0, helper_1.promisifyQuery)(tenantId, `SELECT email FROM new_patients WHERE email = ?`, [email]);
                return verifyOwnerShip(result);
            }
        }
        catch (err) {
            logger_1.default.error(err);
        }
    }
    static async addNewPatient(tenantId, request, response) {
        const { data } = request.body;
        try {
            const isAlreadyRegistered = await this.isClientSame(tenantId, data);
            if (isAlreadyRegistered) {
                response.status(404).send({
                    status: "warning",
                    message: (data === null || data === void 0 ? void 0 : data.mobileownership) === "relative"
                        ? "Number or email is associated with a patient. Please search and bill client to continue."
                        : "Number or email is associated with a different patient. Select 'relative' if the person is a relative.",
                });
                return;
            }
            const insertId = await this.addPersonalInformation(tenantId, data);
            response.status(200).send({
                status: "success",
                message: "New patient added successfully",
                patientid: insertId,
            });
        }
        catch (error) {
            console.log(error);
            response.status(500).send({
                status: "error",
                message: "An error occurred while trying to add a new patient",
                error: error.message || error,
            });
        }
    }
}
exports.default = Registration;
