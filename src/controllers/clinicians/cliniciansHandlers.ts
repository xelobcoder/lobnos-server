import { NextFunction, Request, response, Response } from "express";
import Registration from "../../models/registration/registration";
import { Clinician, ClinicianFilterParams } from "../../models/clincians/types";
import { responseError, customError } from "../../hooks/helper";
import logger from "../../hooks/logger";
import ClinicianClass from "../../models/clincians/clinicianClass";
import { PrimeLimsTableclinicianbasicinfo } from "../../database/DatabaseTableSchema";
import KnexConnection from "../../database/KnexConnections";
import { decrypt_value } from "../../utils/encryptionModels";

function decryptResultValue(value: string | null | undefined): string | null {
	if (!value) return value || null;
	const trimmedValue = String(value).trim();
	const looksEncrypted = trimmedValue.length >= 24 && /^[A-Za-z0-9+/]+={0,2}$/.test(trimmedValue);
	if (!looksEncrypted) return value;
	try {
		return decrypt_value(trimmedValue);
	} catch {
		return value;
	}
}

export async function getCliniciansHandler(request: Request<{}, {}, {}, ClinicianFilterParams & { tenantId: string }>, response: Response): Promise<void> {
	try {
		const tenantId = parseInt(request.query.tenantId.toString());

		// Extract filter parameters from query
		const filterParams: ClinicianFilterParams = {
			page: request.query.page,
			count: request.query.count,
			role: request.query.role as string,
			searchText: request.query.searchText as string,
			id: request.query.id,
			name: request.query.name as string,
			location: request.query.location as string,
			address: request.query.address as string,
			occupation: request.query.occupation as string,
			organization: request.query.organization,
			phone: request.query.phone as string,
			email: request.query.email as string,
			identifier: request.query.identifier as string,
		};

		const cliniciansList: Clinician[] = await new ClinicianClass().getClinicians(tenantId, filterParams);
		response.send({ statusCode: 200, status: "success", result: cliniciansList });
	} catch (err) {
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
	} catch (error: any) {
		return res.status(500).json({ success: false, message: "Bulk insert failed", error: error?.message || error });
	}
};

