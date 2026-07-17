"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayrollTransactionRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const zod_1 = require("zod");
// Zod validation schema
const payrollTransactionSchema = zod_1.z.object({
    payroll_period_id: zod_1.z.number().positive('Payroll period ID must be a positive number'),
    employeeid: zod_1.z.number().positive('Employee ID must be a positive number'),
    basic_salary: zod_1.z.number().min(0, 'Basic salary cannot be negative'),
    hourly_earnings: zod_1.z.number().min(0, 'Hourly earnings cannot be negative'),
    overtime_earnings: zod_1.z.number().min(0, 'Overtime earnings cannot be negative'),
    commission_earnings: zod_1.z.number().min(0, 'Commission earnings cannot be negative'),
    total_allowances: zod_1.z.number().min(0, 'Total allowances cannot be negative'),
    total_bonuses: zod_1.z.number().min(0, 'Total bonuses cannot be negative'),
    gross_salary: zod_1.z.number().min(0, 'Gross salary cannot be negative'),
    income_tax: zod_1.z.number().min(0, 'Income tax cannot be negative'),
    total_other_deductions: zod_1.z.number().min(0, 'Total other deductions cannot be negative'),
    total_deductions: zod_1.z.number().min(0, 'Total deductions cannot be negative'),
    net_salary: zod_1.z.number().min(0, 'Net salary cannot be negative'),
    employer_cost: zod_1.z.number().min(0, 'Employer cost cannot be negative'),
    days_worked: zod_1.z.number().min(0, 'Days worked cannot be negative').max(31, 'Days worked cannot exceed 31'),
    hours_worked: zod_1.z.number().min(0, 'Hours worked cannot be negative').max(744, 'Hours worked cannot exceed 744 (31 days)'),
    overtime_hours: zod_1.z.number().min(0, 'Overtime hours cannot be negative'),
    days_absent: zod_1.z.number().min(0, 'Days absent cannot be negative').max(31, 'Days absent cannot exceed 31'),
    days_leave: zod_1.z.number().min(0, 'Days leave cannot be negative').max(31, 'Days leave cannot exceed 31'),
    status: zod_1.z.enum(['pending', 'approved', 'paid', 'cancelled']),
    payment_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must be in YYYY-MM-DD format').optional(),
    payment_method: zod_1.z.enum(['bank_transfer', 'cash', 'cheque', 'mobile_money']).optional(),
    payment_reference: zod_1.z.string().max(100, 'Payment reference cannot exceed 100 characters').optional(),
    allowances_detail: zod_1.z.any().optional(),
    bonuses_detail: zod_1.z.any().optional(),
    other_deductions_detail: zod_1.z.any().optional()
}).refine((data) => {
    if (data.status === 'paid' && (!data.payment_date || !/^\d{4}-\d{2}-\d{2}$/.test(data.payment_date))) {
        return false;
    }
    return true;
}, {
    message: 'Payment date is required for paid transactions',
    path: ['payment_date']
});
class PayrollTransactionRepository {
    constructor(tenantId, trx) {
        this.tenantId = tenantId;
        this.trx = trx;
    }
    get connection() {
        return this.trx ? Promise.resolve(this.trx) : (0, KnexConnections_1.default)(this.tenantId);
    }
    parseJsonDetail(value, fallback = []) {
        if (value === null || value === undefined || value === '') {
            return fallback;
        }
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            }
            catch (_a) {
                return fallback;
            }
        }
        return value;
    }
    parseTransactionDetails(transaction) {
        const parsedAllowances = this.parseJsonDetail(transaction.allowances_detail);
        const normalizedAllowances = Array.isArray(parsedAllowances) ? parsedAllowances : [];
        const parsedOtherDeductions = this.parseJsonDetail(transaction.other_deductions_detail);
        const normalizedOtherDeductions = Array.isArray(parsedOtherDeductions) ? parsedOtherDeductions : [];
        const incomeTaxValue = Number(transaction.income_tax) || 0;
        const hasIncomeTaxItem = normalizedOtherDeductions.some((item) => item && (item.type === 'income_tax' || item.name === 'Income Tax'));
        if (!hasIncomeTaxItem && incomeTaxValue > 0) {
            normalizedOtherDeductions.unshift({
                type: 'income_tax',
                name: 'Income Tax',
                amount: incomeTaxValue,
                source: 'tax_configuration'
            });
        }
        return {
            id: transaction.id ? Number(transaction.id) : undefined,
            payroll_period_id: Number(transaction.payroll_period_id),
            employeeid: Number(transaction.employeeid),
            basic_salary: Number(transaction.basic_salary) || 0,
            hourly_earnings: Number(transaction.hourly_earnings) || 0,
            overtime_earnings: Number(transaction.overtime_earnings) || 0,
            commission_earnings: Number(transaction.commission_earnings) || 0,
            total_allowances: Number(transaction.total_allowances) || 0,
            total_bonuses: Number(transaction.total_bonuses) || 0,
            gross_salary: Number(transaction.gross_salary) || 0,
            income_tax: Number(transaction.income_tax) || 0,
            total_other_deductions: Number(transaction.total_other_deductions) || 0,
            total_deductions: Number(transaction.total_deductions) || 0,
            net_salary: Number(transaction.net_salary) || 0,
            employer_cost: Number(transaction.employer_cost) || 0,
            days_worked: Number(transaction.days_worked) || 0,
            hours_worked: Number(transaction.hours_worked) || 0,
            overtime_hours: Number(transaction.overtime_hours) || 0,
            days_absent: Number(transaction.days_absent) || 0,
            days_leave: Number(transaction.days_leave) || 0,
            employeename: transaction.username || '',
            employeerole: transaction.role || '',
            status: transaction.status,
            payment_date: transaction.payment_date ?
                (transaction.payment_date instanceof Date ?
                    transaction.payment_date.toISOString().split('T')[0] :
                    String(transaction.payment_date)) :
                undefined,
            payment_method: transaction.payment_method || undefined,
            payment_reference: transaction.payment_reference || undefined,
            allowances_detail: normalizedAllowances,
            bonuses_detail: this.parseJsonDetail(transaction.bonuses_detail),
            other_deductions_detail: normalizedOtherDeductions
        };
    }
    async create(transaction) {
        // Prepare transaction data with stringified details
        const transactionData = Object.assign(Object.assign({}, transaction), { allowances_detail: transaction.allowances_detail ? JSON.stringify(transaction.allowances_detail) : null, bonuses_detail: transaction.bonuses_detail ? JSON.stringify(transaction.bonuses_detail) : null, other_deductions_detail: transaction.other_deductions_detail ? JSON.stringify(transaction.other_deductions_detail) : null });
        // Validate transaction data
        payrollTransactionSchema.parse(transactionData);
        const connection = await this.connection;
        const [id] = await connection('payroll_transactions').insert(transactionData);
        return id;
    }
    async getById(id) {
        const connection = await this.connection;
        const transaction = await connection('payroll_transactions').where({ id }).first();
        return transaction ? this.parseTransactionDetails(transaction) : undefined;
    }
    async getByPayrollPeriod(payroll_period_id) {
        const connection = await this.connection;
        const transactions = await connection('payroll_transactions')
            .where({ payroll_period_id })
            .orderBy('employeeid', 'asc');
        return transactions.map(t => this.parseTransactionDetails(t));
    }
    async getByEmployeeId(page = 1, pageSize = 10, employeeid) {
        var _a;
        const connection = await this.connection;
        const offset = (page - 1) * pageSize;
        const baseQuery = connection('payroll_transactions')
            .modify((qb) => {
            if (employeeid !== undefined && employeeid !== null && employeeid !== 'all') {
                qb.where('payroll_transactions.employeeid', employeeid);
            }
        });
        const rows = await baseQuery
            .clone()
            .leftJoin('roles', 'payroll_transactions.employeeid', 'roles.employeeid')
            .orderBy('payroll_transactions.created_at', 'desc')
            .limit(pageSize)
            .offset(offset);
        const countResult = await baseQuery
            .clone()
            .count({ total: '*' });
        const total = Number(((_a = countResult[0]) === null || _a === void 0 ? void 0 : _a.total) || 0);
        return {
            data: rows.map((t) => this.parseTransactionDetails(t)),
            total,
            page,
            pageSize
        };
    }
    async getByEmployeeAndPeriod(employeeid, payroll_period_id) {
        const connection = await this.connection;
        const transaction = await connection('payroll_transactions')
            .where({ employeeid, payroll_period_id })
            .first();
        return transaction ? this.parseTransactionDetails(transaction) : undefined;
    }
    async update(id, transaction) {
        // Get existing transaction for validation
        const existing = await this.getById(id);
        if (!existing) {
            throw new Error('Payroll transaction not found');
        }
        // Prepare update data with stringified details
        const updateData = Object.assign(Object.assign({}, transaction), { allowances_detail: transaction.allowances_detail !== undefined ? JSON.stringify(transaction.allowances_detail) : undefined, bonuses_detail: transaction.bonuses_detail !== undefined ? JSON.stringify(transaction.bonuses_detail) : undefined, other_deductions_detail: transaction.other_deductions_detail !== undefined ? JSON.stringify(transaction.other_deductions_detail) : undefined });
        // Merge updates with existing data and validate
        const updatedTransaction = Object.assign(Object.assign({}, existing), updateData);
        payrollTransactionSchema.parse(updatedTransaction);
        const connection = await this.connection;
        const affectedRows = await connection('payroll_transactions')
            .where({ id })
            .update(Object.assign(Object.assign({}, updateData), { updated_at: connection.fn.now() }));
        return affectedRows > 0;
    }
    async updateStatus(id, status) {
        const connection = await this.connection;
        const affectedRows = await connection('payroll_transactions')
            .where({ id })
            .update({ status, updated_at: connection.fn.now() });
        return affectedRows > 0;
    }
    async updateStatusByPayrollPeriod(payroll_period_id, status) {
        const connection = await this.connection;
        const updates = {
            status,
            updated_at: connection.fn.now()
        };
        if (status !== 'paid') {
            updates.payment_date = null;
            updates.payment_method = null;
            updates.payment_reference = null;
        }
        const affectedRows = await connection('payroll_transactions')
            .where({ payroll_period_id })
            .update(updates);
        return affectedRows >= 0;
    }
    async markAsApproved(id) {
        return this.updateStatus(id, 'approved');
    }
    async markAsPaid(id, payment_date, payment_method, payment_reference) {
        try {
            const connection = await this.connection;
            const affectedRows = await connection('payroll_transactions')
                .where({ id })
                .update({
                status: 'paid',
                payment_date,
                payment_method,
                payment_reference,
                updated_at: connection.fn.now()
            });
            return affectedRows > 0;
        }
        catch (err) {
            throw err;
        }
    }
    async markAsCancelled(id) {
        return this.updateStatus(id, 'cancelled');
    }
    async delete(id) {
        const connection = await this.connection;
        // Only allow deletion of pending transactions
        const transaction = await this.getById(id);
        if (!transaction || transaction.status !== 'pending') {
            return false;
        }
        const affectedRows = await connection('payroll_transactions')
            .where({ id })
            .delete();
        return affectedRows > 0;
    }
    async bulkCreate(transactions) {
        const connection = await this.connection;
        return connection('payroll_transactions').insert(transactions);
    }
    async getByStatus(status) {
        const connection = await this.connection;
        return connection('payroll_transactions')
            .where({ status })
            .orderBy('created_at', 'desc');
    }
    async getTotalsByPeriod(payroll_period_id) {
        const connection = await this.connection;
        const result = await connection('payroll_transactions')
            .where({ payroll_period_id })
            .select(connection.raw('COALESCE(SUM(gross_salary), 0) as total_gross'), connection.raw('COALESCE(SUM(total_deductions), 0) as total_deductions'), connection.raw('COALESCE(SUM(net_salary), 0) as total_net'), connection.raw('COUNT(*) as employee_count'))
            .first();
        return result || { total_gross: 0, total_deductions: 0, total_net: 0, employee_count: 0 };
    }
    async getEmployeeYTDTotals(employeeid, year) {
        const connection = await this.connection;
        const result = await connection('payroll_transactions as pt')
            .join('payroll_periods as pp', 'pt.payroll_period_id', 'pp.id')
            .where({ 'pt.employeeid': employeeid, 'pp.period_year': year })
            .where('pt.status', 'paid')
            .select(connection.raw('COALESCE(SUM(pt.gross_salary), 0) as ytd_gross'), connection.raw('COALESCE(SUM(pt.net_salary), 0) as ytd_net'), connection.raw('COALESCE(SUM(pt.income_tax), 0) as ytd_tax'), connection.raw('0 as ytd_ssnit'))
            .first();
        return result || { ytd_gross: 0, ytd_net: 0, ytd_tax: 0, ytd_ssnit: 0 };
    }
    async getPayrollSummaryByEmployee(employeeid, startDate, endDate) {
        const connection = await this.connection;
        const rows = await connection('payroll_transactions as pt')
            .join('payroll_periods as pp', 'pt.payroll_period_id', 'pp.id')
            .where({ 'pt.employeeid': employeeid })
            .whereBetween('pp.period_start_date', [startDate, endDate])
            .select('pt.*', 'pp.period_name', 'pp.payment_date as period_payment_date')
            .orderBy('pp.period_start_date', 'desc');
        return rows.map((row) => this.parseTransactionDetails(row));
    }
    async getPeriodTransactionsWithEmployeeDetails(payroll_period_id, count, page) {
        const connection = await this.connection;
        const total = await connection('payroll_transactions').count('id as count').where({ payroll_period_id });
        const totalPages = count ? Math.ceil(Number(total[0].count) / count) : 1;
        const query = connection('payroll_transactions as pt')
            .join('roles as r', 'pt.employeeid', 'r.employeeid')
            .leftJoin('branch as b', 'r.branch', 'b.branchid')
            .where({ 'pt.payroll_period_id': payroll_period_id })
            .select('pt.*', 'r.username as employee_name', 'r.role as employee_role', 'r.email', 'b.name as branch_name');
        if (count !== undefined && page !== undefined) {
            const offset = (page - 1) * count;
            query.limit(count).offset(offset);
        }
        query.orderBy('r.username', 'asc');
        const rows = await query;
        return {
            data: rows.map((row) => {
                const parsed = this.parseTransactionDetails(row);
                return Object.assign(Object.assign({}, parsed), { allowances: parsed.allowances_detail, employee_name: row.employee_name || '', employee_role: row.employee_role || '', email: row.email || '', branch_name: row.branch_name || '' });
            }),
            total: Number(total[0].count),
            totalPages
        };
    }
    async getTransactionsByDateRange(startDate, endDate) {
        const connection = await this.connection;
        const rows = await connection('payroll_transactions as pt')
            .join('payroll_periods as pp', 'pt.payroll_period_id', 'pp.id')
            .whereBetween('pp.period_start_date', [startDate, endDate])
            .select('pt.*')
            .orderBy('pp.period_start_date', 'desc');
        return rows.map((row) => this.parseTransactionDetails(row));
    }
    async getAllPayrollHistory(count, page, sortby) {
        const connection = await this.connection;
        const total = await connection('payroll_transactions').countDistinct('employeeid as count');
        const totalPages = count ? Math.ceil(Number(total[0].count) / count) : 1;
        const sortDirection = (sortby || 'ASC').toUpperCase() === 'DESC' ? 'desc' : 'asc';
        const query = connection('payroll_transactions as pt')
            .join('payroll_periods as pp', 'pt.payroll_period_id', 'pp.id')
            .join('roles as r', 'pt.employeeid', 'r.employeeid')
            .leftJoin('branch as b', 'r.branch', 'b.branchid')
            .select('r.employeeid', 'r.username as employee_name', 'r.role as employee_role', 'r.email', 'b.name as branch_name', connection.raw('MIN(pp.period_start_date) as first_payroll_date'), connection.raw('COUNT(pt.id) as total_payrolls'), connection.raw('COALESCE(SUM(pt.gross_salary), 0) as lifetime_gross'), connection.raw('COALESCE(SUM(pt.net_salary), 0) as lifetime_net'), connection.raw('COALESCE(SUM(pt.total_deductions), 0) as lifetime_deductions'), connection.raw('COALESCE(SUM(pt.income_tax), 0) as lifetime_tax'), connection.raw('0 as lifetime_ssnit'), connection.raw('0 as lifetime_employer_ssnit'), connection.raw('COALESCE(SUM(pt.total_allowances), 0) as lifetime_allowances'), connection.raw('COALESCE(SUM(pt.total_bonuses), 0) as lifetime_bonuses'), connection.raw('COALESCE(SUM(pt.employer_cost), 0) as lifetime_employer_cost'))
            .groupBy('r.employeeid', 'r.username', 'r.role', 'r.email', 'b.name')
            .orderBy('r.username', sortDirection);
        if (count !== undefined && page !== undefined) {
            const offset = (page - 1) * count;
            query.limit(count).offset(offset);
        }
        const data = await query;
        return {
            data,
            total: Number(total[0].count),
            totalPages
        };
    }
    async recalculateTransaction(id, updates) {
        const connection = await this.connection;
        return connection.transaction(async (trx) => {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const transaction = await trx('payroll_transactions').where({ id }).first();
            if (!transaction || transaction.status === 'locked') {
                return false;
            }
            // Recalculate gross salary
            const gross_salary = ((_a = updates.basic_salary) !== null && _a !== void 0 ? _a : transaction.basic_salary) +
                ((_b = updates.hourly_earnings) !== null && _b !== void 0 ? _b : transaction.hourly_earnings) +
                ((_c = updates.overtime_earnings) !== null && _c !== void 0 ? _c : transaction.overtime_earnings) +
                ((_d = updates.commission_earnings) !== null && _d !== void 0 ? _d : transaction.commission_earnings) +
                ((_e = updates.total_allowances) !== null && _e !== void 0 ? _e : transaction.total_allowances) +
                ((_f = updates.total_bonuses) !== null && _f !== void 0 ? _f : transaction.total_bonuses);
            // Recalculate total deductions
            const total_deductions = ((_g = updates.income_tax) !== null && _g !== void 0 ? _g : transaction.income_tax) +
                ((_h = updates.total_other_deductions) !== null && _h !== void 0 ? _h : transaction.total_other_deductions);
            // Recalculate net salary
            const net_salary = gross_salary - total_deductions;
            // Recalculate employer cost
            const employer_cost = gross_salary;
            // Prepare updated transaction data
            const updatedTransaction = Object.assign(Object.assign(Object.assign({}, transaction), updates), { gross_salary,
                total_deductions,
                net_salary,
                employer_cost });
            // Validate the complete updated transaction
            payrollTransactionSchema.parse(updatedTransaction);
            await trx('payroll_transactions')
                .where({ id })
                .update(Object.assign(Object.assign({}, updates), { gross_salary,
                total_deductions,
                net_salary,
                employer_cost, updated_at: trx.fn.now() }));
            return true;
        });
    }
}
exports.PayrollTransactionRepository = PayrollTransactionRepository;
