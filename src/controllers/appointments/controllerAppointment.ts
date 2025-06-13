import { responseError, customError } from "../../hooks/helper";
import Appointment from "../../models/appointments/appointments";
import { Response, Request } from "express";

export async function createAppointmentController(request: Request, response: Response) {
	try {
		const tenantId: number = parseInt(request.query.tenant as string, 10);
		const isAppointmentCreated = await new Appointment(21).createAppointment(tenantId, request.body);
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
		const reqPage: number = parseInt(page as string);
		const reqCount: number = parseInt(count as string);
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
