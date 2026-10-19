import { z } from "zod";
import { responseError, customError } from "../../hooks/helper";
import Appointment from "../../models/appointments/appointments";
import { Response, Request } from "express";
import { NotificationDispatcher } from "../../models/application/notifications/services/NotificationDispatcher";
import { AppointmentContextProvider } from "../../models/application/notifications/context/providers/AppointmentContextProvider";
import {
	APPOINTMENT_TYPES,
	AppointmentValidationError,
	parseAppointmentMetadata,
	resolveAppointmentCalendarQuery,
} from "../../models/appointments/appointmentValidation";

function appointmentTenantId(request: Request): number {
	const raw = request.query.tenantId ?? request.query.tenant;
	const tenantId = typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : NaN;
	if (!Number.isSafeInteger(tenantId) || tenantId <= 0) {
		throw new AppointmentValidationError("A valid positive tenantId is required");
	}
	return tenantId;
}

/** Sends 400 for appointment validation errors; returns false for anything else. */
function handleAppointmentValidationError(response: Response, err: unknown): boolean {
	if (err instanceof AppointmentValidationError) {
		customError(err.message, 400, response);
		return true;
	}
	return false;
}

async function dispatchAppointmentNotification(
	tenantId: number,
	eventCode: string,
	appointmentId: number,
	employeeid?: number,
): Promise<void> {
	try {
		const result = await NotificationDispatcher.dispatch(tenantId, eventCode, { appointmentId }, employeeid);
		if (!result.success) console.warn(`[notifications] ${eventCode} not fully queued:`, result.reason || result.error);
	} catch (error) {
		console.error(`[notifications] ${eventCode} dispatch error:`, error);
	}
}

export async function getAllAppointmentsController(request: Request, response: Response) {
	try {
		const tenantId = appointmentTenantId(request);
		const page = request.query.page ? parseInt(request.query.page as string, 10) : 1;
		const count = request.query.count ? parseInt(request.query.count as string, 10) : 10;
		const sortby = request.query.sortby as 'ASC' | 'DESC' || 'DESC';
		const employeeId = request.query.employeeid ? parseInt(request.query.employeeid as string, 10) : 0;
		const result = await new Appointment(employeeId).getAllAppointments(tenantId, page, count, sortby);
		response.send(result);
	} catch (err) {
		if (handleAppointmentValidationError(response, err)) return;
		responseError(response, err);
	}
}
export async function getAppointmentDetailsController(request: Request, response: Response) {
	try {
		const tenantId = appointmentTenantId(request);
		const appointmentId: number = parseInt(request.params.id.toString(), 10);
		if (!appointmentId) {
			return customError("Appointment ID missing", 404, response);
		}
		const details = await new Appointment(0).getAppointmentDetails(tenantId, appointmentId);
		if (!details) {
			return customError("Appointment not found", 404, response);
		}
		response.send(details);
	} catch (err) {
		if (handleAppointmentValidationError(response, err)) return;
		responseError(response, err);
	}
}

export async function updateAppointmentController(request: Request, response: Response) {
	try {
		const tenantId = appointmentTenantId(request);
		const appointmentId: number = parseInt(request.params.id.toString(), 10);
		if (!appointmentId) return customError("Appointment ID missing", 404, response);

		const { refid, appointment_date, ...rest } = request.body;
		let processedDate = appointment_date;
		if (appointment_date && appointment_date.includes("T")) {
			processedDate = appointment_date.split("T")[0];
		}
		const cleanPayload = { ...rest };
		if (processedDate) cleanPayload["appointment_date"] = processedDate;

		// Use the same Zod schema as in the model for validation
		const metadata = parseAppointmentMetadata(cleanPayload);

		const updateSchema = z.object({
			patientid: z.number().int().positive().nullable().optional(),
			duration: z.number().int().optional(),
			status: z.string().max(50).optional(),
			appointment_time: z.string().max(10).optional(),
			appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
			inviteMethod: z.string().optional(),
			purpose: z.string(),
			title: z.string().optional(),
			preference: z.string().optional(),
			practioner: z.number().int().optional(),
			location: z.string().optional(),
			notes: z.string().nullable().optional(),
			appointment_type: z.enum(APPOINTMENT_TYPES).nullable().optional(),
			lead_id: z.number().int().positive().nullable().optional(),
			billingid: z.number().int().positive().nullable().optional(),
		}).strict();

		const unParsedCleanPayload = {
			patientid: metadata.patientid,
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
			appointment_type: metadata.appointment_type,
			lead_id: metadata.lead_id,
			billingid: metadata.billingid,
		};

		const parseResult = updateSchema.safeParse(unParsedCleanPayload);
		if (!parseResult.success) {
			console.error("Zod validation error:", parseResult.error);
			return customError("Invalid appointment update fields", 400, response);
		}


		const updated = await new Appointment(0).updateAppointment(tenantId, appointmentId, unParsedCleanPayload);
		if (updated) {
			const status = String(unParsedCleanPayload.status || '').toLowerCase();
			const employeeid = request.query.employeeid ? parseInt(request.query.employeeid as string, 10) : undefined;
			let eventCode: string | null = null;
			if (status === 'confirmed' || status === 'confirm') eventCode = 'APPOINTMENT_CONFIRMED';
			else if (status === 'cancelled' || status === 'canceled' || status === 'cancel') eventCode = 'APPOINTMENT_CANCELLED';
			else if (status === 'missed' || status === 'no_show' || status === 'noshow') eventCode = 'APPOINTMENT_MISSED';
			else if (unParsedCleanPayload.appointment_date || unParsedCleanPayload.appointment_time) eventCode = 'APPOINTMENT_RESCHEDULED';
			if (eventCode) {
				void dispatchAppointmentNotification(
					tenantId,
					eventCode,
					appointmentId,
					employeeid && !isNaN(employeeid) ? employeeid : undefined,
				);
			}
		}
		response.send({ success: updated });
	} catch (err) {
		if (handleAppointmentValidationError(response, err)) return;
		console.log("Error updating appointment:", err);
		responseError(response, err);
	}
}

