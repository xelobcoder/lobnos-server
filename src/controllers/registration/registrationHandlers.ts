import { Request, response, Response } from "express";
import Registration from "../../models/registration/registration";
import databaseQueries from "../../database/DatabaseQueriesHelper";
import { customError, convertKeysToLowerCase } from "../../hooks/helper";
import { NewRegistration } from "../../models/registration/types";
import logger from "../../hooks/logger";
import { PrimeLimsTablepatientemmergencycontactinformation } from "../../database/DatabaseTableSchema";
import PatientImageRepository from "../../repositories/patientRepositories/PatientImageRepository";

export const addNewPatient = async (request: Request, res: Response) => {
	try {
		const tenantId: number = parseInt(request.query.tenantId as string);
		await Registration.addNewPatient(tenantId, request, res);
	} catch (error) {
		customError("Error registering patient", 500, res);
	}
};

export const updatePersonalInformation = async (
	request: Request<{}, {}, { data: NewRegistration }, { tenantId: string; patientid: string }>,
	response: Response
) => {
	const tenantId: number = parseInt(request.query.tenantId, 10);
	const { patientid } = request.query;
	const parsedPatientId = parseInt(patientid);
	if (!patientid || isNaN(parsedPatientId)) {
		return customError("patientid not included in the request", 400, response);
	}
	try {
		const { data } = request.body;
		const result = await Registration.UpdatePersonalInformation(tenantId, data, parsedPatientId);
		response.send({ status: result });
	} catch (error) {
		customError(error?.message || "Error updating personal information", 500, response);
	}
};

export const getPatientAuditHistoryHandler = async (
	request: Request<{}, {}, {}, { tenantId: string; patientid: string }>,
	response: Response
) => {
	const tenantId: number = parseInt(request.query.tenantId, 10);
	const { patientid } = request.query;
	const parsedPatientId = parseInt(patientid);
	if (!patientid || isNaN(parsedPatientId)) {
		return customError("patientid not included in the request", 400, response);
	}
	try {
		const result = await Registration.getPatientAuditHistory(tenantId, parsedPatientId);
		response.send({ status: true, result });
	} catch (error) {
		customError(error?.message || "Error fetching patient audit history", 500, response);
	}
};

export const updateEmergencyContactInformation = async (
	request: Request<{}, {}, Partial<PrimeLimsTablepatientemmergencycontactinformation>, { tenantId: string; patientid: string }>,
	response: Response
) => {
	const tenantId: number = parseInt(request.query.tenantId, 10);
	const { patientid } = request.query;
	const parsedPatientId = parseInt(patientid);
	if (!patientid || isNaN(parsedPatientId)) {
		return customError("patientid not included in the request", 400, response);
	}
	try {
		const result = await Registration.emmergencyInformation(tenantId, parsedPatientId, request.body);
		if (result === true) {
			response.send({
				message: "record updated successfully",
				statusCode: 200,
				status: "success",
			});
		} else {
			response.send({
				message: "No record updated",
				statusCode: 200,
				status: "error",
			});
		}
	} catch (error) {
		customError("Error updating emergency contact information", 500, response);
	}
};

export const updateAddressingInformation = async (
	request: Request<{}, {}, {}, { tenantId: string; patientid: string }>,
	response: Response
) => {
	const tenantId: number = parseInt(request.query.tenantId, 10);
	const { patientid } = request.query;
	const parsedPatientId = parseInt(patientid);
	if (!patientid || isNaN(parsedPatientId)) {
		return customError("patientid not included in the request", 400, response);
	}
	try {
		const records = request.body;
		const info = await Registration.addressingInformationStatic(tenantId, parsedPatientId, records as any);
		if (info === true) {
			response.send({
				message: "record updated successfully",
				statusCode: 200,
				status: "success",
			});
		} else {
			response.send({
				message: "No record updated",
				statusCode: 200,
				status: "success",
			});
		}
	} catch (error) {
		console.error(error);
		customError("Error updating addressing information", 500, response);
	}
};

export const getPersonalInformation = async (
	request: Request<{}, {}, {}, { tenantId: string; patientid: string }>,
	response: Response
) => {
	const tenantId: number = parseInt(request.query.tenantId, 10);
	const { patientid } = request.query;
	const parsedPatientId = parseInt(patientid);
	if (!patientid || isNaN(parsedPatientId)) {
		return customError("patientid not included in the request", 400, response);
	}
	try {
		const data = await databaseQueries.getSingleId(tenantId, parsedPatientId, "new_patients", "patientid");
		if (data.length > 0) {
			const dataOne = convertKeysToLowerCase(data[0]);
			dataOne.maritalstatus = dataOne.marital_status;
			dataOne.mobile = parseInt(dataOne.mobile_number);
			dataOne.patientOrganization = dataOne.organization;
			const date = new Date(dataOne.dob);
			delete dataOne.marital_status;
			delete dataOne.mobile_number;
			delete dataOne.organization;
			dataOne.years = date.getFullYear();
			dataOne.months = date.getMonth() + 1;
			dataOne.days = date.getDate();
			dataOne.ageType = dataOne["agetype"];
			delete dataOne.agetype;
			response.send({ statusCode: 200, status: "success", result: dataOne });
		} else {
			response.send({ statusCode: 200, status: "success", result: [] });
		}
	} catch (error) {
		console.error(error);
		customError("Error fetching personal information", 500, response);
	}
};

