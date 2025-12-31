"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtherDeductionRepository = exports.StatutoryDeductionRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const zod_1 = require("zod");
// Zod validation schemas
const statutoryDeductionSchema = zod_1.z.object({
    employeeid: zod_1.z.number().positive('Employee ID must be a positive number'),
    ssnit_number: zod_1.z.string().nullable().optional(),
    ssnit_active: zod_1.z.boolean(),
    ssnit_employee_rate: zod_1.z.number().min(0, 'SSNIT employee rate cannot be negative').max(100, 'SSNIT employee rate cannot exceed 100%'),
    tier3_enrolled: zod_1.z.boolean(),
    tier3_scheme_name: zod_1.z.string().nullable().optional(),
    tier3_scheme_number: zod_1.z.string().nullable().optional(),
    tier3_employee_rate: zod_1.z.number().min(0, 'Tier 3 employee rate cannot be negative').max(100, 'Tier 3 employee rate cannot exceed 100%'),
    tier3_employer_rate: zod_1.z.number().min(0, 'Tier 3 employer rate cannot be negative').max(100, 'Tier 3 employer rate cannot exceed 100%'),
    tin_number: zod_1.z.string().nullable().optional(),
    tax_exempt: zod_1.z.boolean(),
    tax_exempt_reason: zod_1.z.string().nullable().optional(),
    dependents_count: zod_1.z.number().min(0, 'Dependents count cannot be negative').int('Dependents count must be a whole number'),
    nhis_number: zod_1.z.string().nullable().optional(),
    nhis_active: zod_1.z.boolean(),
    nhis_rate: zod_1.z.number().min(0, 'NHIS rate cannot be negative').max(100, 'NHIS rate cannot exceed 100%')
}).refine((data) => {
    if (data.ssnit_active && data.ssnit_number !== null && data.ssnit_number !== undefined && data.ssnit_number.trim() === '') {
        return false;
    }
    return true;
}, {
    message: 'SSNIT number cannot be empty when provided',
    path: ['ssnit_number']
}).refine((data) => {
    if (data.tier3_enrolled && data.tier3_scheme_name !== null && data.tier3_scheme_name !== undefined && data.tier3_scheme_name.trim() === '') {
        return false;
    }
    return true;
}, {
    message: 'Tier 3 scheme name cannot be empty when provided',
    path: ['tier3_scheme_name']
}).refine((data) => {
    if (data.tier3_enrolled && data.tier3_scheme_number !== null && data.tier3_scheme_number !== undefined && data.tier3_scheme_number.trim() === '') {
        return false;
    }
    return true;
}, {
    message: 'Tier 3 scheme number cannot be empty when provided',
    path: ['tier3_scheme_number']
}).refine((data) => {
    if (data.tax_exempt && data.tax_exempt_reason !== null && data.tax_exempt_reason !== undefined && data.tax_exempt_reason.trim() === '') {
        return false;
    }
    return true;
}, {
    message: 'Tax exempt reason cannot be empty when provided',
    path: ['tax_exempt_reason']
}).refine((data) => {
    if (data.nhis_active && data.nhis_number !== null && data.nhis_number !== undefined && data.nhis_number.trim() === '') {
        return false;
    }
    return true;
}, {
    message: 'NHIS number cannot be empty when provided',
    path: ['nhis_number']
});
const otherDeductionSchema = zod_1.z.object({
    employeeid: zod_1.z.number().positive('Employee ID must be a positive number'),
    deduction_type: zod_1.z.enum(['loan', 'advance', 'garnishment', 'union_dues', 'insurance', 'cooperative', 'welfare', 'savings', 'disciplinary', 'other']),
    deduction_name: zod_1.z.string().min(1, 'Deduction name cannot be empty').max(255, 'Deduction name cannot exceed 255 characters'),
    amount: zod_1.z.number().positive('Amount must be greater than zero'),
    is_recurring: zod_1.z.boolean(),
    frequency: zod_1.z.enum(['monthly', 'bi-weekly', 'weekly', 'one-time']),
    total_amount: zod_1.z.number().positive().optional(),
    remaining_balance: zod_1.z.number().min(0, 'Remaining balance cannot be negative').optional(),
    deduction_priority: zod_1.z.number().positive('Deduction priority must be greater than zero').int('Deduction priority must be a whole number'),
    start_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
    end_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional(),
    is_active: zod_1.z.boolean(),
    approved_by: zod_1.z.number().positive('Approved by must be a positive number').optional(),
    approved_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Approved date must be in YYYY-MM-DD format').optional(),
    remarks: zod_1.z.string().max(1000, 'Remarks cannot exceed 1000 characters').optional(),
    attachments: zod_1.z.string().max(500, 'Attachments path cannot exceed 500 characters').optional()
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
class StatutoryDeductionRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
    }
    get connection() {
        return (0, KnexConnections_1.default)(this.tenantId);
    }
    async create(deduction) {
        // Validate data using Zod schema
        statutoryDeductionSchema.parse(deduction);
        const connection = await this.connection;
        const [id] = await connection('payroll_employee_statutory_deductions').insert(deduction);
        return id;
    }
    async getById(id) {
        const connection = await this.connection;
        return connection('payroll_employee_statutory_deductions').where({ id }).first();
    }
    async getByEmployeeId(employeeid) {
        const connection = await this.connection;
        return connection('payroll_employee_statutory_deductions').where({ employeeid }).first();
    }
    async getBySSNITNumber(ssnit_number) {
        const connection = await this.connection;
        return connection('payroll_employee_statutory_deductions').where({ ssnit_number }).first();
    }
    async getByTINNumber(tin_number) {
        const connection = await this.connection;
        return connection('payroll_employee_statutory_deductions').where({ tin_number }).first();
    }
    async update(id, deduction) {
        if (!id || typeof id !== 'number' || id <= 0) {
            throw new Error('Valid deduction ID is required for update');
        }
        // Get existing record to validate complete data
        const existing = await this.getById(id);
        if (!existing) {
            throw new Error('Statutory deduction record not found');
        }
        // Merge with existing data for complete validation
        const completeDeduction = Object.assign(Object.assign({}, existing), deduction);
        // Validate complete data using Zod schema
        statutoryDeductionSchema.parse(completeDeduction);
        const connection = await this.connection;
        const affectedRows = await connection('payroll_employee_statutory_deductions')
            .where({ id })
            .update(Object.assign(Object.assign({}, deduction), { updated_at: connection.fn.now() }));
        return affectedRows > 0;
    }
    async updateByEmployeeId(employeeid, deduction) {
        if (!employeeid || typeof employeeid !== 'number' || employeeid <= 0) {
            throw new Error('Valid employee ID is required for update');
        }
        // Get existing record to validate complete data
        const existing = await this.getByEmployeeId(employeeid);
        if (!existing) {
            throw new Error('Statutory deduction record not found for employee');
        }
        // Merge with existing data for complete validation
        const completeDeduction = Object.assign(Object.assign({}, existing), deduction);
        // Validate complete data using Zod schema
        statutoryDeductionSchema.parse(completeDeduction);
        const connection = await this.connection;
        const affectedRows = await connection('payroll_employee_statutory_deductions')
            .where({ employeeid })
            .update(Object.assign(Object.assign({}, deduction), { updated_at: connection.fn.now() }));
        return affectedRows > 0;
    }
    async getAll() {
        const connection = await this.connection;
        return connection('payroll_employee_statutory_deductions').select('*');
    }
    async getSSNITEnrolled() {
        const connection = await this.connection;
        return connection('payroll_employee_statutory_deductions')
            .where({ ssnit_active: true })
            .whereNotNull('ssnit_number');
    }
    async getTier3Enrolled() {
        const connection = await this.connection;
        return connection('payroll_employee_statutory_deductions')
            .where({ tier3_enrolled: true });
    }
    async getTaxExempt() {
        const connection = await this.connection;
        return connection('payroll_employee_statutory_deductions')
            .where({ tax_exempt: true });
    }
    async createOrUpdate(deduction) {
        // Validate data using Zod schema
        statutoryDeductionSchema.parse(deduction);
        const connection = await this.connection;
        const existing = await this.getByEmployeeId(deduction.employeeid);
        if (existing) {
            await this.update(existing.id, deduction);
            return existing.id;
        }
        else {
            return this.create(deduction);
        }
    }
}
exports.StatutoryDeductionRepository = StatutoryDeductionRepository;
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
