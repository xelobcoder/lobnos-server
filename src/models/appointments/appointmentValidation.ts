import { z } from "zod";
import { months } from "./appointmentTypes";

/**
 * Canonical appointment metadata contract shared by API and persistence.
 *
 * - `appointment_type`: controlled workflow/category. Legacy rows (NULL or unknown) read as `consultation`.
 * - `patientid`: optional link to `new_patients.patientid`.
 * - `lead_id`: optional link to CRM `leads.id`. At least one of `patientid` / `lead_id` is required.
 * - `billingid`: optional link to the lab/ultrasound workflow (`billing.billingid`). Only allowed for
 *   `laboratory` / `ultrasound` appointments that are linked to the billing's patient.
 */
export const APPOINTMENT_TYPES = ["consultation", "laboratory", "ultrasound", "follow_up"] as const;
export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];
export const DEFAULT_APPOINTMENT_TYPE: AppointmentType = "consultation";
export const WORKFLOW_APPOINTMENT_TYPES: readonly AppointmentType[] = ["laboratory", "ultrasound"];

/** Upper bound for an explicit calendar date range, in days (inclusive). */
export const MAX_CALENDAR_RANGE_DAYS = 366;

export class AppointmentValidationError extends Error {
	readonly statusCode = 400;
	constructor(message: string) {
		super(message);
		this.name = "AppointmentValidationError";
	}
}

const positiveId = z
	.union([z.number(), z.string().trim().regex(/^\d+$/)])
	.transform((value) => Number(value))
	.pipe(z.number().int().positive().max(4294967295));

const optionalNullableId = z.preprocess((value) => (value === "" ? null : value), positiveId.nullable().optional());

const appointmentTypeSchema = z.preprocess(
	(value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
	z.enum(APPOINTMENT_TYPES)
);

/** Metadata fields only; legacy appointment fields keep their existing (lenient) handling. */
export const appointmentMetadataSchema = z.object({
	patientid: optionalNullableId,
	lead_id: optionalNullableId,
	billingid: optionalNullableId,
	appointment_type: appointmentTypeSchema.nullable().optional(),
});

export type AppointmentMetadataInput = z.infer<typeof appointmentMetadataSchema>;

export type AppointmentLinks = {
	patientid: number | null;
	lead_id: number | null;
	billingid: number | null;
	appointment_type: AppointmentType;
};

function firstIssueMessage(error: z.ZodError): string {
	const issue = error.issues[0];
	const field = issue?.path?.join(".") || "appointment";
	if (field === "appointment_type") {
		return `Invalid appointment_type. Allowed values: ${APPOINTMENT_TYPES.join(", ")}`;
	}
	return `Invalid ${field}`;
}

/** Parses only the metadata keys present on the payload. Absent keys stay `undefined`. */
export function parseAppointmentMetadata(payload: Record<string, unknown> | null | undefined): AppointmentMetadataInput {
	const source = payload ?? {};
	const picked: Record<string, unknown> = {};
	for (const key of ["patientid", "lead_id", "billingid", "appointment_type"] as const) {
		if (source[key] !== undefined) picked[key] = source[key];
	}
	const result = appointmentMetadataSchema.safeParse(picked);
	if (!result.success) throw new AppointmentValidationError(firstIssueMessage(result.error));
	return result.data;
}

/** Cross-field rules applied to the effective (merged) appointment state. */
export function assertAppointmentLinks(links: AppointmentLinks): AppointmentLinks {
	if (!links.patientid && !links.lead_id) {
		throw new AppointmentValidationError("Appointment must be linked to a patient (patientid) or a CRM lead (lead_id)");
	}
	if (links.billingid) {
		if (!WORKFLOW_APPOINTMENT_TYPES.includes(links.appointment_type)) {
			throw new AppointmentValidationError(
				`billingid is only allowed for appointment_type ${WORKFLOW_APPOINTMENT_TYPES.join(" or ")}`
			);
		}
		if (!links.patientid) {
			throw new AppointmentValidationError("billingid requires the appointment to be linked to the billing patient (patientid)");
		}
	}
	return links;
}

/** Resolves links for a new appointment. */
export function resolveCreateLinks(payload: Record<string, unknown> | null | undefined): AppointmentLinks {
	const parsed = parseAppointmentMetadata(payload);
	return assertAppointmentLinks({
		patientid: parsed.patientid ?? null,
		lead_id: parsed.lead_id ?? null,
		billingid: parsed.billingid ?? null,
		appointment_type: parsed.appointment_type ?? DEFAULT_APPOINTMENT_TYPE,
	});
}

/** Legacy or unknown stored values render as the default type. */
export function normalizeAppointmentType(value: unknown): AppointmentType {
	if (typeof value === "string") {
		const candidate = value.trim().toLowerCase();
		if ((APPOINTMENT_TYPES as readonly string[]).includes(candidate)) return candidate as AppointmentType;
	}
	return DEFAULT_APPOINTMENT_TYPE;
}

/** Adds the canonical metadata fields to a stored row without removing legacy fields. */
export function normalizeAppointmentRow<T extends Record<string, any>>(row: T): T & {
	appointment_type: AppointmentType;
	lead_id: number | null;
	billingid: number | null;
} {
	if (!row || typeof row !== "object") return row as any;
	return {
		...row,
		appointment_type: normalizeAppointmentType(row.appointment_type),
		lead_id: row.lead_id ?? null,
		billingid: row.billingid ?? null,
	};
}

export function normalizeAppointmentRows<T extends Record<string, any>>(rows: T[] | unknown) {
	return Array.isArray(rows) ? rows.map((row) => normalizeAppointmentRow(row)) : rows;
}

// ---------------------------------------------------------------------------
// Calendar query resolution
// ---------------------------------------------------------------------------

export type AppointmentCalendarQuery =
	| { mode: "range"; startDate: string; endDate: string }
	| { mode: "month_year"; startDate: string; endDate: string; month: number; year: number }
	| { mode: "legacy_month"; month: number };

const pad = (value: number) => `${value}`.padStart(2, "0");

function parseDateOnly(value: unknown, field: string): { text: string; utc: number } {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
		throw new AppointmentValidationError(`${field} must be a date in YYYY-MM-DD format`);
	}
	const text = value.trim();
	const [year, month, day] = text.split("-").map(Number);
	const utc = Date.UTC(year, month - 1, day);
	const check = new Date(utc);
	if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
		throw new AppointmentValidationError(`${field} is not a valid calendar date`);
	}
	return { text, utc };
}

