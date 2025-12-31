"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkCreateAttendanceHandler = exports.approveOvertimeHandler = exports.getPendingOvertimeApprovalsHandler = exports.clockOutHandler = exports.clockInHandler = exports.getAttendanceSummaryHandler = exports.getAttendanceByDateRangeHandler = exports.updateAttendanceHandler = exports.getEmployeeAttendanceByDateRangeHandler = exports.getAttendanceByEmployeeAndDateHandler = exports.getAttendanceByIdHandler = exports.createAttendanceHandler = void 0;
const AttendanceRepository_1 = require("../../models/payroll/AttendanceRepository");
const helper_1 = require("../../hooks/helper");
/**
 * Create attendance record
 */
const createAttendanceHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const attendanceData = req.body;
        const repo = new AttendanceRepository_1.AttendanceRepository(tenantId);
        const id = await repo.create(attendanceData);
        res.json({
            status: 'success',
            statusCode: 201,
            message: 'Attendance record created successfully',
            result: { id }
        });
    }
    catch (error) {
        const errorMessage = error.message.toString();
        console.log('Create attendance error:', errorMessage);
        return (0, helper_1.customError)('Unable to create attendance record. Please check your input and try again.', 500, res);
    }
};
exports.createAttendanceHandler = createAttendanceHandler;
/**
 * Get attendance by ID
 */
const getAttendanceByIdHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const id = parseInt(req.params.id);
        if (!id) {
            return (0, helper_1.customError)(' Attendance ID are required', 400, res);
        }
        const repo = new AttendanceRepository_1.AttendanceRepository(tenantId);
        const attendance = await repo.getById(id);
        if (!attendance) {
            return (0, helper_1.customError)('Attendance record not found', 404, res);
        }
        res.json({
            status: 'success',
            statusCode: 200,
            result: attendance
        });
    }
    catch (error) {
        return (0, helper_1.customError)('Failed to retrieve attendance record', 500, res);
    }
};
exports.getAttendanceByIdHandler = getAttendanceByIdHandler;
/**
 * Get attendance by employee and date
 */
const getAttendanceByEmployeeAndDateHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const employeeid = parseInt(req.params.employeeid);
        const attendance_date = req.params.date;
        if (!tenantId || !employeeid || !attendance_date) {
            return (0, helper_1.customError)('Tenant ID, Employee ID, and Date are required', 400, res);
        }
        const repo = new AttendanceRepository_1.AttendanceRepository(tenantId);
        const attendance = await repo.getByEmployeeAndDate(employeeid, attendance_date);
        if (!attendance) {
            return (0, helper_1.customError)('Attendance record not found', 404, res);
        }
        res.json({
            status: 'success',
            statusCode: 200,
            result: attendance
        });
    }
    catch (error) {
        return (0, helper_1.customError)('Failed to retrieve attendance record', 500, res);
    }
};
exports.getAttendanceByEmployeeAndDateHandler = getAttendanceByEmployeeAndDateHandler;
/**
 * Get employee attendance by date range
 */
const getEmployeeAttendanceByDateRangeHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const employeeid = parseInt(req.params.employeeid);
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        if (!tenantId || !employeeid || !startDate || !endDate) {
            return (0, helper_1.customError)('Tenant ID, Employee ID, Start Date, and End Date are required', 400, res);
        }
        const repo = new AttendanceRepository_1.AttendanceRepository(tenantId);
        const attendance = await repo.getByEmployeeIdAndDateRange(employeeid, startDate, endDate);
        res.json({
            status: 'success',
            statusCode: 200,
            result: attendance
        });
    }
    catch (error) {
        return (0, helper_1.customError)('Failed to retrieve attendance records', 500, res);
    }
};
exports.getEmployeeAttendanceByDateRangeHandler = getEmployeeAttendanceByDateRangeHandler;
/**
 * Update attendance record
 */
const updateAttendanceHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const id = parseInt(req.params.id);
        const updateData = req.body;
        if (!tenantId || !id) {
            return (0, helper_1.customError)('Tenant ID and Attendance ID are required', 400, res);
        }
        const repo = new AttendanceRepository_1.AttendanceRepository(tenantId);
        const success = await repo.update(id, updateData);
        if (!success) {
            return (0, helper_1.customError)('Failed to update attendance record', 400, res);
        }
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Attendance record updated successfully'
        });
    }
    catch (error) {
        return (0, helper_1.customError)('Failed to update attendance record', 500, res);
    }
};
exports.updateAttendanceHandler = updateAttendanceHandler;
/**
 * Get attendance by date range
 */
const getAttendanceByDateRangeHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        if (!startDate || !endDate) {
            return (0, helper_1.customError)('Start Date and End Date are required', 400, res);
        }
        const repo = new AttendanceRepository_1.AttendanceRepository(tenantId);
        const attendance = await repo.getByDateRange(startDate, endDate);
        res.json({
            status: 'success',
            statusCode: 200,
            result: attendance
        });
    }
    catch (error) {
        return (0, helper_1.customError)('Failed to retrieve attendance records', 500, res);
    }
};
exports.getAttendanceByDateRangeHandler = getAttendanceByDateRangeHandler;
/**
 * Get attendance summary for employee
 */
const getAttendanceSummaryHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const employeeid = parseInt(req.params.employeeid);
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        if (!tenantId || !employeeid || !startDate || !endDate) {
            return (0, helper_1.customError)('Tenant ID, Employee ID, Start Date, and End Date are required', 400, res);
        }
        const repo = new AttendanceRepository_1.AttendanceRepository(tenantId);
        const summary = await repo.getAttendanceSummary(employeeid, startDate, endDate);
        res.json({
            status: 'success',
            statusCode: 200,
            result: summary
        });
    }
    catch (error) {
        return (0, helper_1.customError)('Failed to retrieve attendance summary', 500, res);
    }
};
exports.getAttendanceSummaryHandler = getAttendanceSummaryHandler;
/**
 * Clock in for employee
 */
const clockInHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const { employeeid, attendance_date, clock_in } = req.body;
        if (!tenantId || !employeeid || !attendance_date || !clock_in) {
            return (0, helper_1.customError)('Tenant ID, Employee ID, Attendance Date, and Clock In time are required', 400, res);
        }
        const repo = new AttendanceRepository_1.AttendanceRepository(tenantId);
        const id = await repo.clockIn(employeeid, attendance_date, clock_in);
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Clock in recorded successfully',
            result: { id }
        });
    }
    catch (error) {
        return (0, helper_1.customError)('Failed to record clock in', 500, res);
    }
};
exports.clockInHandler = clockInHandler;
/**
 * Clock out for employee
 */
const clockOutHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const { employeeid, attendance_date, clock_out, total_hours } = req.body;
        if (!tenantId || !employeeid || !attendance_date || !clock_out || total_hours === undefined) {
            return (0, helper_1.customError)('Tenant ID, Employee ID, Attendance Date, Clock Out time, and Total Hours are required', 400, res);
        }
        const repo = new AttendanceRepository_1.AttendanceRepository(tenantId);
        const success = await repo.clockOut(employeeid, attendance_date, clock_out, total_hours);
        if (!success) {
            return (0, helper_1.customError)('No attendance record found for clock out', 404, res);
        }
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Clock out recorded successfully'
        });
    }
    catch (error) {
        return (0, helper_1.customError)('Failed to record clock out', 500, res);
    }
};
exports.clockOutHandler = clockOutHandler;
/**
 * Get pending overtime approvals
 */
const getPendingOvertimeApprovalsHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        if (!tenantId) {
            return (0, helper_1.customError)('Tenant ID is required', 400, res);
        }
        const repo = new AttendanceRepository_1.AttendanceRepository(tenantId);
        const pendingApprovals = await repo.getPendingOvertimeApprovals();
        res.json({
            status: 'success',
            statusCode: 200,
            result: pendingApprovals
        });
    }
    catch (error) {
        return (0, helper_1.customError)('Failed to retrieve pending overtime approvals', 500, res);
    }
};
exports.getPendingOvertimeApprovalsHandler = getPendingOvertimeApprovalsHandler;
/**
 * Approve overtime
 */
const approveOvertimeHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const id = parseInt(req.params.id);
        const { approved_by } = req.body;
        if (!tenantId || !id || !approved_by) {
            return (0, helper_1.customError)('Tenant ID, Attendance ID, and Approved By are required', 400, res);
        }
        const repo = new AttendanceRepository_1.AttendanceRepository(tenantId);
        const success = await repo.approveOvertime(id, approved_by);
        if (!success) {
            return (0, helper_1.customError)('Failed to approve overtime', 400, res);
        }
        res.json({
            status: 'success',
            statusCode: 200,
            message: 'Overtime approved successfully'
        });
    }
    catch (error) {
        return (0, helper_1.customError)('Failed to approve overtime', 500, res);
    }
};
exports.approveOvertimeHandler = approveOvertimeHandler;
/**
 * Bulk create attendance records
 */
const bulkCreateAttendanceHandler = async (req, res) => {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const attendanceRecords = req.body.attendance_records;
        if (!Array.isArray(attendanceRecords)) {
            return (0, helper_1.customError)('Attendance Records array are required', 400, res);
        }
        const repo = new AttendanceRepository_1.AttendanceRepository(tenantId);
        const ids = await repo.bulkCreate(attendanceRecords);
        res.json({
            status: 'success',
            statusCode: 201,
            message: 'Attendance records created successfully',
            result: { ids, count: ids.length }
        });
    }
    catch (error) {
        console.log('Bulk create attendance error:', error);
        return (0, helper_1.customError)('Failed to create attendance records', 500, res);
    }
};
exports.bulkCreateAttendanceHandler = bulkCreateAttendanceHandler;