export const checkMobileNumber = async (
	request: Request<{}, {}, {}, { tenantId: string; mobileno: number | string }>,
	response: Response
): Promise<void> => {
	const tenantId: number = parseInt(request.query.tenantId, 10);
	const { mobileno } = request.query;
	if (!mobileno) {
		return customError("mobileno not included in the request", 400, response);
	}
	if (typeof mobileno !== "string" && typeof mobileno !== "number") {
		return customError("mobileno must be a string or number", 400, response);
	}
	const mobileNumber = typeof mobileno === "string" ? parseInt(mobileno, 10) : mobileno;
	if (isNaN(mobileNumber)) {
		return customError("mobileno is not a valid number", 400, response);
	}
	try {
		const data = await databaseQueries.getSingleId(tenantId, mobileNumber, "new_patients", "mobile_number");
		response.send({
			statusCode: 200,
			status: "success",
			exist: data.length > 0,
		});
	} catch (error) {
		console.error(error);
		return customError("Error checking mobile number", 500, response);
	}
};

export const getAddressingInformation = async (
	request: Request<{}, {}, {}, { tenantId: string; patientid: string }>,
	response: Response
): Promise<void> => {
	const tenantId: number = parseInt(request.query.tenantId, 10);
	const { patientid } = request.query;
	if (!patientid) {
		return customError("patientid not included in the request", 400, response);
	}
	const normalizedPatientId = parseInt(patientid);
	if (isNaN(normalizedPatientId)) {
		return customError("patientid is not a valid number", 400, response);
	}
	try {
		const data = await databaseQueries.getSingleId(tenantId, normalizedPatientId, "patientsaddress", "patientid");
		if (data.length > 0) {
			response.send({ statusCode: 200, status: "success", result: data[0] });
		} else {
			response.send({ statusCode: 200, status: "success", result: [] });
		}
	} catch (error) {
		logger.error(error);
		return customError("Error fetching addressing information", 500, response);
	}
};

export const getEmergencyContactInformation = async (
	request: Request<{}, {}, {}, { tenantId: string; patientid: string }>,
	response: Response
): Promise<void> => {
	const tenantId: number = parseInt(request.query.tenantId, 10);
	const { patientid } = request.query;
	if (!patientid) {
		return customError("patientid not included in the request", 400, response);
	}
	const normalizedPatientId = parseInt(patientid);
	if (isNaN(normalizedPatientId)) {
		return customError("patientid is not a valid number", 400, response);
	}
	try {
		const data = await databaseQueries.getSingleId(tenantId, normalizedPatientId, "patientemmergencycontactinformation", "patientid");
		if (data.length > 0) {
			response.send({ statusCode: 200, status: "success", result: data[0] });
		} else {
			response.send({ statusCode: 200, status: "success", result: [] });
		}
	} catch (error) {
		console.error(error);
		return customError("Error fetching emergency contact information", 500, response);
	}
};

export const getRegistrationSettings = async (
	req: Request<{}, {}, {}, { tenantId: string }>,
	res: Response
) => {
	try {
		const tenantId: number = parseInt(req.query.tenantId, 10);
		const settings = await Registration.isBulkRegistration(tenantId);
		res.send({
			status: "success",
			message: "settings retrieved successfully",
			statusCode: 200,
			bulkRegistration: settings,
		});
	} catch (error) {
		console.error(error);
		customError("Error fetching registration settings", 500, res);
	}
};


export const getPatientImagePathHandler = async (
	req: Request<{}, {}, {}, { tenantId: string; patientid: string }>,
	res: Response
) => {
	try {
		const tenantId: number = parseInt(req.query.tenantId, 10);
		const patientid: number = parseInt(req.query.patientid, 10);
		if (!patientid) {
			return customError("patientid not included in the request", 400, res);
		}
		const imagePath = await PatientImageRepository.findByPatientId(tenantId, patientid);
		res.send({
			status: "success",
			message: "image path retrieved successfully",
			statusCode: 200,
			imagePath,
		});

	} catch (error: any) {
		logger.log(error);
		customError("Error fetching image path", 500, res);
	}
}
