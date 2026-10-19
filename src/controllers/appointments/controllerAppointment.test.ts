import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	loadMonthAppointments: vi.fn(async () => [{ refid: 1 }]),
	loadAppointmentsInRange: vi.fn(async () => [{ refid: 2 }]),
	createAppointment: vi.fn(),
	updateAppointment: vi.fn(),
	getAllAppointments: vi.fn(async () => []),
	getAppointmentDetails: vi.fn(async () => ({ refid: 7 })),
	deleteAppointment: vi.fn(async () => true),
	getPatientAppointmentHistory: vi.fn(async () => []),
	getPractionerAvailableTime: vi.fn(async () => ["09:00"]),
	getContext: vi.fn(async () => ({ appointment_id: 7 })),
	dispatch: vi.fn(async () => ({ success: true })),
	dispatchByContext: vi.fn(async () => ({ success: true })),
}));
vi.mock("../../models/appointments/appointments", () => ({
	default: class {
		loadMonthAppointments = mocks.loadMonthAppointments;
		loadAppointmentsInRange = mocks.loadAppointmentsInRange;
		createAppointment = mocks.createAppointment;
		updateAppointment = mocks.updateAppointment;
		getAllAppointments = mocks.getAllAppointments;
		getAppointmentDetails = mocks.getAppointmentDetails;
		deleteAppointment = mocks.deleteAppointment;
		getPatientAppointmentHistory = mocks.getPatientAppointmentHistory;
		getPractionerAvailableTime = mocks.getPractionerAvailableTime;
	},
}));
vi.mock("../../models/application/notifications/services/NotificationDispatcher", () => ({
	NotificationDispatcher: { dispatch: mocks.dispatch, dispatchByContext: mocks.dispatchByContext },
}));
vi.mock("../../models/application/notifications/context/providers/AppointmentContextProvider", () => ({
	AppointmentContextProvider: class {
		getContext = mocks.getContext;
	},
}));

import {
	MonthAppointmentsController,
	createAppointmentController,
	updateAppointmentController,
	getAllAppointmentsController,
	getAppointmentDetailsController,
	deleteAppointmentController,
	getPatientAppointmentHistoryController,
	loadPractionerAvailableSlotsController,
} from "./controllerAppointment";
import { AppointmentValidationError } from "../../models/appointments/appointmentValidation";

