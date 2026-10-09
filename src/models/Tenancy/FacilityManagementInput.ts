import { FacilityError } from './FacilityInput';

export const SUBSCRIPTION_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export type SubscriptionFrequency = typeof SUBSCRIPTION_FREQUENCIES[number];
export const FACILITY_STATUS_TARGETS = ['active', 'suspended'] as const;
export type FacilityStatusTarget = typeof FACILITY_STATUS_TARGETS[number];

/** Supported calendar range for plan start dates, payment dates and `asOf`. */
export const MIN_DATE = '2000-01-01';
export const MAX_DATE = '2100-12-31';
/** DECIMAL(12,2): at most 10 integer digits. */
export const MAX_AMOUNT_CENTS = 999_999_999_999; // < Number.MAX_SAFE_INTEGER: exact integer cents

/** Bounded view: past periods before the current one, and upcoming periods after it. */
export const PERIOD_WINDOW: Record<SubscriptionFrequency, { past: number; future: number }> = {
     daily: { past: 30, future: 7 },
     weekly: { past: 12, future: 4 },
     monthly: { past: 12, future: 3 },
     yearly: { past: 5, future: 1 },
};

// ---------- Money: exact decimal strings <-> integer cents; no fractional floating-point arithmetic ----------

const AMOUNT_PATTERN = /^(0|[1-9]\d{0,9})(?:\.(\d{1,2}))?$/;

export function parseAmountToCents(value: unknown, field = 'amount'): number {
     if (typeof value !== 'string' || !AMOUNT_PATTERN.test(value)) {
          throw new FacilityError(`${field} must be a decimal string with at most 10 integer digits and 2 decimal places, e.g. "150.00"`);
     }
     const [, whole, fraction = ''] = value.match(AMOUNT_PATTERN)!;
     const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
     if (cents <= 0) throw new FacilityError(`${field} must be greater than 0`);
     if (cents > MAX_AMOUNT_CENTS) throw new FacilityError(`${field} exceeds the maximum supported amount`);
     return cents;
}

export function formatCents(cents: number): string {
     if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('Cents must be a non-negative safe integer');
     const whole = Math.floor(cents / 100);
     const fraction = String(cents % 100).padStart(2, '0');
     return `${whole}.${fraction}`;
}

/** Normalizes a DECIMAL value read from MySQL (string) to exactly two decimal places. */
export function normalizeStoredAmount(value: unknown): string {
     const text = String(value ?? '').trim();
     const match = text.match(/^(\d+)(?:\.(\d+))?$/);
     if (!match) throw new Error('Stored amount is not a non-negative decimal');
     const fraction = (match[2] || '').padEnd(2, '0');
     if (/[1-9]/.test(fraction.slice(2))) throw new Error('Stored amount has more than two decimal places');
     return formatCents(Number(match[1]) * 100 + Number(fraction.slice(0, 2)));
}

// ---------- Calendar dates as UTC day numbers ----------

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function isLeapYear(year: number): boolean {
     return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month1: number): number {
     return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month1 - 1];
}

export function parseIsoDate(value: unknown, field: string): string {
     if (typeof value !== 'string') throw new FacilityError(`${field} must be a date string in YYYY-MM-DD format`);
     const match = value.match(DATE_PATTERN);
     if (!match) throw new FacilityError(`${field} must be a date string in YYYY-MM-DD format`);
     const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
     if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
          throw new FacilityError(`${field} is not a valid calendar date`);
     }
     if (value < MIN_DATE || value > MAX_DATE) throw new FacilityError(`${field} must be between ${MIN_DATE} and ${MAX_DATE}`);
     return value;
}

