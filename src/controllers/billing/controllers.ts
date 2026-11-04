import { Request, Response } from "express";
import { customError, responseError } from "../../hooks/helper";
import { Billing } from "../../../obso/billing";
import { TBillingData } from "../../models/billing/billingclientTypes";
import { Refund } from "../../models/billing/RefundClass";
import { BillingRefundService } from '../../models/billing/BillingRefundService';
import { wrapperTryCatch } from "../../models/generics/trycatch";
import { OperationsFailures } from "../../models/operations/types";
import { IDetermineStageOfRefund, RefundRequestBodyParams, UpdatePreviousWitnessNoteBodyParams, updateRefundCashRequestBodyType } from "./sales/type";
import logger from "../../hooks/logger";
import { BillingUpdateRepo } from "../../models/billing/billing_update";
import { WriteOff } from "../../models/billing/WriteOff";
import { PrimeBillingEnterprise } from "../../models/billing/multi/PrimeBillingEnterprise";
import OutstandingClass from "../../models/billing/outstanding/outstanding_class";
import { MultiTBillingDataShared } from "../../models/billing/multi/billing_shared_types";
import KnexConnection from "../../database/KnexConnections";
import { NotificationDispatcher } from "../../models/application/notifications/services/NotificationDispatcher";
import { getAuthUser } from '../../middleware/authority';
import { roleAllowed } from '../../middleware/roles';
import { minorUnits } from '../../accountingModule/utils/money';




export async function outstandingReport(request: Request<{}, {}, {}, { tenantId: string, startdate: string, enddate: string }>, response: Response) {
	try {
		const { tenantId } = request.query;
		const tenantIdP = parseInt(tenantId.toString(), 10);
		const { startdate, enddate } = request.query as { startdate: string, enddate: string };
		const result = await new OutstandingClass(tenantIdP).combinedOutstandingReport(startdate, enddate);
		response.send({ result });
	} catch (err) {
		console.log(err);
		responseError(response);
	}
}

export async function outstandingByServiceCategoryReport(request: Request<{}, {}, {}, { tenantId: string, startdate: string, enddate: string, serviceCategory: string, organizationId?: string }>, response: Response) {
	try {
		const { tenantId, startdate, enddate, serviceCategory, organizationId } = request.query;
		if (!serviceCategory) {
			return customError("Service category is required", 400, response);
		}
		const tenantIdP = parseInt(tenantId.toString(), 10);
		const result = await new OutstandingClass(tenantIdP).getOutstandingBySpecificServiceCategory(startdate, enddate, serviceCategory, organizationId);
		response.send({ result });
	} catch (err) {
		console.log(err);
		responseError(response);
	}
}

export async function handleMultiUpdateBilling(request: Request<{}, {}, { patientid: number }, { tenantId: string, billingid: string }>, response: Response) {
	async function validate() {
		if (!request.body || !request.body.patientid) {
			return customError(OperationsFailures.invalidResponseBodyParams, 404, response);
		}
		const { tenantId } = request.query;
		const tenantIdP = parseInt(tenantId.toString());
		const actor = getAuthUser(request as unknown as Request);
		if (!actor || actor.tenantId !== tenantIdP) return customError('Tenant access denied', 403, response);

		let bill = await BillingUpdateRepo.updateBillingTransaction(tenantIdP, parseInt(request.query.billingid.toString()),
			{ ...request.body, employeeid: actor.employeeid, branchid: actor.branch } as MultiTBillingDataShared);
		if (typeof bill === "string") {
			return customError(bill, 404, response);
		}
		response.send({ status: true, message: "Billing updated successfully" });
	}
	wrapperTryCatch(validate, (err) => console.log(err));
}