function res() {
	const response: any = { statusCode: 200, body: undefined };
	response.status = vi.fn((code: number) => { response.statusCode = code; return response; });
	response.send = vi.fn((body: unknown) => { response.body = body; return response; });
	return response;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("MonthAppointmentsController", () => {
	it("keeps legacy month-only requests on the MONTH() query", async () => {
		const response = res();
		await MonthAppointmentsController({ query: { tenant: "2", month: "4" } } as any, response);
		expect(mocks.loadMonthAppointments).toHaveBeenCalledWith(2, 4);
		expect(mocks.loadAppointmentsInRange).not.toHaveBeenCalled();
		expect(response.body).toEqual([{ refid: 1 }]);
	});

	it("uses a bounded range for month+year and explicit ranges", async () => {
		await MonthAppointmentsController({ query: { tenant: "2", month: "4", year: "2025" } } as any, res());
		expect(mocks.loadAppointmentsInRange).toHaveBeenLastCalledWith(2, "2025-04-01", "2025-04-30");
		await MonthAppointmentsController({ query: { tenant: "2", startDate: "2025-12-28", endDate: "2026-01-03" } } as any, res());
		expect(mocks.loadAppointmentsInRange).toHaveBeenLastCalledWith(2, "2025-12-28", "2026-01-03");
		expect(mocks.loadMonthAppointments).not.toHaveBeenCalled();
	});

	it("returns 400 for invalid calendar filters without querying", async () => {
		const response = res();
		await MonthAppointmentsController({ query: { tenant: "2", startDate: "2026-01-40", endDate: "2026-02-01" } } as any, response);
		expect(response.statusCode).toBe(400);
		expect(response.body).toMatchObject({ status: "error", statusCode: 400 });
		expect(mocks.loadAppointmentsInRange).not.toHaveBeenCalled();
	});
});

describe("appointment write validation", () => {
	it("returns a boolean success value and the created appointment ID", async () => {
		mocks.createAppointment.mockResolvedValueOnce({ success: true, appointmentId: 11, refid: 11 });
		const response = res();

		await createAppointmentController({
			query: { tenantId: "2", employeeid: "5" },
			body: { patientid: 9 },
		} as any, response);

		expect(response.body).toEqual({ success: true, appointmentId: 11 });
		expect(mocks.dispatch).toHaveBeenCalledWith(2, "APPOINTMENT_CREATED", {
			appointmentId: 11,
			patientId: 9,
		}, 5);
	});

	it("does not treat a failed model result as a created appointment", async () => {
		mocks.createAppointment.mockResolvedValueOnce(false);
		const response = res();

		await createAppointmentController({
			query: { tenantId: "2", employeeid: "5" },
			body: { patientid: 9, appointmentId: 11 },
		} as any, response);

		expect(response.body).toEqual({ success: false });
		expect(mocks.dispatch).not.toHaveBeenCalled();
	});

	it("maps create validation errors to 400 and does not notify", async () => {
		mocks.createAppointment.mockRejectedValueOnce(new AppointmentValidationError("lead_id does not reference an existing lead"));
		const response = res();
		await createAppointmentController({ query: { tenantId: "2", employeeid: "5" }, body: { lead_id: 9 } } as any, response);
		expect(response.statusCode).toBe(400);
		expect(response.body.message).toBe("lead_id does not reference an existing lead");
		expect(mocks.dispatch).not.toHaveBeenCalled();
	});

	describe("appointment tenant query handling", () => {
		const endpoints = [
			{ name: "list", handler: getAllAppointmentsController, model: mocks.getAllAppointments },
			{ name: "details", handler: getAppointmentDetailsController, model: mocks.getAppointmentDetails },
			{ name: "create", handler: createAppointmentController, model: mocks.createAppointment },
			{ name: "update", handler: updateAppointmentController, model: mocks.updateAppointment },
			{ name: "delete", handler: deleteAppointmentController, model: mocks.deleteAppointment },
			{ name: "history", handler: getPatientAppointmentHistoryController, model: mocks.getPatientAppointmentHistory },
			{ name: "calendar", handler: MonthAppointmentsController, model: mocks.loadAppointmentsInRange },
			{ name: "practitioner slots", handler: loadPractionerAvailableSlotsController, model: mocks.getPractionerAvailableTime },
		];

		const requestFor = (tenantQuery: Record<string, unknown>) => ({
			query: {
				...tenantQuery,
				employeeid: "1",
				patientid: "3",
				startDate: "2026-10-01",
				endDate: "2026-10-31",
				appointment_date: "2026-10-12",
			},
			params: { id: "7" },
			body: { purpose: "Review", patientid: 3 },
		});

		describe.each(endpoints)("$name", ({ handler, model }) => {
			it.each([
				{ tenantId: "957782" },
				{ tenant: "957782" },
				{ tenantId: "957782", tenant: "2" },
			])("passes the canonical or legacy tenant to the model: %j", async (tenantQuery) => {
				const response = res();
				await handler(requestFor(tenantQuery) as any, response);
				expect(response.statusCode).toBe(200);
				expect(model).toHaveBeenCalled();
				expect(model.mock.calls[0]).toHaveProperty("0", 957782);
			});

			it.each([
				{},
				{ tenantId: "" },
				{ tenantId: "0" },
				{ tenantId: "-1" },
				{ tenantId: "957782junk" },
				{ tenantId: "1.5" },
				{ tenantId: ["957782", "2"] },
				{ tenantId: { id: "957782" } },
				{ tenantId: "9007199254740992" },
				{ tenantId: "invalid", tenant: "957782" },
			])("rejects invalid tenants before database or notification access: %j", async (tenantQuery) => {
				const response = res();
				await handler(requestFor(tenantQuery) as any, response);
				expect(response.statusCode).toBe(400);
				expect(response.body).toMatchObject({
					status: "error",
					statusCode: 400,
					message: "A valid positive tenantId is required",
				});
				expect(model).not.toHaveBeenCalled();
				expect(mocks.getContext).not.toHaveBeenCalled();
				expect(mocks.dispatch).not.toHaveBeenCalled();
				expect(mocks.dispatchByContext).not.toHaveBeenCalled();
			});
		});
	});

	it("rejects uncontrolled appointment_type on update before reaching the model", async () => {
		const response = res();
		await updateAppointmentController({ query: { tenant: "2" }, params: { id: "7" }, body: { patientid: 3, purpose: "x", appointment_type: "mri" } } as any, response);
		expect(response.statusCode).toBe(400);
		expect(mocks.updateAppointment).not.toHaveBeenCalled();
	});

	it("passes normalized metadata on update", async () => {
		mocks.updateAppointment.mockResolvedValueOnce(true);
		const response = res();
		await updateAppointmentController({ query: { tenant: "2" }, params: { id: "7" }, body: { lead_id: "4", purpose: "x", appointment_type: "Ultrasound" } } as any, response);
		expect(mocks.updateAppointment).toHaveBeenCalledWith(2, 7, expect.objectContaining({ lead_id: 4, appointment_type: "ultrasound", patientid: undefined }));
		expect(response.body).toEqual({ success: true });
	});
});
