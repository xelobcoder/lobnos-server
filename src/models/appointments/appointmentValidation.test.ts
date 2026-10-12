import { describe, expect, it } from "vitest";
import {
	APPOINTMENT_TYPES,
	AppointmentValidationError,
	normalizeAppointmentRow,
	parseAppointmentMetadata,
	resolveAppointmentCalendarQuery,
	resolveCreateLinks,
} from "./appointmentValidation";

describe("appointment metadata contract", () => {
	it("exposes the controlled appointment_type values", () => {
		expect(APPOINTMENT_TYPES).toEqual(["consultation", "laboratory", "ultrasound", "follow_up"]);
	});

	it("defaults legacy create payloads to a consultation for the patient", () => {
		expect(resolveCreateLinks({ patientid: 7, title: "x" })).toEqual({
			patientid: 7, lead_id: null, billingid: null, appointment_type: "consultation",
		});
	});

	it("accepts lead-only appointments and numeric strings", () => {
		expect(resolveCreateLinks({ lead_id: "12", appointment_type: " Follow_Up " })).toMatchObject({
			patientid: null, lead_id: 12, appointment_type: "follow_up",
		});
	});

	it("requires a patient or a lead", () => {
		expect(() => resolveCreateLinks({ appointment_type: "consultation" })).toThrow(AppointmentValidationError);
	});

	it("rejects uncontrolled appointment types and bad ids", () => {
		expect(() => resolveCreateLinks({ patientid: 1, appointment_type: "mri" })).toThrow(/Allowed values/);
		expect(() => parseAppointmentMetadata({ lead_id: -3 })).toThrow(/lead_id/);
		expect(() => parseAppointmentMetadata({ patientid: "1 OR 1=1" })).toThrow(/patientid/);
	});

	it("only allows a workflow billingid on lab/ultrasound appointments linked to a patient", () => {
		expect(resolveCreateLinks({ patientid: 1, billingid: 9, appointment_type: "ultrasound" }).billingid).toBe(9);
		expect(() => resolveCreateLinks({ patientid: 1, billingid: 9 })).toThrow(/billingid is only allowed/);
		expect(() => resolveCreateLinks({ lead_id: 4, billingid: 9, appointment_type: "laboratory" })).toThrow(/patientid/);
	});

	it("renders legacy rows without a type as consultation and keeps legacy fields", () => {
		const row = normalizeAppointmentRow({ refid: 1, patientid: 3, purpose: "p" });
		expect(row).toEqual({ refid: 1, patientid: 3, purpose: "p", appointment_type: "consultation", lead_id: null, billingid: null });
		expect(normalizeAppointmentRow({ appointment_type: "unknown" }).appointment_type).toBe("consultation");
		expect(normalizeAppointmentRow({ appointment_type: "ultrasound" }).appointment_type).toBe("ultrasound");
	});
});

describe("calendar query resolution", () => {
	const now = new Date(2026, 9, 12);

	it("keeps legacy month-only behavior, including the current-month default", () => {
		expect(resolveAppointmentCalendarQuery({ month: "3" }, now)).toEqual({ mode: "legacy_month", month: 3 });
		expect(resolveAppointmentCalendarQuery({}, now)).toEqual({ mode: "legacy_month", month: 10 });
		expect(resolveAppointmentCalendarQuery({ month: "march" }, now).mode).toBe("legacy_month");
	});

	it("bounds month+year to a single calendar month (leap years included)", () => {
		expect(resolveAppointmentCalendarQuery({ month: "2", year: "2028" })).toMatchObject({
			mode: "month_year", startDate: "2028-02-01", endDate: "2028-02-29",
		});
		expect(resolveAppointmentCalendarQuery({ month: "december", year: 2026 })).toMatchObject({
			startDate: "2026-12-01", endDate: "2026-12-31",
		});
	});

	it("prefers an explicit inclusive date range", () => {
		expect(resolveAppointmentCalendarQuery({ startDate: "2026-01-01", endDate: "2026-01-31", month: "5", year: "2020" }))
			.toEqual({ mode: "range", startDate: "2026-01-01", endDate: "2026-01-31" });
	});

	it("rejects invalid or unbounded calendar filters", () => {
		expect(() => resolveAppointmentCalendarQuery({ startDate: "2026-01-01" })).toThrow(/together/);
		expect(() => resolveAppointmentCalendarQuery({ startDate: "2026-02-30", endDate: "2026-03-01" })).toThrow(/valid calendar date/);
		expect(() => resolveAppointmentCalendarQuery({ startDate: "2026-03-01", endDate: "2026-02-01" })).toThrow(/on or before/);
		expect(() => resolveAppointmentCalendarQuery({ startDate: "2025-01-01", endDate: "2026-12-31" })).toThrow(/exceed/);
		expect(() => resolveAppointmentCalendarQuery({ year: "2026" })).toThrow(/month is required/);
		expect(() => resolveAppointmentCalendarQuery({ year: "2026", month: "13" })).toThrow(/month must be/);
		expect(() => resolveAppointmentCalendarQuery({ year: "26", month: "1" })).toThrow(/year/);
	});
});
