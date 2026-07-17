"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BonusRepository = exports.AllowanceRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const zod_1 = require("zod");
// Zod validation schemas
const allowanceSchema = zod_1.z.object({
    employeeid: zod_1.z.number().positive('Employee ID must be a positive number'),
    allowance_type: zod_1.z.enum(['housing', 'transport', 'meal', 'medical', 'education', 'uniform', 'mobile', 'hazard', 'shift_allowance', 'professional_development']),
    amount: zod_1.z.number().positive('Amount must be greater than zero'),
    calculation_method: zod_1.z.enum(['fixed', 'percentage_of_basic', 'variable']),
    percentage: zod_1.z.number().min(0, 'Percentage cannot be negative').max(100, 'Percentage cannot exceed 100%').optional(),
    is_recurring: zod_1.z.boolean(),
    frequency: zod_1.z.enum(['monthly', 'quarterly', 'annually', 'one-time']),
    is_taxable: zod_1.z.boolean(),
    effective_from: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective from date must be in YYYY-MM-DD format'),
    effective_to: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective to date must be in YYYY-MM-DD format').optional(),
    is_active: zod_1.z.boolean(),
    approved_by: zod_1.z.number().positive('Approved by must be a positive number').optional()
}).refine((data) => {
    if (data.calculation_method === 'percentage_of_basic' && (data.percentage === undefined || data.percentage < 0 || data.percentage > 100)) {
        return false;
    }
    return true;
}, {
    message: 'Percentage is required for percentage-based calculation',
    path: ['percentage']
}).refine((data) => {
    if (data.effective_to && data.effective_from) {
        const from = new Date(data.effective_from);
        const to = new Date(data.effective_to);
        return to > from;
    }
    return true;
}, {
    message: 'Effective to date must be after effective from date',
    path: ['effective_to']
});
const bonusSchema = zod_1.z.object({
    employeeid: zod_1.z.number().positive('Employee ID must be a positive number'),
    bonus_type: zod_1.z.enum(['performance', 'annual', 'project', 'retention', 'holiday', 'spot']),
    amount: zod_1.z.number().positive('Amount must be greater than zero'),
    start_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').nonempty('Start date is required'),
    end_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').nonempty('End date is required'),
    is_taxable: zod_1.z.boolean(),
    tax_method: zod_1.z.enum(['aggregate', 'separate', 'bonus_rate']),
    status: zod_1.z.enum(['pending', 'approved', 'rejected', 'paid']),
    approved_by: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.number().positive('Approved by must be a positive number').optional()),
    approved_date: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Approved date must be in YYYY-MM-DD format').optional()),
    reason: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.string().max(500, 'Reason cannot exceed 500 characters').optional()),
    performance_rating: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.number().min(1, 'Performance rating must be at least 1').max(5, 'Performance rating cannot exceed 5').optional()),
    payment_date: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must be in YYYY-MM-DD format').optional()),
    bonus_period: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.string().max(50, 'Bonus period cannot exceed 50 characters').optional())
}).refine((data) => {
    if (['approved', 'rejected', 'paid'].includes(data.status) && (!data.approved_by || data.approved_by <= 0)) {
        return false;
    }
    return true;
}, {
    message: 'Approved by is required for approved/rejected/paid bonuses',
    path: ['approved_by']
}).refine((data) => {
    if (['approved', 'rejected', 'paid'].includes(data.status) && (!data.approved_date || !/^\d{4}-\d{2}-\d{2}$/.test(data.approved_date))) {
        return false;
    }
    return true;
}, {
    message: 'Approved date is required for approved/rejected/paid bonuses',
    path: ['approved_date']
});
const bonusUpdateSchema = zod_1.z.object({
    employeeid: zod_1.z.number().positive('Employee ID must be a positive number').optional(),
    bonus_type: zod_1.z.enum(['performance', 'annual', 'project', 'retention', 'holiday', 'spot']).optional(),
    amount: zod_1.z.number().positive('Amount must be greater than zero').optional(),
    start_date: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').optional()),
    end_date: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional()),
    is_taxable: zod_1.z.boolean().optional(),
    tax_method: zod_1.z.enum(['aggregate', 'separate', 'bonus_rate']).optional(),
    status: zod_1.z.enum(['pending', 'approved', 'rejected', 'paid']),
    approved_by: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.number().positive('Approved by must be a positive number').optional()),
    approved_date: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Approved date must be in YYYY-MM-DD format').optional()),
    reason: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.string().max(500, 'Reason cannot exceed 500 characters').optional()),
    performance_rating: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.number().min(1, 'Performance rating must be at least 1').max(5, 'Performance rating cannot exceed 5').optional()),
    payment_date: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must be in YYYY-MM-DD format').optional()),
    bonus_period: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.string().max(50, 'Bonus period cannot exceed 50 characters').optional())
}).refine((data) => {
    if (['approved', 'rejected', 'paid'].includes(data.status) && (!data.approved_by || data.approved_by <= 0)) {
        return false;
    }
    return true;
}, {
    message: 'Approved by is required for approved/rejected/paid bonuses',
    path: ['approved_by']
});
class AllowanceRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
    }
    get connection() {
        return (0, KnexConnections_1.default)(this.tenantId);
    }
    async create(allowance) {
        // Validate data using Zod schema
        allowanceSchema.parse(allowance);
        const connection = await this.connection;
        const [id] = await connection('payroll_employee_allowances').insert(allowance);
        return id;
    }
    async getById(id) {
        const connection = await this.connection;
        return connection('payroll_employee_allowances').where({ id }).first();
    }
    async getByEmployeeId(employeeid) {
        const connection = await this.connection;
        return connection('payroll_employee_allowances')
            .where({ employeeid })
            .orderBy('effective_from', 'desc');
    }
    async getActiveByEmployeeId(employeeid) {
        const connection = await this.connection;
        const today = new Date().toISOString().split('T')[0];
        return connection('payroll_employee_allowances')
            .where({ employeeid, is_active: true })
            .where('effective_from', '<=', today)
            .where((builder) => {
            builder.whereNull('effective_to').orWhere('effective_to', '>=', today);
        })
            .orderBy('allowance_type');
    }
    async getApplicableByEmployeeId(employeeid, periodStartDate, periodEndDate) {
        const connection = await this.connection;
        return connection('payroll_employee_allowances')
            .where({ employeeid, is_active: true })
            .where('effective_from', '<=', periodEndDate)
            .where((builder) => {
            builder.whereNull('effective_to').orWhere('effective_to', '>=', periodStartDate);
        })
            .orderBy('allowance_type');
    }
    async getRecurringByEmployeeId(employeeid) {
        const connection = await this.connection;
        const today = new Date().toISOString().split('T')[0];
        return connection('payroll_employee_allowances')
            .where({ employeeid, is_active: true, is_recurring: true })
            .where('effective_from', '<=', today)
            .where((builder) => {
            builder.whereNull('effective_to').orWhere('effective_to', '>=', today);
        });
    }
    async update(id, allowance) {
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid allowance ID is required for update');
        }
        // Get existing record to validate complete data
        const existing = await this.getById(id);
        if (!existing) {
            throw new Error('Allowance record not found');
        }
        // Merge with existing data for complete validation
        const completeAllowance = Object.assign(Object.assign({}, existing), allowance);
        // Validate complete data using Zod schema
        allowanceSchema.parse(completeAllowance);
        const connection = await this.connection;
        const affectedRows = await connection('payroll_employee_allowances')
            .where({ id })
            .update(Object.assign(Object.assign({}, allowance), { updated_at: connection.fn.now() }));
        return affectedRows > 0;
    }
    async deactivate(id) {
        const connection = await this.connection;
        const affectedRows = await connection('payroll_employee_allowances')
            .where({ id })
            .update({ is_active: false, updated_at: connection.fn.now() });
        return affectedRows > 0;
    }
    async getTotalAllowancesByEmployee(employeeid, frequency = 'monthly') {
        const connection = await this.connection;
        const today = new Date().toISOString().split('T')[0];
        const result = await connection('payroll_employee_allowances')
            .where({ employeeid, is_active: true, frequency })
            .where('effective_from', '<=', today)
            .where((builder) => {
            builder.whereNull('effective_to').orWhere('effective_to', '>=', today);
        })
            .sum('amount as total')
            .first();
        return (result === null || result === void 0 ? void 0 : result.total) || 0;
    }
    async getAllActive() {
        const connection = await this.connection;
        const today = new Date().toISOString().split('T')[0];
        return connection('payroll_employee_allowances')
            .where({ is_active: true })
            .where('effective_from', '<=', today)
            .where((builder) => {
            builder.whereNull('effective_to').orWhere('effective_to', '>=', today);
        });
    }
}
exports.AllowanceRepository = AllowanceRepository;
class BonusRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
    }
    get connection() {
        return (0, KnexConnections_1.default)(this.tenantId);
    }
    async create(bonus) {
        bonusSchema.parse(bonus);
        const connection = await this.connection;
        const [id] = await connection('payroll_employee_bonuses').insert(bonus);
        return id;
    }
    async getById(id) {
        const connection = await this.connection;
        return connection('payroll_employee_bonuses').where({ id }).first();
    }
    async getByEmployeeId(employeeid) {
        const connection = await this.connection;
        return connection('payroll_employee_bonuses')
            .where({ employeeid })
            .orderBy('created_at', 'desc');
    }
    async getByStatus(status) {
        const connection = await this.connection;
        return connection('payroll_employee_bonuses')
            .where({ status })
            .orderBy('created_at', 'desc');
    }
    async getPendingApprovals() {
        const connection = await this.connection;
        return connection('payroll_employee_bonuses')
            .where({ status: 'pending' })
            .orderBy('created_at', 'asc');
    }
    async update(id, bonus) {
        try {
            if (!id || typeof id !== 'number' || id <= 0) {
                throw new Error('Valid bonus ID is required for update');
            }
            const existing = await this.getById(id);
            if (!existing)
                throw new Error('Bonus record not found');
            const completeBonus = Object.assign(Object.assign({}, existing), bonus);
            bonusUpdateSchema.parse(completeBonus);
            const connection = await this.connection;
            const affectedRows = await connection('payroll_employee_bonuses')
                .where({ id })
                .update(Object.assign(Object.assign({}, bonus), { updated_at: connection.fn.now() }));
            return affectedRows > 0;
        }
        catch (err) {
            console.error('Error updating bonus:', err);
            throw err;
        }
    }
    async delete(id) {
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid bonus ID is required for delete');
        }
        const existing = await this.getById(id);
        if (!existing) {
            throw new Error('Bonus record not found');
        }
        if (existing.status === 'paid') {
            throw new Error('Paid bonuses cannot be deleted');
        }
        const connection = await this.connection;
        const affectedRows = await connection('payroll_employee_bonuses')
            .where({ id })
            .del();
        return affectedRows > 0;
    }
    async approve(id, approved_by) {
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid bonus ID is required');
        }
        if (!approved_by || typeof approved_by !== 'number' || approved_by <= 0) {
            throw new Error('Valid approver ID is required');
        }
        const connection = await this.connection;
        const today = new Date().toISOString().split('T')[0];
        const affectedRows = await connection('payroll_employee_bonuses')
            .where({ id })
            .update({
            status: 'approved',
            approved_by,
            approved_date: today,
            updated_at: connection.fn.now()
        });
        return affectedRows > 0;
    }
    async reject(id, approved_by) {
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid bonus ID is required');
        }
        if (!approved_by || typeof approved_by !== 'number' || approved_by <= 0) {
            throw new Error('Valid approver ID is required');
        }
        const connection = await this.connection;
        const today = new Date().toISOString().split('T')[0];
        const affectedRows = await connection('payroll_employee_bonuses')
            .where({ id })
            .update({
            status: 'rejected',
            approved_by,
            approved_date: today,
            updated_at: connection.fn.now()
        });
        return affectedRows > 0;
    }
    async markAsPaid(id, payment_date) {
        const connection = await this.connection;
        const affectedRows = await connection('payroll_employee_bonuses')
            .where({ id })
            .update({
            status: 'paid',
            payment_date,
            updated_at: connection.fn.now()
        });
        return affectedRows > 0;
    }
    async getApprovedForDateRange(employeeid, startDate, endDate) {
        const connection = await this.connection;
        return connection('payroll_employee_bonuses')
            .where({ employeeid, status: 'approved' })
            .whereNull('payment_date')
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
    async getTotalBonusesByEmployee(employeeid, startDate, endDate) {
        const connection = await this.connection;
        const result = await connection('payroll_employee_bonuses')
            .where({ employeeid, status: 'paid' })
            .whereBetween('payment_date', [startDate, endDate])
            .sum('amount as total')
            .first();
        return (result === null || result === void 0 ? void 0 : result.total) || 0;
    }
}
exports.BonusRepository = BonusRepository;
