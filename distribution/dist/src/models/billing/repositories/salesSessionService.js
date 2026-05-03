"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const ExpenseInvoiceRepo_1 = __importDefault(require("../../Expenses/ExpenseInvoiceRepo"));
const ExpenseService_1 = __importDefault(require("../../Expenses/ExpenseService"));
const SalesSessionRepo_1 = require("./SalesSessionRepo");
class SalesSessionServices {
    static async getSessionFinancialSummary(tenantId, employeeid, branchid, sessionId) {
        const session = await new SalesSessionRepo_1.SalesSessionRepo(tenantId).findById(sessionId);
        if (!session)
            return "sale session not found" /* OperationsFailures.billingSessionNotFound */;
        const currentDate = new Date();
        const connection = await (0, KnexConnections_1.default)(tenantId);
        // Determine end date
        let endDate;
        if (session.sessionendedon) {
            endDate = new Date(session.sessionendedon);
        }
        else {
            // Find next session
            const nextSession = await connection('salessessionmanager')
                .where('sessiondate', '>', session.sessiondate)
                .orderBy('sessiondate', 'asc')
                .first();
            endDate = nextSession ? new Date(nextSession.sessiondate) : currentDate;
        }
        const billingTransactions = await connection('billing')
            .where('branchid', branchid)
            .whereBetween('billedon', [session.sessiondate, endDate])
            .select(connection.sum('payable').as('accrued_revenue'), connection.sum('totalcost').as('totalCost'), connection.sum('paid').as('actual_revenue'), connection.sum('outstanding').as('outstanding_amount'), connection.sum('discount').as('total_discount'), connection.sum('balance').as('total_balance'), connection.sum('totalrefunded').as('total_refunded'), connection.count('billingid').as('total_billing_transactions'))
            .first();
        const billingRecords = await connection('billing')
            .where('branchid', branchid)
            .whereBetween('billedon', [session.sessiondate, endDate]);
        let expenseTransactions = await ExpenseService_1.default.getExpensesByCreatedOnRange(tenantId, session.sessiondate, endDate);
        const expensePaymentsMadeRecords = await new ExpenseInvoiceRepo_1.default(employeeid, branchid, tenantId).getPaymentsBetweenDates(tenantId, session.sessiondate, endDate);
        const expensePaymentsMade = await new ExpenseInvoiceRepo_1.default(employeeid, branchid, tenantId).getSumOfPayments(tenantId, session.sessiondate, endDate);
        const netRevenue = billingTransactions.actual_revenue - expensePaymentsMade;
        const expectedAmount = netRevenue > 0 ? parseFloat(netRevenue.toString()) + parseFloat(session.openingamount.toString()) : session.openingamount;
        return {
            sessionId,
            sessionDate: session.sessiondate,
            sessionStartTime: session.sessiondate,
            sessionEndTime: endDate,
            totalBillingTransactions: billingTransactions.total_billing_transactions,
            totalExpensesTransactions: expenseTransactions.length,
            totalExpensePaymentsMade: expensePaymentsMade,
            billingTransactions: billingRecords,
            netRevenue,
            expectedAmount,
            openingAmount: session.openingamount,
            accruedRevenue: billingTransactions.accrued_revenue,
            expenseRecordsDuringSession: expenseTransactions,
            expensePaymentsMadeRecords,
        };
    }
}
exports.default = SalesSessionServices;
