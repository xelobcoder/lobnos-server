
/*
 * Payment logic for handling debt clearing, partial and full payments, and atomic updates to dboservices.
 * - Ensures all dboservices are updated correctly for both full and partial payments.
 * - Free services (totalpayable = 0) are always marked as paid.
 * - All payment and service updates are transaction-safe.
 */
import { queries } from "./queries";
import { TransactionRecord, TransactionData, ClientDebtTransaction } from "./interfaces";
import logger from "../../hooks/logger";
import { paginationQuery, promisifyQuery, rowAffected, customError } from "../../hooks/helper";
import { billErrors } from "../billing/billingclientTypes";
import KnexConnection from "../../database/KnexConnections";

class Payment {
	private async handlePartialDebtClear(
		debts: ClientDebtTransaction[],
		amount: number,
		trx: any,
		tenantId: number,
		pymode: string,
		employeeid: number
	) {
		let balance = amount;
		for (const item of debts) {
			if (balance <= 0) break;
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

	private async applyPartialPaymentToServices(trx: any, billingid: number, paymentAmount: number) {
		if (paymentAmount <= 0) return;
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
			if (remaining <= 0) break;
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
	private patientid: number;

	constructor(patientid: number) {
		this.patientid = patientid;
	}

	private async markAllServicesPaidForBilling(trx: any, billingid: number) {
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
			modelQuery += ` ORDER BY b.billingid DESC LIMIT ? OFFSET ? `
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
		if (!patientid) throw new Error("patientid is required");
		const modelQuery: string = queries.allClientDebtTransactions;
		return promisifyQuery(tenantId, modelQuery, [patientid]);
	};



	updateSingleTransactionDebt = async (
		tenantId: number,
		billingid: number,
		paid: number,
		outstanding: number,
		trx?: any
	): Promise<any> => {
		try {
			if (trx) {
				return trx.raw(queries.updateSingleTransactionDebt, [paid, outstanding, billingid]);
			} else {
				return promisifyQuery(tenantId, queries.updateSingleTransactionDebt, [paid, outstanding, billingid]);
			}
		} catch (err) {
			return err;
		}
	};

	updateTransactionHx = async (
		tenantId: number,
		billingid: number,
		payment: string,
		amount: number,
		employeeid: number,
		trx?: any
	): Promise<any> => {
		const model: string = queries.updateTransactionHx;
		if (trx) {
			return trx.raw(model, [billingid, payment, amount, employeeid]);
		} else {
			return promisifyQuery(tenantId, model, [billingid, payment, amount, employeeid]);
		}
	};

	clearClientDebtBulk = async (tenantId: number, patientid: number, amount: number, pymode: string, employeeid: number): Promise<boolean | string> => {
		const conn = await KnexConnection(tenantId);
		const trx = await conn.transaction();
		try {
			if (!patientid) throw new Error("patientid is required");
			const debts = await this.allClientDebtTransactions(tenantId, patientid);
			if (debts.length === 0) { await trx.rollback(); return billErrors.noDebtToClear; }
			const totalDebt = debts.reduce((total, item) => total + item.outstanding, 0);
			if (totalDebt === amount) {
				let allSucceeded = true;
				for (const item of debts) {
					const { outstanding, payable, billingid } = item;
					const dd = rowAffected(await this.updateSingleTransactionDebt(tenantId, billingid, payable, 0, trx));
					const tt = rowAffected(await this.updateTransactionHx(tenantId, billingid, pymode, outstanding, employeeid, trx));
					await this.markAllServicesPaidForBilling(trx, billingid);
					if (!dd || !tt) {
						allSucceeded = false;
						break;
					}
				}
				if (allSucceeded) {
					await trx.commit();
					return true;
				} else {
					await trx.rollback();
					return false;
				}
			}
			await this.handlePartialDebtClear(debts, amount, trx, tenantId, pymode, employeeid);
			await trx.commit();
			return true;
		} catch (err) {
			await trx.rollback();
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
				[from, to, branchid]
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
