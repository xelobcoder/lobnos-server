import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../database/KnexConnections", () => ({ default: vi.fn() }));
vi.mock("../../hooks/logger", () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../application/notifications/services/NotificationDispatcher", () => ({ NotificationDispatcher: { dispatch: vi.fn() } }));

import { isRetryableReminderFailure, REMINDER_MAX_ATTEMPTS, sweepAppointmentReminders } from "./AppointmentReminderWorker";

type Due = Record<string, number[]>;

/** Fake Knex capturing the due-query filters and the claim/release updates. */
function fakeDb(due: Due, opts: { hasColumn?: boolean; claimed?: (refid: number, column: string) => number } = {}) {
	const selects: Array<{ nulls: string[]; wheres: any[]; raws: Array<[string, any[]]> }> = [];
	const updates: Array<{ refid: number; nullGuard: string[]; values: Record<string, any> }> = [];
	const db: any = () => {
		const state = { nulls: [] as string[], wheres: [] as any[], raws: [] as Array<[string, any[]]>, refid: 0 };
		const builder: any = {
			select: () => builder,
			whereNull: (col: string) => { state.nulls.push(col); return builder; },
			whereNotNull: () => builder,
			where: (...args: any[]) => {
				if (typeof args[0] === "object") state.refid = args[0].refid; else state.wheres.push(args);
				return builder;
			},
			whereRaw: (sql: string, values: any[] = []) => { state.raws.push([sql, values]); return builder; },
			orderBy: () => builder,
			limit: async () => {
				selects.push(state);
				const column = state.nulls[0];
				return (due[column] ?? []).map((refid) => ({ refid }));
			},
			update: async (values: Record<string, any>) => {
				updates.push({ refid: state.refid, nullGuard: [...state.nulls], values });
				return state.nulls.length ? (opts.claimed?.(state.refid, state.nulls[0]) ?? 1) : 1;
			},
		};
		return builder;
	};
	db.schema = { hasColumn: vi.fn(async () => opts.hasColumn ?? true) };
	db.fn = { now: () => "NOW()" };
	db.raw = (sql: string) => ({ raw: sql });
	return { db, selects, updates };
}

const queued = { success: true, channels: { sms: { status: "queued" as const } } };

beforeEach(() => vi.clearAllMocks());

describe("isRetryableReminderFailure", () => {
	it("retries queue failures but not configuration outcomes", () => {
		expect(isRetryableReminderFailure(queued as any)).toBe(false);
		expect(isRetryableReminderFailure(null)).toBe(true);
		expect(isRetryableReminderFailure({ success: false, reason: "Notification could not be queued" } as any)).toBe(true);
		expect(isRetryableReminderFailure({ success: true, channels: { sms: { status: "failed" } } } as any)).toBe(true);
		expect(isRetryableReminderFailure({ success: false, reason: "Notification event not found or inactive" } as any)).toBe(false);
		expect(isRetryableReminderFailure({ success: false, reason: "Valid appointment reference/context is required" } as any)).toBe(false);
	});
});

describe("sweepAppointmentReminders", () => {
	it("does nothing until the reminder columns exist", async () => {
		const { db, selects } = fakeDb({}, { hasColumn: false });
		const dispatch = vi.fn();
		expect(await sweepAppointmentReminders(2, { db, dispatch })).toEqual({ sent: 0, skipped: 0, failed: 0 });
		expect(selects).toHaveLength(0);
		expect(dispatch).not.toHaveBeenCalled();
	});

	it("queries 24h and 30m windows that exclude closed appointments and exhausted retries", async () => {
		const { db, selects } = fakeDb({});
		await sweepAppointmentReminders(2, { db, dispatch: vi.fn() });
		expect(selects.map((s) => s.nulls[0])).toEqual(["reminder_24h_sent_at", "reminder_30m_sent_at"]);
		for (const select of selects) {
			expect(select.wheres).toContainEqual(["reminder_attempts", "<", REMINDER_MAX_ATTEMPTS]);
			const statusFilter = select.raws.find(([sql]) => sql.includes("NOT IN"))!;
			expect(statusFilter[1]).toEqual(expect.arrayContaining(["cancelled", "completed", "missed"]));
		}
		const windows = selects.map((s) => s.raws.filter(([sql]) => sql.includes("INTERVAL")).map(([, v]) => v[0]));
		expect(windows).toEqual([[60, 1440], [0, 30]]);
	});

	it("claims each reminder once and dispatches APPOINTMENT_REMINDER", async () => {
		const { db, updates } = fakeDb({ reminder_24h_sent_at: [7], reminder_30m_sent_at: [8] });
		const dispatch = vi.fn().mockResolvedValue(queued);
		expect(await sweepAppointmentReminders(2, { db, dispatch })).toEqual({ sent: 2, skipped: 0, failed: 0 });
		expect(dispatch.mock.calls).toEqual([[2, 7, "24h"], [2, 8, "30m"]]);
		expect(updates).toEqual([
			{ refid: 7, nullGuard: ["reminder_24h_sent_at"], values: { reminder_24h_sent_at: "NOW()" } },
			{ refid: 8, nullGuard: ["reminder_30m_sent_at"], values: { reminder_30m_sent_at: "NOW()" } },
		]);
	});

	it("skips reminders another worker already claimed", async () => {
		const { db } = fakeDb({ reminder_30m_sent_at: [8] }, { claimed: () => 0 });
		const dispatch = vi.fn();
		expect(await sweepAppointmentReminders(2, { db, dispatch })).toMatchObject({ skipped: 1, sent: 0 });
		expect(dispatch).not.toHaveBeenCalled();
	});

	it("releases the claim and counts an attempt when dispatch fails", async () => {
		const { db, updates } = fakeDb({ reminder_30m_sent_at: [8] });
		const dispatch = vi.fn().mockRejectedValue(new Error("redis down"));
		expect(await sweepAppointmentReminders(2, { db, dispatch })).toMatchObject({ failed: 1 });
		expect(updates[1]).toEqual({
			refid: 8, nullGuard: [],
			values: { reminder_30m_sent_at: null, reminder_attempts: { raw: "reminder_attempts + 1" } },
		});
	});

	it("keeps the sent flag when the reminder event is disabled", async () => {
		const { db, updates } = fakeDb({ reminder_24h_sent_at: [7] });
		const dispatch = vi.fn().mockResolvedValue({ success: false, reason: "Notification event not found or inactive" });
		expect(await sweepAppointmentReminders(2, { db, dispatch })).toMatchObject({ sent: 1, failed: 0 });
		expect(updates).toHaveLength(1);
	});
});
