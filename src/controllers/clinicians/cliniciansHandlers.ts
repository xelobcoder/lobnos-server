import { NextFunction, Request, response, Response } from "express";
import Registration from "../../models/registration/registration";
import { Clinician } from "../../models/clincians/types";
import { responseError, customError } from "../../hooks/helper";
import logger from "../../hooks/logger";
import ClinicianClass from "../../models/clincians/clinicianClass";
import { PrimeLimsTableclinicianbasicinfo } from "../../database/DatabaseTableSchema";

export async function getCliniciansHandler(request: Request, response: Response): Promise<Response> {
	try {
		const tenantId = parseInt(request.query.tenantId.toString())
		const cliniciansList: Clinician[] = await new ClinicianClass().getClinicians(tenantId, request.query);
		return response.send({ statusCode: 200, status: "success", result: cliniciansList });
	} catch (err) {
		console.log(err);
		responseError(response);
	}
}

export const bulkInsertCliniciansHandler = async (req: Request, res: Response) => {
	try {
		const tenantId = parseFloat(req.query.tenantId as string);
		const clinicians = req.body.data as Array<Partial<PrimeLimsTableclinicianbasicinfo>>;
		if (!Array.isArray(clinicians) || clinicians.length === 0) {
			return res.status(400).json({ success: false, message: "No clinicians provided" });
		}
		const clinicianClass = new ClinicianClass();
		const results = await clinicianClass.insertCliniciansBulk(tenantId, clinicians);
		const successCount = results.filter(r => typeof r === 'number').length;
		const failCount = results.length - successCount;
		return res.status(200).json({
			success: failCount === 0,
			partialSuccess: failCount > 0 && successCount > 0,
			total: results.length,
			successCount,
			failCount,
			results
		});
	} catch (error) {
		return res.status(500).json({ success: false, message: "Bulk insert failed", error: error?.message || error });
	}
};

export async function getSingleClinicianHandler(req: Request, res: Response) {
	const { id } = req.query as { id?: string };

	if (!id) {
		return customError("clinicianid required", 404, res);
	}

	const tenantId = parseInt(req.query.tenantId.toString())

	try {
		const result = await new ClinicianClass().getSingleClinician(tenantId, parseInt(id));

		if (result) {
			return res.send({
				statusCode: 200,
				result,
				status: "success",
			});
		} else {
			return res.send({
				statusCode: 404,
				status: "error",
				message: "Clinician not found",
			});
		}
	} catch (err) {
		return res.send({
			statusCode: 500,
			status: "error",
			message: "Error fetching clinician data",
		});
	}
}


export async function putCliniciansHandler(req: Request<{}, {}, PrimeLimsTableclinicianbasicinfo>, res: Response): Promise<void> {
	try {
		const { id } = req.body;

		if (!id) customError("Clinician id not added", 404, res);
		const tenantId = parseInt(req.query.tenantId.toString())
		const isUpdated = await new ClinicianClass().putCliniciansBasic(tenantId, req.body);

		if (isUpdated) {
			res.send({
				statusCode: 200,
				message: "Clinician updated successfully",
				status: "success",
			});
		} else {
			res.send({
				statusCode: 401,
				message: "Clinician not updated",
			});
		}
	} catch (error) {
		responseError(response);
	}
}

export async function deleteCliniciansHandler(request: Request, response: Response): Promise<void> {
	try {
		const { id } = request.body;
		if (!id || isNaN(id)) {
			return customError("id required", 404, response);
		}
		const tenantId = parseInt(request.query.tenantId.toString())
		const status = await new ClinicianClass().deleteClinicians(tenantId, id);
		if (status) {
			response.send({
				statusCode: 200,
				status: "success",
				message: "Deleted successfully",
			});
		} else {
			response.send({
				statusCode: 500,
				status: "error",
				message: "Something went wrong. Wrong ID provided",
			});
		}
	} catch (error) {
		logger.error(error);
		responseError(response)
	}
}

export async function postCliniciansHandler(req: Request, res: Response): Promise<void> {
	try {
		const outcome = await new ClinicianClass().postClinicianBasicInfo({ ...req.body, tenantId: req.query.tenantId });
		if (typeof outcome !== "number" || typeof outcome === "string") {
			return customError(outcome, 404, res);
		}
		res.send({ message: "clinician added successfully", statusCode: 200, status: "success" });
	} catch (err) {
		customError("Something wrong ocured", 500, res);
	}
}


export async function verifyClinicianPhoneNumberAndEmailMiddleware(request: Request, response: Response, next: NextFunction) {
	const phone = request.body.phone;
	const email = request.body.email;
	const TenantId = request.query.tenantId;
	if (!phone) return customError("Phone number and email required", 401, response);
	const tenantIdP = parseInt(TenantId.toString());
	const clinicianClass = new ClinicianClass();
	const result = await clinicianClass.verifyClinicianPhoneNumberAndEmail(tenantIdP, email, phone);
	if (result !== true) {
		return customError(result, 401, response);
	}
	next();
}



