import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createAppointment: vi.fn(),
	updateAppointment: vi.fn(),
	services: vi.fn(),
	workflow: vi.fn(),
	convert: vi.fn(),
	tenants: [] as number[],
	dispatch: vi.fn(async () => ({ success: true })),
}));
vi.mock("../../models/appointments/appointments", () => ({
	default: class {
		createAppointment = mocks.createAppointment;
		updateAppointment = mocks.updateAppointment;
	},
}));
vi.mock("../../models/appointments/AppointmentWorkflowService", () => ({
	AppointmentWorkflowService: class {
		constructor(tenantId: number) { mocks.tenants.push(tenantId); }
		services = mocks.services;
		workflow = mocks.workflow;
		convert = mocks.convert;
	},
}));
vi.mock("../../models/application/notifications/services/NotificationDispatcher", () => ({
	NotificationDispatcher: { dispatch: mocks.dispatch, dispatchByContext: mocks.dispatch },
}));
vi.mock("../../models/application/notifications/context/providers/AppointmentContextProvider", () => ({
	AppointmentContextProvider: class { getContext = vi.fn(); },
}));

import {
	convertAppointmentController,
	createAppointmentController,
	getAppointmentServicesController,
	getAppointmentWorkflowController,
	updateAppointmentController,
} from "./controllerAppointment";
import { AppointmentConflictError, AppointmentValidationError } from "../../models/appointments/appointmentValidation";

function res() {
	const response: any = { statusCode: 200, body: undefined, headers: {} };
	response.status = vi.fn((code: number) => { response.statusCode = code; return response; });
	response.send = vi.fn((body: unknown) => { response.body = body; return response; });
	response.setHeader = vi.fn((k: string, v: string) => { response.headers[k] = v; });
	return response;
}
const staff = { employeeid: 11, role: "receptionist", branch: 4, tenantId: 2, email: "x@y" };
const req = (extra: Record<string, any> = {}) => ({ query: {}, params: { id: "7" }, body: {}, authUser: staff, ...extra }) as any;

beforeEach(() => {
	vi.clearAllMocks();
	mocks.tenants.length = 0;
});

describe("appointment workflow endpoints", () => {
	it("lists department-filtered services for the authenticated tenant", async () => {
		mocks.services.mockResolvedValue([{ id: 6 }]);
		const response = res();
		await getAppointmentServicesController(req({ query: { appointment_type: "ultrasound", tenantId: "99" } }), response);
		expect(mocks.tenants).toEqual([2]);
		expect(mocks.services).toHaveBeenCalledWith("ultrasound");
		expect(response.body).toEqual({ status: "success", statusCode: 200, data: [{ id: 6 }] });
	});

	it("returns the workflow view and maps 404s", async () => {
		mocks.workflow.mockResolvedValueOnce({ stage: "booked" });
		let response = res();
		await getAppointmentWorkflowController(req(), response);
		expect(mocks.workflow).toHaveBeenCalledWith(7);
		expect(response.body.data).toEqual({ stage: "booked" });

		mocks.workflow.mockRejectedValueOnce(new AppointmentValidationError("Appointment not found", 404));
		response = res();
		await getAppointmentWorkflowController(req(), response);
		expect(response.statusCode).toBe(404);
	});

	it("converts with the session's employee, branch and tenant, ignoring body identities", async () => {
		mocks.convert.mockResolvedValue({ status: true, message: "ok", billingid: 900 });
		const response = res();
		await convertAppointmentController(req({ body: { employeeid: 1, branchid: 99, cart: [] } }), response);
		expect(mocks.tenants).toEqual([2]);
		expect(mocks.convert).toHaveBeenCalledWith(7, 11, 4, { employeeid: 1, branchid: 99, cart: [] });
		expect(response.body).toEqual({ status: true, message: "ok", billingid: 900 });
	});

	it("rejects portal roles and unauthenticated calls", async () => {
		for (const role of ["patient", "clinician"]) {
			const response = res();
			await convertAppointmentController(req({ authUser: { ...staff, role } }), response);
			expect(response.statusCode).toBe(403);
		}
		const response = res();
		await convertAppointmentController(req({ authUser: undefined }), response);
		expect(response.statusCode).toBe(401);
		expect(mocks.convert).not.toHaveBeenCalled();
	});

	it("maps conflicts to 409 and hides unexpected errors", async () => {
		mocks.convert.mockRejectedValueOnce(new AppointmentConflictError("changed"));
		let response = res();
		await convertAppointmentController(req(), response);
		expect(response.statusCode).toBe(409);

		mocks.convert.mockRejectedValueOnce(new Error("ER_LOCK_DEADLOCK select * from billing"));
		response = res();
		await convertAppointmentController(req(), response);
		expect(response.statusCode).toBe(500);
		expect(response.body.message).not.toMatch(/ER_|select/);

		response = res();
		await convertAppointmentController(req({ params: { id: "abc" } }), response);
		expect(response.statusCode).toBe(400);
	});
});

describe("appointment booking conflicts", () => {
	it("returns 409 with the duplicate-booking message on create", async () => {
		mocks.createAppointment.mockRejectedValue(new AppointmentConflictError("This patient already has an appointment"));
		const response = res();
		await createAppointmentController(req({ query: { tenantId: "2", employeeid: "5" }, body: { patientid: 9 } }), response);
		expect(response.statusCode).toBe(409);
		expect(response.body).toMatchObject({ status: "error", message: "This patient already has an appointment" });
		expect(mocks.dispatch).not.toHaveBeenCalled();
	});

	it("passes parsed service ids through updates and rejects invalid ones", async () => {
		mocks.updateAppointment.mockResolvedValue(true);
		const body = { patientid: 9, purpose: "Lab", appointment_type: "laboratory", service_ids: [5, "3"] };
		let response = res();
		await updateAppointmentController(req({ query: { tenantId: "2" }, body }), response);
		expect(mocks.updateAppointment).toHaveBeenCalledWith(2, 7, expect.objectContaining({ service_ids: [3, 5] }));

		response = res();
		await updateAppointmentController(req({ query: { tenantId: "2" }, body: { ...body, service_ids: [-1] } }), response);
		expect(response.statusCode).toBe(400);
	});
});
