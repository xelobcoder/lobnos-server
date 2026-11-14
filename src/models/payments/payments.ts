import { SalesExpensesReportService } from '../billing/sales/SalesExpensesReport';

import { queries } from "./queries";
import { TransactionRecord, TransactionData, ClientDebtTransaction } from "./interfaces";
import logger from "../../hooks/logger";
import { paginationQuery, promisifyQuery, rowAffected, customError } from "../../hooks/helper";
import { billErrors } from "../billing/billingclientTypes";
import KnexConnection from "../../database/KnexConnections";
import { QUERY_EXPENSE_PAYMENTS_SUMMARY } from "../../controllers/billing/sales/Extensive/queries";
import { applyDboservicesAfterUpdate } from "../../database/appLevelTriggers";
import { enqueueBillingPayment } from "../../accountingModule/integrations/BillingAccounting";



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
			// A stale or cross-facility branch link must fail as a clear 404, not as a 500 from a
			// downstream sales-summary query.
			const branchId = Number(branchid);
			if (!Number.isSafeInteger(branchId) || branchId <= 0) {
				throw Object.assign(new Error('Invalid branch'), { statusCode: 400, code: 'INVALID_BRANCH' });
			}
			const branch = await connection('branch').where({ branchid: branchId }).first('branchid');
			if (!branch) throw Object.assign(new Error('Branch not found'), { statusCode: 404, code: 'BRANCH_NOT_FOUND' });
			let query = connection
				.select(
					'np.patientid',
					'np.fullpatientid',
					's.serviceAddedOn AS billedon',
					connection.raw(`CASE WHEN s.status IN ('refunded','voided') THEN s.status ELSE 
					'active' END AS status`),
					's.serviceCategory',
                    connection.raw("GROUP_CONCAT(DISTINCT s.registrationType ORDER BY s.registrationType SEPARATOR ', ') AS registrationType"),
					'b.billingid',
					'rr.username AS salesperson',
					connection.raw("CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname) AS fullname"),
					'np.email',
					connection.raw("CONCAT('0', np.mobile_number) AS mobileNumber"),
					connection.raw('SUM(COALESCE(s.totalcost, 0)) AS totalcost'),
					connection.raw("SUM(COALESCE(s.discount, 0)) AS discount"),
					connection.raw("SUM(COALESCE(s.paidamount, 0)) AS paidamount"),
					connection.raw("SUM(COALESCE(s.foc_amount, 0)) AS foc_amount"),
					connection.raw("MAX(COALESCE(s.foc_transaction_id, 0)) AS foc_transaction_id"),
					connection.raw("SUM(COALESCE(s.totalpayable, 0)) AS totalpayable"),
					connection.raw("SUM(COALESCE(s.outstanding, 0)) AS outstanding"),
					connection.raw('SUM(COALESCE(s.amountIncurredDueTax, 0)) AS amountIncurredDueTax'),
					connection.raw('SUM(COALESCE(r.amountRefunded, 0)) AS totalRefunded'),
					connection.raw(`CASE WHEN userAdjustmentType IS NOT NULL AND userAdjustmentType='surcharge'
					  THEN SUM(COALESCE(s.userAdjustedValue, 0))
					  ELSE 0
					END AS surcharge`),
					connection.raw("SUM(COALESCE(s.amountwrittenoff ,0)) AS writeoff"),
					's.paymentstatus',

					connection.raw("(SELECT serviceCategory FROM \`dboservices\` WHERE billingid = b.billingid LIMIT 1) AS billingSource")
				)
				.from('new_patients AS np')
				.innerJoin('billing AS b', 'np.patientid', 'b.patientid')
				.innerJoin("dboservices AS s", 's.billingid', 'b.billingid')
				.innerJoin('roles AS rr', 'rr.employeeid', 'b.lastupdatedby')
				.leftJoin(connection('dbobillingrefundtable').select('serviceid').sum('amountRefunded as amountRefunded').groupBy('serviceid').as('r'), 'r.serviceid', 's.serviceid')
               .where('s.branchid',Number(branchid))
               .where('b.branchid',Number(branchid))
               .where(function () {
                    this.where('s.isDeleted', 0).orWhereNull('s.isDeleted').orWhereNotExists(function () {
                         this.select(connection.raw('1')).from('dboservices as live')
                              .whereRaw('live.billingid = s.billingid AND live.branchid = s.branchid')
                              .where(function () {
                                   this.where('live.isDeleted', 0).orWhereNull('live.isDeleted');
                              });
                    });
               })

			if (patientid) {
				query = query.where('np.patientid', parseInt(patientid.toString()));
			}

			if (from) {
				if (to) {
					query = query.whereRaw('DATE(s.serviceAddedOn) BETWEEN ? AND ?', [from, to]);
				} else {
					query = query.whereRaw('DATE(s.serviceAddedOn) BETWEEN ? AND CURRENT_DATE', [from]);
				}
			}
			query = query.groupBy('b.billingid');
			query = query.orderBy('b.billingid', 'desc');

			if (!isloadallBool) {
				const offset = (page - 1) * count;
				query = query.limit(count).offset(offset);
			}

			const result = await query;
               const rangeFrom=from||'1000-01-01',rangeTo=to||'9999-12-30';
			const expensesPaymentMade = await connection.raw(QUERY_EXPENSE_PAYMENTS_SUMMARY.replace('WHERE e.date BETWEEN ? AND ?', 'WHERE DATE(p.payment_date) BETWEEN ? AND ? AND e.branchid = ?').replace('GROUP BY p.status, p.method','GROUP BY p.status, p.method, em.name'), [rangeFrom, rangeTo,Number(branchid)] as any);
			const summary = await this.summaryRangeOfDates(tenantId, rangeFrom, rangeTo, branchid);
			return { data: result, expensesPaymentMade: expensesPaymentMade[0], summary } as { data: TransactionData[], summary: any }
		} catch (err: any) {
			logger.error(err?.message || String(err), { code: err?.code, statusCode: err?.statusCode });
			if (err?.statusCode) throw err;
			throw new Error(err?.message || String(err));
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
			const { paid, discount, outstanding, payable } = result[0];
			if (outstanding <= 0) {
				response.send({ status: "success", statusCode: 200, message: "Client is in good standing" });
				return;
			}
			const payAmount = Number(pay);
			if (!Number.isFinite(payAmount) || payAmount <= 0 || payAmount > Number(outstanding)) {
				throw new Error("Payment amount must be greater than zero and not exceed the outstanding balance");
			}
			const newAmount = Number(paid) + payAmount;
			const notOutstanding = payable - newAmount - discount;
			const updateQuery = queries.updatePaymentUpdate;
			const values = [notOutstanding, newAmount, billingid];
			const updateInfo = await promisifyQuery(tenantId, updateQuery, values);
			if (!rowAffected(updateInfo)) {
				throw new Error("Failed to update payment");
			}
			const inserted = await promisifyQuery(tenantId, queries.insertBillingHx, [billingid, paymentMode, payAmount]);
			if (!rowAffected(inserted)) {
				throw new Error("Failed to insert payment history");
			}
			await enqueueBillingPayment(Number(tenantId), Number(inserted.insertId), Number(billingid), payAmount, request.body?.employeeid ?? null);
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


	summaryRangeOfDates = async (tenantId: number, from: string, to: string, branchid: number): Promise<any> => {
        const rangeFrom = from || '1000-01-01';
        const rangeTo = to || '9999-12-30';
        const report = await new SalesExpensesReportService(tenantId).generate({
            branchid: String(branchid), from: rangeFrom, to: rangeTo,
        }, 'operational');
        const registered = await promisifyQuery(tenantId, `
            SELECT COUNT(DISTINCT patient.patientid) AS total_patients_registered
            FROM new_patients patient
            WHERE DATE(patient.date) BETWEEN ? AND ?
                AND EXISTS (SELECT 1 FROM billing bill WHERE bill.patientid = patient.patientid AND bill.branchid = ?)
        `, [rangeFrom, rangeTo, branchid]);
        const summary = report.summary;
        return [{
            gross_revenue: summary.grossSales,
            cash_collected: summary.receiptCredits ?? summary.receipts,
            earned_revenue: summary.netSales,
            discount: summary.discounts,
            total_refunded: summary.receiptRefunds || 0,
            total_billing: summary.transactions,
            total_patients_registered: Number(registered[0]?.total_patients_registered || 0),
            transactioncount: summary.transactions,
            expenses_paid: summary.expensePayments,
            net_operating_cash: summary.netCashMovement,
            outstanding: summary.outstanding,
        }];
    }

}

export default Payment;
