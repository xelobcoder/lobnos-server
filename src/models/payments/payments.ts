
import { queries } from "./queries";
import { TransactionRecord, TransactionData, ClientDebtTransaction } from "./interfaces";
import logger from "../../hooks/logger";
import { paginationQuery, promisifyQuery, rowAffected, customError } from "../../hooks/helper";
import { billErrors } from "../billing/billingclientTypes";
import KnexConnection from "../../database/KnexConnections";
import { QUERY_EXPENSE_PAYMENTS_SUMMARY } from "../../controllers/billing/sales/Extensive/queries";
import { applyDboservicesAfterUpdate } from "../../database/appLevelTriggers";



type PaymentRequestBody = {
	tenantId: number,
	patientid: number,
	amount: number,
	pymode: string,
	employeeid: number,
	paymentRequestType: "service" | "transaction" | "debtClearance",
	billingid?: number,
	serviceid?: number
}

class Payment {
	private patientid: number;
	constructor(patientid: number) {
		this.patientid = patientid;
	}

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
				const updated = await trx('dboservices').where({ serviceid: service.serviceid }).first();
				if (updated) {
					await applyDboservicesAfterUpdate(trx, updated);
				}
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
				const updated = await trx('dboservices').where({ serviceid: service.serviceid }).first();
				if (updated) {
					await applyDboservicesAfterUpdate(trx, updated);
				}
				remaining -= toPay;
			}
		}
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
			const updated = await trx('dboservices').where({ serviceid: service.serviceid }).first();
			if (updated) {
				await applyDboservicesAfterUpdate(trx, updated);
			}
		}
	}

	getClientTransactionInformation = async (tenantId: number, records: TransactionRecord): Promise<{ data: TransactionData[], summary: any }> => {
		try {
			const { patientid, from, to, count = 10, page = 1, branchid, isloadall } = records;
			if (!branchid) {
				throw new Error('Branchid Not included in the query');
			}

			const isloadallBool = isloadall === true || (typeof isloadall === 'string' && isloadall === 'true');
			const connection = await KnexConnection(tenantId);
			let query = connection
				.select(
					'np.patientid',
					'np.fullpatientid',
					'rr.username AS salesperson',
					connection.raw("CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname) AS fullname"),
					'np.email',
					connection.raw("CONCAT('0', np.mobile_number) AS mobileNumber"),
					'b.*',
					connection.raw("(SELECT serviceCategory FROM \`dboservices\` WHERE billingid = b.billingid LIMIT 1) AS billingSource")
				)
				.from('new_patients AS np')
				.innerJoin('billing AS b', 'np.patientid', 'b.patientid')
				.innerJoin('roles AS rr', 'rr.employeeid', 'b.lastupdatedby');

			if (patientid) {
				query = query.where('np.patientid', parseInt(patientid.toString()));
			}

			if (from) {
				if (to) {
					query = query.whereRaw('DATE(b.billedon) BETWEEN ? AND ?', [from, to]);
				} else {
					query = query.whereRaw('DATE(b.billedon) BETWEEN ? AND CURRENT_DATE', [from]);
				}
			}

			query = query.orderBy('b.billingid', 'desc');

			if (!isloadallBool) {
				const offset = (page - 1) * count;
				query = query.limit(count).offset(offset);
			}

			const result = await query;
			const expensesPaymentMade = await connection.raw(QUERY_EXPENSE_PAYMENTS_SUMMARY, [from, to]);
			const summary = await this.summaryRangeOfDates(tenantId, from as any, to as any, branchid);
			return { data: result, expensesPaymentMade: expensesPaymentMade[0], summary } as { data: TransactionData[], summary: any }
		} catch (err: any) {
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

	clearClientDebtBulk = async (data: PaymentRequestBody): Promise<boolean | string> => {
		const { tenantId, patientid, amount, pymode, employeeid } = data;
		const conn = await KnexConnection(tenantId);
		const trx = await conn.transaction();
		try {
			// 1. determiene if we are paying the full debt for all the oustanding debt or a transaction of a particular service
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
		} catch (err: any) {
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
		} catch (err: any) {
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
		actualRevenue: number;
		accruedRevenue: number;
		totalRefunded: number;
		totalDiscount: number;
		totalOutstanding: number;
		totalBalance: number;
		totalTaxIncurred: number;
		transactionCount: number;
		totalExpensePayments: number;
		netRevenue: number;
	}> => {
		try {
			const summary = await promisifyQuery(
				tenantId,
				`SELECT 
					COUNT(*) as transactionCount,
					COALESCE(SUM(totalcost), 0) as total_cost,
					COALESCE(SUM(paid), 0) as actual_revenue,
					COALESCE(SUM(payable), 0) as accrued_revenue,
					COALESCE(SUM(totalrefunded), 0) as total_refunded,
					COALESCE(SUM(discount), 0) as total_discount,
					COALESCE(SUM(outstanding), 0) as total_outstanding,
					COALESCE(SUM(balance), 0) as total_balance,
					COALESCE(SUM(amountIncurredDueTax), 0) as total_tax_incurred,
					(SELECT COALESCE(SUM(amount), 0) FROM expense_payments WHERE DATE(payment_date) BETWEEN ? AND ? AND status = 'Paid' AND COALESCE(is_reversed, 0) = 0) as total_expense_payments,
					COALESCE(SUM(paid) - COALESCE((SELECT SUM(amount) FROM expense_payments WHERE DATE(payment_date) BETWEEN ? AND ? AND status = 'Paid' AND COALESCE(is_reversed, 0) = 0), 0), 0) AS net_revenue
				FROM billing 
				WHERE DATE(billedon) BETWEEN ? AND ? AND branchid = ?`,
				[from, to, from, to, from, to, branchid]
			);

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
		} catch (err: any) {
			logger.error(`Error in summaryRangeOfDates: ${err}`);
			throw new Error(`Failed to get summary for date range: ${err.message}`);
		}
	}

}

export default Payment;