export async function canInitiateBill(request: Request<{}, {}, {}, { patientid: string, tenantId: string }>, response: Response) {
	try {
		let { patientid, tenantId } = request.query;
		if (!patientid) return customError(`Bad Request. patientid required`, 404, response);

		let ptid: any = null;
		if (typeof patientid === "string") ptid = parseInt(patientid);
		if (isNaN(ptid)) return customError("Bad Request.patientid must a number", 400, response);
		const BillingClass = new Billing(ptid);
		const tenantIdP: number = parseInt(tenantId.toString(), 10);

		const canBill = await BillingClass.haveBeenBilledToday(tenantIdP, ptid);
		const billingid = await BillingClass.getClientTodayBillingid(tenantIdP, ptid);
		response.send({ canInitiateBill: canBill, billingid });
	} catch (err) {
		responseError(response);
	}
}

export async function getSavedCLientBillingInformation(request: Request<{}, {}, {}, { billingid: string, tenantId: string }>, response: Response) {
	try {
		const { billingid, tenantId } = request.query;
		const tenantIdP: number = parseInt(tenantId.toString(), 10);
		const billingClass = await new Billing(0).getClientBillingInformation(tenantIdP, parseInt(billingid.toString()));
		response.send({ result: billingClass })
	} catch (err) {
		console.log(err)
		responseError(response);
	}
}




export async function determineStageOfRefundRequestHandler(request: Request<{}, {}, IDetermineStageOfRefund, { tenantId: string }>, response: Response) {
	try {
		const { tenantId } = request.query
		const tenantIdP: number = parseInt(tenantId.toString(), 10);
		const result = await new Billing(0).determineStageOfRefundRequest(tenantIdP, { ...request.body, serviceCategoryName: request.body.serviceCategory as any });
		response.send({ stage: result });
	} catch (err) {

	}
}

export async function requestForRefundHandler(request: Request<{}, {}, RefundRequestBodyParams, { tenantId: string | number }>, response: Response) {
	try {
		const { billingid, serviceid, employeeid, refundMessage } = request.body;
		const parsedServiceId = parseInt(serviceid?.toString() || '0', 10);
		const parsedEmployeeId = parseInt(employeeid?.toString() || '0', 10);
		const parsedBillingId = parseInt(billingid?.toString() || '0', 10);
		const cleanReason = refundMessage ? refundMessage.toString().trim() : '';

		if (!parsedServiceId || !parsedEmployeeId || cleanReason.length < 3) {
			return customError("Please provide a valid service ID, employee ID, and reason for refund (at least 3 characters)", 400, response);
		}

		const tenantId = parseInt(request.query.tenantId.toString(), 10);
		const result = await Refund.requestForServicesAsRefundWitness(tenantId, parsedEmployeeId, parsedServiceId, cleanReason, undefined, getAuthUser(request as unknown as Request)?.role);

		if (result === OperationsFailures.allWitnessesAssigned) {
			return customError("A refund request has already been submitted for this service", 400, response);
		}

		if (typeof result === 'string') {
			return customError(result, 400, response);
		}

		if (result) {
			NotificationDispatcher.dispatch(tenantId, 'REFUND_REQUESTED', { billingId: parsedBillingId }, parsedEmployeeId).catch(() => { });
		}

		response.send({ status: true, message: "Request for refund submitted successfully" });
	} catch (err) {
		responseError(response);
	}
}



export async function updateBilledTransaction(request: Request<{}, {}, { isConditionsUnderstood: boolean }, { billingid: string, tenantId: string }>, response: Response): Promise<void> {
	try {
		const { billingid, tenantId } = request.query;
		const billId = parseInt(billingid.toString());
		const tenantIdP: number = parseInt(tenantId.toString(), 10);
		const actor = getAuthUser(request as unknown as Request);
		if (!actor || actor.tenantId !== tenantIdP) { customError('Tenant access denied', 403, response); return; }
		const isConditionsUnderstood = request.body.isConditionsUnderstood;
		if (!isConditionsUnderstood) {
			response.send({
				status: 'pending verification',
				message: `Changing or upating transactions might affect the billing and refunding process. Also upating records with a referer different from the original 
				transaction might lead to data overwritten in favor of this current Transaction. Please ensure you understand the implications of this action before proceeding.`
			})
		} else {
			await BillingUpdateRepo.updateBillingTransaction(tenantIdP, billId, { ...request.body, employeeid: actor.employeeid, branchid: actor.branch } as any);
			NotificationDispatcher.dispatch(tenantIdP, 'INVOICE_UPDATED', { billingId: billId }).catch(() => { });
			response.send({ status: true });
		}
	} catch (err) {
		responseError(response);
	}
}



