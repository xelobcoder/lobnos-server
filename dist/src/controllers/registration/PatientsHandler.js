"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePatientImageHandler = exports.getNotificationSettingsHandler = exports.updateNotificationSettingsHandler = exports.updateCredentialsHandler = exports.getTransactionsByDateHandler = void 0;
const helper_1 = require("../../hooks/helper");
const logger_1 = __importDefault(require("../../hooks/logger"));
const patientAnalytics_1 = __importDefault(require("../../models/patients/patientAnalytics"));
const getTransactionsByDateHandler = async (request, response) => {
    const { patientid, from, to, tenantId } = request.query;
    if (!patientid) {
        return (0, helper_1.customError)("Patient ID not provided", 401, response);
    }
    const init = new patientAnalytics_1.default(patientid);
    try {
        const tenantIdNum = parseInt(tenantId, 10);
        const data = await init.getTransactionsByDate(tenantIdNum, patientid, from, to);
        if (Array.isArray(data)) {
            response.status(200).send({ result: data, statusCode: 200, status: "success" });
        }
        else {
            (0, helper_1.customError)(data, 401, response);
        }
    }
    catch (err) {
        logger_1.default.error(err);
        (0, helper_1.customError)(err.message, 500, response);
    }
};
exports.getTransactionsByDateHandler = getTransactionsByDateHandler;
const updateCredentialsHandler = async (request, response) => {
    try {
        const { patientid } = request.body;
        const { tenantId } = request.query;
        if (!patientid) {
            throw new Error("Patient ID is required");
        }
        const parsedPatientId = parseInt(patientid.toString(), 10);
        const parsedTenantId = parseInt(tenantId.toString(), 10);
        const status = await new patientAnalytics_1.default(parsedPatientId).updateCredentials(parsedTenantId, request.body);
        const message = status ? "patient credentials updated successfully" : "patient credentials not updated";
        const statusCode = status ? 200 : 401;
        const statusMessage = status ? "success" : "failed";
        response.send({
            message,
            statusCode,
            status: statusMessage
        });
    }
    catch (err) {
        logger_1.default.error(err);
        (0, helper_1.responseError)(response, err);
    }
};
exports.updateCredentialsHandler = updateCredentialsHandler;
const updateNotificationSettingsHandler = async (request, response) => {
    try {
        const { patientid, mode, method, notify } = request.body;
        if (mode && method && notify && patientid) {
            return (0, helper_1.customError)(`mode of result, method of delivery and notification settings required`, 404, response);
        }
        const tenantId = parseInt(request.query.tenantId);
        const status = await new patientAnalytics_1.default(patientid).updateNotificationSettings(tenantId, request.body);
        const message = status ? "patient settings updated successfully" : "patient settings not updated";
        const statusCode = status ? 200 : 401;
        const statusMessage = status ? "success" : "failed";
        response.send({
            message,
            statusCode,
            status: statusMessage
        });
    }
    catch (err) {
        (0, helper_1.responseError)(response);
    }
};
exports.updateNotificationSettingsHandler = updateNotificationSettingsHandler;
const getNotificationSettingsHandler = async (request, response) => {
    try {
        const { tenantId, patientid } = request.query;
        if (!patientid) {
            throw new Error("Patient ID is required");
        }
        const parsedPatientId = parseInt(patientid.toString(), 10);
        const parsedTenantId = parseInt(tenantId.toString(), 10);
        const notications = await new patientAnalytics_1.default(parsedPatientId).getPatientNotificationSettings(parsedTenantId, parsedPatientId);
        response.send(notications);
    }
    catch (err) {
        (0, helper_1.responseError)(response, err);
    }
};
exports.getNotificationSettingsHandler = getNotificationSettingsHandler;
const updatePatientImageHandler = async (request, response) => {
    try {
        const { patientid, tenantId, savedFilename } = request.query;
        if (!patientid) {
            throw new Error("Patient ID is required");
        }
        if (!savedFilename) {
            throw new Error("No file uploaded");
        }
        const parsedPatientId = parseInt(patientid, 10);
        const parsedTenantId = parseInt(tenantId, 10);
        const status = await new patientAnalytics_1.default(parsedPatientId).updatePatientImage(parsedTenantId, parsedPatientId, savedFilename);
        const statusState = status ? 'success' : 'error';
        const statusMessage = status ? 'Patient image updated successfully' : 'Patient image update failed';
        response.status(200).json({
            status: statusState,
            message: statusMessage,
            imagePath: savedFilename
        });
    }
    catch (err) {
        (0, helper_1.responseError)(response, err);
    }
};
exports.updatePatientImageHandler = updatePatientImageHandler;
