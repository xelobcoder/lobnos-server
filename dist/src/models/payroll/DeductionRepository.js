"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtherDeductionRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const zod_1 = require("zod");
const otherDeductionSchema = zod_1.z.object({
    employeeid: zod_1.z.number().positive('Employee ID must be a positive number'),
    deduction_definition_id: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.number().positive('Deduction definition ID must be a positive number').optional()),
    deduction_type: zod_1.z.string().min(1, 'Deduction type cannot be empty').max(100, 'Deduction type cannot exceed 100 characters'),
    deduction_name: zod_1.z.string().min(1, 'Deduction name cannot be empty').max(255, 'Deduction name cannot exceed 255 characters'),
    amount: zod_1.z.number().positive('Amount must be greater than zero'),
    is_recurring: zod_1.z.boolean(),
    frequency: zod_1.z.enum(['monthly', 'bi-weekly', 'weekly', 'one-time']),
    total_amount: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.number().positive().optional()),
    remaining_balance: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.number().min(0, 'Remaining balance cannot be negative').optional()),
    deduction_priority: zod_1.z.number().positive('Deduction priority must be greater than zero').int('Deduction priority must be a whole number'),
    start_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
    end_date: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional()),
    is_active: zod_1.z.boolean(),
    approved_by: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.number().positive('Approved by must be a positive number').optional()),
    approved_date: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Approved date must be in YYYY-MM-DD format').optional()),
    remarks: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.string().max(1000, 'Remarks cannot exceed 1000 characters').optional()),
    attachments: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.string().max(500, 'Attachments path cannot exceed 500 characters').optional())
}).refine((data) => {
    if (data.end_date && data.start_date) {
        const start = new Date(data.start_date);
        const end = new Date(data.end_date);
        return end > start;
    }
    return true;
}, {
    message: 'End date must be after start date',
    path: ['end_date']
}).refine((data) => {
    if (!data.is_recurring || data.frequency === 'one-time') {
        return data.total_amount !== undefined && data.total_amount > 0;
    }
    return true;
}, {
    message: 'Total amount must be greater than zero when not recurring or one-time',
    path: ['total_amount']
});
class OtherDeductionRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
    }
    get connection() {
        return (0, KnexConnections_1.default)(this.tenantId);
    }
    async create(deduction) {
        // Validate data using Zod schema
        otherDeductionSchema.parse(deduction);
        const connection = await this.connection;
        const [id] = await connection('payroll_employee_other_deductions').insert(deduction);
        return id;
    }
    async getById(id) {
        const connection = await this.connection;
        return connection('payroll_employee_other_deductions').where({ id }).first();
    }
    async getByEmployeeId(employeeid) {
        const connection = await this.connection;
        return connection('payroll_employee_other_deductions')
            .where({ employeeid })
            .orderBy('deduction_priority', 'asc');
    }
    async getActiveByEmployeeId(employeeid) {
        const connection = await this.connection;
        const today = new Date().toISOString().split('T')[0];
        return connection('payroll_employee_other_deductions')
            .where({ employeeid, is_active: true })
            .where('start_date', '<=', today)
            .where((builder) => {
            builder.whereNull('end_date').orWhere('end_date', '>=', today);
        })
            .orderBy('deduction_priority', 'asc');
    }
    async getRecurringByEmployeeId(employeeid) {
        const connection = await this.connection;
        const today = new Date().toISOString().split('T')[0];
        return connection('payroll_employee_other_deductions')
            .where({ employeeid, is_active: true, is_recurring: true })
            .where('start_date', '<=', today)
            .where((builder) => {
            builder.whereNull('end_date').orWhere('end_date', '>=', today);
        })
            .orderBy('deduction_priority', 'asc');
    }
    async update(id, deduction) {
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid deduction ID is required for update');
        }
        // Get existing record to validate complete data
        const existing = await this.getById(id);
        if (!existing) {
            throw new Error('Other deduction record not found');
        }
        // Merge with existing data for complete validation
        const completeDeduction = Object.assign(Object.assign({}, existing), deduction);
        // Validate complete data using Zod schema
        otherDeductionSchema.parse(completeDeduction);
        const connection = await this.connection;
        const affectedRows = await connection('payroll_employee_other_deductions')
            .where({ id })
            .update(Object.assign(Object.assign({}, deduction), { updated_at: connection.fn.now() }));
        return affectedRows > 0;
    }
    async deactivate(id) {
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid deduction ID is required');
        }
        const connection = await this.connection;
        const affectedRows = await connection('payroll_employee_other_deductions')
            .where({ id })
            .update({ is_active: false, updated_at: connection.fn.now() });
        return affectedRows > 0;
    }
    async updateRemainingBalance(id, payment_amount) {
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid deduction ID is required');
        }
        if (!payment_amount || typeof payment_amount !== 'number' || payment_amount <= 0) {
            throw new Error('Payment amount must be a positive number');
        }
        const connection = await this.connection;
        return connection.transaction(async (trx) => {
            const deduction = await trx('payroll_employee_other_deductions').where({ id }).first();
            if (!deduction)
                return false;
            const newBalance = (deduction.remaining_balance || 0) - payment_amount;
            const updateData = {
                remaining_balance: newBalance,
                updated_at: trx.fn.now()
            };
            // If balance is paid off, mark as inactive
            if (newBalance <= 0) {
                updateData.is_active = false;
                updateData.remaining_balance = 0;
            }
            await trx('payroll_employee_other_deductions')
                .where({ id })
                .update(updateData);
            return true;
        });
    }
    async getTotalDeductionsByEmployee(employeeid, frequency = 'monthly') {
        if (!employeeid || typeof employeeid !== 'number' || employeeid <= 0) {
            throw new Error('Valid employee ID is required');
        }
        const validFrequencies = ['monthly', 'bi-weekly', 'weekly', 'one-time'];
        if (!validFrequencies.includes(frequency)) {
            throw new Error('Invalid frequency. Must be one of: ' + validFrequencies.join(', '));
        }
        const connection = await this.connection;
        const today = new Date().toISOString().split('T')[0];
        const result = await connection('payroll_employee_other_deductions')
            .where({ employeeid, is_active: true, frequency })
            .where('start_date', '<=', today)
            .where((builder) => {
            builder.whereNull('end_date').orWhere('end_date', '>=', today);
        })
            .sum('amount as total')
            .first();
        return (result === null || result === void 0 ? void 0 : result.total) || 0;
    }
    async getByDeductionType(deduction_type) {
        const validTypes = ['loan', 'advance', 'garnishment', 'union_dues', 'insurance', 'cooperative', 'welfare', 'savings', 'disciplinary', 'other'];
        if (!deduction_type || typeof deduction_type !== 'string' || !validTypes.includes(deduction_type)) {
            throw new Error('Valid deduction type is required. Must be one of: ' + validTypes.join(', '));
        }
        const connection = await this.connection;
        return connection('payroll_employee_other_deductions')
            .where({ deduction_type, is_active: true });
    }
    async getAllActive() {
        const connection = await this.connection;
        const today = new Date().toISOString().split('T')[0];
        return connection('payroll_employee_other_deductions')
            .where({ is_active: true })
            .where('start_date', '<=', today)
            .where((builder) => {
            builder.whereNull('end_date').orWhere('end_date', '>=', today);
        })
            .orderBy(['employeeid', 'deduction_priority']);
    }
    async getAll(activeOnly = true) {
        const connection = await this.connection;
        const query = connection('payroll_employee_other_deductions')
            .orderBy('employeeid', 'asc')
            .orderBy('deduction_priority', 'asc');
        if (activeOnly) {
            query.where({ is_active: true });
        }
        return query;
    }
    async getPendingApprovals() {
        const connection = await this.connection;
        return connection('payroll_employee_other_deductions')
            .whereNull('approved_by')
            .orderBy('created_at', 'asc');
    }
    async approve(id, approved_by) {
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid deduction ID is required');
        }
        if (!approved_by || typeof approved_by !== 'number' || approved_by <= 0) {
            throw new Error('Valid approver ID is required');
        }
        const connection = await this.connection;
        const today = new Date().toISOString().split('T')[0];
        const affectedRows = await connection('payroll_employee_other_deductions')
            .where({ id })
            .update({
            approved_by,
            approved_date: today,
            updated_at: connection.fn.now()
        });
        return affectedRows > 0;
    }
}
exports.OtherDeductionRepository = OtherDeductionRepository;