export async function getAlRefundsPaginationHandler(request: Request<{}, {}, {}, {
	status: "completed" | "pending",
	count?: string,
	page?: string,
	sortby?: 'ASC' | 'DESC',
	orderDirection?: 'ASC' | 'DESC',
	tenantId: string,
	employeeid: number
}>, response: Response) {
	const { status, employeeid, sortby, orderDirection } = request.query;
	const parsedPage = request.query.page ? parseInt(request.query.page.toString(), 10) : 1;
	const parsedCount = request.query.count ? parseInt(request.query.count.toString(), 10) : 10;
	const parsedEmployeeId = parseInt(employeeid?.toString() || '0', 10);
	const direction = (sortby || orderDirection || 'DESC').toString().toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

	if (!status || !["pending", "completed"].includes(status)) {
		return customError(OperationsFailures.invalidResquestQuery + " right status not included", 404, response);
	}

	try {
		const tenantId: number = parseInt(request.query.tenantId.toString(), 10);
		const result = await Refund.getAllRefundsWithPagination(tenantId, status, parsedCount, parsedPage, direction, parsedEmployeeId);
		response.send({ result });
	} catch (err) {
		responseError(response);
	}
}



export async function updateWitnessWitnessNote(request: Request<{}, {}, UpdatePreviousWitnessNoteBodyParams, { tenantId: string }>, response: Response) {
	try {
		const tenantId: number = parseInt(request.query.tenantId.toString(), 10);
		const { witnesses, serviceid } = request.body;

		if (witnesses.length === 0) {
			return customError(OperationsFailures.invalidResponseBodyParams + " witnesses not added", 404, response);
		}

		const witnessData = witnesses[0];
		const { employeeid, message, witness } = witnessData;

		if (!["firstWitness", "secondWitness", "thirdWitness"].includes(witness)) {
			const parseEmployeeid = parseInt(employeeid.toString());
			const parseServicedId = parseInt(serviceid.toString());
			const addNewWitness = await Refund.requestForServicesAsRefundWitness(tenantId, parseEmployeeid, parseServicedId, message, undefined, getAuthUser(request)?.role);

			let Responsemessage = "";

			if (typeof addNewWitness == "string") {
				if (addNewWitness === OperationsFailures.resourceExist) {
					Responsemessage = "You already witnessed for this request for refund";
				}

				if (addNewWitness === OperationsFailures.nopermissiontobethirdwitness) {
					Responsemessage = OperationsFailures.nopermissiontobethirdwitness
				}
			}
			return response.send({ status: typeof addNewWitness == "string" ? false : addNewWitness, message: Responsemessage });
		}

		const updateMessage = await Refund.updateWitnessStatus(tenantId, witness, serviceid, employeeid, message)
		return response.send({ status: updateMessage })
	} catch (err: any) {
		logger.log(err);
		responseError(response);
	}
}