export async function getSingleClinicianHandler(req: Request<{}, {}, {}, { tenantId: string }>, res: Response) {
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


export async function putCliniciansHandler(req: Request<{}, {}, PrimeLimsTableclinicianbasicinfo, { tenantId: string }>, res: Response): Promise<void> {
	try {
		const { id } = req.body;

		if (!id) customError("Clinician id not added", 404, res);
		const tenantId = parseInt(req.query.tenantId.toString())
		const isUpdated = await new ClinicianClass().putCliniciansBasic(tenantId, req.body as any);

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

export async function deleteCliniciansHandler(request: Request<{}, {}, { id: string }, { tenantId: string }>, response: Response): Promise<void> {
	try {
		const { id } = request.body;
		const parseId = parseInt(id);
		if (!id || isNaN(parseId)) {
			return customError("id required", 404, response);
		}
		const tenantId = parseInt(request.query.tenantId.toString())
		const status = await new ClinicianClass().deleteClinicians(tenantId, parseId);
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


export async function verifyClinicianPhoneNumberAndEmailMiddleware(request: Request<{}, {}, { email: string; phone: string }, { tenantId: string }>, response: Response, next: NextFunction) {
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



export async function filterClinicianHandler(req: Request<{}, {}, { data?: any }, { tenantId: string }>, res: Response): Promise<void> {
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

export async function getClinicianResultHandler(req: Request<{}, {}, {}, { tenantId: string }>, res: Response): Promise<void> {
	try {
		const { clinicianid, startdate, enddate } = req.query as { clinicianid?: string; startdate?: string; enddate?: string };
		if (!clinicianid) {
			customError("please add clinicianid", 401, res);
			return;
		}
		const tenantId = parseInt(req.query.tenantId.toString())
		const result = await new ClinicianClass().getClinicianResult(tenantId, parseInt(clinicianid), startdate, enddate);

		res.send({ status: "success", statusCode: 200, result });
	} catch (err: any) {
		logger.error(err);
		customError(err?.message || "something went wrong", 401, res);
	}
}

export async function getBillingTestBasedByClinicianHandler(req: Request<{}, {}, {}, { tenantId: string }>, res: Response): Promise<void> {
	try {
		const { billingid, clinicianid } = req.query as { billingid?: string; clinicianid?: string };
		if (!billingid || !clinicianid) {
			customError("please add billingid and clinicianid", 401, res);
			return;
		}
		const tenantId = parseInt(req.query.tenantId.toString())
		const result = await new ClinicianClass().getBillingTestBasedByClinician(tenantId, parseInt(billingid.toString()), parseInt(clinicianid));

		res.send({ statusCode: 200, status: "success", result });
	} catch (err: any) {
		logger.error(err);
		customError(err?.message || "something went wrong", 500, res);
	}
}

export async function getClinicianPortalRequestsHandler(req: Request<{}, {}, {}, { tenantId: string, startdate?: string, enddate?: string, page?: string, count?: string }>, res: Response): Promise<void> {
	try {
		const authUser = (req as any).authUser;
		const clinicianid = Number(authUser?.clinicianid || authUser?.employeeid);
		if (!clinicianid || authUser?.role !== 'clinician') return customError("Clinician token required", 403, res);

		const tenantId = parseInt(req.query.tenantId.toString());
		const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
		const count = Math.min(100, Math.max(1, parseInt(req.query.count || '10', 10) || 10));
		const offset = (page - 1) * count;
		const connection = await KnexConnection(tenantId);
		const baseQuery = () => connection('dboservices as ds')
			.innerJoin('billing as b', 'b.billingid', 'ds.billingid')
			.innerJoin('test_ascension as ta', 'ta.serviceid', 'ds.serviceid')
			.innerJoin('new_patients as np', 'np.patientid', 'b.patientid')
			.innerJoin('test_panels as tp', 'tp.id', 'ta.testid')
			.leftJoin('samplestatus as ss', 'ss.ascensionid', 'ta.id')
			.where('ds.clinicianId', clinicianid)
			.where('ds.serviceCategory', 'CLINICIAN_SPECIAL_BILLING')
			.where((builder) => builder.where('ds.isDeleted', 0).orWhereNull('ds.isDeleted'));

		let query = baseQuery()
			.select(
				'b.billingid',
				'b.billedon',
				'np.patientid',
				'np.fullpatientid',
				'np.firstname',
				'np.middlename',
				'np.lastname',
				'ta.id as ascensionid',
				'ta.testid',
				'tp.name as testname',
				'ta.collection',
				'ta.processing',
				'ta.ready',
				'ta.approvalStatus',
				'ss.approvalstatus as sampleApprovalStatus',
				'ta.resultEntryStart',
				'ta.resultEntryEnd',
			);
		let countQuery = baseQuery().countDistinct({ total: 'ta.id' }).first();

		if (req.query.startdate && req.query.enddate) {
			query = query.whereRaw('DATE(b.billedon) BETWEEN ? AND ?', [req.query.startdate, req.query.enddate]);
			countQuery = countQuery.whereRaw('DATE(b.billedon) BETWEEN ? AND ?', [req.query.startdate, req.query.enddate]);
		}

		const [result, totalRow] = await Promise.all([
			query.orderBy('b.billedon', 'desc').limit(count).offset(offset),
			countQuery,
		]);
		const total = Number((totalRow as any)?.total || 0);
		res.send({ status: "success", statusCode: 200, result, pagination: { page, count, total, totalPages: Math.ceil(total / count) } });
	} catch (err: any) {
		logger.error(err);
		customError(err?.message || "something went wrong", 500, res);
	}
}

export async function getClinicianPortalRequestDetailsHandler(req: Request<{ ascensionid: string }, {}, {}, { tenantId: string }>, res: Response): Promise<void> {
	try {
		const authUser = (req as any).authUser;
		const clinicianid = Number(authUser?.clinicianid || authUser?.employeeid);
		if (!clinicianid || authUser?.role !== 'clinician') return customError("Clinician token required", 403, res);

		const tenantId = parseInt(req.query.tenantId.toString());
		const ascensionid = parseInt(req.params.ascensionid.toString(), 10);
		if (isNaN(ascensionid)) return customError("Invalid ascensionid", 400, res);

		const connection = await KnexConnection(tenantId);
		const request = await connection('dboservices as ds')
			.innerJoin('billing as b', 'b.billingid', 'ds.billingid')
			.innerJoin('test_ascension as ta', 'ta.serviceid', 'ds.serviceid')
			.innerJoin('new_patients as np', 'np.patientid', 'b.patientid')
			.innerJoin('test_panels as tp', 'tp.id', 'ta.testid')
			.select(
				'b.billingid',
				'b.billedon',
				'np.patientid',
				'np.fullpatientid',
				'np.firstname',
				'np.middlename',
				'np.lastname',
				'ta.id as ascensionid',
				'ta.testid',
				'tp.name as testname',
				'ta.collection',
				'ta.processing',
				'ta.ready',
				'ta.approvalStatus',
				'ta.resultEntryStart',
				'ta.resultEntryEnd',
			)
			.where('ds.clinicianId', clinicianid)
			.where('ds.serviceCategory', 'CLINICIAN_SPECIAL_BILLING')
			.where('ta.id', ascensionid)
			.where((builder) => builder.where('ds.isDeleted', 0).orWhereNull('ds.isDeleted'))
			.first();

		if (!request) return customError("Request not found", 404, res);

		const results = await connection('test_results')
			.select('field', 'fieldid', 'value', 'originalvalue', 'created_on', 'updated_on', 'employeeid')
			.where({ ascensionid, billingid: request.billingid, testid: request.testid })
			.orderBy('fieldid', 'asc');

		const comments = await connection('result_comments')
			.select('comments')
			.where({ billingid: request.billingid, testid: request.testid })
			.first();

		res.send({
			status: "success",
			statusCode: 200,
			result: {
				request,
				results: results.map((row: any) => ({
					...row,
					value: decryptResultValue(row.originalvalue || row.value),
				})),
				comments: comments?.comments || null,
			}
		});
	} catch (err: any) {
		logger.error(err);
		customError(err?.message || "something went wrong", 500, res);
	}
}

export async function updateClinicianPortalRequestCommentHandler(req: Request<{ ascensionid: string }, { comments?: string }, { comments?: string }, { tenantId: string }>, res: Response): Promise<void> {
	try {
		const authUser = (req as any).authUser;
		const clinicianid = Number(authUser?.clinicianid || authUser?.employeeid);
		if (!clinicianid || authUser?.role !== 'clinician') return customError("Clinician token required", 403, res);

		const tenantId = parseInt(req.query.tenantId.toString());
		const ascensionid = parseInt(req.params.ascensionid.toString(), 10);
		const comments = String(req.body?.comments || '').trim();
		if (isNaN(ascensionid)) return customError("Invalid ascensionid", 400, res);

		const connection = await KnexConnection(tenantId);
		const request = await connection('dboservices as ds')
			.innerJoin('billing as b', 'b.billingid', 'ds.billingid')
			.innerJoin('test_ascension as ta', 'ta.serviceid', 'ds.serviceid')
			.select('b.billingid', 'ta.testid')
			.where('ds.clinicianId', clinicianid)
			.where('ta.id', ascensionid)
			.where((builder) => builder.where('ds.isDeleted', 0).orWhereNull('ds.isDeleted'))
			.first();

		if (!request) return customError("Request not found", 404, res);

		const existing = await connection('result_comments')
			.where({ billingid: request.billingid, testid: request.testid })
			.first();

		if (existing) {
			await connection('result_comments')
				.where({ billingid: request.billingid, testid: request.testid })
				.update({ comments });
		} else {
			await connection('result_comments').insert({ billingid: request.billingid, testid: request.testid, comments });
		}

		res.send({ status: "success", statusCode: 200, message: "Comment saved", comments });
	} catch (err: any) {
		logger.error(err);
		customError(err?.message || "something went wrong", 500, res);
	}
}

export async function postTemporaryOrderHandler(req: Request<{}, {}, {}, { tenantId: string }>, res: Response): Promise<void> {
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
	} catch (err: any) {
		customError(err?.message || err, 500, res);
	}
}

export async function getAllCliniciansHandler(req: Request, res: Response): Promise<void> {
	try {
		const tenantId = parseInt(req.query.tenantId?.toString() || '0');
		const cliniciansList: Clinician[] = await ClinicianClass.getAllClinicians(tenantId);
		res.status(200).json({ statusCode: 200, status: "success", result: cliniciansList });
	} catch (err) {
		logger.error(err);
		responseError(res);
	}
}
