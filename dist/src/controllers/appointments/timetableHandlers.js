"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.countAttendanceByStatus = exports.getAttendanceByEmployee = exports.getAttendanceByCycle = exports.bulkCreateStaffAttendance = exports.updateAttendanceStatus = exports.deleteStaffAttendance = exports.updateStaffAttendance = exports.createStaffAttendance = exports.getStaffAttendanceById = exports.getAllStaffAttendance = void 0;
const StaffAttendance_1 = __importDefault(require("../../models/appointments/StaffAttendance"));
const getAllStaffAttendance = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenant, 10);
        const staffAttendance = new StaffAttendance_1.default();
        const filters = req.query;
        const attendanceRecords = await staffAttendance.getAll(tenantId, filters);
        res.status(200).json(attendanceRecords);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch attendance records", error: error.message });
    }
};
exports.getAllStaffAttendance = getAllStaffAttendance;
const getStaffAttendanceById = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenant, 10);
        const staffAttendance = new StaffAttendance_1.default();
        const id = parseInt(req.params.id.toString());
        const attendanceRecord = await staffAttendance.getById(tenantId, id);
        if (attendanceRecord) {
            res.status(200).json(attendanceRecord);
        }
        else {
            res.status(404).json({ message: "Attendance record not found" });
        }
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch attendance record", error: error.message });
    }
};
exports.getStaffAttendanceById = getStaffAttendanceById;
const createStaffAttendance = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenant, 10);
        const staffAttendance = new StaffAttendance_1.default();
        const attendanceData = req.body;
        const id = await staffAttendance.create(tenantId, attendanceData);
        res.status(201).json({ status: id > 0, message: id > 0 ? "Attendance record created successfully" : "Failed to create attendance record, this might happen if the records already exist" });
    }
    catch (error) {
        res.status(400).json({ message: "Failed to create attendance record", error: error.message });
    }
};
exports.createStaffAttendance = createStaffAttendance;
const updateStaffAttendance = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenant, 10);
        const staffAttendance = new StaffAttendance_1.default();
        const id = parseInt(req.params.id.toString());
        const attendanceData = req.body;
        await staffAttendance.update(tenantId, id, attendanceData);
        res.status(200).json({ message: "Attendance record updated successfully" });
    }
    catch (error) {
        res.status(400).json({ message: "Failed to update attendance record", error: error.message });
    }
};
exports.updateStaffAttendance = updateStaffAttendance;
const deleteStaffAttendance = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenant, 10);
        const staffAttendance = new StaffAttendance_1.default();
        const id = parseInt(req.params.id.toString());
        await staffAttendance.delete(tenantId, id);
        res.status(200).json({ message: "Attendance record deleted successfully" });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to delete attendance record", error: error.message });
    }
};
exports.deleteStaffAttendance = deleteStaffAttendance;
const updateAttendanceStatus = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenant, 10);
        const staffAttendance = new StaffAttendance_1.default();
        const id = parseInt(req.params.id.toString());
        const { status } = req.body;
        await staffAttendance.updateStatus(tenantId, id, status);
        res.status(200).json({ message: "Attendance status updated successfully" });
    }
    catch (error) {
        res.status(400).json({ message: "Failed to update attendance status", error: error.message });
    }
};
exports.updateAttendanceStatus = updateAttendanceStatus;
const bulkCreateStaffAttendance = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenant, 10);
        const staffAttendance = new StaffAttendance_1.default();
        const attendanceRecords = req.body;
        const ids = await staffAttendance.bulkCreate(tenantId, attendanceRecords);
        res.status(201).json({ ids, message: "Attendance records created successfully" });
    }
    catch (error) {
        res.status(400).json({ message: "Failed to create attendance records", error: error.message });
    }
};
exports.bulkCreateStaffAttendance = bulkCreateStaffAttendance;
const getAttendanceByCycle = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenant, 10);
        const staffAttendance = new StaffAttendance_1.default();
        const cycleid = parseInt(req.params.cycleid.toString());
        const attendanceRecords = await staffAttendance.getAttendanceByCycle(tenantId, cycleid);
        res.status(200).json(attendanceRecords);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch attendance records by cycle", error: error.message });
    }
};
exports.getAttendanceByCycle = getAttendanceByCycle;
const getAttendanceByEmployee = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenant, 10);
        const staffAttendance = new StaffAttendance_1.default();
        const employeeId = parseInt(req.params.employeeId.toString());
        const { startDate, endDate } = req.query;
        const attendanceRecords = await staffAttendance.getAttendanceByEmployee(tenantId, employeeId, startDate, endDate);
        res.status(200).json(attendanceRecords);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch attendance records by employee", error: error.message });
    }
};
exports.getAttendanceByEmployee = getAttendanceByEmployee;
const countAttendanceByStatus = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenant, 10);
        const staffAttendance = new StaffAttendance_1.default();
        const filters = req.query;
        const counts = await staffAttendance.countByStatus(tenantId, filters);
        res.status(200).json(counts);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to count attendance records by status", error: error.message });
    }
};
exports.countAttendanceByStatus = countAttendanceByStatus;
