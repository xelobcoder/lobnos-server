import { queries } from "./queries";
import { TransactionRecord, TransactionData, ClientDebtTransaction } from "./interfaces";
import logger from "../../hooks/logger";
import { paginationQuery, promisifyQuery, rowAffected, customError } from "../../hooks/helper";
import { billErrors } from "../billing/billingclientTypes";
import { OperationsFailures } from "../operations/types";

class Payment {
	private patientid: number;
	constructor(patientid: number) {
		this.patientid = patientid;
	}

	getClientTransactionInformation = async (tenantId: number, records: TransactionRecord): Promise<{ data: TransactionData[], summary: any }> => {
		try {
			const { patientid, from, to, count = 10, page = 1, branchid } = records;
			if (!branchid) {
				throw new Error('Branchid Not included in the query');
			}
			const values: any[] = [];
			let modelQuery: string = queries.getClientTransactionInformation;

			if (patientid) {
				modelQuery += ` WHERE np.patientid = ?`;
				values.push(parseInt(patientid.toString()));
			}

			if (from && patientid) {
				values.push(from);
				if (to) {
					modelQuery += ` AND DATE(b.billedon) BETWEEN ? AND ?`;
					values.push(to);
				} else {
					modelQuery += ` AND DATE(b.billedon) BETWEEN ? AND CURRENT_DATE`;
				}
			} else if (!patientid && from) {
				values.push(from);
				if (!to) {
					modelQuery += ` WHERE DATE(b.billedon) BETWEEN ? AND CURRENT_DATE`;
				} else {
					modelQuery += ` WHERE DATE(b.billedon) BETWEEN ? AND ?`;
					values.push(to);
				}
			}
			modelQuery += from || patientid ? ` ORDER BY b.billingid ASC LIMIT ? OFFSET ? ` : ` ORDER BY b.billingid DESC LIMIT ? OFFSET ? `;
			const result = await paginationQuery({ count, page }, modelQuery, values, tenantId);
			const summary = await this.summaryRangeOfDates(tenantId, from, to, branchid);
			return { data: result, summary } as { data: TransactionData[], summary: any }
		} catch (err) {
			logger.error(err);
			throw new Error(err);
		}
	};


	getClientFullOutstanding = async (tenantId: number, patientid: number, billingid: number): Promise<number> => {
		if (!billingid || !patientid) {
			throw new Error("patientid and billingid are required");
		}
		const modelQuery: string = queries.getClientFullOutstanding;
		const result = await promisifyQuery(tenantId, modelQuery, [patientid]);
		if (result.length > 0) {
			const { total, paid } = result[0];
			return total - paid;
		}
		return 0;
	};

	getTransactionData = async (tenantId: number, patientid: number): Promise<TransactionData[]> => {
		if (!patientid) {
			throw new Error("patientid not included");
		}
		const modelQuery: string = queries.getTransactionData;
		return promisifyQuery(tenantId, modelQuery, [patientid]);
	};

	allClientDebtTransactions = async (tenantId: number, patientid: number): Promise<ClientDebtTransaction[]> => {
		if (!patientid) {
			throw new Error("patientid is required");
		}
		const modelQuery: string = queries.allClientDebtTransactions;
		return promisifyQuery(tenantId, modelQuery, [patientid]);
	};

	updateSingleTransactionDebt = async (tenantId: number, billingid: number, paid: number, outstanding: number): Promise<any> => {
		try {
			return promisifyQuery(tenantId, queries.updateSingleTransactionDebt, [paid, outstanding, billingid]);
		} catch (err) {
			return err;
		}
	};

	updateTransactionHx = async (tenantId: number, billingid: number, payment: string, amount: number, employeeid: number): Promise<any> => {
		const model: string = queries.updateTransactionHx;
		return promisifyQuery(tenantId, model, [billingid, payment, amount, employeeid]);
	};

