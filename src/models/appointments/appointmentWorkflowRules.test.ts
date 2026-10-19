import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../../hooks/helper", () => ({
	promisifyQuery: mocks.query,
	rowAffected: (result: any) => Boolean(result?.affectedRows),
}));

import Appointment from "./appointments";
import {
	AppointmentConflictError,
	AppointmentValidationError,
	assertServicesAllowed,
	normalizeAppointmentRow,
	parseServiceIds,
	serviceMatchesType,
	storedServiceIds,
} from "./appointmentValidation";

type Handler = (sql: string, values: any[]) => any;
function respond(handler: Handler) {
	mocks.query.mockImplementation(async (_tenant: number, sql: string, values: any[]) => handler(sql, values));
}
const calls = () => mocks.query.mock.calls.map(([tenant, sql, values]) => ({ tenant, sql: String(sql), values }));
const insertCall = () => calls().find((c) => c.sql.startsWith("INSERT INTO appointments"));
const updateCall = () => calls().find((c) => c.sql.startsWith("UPDATE"));
const isDuplicateCheck = (sql: string) => sql.includes("AND (patientid = ?") || sql.includes("AND (lead_id = ?");
const isSlotCheck = (sql: string) => sql.startsWith("SELECT refid FROM appointments") && !isDuplicateCheck(sql);
const isCatalog = (sql: string) => sql.includes("FROM test_panels");

const base = {
	duration: 30, appointment_date: "2026-10-20", appointment_time: "09:00", inviteMethod: "sms",
	purpose: "Review", title: "Visit", preference: "in-person", practioner: 4, location: "Main",
};

beforeEach(() => { mocks.query.mockReset(); });

describe("service id helpers", () => {
	it("parses arrays and JSON text into sorted positive ids", () => {
		expect(parseServiceIds([5, "3"])).toEqual([3, 5]);
		expect(parseServiceIds("[7,2]")).toEqual([2, 7]);
		expect(parseServiceIds(undefined)).toBeUndefined();
		expect(parseServiceIds(null)).toEqual([]);
		expect(parseServiceIds("")).toEqual([]);
	});

	it("rejects invalid or oversized selections", () => {
		expect(() => parseServiceIds([0])).toThrow(AppointmentValidationError);
		expect(() => parseServiceIds([5, 5])).toThrow(/duplicates/);
		expect(() => parseServiceIds(["abc"])).toThrow(AppointmentValidationError);
		expect(() => parseServiceIds("not json")).toThrow(AppointmentValidationError);
		expect(() => parseServiceIds(Array.from({ length: 51 }, (_, i) => i + 1))).toThrow(AppointmentValidationError);
	});

	it("reads stored values leniently", () => {
		expect(storedServiceIds("[3,1]")).toEqual([1, 3]);
		expect(storedServiceIds("garbage")).toEqual([]);
		expect(storedServiceIds(null)).toEqual([]);
	});

	it("only allows services on lab/ultrasound appointments and matches departments", () => {
		expect(() => assertServicesAllowed("consultation", [1])).toThrow(AppointmentValidationError);
		expect(() => assertServicesAllowed("follow_up", [])).not.toThrow();
		expect(serviceMatchesType("ultrasound", "Ultrasound")).toBe(true);
		expect(serviceMatchesType("ultrasound", "Haematology")).toBe(false);
		expect(serviceMatchesType("laboratory", "ULTRASOUND")).toBe(false);
		expect(serviceMatchesType("laboratory", null)).toBe(true);
	});

	it("returns parsed service ids on rows that have the column", () => {
		expect(normalizeAppointmentRow({ refid: 1, service_ids: "[4,2]" })).toMatchObject({ service_ids: [2, 4] });
		expect(normalizeAppointmentRow({ refid: 1 })).not.toHaveProperty("service_ids");
	});
});

