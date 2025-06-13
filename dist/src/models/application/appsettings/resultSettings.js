"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const appset_1 = __importDefault(require("../appsettings/appset"));
const queries_1 = require("./queries");
const testApprovalClass_1 = require("../../operations/testApprovalClass");
const helper_1 = require("../../../hooks/helper");
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class ResultSettings extends appset_1.default {
    constructor(id) {
        super();
    }
    static async updateResultEntrySettings(tenantId, resultEntrySettings) {
        if (typeof resultEntrySettings != 'object')
            return false;
        let parsedJson = JSON.stringify(resultEntrySettings);
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_result_entry_settings, [parsedJson]);
        return (0, helper_1.rowAffected)(result);
    }
    static async getResultEntrySettings(tenantId) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_result_entry_settings);
        if (result.length === 0)
            return null;
        let data = result[0]['resultsEntrySettings'];
        if (data)
            return JSON.parse(data);
        return null;
    }
    static async canStaffApproveResult(tenantId, employeeId) {
        const Rsettings = await this.getResultEntrySettings(tenantId);
        if (Rsettings === null)
            return false;
        const staffQualifiedToValidationResult = Rsettings['staffQualifiedToValidationResult'];
        if (staffQualifiedToValidationResult && Array.isArray(staffQualifiedToValidationResult) && staffQualifiedToValidationResult.includes(employeeId)) {
            return true;
        }
    }
    static async isApprovalLimitReached(tenantId, approvalList, ascensionId = null, type = 'maximum') {
        if (!approvalList && !ascensionId) {
            throw new Error("Ascension or approval List Needed!!");
        }
        const currentLen = await ResultSettings.evaluateApprovalListLength(tenantId, approvalList, ascensionId);
        if (typeof currentLen === "boolean")
            return currentLen;
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const recordApproval = await connection('dbotestresultapproval')
            .where({ ascensionid: ascensionId }).first();
        if (!recordApproval)
            return false;
        const { maxvalidation, minvalidation } = recordApproval;
        if (type === 'maximum')
            return currentLen >= parseInt(maxvalidation.toString());
        if (type === 'minimum')
            return currentLen >= parseInt(minvalidation.toString()) && currentLen > 0 && minvalidation > 0;
        return false;
    }
    static async evaluateApprovalListLength(tenantId, approvalList, ascensionId) {
        let currentStaffApproved = [];
        if (Array.isArray(approvalList) && approvalList.length > 0) {
            currentStaffApproved = approvalList;
        }
        else if (typeof approvalList === "number") {
            currentStaffApproved = [approvalList];
        }
        else if (!approvalList && ascensionId) {
            const ascensionStaffsApproved = await new testApprovalClass_1.TestApprovalClass(ascensionId).getAscensionApprovedList(tenantId);
            if (Array.isArray(ascensionStaffsApproved)) {
                currentStaffApproved = ascensionStaffsApproved;
            }
            else if (typeof ascensionStaffsApproved === "number") {
                currentStaffApproved = [ascensionStaffsApproved];
            }
        }
        const currentLen = currentStaffApproved.length;
        console.log(currentLen);
        return currentLen === 0 ? false : currentLen;
    }
    async getResultSettings(tenantId) {
        try {
            let result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.GET_RESULT_SETTINGS);
            return result.length > 0 ? JSON.parse(result[0]["resultsettings"]) : false;
        }
        catch (err) {
            return false;
        }
    }
    async updateResultSettings(request, response) {
        try {
            const { data } = request.body;
            const { tenantId } = request.query;
            if (!data) {
                return (0, helper_1.customError)("400 Bad Request" /* HTTPSTATUSERRORS.HTTP_400_BAD_REQUEST */ + " " + "Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */, 400, response);
            }
            if (Object.keys(data).length === 0) {
                return (0, helper_1.customError)("400 Bad Request" /* HTTPSTATUSERRORS.HTTP_400_BAD_REQUEST */ + " " + "Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */, 400, response);
            }
            const jsonify = JSON.stringify(data);
            let result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.GET_RESULT_SETTINGS);
            if (result.length === 0) {
                const insert = await (0, helper_1.promisifyQuery)(tenantId, queries_1.INSERT_RESULT_SETTINGS, [jsonify]);
                if ((0, helper_1.rowAffected)(insert)) {
                    response.send({ status: "success", message: "update successful" });
                }
                else {
                    response.send({ status: "error", message: "update failed" });
                }
            }
            else {
                const update = await (0, helper_1.promisifyQuery)(tenantId, queries_1.UPDATE_RESULT_SETTINGS, [jsonify]);
                if ((0, helper_1.rowAffected)(update)) {
                    response.send({ status: "success", message: "update successful" });
                }
                else {
                    response.send({ status: "error", message: "update failed" });
                }
            }
        }
        catch (err) {
            console.error(err);
            (0, helper_1.responseError)(response);
        }
    }
}
exports.default = ResultSettings;
