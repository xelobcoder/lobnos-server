import { afterEach, describe, expect, it, vi } from "vitest";
import { PharmacyManagement } from "./PharmacyManagement";

afterEach(() => vi.useRealTimers());

// Read adapter applies ordering and limits so historical visibility is exercised.
function database(tables: Record<string, any[]>) {
     return (table: string) => {
          let rows = [...(tables[table] || [])],
               take = Infinity,
               first = false;
          const orders: [string, string][] = [];
          const q: any = {
               where(key: any, op?: any, value?: any) {
                    rows = rows.filter((row) =>
                         typeof key === "object"
                              ? Object.entries(key).every(([k, v]) => row[k] === v)
                              : op === "<"
                                ? row[key] < value
                                : row[key] === op,
                    );
                    return q;
               },
               whereNull(key: string) {
                    rows = rows.filter((row) => row[key] == null);
                    return q;
               },
               whereRaw(_sql: string, bindings: any[]) {
                    rows = rows.filter(
                         (row) => String(row.financial_date || row.opened_at).slice(0, 10) < String(bindings[0]),
                    );
                    return q;
               },
               whereNotNull(key: string) {
                    rows = rows.filter((row) => row[key] != null);
                    return q;
               },
               whereIn(key: string, values: string[]) {
                    rows = rows.filter((row) => {
                         const value = row[key] instanceof Date ? row[key].toISOString().slice(0, 10) : String(row[key]).slice(0, 10);
                         return values.includes(value);
                    });
                    return q;
               },
               orderBy(key: string, direction = "asc") {
                    orders.push([key, direction]);
                    return q;
               },
               limit(n: number) {
                    take = n;
                    return q;
               },
               first() {
                    first = true;
                    return q;
               },
               join() {
                    return q;
               },
               select() {
                    return q;
               },
               sum() {
                    return q;
               },
               groupBy() {
                    return q;
               },
               then(resolve: any, reject: any) {
                    rows.sort((a, b) => {
                         for (const [key, direction] of orders) {
                              const n = String(a[key]).localeCompare(String(b[key]));
                              if (n) return direction === "desc" ? -n : n;
                         }
                         return 0;
                    });
                    return Promise.resolve(first ? rows[0] : rows.slice(0, take)).then(resolve, reject);
               },
          };
          return q;
     };
}

describe("financial-day recovery reads", () => {
     it("finds the oldest previous open day in this branch even outside recent history", async () => {
          const db = database({
               pharmacy_financial_days: [
                    { id: 1, branchid: 2, status: "open", opened_at: "2020-01-01", financial_date: "2020-01-01" },
                    { id: 2, branchid: 3, status: "open", opened_at: "2019-01-01", financial_date: "2019-01-01" },
                    ...Array.from({ length: 40 }, (_, n) => ({
                         id: n + 3,
                         branchid: 2,
                         status: "open",
                         opened_at: "2025-01-01",
                         financial_date: "2025-01-" + String(n + 1).padStart(2, "0"),
                    })),
               ],
          });
          const result = await new PharmacyManagement(db, 2, 1).setup();
          expect(result.previousDay.id).toBe(1);
          expect(result.days.some((day: any) => day.id === 1)).toBe(false);
     });
     it("retains all unresolved branch shifts and days beyond the recent limits without duplicates", async () => {
          const oldDay = { id: 1, branchid: 2, status: "open", financial_date: "2020-01-01" };
          const oldShift = { id: "old", branchid: 2, opened_at: "2020-01-01", reviewed_by: null };
          const db = database({
               pharmacy_financial_days: [
                    oldDay,
                    ...Array.from({ length: 40 }, (_, n) => ({
                         id: n + 2,
                         branchid: 2,
                         status: "open",
                         financial_date: "2025-" + n,
                    })),
               ],
               pharmacy_shifts: [
                    oldShift,
                    { id: "other", branchid: 3, reviewed_by: null },
                    ...Array.from({ length: 60 }, (_, n) => ({
                         id: n,
                         branchid: 2,
                         opened_at: "2025-" + n,
                         reviewed_by: 1,
                    })),
               ],
          });
          const result = await new PharmacyManagement(db, 2, 1).reports();
          expect(result.days).toContainEqual(oldDay);
          expect(result.shifts).toContainEqual(oldShift);
          expect(result.shifts.some((shift: any) => shift.id === "other")).toBe(false);
          expect(new Set(result.shifts.map((shift: any) => shift.id)).size).toBe(result.shifts.length);
     });
     it("includes the closed financial day of an unresolved old handover beyond recent history", async () => {
          const oldDay = { id: 1, branchid: 2, status: "closed", financial_date: "2020-01-01" };
          const db = database({
               pharmacy_financial_days: [
                    oldDay,
                    { id: 2, branchid: 3, status: "closed", financial_date: "2020-01-01" },
                    ...Array.from({ length: 40 }, (_, n) => ({
                         id: n + 3, branchid: 2, status: "closed", financial_date: new Date(Date.UTC(2025, 0, n + 1)).toISOString().slice(0, 10),
                    })),
               ],
               pharmacy_shifts: [
                    { id: "old", branchid: 2, financial_date: "2020-01-01", opened_at: "2020-01-01", reviewed_by: null },
               ],
          });
          const result = await new PharmacyManagement(db, 2, 1).reports();
          expect(result.days).toContainEqual(oldDay);
          expect(result.days.some((day: any) => day.branchid !== 2)).toBe(false);
          expect(result.days.filter((day: any) => day.id === oldDay.id)).toHaveLength(1);
     });
     it("identifies a reopened legacy day even when its audit event is outside recent history", async () => {
          vi.useFakeTimers();
          vi.setSystemTime(new Date("2026-11-03T10:00:00Z"));
          const legacy = { id: 1, branchid: 2, status: "open", financial_date: "2020-01-01", opened_at: null };
          const reopened = { id: 2, branchid: 2, status: "open", financial_date: "2020-01-02", opened_at: null };
          const db = database({
               pharmacy_financial_days: [
                    legacy,
                    reopened,
                    { id: 3, branchid: 2, status: "open", financial_date: "2020-01-03", opened_at: "2020-01-03" },
               ],
               pharmacy_financial_day_events: [
                    { id: "other-branch", branchid: 3, event_type: "reopened", financial_date: legacy.financial_date, created_at: "2020-01-04" },
                    { id: "reopen", branchid: 2, event_type: "reopened", financial_date: reopened.financial_date, created_at: "2020-01-04" },
                    ...Array.from({ length: 110 }, (_, n) => ({
                         id: `recent-${n}`, branchid: 2, event_type: "closed", financial_date: "2025-01-01", created_at: `2025-${String(n).padStart(3, "0")}`,
                    })),
               ],
          });
          const service = new PharmacyManagement(db, 2, 1);
          expect((await service.setup()).previousDay).toMatchObject({ id: reopened.id });
          const result = await service.reports();
          expect(result.days.find((day: any) => day.id === reopened.id)).toMatchObject({ explicitly_reopened: true });
          expect(result.days.find((day: any) => day.id === legacy.id).explicitly_reopened).not.toBe(true);
          expect(result.events.some((event: any) => event.id === "reopen")).toBe(false);
     });
});