export function toDayNumber(iso: string): number {
     const [year, month, day] = iso.split('-').map(Number);
     return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

export function fromDayNumber(dayNumber: number): string {
     return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
     return fromDayNumber(toDayNumber(iso) + days);
}

/** Today's calendar date in UTC (server convention for `asOf` and `paidAt` checks). */
export function utcToday(now: Date = new Date()): string {
     return now.toISOString().slice(0, 10);
}

/** MySQL DATE values may arrive as 'YYYY-MM-DD' strings or as local-midnight Date objects (mysql2 default). */
export function storedDateToIso(value: unknown): string {
     if (value instanceof Date) {
          const pad = (n: number) => String(n).padStart(2, '0');
          return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
     }
     const text = String(value ?? '');
     if (!DATE_PATTERN.test(text.slice(0, 10))) throw new Error('Stored date is invalid');
     return text.slice(0, 10);
}

export function storedTimestampToIso(value: unknown): string | null {
     if (value === null || value === undefined) return null;
     const date = value instanceof Date ? value : new Date(String(value));
     if (Number.isNaN(date.getTime())) throw new Error('Stored timestamp is invalid');
     return date.toISOString();
}

// ---------- Period arithmetic anchored on startDate ----------

/**
 * Start of period `index` (0-based). Month/year periods are always computed from the original anchor,
 * never chained, and clamp to the last day of short months: anchor Jan 31 gives Feb 28/29, Mar 31, Apr 30.
 * A Feb 29 yearly anchor gives Feb 28 in non-leap years and Feb 29 again in leap years.
 */
export function periodStartAt(frequency: SubscriptionFrequency, anchor: string, index: number): string {
     if (!Number.isSafeInteger(index) || index < 0) throw new Error('Period index must be a non-negative integer');
     if (frequency === 'daily') return addDays(anchor, index);
     if (frequency === 'weekly') return addDays(anchor, index * 7);
     const [ay, am, ad] = anchor.split('-').map(Number);
     const totalMonths = (ay * 12 + (am - 1)) + (frequency === 'monthly' ? index : index * 12);
     const year = Math.floor(totalMonths / 12);
     const month = (totalMonths % 12) + 1;
     const day = Math.min(ad, daysInMonth(year, month));
     return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Index of the period containing `date`, or -1 if `date` is before the anchor. */
export function periodIndexOf(frequency: SubscriptionFrequency, anchor: string, date: string): number {
     if (date < anchor) return -1;
     const diff = toDayNumber(date) - toDayNumber(anchor);
     if (frequency === 'daily') return diff;
     if (frequency === 'weekly') return Math.floor(diff / 7);
     const [ay, am] = anchor.split('-').map(Number);
     const [dy, dm] = date.split('-').map(Number);
     const months = (dy - ay) * 12 + (dm - am);
     let index = frequency === 'monthly' ? months : Math.floor(months / 12);
     while (index > 0 && periodStartAt(frequency, anchor, index) > date) index--;
     while (periodStartAt(frequency, anchor, index + 1) <= date) index++;
     return index;
}

export interface CalendarPeriod { index: number; periodStart: string; periodEnd: string; dueDate: string; }

/** periodEnd is inclusive (day before the next start); billing is in advance so dueDate = periodStart. */
export function periodAt(frequency: SubscriptionFrequency, anchor: string, index: number): CalendarPeriod {
     const periodStart = periodStartAt(frequency, anchor, index);
     const periodEnd = addDays(periodStartAt(frequency, anchor, index + 1), -1);
     return { index, periodStart, periodEnd, dueDate: periodStart };
}

/** Index of the period that starts exactly on `periodStart`, or null if it is not a period boundary. */
export function exactPeriodIndex(frequency: SubscriptionFrequency, anchor: string, periodStart: string): number | null {
     const index = periodIndexOf(frequency, anchor, periodStart);
     return index >= 0 && periodStartAt(frequency, anchor, index) === periodStart ? index : null;
}

export interface PeriodWindow { firstIndex: number; lastIndex: number; currentIndex: number; }

export function boundedWindow(frequency: SubscriptionFrequency, anchor: string, asOf: string): PeriodWindow {
     const { past, future } = PERIOD_WINDOW[frequency];
     const currentIndex = periodIndexOf(frequency, anchor, asOf);
     if (currentIndex < 0) return { firstIndex: 0, lastIndex: future - 1, currentIndex };
     return { firstIndex: Math.max(0, currentIndex - past), lastIndex: currentIndex + future, currentIndex };
}

// ---------- Request bodies ----------

function body(value: unknown): Record<string, unknown> {
     if (!value || typeof value !== 'object' || Array.isArray(value)) throw new FacilityError('A JSON object body is required');
     return value as Record<string, unknown>;
}

function text(value: unknown, field: string, min: number, max: number): string {
     if (typeof value !== 'string') throw new FacilityError(`${field} must be a string`);
     const trimmed = value.trim();
     if (trimmed.length < min || trimmed.length > max) {
          throw new FacilityError(min > 0 ? `${field} is required and must be ${min}–${max} characters` : `${field} must be at most ${max} characters`);
     }
     return trimmed;
}

export function parseTenantIdParam(value: unknown): number {
     if (typeof value !== 'string' || !/^[1-9]\d{5}$/.test(value)) throw new FacilityError('tenantId must be a six-digit tenant ID');
     return Number(value);
}

export function parsePaymentIdParam(value: unknown): number {
     if (typeof value !== 'string' || !/^[1-9]\d{0,14}$/.test(value)) throw new FacilityError('paymentId must be a positive integer');
     return Number(value);
}

export function parseAsOf(value: unknown, today: string): string {
     return value === undefined ? today : parseIsoDate(value, 'asOf');
}

export const REASON_MIN = 3;
export const REASON_MAX = 500;

export function validateStatusChange(input: unknown): { status: FacilityStatusTarget; reason: string } {
     const value = body(input);
     if (!FACILITY_STATUS_TARGETS.includes(value.status as FacilityStatusTarget)) {
          throw new FacilityError(`status must be one of: ${FACILITY_STATUS_TARGETS.join(', ')}`);
     }
     return { status: value.status as FacilityStatusTarget, reason: text(value.reason, 'reason', REASON_MIN, REASON_MAX) };
}

export interface SubscriptionPlanInput { frequency: SubscriptionFrequency; amountCents: number; currency: string; startDate: string; }

export function validateSubscriptionPlan(input: unknown): SubscriptionPlanInput {
     const value = body(input);
     if (!SUBSCRIPTION_FREQUENCIES.includes(value.frequency as SubscriptionFrequency)) {
          throw new FacilityError(`frequency must be one of: ${SUBSCRIPTION_FREQUENCIES.join(', ')}`);
     }
     if (typeof value.currency !== 'string' || !/^[A-Z]{3}$/.test(value.currency)) {
          throw new FacilityError('currency must be a 3-letter uppercase ISO 4217 code, e.g. "GHS"');
     }
     return {
          frequency: value.frequency as SubscriptionFrequency,
          amountCents: parseAmountToCents(value.amount),
          currency: value.currency,
          startDate: parseIsoDate(value.startDate, 'startDate'),
     };
}

export interface PaymentInput { periodStart: string; paidAt: string; reference: string; notes: string; }

export function validatePaymentInput(input: unknown, today: string): PaymentInput {
     const value = body(input);
     const periodStart = parseIsoDate(value.periodStart, 'periodStart');
     const paidAt = parseIsoDate(value.paidAt, 'paidAt');
     // One day of tolerance for operators east of UTC entering their local date.
     if (paidAt > addDays(today, 1)) throw new FacilityError('paidAt cannot be in the future');
     const notes = value.notes === undefined ? '' : text(value.notes, 'notes', 0, 500);
     return { periodStart, paidAt, reference: text(value.reference, 'reference', 1, 100), notes };
}

export function validateVoidInput(input: unknown): { reason: string } {
     return { reason: text(body(input).reason, 'reason', REASON_MIN, REASON_MAX) };
}
export const AUDIT_PAGE_SIZE_DEFAULT = 25;
export const AUDIT_PAGE_SIZE_MAX = 100;
export const AUDIT_PAGE_MAX = 100_000;
export interface AuditQuery { page: number; pageSize: number; }

/**
 * Strict audit pagination: only `page` (1..100000) and `pageSize` (1..100) as plain decimal strings.
 * `tenantId` is tolerated because the platform authority middleware already validates it against the control tenant.
 */
export function parseAuditQuery(query: unknown): AuditQuery {
     const value = (query && typeof query === 'object' && !Array.isArray(query) ? query : {}) as Record<string, unknown>;
     const unknown = Object.keys(value).filter(key => !['page', 'pageSize', 'tenantId'].includes(key));
     if (unknown.length) throw new FacilityError(`Unsupported audit query parameter(s): ${unknown.map(key => key.slice(0, 30)).join(', ')}`);
     const integer = (raw: unknown, field: string, fallback: number, max: number) => {
          if (raw === undefined) return fallback;
          if (typeof raw !== 'string' || !/^[1-9]\d{0,5}$/.test(raw) || Number(raw) > max) {
               throw new FacilityError(`${field} must be an integer from 1 to ${max}`);
          }
          return Number(raw);
     };
     return {
          page: integer(value.page, 'page', 1, AUDIT_PAGE_MAX),
          pageSize: integer(value.pageSize, 'pageSize', AUDIT_PAGE_SIZE_DEFAULT, AUDIT_PAGE_SIZE_MAX),
     };
}