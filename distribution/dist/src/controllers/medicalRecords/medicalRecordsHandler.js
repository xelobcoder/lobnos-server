"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllPendingConsultationRecords = exports.getAllConsultationRecords = exports.deleteAConsultationRecord = exports.updateAConsultationRecord = exports.getConsultationRecordById = exports.createAConsultationRecord = void 0;
const medicalRecordClass_1 = __importDefault(require("../../models/MedicalRecords/medicalRecordClass"));
const createAConsultationRecord = async (request, response) => {
    try {
        const { consultation_notes, record_type, patientid, consulationby, associatedTransactionid } = request.body;
        if (!consultation_notes || !patientid || !record_type || !consulationby) {
            return response.status(400).json({ message: "Missing required fields: consultation_notes, record_type, patientid, or consulationby." });
        }
        const tenantId = parseInt(request.query.tenantId.toString());
        const medicalRecordsService = new medicalRecordClass_1.default();
        const recordId = await medicalRecordsService.createRecord(tenantId, {
            progress_report: consultation_notes,
            record_type: record_type,
            patientid,
            consulationby,
            associatedTransactionid: associatedTransactionid || null
        });
        response.status(201).json({ message: "Record created successfully.", recordId });
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
        let updates = request.body;
        if (!consultationid) {
            return response.status(400).json({ message: "Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */ + " consultationid not included" });
        }
        // Map consultation_notes to progress_report if provided
        if ('consultation_notes' in request.body) {
            const _a = request.body, { consultation_notes } = _a, rest = __rest(_a, ["consultation_notes"]);
            updates = Object.assign({ progress_report: consultation_notes }, rest);
        }
        const parsedConsultationid = parseInt(consultationid);
        const tenantIdP = parseInt(tenantId.toString());
        const medicalRecordsService = new medicalRecordClass_1.default();
        const isUpdateSuccess = await medicalRecordsService.updateRecord(tenantIdP, parsedConsultationid, updates);
        response.status(200).json({ status: isUpdateSuccess });
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
        const search = request.query.search;
        const patient = request.query.patientid;
        const medicalRecordsService = new medicalRecordClass_1.default();
        const records = await medicalRecordsService.getAllRecords(tenantIdP, page, patient ? parseInt(patient.toString()) : undefined, count, search ? parseInt(search) : undefined);
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
        const { count, page, sortby } = request.query;
        const pageSize = count ? parseInt(count) : 10;
        const tenantId = request.query.tenantId ? parseInt(request.query.tenantId.toString()) : 0;
        const currentPage = page ? parseInt(page) : 1;
        const sortOrder = sortby === 'DESC' ? 'DESC' : 'ASC';
        const pending = await medicalRecordClass_1.default.getPendingConsultationServices(tenantId, currentPage, pageSize, sortOrder);
        response.send(pending);
    }
    catch (err) {
        console.error("Error fetching all records:", err);
        response.status(500).json({ message: "Internal Server Error." });
    }
};
exports.getAllPendingConsultationRecords = getAllPendingConsultationRecords;
