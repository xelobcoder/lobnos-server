import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../../hooks/helper", () => ({
	promisifyQuery: mocks.query,
	rowAffected: (result: any) => Boolean(result?.affectedRows),
}));

import Appointment from "./appointments";
import { AppointmentValidationError } from "./appointmentValidation";

type Handler = (sql: string, values: any[]) => any;
function respond(handler: Handler) {
	mocks.query.mockImplementation(async (_tenant: number, sql: string, values: any[]) => handler(sql, values));
}
const calls = () => mocks.query.mock.calls.map(([tenant, sql, values]) => ({ tenant, sql: String(sql), values }));
const insertCall = () => calls().find((c) => c.sql.startsWith("INSERT INTO appointments"));

const base = {
	duration: 30, appointment_date: "2026-10-20", appointment_time: "09:00", inviteMethod: "sms",
	purpose: "Review", title: "Visit", preference: "in-person", practioner: 4, location: "Main",
};

beforeEach(() => {
	mocks.query.mockReset();
});

describe("Appointment.createAppointment", () => {
	it("stores legacy patient payloads as consultations without lookups", async () => {
		respond((sql) => (sql.startsWith("INSERT") ? { insertId: 11, affectedRows: 1 } : []));
		const result = await new Appointment(1).createAppointment(3, { ...base, patientid: 9 } as any);
		expect(result).toEqual({ success: true, appointmentId: 11, refid: 11 });
		expect(insertCall()!.sql).toContain("appointment_type,lead_id,billingid");
		expect(insertCall()!.values).toEqual([9, 30, "09:00", "2026-10-20", "sms", "Review", "Visit", "in-person", 4, "Main", "consultation", null, null]);
		expect(calls().every((c) => c.tenant === 3)).toBe(true);
		expect(calls().some((c) => /FROM (leads|billing)/.test(c.sql))).toBe(false);
	});

	it("creates lead-only appointments after verifying the lead in the same tenant", async () => {
		respond((sql) => (sql.includes("FROM leads") ? [{ id: 5 }] : sql.startsWith("INSERT") ? { insertId: 12 } : []));
		await new Appointment(1).createAppointment(3, { ...base, lead_id: 5, appointment_type: "follow_up" } as any);
		expect(calls().find((c) => c.sql.includes("FROM leads"))).toMatchObject({ tenant: 3, values: [5] });
		expect(insertCall()!.values.slice(-3)).toEqual(["follow_up", 5, null]);
		expect(insertCall()!.values[0]).toBeNull();
	});

	it("rejects unknown leads and billings for another patient without inserting", async () => {
		respond(() => []);
		await expect(new Appointment(1).createAppointment(3, { ...base, lead_id: 99 } as any)).rejects.toBeInstanceOf(AppointmentValidationError);

		respond((sql) => (sql.includes("FROM billing") ? [{ patientid: 2 }] : []));
		await expect(new Appointment(1).createAppointment(3, { ...base, patientid: 9, billingid: 40, appointment_type: "ultrasound" } as any))
			.rejects.toThrow(/different patient/);
		expect(insertCall()).toBeUndefined();
	});

	it("links a lab/ultrasound workflow billing owned by the patient", async () => {
		respond((sql) => (sql.includes("FROM billing") ? [{ patientid: 9 }] : sql.startsWith("INSERT") ? { insertId: 13 } : []));
		await new Appointment(1).createAppointment(3, { ...base, patientid: 9, billingid: 40, appointment_type: "laboratory" } as any);
		expect(insertCall()!.values.slice(-3)).toEqual(["laboratory", null, 40]);
	});

	it("requires a patient or lead link", async () => {
		await expect(new Appointment(1).createAppointment(3, { ...base } as any)).rejects.toBeInstanceOf(AppointmentValidationError);
		expect(mocks.query).not.toHaveBeenCalled();
	});
});

