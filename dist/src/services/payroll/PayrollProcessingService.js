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
const AutomatedExpenseLifecycle_1 = __importDefault(require("../../models/Expenses/AutomatedExpenseLifecycle"));
class PayrollProcessingService {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.periodRepo = new PayrollPeriodRepository_1.PayrollPeriodRepository(tenantId);
        this.transactionRepo = new PayrollTransactionRepository_1.PayrollTransactionRepository(tenantId);
        this.calculationService = new PayrollCalculationService_1.PayrollCalculationService(tenantId);
    }
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
        if (dateString.includes('T')) {
            return dateString.split('T')[0];
        }
        return dateString;
    }
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
        const calculationInputs = employeeIds.map(employeeid => ({
            employeeid,
            payroll_period_id,
            period_start_date: this.formatDateForCalculation(period.period_start_date),
            period_end_date: this.formatDateForCalculation(period.period_end_date)
        }));
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.transaction(async (trx) => {
            const trxPeriodRepo = new PayrollPeriodRepository_1.PayrollPeriodRepository(this.tenantId, trx);
            const trxTransactionRepo = new PayrollTransactionRepository_1.PayrollTransactionRepository(this.tenantId, trx);
            for (const input of calculationInputs) {
                try {
                    const calculation = await this.calculationService.calculateEmployeePayroll(input);
                    const existing = await trxTransactionRepo.getByEmployeeAndPeriod(input.employeeid, payroll_period_id);
                    if (existing) {
                        await trxTransactionRepo.update(existing.id, Object.assign(Object.assign({}, calculation), { status: 'pending' }));
                    }
                    else {
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
            const totals = {
                total_gross_salary: successfulTransactions.reduce((sum, t) => sum + t.gross_salary, 0),
                total_deductions: successfulTransactions.reduce((sum, t) => sum + t.total_deductions, 0),
                total_net_salary: successfulTransactions.reduce((sum, t) => sum + t.net_salary, 0),
                employee_count: successfulTransactions.length
            };
            await trxPeriodRepo.updateTotals(payroll_period_id, totals.total_gross_salary, totals.total_deductions, totals.total_net_salary, totals.employee_count);
            if (errors.length === 0) {
                await trxPeriodRepo.markAsCalculated(payroll_period_id, calculated_by);
            }
            else {
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
            await trxPeriodRepo.markAsApproved(payroll_period_id, approved_by);
            const transactions = await trxTransactionRepo.getByPayrollPeriod(payroll_period_id);
            for (const transaction of transactions) {
                if (transaction.status === 'pending') {
                    await trxTransactionRepo.markAsApproved(transaction.id);
                }
            }
            return true;
        });
    }
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
            const transactions = await trxTransactionRepo.getByPayrollPeriod(payroll_period_id);
            for (const transaction of transactions) {
                const reference = (payment_references === null || payment_references === void 0 ? void 0 : payment_references.get(transaction.employeeid)) || undefined;
                await trxTransactionRepo.markAsPaid(transaction.id, payment_date, payment_method, reference);
            }
            await trxPeriodRepo.markAsPaid(payroll_period_id);
            const totalNetSalary = Number(period.total_net_salary || 0);
            const lifecycle = new AutomatedExpenseLifecycle_1.default(this.tenantId);
            const lifecycleResult = await lifecycle.process({
                amount: totalNetSalary,
                name: `Payroll Expense - ${period.period_name} (${payroll_period_id})`,
                description: `Payroll for ${period.period_name} (${period.period_start_date} to ${period.period_end_date}) paid on ${payment_date}`,
                categoryName: "salary",
                merchantName: "PAYROLL",
                merchantEmail: "system-payroll-automated",
                date: new Date(payment_date),
                branchid,
                employeeid,
                paymentMethod: payment_method,
                invoicePrefix: "PAYROLL"
            }, trx);
            await trx('payroll_periods')
                .where({ id: payroll_period_id })
                .update({
                expense_synced: true,
                expense_id: lifecycleResult.expenseId,
                expense_invoice_id: lifecycleResult.invoiceId,
                expense_payment_id: lifecycleResult.paymentId || null,
                updated_at: trx.fn.now()
            });
            return true;
        });
    }
    async revertPayrollPeriodStatus(payroll_period_id, targetStatus) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.transaction(async (trx) => {
            const trxPeriodRepo = new PayrollPeriodRepository_1.PayrollPeriodRepository(this.tenantId, trx);
            const trxTransactionRepo = new PayrollTransactionRepository_1.PayrollTransactionRepository(this.tenantId, trx);
            const period = await trxPeriodRepo.getById(payroll_period_id);
            if (!period) {
                throw new Error(`Payroll period ${payroll_period_id} not found`);
            }
            if (period.status === 'paid') {
                throw new Error('Cannot revert a paid payroll period. Reverse payment first.');
            }
            const allowedCurrentStatuses = ['draft', 'calculated', 'approved', 'locked'];
            if (!allowedCurrentStatuses.includes(period.status)) {
                throw new Error(`Cannot revert payroll period with status ${period.status}`);
            }
            const statusOrder = {
                draft: 1,
                calculated: 2,
                approved: 3,
                locked: 4
            };
            if (statusOrder[targetStatus] > statusOrder[period.status]) {
                throw new Error(`Cannot move payroll period forward to ${targetStatus} using revert`);
            }
            const transactionStatus = targetStatus === 'approved' ? 'approved' : 'pending';
            await trxTransactionRepo.updateStatusByPayrollPeriod(payroll_period_id, transactionStatus);
            await trxPeriodRepo.revertWorkflowStatus(payroll_period_id, targetStatus);
            return true;
        });
    }
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
            const totals = await trxTransactionRepo.getTotalsByPeriod(payroll_period_id);
            await trxPeriodRepo.updateTotals(payroll_period_id, totals.total_gross, totals.total_deductions, totals.total_net, totals.employee_count);
            return true;
        });
    }
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
    async createPayrollPeriod() {
        return this.periodRepo.createNextPeriod();
    }
    async getActiveEmployees() {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        const employees = await connection('roles')
            .where({ activationstatus: 1 })
            .select('employeeid');
        return employees.map(e => e.employeeid);
    }
}
exports.PayrollProcessingService = PayrollProcessingService;