export async function filterClinicianHandler(req: Request, res: Response): Promise<void> {
	const { data } = req.body as { data?: any };
	if (!data) {
		customError("please add data", 401, res);
		return;
	}
	try {
		const tenantId = parseInt(req.query.tenantId.toString())
		const result = await new Registration().getCustomersRecords(tenantId, data);
		res.send({ status: "success", statusCode: 200, result });
	} catch (err) {
		customError("Something wrong ocured", 500, res);
	}
}

export async function getClinicianResultHandler(req: Request, res: Response): Promise<void> {
	try {
		const { clinicianid, startdate, enddate } = req.query as { clinicianid?: string; startdate?: string; enddate?: string };
		if (!clinicianid) {
			customError("please add clinicianid", 401, res);
			return;
		}
		const tenantId = parseInt(req.query.tenantId.toString())
		const result = await new ClinicianClass().getClinicianResult(tenantId, parseInt(clinicianid), startdate, enddate);

		res.send({ status: "success", statusCode: 200, result });
	} catch (err) {
		logger.error(err);
		customError(err, 401, res);
	}
}

export async function getBillingTestBasedByClinicianHandler(req: Request, res: Response): Promise<void> {
	try {
		const { billingid, clinicianid } = req.query as { billingid?: string; clinicianid?: string };
		if (!billingid || !clinicianid) {
			customError("please add billingid and clinicianid", 401, res);
			return;
		}
		const tenantId = parseInt(req.query.tenantId.toString())
		const result = await new ClinicianClass().getBillingTestBasedByClinician(tenantId, parseInt(billingid.toString()), parseInt(clinicianid));

		res.send({ statusCode: 200, status: "success", result });
	} catch (err) {
		logger.error(err);
		customError(err?.message || "something went wrong", 500, res);
	}
}

export async function postTemporaryOrderHandler(req: Request, res: Response): Promise<void> {
	try {
		// const result = await new Registration().temporaryOrder(req.body);
		// if (result === true) {
		// 	res.send({ statusCode: 200, status: "success", message: "order added successfully" });
		// } else {
		// 	const message = result === false ? "kindly update orders in the order page" : "something went wrong while trying to add order";
		// 	customError(message, 500, res);
		// }
	} catch (err) {
		customError("Something wrong ocured", 500, res);
	}
}

export async function getTemporaryOrdersHandler(req: Request, res: Response): Promise<void> {
	const { clinicianid, target, date } = req.query as { clinicianid?: string; target?: string; date?: string };
	if (!target) {
		customError("please addd target for query ", 401, res);
		return;
	}
	try {
		// const result = await new Registration().getTemporaryOrders(target, clinicianid, date);
		// res.send({ statusCode: 200, status: "success", result });
	} catch (err) {
		customError("Something wrong ocured", 500, res);
	}
}

export async function getTemporaryOrdersProcessingHandler(req: Request, res: Response): Promise<void> {
	const { orderid } = req.query as { orderid?: string };
	if (!orderid) {
		customError("please add id", 401, res);
		return;
	}
	try {
		// const result = await  Registration.getTemporaryOrdersProcessing(orderid);
		// res.send({ statusCode: 200, status: "success", result });
	} catch (err) {
		customError("Something wrong ocured", 500, res);
	}
}

export async function postProcessedOrderHandler(req: Request, res: Response): Promise<void> {
	try {
		const {
			patientid,
			clinician,
			organization,
			orderid,
			test,
			payable,
			testcost,
			paid,
			taxIncluded,
			taxValue,
			status,
			discount,
			paymentmode,
			samplingCenter,
			outstanding,
			cost,
			employeeid,
		} = req.body;

		if (!employeeid || !clinician) {
			customError("Bill can initiation failed, include employeeid and clincianid", 404, res);
			return;
		}

		// const billing = new Billing(
		// 	patientid,
		// 	clinician,
		// 	organization,
		// 	test,
		// 	payable,
		// 	testcost,
		// 	paid,
		// 	taxIncluded,
		// 	taxValue,
		// 	status,
		// 	discount,
		// 	paymentmode,
		// 	samplingCenter,
		// 	outstanding,
		// 	cost
		// );

		// const outcome = await billing.BillNewTransaction(req, res, employeeid, false);

		// if (typeof outcome === "string") {
		// 	customError(outcome, 404, res);
		// 	return;
		// }

		// if (typeof outcome === "boolean") {
		// 	if (outcome !== true) {
		// 		customError("error in processsing order", 404, res);
		// 		return;
		// 	}

		// 	const isUpdated = await new Registration().updateProcessedOrder(orderid);
		// 	if (!isUpdated) {
		// 		customError("error processing order", 500, res);
		// 		return;
		// 	}

		// 	res.send({ message: "order processed successfully", statusCode: 200, status: "success" });
		// }
	} catch (err) {
		console.log(err);
		customError(err?.message || err, 500, res);
	}
}
