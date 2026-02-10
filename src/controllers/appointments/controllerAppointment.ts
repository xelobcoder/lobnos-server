import { z } from "zod";
import { responseError, customError } from "../../hooks/helper";
import Appointment from "../../models/appointments/appointments";
import { Response, Request } from "express";

export async function getAllAppointmentsController(request: Request, response: Response) {
	try {
		const tenantId: number = parseInt(request.query.tenant as string, 10);
		const page = request.query.page ? parseInt(request.query.page as string, 10) : 1;
		const count = request.query.count ? parseInt(request.query.count as string, 10) : 10;
		const sortby = request.query.sortby as 'ASC' | 'DESC' || 'DESC';
		const employeeId = request.query.employeeid ? parseInt(request.query.employeeid as string, 10) : 0;
		const result = await new Appointment(employeeId).getAllAppointments(tenantId, page, count, sortby);
		response.send(result);
	} catch (err) {
		responseError(response, err);
	}
}
export async function getAppointmentDetailsController(request: Request, response: Response) {
	try {
		const tenantId: number = parseInt(request.query.tenant as string, 10);
		const appointmentId: number = parseInt(request.params.id, 10);
		if (!appointmentId) {
			return customError("Appointment ID missing", 404, response);
		}
		const details = await new Appointment(0).getAppointmentDetails(tenantId, appointmentId);
		if (!details) {
			return customError("Appointment not found", 404, response);
		}
		response.send(details);
	} catch (err) {
		responseError(response, err);
	}
}

export async function updateAppointmentController(request: Request, response: Response) {
	try {
		const tenantId: number = parseInt(request.query.tenant as string, 10);
		const appointmentId: number = parseInt(request.params.id, 10);
		if (!appointmentId) {
			return customError("Appointment ID missing", 404, response);
		}
		// Preprocess payload: remove refid, convert appointment_date to YYYY-MM-DD
		const { refid, appointment_date, ...rest } = request.body;
		let processedDate = appointment_date;
		if (appointment_date && appointment_date.includes("T")) {
			processedDate = appointment_date.split("T")[0];
		}
		const cleanPayload = { ...rest };
		if (processedDate) cleanPayload["appointment_date"] = processedDate;

		// Use the same Zod schema as in the model for validation
		const updateSchema = z.object({
			patientid: z.number().int(),
			duration: z.number().int().optional(),
			status: z.string().max(50).optional(),
			appointment_time: z.string().max(10).optional(),
			appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
			inviteMethod: z.string().max(20).optional(),
			purpose: z.string().max(500).optional(),
			title: z.string().max(300).optional(),
			preference: z.string().max(50).optional(),
			practioner: z.number().int().optional(),
			location: z.string().max(50).optional(),
			notes: z.string().max(500).nullable().optional(),
		}).strict();

		const unParsedCleanPayload = {
			patientid:cleanPayload.patientid,
			duration: cleanPayload.duration,
			status: cleanPayload.status,
			appointment_time: cleanPayload.appointment_time,
			appointment_date: cleanPayload.appointment_date,
			inviteMethod: cleanPayload.inviteMethod,
			purpose: cleanPayload.purpose,
			title: cleanPayload.title,
			preference: cleanPayload.preference,
			practioner: cleanPayload.practionerid,
			location: cleanPayload.location,
			notes: cleanPayload.notes,
		};

		const parseResult = updateSchema.safeParse(unParsedCleanPayload);
		if (!parseResult.success) {
			console.error("Zod validation error:", parseResult.error);
			return customError("Invalid appointment update fields", 400, response);
		}

		
		const updated = await new Appointment(0).updateAppointment(tenantId, appointmentId, unParsedCleanPayload);
		response.send({ success: updated });
	} catch (err) {
		console.log("Error updating appointment:", err);
		responseError(response, err);
	}
}

export async function deleteAppointmentController(request: Request, response: Response) {
	try {
		const tenantId: number = parseInt(request.query.tenant as string, 10);
		const appointmentId: number = parseInt(request.params.id, 10);
		if (!appointmentId) {
			return customError("Appointment ID missing", 404, response);
		}
		const deleted = await new Appointment(0).deleteAppointment(tenantId, appointmentId);
		response.send({ success: deleted });
	} catch (err) {
		responseError(response, err);
	}
}

export async function createAppointmentController(request: Request, response: Response) {
	try {
		const tenantId: number = parseInt(request.query.tenant as string, 10);
		const employeeid = request.query.employeeid ? parseInt(request.query.employeeid as string, 10) : 0;
		if (!employeeid) return customError("Employee ID missing in query", 404, response);
		const isAppointmentCreated = await new Appointment(employeeid).createAppointment(tenantId, request.body);
		response.send({ success: isAppointmentCreated });
	} catch (err) {
		responseError(response, err);
	}
}

export async function getPatientAppointmentHistoryController(request: Request, response: Response) {
	try {
		const tenantId: number = parseInt(request.query.tenant as string, 10);
		let { patientid, count, page } = request.query;
		if (!patientid) {
			return customError("Patient ID missing", 404, response);
		}
		const ptid: number = typeof patientid === "string" && !isNaN(Number(patientid)) ? parseInt(patientid) : Number(patientid);
		const reqPage: number = parseInt(page as string) || 1;
		const reqCount: number = parseInt(count as string) || 10;
		const previous = await new Appointment(0).getPatientAppointmentHistory(tenantId, ptid, reqCount, reqPage);
		response.send(previous);
	} catch (err) {
		responseError(response, err);
	}
}

export async function MonthAppointmentsController(request: Request, response: Response) {
	try {
		const tenantId: number = parseInt(request.query.tenant as string, 10);
		let { month = (new Date().getMonth() + 1).toString() } = request.query;
		const searchMonth = typeof month === "string" && !isNaN(Number(month)) ? parseInt(month) : Number(month);
		const records = await new Appointment(null).loadMonthAppointments(tenantId, searchMonth);
		response.send(records);
	} catch (err) {
		responseError(response, err);
	}
}

export async function loadPractionerAvailableSlotsController(request: Request, response: Response) {
	try {
		const tenantId: number = parseInt(request.query.tenant as string, 10);
		const { employeeid, appointment_date = new Date().toISOString() } = request.query;
		if (!employeeid || isNaN(Number(employeeid))) {
			return customError("Bad Request. Employee ID not provided", 404, response);
		}
		const slots = await new Appointment(Number(employeeid)).getPractionerAvailableTime(
			tenantId,
			Number(employeeid),
			new Date(appointment_date as string)
		);
		response.send(slots);
	} catch (err) {
		responseError(response, err);
	}
}