export async function approveRequestForRefund(request: Request<{}, {}, { serviceid: number, employeeid: number, isApprove: '0' | "1", }, { tenantId: string }>, response: Response) {
	try {
		const { serviceid, employeeid, isApprove } = request.body;
		const parsedApproveStatement = parseInt(isApprove);

		if (isNaN(parsedApproveStatement)) {
			return customError(OperationsFailures.invalidResponseBodyParams + ' invalid approval status proved', 404, response);
		}
		if (!serviceid || !employeeid || isNaN(serviceid) || isNaN(employeeid)) {
			return customError(OperationsFailures.invalidResponseBodyParams + ' serviceid and employeeid must be numbers', 404, response);
		}
		const tenantId: number = parseInt(request.query.tenantId.toString(), 10);
		const isAprovalSuccess = await Refund.approveRequestedRefund(tenantId, serviceid, employeeid, parsedApproveStatement);
		if (isAprovalSuccess) {
			const eventCode = parsedApproveStatement === 1 ? 'REFUND_APPROVED' : 'REFUND_REJECTED';
			NotificationDispatcher.dispatch(tenantId, eventCode, { serviceId: serviceid }, employeeid).catch(() => { });
		}
		response.send({ status: isAprovalSuccess });
	} catch (err) {
		responseError(response);
	}
}


export async function requestForRefundCashIssueOut(
	request: Request<{}, {}, updateRefundCashRequestBodyType, { tenantId: string }
	>,
	response: Response
) {
	try {
		const actor = getAuthUser(request);
		if (!actor) return response.status(401).send({ status: false, message: 'Authentication required' });
		if (!roleAllowed(actor.role, ['admin', 'manager', 'accountant', 'cashier'])) return response.status(403).send({ status: false, message: 'Refund payment access denied' });
		const { serviceid, refundAmount, billingid } = request.body;
		const rawPaymentMode: unknown = request.body.selectedPaymentMode;
		const selectedPaymentMode = typeof rawPaymentMode === 'number' || (typeof rawPaymentMode === 'string' && /^\d+$/.test(rawPaymentMode)) ? Number(rawPaymentMode) : NaN;
		const employeeid = actor.employeeid;
		if (![serviceid, selectedPaymentMode, billingid].every(value => Number.isSafeInteger(value) && value > 0) ||
			typeof refundAmount !== 'number' || !Number.isFinite(refundAmount) || refundAmount <= 0) {
			return customError(OperationsFailures.invalidResponseBodyParams, 400, response);
		}
		try { minorUnits(refundAmount); } catch { return customError('Invalid refund amount', 400, response); }
		const tenantId: number = parseInt(request.query.tenantId.toString(), 10);
		if (tenantId !== Number(actor.tenantId)) return response.status(403).send({ status: false, message: 'Tenant access denied' });
		const result = await Refund.issueOutCashOutOfRefund(tenantId, { ...request.body, employeeid, selectedPaymentMode, branchid: actor.branch });
		const isCashoutDocumented = result === true;
		if (!isCashoutDocumented) return response.status(400).send({ status: false, message: typeof result === 'string' ? result : 'Service refund failed' });

		if (isCashoutDocumented) {
			NotificationDispatcher.dispatch(tenantId, 'REFUND_PROCESSED', { serviceId: serviceid }, employeeid).catch(() => { });
			NotificationDispatcher.dispatch(tenantId, 'PAYMENT_REFUNDED', { serviceId: serviceid }, employeeid).catch(() => { });
		}

		response.send({
			status: isCashoutDocumented,
			message: isCashoutDocumented ? 'Service refunded successfully' : 'Service refund failed',
		});
	} catch (err) {
		console.log(err)
		responseError(response);
	}
}




export async function verificationBeforeCashoutHandler(request: Request<{}, {}, {}, { serviceid: number | string, billingid: number, tenantId: string }>, response: Response) {
	try {
		const { serviceid, billingid } = request.query
		if (!serviceid || !billingid) {
			return customError(OperationsFailures.invalidResquestQuery + " serviceid  and billingid required", 404, response);
		}
		if (isNaN(parseInt(serviceid.toString())) || isNaN(parseInt(billingid.toString()))) {
			return customError(OperationsFailures.invalidResquestQuery + " serviceid must be a number", 404, response);
		}
		const serviceId = parseInt(serviceid.toString());
		const billinId = parseInt(billingid.toString());
		const tenantId: number = parseInt(request.query.tenantId.toString(), 10);
		const refundInformation = await Refund.refundVerification(tenantId, serviceId, billinId);
		if (typeof refundInformation == "string") {
			return response.status(400).send({
				status: false,
				message: refundInformation
			});
		}
		response.send(refundInformation);
	} catch (err) {
		console.log(err)
		logger.error(err);
		responseError(response);
	}
}


