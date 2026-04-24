"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayrollReversalService = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const logger_1 = __importDefault(require("../../hooks/logger"));
const ExpenseService_1 = __importDefault(require("../../models/Expenses/ExpenseService"));
const payrollReversalTablesInit_1 = require("./payrollReversalTablesInit");
class PayrollReversalService {
    constructor(tenantId) {
        this.tenantId = tenantId;
    }
    async getPayrollReversals(filters) {
        var _a;
        await (0, payrollReversalTablesInit_1.ensurePayrollReversalTables)(this.tenantId);
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        const countValue = filters.count ? parseInt(filters.count) : 10;
        const pageValue = filters.page ? parseInt(filters.page) : 1;
        const offset = (pageValue - 1) * countValue;
        const baseQuery = connection('payroll_period_reversals').modify((qb) => {
            if (filters.payroll_period_id)
                qb.where({ payroll_period_id: filters.payroll_period_id });
        });
        const totalRow = await baseQuery.clone().count({ total: '*' });
        const total = Number(((_a = totalRow === null || totalRow === void 0 ? void 0 : totalRow[0]) === null || _a === void 0 ? void 0 : _a.total) || 0);
        const data = await baseQuery
            .clone()
            .orderBy('created_at', 'desc')
            .limit(countValue)
            .offset(offset);
        return { data, total, page: pageValue, count: countValue };
    }
    async getPayrollReversalErrors(filters) {
        var _a;
        await (0, payrollReversalTablesInit_1.ensurePayrollReversalTables)(this.tenantId);
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        const countValue = filters.count ? parseInt(filters.count) : 10;
        const pageValue = filters.page ? parseInt(filters.page) : 1;
        const offset = (pageValue - 1) * countValue;
        const baseQuery = connection('payroll_period_errors').modify((qb) => {
            if (filters.payroll_period_id)
                qb.where({ payroll_period_id: filters.payroll_period_id });
        });
        const totalRow = await baseQuery.clone().count({ total: '*' });
        const total = Number(((_a = totalRow === null || totalRow === void 0 ? void 0 : totalRow[0]) === null || _a === void 0 ? void 0 : _a.total) || 0);
        const data = await baseQuery
            .clone()
            .orderBy('created_at', 'desc')
            .limit(countValue)
            .offset(offset);
        return { data, total, page: pageValue, count: countValue };
    }
    async reversePayrollPeriod(data) {
        await (0, payrollReversalTablesInit_1.ensurePayrollReversalTables)(this.tenantId);
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        const { payroll_period_id, reversed_by, branchid, reason } = data;
        try {
            return await connection.transaction(async (trx) => {
                const period = await trx('payroll_periods')
                    .where({ id: payroll_period_id })
                    .first();
                if (!period) {
                    throw new Error(`Payroll period ${payroll_period_id} not found`);
                }
                if (period.status !== 'paid') {
                    throw new Error(`Cannot reverse payroll period with status ${period.status}`);
                }
                let expense_id = period.expense_id || null;
                let invoice_id = period.expense_invoice_id || null;
                let payment_id = period.expense_payment_id || null;
                if (!invoice_id) {
                    const invoice = await trx('invoices')
                        .select('id')
                        .where('invoice_number', 'like', `PAYROLL-${payroll_period_id}-%`)
                        .orderBy('id', 'desc')
                        .first();
                    invoice_id = (invoice === null || invoice === void 0 ? void 0 : invoice.id) || null;
                }
                if (invoice_id && !expense_id) {
                    const link = await trx('invoice_expenses')
                        .select('expense_id')
                        .where({ invoice_id })
                        .orderBy('id', 'asc')
                        .first();
                    expense_id = (link === null || link === void 0 ? void 0 : link.expense_id) || null;
                }
                if (invoice_id && !payment_id) {
                    const payment = await trx('expense_payments')
                        .select('id')
                        .where({ invoice_id })
                        .where({ status: 'Paid' })
                        .where((qb) => qb.whereNull('is_reversed').orWhere('is_reversed', false))
                        .orderBy('id', 'desc')
                        .first();
                    payment_id = (payment === null || payment === void 0 ? void 0 : payment.id) || null;
                }
                let expense_payment_reversal_id = null;
                if (payment_id) {
                    const payment = await trx('expense_payments')
                        .where({ id: payment_id })
                        .first();
                    if (!payment) {
                        throw new Error(`Expense payment ${payment_id} not found`);
                    }
                    const reversalInsert = await trx('expense_payment_reversals').insert({
                        payment_id,
                        expense_id: payment.expense_id,
                        invoice_id: payment.invoice_id || null,
                        reversed_amount: payment.amount,
                        reversed_by,
                        reversal_reason: reason || null,
                        reversal_method: payment.method || null,
                        reversed_on: trx.fn.now(),
                        created_at: trx.fn.now()
                    });
                    expense_payment_reversal_id = reversalInsert[0] || null;
                    await trx('expense_payments')
                        .where({ id: payment_id })
                        .update({
                        is_reversed: true,
                        reversal_id: expense_payment_reversal_id,
                        reversed_on: trx.fn.now()
                    });
                }
                if (invoice_id) {
                    await trx('invoices')
                        .where({ id: invoice_id })
                        .update({
                        status: 'Rejected',
                        updated_on: trx.fn.now()
                    });
                }
                if (expense_id) {
                    const expenseService = new ExpenseService_1.default(reversed_by, branchid, this.tenantId, null, trx);
                    await expenseService.updateExpenseDecision(this.tenantId, 'rejected', [{
                            expenseid: expense_id,
                            information: reason ? `Payroll reversal: ${reason}` : 'Payroll reversal',
                            employeeid: reversed_by
                        }], trx);
                }
                await trx('payroll_transactions')
                    .where({ payroll_period_id })
                    .update({
                    status: 'approved',
                    payment_date: null,
                    payment_method: null,
                    payment_reference: null,
                    updated_at: trx.fn.now()
                });
                await trx('payroll_periods')
                    .where({ id: payroll_period_id })
                    .update({
                    status: 'locked',
                    expense_synced: false,
                    expense_id: null,
                    expense_invoice_id: null,
                    expense_payment_id: null,
                    was_reversed: true,
                    reversed_at: trx.fn.now(),
                    updated_at: trx.fn.now()
                });
                const reversalInsert = await trx('payroll_period_reversals').insert({
                    payroll_period_id,
                    reversed_by,
                    branchid,
                    reason: reason || null,
                    previous_status: period.status,
                    reverted_to_status: 'locked',
                    expense_id,
                    invoice_id,
                    payment_id,
                    expense_payment_reversal_id,
                    metadata: JSON.stringify({
                        payroll_period_id,
                        expense_id,
                        invoice_id,
                        payment_id,
                        expense_payment_reversal_id
                    }),
                    created_at: trx.fn.now()
                });
                const reversal_id = reversalInsert[0];
                await trx('payroll_periods')
                    .where({ id: payroll_period_id })
                    .update({
                    last_reversal_id: reversal_id,
                    updated_at: trx.fn.now()
                });
                await trx('payroll_period_errors').insert({
                    payroll_period_id,
                    error_type: 'PAYROLL_REVERSED',
                    error_message: reason || 'Payroll period reversed',
                    stack: null,
                    created_by: reversed_by,
                    branchid,
                    reversal_id,
                    metadata: JSON.stringify({
                        expense_id,
                        invoice_id,
                        payment_id,
                        expense_payment_reversal_id
                    }),
                    created_at: trx.fn.now()
                });
                return {
                    success: true,
                    reversal_id,
                    expense_id,
                    invoice_id,
                    payment_id,
                    expense_payment_reversal_id
                };
            });
        }
        catch (err) {
            try {
                await connection('payroll_period_errors').insert({
                    payroll_period_id,
                    error_type: 'PAYROLL_REVERSAL_FAILED',
                    error_message: (err === null || err === void 0 ? void 0 : err.message) || 'Payroll reversal failed',
                    stack: (err === null || err === void 0 ? void 0 : err.stack) || null,
                    created_by: reversed_by || null,
                    branchid: branchid || null,
                    reversal_id: null,
                    metadata: JSON.stringify({ payroll_period_id }),
                    created_at: connection.fn.now()
                });
            }
            catch (logErr) {
                logger_1.default.error('Failed to persist payroll reversal failure:', logErr);
            }
            logger_1.default.error('Error reversing payroll period:', err);
            throw err;
        }
    }
}
exports.PayrollReversalService = PayrollReversalService;
