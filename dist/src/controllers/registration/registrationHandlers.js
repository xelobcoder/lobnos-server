"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPatientImagePathHandler = exports.getRegistrationSettings = exports.getEmergencyContactInformation = exports.getAddressingInformation = exports.checkMobileNumber = exports.getPersonalInformation = exports.updateAddressingInformation = exports.updateEmergencyContactInformation = exports.getPatientAuditHistoryHandler = exports.updatePersonalInformation = exports.addNewPatient = void 0;
const registration_1 = __importDefault(require("../../models/registration/registration"));
const DatabaseQueriesHelper_1 = __importDefault(require("../../database/DatabaseQueriesHelper"));
const helper_1 = require("../../hooks/helper");
const logger_1 = __importDefault(require("../../hooks/logger"));
const PatientImageRepository_1 = __importDefault(require("../../repositories/patientRepositories/PatientImageRepository"));
const patientRepo_1 = __importDefault(require("../../models/patients/patientRepo"));
const patientAddressingRepo_repo_1 = __importDefault(require("../../models/patients/respositories/patientAddressingRepo.repo"));
const emmergencyPatient_repo_1 = __importDefault(require("../../models/patients/respositories/emmergencyPatient.repo"));
const newPatientsRepo_repo_1 = __importDefault(require("../../models/patients/respositories/newPatientsRepo.repo"));
const addNewPatient = async (request, res) => {
    try {
        const tenantId = parseInt(request.query.tenantId);
        await registration_1.default.addNewPatient(tenantId, request, res);
    }
    catch (error) {
        console.log(error);
        (0, helper_1.customError)("Error registering patient", 500, res);
    }
};
exports.addNewPatient = addNewPatient;
const updatePersonalInformation = async (request, response) => {
    const tenantId = parseInt(request.query.tenantId, 10);
    const { patientid } = request.query;
    const parsedPatientId = parseInt(patientid);
    if (!patientid || isNaN(parsedPatientId)) {
        return (0, helper_1.customError)("patientid not included in the request", 400, response);
    }
    try {
        const data = request.body;
        const result = await registration_1.default.UpdatePersonalInformation(tenantId, data, parsedPatientId);
        response.send({ status: result });
    }
    catch (error) {
        (0, helper_1.customError)((error === null || error === void 0 ? void 0 : error.message) || "Error updating personal information", 500, response);
    }
};
exports.updatePersonalInformation = updatePersonalInformation;
const getPatientAuditHistoryHandler = async (request, response) => {
    const tenantId = parseInt(request.query.tenantId, 10);
    const { patientid } = request.query;
    const parsedPatientId = parseInt(patientid);
    if (!patientid || isNaN(parsedPatientId)) {
        return (0, helper_1.customError)("patientid not included in the request", 400, response);
    }
    try {
        const result = await registration_1.default.getPatientAuditHistory(tenantId, parsedPatientId);
        response.send({ status: true, result });
    }
    catch (error) {
        (0, helper_1.customError)((error === null || error === void 0 ? void 0 : error.message) || "Error fetching patient audit history", 500, response);
    }
};
exports.getPatientAuditHistoryHandler = getPatientAuditHistoryHandler;
const updateEmergencyContactInformation = async (request, response) => {
    const tenantId = parseInt(request.query.tenantId, 10);
    const { patientid } = request.query;
    const parsedPatientId = parseInt(patientid);
    if (!patientid || isNaN(parsedPatientId)) {
        return (0, helper_1.customError)("patientid not included in the request", 400, response);
    }
    try {
        const result = await registration_1.default.emmergencyInformation(tenantId, parsedPatientId, request.body);
        if (result === true) {
            response.send({
                message: "record updated successfully",
                statusCode: 200,
                status: "success",
            });
        }
        else {
            response.send({
                message: "No record updated",
                statusCode: 200,
                status: "error",
            });
        }
    }
    catch (error) {
        (0, helper_1.customError)("Error updating emergency contact information", 500, response);
    }
};
exports.updateEmergencyContactInformation = updateEmergencyContactInformation;
const updateAddressingInformation = async (request, response) => {
    const tenantId = parseInt(request.query.tenantId, 10);
    const { patientid } = request.query;
    const parsedPatientId = parseInt(patientid);
    if (!patientid || isNaN(parsedPatientId)) {
        return (0, helper_1.customError)("patientid not included in the request", 400, response);
    }
    try {
        const records = request.body;
        const info = await new patientAddressingRepo_repo_1.default(tenantId).update(parsedPatientId, records);
        if (info) {
            response.send({
                message: "record updated successfully",
                statusCode: 200,
                status: "success",
            });
        }
        else {
            response.send({
                message: "No record updated",
                statusCode: 200,
                status: "success",
            });
        }
    }
    catch (error) {
        console.error(error);
        (0, helper_1.customError)("Error updating addressing information", 500, response);
    }
};
exports.updateAddressingInformation = updateAddressingInformation;
const getPersonalInformation = async (request, response) => {
    const tenantId = parseInt(request.query.tenantId, 10);
    const { patientid } = request.query;
    const parsedPatientId = parseInt(patientid);
    if (!patientid || isNaN(parsedPatientId))
        return (0, helper_1.customError)("patientid not included in the request", 400, response);
    try {
        const data = await DatabaseQueriesHelper_1.default.getSingleId(tenantId, parsedPatientId, "new_patients", "patientid");
        response.send({ statusCode: 200, status: "success", result: data });
    }
    catch (error) {
        logger_1.default.error(error);
        (0, helper_1.customError)("Error fetching personal information", 500, response);
    }
};
exports.getPersonalInformation = getPersonalInformation;
const checkMobileNumber = async (request, response) => {
    const tenantId = parseInt(request.query.tenantId, 10);
    const patientid = request.query.patientid ? parseInt(request.query.patientid.toString(), 10) : undefined;
    if (patientid && isNaN(patientid))
        return (0, helper_1.customError)("patientid is not a valid number", 400, response);
    if (patientid) {
        const belongsToPatient = await patientRepo_1.default.checkNumberBelongsToPatient(tenantId, patientid, request.query.mobileno);
        if (belongsToPatient) {
            return response.send({
                statusCode: 200,
                status: "success",
                exist: true,
            });
        }
        return response.send({
            statusCode: 200,
            status: "success",
            exist: false,
        });
    }
    const sanitizedMobileNumber = request.query.mobileno.toString().padStart(10, '0');
    const data = await new newPatientsRepo_repo_1.default(tenantId).filterPatient({ mobile_number: sanitizedMobileNumber });
    return response.send({
        statusCode: 200,
        status: "success",
        exist: data.length > 0,
        result: request.query.isGetData ? data : undefined,
    });
};
exports.checkMobileNumber = checkMobileNumber;
const getAddressingInformation = async (request, response) => {
    const tenantId = parseInt(request.query.tenantId, 10);
    const { patientid } = request.query;
    if (!patientid) {
        return (0, helper_1.customError)("patientid not included in the request", 400, response);
    }
    const normalizedPatientId = parseInt(patientid);
    if (isNaN(normalizedPatientId)) {
        return (0, helper_1.customError)("patientid is not a valid number", 400, response);
    }
    try {
        const data = await new patientAddressingRepo_repo_1.default(tenantId).get(normalizedPatientId);
        if (data) {
            response.send({ statusCode: 200, status: "success", result: data });
        }
        else {
            response.send({ statusCode: 200, status: "success", result: [] });
        }
    }
    catch (error) {
        logger_1.default.error(error);
        return (0, helper_1.customError)("Error fetching addressing information", 500, response);
    }
};
exports.getAddressingInformation = getAddressingInformation;
const getEmergencyContactInformation = async (request, response) => {
    const tenantId = parseInt(request.query.tenantId, 10);
    const { patientid } = request.query;
    if (!patientid) {
        return (0, helper_1.customError)("patientid not included in the request", 400, response);
    }
    const normalizedPatientId = parseInt(patientid);
    if (isNaN(normalizedPatientId)) {
        return (0, helper_1.customError)("patientid is not a valid number", 400, response);
    }
    try {
        const data = await new emmergencyPatient_repo_1.default(tenantId).get(normalizedPatientId);
        if (data) {
            response.send({ statusCode: 200, status: "success", result: data });
        }
        else {
            response.send({ statusCode: 200, status: "success", result: [] });
        }
    }
    catch (error) {
        console.error(error);
        return (0, helper_1.customError)("Error fetching emergency contact information", 500, response);
    }
};
exports.getEmergencyContactInformation = getEmergencyContactInformation;
const getRegistrationSettings = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const settings = await registration_1.default.isBulkRegistration(tenantId);
        res.send({
            status: "success",
            message: "settings retrieved successfully",
            statusCode: 200,
            bulkRegistration: settings,
        });
    }
    catch (error) {
        console.error(error);
        (0, helper_1.customError)("Error fetching registration settings", 500, res);
    }
};
exports.getRegistrationSettings = getRegistrationSettings;
const getPatientImagePathHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId, 10);
        const patientid = parseInt(req.query.patientid, 10);
        if (!patientid) {
            return (0, helper_1.customError)("patientid not included in the request", 400, res);
        }
        const imagePath = await PatientImageRepository_1.default.findByPatientId(tenantId, patientid);
        res.send({
            status: "success",
            message: "image path retrieved successfully",
            statusCode: 200,
            imagePath,
        });
    }
    catch (error) {
        logger_1.default.log(error);
        (0, helper_1.customError)("Error fetching image path", 500, res);
    }
};
exports.getPatientImagePathHandler = getPatientImagePathHandler;
