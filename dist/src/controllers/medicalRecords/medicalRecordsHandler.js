"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllPendingConsultationRecords = exports.getAllConsultationRecords = exports.deleteAConsultationRecord = exports.updateAConsultationRecord = exports.getConsultationRecordById = exports.createAConsultationRecord = void 0;
const medicalRecordClass_1 = __importDefault(require("../../models/MedicalRecords/medicalRecordClass"));
const createAConsultationRecord = async (request, response) => {
    try {
        const { complaints, hpc, pmh, sh, odq, dhx, se, fh, obsGynecHistory, oe, record_type, patientid, consulationby, associatedTransactionid } = request.body;
        if (!complaints || !patientid || !record_type) {
            response.status(400).json({ message: "Missing required fields: complaints, record_type, or patientid." });
        }
        else {
            const tenantId = parseInt(request.query.tenantId.toString());
            const medicalRecordsService = new medicalRecordClass_1.default();
            const recordId = await medicalRecordsService.createRecord(tenantId, {
                complaints, hpc, pmh, sh, record_type, odq, dhx, se, fh,
                obsGynecHistory, oe, consulationby, patientid, associatedTransactionid
            });
            response.status(201).json({ message: "Record created successfully.", recordId });
        }
    }
    catch (err) {
        console.error("Error creating record:", err);
        response.status(500).json({ message: "Internal Server Error." });
    }
};
exports.createAConsultationRecord = createAConsultationRecord;
const getConsultationRecordById = async (request, response) => {
    try {
        const { consultationid, tenantId } = request.query;
        if (!consultationid) {
            response.status(400).json({ message: "Record ID is required." });
        }
        else {
            const tenantIdP = parseInt(tenantId.toString());
            const medicalRecordsService = new medicalRecordClass_1.default();
            const record = await medicalRecordsService.getRecordById(tenantIdP, parseInt(consultationid));
            if (!record) {
                response.status(404).json({ message: "Record not found." });
            }
            else {
                response.status(200).json(record);
            }
        }
    }
    catch (err) {
        console.error("Error fetching record:", err);
        response.status(500).json({ message: "Internal Server Error." });
    }
};
exports.getConsultationRecordById = getConsultationRecordById;
const updateAConsultationRecord = async (request, response) => {
    try {
        const { consultationid, tenantId } = request.query;
        const updates = request.body;
        if (!consultationid) {
            response.status(400).json({ message: "Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */ + " consultationid not included" });
        }
        else {
            const parsedConsultationid = parseInt(consultationid);
            const tenantIdP = parseInt(tenantId.toString());
            const medicalRecordsService = new medicalRecordClass_1.default();
            const isUpdateSuccess = await medicalRecordsService.updateRecord(tenantIdP, parsedConsultationid, updates);
            response.status(200).json({ status: isUpdateSuccess });
        }
    }
    catch (err) {
        console.error("Error updating record:", err);
        response.status(500).json({ message: "Internal Server Error." });
    }
};
exports.updateAConsultationRecord = updateAConsultationRecord;
const deleteAConsultationRecord = async (request, response) => {
    try {
        const { consultationid, tenantId } = request.query;
        if (!consultationid) {
            response.status(400).json({ message: "Record ID is required." });
        }
        else {
            const tenantIdP = parseInt(tenantId.toString());
            const medicalRecordsService = new medicalRecordClass_1.default();
            await medicalRecordsService.deleteRecord(tenantIdP, parseInt(consultationid));
            response.status(200).json({ message: "Record deleted successfully." });
        }
    }
    catch (err) {
        console.error("Error deleting record:", err);
        response.status(500).json({ message: "Internal Server Error." });
    }
};
exports.deleteAConsultationRecord = deleteAConsultationRecord;
const getAllConsultationRecords = async (request, response) => {
    try {
        const { count, page, tenantId } = request.query;
        const tenantIdP = parseInt(tenantId);
        const medicalRecordsService = new medicalRecordClass_1.default();
        const records = await medicalRecordsService.getAllRecords(tenantIdP, page, count);
        response.status(200).json(records);
    }
    catch (err) {
        console.error("Error fetching all records:", err);
        response.status(500).json({ message: "Internal Server Error." });
    }
};
exports.getAllConsultationRecords = getAllConsultationRecords;
const getAllPendingConsultationRecords = async (request, response) => {
    try {
        const { count, page } = request.query;
        const pageSize = count ? parseInt(count) : 10;
        const currentPage = page ? parseInt(page) : 1;
        const pending = await medicalRecordClass_1.default.getPendingConsultationServices(currentPage, pageSize);
        response.send(pending);
    }
    catch (err) {
        console.error("Error fetching all records:", err);
        response.status(500).json({ message: "Internal Server Error." });
    }
};
exports.getAllPendingConsultationRecords = getAllPendingConsultationRecords;
