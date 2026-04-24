"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayrollProcessingService = void 0;
const PayrollPeriodRepository_1 = require("../../models/payroll/PayrollPeriodRepository");
const PayrollTransactionRepository_1 = require("../../models/payroll/PayrollTransactionRepository");
const PayrollCalculationService_1 = require("./PayrollCalculationService");
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const ExpenseInvoiceRepo_1 = __importDefault(require("../../models/Expenses/ExpenseInvoiceRepo"));
const ExpenseService_1 = __importDefault(require("../../models/Expenses/ExpenseService"));
class PayrollProcessingService {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.periodRepo = new PayrollPeriodRepository_1.PayrollPeriodRepository(tenantId);
        this.transactionRepo = new PayrollTransactionRepository_1.PayrollTransactionRepository(tenantId);
        this.calculationService = new PayrollCalculationService_1.PayrollCalculationService(tenantId);
    }
    /**
     * Format date strings to YYYY-MM-DD format for calculation service
     */
    formatDateForCalculation(dateInput) {
        if (!dateInput)
            return '';
        let dateString;
        if (dateInput instanceof Date) {
            dateString = dateInput.toISOString().split('T')[0];
        }
        else if (typeof dateInput === 'string') {
            dateString = dateInput;
        }
        else {
            dateString = String(dateInput);
        }
        // If it has 'T', it's ISO format
        if (dateString.includes('T')) {
            return dateString.split('T')[0];
        }
        return dateString;
    }
    /**
     * Process payroll for a given period
     */
    async processPayrollPeriod(payroll_period_id, employeeIds, calculated_by) {
        const period = await this.periodRepo.getById(payroll_period_id);
        if (!period) {
            throw new Error(`Payroll period ${payroll_period_id} not found`);
        }
        if (period.status !== 'draft') {
            throw new Error(`Cannot process payroll period with status ${period.status}`);
        }
        const errors = [];
        const successfulTransactions = [];
        // Calculate payroll for each employee
        const calculationInputs = employeeIds.map(employeeid => ({
            employeeid,
            payroll_period_id,
            period_start_date: this.formatDateForCalculation(period.period_start_date),
            period_end_date: this.formatDateForCalculation(period.period_end_date)
        }));
        // Use database transaction for atomicity
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.transaction(async (trx) => {
            // Create transaction-scoped repositories
            const trxPeriodRepo = new PayrollPeriodRepository_1.PayrollPeriodRepository(this.tenantId, trx);
            const trxTransactionRepo = new PayrollTransactionRepository_1.PayrollTransactionRepository(this.tenantId, trx);
            for (const input of calculationInputs) {
                try {
                    const calculation = await this.calculationService.calculateEmployeePayroll(input);
                    // Check if transaction already exists
                    const existing = await trxTransactionRepo.getByEmployeeAndPeriod(input.employeeid, payroll_period_id);
                    if (existing) {
                        // Update existing transaction
                        await trxTransactionRepo.update(existing.id, Object.assign(Object.assign({}, calculation), { status: 'pending' }));
                    }
                    else {
                        // Create new transaction
                        await trxTransactionRepo.create(Object.assign(Object.assign({}, calculation), { status: 'pending' }));
                    }
                    successfulTransactions.push(calculation);
                }
                catch (error) {
                    errors.push({
                        employeeid: input.employeeid,
                        error: error.message || 'Unknown error'
                    });
                }
            }
            // Calculate totals
            const totals = {
                total_gross_salary: successfulTransactions.reduce((sum, t) => sum + t.gross_salary, 0),
                total_deductions: successfulTransactions.reduce((sum, t) => sum + t.total_deductions, 0),
                total_net_salary: successfulTransactions.reduce((sum, t) => sum + t.net_salary, 0),
                employee_count: successfulTransactions.length
            };
            // Update period totals (always update for visibility)
            await trxPeriodRepo.updateTotals(payroll_period_id, totals.total_gross_salary, totals.total_deductions, totals.total_net_salary, totals.employee_count);
            // Only mark as calculated if no errors occurred
            if (errors.length === 0) {
                await trxPeriodRepo.markAsCalculated(payroll_period_id, calculated_by);
            }
            else {
                // Keep period in 'draft' status when there are errors
                console.warn(`Payroll period ${payroll_period_id} has ${errors.length} errors - keeping in draft status`);
            }
            return {
                payroll_period_id,
                total_employees_processed: successfulTransactions.length,
                total_gross_salary: totals.total_gross_salary,
                total_deductions: totals.total_deductions,
                total_net_salary: totals.total_net_salary,
                period_status: errors.length === 0 ? 'calculated' : 'draft',
                errors
            };
        });
    }
    /**
     * Approve payroll period
     */
    async approvePayrollPeriod(payroll_period_id, approved_by) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.transaction(async (trx) => {
            const trxPeriodRepo = new PayrollPeriodRepository_1.PayrollPeriodRepository(this.tenantId, trx);
            const trxTransactionRepo = new PayrollTransactionRepository_1.PayrollTransactionRepository(this.tenantId, trx);
            const period = await trxPeriodRepo.getById(payroll_period_id);
            if (!period) {
                throw new Error(`Payroll period ${payroll_period_id} not found`);
            }
            if (period.status !== 'calculated') {
                throw new Error(`Cannot approve payroll period with status ${period.status}`);
            }
            // Mark period as approved
            await trxPeriodRepo.markAsApproved(payroll_period_id, approved_by);
            // Mark all transactions as approved
            const transactions = await trxTransactionRepo.getByPayrollPeriod(payroll_period_id);
            for (const transaction of transactions) {
                if (transaction.status === 'pending') {
                    await trxTransactionRepo.markAsApproved(transaction.id);
                }
            }
            return true;
        });
    }
    /**
     * Lock payroll period (prevent further changes)
     */
    async lockPayrollPeriod(payroll_period_id, locked_by) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.transaction(async (trx) => {
            const trxPeriodRepo = new PayrollPeriodRepository_1.PayrollPeriodRepository(this.tenantId, trx);
            const period = await trxPeriodRepo.getById(payroll_period_id);
            if (!period) {
                throw new Error(`Payroll period ${payroll_period_id} not found`);
            }
            if (period.status !== 'approved') {
                throw new Error(`Cannot lock payroll period with status ${period.status}`);
            }
            return trxPeriodRepo.markAsLocked(payroll_period_id, locked_by);
        });
    }
    /**
     * Mark payroll as paid
     */
    async markPayrollAsPaid(payroll_period_id, payment_date, payment_method, employeeid, branchid, payment_references) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.transaction(async (trx) => {
            const trxPeriodRepo = new PayrollPeriodRepository_1.PayrollPeriodRepository(this.tenantId, trx);
            const trxTransactionRepo = new PayrollTransactionRepository_1.PayrollTransactionRepository(this.tenantId, trx);
            const period = await trxPeriodRepo.getById(payroll_period_id);
            if (!period) {
                throw new Error(`Payroll period ${payroll_period_id} not found`);
            }
            if (period.status !== 'locked') {
                throw new Error(`Cannot mark payroll as paid with status ${period.status}`);
            }
            // Mark all transactions as paid
            const transactions = await trxTransactionRepo.getByPayrollPeriod(payroll_period_id);
            for (const transaction of transactions) {
                const reference = (payment_references === null || payment_references === void 0 ? void 0 : payment_references.get(transaction.employeeid)) || undefined;
                await trxTransactionRepo.markAsPaid(transaction.id, payment_date, payment_method, reference);
            }
            // Mark period as paid
            await trxPeriodRepo.markAsPaid(payroll_period_id);
            const actorEmployeeId = employeeid;
            const actorBranchId = branchid;
            const expenseCategoryRecord = await trx('dboexpensecategory')
                .where({ category: 'salary' })
                .first();
            let category;
            if (!expenseCategoryRecord) {
                const [newCategoryId] = await trx('dboexpensecategory')
                    .insert({
                    category: 'salary',
                    createdon: new Date(),
                    employeeid: actorEmployeeId,
                });
                category = newCategoryId;
            }
            else {
                category = expenseCategoryRecord.id;
            }
            const merchantRecord = await trx('expense_merchants')
                .where({ name: 'PAYROLL' })
                .first();
            let merchantid;
            if (!merchantRecord) {
                const [newMerchantId] = await trx('expense_merchants')
                    .insert({
                    name: 'PAYROLL',
                    email: 'system-payroll-automated',
                    phone: '0000000000',
                    notes: 'Auto created merchant for payroll payments',
                    created_at: new Date(),
                    created_by: actorEmployeeId,
                });
                merchantid = newMerchantId;
            }
            else {
                merchantid = merchantRecord.id;
            }
            const totalNetSalary = Number(period.total_net_salary || 0);
            const expenseRecord = {
                isassociatedservice: 0,
                serviceid: null,
                branchid: actorBranchId,
                category,
                employeeid: actorEmployeeId,
                amount: totalNetSalary,
                merchant: merchantid,
                date: new Date(payment_date),
                id: null,
                createdon: new Date(),
                approvedby: null,
                approved: 0,
                approvedon: null,
                name: `Payroll Expense - ${period.period_name} (${payroll_period_id})`,
                description: `Payroll for ${period.period_name} (${period.period_start_date} to ${period.period_end_date}) paid on ${payment_date}`
            };
            const invoiceRepo = new ExpenseInvoiceRepo_1.default(actorEmployeeId, actorBranchId, this.tenantId);
            const payrollExpense = await invoiceRepo.createExpensesAndInvoice([expenseRecord], {
                invoice_number: `PAYROLL-${payroll_period_id}-${Date.now()}`,
                invoice_date: new Date(payment_date),
                due_date: new Date(payment_date),
                merchant_id: merchantid,
                tax_amount: 0,
                total_amount: totalNetSalary,
                status: 'Paid'
            }, trx);
            const expenseApproval = await new ExpenseService_1.default(actorEmployeeId, actorBranchId, this.tenantId)
                .updateExpenseDecision(this.tenantId, 'approved', [{
                    expenseid: payrollExpense.expenseIds[0],
                    information: 'Payroll payment',
                    employeeid: actorEmployeeId
                }], trx);
            if (!expenseApproval) {
                throw new Error('Failed to approve payroll expense');
            }
            const paymentResult = await invoiceRepo.addPayment({
                expense_id: payrollExpense.expenseIds[0],
                invoice_id: payrollExpense.invoiceId,
                payment_date,
                method: payment_method,
                amount: totalNetSalary
            }, trx);
            await trx('payroll_periods')
                .where({ id: payroll_period_id })
                .update({
                expense_synced: true,
                expense_id: payrollExpense.expenseIds[0],
                expense_invoice_id: payrollExpense.invoiceId,
                expense_payment_id: (paymentResult === null || paymentResult === void 0 ? void 0 : paymentResult.paymentId) || null,
                updated_at: trx.fn.now()
            });
            return true;
        });
    }
    /**
     * Recalculate specific employee in payroll period
     */
    async recalculateEmployee(payroll_period_id, employeeid) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.transaction(async (trx) => {
            const trxPeriodRepo = new PayrollPeriodRepository_1.PayrollPeriodRepository(this.tenantId, trx);
            const trxTransactionRepo = new PayrollTransactionRepository_1.PayrollTransactionRepository(this.tenantId, trx);
            const period = await trxPeriodRepo.getById(payroll_period_id);
            if (!period) {
                throw new Error(`Payroll period ${payroll_period_id} not found`);
            }
            if (period.status === 'locked' || period.status === 'paid') {
                throw new Error(`Cannot recalculate payroll in ${period.status} status`);
            }
            const calculation = await this.calculationService.calculateEmployeePayroll({
                employeeid,
                payroll_period_id,
                period_start_date: this.formatDateForCalculation(period.period_start_date),
                period_end_date: this.formatDateForCalculation(period.period_end_date)
            });
            const existing = await trxTransactionRepo.getByEmployeeAndPeriod(employeeid, payroll_period_id);
            if (existing) {
                await trxTransactionRepo.update(existing.id, calculation);
            }
            else {
                await trxTransactionRepo.create(Object.assign(Object.assign({}, calculation), { status: 'pending' }));
            }
            // Recalculate period totals
            const totals = await trxTransactionRepo.getTotalsByPeriod(payroll_period_id);
            await trxPeriodRepo.updateTotals(payroll_period_id, totals.total_gross, totals.total_deductions, totals.total_net, totals.employee_count);
            return true;
        });
    }
    /**
     * Get payroll processing status
     */
    async getPayrollStatus(payroll_period_id) {
        const period = await this.periodRepo.getById(payroll_period_id);
        const transactions = await this.transactionRepo.getByPayrollPeriod(payroll_period_id);
        const statusBreakdown = {};
        transactions.forEach(t => {
            statusBreakdown[t.status] = (statusBreakdown[t.status] || 0) + 1;
        });
        return {
            period,
            transaction_count: transactions.length,
            status_breakdown: statusBreakdown
        };
    }
    /**
     * Create new payroll period
     */
    async createPayrollPeriod() {
        return this.periodRepo.createNextPeriod();
    }
    /**
     * Get active employees for payroll processing
     */
    async getActiveEmployees() {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        const employees = await connection('roles')
            .where({ activationstatus: 1 })
            .select('employeeid');
        return employees.map(e => e.employeeid);
    }
}
exports.PayrollProcessingService = PayrollProcessingService;
