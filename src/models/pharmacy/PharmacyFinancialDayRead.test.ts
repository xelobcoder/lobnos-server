import { describe, expect, it } from "vitest";
import { PharmacyManagement } from "./PharmacyManagement";

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
});