	clearClientDebtBulk = async (tenantId: number, patientid: number, amount: number, pymode: string, employeeid: number): Promise<boolean | string> => {
		try {
			if (!patientid) {
				throw new Error("patientid is required");
			}
			const debts = await this.allClientDebtTransactions(tenantId, patientid);
			if (debts.length === 0) {
				return billErrors.noDebtToClear;
			}
			const totalDebt = debts.reduce((total, item) => total + item.outstanding, 0);
			if (totalDebt === amount) {
				const result = await Promise.all(
					debts.map(async (item) => {
						const { outstanding, payable, billingid } = item;
						const dd = rowAffected(await this.updateSingleTransactionDebt(tenantId, billingid, payable, 0));
						const tt = rowAffected(await this.updateTransactionHx(tenantId, billingid, pymode, outstanding, employeeid));
						return dd && tt;
					})
				);
				return !result.some((a) => !a);
			}
			let balance = amount;
			for (const item of debts) {
				if (balance <= 0) break;
				const { outstanding, paid, payable, discount, billingid } = item;
				if (outstanding > balance) {
					const paidAmount = parseFloat(paid.toString()) + balance;
					const newOutstanding = parseFloat(payable.toString()) - (parseFloat(discount.toString()) + parseFloat(paid.toString()) + parseFloat(balance.toString()));

					await this.updateSingleTransactionDebt(tenantId, billingid, paidAmount, newOutstanding);

					await this.updateTransactionHx(tenantId, billingid, pymode, balance, employeeid);

					balance = 0;
				} else {
					await this.updateSingleTransactionDebt(tenantId, billingid, payable, 0);
					await this.updateTransactionHx(tenantId, billingid, pymode, outstanding, employeeid);
					balance -= outstanding;
				}
			}
			return true;
		} catch (err) {
			throw new Error(err);
		}
	};

	updatePayment = async (request: any, response: any): Promise<void> => {
		try {
			const { billingid, pay, paymentMode } = request.body;
			const { tenantId } = request.query;
			const result = await promisifyQuery(tenantId, queries.updatePayment, [billingid]);
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
			const updateQuery = queries.updatePaymentUpdate;
			const values = [notOutstanding, newAmount, billingid];
			const updateInfo = await promisifyQuery(tenantId, updateQuery, values);
			if (!rowAffected(updateInfo)) {
				throw new Error("Failed to update payment");
			}
			const inserted = await promisifyQuery(tenantId, queries.insertBillingHx, [billingid, paymentMode, pay]);
			if (!rowAffected(inserted)) {
				throw new Error("Failed to insert payment history");
			}
			response.send({ message: "Payment updated successfully", statusCode: 200, status: "success" });
		} catch (err) {
			customError(err.message || "Something went wrong", 500, response);
		}
	};

	paymentMode = async (request: any, response: any): Promise<void> => {
		try {
			const { tenantId } = request.query;
			const tenantIdP = parseInt(tenantId.toString())
			const result = await promisifyQuery(tenantIdP, queries.paymentMode);
			response.send({ data: result || [], status: "success", statusCode: 200 });
		} catch (err) {
			customError("Something went wrong", 500, response);
		}
	};

	specificBillTransactionHx = async (request: any, response: any): Promise<void> => {
		try {
			const { billingid, tenantId } = request.query;
			if (!billingid) {
				customError("billingid is required as a query parameter", 401, response);
				return;
			}
			const result = await promisifyQuery(tenantId, queries.specificBillTransactionHx, [billingid]);
			response.send(result);
		} catch (err) {
			customError("Something went wrong", 500, response);
		}
	};


	summaryRangeOfDates = async (tenantId: number, from: string, to: string, branchid: number): Promise<{
		totalTransactionCost: number;
		totalCost: number;
		totalPaid: number;
		totalPayable: number;
		totalRefunded: number;
		totalDiscount: number;
		totalOutstanding: number;
		totalBalance: number;
		totalTaxIncurred: number;
		transactionCount: number;
	}> => {
		try {
			const summary = await promisifyQuery(
				tenantId,
				`SELECT 
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
				WHERE DATE(billedon) BETWEEN ? AND ?  AND branchid = ?`,
				[from, to,branchid]
			);

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
		} catch (err) {
			logger.error(`Error in summaryRangeOfDates: ${err}`);
			throw new Error(`Failed to get summary for date range: ${err.message}`);
		}
	}

}

export default Payment;