export async function getTransactionBillDataHandler(request: Request<{}, {}, {}, { billingid: number, tenantId: string }>, response: Response) {
	try {
		const { billingid, tenantId } = request.query;
		if (!billingid) {
			return customError(OperationsFailures.invalidResquestQuery + " billingid required", 404, response);
		}
		const billId = parseInt(billingid.toString());
		const tenantIdP: number = parseInt(tenantId.toString(), 10);
		const billData = await new Billing(0).getTransactionBillData(tenantIdP, billId);
		response.send({ result: billData });
	} catch (err) {
		responseError(response);
	}
}


export async function refundAllTransactionHandler(request: Request<{ selectedPaymentMode: number, billingid: number, employeeid: number }, {}, {},
	{ tenantId: string, reason: string }>, response: Response) {
	const { billingid, employeeid, selectedPaymentMode } = request.params
	const isAllNumber = !isNaN(billingid) && !isNaN(employeeid) && !isNaN(selectedPaymentMode);

	if (!billingid || !selectedPaymentMode || !employeeid || !isAllNumber) return customError(OperationsFailures.invalidResponseBodyParams, 404, response);
	const tenantId = parseInt(request.query.tenantId.toString());
	const reason = request.query.reason || "No reason provided";
	try {
		const actor = getAuthUser(request as unknown as Request);
		if (!actor || actor.tenantId !== tenantId) return customError('Tenant access denied', 403, response);
		const isRefunded = await new BillingRefundService(tenantId).refund({ billingid: Number(billingid),
			employeeid: actor.employeeid, branchid: actor.branch, selectedPaymentMode: Number(selectedPaymentMode),
			request_key: `refund-all-billing-${billingid}`, all: true, reason: reason.toString() });
		response.send({ status: isRefunded })
	} catch (error) {
		console.error("Error processing refund:", error);
		return customError(OperationsFailures.internalServerError, 500, response);
	}
}


export async function getServiceRefundItem(request: Request<{}, {}, {}, { serviceid: number, employeeid: number, tenantId: string }>, response: Response) {
	try {
		const { serviceid, employeeid } = request.query;
		if (!serviceid) {
			return customError(OperationsFailures.invalidResquestQuery + " serviceid required", 404, response);
		}
		const servicedID = parseInt(serviceid.toString());
		const tenantId: number = parseInt(request.query.tenantId.toString(), 10);
		const refundData = await Refund.getAserviceRefundDetails(tenantId, servicedID, employeeid)
		response.send({ result: refundData });
	} catch (err) {
		responseError(response);
	}
}


export async function WriteOffTransaction(request: Request<{}, {}, { billingid: number, reason: string, employeeid: number }, { tenantId: string, reason: string }>, response: Response) {
	try {
		const { tenantId } = request.query;
		const tenantIdP = parseInt(tenantId.toString());
		const { billingid, reason, employeeid } = request.body;

		if (!billingid || !reason || !employeeid) {
			return customError(OperationsFailures.invalidResponseBodyParams, 404, response);
		}
		const result = await WriteOff.writeOffTransaction(tenantIdP, billingid, employeeid, reason);
		if (typeof result === "string") return response.send({ status: false, message: result });
		if (!result) return customError("Write off failed", 404, response);
		response.send({ status: true });
	} catch (err) {
		console.log(err)
		responseError(response);
	}
}