describe("Appointment.createAppointment workflow rules", () => {
	it("persists selected laboratory services after validating the catalog", async () => {
		respond((sql) => isCatalog(sql)
			? [{ id: 5, department: "Haematology" }, { id: 3, department: "Chemistry" }]
			: sql.startsWith("INSERT") ? { insertId: 20 } : []);
		const result = await new Appointment(1).createAppointment(3, { ...base, patientid: 9, appointment_type: "laboratory", service_ids: [5, 3] } as any);
		expect(result).toEqual({ success: true, appointmentId: 20, refid: 20 });
		expect(insertCall()!.sql).toContain("billingid,service_ids)");
		expect(insertCall()!.values.at(-1)).toBe("[3,5]");
		expect(calls().find((c) => isCatalog(c.sql))!.values).toEqual([3, 5]);
	});

	it("rejects laboratory services from the Ultrasound department and unknown services", async () => {
		respond((sql) => isCatalog(sql) ? [{ id: 5, department: "Ultrasound" }] : []);
		await expect(new Appointment(1).createAppointment(3, { ...base, patientid: 9, appointment_type: "laboratory", service_ids: [5] } as any))
			.rejects.toThrow(/Ultrasound/);
		await expect(new Appointment(1).createAppointment(3, { ...base, patientid: 9, appointment_type: "ultrasound", service_ids: [5, 6] } as any))
			.rejects.toThrow(/not found: 6/);
		expect(insertCall()).toBeUndefined();
	});

	it("rejects services on consultation appointments before any query", async () => {
		await expect(new Appointment(1).createAppointment(3, { ...base, patientid: 9, service_ids: [5] } as any))
			.rejects.toBeInstanceOf(AppointmentValidationError);
		expect(mocks.query).not.toHaveBeenCalled();
	});

	it("blocks a second live booking for the same patient at the same date and time with a 409", async () => {
		respond((sql) => isDuplicateCheck(sql) ? [{ refid: 44 }] : []);
		const error = await new Appointment(1).createAppointment(3, { ...base, patientid: 9 } as any).catch((e) => e);
		expect(error).toBeInstanceOf(AppointmentConflictError);
		expect(error.statusCode).toBe(409);
		expect(error.message).toMatch(/#44/);
		const check = calls().find((c) => isDuplicateCheck(c.sql))!;
		expect(check.values.slice(0, 3)).toEqual(["2026-10-20", "09:00", 9]);
		expect(check.sql).toMatch(/NOT IN/);
		expect(insertCall()).toBeUndefined();
	});

	it("checks the practitioner slot scoped to that practitioner and returns false when taken", async () => {
		respond((sql) => isSlotCheck(sql) ? [{ refid: 3 }] : []);
		expect(await new Appointment(1).createAppointment(3, { ...base, patientid: 9 } as any)).toBe(false);
		const slot = calls().find((c) => isSlotCheck(c.sql))!;
		expect(slot.sql).toContain("practioner = ?");
		expect(slot.values.at(-1)).toBe(4);
		expect(insertCall()).toBeUndefined();
	});
});

describe("Appointment.updateAppointment workflow rules", () => {
	const update = { ...base, patientid: 9, status: "confirmed" };
	const current = { refid: 7, patientid: 9, lead_id: null, billingid: null, appointment_type: "laboratory", service_ids: "[3]" };

	it("re-arms reminders when the schedule changes and excludes itself from the duplicate check", async () => {
		respond((sql) => sql.startsWith("SELECT * FROM appointments") ? [current] : sql.startsWith("UPDATE") ? { affectedRows: 1 } : []);
		expect(await new Appointment(0).updateAppointment(3, 7, update as any)).toBe(true);
		const sql = updateCall()!.sql;
		expect(sql).toMatch(/reminder_24h_sent_at = IF\(\(appointment_date <=> \? AND appointment_time <=> \?\), reminder_24h_sent_at, NULL\)/);
		expect(sql).toMatch(/reminder_attempts = IF\(.*reminder_attempts, 0\)/);
		expect(updateCall()!.values.slice(0, 6)).toEqual(["2026-10-20", "09:00", "2026-10-20", "09:00", "2026-10-20", "09:00"]);
		const dup = calls().find((c) => isDuplicateCheck(c.sql))!;
		expect(dup.sql).toContain("refid <> ?");
		expect(dup.values.at(-1)).toBe(7);
	});

	it("rejects rescheduling onto another live booking of the same patient", async () => {
		respond((sql) => sql.startsWith("SELECT * FROM appointments") ? [current] : isDuplicateCheck(sql) ? [{ refid: 8 }] : { affectedRows: 1 });
		await expect(new Appointment(0).updateAppointment(3, 7, update as any)).rejects.toBeInstanceOf(AppointmentConflictError);
		expect(updateCall()).toBeUndefined();
	});

	it("stores updated services and locks them once the appointment is billed", async () => {
		respond((sql) => sql.startsWith("SELECT * FROM appointments") ? [current]
			: isCatalog(sql) ? [{ id: 3, department: "Chemistry" }, { id: 4, department: null }]
				: sql.startsWith("UPDATE") ? { affectedRows: 1 } : []);
		await new Appointment(0).updateAppointment(3, 7, { ...update, service_ids: [4, 3] } as any);
		expect(updateCall()!.sql).toContain("service_ids = ?");
		expect(updateCall()!.values).toContain("[3,4]");

		mocks.query.mockReset();
		respond((sql) => sql.startsWith("SELECT * FROM appointments") ? [{ ...current, billingid: 40 }]
			: sql.includes("FROM billing") ? [{ patientid: 9 }] : { affectedRows: 1 });
		await expect(new Appointment(0).updateAppointment(3, 7, { ...update, service_ids: [4] } as any))
			.rejects.toBeInstanceOf(AppointmentConflictError);
		expect(updateCall()).toBeUndefined();
	});

	it("clears services when the appointment becomes a consultation", async () => {
		respond((sql) => sql.startsWith("SELECT * FROM appointments") ? [current] : sql.startsWith("UPDATE") ? { affectedRows: 1 } : []);
		await new Appointment(0).updateAppointment(3, 7, { ...update, appointment_type: "consultation" } as any);
		const call = updateCall()!;
		expect(call.sql).toContain("service_ids = ?");
		expect(call.values.at(-2)).toBeNull();
	});
});