function parseMonthValue(value: unknown): number {
	const raw = typeof value === "string" ? value.trim().toLowerCase() : value;
	const month = typeof raw === "string" && !/^\d+$/.test(raw) ? (months as Record<string, number>)[raw] : Number(raw);
	if (!Number.isInteger(month) || month < 1 || month > 12) {
		throw new AppointmentValidationError("month must be 1-12 or an English month name");
	}
	return month;
}

/**
 * Resolves calendar filters. Precedence: `startDate`+`endDate` > `month`+`year` > legacy `month` only.
 * Legacy month-only requests keep the original MONTH()-across-all-years behavior for old clients.
 */
export function resolveAppointmentCalendarQuery(query: Record<string, unknown>, now: Date = new Date()): AppointmentCalendarQuery {
	const { startDate, endDate, month, year } = query ?? {};
	const has = (value: unknown) => value !== undefined && value !== null && value !== "";

	if (has(startDate) || has(endDate)) {
		if (!has(startDate) || !has(endDate)) {
			throw new AppointmentValidationError("startDate and endDate must be provided together");
		}
		const start = parseDateOnly(startDate, "startDate");
		const end = parseDateOnly(endDate, "endDate");
		if (start.utc > end.utc) throw new AppointmentValidationError("startDate must be on or before endDate");
		const spanDays = (end.utc - start.utc) / 86_400_000 + 1;
		if (spanDays > MAX_CALENDAR_RANGE_DAYS) {
			throw new AppointmentValidationError(`Date range cannot exceed ${MAX_CALENDAR_RANGE_DAYS} days`);
		}
		return { mode: "range", startDate: start.text, endDate: end.text };
	}

	if (has(year)) {
		const parsedYear = Number(typeof year === "string" ? year.trim() : year);
		if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 2999) {
			throw new AppointmentValidationError("year must be a four-digit year");
		}
		if (!has(month)) throw new AppointmentValidationError("month is required when year is provided");
		const parsedMonth = parseMonthValue(month);
		const lastDay = new Date(Date.UTC(parsedYear, parsedMonth, 0)).getUTCDate();
		return {
			mode: "month_year",
			month: parsedMonth,
			year: parsedYear,
			startDate: `${parsedYear}-${pad(parsedMonth)}-01`,
			endDate: `${parsedYear}-${pad(parsedMonth)}-${pad(lastDay)}`,
		};
	}

	// Legacy: identical parsing to the original controller (invalid values yield an empty result, not 400).
	const legacy = has(month) ? month : (now.getMonth() + 1).toString();
	const legacyMonth = typeof legacy === "string" && !isNaN(Number(legacy)) ? parseInt(legacy) : Number(legacy);
	return { mode: "legacy_month", month: legacyMonth };
}
