"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = __importDefault(require("../../hooks/logger"));
const user_1 = __importDefault(require("../../LobnosAuth/user"));
const registration_1 = __importDefault(require("../registration/registration"));
const queries_1 = require("./queries");
const helper_1 = require("../../hooks/helper");
const PatientImageRepository_1 = __importDefault(require("../../repositories/patientRepositories/PatientImageRepository"));
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class Patient extends registration_1.default {
    constructor(patientid) {
        super();
        this.runqueryPromise = helper_1.promisifyQuery;
    }
    static async checkNumberBelongsToPatient(tenantId, patientid, mobileno) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const result = await connection("new_patients")
            .where("patientid", patientid)
            .andWhere("mobile_number", mobileno)
            .first();
        return result ? true : false;
    }
    async getTransactionsByDate(tenantId, patientid, to, from) {
        const isPatientExists = await registration_1.default.checkPatientIdExist(tenantId, patientid);
        if (isPatientExists) {
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
