import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../database/KnexConnections", () => ({ default: vi.fn() }));
vi.mock("../billing/billing-new-client-multi", () => ({ SubmitCustomerBilling: class {} }));
vi.mock("../../hooks/logger", () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { AppointmentWorkflowService } from "./AppointmentWorkflowService";
import { AppointmentConflictError, AppointmentValidationError } from "./appointmentValidation";

type Row = Record<string, any>;

/** Minimal chainable Knex stand-in: resolves table reads from fixtures and records updates. */
function fakeDb(tables: Record<string, Row[]>) {
	const updates: Array<{ table: string; where: Row; values: Row }> = [];
	const db: any = (name: string) => {
		const table = name.split(" ")[0];
		const state: { where: Row; whereIn?: [string, any[]]; first: boolean } = { where: {}, first: false };
		const rows = () => (tables[table] ?? []).filter((row) =>
			Object.entries(state.where).every(([k, v]) => row[k] === v) &&
			(!state.whereIn || state.whereIn[1].includes(row[state.whereIn[0].replace(/^.*\./, "")])));
		const builder: any = {
			where: (cond: Row) => { Object.assign(state.where, cond); return builder; },
			whereIn: (col: string, values: any[]) => { state.whereIn = [col, values]; return builder; },
			innerJoin: () => builder, leftJoin: () => builder, select: () => builder, orderBy: () => builder,
			forUpdate: () => builder,
			first: () => { state.first = true; return builder; },
			update: async (values: Row) => { updates.push({ table, where: { ...state.where }, values }); return 1; },
			then: (resolve: any, reject: any) => Promise.resolve(state.first ? rows()[0] : rows()).then(resolve, reject),
		};
		return builder;
	};
	return { db, updates };
}

class TestService extends AppointmentWorkflowService {
	submit = vi.fn();
	protected submitter(payload: any, hooks: any) { return this.submit(payload, hooks); }
}

const appointment = { refid: 7, appointment_type: "laboratory", patientid: 9, status: "confirmed", billingid: null, service_ids: "[3,5]" };
const catalog = [
	{ id: 3, name: "FBC", price: 50, department: "Haematology" },
	{ id: 5, name: "Lipid profile", price: 80, department: "Chemistry" },
	{ id: 6, name: "Abdominal scan", price: 200, department: "Ultrasound" },
];
const body = { amountPayable: 130, cart: [{ testid: 5 }, { testid: 3 }], payments: [], paid: 0 };

let fixtures: Record<string, Row[]>;
beforeEach(() => {
	fixtures = {
		appointments: [{ ...appointment }],
		test_panels: catalog,
		new_patients: [{ patientid: 9, firstname: "Ama", lastname: "Mensah" }],
		billing: [],
	};
});

describe("AppointmentWorkflowService.services", () => {
	it("filters the billing catalog by department", async () => {
		const { db } = fakeDb(fixtures);
		const service = new AppointmentWorkflowService(2, db);
		expect((await service.services("ultrasound")).map((s) => s.id)).toEqual([6]);
		expect((await service.services("laboratory")).map((s) => s.id)).toEqual([3, 5]);
		await expect(service.services("consultation")).rejects.toBeInstanceOf(AppointmentValidationError);
	});
});

describe("AppointmentWorkflowService.workflow", () => {
	it("returns the booked services, total and a convertible stage", async () => {
		const { db } = fakeDb(fixtures);
		const view = await new AppointmentWorkflowService(2, db).workflow(7);
		expect(view.services.map((s) => s.name)).toEqual(["FBC", "Lipid profile"]);
		expect(view.estimatedTotal).toBe(130);
		expect(view.stage).toBe("booked");
		expect(view.canConvert).toBe(true);
		expect(view.patient).toMatchObject({ firstname: "Ama" });
	});

	it("reports blockers and payment stage", async () => {
		fixtures.appointments = [{ ...appointment, service_ids: null, status: "cancelled" }];
		let view = await new AppointmentWorkflowService(2, fakeDb(fixtures).db).workflow(7);
		expect(view.canConvert).toBe(false);
		expect(view.blockers.join(" ")).toMatch(/Select the booked services.*cancelled/);

		fixtures.appointments = [{ ...appointment, billingid: 40 }];
		fixtures.billing = [{ billingid: 40, paid: 130, outstanding: 0 }];
		view = await new AppointmentWorkflowService(2, fakeDb(fixtures).db).workflow(7);
		expect(view.stage).toBe("paid");
		expect(view.bill?.isPaid).toBe(true);
		expect(view.canConvert).toBe(false);
	});

	it("404s for unknown appointments", async () => {
		const error = await new AppointmentWorkflowService(2, fakeDb(fixtures).db).workflow(99).catch((e) => e);
		expect(error).toBeInstanceOf(AppointmentValidationError);
		expect(error.statusCode).toBe(404);
	});
});

describe("AppointmentWorkflowService.convert", () => {
	it("submits a server-built General bill through the existing checkout and links the billing", async () => {
		const { db, updates } = fakeDb(fixtures);
		const service = new TestService(2, db);
		service.submit.mockImplementation(async (payload: any, hooks: any) => {
			expect(await hooks.beforeWrite(db)).toBeNull();
			await hooks.afterWrite(db, 900);
			return { status: true, message: "ok", billingid: 900 };
		});
		const result = await service.convert(7, 11, 4, { ...body, patientid: 999, employeeid: 999, tenantId: 77 });
		expect(result).toEqual({ status: true, message: "ok", billingid: 900 });
		const payload = service.submit.mock.calls[0][0];
		expect(payload).toMatchObject({ patientid: 9, employeeid: 11, branchid: 4, tenantId: 2, entitytype: "general", paid: 0 });
		expect(payload.cart).toEqual([{ testid: 3 }, { testid: 5 }]);
		expect(updates).toEqual([{ table: "appointments", where: { refid: 7 }, values: expect.objectContaining({ billingid: 900, converted_by: 11 }) }]);
	});

	it("returns the existing bill instead of creating a duplicate", async () => {
		fixtures.appointments = [{ ...appointment, billingid: 40 }];
		const service = new TestService(2, fakeDb(fixtures).db);
		expect(await service.convert(7, 11, 4, body)).toMatchObject({ status: true, billingid: 40 });
		expect(service.submit).not.toHaveBeenCalled();
	});

	it("returns the bill created concurrently when the locked row is already billed", async () => {
		const { db } = fakeDb(fixtures);
		const service = new TestService(2, db);
		service.submit.mockImplementation(async (_payload: any, hooks: any) => {
			fixtures.appointments[0].billingid = 41;
			return { status: true, message: "Request already converted.", billingid: await hooks.beforeWrite(db) };
		});
		expect(await service.convert(7, 11, 4, body)).toMatchObject({ billingid: 41 });
	});

	it("surfaces a 409 when services change between review and save", async () => {
		const { db } = fakeDb(fixtures);
		const service = new TestService(2, db);
		service.submit.mockImplementation(async (_payload: any, hooks: any) => {
			fixtures.appointments[0].service_ids = "[3]";
			try { await hooks.beforeWrite(db); } catch { /* checkout wraps errors */ }
			throw new Error("Failed to submit billing");
		});
		await expect(service.convert(7, 11, 4, body)).rejects.toBeInstanceOf(AppointmentConflictError);
	});

	it("rejects carts that differ from the booked services, payments and closed appointments", async () => {
		const service = new TestService(2, fakeDb(fixtures).db);
		await expect(service.convert(7, 11, 4, { ...body, cart: [{ testid: 3 }] })).rejects.toThrow(/exactly the services/);
		await expect(service.convert(7, 11, 4, { ...body, paid: 50 })).rejects.toThrow(/without payments/);
		await expect(service.convert(7, 11, 4, { cart: body.cart })).rejects.toThrow(/checkout total/);
		await expect(service.convert(7, 0, 4, body)).rejects.toThrow(/staff member/);

		fixtures.appointments = [{ ...appointment, status: "Cancelled" }];
		await expect(new TestService(2, fakeDb(fixtures).db).convert(7, 11, 4, body)).rejects.toBeInstanceOf(AppointmentConflictError);
		fixtures.appointments = [{ ...appointment, appointment_type: "consultation" }];
		await expect(new TestService(2, fakeDb(fixtures).db).convert(7, 11, 4, body)).rejects.toThrow(/laboratory and ultrasound/);
		expect(service.submit).not.toHaveBeenCalled();
	});
});
