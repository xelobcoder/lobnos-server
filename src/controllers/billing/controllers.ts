import { Request, Response } from "express";
import { customError, responseError } from "../../hooks/helper";
import { Billing } from "../../models/billing/billing";
import { billErrors } from "../../models/billing/billingclientTypes";
import { Refund } from "../../models/billing/RefundClass";
import { wrapperTryCatch } from "../../models/generics/trycatch";
import { OperationsFailures } from "../../models/operations/types";
import { RefundRequestBodyParams, UpdatePreviousWitnessNoteBodyParams, updateRefundCashRequestBodyType } from "./sales/type";
import logger from "../../hooks/logger";
import { MultiBillingRepo } from "../../models/billing/billnew";
import { BillingUpdateRepo } from "../../models/billing/billing_update";
import { WriteOff } from "../../models/billing/WriteOff";
import { PrimeBillingEnterprise } from "../../models/billing/multi/PrimeBillingEnterprise";

export async function handleNewBilling(request: Request, response: Response) {
	async function validate() {
		const { patientid } = request.body;
		const { tenantId } = request.query;
		const tenantIdP = parseInt(tenantId.toString());

		let bill = await new Billing(patientid).BillNewTransaction(tenantIdP,
			request.body);
		if (typeof bill == "string" && bill == billErrors.already) {
			return response.send({ message: bill, statusCode: 200, status: "success" });
		} else if (bill && typeof bill == "number") {
			return response.send({ message: "billing successfully", statusCode: 200, status: "success", billingid: bill });
		} else {
			return customError(bill as string || billErrors.error, 400, response);
		}
	}
	wrapperTryCatch(validate, (err) => console.log(err));
}


export async function handleMultiNewBilling(request: Request, response: Response) {
	async function validate() {
		if (!request.body || !request.body.patientid) {
			return customError(OperationsFailures.invalidResponseBodyParams, 404, response);
		}
		const { tenantId } = request.query;
		const tenantIdP = parseInt(tenantId.toString());

		let bill = await new MultiBillingRepo(tenantIdP).billNewTransaction(request.body);
		if (typeof bill === "string") {
			return customError(bill, 404, response);
		} else if (typeof bill === "number") {
			return response.send({ status: true, message: "Billing created successfully", billingid: bill });
		} else {
			return customError("An error occurred while processing the billing", 500, response);
		}
	}
	wrapperTryCatch(validate, (err) => console.log(err));
}


export async function handleMultiUpdateBilling(request: Request, response: Response) {
	async function validate() {
		if (!request.body || !request.body.patientid) {
			return customError(OperationsFailures.invalidResponseBodyParams, 404, response);
		}
		const { tenantId } = request.query;
		const tenantIdP = parseInt(tenantId.toString());

		let bill = await BillingUpdateRepo.updateBillingTransaction(tenantIdP, parseInt(request.query.billingid.toString()), request.body);
		if (typeof bill === "string") {
			return customError(bill, 404, response);
		}
		response.send({ status: true, message: "Billing updated successfully" });
	}
	wrapperTryCatch(validate, (err) => console.log(err));
}



export async function handleEmailReceiptSending(request: Request<{ billingid: number, patientid: number }>, response: Response) {
	try {
		const { patientid, billingid } = request.params
		if (!patientid || !billingid || isNaN(patientid) || isNaN(billingid)) {
			response.status(404).json({ message: OperationsFailures.invalidResponseBodyParams })
		} else {
			const { tenantId } = request.query;
			const tenantIdP = parseInt(tenantId.toString());
			const emailSendingResponseStatus = await Billing.getReceiptPdfExternalSystem(tenantIdP, billingid, patientid);
			response.send({ status: emailSendingResponseStatus })
		}
	} catch (err) {
		console.log(err);
	}
}