export async function deleteAppointmentController(request: Request, response: Response) {
	try {
		const tenantId = appointmentTenantId(request);
		const appointmentId: number = parseInt(request.params.id.toString(), 10);
		if (!appointmentId) {
			return customError("Appointment ID missing", 404, response);
		}
		const notificationContext = await new AppointmentContextProvider(tenantId).getContext(appointmentId);
		const deleted = await new Appointment(0).deleteAppointment(tenantId, appointmentId);
		if (deleted) {
			const employeeid = request.query.employeeid ? parseInt(request.query.employeeid as string, 10) : undefined;
			NotificationDispatcher.dispatchByContext(
				tenantId,
				'APPOINTMENT_CANCELLED',
				{
					...notificationContext,
					message: `Appointment ${appointmentId} was cancelled.`,
				},
				employeeid && !isNaN(employeeid) ? employeeid : undefined,
			).then((result) => {
				if (!result.success) console.warn('[notifications] APPOINTMENT_CANCELLED not fully queued:', result.reason || result.error);
			}).catch((error) => {
				console.error('[notifications] APPOINTMENT_CANCELLED dispatch error:', error);
			});
		}
		response.send({ success: deleted });
	} catch (err) {
		if (handleAppointmentValidationError(response, err)) return;
		responseError(response, err);
	}
}

export async function createAppointmentController(request: Request, response: Response) {
	try {
		const tenantId = appointmentTenantId(request);
		const employeeid = request.query.employeeid ? parseInt(request.query.employeeid as string, 10) : 0;
		if (!employeeid) return customError("Employee ID missing in query", 404, response);
		const isAppointmentCreated = await new Appointment(employeeid).createAppointment(tenantId, request.body);
		const createdId = (isAppointmentCreated as any)?.appointmentId
			|| (isAppointmentCreated as any)?.refid
			|| (isAppointmentCreated as any)?.id;
		const createdOk = typeof isAppointmentCreated === "object" && isAppointmentCreated !== null
			? (isAppointmentCreated as any).success === true
			: isAppointmentCreated === true;
		if (createdOk && createdId) {
			NotificationDispatcher.dispatch(
				tenantId,
				'APPOINTMENT_CREATED',
				{
					appointmentId: Number(createdId),
					patientId: request.body?.patientid ? Number(request.body.patientid) : undefined,
				},
				employeeid,
			).then((result) => {
				if (!result.success) {
					console.warn('[notifications] APPOINTMENT_CREATED not queued:', result.reason || result.error);
				}
			}).catch((err) => {
				console.error('[notifications] APPOINTMENT_CREATED dispatch error:', err);
			});
		} else if (createdOk && !createdId) {
			console.warn('[notifications] APPOINTMENT_CREATED skipped: appointment created but no id returned');
		}
		response.send({
			success: createdOk,
			...(createdOk && createdId ? { appointmentId: Number(createdId) } : {}),
		});
	} catch (err) {
		if (handleAppointmentValidationError(response, err)) return;
		responseError(response, err);
	}
}

export async function getPatientAppointmentHistoryController(request: Request, response: Response) {
	try {
		const tenantId = appointmentTenantId(request);
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
		if (handleAppointmentValidationError(response, err)) return;
		responseError(response, err);
	}
}

export async function MonthAppointmentsController(request: Request, response: Response) {
	try {
		const tenantId = appointmentTenantId(request);
		// startDate+endDate or month+year give a bounded, year-aware range; month alone keeps legacy behavior.
		const calendar = resolveAppointmentCalendarQuery(request.query as Record<string, unknown>);
		const appointment = new Appointment(0);
		const records = calendar.mode === "legacy_month"
			? await appointment.loadMonthAppointments(tenantId, calendar.month)
			: await appointment.loadAppointmentsInRange(tenantId, calendar.startDate, calendar.endDate);
		response.send(records);
	} catch (err) {
		if (handleAppointmentValidationError(response, err)) return;
		responseError(response, err);
	}
}

export async function loadPractionerAvailableSlotsController(request: Request, response: Response) {
	try {
		const tenantId = appointmentTenantId(request);
		const { employeeid, appointment_date = new Date() } = request.query;
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
		if (handleAppointmentValidationError(response, err)) return;
		responseError(response, err);
	}
}
