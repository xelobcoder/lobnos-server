"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const zod_1 = require("zod");
// Zod validation schema
const attendanceSchema = zod_1.z.object({
    employeeid: zod_1.z.number().positive('Employee ID must be a positive number'),
    attendance_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Attendance date must be in YYYY-MM-DD format'),
    clock_in: zod_1.z.string().regex(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, 'Clock in time must be in HH:MM:SS format').optional(),
    clock_out: zod_1.z.string().regex(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, 'Clock out time must be in HH:MM:SS format').optional(),
    total_hours: zod_1.z.number().min(0, 'Total hours cannot be negative').max(24, 'Total hours cannot exceed 24').optional(),
    shift_type: zod_1.z.enum(['regular', 'night', 'weekend', 'holiday']),
    work_location: zod_1.z.enum(['on-site', 'remote', 'field']),
    status: zod_1.z.enum(['present', 'absent', 'half-day', 'late', 'early_departure']),
    late_minutes: zod_1.z.number().min(0, 'Late minutes cannot be negative').max(1440, 'Late minutes cannot exceed 24 hours'),
    overtime_hours: zod_1.z.number().min(0, 'Overtime hours cannot be negative').max(24, 'Overtime hours cannot exceed 24'),
    overtime_approved: zod_1.z.boolean(),
    overtime_approved_by: zod_1.z.number().positive('Overtime approver ID must be a positive number').optional(),
    remarks: zod_1.z.string().max(500, 'Remarks cannot exceed 500 characters').optional()
}).refine((data) => {
    if (data.clock_in && data.clock_out) {
        const inTime = new Date(`2000-01-01T${data.clock_in}`);
        const outTime = new Date(`2000-01-01T${data.clock_out}`);
        return outTime > inTime;
    }
    return true;
}, {
    message: 'Clock out time must be after clock in time',
    path: ['clock_out']
}).refine((data) => {
    if (data.overtime_approved && (!data.overtime_approved_by || data.overtime_approved_by <= 0)) {
        return false;
    }
    return true;
}, {
    message: 'Overtime approver is required when overtime is approved',
    path: ['overtime_approved_by']
});
class AttendanceRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
    }
    get connection() {
        return (0, KnexConnections_1.default)(this.tenantId);
    }
    async create(attendance) {
        // Validate data using Zod schema
        attendanceSchema.parse(attendance);
        const connection = await this.connection;
        const [id] = await connection('payroll_employee_attendance').insert(attendance);
        return id;
    }
    async getById(id) {
        const connection = await this.connection;
        return connection('payroll_employee_attendance').where({ id }).first();
    }
    async getByEmployeeAndDate(employeeid, attendance_date) {
        const connection = await this.connection;
        return connection('payroll_employee_attendance')
            .where({ employeeid, attendance_date })
            .first();
    }
    async getByEmployeeIdAndDateRange(employeeid, startDate, endDate) {
        const connection = await this.connection;
        return connection('payroll_employee_attendance')
            .where({ employeeid })
            .whereBetween('attendance_date', [startDate, endDate])
            .orderBy('attendance_date', 'asc');
    }
    async update(id, attendance) {
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid attendance ID is required for update');
        }
        // Get existing record to validate complete data
        const existing = await this.getById(id);
        if (!existing) {
            throw new Error('Attendance record not found');
        }
        // Merge with existing data for complete validation
        const completeAttendance = Object.assign(Object.assign({}, existing), attendance);
        // Validate complete data using Zod schema
        attendanceSchema.parse(completeAttendance);
        const connection = await this.connection;
        const affectedRows = await connection('payroll_employee_attendance')
            .where({ id })
            .update(Object.assign(Object.assign({}, attendance), { updated_at: connection.fn.now() }));
        return affectedRows > 0;
    }
    async getByDateRange(startDate, endDate) {
        if (!startDate || typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
            throw new Error('Valid start date is required in YYYY-MM-DD format');
        }
        if (!endDate || typeof endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
            throw new Error('Valid end date is required in YYYY-MM-DD format');
        }
        if (new Date(startDate) > new Date(endDate)) {
            throw new Error('Start date cannot be after end date');
        }
        const connection = await this.connection;
        return connection('payroll_employee_attendance')
            .whereBetween('attendance_date', [startDate, endDate])
            .orderBy('attendance_date', 'asc');
    }
    async getAttendanceSummary(employeeid, startDate, endDate) {
        if (!employeeid || typeof employeeid !== 'number' || employeeid <= 0) {
            throw new Error('Valid employee ID is required');
        }
        if (!startDate || typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
            throw new Error('Valid start date is required in YYYY-MM-DD format');
        }
        if (!endDate || typeof endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
            throw new Error('Valid end date is required in YYYY-MM-DD format');
        }
        if (new Date(startDate) > new Date(endDate)) {
            throw new Error('Start date cannot be after end date');
        }
        const connection = await this.connection;
        const result = await connection('payroll_employee_attendance')
            .where({ employeeid })
            .whereBetween('attendance_date', [startDate, endDate])
            .select(connection.raw('COUNT(*) as total_days'), connection.raw("SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days"), connection.raw("SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days"), connection.raw("SUM(CASE WHEN status = 'half-day' THEN 1 ELSE 0 END) as half_days"), connection.raw("SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days"), connection.raw('COALESCE(SUM(total_hours), 0) as total_hours'), connection.raw('COALESCE(SUM(overtime_hours), 0) as overtime_hours'))
            .first();
        return {
            total_days: Number((result === null || result === void 0 ? void 0 : result.total_days) || 0),
            present_days: Number((result === null || result === void 0 ? void 0 : result.present_days) || 0),
            absent_days: Number((result === null || result === void 0 ? void 0 : result.absent_days) || 0),
            half_days: Number((result === null || result === void 0 ? void 0 : result.half_days) || 0),
            late_days: Number((result === null || result === void 0 ? void 0 : result.late_days) || 0),
            total_hours: Number((result === null || result === void 0 ? void 0 : result.total_hours) || 0),
            overtime_hours: Number((result === null || result === void 0 ? void 0 : result.overtime_hours) || 0)
        };
    }
    async clockIn(employeeid, attendance_date, clock_in) {
        if (!employeeid || typeof employeeid !== 'number' || employeeid <= 0) {
            throw new Error('Valid employee ID is required');
        }
        if (!attendance_date || typeof attendance_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(attendance_date)) {
            throw new Error('Valid attendance date is required in YYYY-MM-DD format');
        }
        if (!clock_in || typeof clock_in !== 'string' || !/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/.test(clock_in)) {
            throw new Error('Valid clock in time is required in HH:MM:SS format');
        }
        const connection = await this.connection;
        const existing = await this.getByEmployeeAndDate(employeeid, attendance_date);
        if (existing) {
            await this.update(existing.id, { clock_in });
            return existing.id;
        }
        else {
            return this.create({
                employeeid,
                attendance_date,
                clock_in,
                shift_type: 'regular',
                work_location: 'on-site',
                status: 'present',
                late_minutes: 0,
                overtime_hours: 0,
                overtime_approved: false
            });
        }
    }
    async clockOut(employeeid, attendance_date, clock_out, total_hours) {
        if (!employeeid || typeof employeeid !== 'number' || employeeid <= 0) {
            throw new Error('Valid employee ID is required');
        }
        if (!attendance_date || typeof attendance_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(attendance_date)) {
            throw new Error('Valid attendance date is required in YYYY-MM-DD format');
        }
        if (!clock_out || typeof clock_out !== 'string' || !/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/.test(clock_out)) {
            throw new Error('Valid clock out time is required in HH:MM:SS format');
        }
        if (!total_hours || typeof total_hours !== 'number' || total_hours < 0 || total_hours > 24) {
            throw new Error('Total hours must be a number between 0 and 24');
        }
        const connection = await this.connection;
        const affectedRows = await connection('payroll_employee_attendance')
            .where({ employeeid, attendance_date })
            .update({ clock_out, total_hours, updated_at: connection.fn.now() });
        return affectedRows > 0;
    }
    async getPendingOvertimeApprovals() {
        const connection = await this.connection;
        return connection('payroll_employee_attendance')
            .where({ overtime_approved: false })
            .where('overtime_hours', '>', 0)
            .orderBy('attendance_date', 'desc');
    }
    async approveOvertime(id, approved_by) {
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid attendance ID is required');
        }
        if (!approved_by || typeof approved_by !== 'number' || approved_by <= 0) {
            throw new Error('Valid approver ID is required');
        }
        const connection = await this.connection;
        const affectedRows = await connection('payroll_employee_attendance')
            .where({ id })
            .update({
            overtime_approved: true,
            overtime_approved_by: approved_by,
            updated_at: connection.fn.now()
        });
        return affectedRows > 0;
    }
    async bulkCreate(attendanceRecords) {
        if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
            throw new Error('Attendance records array is required and cannot be empty');
        }
        // Validate each record
        for (const record of attendanceRecords) {
            attendanceSchema.parse(record);
        }
        const connection = await this.connection;
        return connection('payroll_employee_attendance').insert(attendanceRecords);
    }
}
exports.AttendanceRepository = AttendanceRepository;