export async function canInitiateBill(request: Request, response: Response) {
	try {
		let { patientid, tenantId } = request.query;
		if (!patientid) return customError(`Bad Request. patientid required`, 404, response);

		let ptid: number;
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

export async function getSavedCLientBillingInformation(request: Request, response: Response) {
	try {
		const { billingid, tenantId } = request.query;
		const tenantIdP: number = parseInt(tenantId.toString(), 10);
		const billingClass = await new Billing(null).getClientBillingInformation(tenantIdP, parseInt(billingid.toString()));
		response.send({ result: billingClass })
	} catch (err) {
		console.log(err)
		responseError(response);
	}
}




export async function determineStageOfRefundRequestHandler(request: Request, response: Response) {
	try {
		const { tenantId } = request.query
		const tenantIdP: number = parseInt(tenantId.toString(), 10);
		const result = await new Billing(null).determineStageOfRefundRequest(tenantIdP, { ...request.body, serviceCategoryName: request.body.serviceCategory });
		response.send({ stage: result });
	} catch (err) {

	}
}

export async function requestForRefundHandler(request: Request<{}, {}, RefundRequestBodyParams>, response: Response) {
	try {
		const { categoryTrackId, billingid, serviceid, employeeid, taxIncluded, refundMessage, trackId } = request.body;

		const isValidRequestBody = categoryTrackId && !isNaN(categoryTrackId)
			&& billingid && !isNaN(billingid) && employeeid && !isNaN(employeeid) && [1, 0].includes(taxIncluded) && refundMessage && refundMessage.toString().length > 3

		if (isValidRequestBody) {
			const tenantId: number = parseInt(request.query.tenantId.toString(), 10);
			const result = await Refund.initiateRefundofServices(tenantId, employeeid, serviceid, refundMessage);
			response.send({ status: result });
		} else {
			return customError(OperationsFailures.invalidResponseBodyParams, 404, response);
		}
	} catch (err) {
		console.log(err);
		responseError(response);
	}
}



export async function updateBilledTransaction(request: Request, response: Response): Promise<void> {
	try {
		const { billingid, tenantId } = request.query;
		const billId = parseInt(billingid.toString());
		const tenantIdP: number = parseInt(tenantId.toString(), 10);
		const isConditionsUnderstood = request.body.isConditionsUnderstood;
		if (!isConditionsUnderstood) {
			response.send({
				status: 'pending verification',
				message: `Changing or upating transactions might affect the billing and refunding process. Also upating records with a referer different from the original 
				transaction might lead to data overwritten in favor of this current Transaction. Please ensure you understand the implications of this action before proceeding.`
			})
		} else {
			const outcome = await new Billing(null).updatePreviousTransaction(tenantIdP, request.body, billId);
			response.send({ status: outcome });
		}
	} catch (err) {
		responseError(response);
	}
}



export async function getAlRefundsPaginationHandler(request: Request<{}, {}, {}, {
	status: "completed" | "pending",
	count: string,
	page: string,
	orderDirection: 'ASC' | 'DESC',
	tenantId: string,
	employeeid: number
}>, response: Response) {
	const { page = 10, count = 1, status, employeeid, orderDirection } = request.query;
	const parsedPage = parseInt(page.toString());
	const parsedCount = parseInt(count.toString());

	if (!status || !["pending", "completed"].includes(status)) {
		return customError(OperationsFailures.invalidResquestQuery + " right status not included", 404, response);
	}

	try {
		const tenantId: number = parseInt(request.query.tenantId.toString(), 10);
		const result = await Refund.getAllRefundsWithPagination(tenantId, status, parsedCount, parsedPage, orderDirection, employeeid);
		response.send({ result })
	} catch (err) {
		responseError(response);
	}
}



export async function updateWitnessWitnessNote(request: Request<{}, {}, UpdatePreviousWitnessNoteBodyParams>, response: Response) {
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
			const addNewWitness = await Refund.requestForServicesAsRefundWitness(tenantId, parseEmployeeid, parseServicedId, message);

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
	} catch (err) {
		logger.log(err);
		responseError(response);
	}
}


export async function approveRequestForRefund(request: Request<{}, {}, { serviceid: number, employeeid: number, isApprove: '0' | "1" }>, response: Response) {
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
		response.send({ status: isAprovalSuccess });
	} catch (err) {
		responseError(response);
	}
}


export async function requestForRefundCashIssueOut(
	request: Request<{}, {}, updateRefundCashRequestBodyType
	>,
	response: Response
) {
	try {
		const { serviceid, employeeid, selectedPaymentMode, refundAmount } = request.body;

		if (!serviceid || !employeeid || typeof serviceid !== 'number' || typeof employeeid !== 'number' || !selectedPaymentMode || !refundAmount) {
			return customError(OperationsFailures.invalidResponseBodyParams, 404, response);
		}
		const tenantId: number = parseInt(request.query.tenantId.toString(), 10);
		const isCashoutDocumented = await Refund.issueOutCashOutOfRefund(tenantId, request.body);

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
			return {
				status: false,
				message: refundInformation
			}
		}
		response.send(refundInformation);
	} catch (err) {
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
		const billData = await new Billing(null).getTransactionBillData(tenantIdP, billId);
		response.send({ result: billData });
	} catch (err) {
		responseError(response);
	}
}


export async function refundAllTransactionHandler(request: Request<{ selectedPaymentMode: number, billingid: number, employeeid: number }>, response: Response) {
	const { billingid, employeeid, selectedPaymentMode } = request.params
	const isAllNumber = !isNaN(billingid) && !isNaN(employeeid) && !isNaN(selectedPaymentMode);

	if (!billingid || !selectedPaymentMode || !employeeid || !isAllNumber) return customError(OperationsFailures.invalidResponseBodyParams, 404, response);
	const tenantId = parseInt(request.query.tenantId.toString());
	try {
		const isBillLocked = await PrimeBillingEnterprise.isBillingLocked(tenantId, billingid);
		if (isBillLocked) return customError("Billing is  locked, cannot proceed with refund", 400, response);

		const isRefunded = await WriteOff.refundCompletelyTransaction(tenantId, employeeid, billingid, selectedPaymentMode);
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
		console.log(err)
		responseError(response);
	}
}


export async function WriteOffTransaction(request: Request, response: Response) {
	try {
		const { tenantId } = request.query;
		const tenantIdP = parseInt(tenantId.toString());
		const { billingid, reason, employeeid } = request.body;

		if (!billingid || !reason || !employeeid) return customError(OperationsFailures.invalidResponseBodyParams, 404, response);
		const result = await WriteOff.writeOffTransaction(tenantIdP, billingid, reason, employeeid);

		if (typeof result === "string") return response.send({ status: false, message: result });
		if (!result) return customError(OperationsFailures.notFound, 404, response);
		response.send({ status: true });
	} catch (err) {
		responseError(response);
	}
}