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
    start_date: zod_1.z.preprocess((val) => {
        if (val instanceof Date)
            return val.toISOString().split('T')[0];
        return val;
    }, zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format')),
    end_date: zod_1.z.preprocess((val) => {
        if (val === null || val === undefined)
            return undefined;
        if (val instanceof Date)
            return val.toISOString().split('T')[0];
        return val;
    }, zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional()),
    is_active: zod_1.z.boolean(),
    approved_by: zod_1.z.preprocess((val) => val === null ? undefined : val, zod_1.z.number().positive('Approved by must be a positive number').optional()),
    approved_date: zod_1.z.preprocess((val) => {
        if (val === null || val === undefined)
            return undefined;
        if (val instanceof Date)
            return val.toISOString().split('T')[0];
        return val;
    }, zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Approved date must be in YYYY-MM-DD format').optional()),
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
    constructor(tenantId, trx) {
        this.tenantId = tenantId;
        this.trx = trx;
    }
    get connection() {
        return this.trx ? Promise.resolve(this.trx) : (0, KnexConnections_1.default)(this.tenantId);
    }
    async hasLedgerEntries(id) {
        const connection = await this.connection;
        const ledgerExists = await connection.schema.hasTable('payroll_employee_other_deduction_ledger');
        if (!ledgerExists)
            return false;
        const result = await connection('payroll_employee_other_deduction_ledger')
            .where({ deduction_id: id })
            .count({ count: '*' })
            .first();
        return Number((result === null || result === void 0 ? void 0 : result.count) || 0) > 0;
    }
    async getLedgerByDeductionId(id) {
        const connection = await this.connection;
        const ledgerExists = await connection.schema.hasTable('payroll_employee_other_deduction_ledger');
        if (!ledgerExists)
            return [];
        const rows = await connection('payroll_employee_other_deduction_ledger')
            .where({ deduction_id: id })
            .orderBy('created_at', 'asc');
        return rows.map((row) => ({
            id: row.id ? Number(row.id) : undefined,
            deduction_id: Number(row.deduction_id),
            payroll_period_id: row.payroll_period_id ? Number(row.payroll_period_id) : undefined,
            payroll_transaction_id: row.payroll_transaction_id ? Number(row.payroll_transaction_id) : undefined,
            employeeid: Number(row.employeeid),
            payment_amount: Number(row.payment_amount) || 0,
            balance_before: Number(row.balance_before) || 0,
            balance_after: Number(row.balance_after) || 0,
            entry_type: row.entry_type,
            notes: row.notes || undefined,
            created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at || undefined
        }));
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
    async getApplicableByEmployeeId(employeeid, periodStartDate, periodEndDate) {
        const connection = await this.connection;
        return connection('payroll_employee_other_deductions')
            .where({ employeeid, is_active: true })
            .where('start_date', '<=', periodEndDate)
            .where((builder) => {
            builder.whereNull('end_date').orWhere('end_date', '>=', periodStartDate);
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
        const hasLedgerEntries = await this.hasLedgerEntries(id);
        if (hasLedgerEntries) {
            const protectedFields = ['amount', 'total_amount', 'remaining_balance'];
            const hasProtectedChange = protectedFields.some((field) => deduction[field] !== undefined && deduction[field] !== existing[field]);
            if (hasProtectedChange) {
                throw new Error('This deduction already has repayment history. Balance-related fields cannot be edited directly. Use a ledger adjustment instead.');
            }
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
            var _a, _b, _c;
            const deduction = await trx('payroll_employee_other_deductions').where({ id }).first();
            if (!deduction)
                return false;
            const currentBalance = Number((_c = (_b = (_a = deduction.remaining_balance) !== null && _a !== void 0 ? _a : deduction.total_amount) !== null && _b !== void 0 ? _b : deduction.amount) !== null && _c !== void 0 ? _c : 0);
            const appliedAmount = Math.min(currentBalance, payment_amount);
            if (appliedAmount <= 0)
                return false;
            const newBalance = currentBalance - appliedAmount;
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
            const ledgerExists = await trx.schema.hasTable('payroll_employee_other_deduction_ledger');
            if (ledgerExists) {
                await trx('payroll_employee_other_deduction_ledger').insert({
                    deduction_id: id,
                    payroll_period_id: null,
                    payroll_transaction_id: null,
                    employeeid: Number(deduction.employeeid),
                    payment_amount: appliedAmount,
                    balance_before: currentBalance,
                    balance_after: newBalance,
                    entry_type: 'manual_adjustment',
                    notes: 'Manual balance update',
                    created_at: trx.fn.now(),
                    updated_at: trx.fn.now()
                });
            }
            return true;
        });
    }
    async applyLoanAdjustment(deductionId, input) {
        if (!deductionId || typeof deductionId !== 'number' || deductionId <= 0) {
            throw new Error('Valid deduction ID is required');
        }
        const adjustmentAmount = Number(input.adjustment_amount);
        if (!adjustmentAmount || adjustmentAmount <= 0) {
            throw new Error('adjustment_amount must be a positive number');
        }
        if (!['increase_balance', 'decrease_balance'].includes(input.adjustment_action)) {
            throw new Error('adjustment_action must be increase_balance or decrease_balance');
        }
        if (!input.adjusted_by || Number(input.adjusted_by) <= 0) {
            throw new Error('adjusted_by is required');
        }
        if (!input.reason || !String(input.reason).trim()) {
            throw new Error('reason is required');
        }
        const connection = await this.connection;
        return connection.transaction(async (trx) => {
            var _a, _b, _c;
            const deduction = await trx('payroll_employee_other_deductions')
                .where({ id: deductionId })
                .first();
            if (!deduction) {
                throw new Error('Other deduction record not found');
            }
            if (String(deduction.deduction_type || '').toLowerCase() !== 'loan') {
                throw new Error('Loan adjustments are only allowed for deductions of type loan');
            }
            const currentBalance = Number((_c = (_b = (_a = deduction.remaining_balance) !== null && _a !== void 0 ? _a : deduction.total_amount) !== null && _b !== void 0 ? _b : deduction.amount) !== null && _c !== void 0 ? _c : 0);
            const newBalance = input.adjustment_action === 'increase_balance'
                ? currentBalance + adjustmentAmount
                : currentBalance - adjustmentAmount;
            if (newBalance < 0) {
                throw new Error('Adjustment would make remaining balance negative');
            }
            await trx('payroll_employee_other_deductions')
                .where({ id: deductionId })
                .update({
                remaining_balance: newBalance,
                is_active: newBalance > 0,
                updated_at: trx.fn.now()
            });
            let ledgerEntryId;
            const ledgerExists = await trx.schema.hasTable('payroll_employee_other_deduction_ledger');
            if (ledgerExists) {
                const notes = `[${input.adjustment_action}] ${String(input.reason).trim()} (adjusted_by:${Number(input.adjusted_by)})`;
                const insertResult = await trx('payroll_employee_other_deduction_ledger').insert({
                    deduction_id: deductionId,
                    payroll_period_id: null,
                    payroll_transaction_id: null,
                    employeeid: Number(deduction.employeeid),
                    payment_amount: adjustmentAmount,
                    balance_before: currentBalance,
                    balance_after: newBalance,
                    entry_type: 'manual_adjustment',
                    notes,
                    created_at: trx.fn.now(),
                    updated_at: trx.fn.now()
                });
                ledgerEntryId = Array.isArray(insertResult) ? Number(insertResult[0]) : undefined;
            }
            return {
                old_balance: Math.round(currentBalance * 100) / 100,
                new_balance: Math.round(newBalance * 100) / 100,
                ledger_entry_id: ledgerEntryId
            };
        });
    }
    async applyPaymentToDeduction(deductionId, paymentAmount, payrollPeriodId, payrollTransactionId, notes) {
        if (!deductionId || typeof deductionId !== 'number' || deductionId <= 0) {
            throw new Error('Valid deduction ID is required');
        }
        if (!paymentAmount || typeof paymentAmount !== 'number' || paymentAmount <= 0) {
            throw new Error('Payment amount must be a positive number');
        }
        const connection = await this.connection;
        return connection.transaction(async (trx) => {
            var _a, _b, _c;
            const deduction = await trx('payroll_employee_other_deductions').where({ id: deductionId }).first();
            if (!deduction)
                return false;
            const currentBalance = Number((_c = (_b = (_a = deduction.remaining_balance) !== null && _a !== void 0 ? _a : deduction.total_amount) !== null && _b !== void 0 ? _b : deduction.amount) !== null && _c !== void 0 ? _c : 0);
            const appliedAmount = Math.min(currentBalance, paymentAmount);
            if (appliedAmount <= 0)
                return false;
            const newBalance = Math.max(0, currentBalance - appliedAmount);
            await trx('payroll_employee_other_deductions')
                .where({ id: deductionId })
                .update({
                remaining_balance: newBalance,
                is_active: newBalance > 0,
                updated_at: trx.fn.now()
            });
            const ledgerExists = await trx.schema.hasTable('payroll_employee_other_deduction_ledger');
            if (ledgerExists) {
                await trx('payroll_employee_other_deduction_ledger').insert({
                    deduction_id: deductionId,
                    payroll_period_id: payrollPeriodId,
                    payroll_transaction_id: payrollTransactionId,
                    employeeid: Number(deduction.employeeid),
                    payment_amount: appliedAmount,
                    balance_before: currentBalance,
                    balance_after: newBalance,
                    entry_type: 'payroll_payment',
                    notes: notes || null,
                    created_at: trx.fn.now(),
                    updated_at: trx.fn.now()
                });
            }
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
