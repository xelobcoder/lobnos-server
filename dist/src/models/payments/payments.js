"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const queries_1 = require("./queries");
const logger_1 = __importDefault(require("../../hooks/logger"));
const helper_1 = require("../../hooks/helper");
const billingclientTypes_1 = require("../billing/billingclientTypes");
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const queries_2 = require("../../controllers/billing/sales/Extensive/queries");
class Payment {
    constructor(patientid) {
        this.getClientTransactionInformation = async (tenantId, records) => {
            try {
                const { patientid, from, to, count = 10, page = 1, branchid, isloadall } = records;
                if (!branchid) {
                    throw new Error('Branchid Not included in the query');
                }
                const isloadallBool = isloadall === true || (typeof isloadall === 'string' && isloadall === 'true');
                const connection = await (0, KnexConnections_1.default)(tenantId);
                let query = connection
                    .select('np.patientid', 'np.fullpatientid', 'rr.username AS salesperson', connection.raw("CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname) AS fullname"), 'np.email', connection.raw("CONCAT('0', np.mobile_number) AS mobileNumber"), 'b.*', connection.raw("(SELECT serviceCategory FROM \`dboservices\` WHERE billingid = b.billingid LIMIT 1) AS billingSource"))
                    .from('new_patients AS np')
                    .innerJoin('billing AS b', 'np.patientid', 'b.patientid')
                    .innerJoin('roles AS rr', 'rr.employeeid', 'b.lastupdatedby');
                if (patientid) {
                    query = query.where('np.patientid', parseInt(patientid.toString()));
                }
                if (from) {
                    if (to) {
                        query = query.whereRaw('DATE(b.billedon) BETWEEN ? AND ?', [from, to]);
                    }
                    else {
                        query = query.whereRaw('DATE(b.billedon) BETWEEN ? AND CURRENT_DATE', [from]);
                    }
                }
                query = query.orderBy('b.billingid', 'desc');
                if (!isloadallBool) {
                    const offset = (page - 1) * count;
                    query = query.limit(count).offset(offset);
                }
                const result = await query;
                const expensesPaymentMade = await connection.raw(queries_2.QUERY_EXPENSE_PAYMENTS_SUMMARY, [from, to]);
                const summary = await this.summaryRangeOfDates(tenantId, from, to, branchid);
                return { data: result, expensesPaymentMade: expensesPaymentMade[0], summary };
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
            if (!patientid)
                throw new Error("patientid is required");
            const modelQuery = queries_1.queries.allClientDebtTransactions;
            return (0, helper_1.promisifyQuery)(tenantId, modelQuery, [patientid]);
        };
        this.updateSingleTransactionDebt = async (tenantId, billingid, paid, outstanding, trx) => {
            try {
                if (trx) {
                    return trx.raw(queries_1.queries.updateSingleTransactionDebt, [paid, outstanding, billingid]);
                }
                else {
                    return (0, helper_1.promisifyQuery)(tenantId, queries_1.queries.updateSingleTransactionDebt, [paid, outstanding, billingid]);
                }
            }
            catch (err) {
                return err;
            }
        };
        this.updateTransactionHx = async (tenantId, billingid, payment, amount, employeeid, trx) => {
            const model = queries_1.queries.updateTransactionHx;
            if (trx) {
                return trx.raw(model, [billingid, payment, amount, employeeid]);
            }
            else {
                return (0, helper_1.promisifyQuery)(tenantId, model, [billingid, payment, amount, employeeid]);
            }
        };
        this.clearClientDebtBulk = async (data) => {
            const { tenantId, patientid, amount, pymode, employeeid } = data;
            const conn = await (0, KnexConnections_1.default)(tenantId);
            const trx = await conn.transaction();
            try {
                // 1. determiene if we are paying the full debt for all the oustanding debt or a transaction of a particular service
                if (!patientid)
                    throw new Error("patientid is required");
                const debts = await this.allClientDebtTransactions(tenantId, patientid);
                if (debts.length === 0) {
                    await trx.rollback();
                    return billingclientTypes_1.billErrors.noDebtToClear;
                }
                const totalDebt = debts.reduce((total, item) => total + item.outstanding, 0);
                if (totalDebt === amount) {
                    let allSucceeded = true;
                    for (const item of debts) {
                        const { outstanding, payable, billingid } = item;
                        const dd = (0, helper_1.rowAffected)(await this.updateSingleTransactionDebt(tenantId, billingid, payable, 0, trx));
                        const tt = (0, helper_1.rowAffected)(await this.updateTransactionHx(tenantId, billingid, pymode, outstanding, employeeid, trx));
                        await this.markAllServicesPaidForBilling(trx, billingid);
                        if (!dd || !tt) {
                            allSucceeded = false;
                            break;
                        }
                    }
                    if (allSucceeded) {
                        await trx.commit();
                        return true;
                    }
                    else {
                        await trx.rollback();
                        return false;
                    }
                }
                await this.handlePartialDebtClear(debts, amount, trx, tenantId, pymode, employeeid);
                await trx.commit();
                return true;
            }
            catch (err) {
                await trx.rollback();
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
					COALESCE(SUM(totalcost), 0) as total_cost,
					COALESCE(SUM(paid), 0) as actual_revenue,
					COALESCE(SUM(payable), 0) as accrued_revenue,
					COALESCE(SUM(totalrefunded), 0) as total_refunded,
					COALESCE(SUM(discount), 0) as total_discount,
					COALESCE(SUM(outstanding), 0) as total_outstanding,
					COALESCE(SUM(balance), 0) as total_balance,
					COALESCE(SUM(amountIncurredDueTax), 0) as total_tax_incurred,
					(SELECT COALESCE(SUM(amount), 0) FROM expense_payments WHERE DATE(payment_date) BETWEEN ? AND ?  ) as total_expense_payments,
					COALESCE(SUM(paid) - COALESCE((SELECT SUM(amount) FROM expense_payments WHERE DATE(payment_date) BETWEEN ? AND ?), 0), 0) AS net_revenue
				FROM billing 
				WHERE DATE(billedon) BETWEEN ? AND ? AND branchid = ?`, [from, to, from, to, from, to, branchid]);
                const result = summary[0] || {};
                return {
                    totalTransactionCost: Number(result.total_cost || 0),
                    totalCost: Number(result.total_cost || 0),
                    actualRevenue: Number(result.actual_revenue || 0),
                    accruedRevenue: Number(result.accrued_revenue || 0),
                    totalRefunded: Number(result.total_refunded || 0),
                    totalDiscount: Number(result.total_discount || 0),
                    totalOutstanding: Number(result.total_outstanding || 0),
                    totalBalance: Number(result.total_balance || 0),
                    totalTaxIncurred: Number(result.total_tax_incurred || 0),
                    transactionCount: Number(result.transactionCount || 0),
                    totalExpensePayments: Number(result.total_expense_payments || 0),
                    netRevenue: Number(result.net_revenue || 0)
                };
            }
            catch (err) {
                logger_1.default.error(`Error in summaryRangeOfDates: ${err}`);
                throw new Error(`Failed to get summary for date range: ${err.message}`);
            }
        };
        this.patientid = patientid;
    }
    async handlePartialDebtClear(debts, amount, trx, tenantId, pymode, employeeid) {
        let balance = amount;
        for (const item of debts) {
            if (balance <= 0)
                break;
            const { outstanding, paid, payable, discount, billingid } = item;
            let paymentForThisBill = Math.min(balance, outstanding);
            // Update billing debt as before
            const paidAmount = parseFloat(paid.toString()) + paymentForThisBill;
            const newOutstanding = parseFloat(payable.toString()) - (parseFloat(discount.toString()) + parseFloat(paid.toString()) + paymentForThisBill);
            await this.updateSingleTransactionDebt(tenantId, billingid, paidAmount, newOutstanding, trx);
            await this.updateTransactionHx(tenantId, billingid, pymode, paymentForThisBill, employeeid, trx);
            // --- Update dboservices for this billingid ---
            await this.applyPartialPaymentToServices(trx, billingid, paymentForThisBill);
            balance -= paymentForThisBill;
        }
    }
    async applyPartialPaymentToServices(trx, billingid, paymentAmount) {
        if (paymentAmount <= 0)
            return;
        const services = await trx('dboservices')
            .where({ billingid })
            .orderBy('serviceid', 'asc');
        let remaining = paymentAmount;
        for (const service of services) {
            const totalpayable = parseFloat(service.totalpayable || 0);
            const paidamount = parseFloat(service.paidamount || 0);
            if (totalpayable === 0) {
                await trx('dboservices')
                    .where({ serviceid: service.serviceid })
                    .update({
                    paidamount: 0,
                    paymentstatus: 'paid'
                });
                continue;
            }
            if (remaining <= 0)
                break;
            const toPay = Math.min(totalpayable - paidamount, remaining);
            if (toPay > 0) {
                const newPaid = paidamount + toPay;
                const newStatus = newPaid >= totalpayable ? 'paid' : 'partial';
                await trx('dboservices')
                    .where({ serviceid: service.serviceid })
                    .update({
                    paidamount: newPaid,
                    paymentstatus: newStatus
                });
                remaining -= toPay;
            }
        }
    }
    async markAllServicesPaidForBilling(trx, billingid) {
        const services = await trx('dboservices')
            .where({ billingid })
            .whereIn('paymentstatus', ['pending', 'partial']);
        for (const service of services) {
            const totalpayable = parseFloat(service.totalpayable || 0);
            await trx('dboservices')
                .where({ serviceid: service.serviceid })
                .update({
                paidamount: totalpayable,
                paymentstatus: 'paid'
            });
        }
    }
}
exports.default = Payment;
