"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaveRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const zod_1 = require("zod");
const editableLeaveFields = [
    'leave_type',
    'start_date',
    'end_date',
    'total_days',
    'applied_date',
    'affects_salary',
    'reason',
    'attachments'
];
// Zod validation schemas
const leaveSchema = zod_1.z.object({
    employeeid: zod_1.z.number().positive('Employee ID must be a positive number'),
    leave_type: zod_1.z.enum(['annual', 'sick', 'maternity', 'paternity', 'unpaid', 'study', 'compassionate']),
    start_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
    end_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
    total_days: zod_1.z.number().positive('Total days must be greater than zero'),
    status: zod_1.z.enum(['pending', 'approved', 'rejected', 'cancelled']),
    applied_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Applied date must be in YYYY-MM-DD format'),
    approved_by: zod_1.z.number().positive('Approved by must be a positive number').optional(),
    approved_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Approved date must be in YYYY-MM-DD format').optional(),
    affects_salary: zod_1.z.boolean(),
    reason: zod_1.z.string().max(1000, 'Reason cannot exceed 1000 characters').optional(),
    attachments: zod_1.z.string().max(500, 'Attachments path cannot exceed 500 characters').optional()
}).refine((data) => {
    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    return end >= start;
}, {
    message: 'End date must be after or equal to start date',
    path: ['end_date']
}).refine((data) => {
    if (['approved', 'rejected'].includes(data.status) && (!data.approved_by || data.approved_by <= 0)) {
        return false;
    }
    return true;
}, {
    message: 'Approved by is required for approved/rejected leave',
    path: ['approved_by']
}).refine((data) => {
    if (['approved', 'rejected'].includes(data.status) && (!data.approved_date || !/^\d{4}-\d{2}-\d{2}$/.test(data.approved_date))) {
        return false;
    }
    return true;
}, {
    message: 'Approved date is required for approved/rejected leave',
    path: ['approved_date']
});
const leaveBalanceSchema = zod_1.z.object({
    employeeid: zod_1.z.number().positive('Employee ID must be a positive number'),
    leave_year: zod_1.z.number().min(2000, 'Leave year must be 2000 or later').max(2100, 'Leave year cannot exceed 2100'),
    annual_leave_entitlement: zod_1.z.number().min(0, 'Annual leave entitlement cannot be negative'),
    sick_leave_entitlement: zod_1.z.number().min(0, 'Sick leave entitlement cannot be negative'),
    annual_leave_taken: zod_1.z.number().min(0, 'Annual leave taken cannot be negative'),
    annual_leave_balance: zod_1.z.number(),
    sick_leave_taken: zod_1.z.number().min(0, 'Sick leave taken cannot be negative'),
    sick_leave_balance: zod_1.z.number()
});
class LeaveRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
    }
    get connection() {
        return (0, KnexConnections_1.default)(this.tenantId);
    }
    // Leave CRUD Operations
    async createLeave(leave) {
        // Validate data using Zod schema
        leaveSchema.parse(leave);
        const connection = await this.connection;
        const [id] = await connection('payroll_employee_leave').insert(leave);
        return id;
    }
    async getLeaveById(id) {
        const connection = await this.connection;
        return connection('payroll_employee_leave').where({ id }).first();
    }
    async getLeavesByEmployeeId(employeeid) {
        const connection = await this.connection;
        return connection('payroll_employee_leave')
            .where({ employeeid })
            .orderBy('applied_date', 'desc');
    }
    async getLeavesByStatus(status) {
        const connection = await this.connection;
        return connection('payroll_employee_leave')
            .where({ status })
            .orderBy('applied_date', 'desc');
    }
    async getLeavesByDateRange(startDate, endDate) {
        const connection = await this.connection;
        return connection('payroll_employee_leave')
            .where((builder) => {
            builder
                .whereBetween('start_date', [startDate, endDate])
                .orWhereBetween('end_date', [startDate, endDate])
                .orWhere((qb) => {
                qb.where('start_date', '<=', startDate)
                    .where('end_date', '>=', endDate);
            });
        })
            .orderBy('start_date', 'asc');
    }
    async updateLeave(id, leave) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid leave ID is required for update');
        }
        // Get existing record to validate complete data
        const existing = await this.getLeaveById(id);
        if (!existing) {
            throw new Error('Leave record not found');
        }
        if (existing.status !== 'pending') {
            throw new Error('Only pending leave requests can be updated');
        }
        const sanitizedUpdate = Object.fromEntries(Object.entries(leave).filter(([key, value]) => {
            return editableLeaveFields.includes(key) && value !== undefined;
        }));
        const completeLeave = Object.assign(Object.assign(Object.assign({}, existing), sanitizedUpdate), { approved_by: (_b = ((_a = sanitizedUpdate.approved_by) !== null && _a !== void 0 ? _a : existing.approved_by)) !== null && _b !== void 0 ? _b : undefined, approved_date: (_d = ((_c = sanitizedUpdate.approved_date) !== null && _c !== void 0 ? _c : existing.approved_date)) !== null && _d !== void 0 ? _d : undefined, reason: (_f = ((_e = sanitizedUpdate.reason) !== null && _e !== void 0 ? _e : existing.reason)) !== null && _f !== void 0 ? _f : undefined, attachments: (_h = ((_g = sanitizedUpdate.attachments) !== null && _g !== void 0 ? _g : existing.attachments)) !== null && _h !== void 0 ? _h : undefined });
        // Validate complete data using Zod schema
        leaveSchema.parse(completeLeave);
        const connection = await this.connection;
        const affectedRows = await connection('payroll_employee_leave')
            .where({ id })
            .update(Object.assign(Object.assign({}, sanitizedUpdate), { updated_at: connection.fn.now() }));
        return affectedRows > 0;
    }
    async approveLeave(id, approved_by) {
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid leave ID is required');
        }
        if (!approved_by || typeof approved_by !== 'number' || approved_by <= 0) {
            throw new Error('Valid approver ID is required');
        }
        const connection = await this.connection;
        const today = new Date().toISOString().split('T')[0];
        return connection.transaction(async (trx) => {
            const leave = await trx('payroll_employee_leave').where({ id }).first();
            if (!leave)
                return false;
            // Update leave status
            await trx('payroll_employee_leave')
                .where({ id })
                .update({
                status: 'approved',
                approved_by,
                approved_date: today,
                updated_at: trx.fn.now()
            });
            // Update leave balance
            if (leave.leave_type === 'annual' || leave.leave_type === 'sick') {
                const balance = await this.getLeaveBalance(leave.employeeid, new Date().getFullYear(), trx);
                if (balance) {
                    if (leave.leave_type === 'annual') {
                        await trx('payroll_employee_leave_balance')
                            .where({ id: balance.id })
                            .update({
                            annual_leave_taken: balance.annual_leave_taken + leave.total_days,
                            annual_leave_balance: balance.annual_leave_balance - leave.total_days,
                            updated_at: trx.fn.now()
                        });
                    }
                    else if (leave.leave_type === 'sick') {
                        await trx('payroll_employee_leave_balance')
                            .where({ id: balance.id })
                            .update({
                            sick_leave_taken: balance.sick_leave_taken + leave.total_days,
                            sick_leave_balance: balance.sick_leave_balance - leave.total_days,
                            updated_at: trx.fn.now()
                        });
                    }
                }
            }
            return true;
        });
    }
    async rejectLeave(id, approved_by) {
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid leave ID is required');
        }
        if (!approved_by || typeof approved_by !== 'number' || approved_by <= 0) {
            throw new Error('Valid approver ID is required');
        }
        const connection = await this.connection;
        const today = new Date().toISOString().split('T')[0];
        const affectedRows = await connection('payroll_employee_leave')
            .where({ id })
            .update({
            status: 'rejected',
            approved_by,
            approved_date: today,
            updated_at: connection.fn.now()
        });
        return affectedRows > 0;
    }
    async cancelLeave(id) {
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid leave ID is required');
        }
        const connection = await this.connection;
        return connection.transaction(async (trx) => {
            const leave = await trx('payroll_employee_leave').where({ id }).first();
            if (!leave || leave.status !== 'approved')
                return false;
            // Update leave status
            await trx('payroll_employee_leave')
                .where({ id })
                .update({ status: 'cancelled', updated_at: trx.fn.now() });
            if (leave.leave_type === 'annual' || leave.leave_type === 'sick') {
                const balance = await this.getLeaveBalance(leave.employeeid, new Date().getFullYear(), trx);
                if (balance) {
                    if (leave.leave_type === 'annual') {
                        await trx('payroll_employee_leave_balance')
                            .where({ id: balance.id })
                            .update({
                            annual_leave_taken: balance.annual_leave_taken - leave.total_days,
                            annual_leave_balance: balance.annual_leave_balance + leave.total_days,
                            updated_at: trx.fn.now()
                        });
                    }
                    else if (leave.leave_type === 'sick') {
                        await trx('payroll_employee_leave_balance')
                            .where({ id: balance.id })
                            .update({
                            sick_leave_taken: balance.sick_leave_taken - leave.total_days,
                            sick_leave_balance: balance.sick_leave_balance + leave.total_days,
                            updated_at: trx.fn.now()
                        });
                    }
                }
            }
            return true;
        });
    }
    // Leave Balance Operations
    async getLeaveBalance(employeeid, leave_year, trx) {
        const connection = trx || await this.connection;
        return connection('payroll_employee_leave_balance')
            .where({ employeeid, leave_year })
            .first();
    }
    async createLeaveBalance(balance) {
        // Validate data using Zod schema
        leaveBalanceSchema.parse(balance);
        const connection = await this.connection;
        const [id] = await connection('payroll_employee_leave_balance').insert(balance);
        return id;
    }
    async updateLeaveBalance(id, balance) {
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid leave balance ID is required for update');
        }
        const connection = await this.connection;
        // Get existing record to validate complete data
        const existing = await connection('payroll_employee_leave_balance').where({ id }).first();
        if (!existing) {
            throw new Error('Leave balance record not found');
        }
        // Merge with existing data for complete validation
        const completeBalance = Object.assign(Object.assign({}, existing), balance);
        // Validate complete data using Zod schema
        leaveBalanceSchema.parse(completeBalance);
        const affectedRows = await connection('payroll_employee_leave_balance')
            .where({ id })
            .update(Object.assign(Object.assign({}, balance), { updated_at: connection.fn.now() }));
        return affectedRows > 0;
    }
    async initializeLeaveBalanceForYear(employeeid, year) {
        if (!employeeid || typeof employeeid !== 'number' || employeeid <= 0) {
            throw new Error('Valid employee ID is required');
        }
        if (!year || typeof year !== 'number' || year < 2000 || year > 2100) {
            throw new Error('Valid year is required (2000-2100)');
        }
        const connection = await this.connection;
        const existing = await this.getLeaveBalance(employeeid, year);
        if (existing) {
            return existing.id;
        }
        return this.createLeaveBalance({
            employeeid,
            leave_year: year,
            annual_leave_entitlement: 21,
            sick_leave_entitlement: 14,
            annual_leave_taken: 0,
            annual_leave_balance: 21,
            sick_leave_taken: 0,
            sick_leave_balance: 14
        });
    }
    async getEmployeesOnLeaveByDate(date) {
        const connection = await this.connection;
        return connection('payroll_employee_leave')
            .where({ status: 'approved' })
            .where('start_date', '<=', date)
            .where('end_date', '>=', date);
    }
    async getLeaveSummaryByEmployee(employeeid, year) {
        const connection = await this.connection;
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        const result = await connection('payroll_employee_leave')
            .where({ employeeid, status: 'approved' })
            .whereBetween('start_date', [startDate, endDate])
            .select(connection.raw("SUM(CASE WHEN leave_type = 'annual' THEN total_days ELSE 0 END) as total_annual_taken"), connection.raw("SUM(CASE WHEN leave_type = 'sick' THEN total_days ELSE 0 END) as total_sick_taken"), connection.raw("SUM(CASE WHEN leave_type = 'unpaid' THEN total_days ELSE 0 END) as total_unpaid_taken"), connection.raw("SUM(CASE WHEN leave_type NOT IN ('annual', 'sick', 'unpaid') THEN total_days ELSE 0 END) as total_other_taken"))
            .first();
        return result || { total_annual_taken: 0, total_sick_taken: 0, total_unpaid_taken: 0, total_other_taken: 0 };
    }
}
exports.LeaveRepository = LeaveRepository;
