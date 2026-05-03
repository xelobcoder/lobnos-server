"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSampleDisputeLog = exports.disputeSampleRejection = exports.rejectedSampleApproval = exports.getRejectedSamplesList = void 0;
const logger_1 = __importDefault(require("../../../hooks/logger"));
const sampleClass_1 = require("../../../models/operations/sample/sampleClass");
const helper_1 = require("../../../hooks/helper");
const getRejectedSamplesList = async (request, response) => {
    try {
        const { count, page, tenantId } = request.query;
        const list = await sampleClass_1.SampleHandler.getRejectedCollectedSample(parseInt(tenantId), { count, page });
        response.send({ status: "success", data: list });
    }
    catch (error) {
        logger_1.default.error(error);
        (0, helper_1.responseError)(response);
    }
};
exports.getRejectedSamplesList = getRejectedSamplesList;
const rejectedSampleApproval = async (request, response) => {
    try {
        const { tenantId } = request.query;
        const tenantIdP = parseInt(tenantId);
        const approval = await sampleClass_1.SampleHandler.updateTestSampleApprovalStatusBulk(tenantIdP, request.body);
        response.send({ status: approval.status ? "success" : "error", message: approval.message });
    }
    catch (error) {
        logger_1.default.error(error);
        (0, helper_1.responseError)(response);
    }
};
exports.rejectedSampleApproval = rejectedSampleApproval;
const disputeSampleRejection = async (request, response) => {
    try {
        const { tenantId } = request.query;
        const { ascensionid, disputereason, disputedby, disputedon } = request.body;
        if (!ascensionid || !disputedby || !disputereason) {
            return (0, helper_1.customError)('ascensionid, disputereason, disputedby, disputedon missing', 404, null);
        }
        const status = await sampleClass_1.SampleHandler.disputeSampleRejection(parseInt(tenantId.toString()), request.body);
        if (status == true) {
            return response.send({ status: "success", message: "sample dispute logged successfully", statusCode: 200 });
        }
        else {
            return response.send({ status: "error", message: "error logging sample dispute", statusCode: 500 });
        }
    }
    catch (error) {
        logger_1.default.error(error);
        (0, helper_1.responseError)(response);
    }
};
exports.disputeSampleRejection = disputeSampleRejection;
const getSampleDisputeLog = async (request, response) => {
    try {
        const { ascensionid, branch, page, count, tenantId } = request.query;
        if (!ascensionid || isNaN(ascensionid) || !branch || isNaN(branch)) {
            return (0, helper_1.customError)("400 Bad Request" /* HTTPSTATUSERRORS.HTTP_400_BAD_REQUEST */ + " " + "Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */, 400, response);
        }
        const log = await sampleClass_1.SampleHandler.getSampleDisputeLog(parseInt(tenantId), { ascensionid, branchid: branch, count, page });
        response.send({ status: "success", data: log });
    }
    catch (error) {
        logger_1.default.error(error);
        (0, helper_1.responseError)(response);
    }
};
exports.getSampleDisputeLog = getSampleDisputeLog;