describe("Appointment.updateAppointment", () => {
	const legacyUpdate = { ...base, patientid: 9, status: "confirmed" };

	it("keeps legacy updates from touching type/lead/workflow columns", async () => {
		respond((sql) => (sql.startsWith("SELECT * FROM appointments") ? [{ refid: 7, patientid: 9 }] : { affectedRows: 1 }));
		expect(await new Appointment(0).updateAppointment(3, 7, legacyUpdate as any)).toBe(true);
		const update = calls().find((c) => c.sql.startsWith("UPDATE"))!;
		expect(update.sql).toContain("patientid = ?");
		expect(update.sql).not.toMatch(/appointment_type|lead_id|billingid/);
		expect(update.values.slice(-2)).toEqual([9, 7]);
	});

	it("does not clear patientid when a client omits it", async () => {
		respond(() => ({ affectedRows: 1 }));
		const { patientid, ...rest } = legacyUpdate;
		await new Appointment(0).updateAppointment(3, 7, rest as any);
		expect(calls().find((c) => c.sql.startsWith("UPDATE"))!.sql).not.toContain("patientid");
	});

	it("validates the merged state before changing type or links", async () => {
		respond((sql) => (sql.startsWith("SELECT * FROM appointments") ? [{ refid: 7, patientid: 9, lead_id: null, billingid: null, appointment_type: null }] : { affectedRows: 1 }));
		await new Appointment(0).updateAppointment(3, 7, { ...legacyUpdate, appointment_type: "ultrasound" } as any);
		const update = calls().find((c) => c.sql.startsWith("UPDATE"))!;
		expect(update.sql).toMatch(/appointment_type = \?/);
		expect(update.values).toContain("ultrasound");

		mocks.query.mockClear();
		await expect(new Appointment(0).updateAppointment(3, 7, { ...legacyUpdate, patientid: null } as any))
			.rejects.toThrow(/patient \(patientid\) or a CRM lead/);
		expect(calls().some((c) => c.sql.startsWith("UPDATE"))).toBe(false);
	});
});

describe("Appointment reads", () => {
	it("renders legacy rows without a type as consultation", async () => {
		respond(() => [{ refid: 7, patientid: 9 }]);
		expect(await new Appointment(0).getAppointmentDetails(3, 7)).toMatchObject({ appointment_type: "consultation", lead_id: null, billingid: null });
	});

	it("queries an inclusive bounded date range for calendar requests", async () => {
		respond((sql) => sql.includes("information_schema.TABLES")
			? [{ table_name: "leads" }]
			: [{ refid: 1, appointment_type: "laboratory" }]);
		const rows = await new Appointment(0).loadAppointmentsInRange(3, "2026-02-01", "2026-02-28");
		const call = calls().find((item) => item.sql.includes("ta.appointment_date BETWEEN ? AND ?"))!;
		expect(calls()[0].sql).toContain("information_schema.TABLES");
		expect(call.sql).toContain("ta.appointment_date BETWEEN ? AND ?");
		expect(call.sql).toContain("LEFT JOIN leads AS l");
		expect(call.sql).toContain("LEFT JOIN new_patients AS np");
		expect(call.sql).not.toContain("MONTH(");
		expect(call.values).toEqual(["2026-02-01", "2026-02-28"]);
		expect(rows).toEqual([{ refid: 1, appointment_type: "laboratory", lead_id: null, billingid: null }]);
	});

	it("keeps calendar reads working when the tenant has no CRM leads table", async () => {
		respond((sql) => sql.includes("information_schema.TABLES") ? [] : []);
		await new Appointment(0).loadAppointmentsInRange(3, "2026-02-01", "2026-02-28");
		const query = calls().find((item) => item.sql.includes("ta.appointment_date BETWEEN ? AND ?"))!;
		expect(query.sql).not.toContain("LEFT JOIN leads AS l");
		expect(query.sql).toContain("NULL AS lead_name");
	});

	it("keeps the legacy month-only query", async () => {
		respond(() => [{ refid: 1 }]);
		await new Appointment(0).loadMonthAppointments(3, 2);
		expect(calls()[0].sql).toContain("WHERE MONTH(appointment_date) = ?");
		expect(calls()[0].values).toEqual([2]);
	});

	it("includes lead appointments in the list and never interpolates sortby", async () => {
		respond(() => []);
		await new Appointment(0).getAllAppointments(3, 1, 10, "ASC; DROP TABLE appointments" as any);
		const sql = calls()[0].sql;
		expect(sql).toContain("LEFT JOIN new_patients");
		expect(sql).toContain("np.patientid IS NOT NULL OR a.lead_id IS NOT NULL");
		expect(sql).toContain("ORDER BY refid DESC");
		expect(sql).not.toContain("DROP");
	});
});
