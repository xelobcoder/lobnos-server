import { Request, response, Response } from "express";
import Registration from "../../models/registration/registration";
import databaseQueries from "../../database/DatabaseQueriesHelper";
import { customError, convertKeysToLowerCase } from "../../hooks/helper";
import { NewRegistration } from "../../models/registration/types";
import logger from "../../hooks/logger";
import { PrimeLimsTablepatientemmergencycontactinformation } from "../../database/DatabaseTableSchema";
import PatientImageRepository from "../../repositories/patientRepositories/PatientImageRepository";
import Patient from "../../models/patients/patientRepo";
import { ICreateEmergencyPatient, ICreateNewPatient } from "../../models/patients/interfaces";
import PatientAddressingRepo from "../../models/patients/respositories/patientAddressingRepo.repo";
import EmergencyPatientRepo from "../../models/patients/respositories/emmergencyPatient.repo";
import NewPatientsRepo from "../../models/patients/respositories/newPatientsRepo.repo";
import { TiifuWorkingClass } from "../../database/TiifuWorkingClass";
import { NotificationDispatcher } from "../../models/application/notifications/services/NotificationDispatcher";

export const addNewPatient = async (request: Request, res: Response) => {
	try {
		const tenantId: number = parseInt(request.query.tenantId as string);
		await Registration.addNewPatient(tenantId, request, res);
	} catch (error) {
		console.log(error);
		customError("Error registering patient", 500, res);
	}
};

export const updatePersonalInformation = async (
	request: Request<{}, {}, Partial<ICreateNewPatient>, { tenantId: string; patientid: string }>,
	response: Response
) => {
	const tenantId: number = parseInt(request.query.tenantId, 10);
	const { patientid } = request.query;
	const parsedPatientId = parseInt(patientid);
	if (!patientid || isNaN(parsedPatientId)) {
		return customError("patientid not included in the request", 400, response);
	}
	try {
		const data = request.body;
		const result = await Registration.UpdatePersonalInformation(tenantId, data, parsedPatientId);
		if (result) {
			NotificationDispatcher.dispatch(tenantId, 'PATIENT_UPDATED', { patientId: parsedPatientId }).catch(() => { });
		}
		response.send({ status: result });
	} catch (error: any) {
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
	} catch (error: any) {
		customError(error?.message || "Error fetching patient audit history", 500, response);
	}
};

export const updateEmergencyContactInformation = async (
	request: Request<{}, {}, Partial<ICreateEmergencyPatient>, { tenantId: string; patientid: string }>,
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
		const info = await new PatientAddressingRepo(tenantId).update(parsedPatientId, records);
		if (info) {
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
	if (!patientid || isNaN(parsedPatientId)) return customError("patientid not included in the request", 400, response);

	try {
		const data = await databaseQueries.getSingleId(tenantId, parsedPatientId, "new_patients", "patientid");
		response.send({ statusCode: 200, status: "success", result: data });
	} catch (error) {
		logger.error(error);
		customError("Error fetching personal information", 500, response);
	}
};

export const checkMobileNumber = async (
	request: Request<{}, {}, {}, { tenantId: string; mobileno: number | string, patientid?: number | string, isGetData: boolean }>,
	response: Response
): Promise<any> => {
	const tenantId: number = parseInt(request.query.tenantId, 10);
	const patientid = request.query.patientid ? parseInt(request.query.patientid.toString(), 10) : undefined;
	if (patientid && isNaN(patientid)) return customError("patientid is not a valid number", 400, response);
	if (patientid) {
		const belongsToPatient = await Patient.checkNumberBelongsToPatient(tenantId, patientid, request.query.mobileno);
		if (belongsToPatient) {
			return response.send({
				statusCode: 200,
				status: "success",
				exist: true,
			});
		}
		return response.send({
			statusCode: 200,
			status: "success",
			exist: false,
		});
	}

	const sanitizedMobileNumber = request.query.mobileno.toString().padStart(10, '0');

	const data = await new NewPatientsRepo(tenantId).filterPatient({ mobile_number: sanitizedMobileNumber });
	return response.send({
		statusCode: 200,
		status: "success",
		exist: data.length > 0,
		result: request.query.isGetData ? data : undefined,
	});

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
		const data = await new PatientAddressingRepo(tenantId).get(normalizedPatientId);
		if (data) {
			response.send({ statusCode: 200, status: "success", result: data });
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
		const data = await new EmergencyPatientRepo(tenantId).get(normalizedPatientId);
		if (data) {
			response.send({ statusCode: 200, status: "success", result: data });
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
