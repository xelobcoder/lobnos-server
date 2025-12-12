"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayrollPeriodRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const zod_1 = require("zod");
// Zod validation schema
const payrollPeriodSchema = zod_1.z.object({
    period_name: zod_1.z.string().min(1, 'Period name cannot be empty').max(100, 'Period name cannot exceed 100 characters'),
    period_year: zod_1.z.number().min(2000, 'Period year must be 2000 or later').max(2100, 'Period year cannot exceed 2100'),
    period_month: zod_1.z.number().min(1, 'Period month must be between 1 and 12').max(12, 'Period month must be between 1 and 12'),
    period_start_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Period start date must be in YYYY-MM-DD format'),
    period_end_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Period end date must be in YYYY-MM-DD format'),
    payment_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must be in YYYY-MM-DD format'),
    attendance_start_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Attendance start date must be in YYYY-MM-DD format'),
    attendance_end_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Attendance end date must be in YYYY-MM-DD format'),
    status: zod_1.z.enum(['draft', 'calculated', 'approved', 'locked', 'paid']),
    total_gross_salary: zod_1.z.number().min(0, 'Total gross salary cannot be negative'),
    total_deductions: zod_1.z.number().min(0, 'Total deductions cannot be negative'),
    total_net_salary: zod_1.z.number().min(0, 'Total net salary cannot be negative'),
    employee_count: zod_1.z.number().min(0, 'Employee count cannot be negative').int('Employee count must be a whole number'),
    calculated_by: zod_1.z.number().positive('Calculated by must be a positive number').optional(),
    calculated_at: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Calculated at must be a valid datetime').optional(),
    approved_by: zod_1.z.number().positive('Approved by must be a positive number').optional(),
    approved_at: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Approved at must be a valid datetime').optional(),
    locked_by: zod_1.z.number().positive('Locked by must be a positive number').optional(),
    locked_at: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Locked at must be a valid datetime').optional()
}).refine((data) => {
    const start = new Date(data.period_start_date);
    const end = new Date(data.period_end_date);
    return end > start;
}, {
    message: 'Period end date must be after period start date',
    path: ['period_end_date']
}).refine((data) => {
    const start = new Date(data.attendance_start_date);
    const end = new Date(data.attendance_end_date);
    return end > start;
}, {
    message: 'Attendance end date must be after attendance start date',
    path: ['attendance_end_date']
}).refine((data) => {
    if (['calculated', 'approved', 'locked', 'paid'].includes(data.status) && (!data.calculated_by || data.calculated_by <= 0)) {
        return false;
    }
    return true;
}, {
    message: 'Calculated by is required for calculated/approved/locked/paid periods',
    path: ['calculated_by']
}).refine((data) => {
    if (['calculated', 'approved', 'locked', 'paid'].includes(data.status) && (!data.calculated_at || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(data.calculated_at))) {
        return false;
    }
    return true;
}, {
    message: 'Calculated at is required for calculated/approved/locked/paid periods',
    path: ['calculated_at']
}).refine((data) => {
    if (['approved', 'locked', 'paid'].includes(data.status) && (!data.approved_by || data.approved_by <= 0)) {
        return false;
    }
    return true;
}, {
    message: 'Approved by is required for approved/locked/paid periods',
    path: ['approved_by']
}).refine((data) => {
    if (['approved', 'locked', 'paid'].includes(data.status) && (!data.approved_at || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(data.approved_at))) {
        return false;
    }
    return true;
}, {
    message: 'Approved at is required for approved/locked/paid periods',
    path: ['approved_at']
}).refine((data) => {
    if (['locked', 'paid'].includes(data.status) && (!data.locked_by || data.locked_by <= 0)) {
        return false;
    }
    return true;
}, {
    message: 'Locked by is required for locked/paid periods',
    path: ['locked_by']
}).refine((data) => {
    if (['locked', 'paid'].includes(data.status) && (!data.locked_at || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(data.locked_at))) {
        return false;
    }
    return true;
}, {
    message: 'Locked at is required for locked/paid periods',
    path: ['locked_at']
});
class PayrollPeriodRepository {
    constructor(tenantId, trx) {
        this.tenantId = tenantId;
        this.trx = trx;
    }
    get connection() {
        return this.trx ? Promise.resolve(this.trx) : (0, KnexConnections_1.default)(this.tenantId);
    }
    async create(period) {
        // Validate data using Zod schema
        payrollPeriodSchema.parse(period);
        const connection = await this.connection;
        const [id] = await connection('payroll_periods').insert(period);
        return id;
    }
    async getById(id) {
        const connection = await this.connection;
        return connection('payroll_periods').where({ id }).first();
    }
    async getByYearAndMonth(year, month) {
        const connection = await this.connection;
        return connection('payroll_periods')
            .where({ period_year: year, period_month: month })
            .first();
    }
    async getByYear(year) {
        const connection = await this.connection;
        return connection('payroll_periods')
            .where({ period_year: year })
            .orderBy('period_month', 'asc');
    }
    async getByStatus(status) {
        const connection = await this.connection;
        return connection('payroll_periods')
            .where({ status })
            .orderBy([{ column: 'period_year', order: 'desc' }, { column: 'period_month', order: 'desc' }]);
    }
    async getAll() {
        const connection = await this.connection;
        return connection('payroll_periods')
            .orderBy([{ column: 'period_year', order: 'desc' }, { column: 'period_month', order: 'desc' }]);
    }
    async update(id, period) {
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid payroll period ID is required for update');
        }
        // Get existing record to validate complete data
        const existing = await this.getById(id);
        if (!existing) {
            throw new Error('Payroll period record not found');
        }
        // Merge with existing data for complete validation
        const completePeriod = Object.assign(Object.assign({}, existing), period);
        // Validate complete data using Zod schema
        payrollPeriodSchema.parse(completePeriod);
        const connection = await this.connection;
        const affectedRows = await connection('payroll_periods')
            .where({ id })
            .update(Object.assign(Object.assign({}, period), { updated_at: connection.fn.now() }));
        return affectedRows > 0;
    }
    async updateStatus(id, status) {
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid payroll period ID is required');
        }
        const validStatuses = ['draft', 'calculated', 'approved', 'locked', 'paid'];
        if (!status || typeof status !== 'string' || !validStatuses.includes(status)) {
            throw new Error('Valid status is required. Must be one of: ' + validStatuses.join(', '));
        }
        const connection = await this.connection;
        const affectedRows = await connection('payroll_periods')
            .where({ id })
            .update({ status, updated_at: connection.fn.now() });
        return affectedRows > 0;
    }
    async markAsCalculated(id, calculated_by) {
        const connection = await this.connection;
        const now = new Date().toISOString();
        const affectedRows = await connection('payroll_periods')
            .where({ id })
            .update({
            status: 'calculated',
            calculated_by,
            calculated_at: now,
            updated_at: connection.fn.now()
        });
        return affectedRows > 0;
    }
    async markAsApproved(id, approved_by) {
        const connection = await this.connection;
        const now = new Date().toISOString();
        const affectedRows = await connection('payroll_periods')
            .where({ id })
            .update({
            status: 'approved',
            approved_by,
            approved_at: now,
            updated_at: connection.fn.now()
        });
        return affectedRows > 0;
    }
    async markAsLocked(id, locked_by) {
        const connection = await this.connection;
        const now = new Date().toISOString();
        const affectedRows = await connection('payroll_periods')
            .where({ id })
            .update({
            status: 'locked',
            locked_by,
            locked_at: now,
            updated_at: connection.fn.now()
        });
        return affectedRows > 0;
    }
    async markAsPaid(id) {
        const connection = await this.connection;
        const affectedRows = await connection('payroll_periods')
            .where({ id })
            .update({
            status: 'paid',
            updated_at: connection.fn.now()
        });
        return affectedRows > 0;
    }
    async updateTotals(id, total_gross_salary, total_deductions, total_net_salary, employee_count) {
        const connection = await this.connection;
        const affectedRows = await connection('payroll_periods')
            .where({ id })
            .update({
            total_gross_salary,
            total_deductions,
            total_net_salary,
            employee_count,
            updated_at: connection.fn.now()
        });
        return affectedRows > 0;
    }
    async delete(id) {
        const connection = await this.connection;
        // Only allow deletion of draft periods
        const period = await this.getById(id);
        if (!period || period.status !== 'draft') {
            return false;
        }
        const affectedRows = await connection('payroll_periods')
            .where({ id })
            .delete();
        return affectedRows > 0;
    }
    async getCurrentPeriod() {
        const connection = await this.connection;
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        return this.getByYearAndMonth(currentYear, currentMonth);
    }
    async getLatestPeriod() {
        const connection = await this.connection;
        return connection('payroll_periods')
            .orderBy([{ column: 'period_year', order: 'desc' }, { column: 'period_month', order: 'desc' }])
            .first();
    }
    async createNextPeriod() {
        const connection = await this.connection;
        const latest = await this.getLatestPeriod();
        let year, month;
        if (!latest) {
            const now = new Date();
            year = now.getFullYear();
            month = now.getMonth() + 1;
        }
        else {
            year = latest.period_year;
            month = latest.period_month + 1;
            if (month > 12) {
                month = 1;
                year += 1;
            }
        }
        // Calculate dates
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Last day of month
        const paymentDate = new Date(year, month, 5); // 5th of next month
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        return this.create({
            period_name: `${monthNames[month - 1]} ${year}`,
            period_year: year,
            period_month: month,
            period_start_date: startDate.toISOString().split('T')[0],
            period_end_date: endDate.toISOString().split('T')[0],
            payment_date: paymentDate.toISOString().split('T')[0],
            attendance_start_date: startDate.toISOString().split('T')[0],
            attendance_end_date: endDate.toISOString().split('T')[0],
            status: 'draft',
            total_gross_salary: 0,
            total_deductions: 0,
            total_net_salary: 0,
            employee_count: 0
        });
    }
}
exports.PayrollPeriodRepository = PayrollPeriodRepository;
