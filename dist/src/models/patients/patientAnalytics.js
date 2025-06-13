"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = __importDefault(require("../../hooks/logger"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const user_1 = __importDefault(require("../../LobnosAuth/user"));
const registration_1 = __importDefault(require("../../models/registration/registration"));
const queries_1 = require("./queries");
const helper_1 = require("../../hooks/helper");
const DatabaseQueriesHelper_1 = __importDefault(require("../../database/DatabaseQueriesHelper"));
const partitioning_1 = __importDefault(require("../billing/partitioning"));
const PatientImageRepository_1 = __importDefault(require("../../repositories/patientRepositories/PatientImageRepository"));
class Patient extends registration_1.default {
    constructor(patientid) {
        super();
        this.runqueryPromise = helper_1.promisifyQuery;
    }
    async getTransactionsByDate(tenantId, patientid, to, from) {
        if (await registration_1.default.checkPatientIdExist(tenantId, patientid)) {
            let query = queries_1.PatientQuery.getTransactionsByDate;
            let values = [patientid];
            if (from && to) {
                query += ` AND DATE BETWEEN ? AND ?`;
                values = [...values, from, to];
            }
            return this.runqueryPromise(tenantId, query, values);
        }
        else {
            return "Resource not found." /* OperationsFailures.notFound */;
        }
    }
    async updateCredentials(tenantId, data) {
        const { opassword, npassword, nppassword, patientid, employeeid, providedUsername } = data;
        const isUserAdmin = await new user_1.default().getExpectedRole(employeeid, 'admin', tenantId);
        if (isUserAdmin) {
            return await this.updatePatientPassWordCredential(providedUsername, npassword, tenantId, patientid);
        }
        let oldpassworldMatched = null;
        const isValid = await registration_1.default.checkPatientIdExist(tenantId, patientid);
        const matched = nppassword === nppassword;
        const db_old_password = await DatabaseQueriesHelper_1.default.getSingleId(tenantId, patientid, "patients_credentials", "patientid");
        let username = '';
        if (Array.isArray(db_old_password) && db_old_password.length > 0) {
            const { username: name, password, updated } = db_old_password[0];
            username = name;
            if (updated == "true") {
                const compare = await bcrypt_1.default.compare(opassword, password);
                oldpassworldMatched = compare;
            }
            else {
                oldpassworldMatched = opassword === password;
            }
        }
        if (!isValid) {
            throw new Error("Invalid membership id or username");
        }
        if (!matched) {
            throw new Error("new password match error");
        }
        if (!oldpassworldMatched) {
            throw new Error(`invalid old password credentials`);
        }
        if (isValid && matched && oldpassworldMatched) {
            await this.updatePatientPassWordCredential(username, npassword, tenantId, patientid);
        }
    }
    async updatePatientPassWordCredential(username, npassword, tenantId, patientid) {
        const hashedPassword = await new user_1.default(username, npassword, null, null, null).hashPassword();
        const updateQuery = queries_1.PatientQuery.updateCredentials;
        try {
            const result = await this.runqueryPromise(tenantId, updateQuery, [username, hashedPassword, patientid]);
            return (0, helper_1.rowAffected)(result);
        }
        catch (err) {
            logger_1.default.error(err);
            throw new Error("Failed to update patient credentials");
        }
    }
    async updateNotificationSettings(tenantId, data) {
        const { mode, method, notify, patientid } = data;
        const updateQuery = queries_1.PatientQuery.updateNotificationSettings;
        const updated = await this.runqueryPromise(tenantId, updateQuery, [mode, method, notify, parseInt(patientid)]);
        return (0, helper_1.rowAffected)(updated);
    }
    async transformDataset(list, data) {
        return list
            .map((item, index) => {
            const filtered = data.filter((e, i) => {
                if (e.billingid == parseInt(item)) {
                    return (0, helper_1.convertKeysToLowerCase)(e);
                }
            });
            return { billingid: item, data: filtered, date: filtered.length > 0 ? filtered[0]["created_on"] : null };
        })
            .sort((a, b) => {
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
    }
    async getParameters(data) {
        let parameters = [];
        data.map((item, index) => {
            if (!parameters.includes(item === null || item === void 0 ? void 0 : item.parameter)) {
                parameters.push(item === null || item === void 0 ? void 0 : item.parameter);
            }
        });
        return parameters;
    }
    async getPatientBillingRecords(tenantId, details) {
        const { patientid, count = 10, page = 1, startdate, enddate } = details;
        if (!patientid || isNaN(patientid))
            throw new Error("patientid required");
        let query, values = [];
        if (startdate && enddate) {
            const startYear = new Date(startdate).getFullYear();
            const endYear = new Date(enddate).getFullYear();
            const stMonth = new Date(startdate).getMonth();
            const edMonth = new Date(enddate).getMonth();
            let partitions = await new partitioning_1.default("billing", "billing").TablePartitionPrunner(tenantId, startdate, enddate);
            query = queries_1.PatientQuery.getPatientBillingRecordsWithPartition;
            values = [patientid, startYear, endYear, count, (page - 1) * count];
        }
        else if (startdate) {
            const startYear = new Date(startdate).getFullYear();
            query = queries_1.PatientQuery.getPatientBillingRecordsStartDate;
            values = [patientid, startYear, count, (page - 1) * count];
        }
        else {
            query = queries_1.PatientQuery.getPatientBillingRecords;
            values = [patientid, count, (page - 1) * count];
        }
        const result = await (0, helper_1.promisifyQuery)(tenantId, query, values);
        return result;
    }
    async getPatientNotificationSettings(tenantId, patientid) {
        const notications = await (0, helper_1.promisifyQuery)(tenantId, queries_1.PatientQuery.getPatientNotificationSettings, [patientid]);
        return notications.length > 0 ? notications[0] : null;
    }
    async updatePatientImage(tenantId, patientId, imagePath) {
        try {
            const hasImage = await PatientImageRepository_1.default.findByPatientId(tenantId, patientId);
            if (hasImage) {
                return await PatientImageRepository_1.default.update(tenantId, patientId, imagePath);
            }
            else {
                return await PatientImageRepository_1.default.create(tenantId, patientId, imagePath);
            }
        }
        catch (error) {
            logger_1.default.error(error);
            throw new Error("Failed to update patient image");
        }
    }
}
exports.default = Patient;
