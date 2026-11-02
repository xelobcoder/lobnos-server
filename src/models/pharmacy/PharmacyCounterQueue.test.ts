import { describe, it, expect, vi } from "vitest";
vi.mock("../../database/KnexConnections", () => ({ default: vi.fn() }));
import { PharmacyCounterWorkflow, counterInvoiceReference } from "./PharmacyCounterWorkflow";

function fixture(role = "pharmacist", branch = 2) {
     const invoices = Array.from({ length: 28 }, (_, index) => ({
          id: `invoice-${index}`,
          code: `A${String(index).padStart(3, "0")}`,
          invoice_number: `INV-A${String(index).padStart(3, "0")}-${String(index + 1).padStart(5, "0")}`,
          branchid: index === 27 ? 3 : 2,
          status: index === 25 ? "unpaid" : index === 26 ? "collected" : "paid",
          total: "40.00",
          sale_id: `sale-${index}`,
          sequence: index + 1,
          created_at: new Date(2026, 9, index + 1),
          details: JSON.stringify({ customerName: `Customer ${index}`, lines: [{ name: "Medicine" }] }),
     }));
     const sales = invoices.map((invoice, index) => ({
          id: invoice.sale_id,
          branchid: invoice.branchid,
          status: index === 0 ? "reversed" : "completed",
          outstanding_amount: index === 1 ? "10.00" : "0.00",
     }));
     const calls: { table: string; method: string; args: unknown[] }[] = [];
     function db(table: string) {
          let rows = [...(table === "pharmacy_counter_invoices" ? invoices : table === "pharmacy_sales" ? sales : [])];
          let offset = 0,
               limit = rows.length;
          let counting = false;
          const query = {
               where(values: Record<string, unknown>) {
                    calls.push({ table, method: "where", args: [values] });
                    rows = rows.filter((row) =>
                         Object.entries(values).every(([key, value]) => row[key as keyof typeof row] === value),
                    );
                    return query;
               },
               whereIn(key: string, values: unknown[]) {
                    calls.push({ table, method: "whereIn", args: [key, values] });
                    rows = rows.filter((row) => values.includes(row[key as keyof typeof row]));
                    return query;
               },
               whereRaw(sql: string, bindings: string[]) {
                    calls.push({ table, method: "whereRaw", args: [sql, bindings] });
                    const term = bindings[0].slice(1, -1).toLowerCase();
                    rows = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(term));
                    return query;
               },
               clone() {
                    return { count: () => ({ first: async () => ({ total: rows.length }) }) };
               },
               count() {
                    counting = true;
                    return query;
               },
               first: async () => (counting ? { total: rows.length } : rows[0]),
               orderBy() {
                    return query;
               },
               limit(value: number) {
                    limit = value;
                    return query;
               },
               offset(value: number) {
                    offset = value;
                    return query;
               },
               select() {
                    return query;
               },
               then(resolve: (value: typeof rows) => unknown) {
                    return Promise.resolve(rows.slice(offset, offset + limit)).then(resolve);
               },
          };
          return query;
     }
     db.transaction = async <T>(action: (trx: typeof db) => Promise<T>) => action(db);
     return { workflow: new PharmacyCounterWorkflow(db, { role, branch, employeeid: 4 }, 1), calls, invoices };
}

describe("counter collection queue and exact invoice lookup", () => {
     it("accepts short codes and full references without discarding the invoice suffix", async () => {
          expect(counterInvoiceReference(" inv-dc20-00001 ")).toEqual({ invoice_number: "INV-DC20-00001" });
          expect(counterInvoiceReference("dc20")).toEqual({ code: "DC20" });
          expect(() => counterInvoiceReference("INV-DC20-bad")).toThrow("full invoice");
          const f = fixture();
          expect((await f.workflow.find(f.invoices[0].invoice_number)).id).toBe("invoice-0");
          await expect(f.workflow.find("INV-A000-99999")).rejects.toThrow("current branch");
          await expect(f.workflow.find(f.invoices[27].invoice_number)).rejects.toThrow("current branch");
     });
     it("defaults to paid invoices in this branch and batches sale lookups for only this page", async () => {
          const f = fixture(),
               result = await f.workflow.uncollected({ count: 10, page: 2 });
          expect(result).toMatchObject({ total: 25, page: 2, count: 10 });
          expect(result.invoices).toHaveLength(10);
          expect(result.invoices[0].id).toBe("invoice-10");
          expect(f.calls.filter((call) => call.table === "pharmacy_sales" && call.method === "whereIn")).toEqual([
               {
                    table: "pharmacy_sales",
                    method: "whereIn",
                    args: ["id", Array.from({ length: 10 }, (_, index) => `sale-${index + 10}`)],
               },
          ]);
          expect(
               f.calls
                    .filter((call) => call.method === "where")
                    .every((call) => (call.args[0] as { branchid: number }).branchid === 2),
          ).toBe(true);
     });
     it("includes unpaid invoices only when requested and excludes collected invoices", async () => {
          const f = fixture();
          expect((await f.workflow.uncollected({ status: "unpaid" })).invoices.map((row) => row.id)).toEqual([
               "invoice-25",
          ]);
          const all = await f.workflow.uncollected({ status: "all", count: 100 });
          expect(all.total).toBe(26);
          expect(all.invoices.some((row) => row.status === "collected")).toBe(false);
     });
     it("reports reversed and outstanding sales rather than silently making them releasable", async () => {
          const result = await fixture().workflow.uncollected({});
          expect(result.invoices[0]).toMatchObject({ status: "paid", saleStatus: "reversed", outstandingAmount: 0 });
          expect(result.invoices[1]).toMatchObject({ saleStatus: "completed", outstandingAmount: 10 });
     });
     it("binds customer/code/number search and clamps pages after filtering", async () => {
          const f = fixture(),
               result = await f.workflow.uncollected({ search: "Customer 24", page: 99, count: 10 });
          expect(result).toMatchObject({ total: 1, page: 1 });
          expect(result.invoices[0].id).toBe("invoice-24");
          const raw = f.calls.find((call) => call.method === "whereRaw")!;
          expect(raw.args[0]).toContain("invoice_number LIKE ?");
          expect(raw.args[1]).toEqual(["%Customer 24%", "%Customer 24%", "$.customerName", "%Customer 24%"]);
          expect(await f.workflow.uncollected({ search: "not found", page: 5 })).toMatchObject({
               total: 0,
               page: 1,
               invoices: [],
          });
     });
     it("rejects invalid pagination, filters, long searches and unauthorized roles", async () => {
          for (const input of [
               { page: 0 },
               { page: 1.5 },
               { count: 101 },
               { count: 0 },
               { status: "collected" },
               { search: "x".repeat(81) },
          ]) {
               await expect(fixture().workflow.uncollected(input)).rejects.toThrow();
          }
          await expect(fixture("scientist").workflow.uncollected({})).rejects.toThrow("authority");
          expect((await fixture("pharmacy_cashier").workflow.uncollected({})).total).toBe(25);
     });
});
