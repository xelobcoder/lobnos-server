"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const queries_1 = require("./queries");
const logger_1 = __importDefault(require("../../hooks/logger"));
const helper_1 = require("../../hooks/helper");
const billingclientTypes_1 = require("../billing/billingclientTypes");
class Payment {
    constructor(patientid) {
        this.getClientTransactionInformation = async (tenantId, records) => {
            try {
                const { patientid, from, to, count = 10, page = 1, branchid } = records;
                if (!branchid) {
                    throw new Error('Branchid Not included in the query');
                }
                const values = [];
                let modelQuery = queries_1.queries.getClientTransactionInformation;
                if (patientid) {
                    modelQuery += ` WHERE np.patientid = ?`;
                    values.push(parseInt(patientid.toString()));
                }
                if (from && patientid) {
                    values.push(from);
                    if (to) {
                        modelQuery += ` AND DATE(b.billedon) BETWEEN ? AND ?`;
                        values.push(to);
                    }
                    else {
                        modelQuery += ` AND DATE(b.billedon) BETWEEN ? AND CURRENT_DATE`;
                    }
                }
                else if (!patientid && from) {
                    values.push(from);
                    if (!to) {
                        modelQuery += ` WHERE DATE(b.billedon) BETWEEN ? AND CURRENT_DATE`;
                    }
                    else {
                        modelQuery += ` WHERE DATE(b.billedon) BETWEEN ? AND ?`;
                        values.push(to);
                    }
                }
                modelQuery += from || patientid ? ` ORDER BY b.billingid ASC LIMIT ? OFFSET ? ` : ` ORDER BY b.billingid DESC LIMIT ? OFFSET ? `;
                const result = await (0, helper_1.paginationQuery)({ count, page }, modelQuery, values, tenantId);
                const summary = await this.summaryRangeOfDates(tenantId, from, to, branchid);
                return { data: result, summary };
            }
            catch (err) {
                logger_1.default.error(err);
                throw new Error(err);
            }
        };
        this.getClientFullOutstanding = async (tenantId, patientid, billingid) => {
            if (!billingid || !patientid) {
                throw new Error("patientid and billingid are required");
            }
            const modelQuery = queries_1.queries.getClientFullOutstanding;
            const result = await (0, helper_1.promisifyQuery)(tenantId, modelQuery, [patientid]);
            if (result.length > 0) {
                const { total, paid } = result[0];
                return total - paid;
            }
            return 0;
        };
        this.getTransactionData = async (tenantId, patientid) => {
            if (!patientid) {
                throw new Error("patientid not included");
            }
            const modelQuery = queries_1.queries.getTransactionData;
            return (0, helper_1.promisifyQuery)(tenantId, modelQuery, [patientid]);
        };
        this.allClientDebtTransactions = async (tenantId, patientid) => {
            if (!patientid) {
                throw new Error("patientid is required");
            }
            const modelQuery = queries_1.queries.allClientDebtTransactions;
            return (0, helper_1.promisifyQuery)(tenantId, modelQuery, [patientid]);
        };
        this.updateSingleTransactionDebt = async (tenantId, billingid, paid, outstanding) => {
            try {
                return (0, helper_1.promisifyQuery)(tenantId, queries_1.queries.updateSingleTransactionDebt, [paid, outstanding, billingid]);
            }
            catch (err) {
                return err;
            }
        };
        this.updateTransactionHx = async (tenantId, billingid, payment, amount, employeeid) => {
            const model = queries_1.queries.updateTransactionHx;
            return (0, helper_1.promisifyQuery)(tenantId, model, [billingid, payment, amount, employeeid]);
        };
        this.clearClientDebtBulk = async (tenantId, patientid, amount, pymode, employeeid) => {
            try {
                if (!patientid) {
                    throw new Error("patientid is required");
                }
                const debts = await this.allClientDebtTransactions(tenantId, patientid);
                if (debts.length === 0) {
                    return billingclientTypes_1.billErrors.noDebtToClear;
                }
                const totalDebt = debts.reduce((total, item) => total + item.outstanding, 0);
                if (totalDebt === amount) {
                    const result = await Promise.all(debts.map(async (item) => {
                        const { outstanding, payable, billingid } = item;
                        const dd = (0, helper_1.rowAffected)(await this.updateSingleTransactionDebt(tenantId, billingid, payable, 0));
                        const tt = (0, helper_1.rowAffected)(await this.updateTransactionHx(tenantId, billingid, pymode, outstanding, employeeid));
                        return dd && tt;
                    }));
                    return !result.some((a) => !a);
                }
                let balance = amount;
                for (const item of debts) {
                    if (balance <= 0)
                        break;
                    const { outstanding, paid, payable, discount, billingid } = item;
                    if (outstanding > balance) {
                        const paidAmount = parseFloat(paid.toString()) + balance;
                        const newOutstanding = parseFloat(payable.toString()) - (parseFloat(discount.toString()) + parseFloat(paid.toString()) + parseFloat(balance.toString()));
                        await this.updateSingleTransactionDebt(tenantId, billingid, paidAmount, newOutstanding);
                        await this.updateTransactionHx(tenantId, billingid, pymode, balance, employeeid);
                        balance = 0;
                    }
                    else {
                        await this.updateSingleTransactionDebt(tenantId, billingid, payable, 0);
                        await this.updateTransactionHx(tenantId, billingid, pymode, outstanding, employeeid);
                        balance -= outstanding;
                    }
                }
                return true;
            }
            catch (err) {
                throw new Error(err);
            }
        };
        this.updatePayment = async (request, response) => {
            try {
                const { billingid, pay, paymentMode } = request.body;
                const { tenantId } = request.query;
                const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.queries.updatePayment, [billingid]);
                if (result.length === 0) {
                    throw new Error("No such transaction found");
                }
                const { paid_amount, discount, outstanding, payable } = result[0];
                if (outstanding <= 0) {
                    response.send({ status: "success", statusCode: 200, message: "Client is in good standing" });
                    return;
                }
                const newAmount = paid_amount + parseInt(pay);
                const notOutstanding = payable - newAmount - discount;
                const updateQuery = queries_1.queries.updatePaymentUpdate;
                const values = [notOutstanding, newAmount, billingid];
                const updateInfo = await (0, helper_1.promisifyQuery)(tenantId, updateQuery, values);
                if (!(0, helper_1.rowAffected)(updateInfo)) {
                    throw new Error("Failed to update payment");
                }
                const inserted = await (0, helper_1.promisifyQuery)(tenantId, queries_1.queries.insertBillingHx, [billingid, paymentMode, pay]);
                if (!(0, helper_1.rowAffected)(inserted)) {
                    throw new Error("Failed to insert payment history");
                }
                response.send({ message: "Payment updated successfully", statusCode: 200, status: "success" });
            }
            catch (err) {
                (0, helper_1.customError)(err.message || "Something went wrong", 500, response);
            }
        };
        this.paymentMode = async (request, response) => {
            try {
                const { tenantId } = request.query;
                const tenantIdP = parseInt(tenantId.toString());
                const result = await (0, helper_1.promisifyQuery)(tenantIdP, queries_1.queries.paymentMode);
                response.send({ data: result || [], status: "success", statusCode: 200 });
            }
            catch (err) {
                (0, helper_1.customError)("Something went wrong", 500, response);
            }
        };
        this.specificBillTransactionHx = async (request, response) => {
            try {
                const { billingid, tenantId } = request.query;
                if (!billingid) {
                    (0, helper_1.customError)("billingid is required as a query parameter", 401, response);
                    return;
                }
                const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.queries.specificBillTransactionHx, [billingid]);
                response.send(result);
            }
            catch (err) {
                (0, helper_1.customError)("Something went wrong", 500, response);
            }
        };
        this.summaryRangeOfDates = async (tenantId, from, to, branchid) => {
            try {
                const summary = await (0, helper_1.promisifyQuery)(tenantId, `SELECT 
					COUNT(*) as transactionCount,
					COALESCE(SUM(totalTransactionCost), 0) as totalTransactionCost,
					COALESCE(SUM(totalcost), 0) as totalCost,
					COALESCE(SUM(paid), 0) as totalPaid,
					COALESCE(SUM(payable), 0) as totalPayable,
					COALESCE(SUM(totalrefunded), 0) as totalRefunded,
					COALESCE(SUM(discount), 0) as totalDiscount,
					COALESCE(SUM(outstanding), 0) as totalOutstanding,
					COALESCE(SUM(balance), 0) as totalBalance,
					COALESCE(SUM(amountIncurredDueTax), 0) as totalTaxIncurred
				FROM billing 
				WHERE DATE(billedon) BETWEEN ? AND ?  AND branchid = ?`, [from, to, branchid]);
                const result = summary[0] || {};
                return {
                    totalTransactionCost: Number(result.totalTransactionCost || 0),
                    totalCost: Number(result.totalCost || 0),
                    totalPaid: Number(result.totalPaid || 0),
                    totalPayable: Number(result.totalPayable || 0),
                    totalRefunded: Number(result.totalRefunded || 0),
                    totalDiscount: Number(result.totalDiscount || 0),
                    totalOutstanding: Number(result.totalOutstanding || 0),
                    totalBalance: Number(result.totalBalance || 0),
                    totalTaxIncurred: Number(result.totalTaxIncurred || 0),
                    transactionCount: Number(result.transactionCount || 0)
                };
            }
            catch (err) {
                logger_1.default.error(`Error in summaryRangeOfDates: ${err}`);
                throw new Error(`Failed to get summary for date range: ${err.message}`);
            }
        };
        this.patientid = patientid;
    }
}
exports.default = Payment;