export async function listDiscountLimitRules(request: Request<{}, {}, {}, { tenantId: string }>, response: Response) {
	try {
		const tenantIdP = parseInt(request.query.tenantId.toString(), 10);
		const conn = await KnexConnection(tenantIdP);
		const rules = await conn('discount_limit_rules').select('*').orderBy('role', 'asc');
		response.send({ status: true, rules });
	} catch (err) {
		responseError(response, err);
	}
}

export async function upsertDiscountLimitRule(request: Request<{}, {}, any, { tenantId: string }>, response: Response) {
	try {
		const tenantIdP = parseInt(request.query.tenantId.toString(), 10);
		const {
			role,
			is_active,
			max_discount_per_transaction,
			min_transaction_total_for_discount,
			max_discount_per_day,
			max_surcharge_per_transaction,
			min_transaction_total_for_surcharge,
			max_surcharge_per_day,
			updated_by_employeeid
		} = request.body || {};

		if (!role || typeof role !== 'string') {
			return customError('role is required', 400, response);
		}

		const normalizedRole = role.trim().toLowerCase().replace(/\s+/g, ' ');
		const conn = await KnexConnection(tenantIdP);
		const allowedRoles = new Set([
			'crm',
			'customer representative',
			'customer service representative',
			'manager',
			'accountant',
			'admin',
			'super-admin',
			'superadmin',
			'super admin'
		]);
		if (!allowedRoles.has(normalizedRole)) {
			return customError('role is not allowed for discount rules', 400, response);
		}

		const existingRoles = await conn('roles').distinct('role as role');
		const existingSet = new Set((existingRoles || []).map((r: any) => String(r.role || '').trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean));
		if (!existingSet.has(normalizedRole)) {
			return customError('role not found in system roles', 400, response);
		}

		const payload = {
			role: normalizedRole,
			is_active: typeof is_active === 'boolean' ? is_active : true,
			max_discount_per_transaction: max_discount_per_transaction ?? null,
			min_transaction_total_for_discount: min_transaction_total_for_discount ?? null,
			max_discount_per_day: max_discount_per_day ?? null,
			max_surcharge_per_transaction: max_surcharge_per_transaction ?? null,
			min_transaction_total_for_surcharge: min_transaction_total_for_surcharge ?? null,
			max_surcharge_per_day: max_surcharge_per_day ?? null,
			updated_by_employeeid: updated_by_employeeid ?? null,
			updated_at: conn.fn.now()
		};

		await conn('discount_limit_rules')
			.insert({ ...payload, created_at: conn.fn.now() })
			.onConflict(['role'])
			.merge(payload as any);

		response.send({ status: true });
	} catch (err) {
		responseError(response, err);
	}
}

export async function getDiscountDailyUsage(request: Request<{}, {}, {}, { tenantId: string; date?: string; count?: number; page?: number; employeeid?: string; role?: string, interestedUserId?: string }>, response: Response) {
	try {
		const tenantIdP = parseInt(request.query.tenantId.toString(), 10);
		const conn = await KnexConnection(tenantIdP);
		const count = request.query.count ? parseInt(String(request.query.count), 10) : 20;
		const page = request.query.page ? parseInt(String(request.query.page), 10) : 1;

		const date = request.query.date ? String(request.query.date) : null;
		const role = request.query.role ? String(request.query.role).trim().toLowerCase().replace(/\s+/g, ' ') : null;
		const interestedUserId = request.query.interestedUserId ? parseInt(String(request.query.interestedUserId), 10) : null;

		const q = conn('discount_daily_usage').select('*')
			.orderBy('usage_date', 'desc');

		if (interestedUserId) q.where('employeeid', interestedUserId);
		if (date) q.where('usage_date', date)
		if (role) q.where('role', role);

		if (page && count) {
			q.offset((page - 1) * count).limit(count);
		}

		const usage = await q;
		response.send({ status: true, usage });
	} catch (err) {
		responseError(response, err);
	}
}
