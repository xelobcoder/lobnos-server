"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const ExpenseService_1 = __importDefault(require("../../Expenses/ExpenseService"));
const SalesSessionRepo_1 = require("./SalesSessionRepo");
class SalesSessionServices {
    static async getSessionFinancialSummary(tenantId, sessionId) {
        var _a;
        const session = await new SalesSessionRepo_1.SalesSessionRepo(tenantId).findById(sessionId);
        if (!session)
            return "sale session not found" /* OperationsFailures.billingSessionNotFound */;
        const isSessionEnded = session.sessionendedon !== null;
        if (isSessionEnded)
            return "sale session already ended" /* OperationsFailures.billingSessionAlreadyEnded */;
        const currentDate = new Date();
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const billingTransactions = await connection.raw(`
                    SELECT * FROM billing
                    WHERE billedon BETWEEN ? AND ?
                    AND status != 'voided'
                    AND status != 'written-off'
                    AND (adjustmentType != 'void' OR adjustmentType IS NULL)
               `, [session.sessiondate, currentDate]);
        const totalPayable = await connection.raw(`
                      SELECT SUM(payable) AS totalpayable,
                      SUM(totalcost) AS totalCost,
                      SUM(paid) AS totalPaid,
                      SUM(outstanding) AS totalOutstanding,
                      SUM(discount) AS totalDiscount,
                      SUM(balance) AS totalbalance
                       FROM billing
                         WHERE billedon BETWEEN ? AND ?
                         AND status != 'voided'
                         AND status != 'written-off'
                    AND (adjustmentType != 'void' OR adjustmentType IS NULL)
                    `, [session.sessiondate, currentDate]);
        let expenseTransactions = await ExpenseService_1.default.getExpensesByCreatedOnRange(tenantId, session.sessiondate, currentDate);
        expenseTransactions = expenseTransactions.filter(e => {
            if (e.approved === null || e.approved === undefined)
                return false;
            return parseInt(e.approved.toString()) === 1;
        });
        let totalExpense = 0;
        if (expenseTransactions.length > 0) {
            totalExpense = expenseTransactions.reduce((acc, expense) => acc + Number(expense.amount), 0);
        }
        const totalpayable = parseFloat(totalPayable[0][0]['totalpayable']) || 0;
        const totaloutstanding = parseFloat(totalPayable[0][0]['totalOutstanding']) || 0;
        const totalbalance = parseFloat(totalPayable[0][0]['totalbalance']) || 0;
        const expectedAmount = totalpayable - (totalExpense) + parseFloat(((_a = session === null || session === void 0 ? void 0 : session.openingamount) !== null && _a !== void 0 ? _a : '0').toString());
        return {
            sessionId,
            sessionDate: session.sessiondate,
            sessionStartTime: session.sessiondate,
            sessionEndTime: currentDate,
            totalBillingTransactions: billingTransactions[0],
            totalbalance,
            expenseTransactions,
            totalPayable: totalPayable[0][0].totalpayable || 0,
            totalCost: totalPayable[0][0].totalCost || 0,
            totalPaid: totalPayable[0][0].totalPaid || 0,
            totalOutstanding: totalPayable[0][0].totalOutstanding || 0,
            totalDiscount: totalPayable[0][0].totalDiscount || 0,
            totalExpense,
            expectedAmount,
        };
    }
}
exports.default = SalesSessionServices;
