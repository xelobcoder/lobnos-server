import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("../../database/KnexConnections", () => ({ default: vi.fn() }));
import KnexConnection from "../../database/KnexConnections";
import { transactionalDatabase } from "../../testSupport/transactionalDatabase";
import { PharmacyCounterWorkflow, counterCode, normalizeCounterCode } from "./PharmacyCounterWorkflow";
const user = (role = "pharmacy_dispensary_officer", branch = 2, employeeid = 4) => ({
     role,
     branch,
     employeeid,
     tenantId: 1,
     email: "test@example.test",
});
function fixture(generator?: () => string) {
     const f = transactionalDatabase({
          pharmacy_checkout_settings: [{ branchid: 2, mode: "separate_cashier" }],
          pharmacy_counter_invoices: [],
          pharmacy_enterprise_requests: [],
          pharmacy_enterprise_events: [],
          roles: [{ employeeid: 4, username: "Attendant Name" }],
          pharmacy_inventory_items: [
               {
                    id: "drug",
                    name: "Medicine",
                    sku: "D",
                    branchid: 2,
                    is_active: true,
                    current_stock: 10,
                    min_stock: 1,
                    cost_price: 4,
                    sale_price: 40,
                    wholesale_price: 30,
                    pharmacy_batch_tracking: true,
                    requires_prescription: false,
               },
          ],
          pharmacy_stock_movements: [
               {
                    id: "receipt",
                    item_id: "drug",
                    branchid: 2,
                    transaction_type: "addition",
                    quantity: 10,
                    previous_stock: 0,
                    new_stock: 10,
                    unit_cost: 4,
                    total_cost: 40,
                    batch_number: "B",
                    expiry_date: "2099-12-31",
               },
          ],
          pharmacy_collection_accounts: [
               { id: 1, account_type: "cash", currency: "GHS", branchid: 2, is_active: true },
          ],
          pharmacy_payment_routes: [{ branchid: 2, method: "cash", account_id: 1 }],
          pharmacy_shifts: [{ id: "shift", active_key: "2:3" }],
          pharmacy_sales: [],
          pharmacy_sale_lines: [],
          pharmacy_payments: [],
          pharmacy_financial_days: [
               {
                    id: 1,
                    branchid: 2,
                    financial_date: new Date().toISOString().slice(0, 10),
                    status: "open",
                    opened_by: 3,
                    opened_at: new Date(),
               },
          ],
          pharmacy_journals: [],
          pharmacy_journal_lines: [],
          inv_inventory_items: [{ id: "lab", current_stock: 50 }],
          acc_posting_outbox: [],
     });
     vi.mocked(KnexConnection).mockResolvedValue(f.db);
     const attendant = new PharmacyCounterWorkflow(f.db, user(), 1, undefined, generator),
          cashier = new PharmacyCounterWorkflow(f.db, user("pharmacy_cashier", 2, 3), 1);
     return { ...f, attendant, cashier };
}
const invoice = (key = "invoice-request-001") => ({
     idempotencyKey: key,
     expectedTotal: 40,
     customerName: "Customer Name",
     lines: [{ inventoryItemId: "drug", quantity: 1 }],
     priceType: "retail",
});
const payment = (key = "payment-request-001") => ({ idempotencyKey: key, paymentMethod: "cash", amountTendered: 50 });
beforeEach(() => vi.clearAllMocks());
describe("separate pharmacy counter workflow", () => {
     it("reviews current prices and usable stock without changing the original invoice or reserving stock", async () => {
          const f = fixture();
          const ticket = await f.attendant.create({ ...invoice(), patientId: 99 });
          await f.db.transaction(async (trx: any) => {
               await trx("pharmacy_inventory_items").where({ id: "drug" }).forUpdate().first();
               await trx("pharmacy_inventory_items").where({ id: "drug" }).update({ sale_price: 47, current_stock: 0 });
               // Synthetic zero-stock opening balance must agree with its movement valuation.
               await trx("pharmacy_stock_movements").where({ id: "receipt" }).update({ quantity: 0, new_stock: 0, total_cost: 0 });
          });
          const review = await f.cashier.review(ticket.id);
          expect(review.invoice).toMatchObject({ status: "unpaid", total: 40, details: { customerName: "Customer Name", patientId: 99, priceType: "retail" } });
          expect(review).toMatchObject({ canRecover: false, refreshedTotal: 47 });
          expect(review.lines[0]).toMatchObject({ quantity: 1, salePrice: 47, dispensableStock: 0 });
          expect(review.lines[0].issue).toContain("Insufficient");
          expect(f.rows("pharmacy_counter_invoices")[0].status).toBe("unpaid");
          expect(f.rows("pharmacy_stock_movements")).toHaveLength(1);
          expect(f.rows("pharmacy_sales")).toHaveLength(0);
          await f.db.transaction(async (trx: any) => { await trx("pharmacy_inventory_items").where({ id: "drug" }).forUpdate().first(); await trx("pharmacy_inventory_items").where({ id: "drug" }).update({ is_active: false }); });
          const missing = await f.attendant.review(ticket.id);
          expect(missing.lines).toHaveLength(1);
          expect(missing.lines[0]).toMatchObject({ inventoryItemId: "drug", name: "Medicine", quantity: 1, unavailable: true });
     });
     it("authorizes recovery on the backend, scoped to branch and original attendant or manager", async () => {
          const f = fixture(), ticket = await f.attendant.create(invoice());
          const request = { idempotencyKey: "recover-original-001", reason: "Price changed" };
          await expect(f.cashier.recover(ticket.id, request)).rejects.toThrow("authority");
          const other = new PharmacyCounterWorkflow(f.db, user("pharmacist", 2, 8), 1);
          expect((await other.review(ticket.id)).canRecover).toBe(false);
          await expect(other.recover(ticket.id, request)).rejects.toThrow("original attendant");
          await expect(other.create({ ...invoice("other-create-001"), recoverySourceId: ticket.id })).rejects.toThrow("original attendant");
          const branch = new PharmacyCounterWorkflow(f.db, user("pharmacy_manager", 7, 8), 1);
          await expect(branch.review(ticket.id)).rejects.toThrow("branch");
          await expect(branch.recover(ticket.id, request)).rejects.toThrow("branch");
          await expect(f.attendant.recover(ticket.id, { ...request, reason: "" })).rejects.toThrow("reason");
          expect(f.rows("pharmacy_counter_invoices")[0].status).toBe("unpaid");
          const manager = new PharmacyCounterWorkflow(f.db, user("pharmacy_manager", 2, 8), 1);
          expect((await manager.recover(ticket.id, request)).invoice.status).toBe("cancelled");
     });
     it("recovers cancellation after a lost response and reissues at reviewed prices once, preserving both identities and wholesale mode", async () => {
          const f = fixture();
          const ticket = await f.attendant.create({ ...invoice(), priceType: "wholesale", expectedTotal: 30, patientId: 99 });
          const request = { idempotencyKey: "recovery-lost-response", reason: "Review changed price" };
          await f.db.transaction(async (trx: any) => { await trx("pharmacy_inventory_items").where({ id: "drug" }).forUpdate().first(); await trx("pharmacy_inventory_items").where({ id: "drug" }).update({ wholesale_price: 35 }); });
          const recovered = await f.attendant.recover(ticket.id, request);
          expect(await f.attendant.recover(ticket.id, request)).toEqual(JSON.parse(JSON.stringify(recovered)));
          expect((await f.attendant.recover(ticket.id, { ...request, idempotencyKey: "recover-after-refresh" })).lines).toHaveLength(1);
          const replacementInput = { ...invoice("replacement-lost-response"), recoverySourceId: ticket.id, customerName: "Tampered", patientId: 123, priceType: "retail", expectedTotal: 35 };
          const replacement = await f.attendant.create(replacementInput);
          expect(replacement.details).toMatchObject({ customerName: "Customer Name", patientId: 99, priceType: "wholesale", recoverySourceId: ticket.id });
          expect(replacement.total).toBe(35);
          expect(await f.attendant.create(replacementInput)).toEqual(replacement);
          expect((await f.attendant.create({ ...replacementInput, idempotencyKey: "replacement-new-key" })).id).toBe(replacement.id);
          expect(f.rows("pharmacy_counter_invoices")).toHaveLength(2);
          expect((await f.attendant.review(ticket.id)).replacement?.code).toBe(replacement.code);
          await expect(f.attendant.recover(ticket.id, { ...request, idempotencyKey: "recover-replaced-source" })).rejects.toThrow("already been reissued");
          expect(f.rows("pharmacy_sales")).toHaveLength(0);
          expect(f.rows("pharmacy_stock_movements")).toHaveLength(1);
          const paid = await f.cashier.pay(replacement.id, payment());
          expect(await f.cashier.pay(replacement.id, payment())).toEqual(JSON.parse(JSON.stringify(paid)));
          expect(f.rows("pharmacy_sales")).toHaveLength(1);
          expect(f.rows("pharmacy_payments")).toHaveLength(1);
          await expect(f.attendant.recover(replacement.id, { ...request, idempotencyKey: "recover-paid-invoice" })).rejects.toThrow("Only unpaid");
     });
     it("requires explicit cancellation, rejects stale prices and leaves cancelled baskets recoverable after reissue rejection", async () => {
          const f = fixture(), ticket = await f.attendant.create(invoice());
          const replacement = { ...invoice("reissue-before-cancel"), recoverySourceId: ticket.id };
          await expect(f.attendant.create(replacement)).rejects.toThrow("Explicitly cancel");
          await f.attendant.cancel(ticket.id, { idempotencyKey: "legacy-cancel-invoice", reason: "Changed price" });
          const recovered = await f.attendant.recover(ticket.id, { idempotencyKey: "legacy-source-recovery" });
          expect(recovered.invoice.status).toBe("cancelled");
          await f.db.transaction(async (trx: any) => { await trx("pharmacy_inventory_items").where({ id: "drug" }).forUpdate().first(); await trx("pharmacy_inventory_items").where({ id: "drug" }).update({ sale_price: 45 }); });
          await expect(f.attendant.create(replacement)).rejects.toThrow("Prices changed");
          expect((await f.attendant.review(ticket.id)).lines[0].salePrice).toBe(45);
          expect(f.rows("pharmacy_counter_invoices")).toHaveLength(1);
     });
     it("creates a four-character invoice without payment or stock movement, and retries return the same invoice", async () => {
          const f = fixture(() => "DC20");
          const ticket = await f.attendant.create(invoice());
          expect(ticket).toMatchObject({ code: "DC20", status: "unpaid", total: 40 });
          expect(ticket.invoice_number.startsWith("INV-DC20-")).toBe(true);
          expect(f.rows("pharmacy_sales")).toHaveLength(0);
          expect(f.rows("pharmacy_inventory_items")[0].current_stock).toBe(10);
          expect(f.rows("pharmacy_counter_invoices")[0].attendant_name).toBe("Attendant Name");
          expect(await f.attendant.create(invoice())).toEqual(ticket);
          expect(f.rows("pharmacy_counter_invoices")).toHaveLength(1);
          await expect(f.attendant.create({ ...invoice(), expectedTotal: 41 })).rejects.toThrow("Retry");
     });
     it("takes payment once, shares the normal ledger/stock path, then records collection once", async () => {
          const f = fixture();
          const ticket = await f.attendant.create(invoice());
          await expect(f.attendant.collect(ticket.id, { idempotencyKey: "collect-too-early" })).rejects.toThrow(
               "Only a paid",
          );
          const receipt = await f.cashier.pay(ticket.id, payment());
          expect(receipt).toMatchObject({
               total: 40,
               change: 10,
               receiptNumber: ticket.invoice_number,
               counterCode: ticket.code,
          });
          expect(f.rows("pharmacy_sales")).toHaveLength(1);
          expect(f.rows("pharmacy_inventory_items")[0].current_stock).toBe(9);
          expect(f.rows("pharmacy_payments")).toHaveLength(1);
          expect(await f.cashier.pay(ticket.id, payment())).toEqual(JSON.parse(JSON.stringify(receipt)));
          await expect(f.cashier.pay(ticket.id, payment("another-pay-key"))).rejects.toThrow(
               "do not collect payment again",
          );
          const collected = await f.attendant.collect(ticket.id, { idempotencyKey: "collect-request-001" });
          expect(collected.status).toBe("collected");
          expect(await f.attendant.collect(ticket.id, { idempotencyKey: "collect-request-001" })).toEqual(collected);
          await expect(f.attendant.collect(ticket.id, { idempotencyKey: "collect-request-002" })).rejects.toThrow(
               "Only a paid",
          );
          expect(f.rows("pharmacy_inventory_items")[0].current_stock).toBe(9);
          expect(f.rows("inv_inventory_items")[0].current_stock).toBe(50);
     });
     it("serializes competing payments and never charges twice", async () => {
          const f = fixture();
          const ticket = await f.attendant.create(invoice());
          const result = await Promise.allSettled([
               f.cashier.pay(ticket.id, payment("parallel-pay-one")),
               f.cashier.pay(ticket.id, payment("parallel-pay-two")),
          ]);
          expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
          expect(f.rows("pharmacy_payments")).toHaveLength(1);
     });
     it("rechecks current prices and rolls back the invoice/payment when prices change", async () => {
          const f = fixture();
          const ticket = await f.attendant.create(invoice());
          await f.db.transaction(async (trx: any) => {
               await trx("pharmacy_inventory_items").where({ id: "drug" }).forUpdate().first();
               await trx("pharmacy_inventory_items").where({ id: "drug" }).update({ sale_price: 45 });
          });
          await expect(f.cashier.pay(ticket.id, payment())).rejects.toThrow("Prices changed");
          expect(f.rows("pharmacy_sales")).toHaveLength(0);
          expect(f.rows("pharmacy_payments")).toHaveLength(0);
          expect(f.rows("pharmacy_counter_invoices")[0].status).toBe("unpaid");
     });
     it("blocks exhausted stock, closed days and insufficient tenders atomically", async () => {
          for (const kind of ["stock", "day", "tender"]) {
               const f = fixture();
               const ticket = await f.attendant.create(invoice());
               await f.db.transaction(async (trx: any) => {
                    const table = kind === "stock" ? "pharmacy_inventory_items" : "pharmacy_financial_days";
                    await trx(table).forUpdate().first();
                    if (kind === "stock") await trx(table).update({ current_stock: 0 });
                    if (kind === "day") await trx(table).update({ status: "closed" });
               });
               await expect(
                    f.cashier.pay(ticket.id, { ...payment(), amountTendered: kind === "tender" ? 20 : 50 }),
               ).rejects.toThrow();
               expect(f.rows("pharmacy_payments")).toHaveLength(0);
               expect(f.rows("pharmacy_sales")).toHaveLength(0);
               expect(f.rows("pharmacy_counter_invoices")[0].status).toBe("unpaid");
          }
     });
     it("keeps retail and wholesale transactions consistent and protects prescription medicines", async () => {
          const f = fixture();
          const ticket = await f.attendant.create({ ...invoice(), priceType: "wholesale", expectedTotal: 30 });
          expect(ticket.total).toBe(30);
          await f.cashier.pay(ticket.id, payment());
          expect(f.rows("pharmacy_sale_lines")[0].unit_price).toBe(30);
          await f.db.transaction(async (trx: any) => {
               await trx("pharmacy_inventory_items").forUpdate().first();
               await trx("pharmacy_inventory_items").update({ requires_prescription: true });
          });
          await expect(f.attendant.create(invoice("prescription-key"))).rejects.toThrow("prescription queue");
     });
     it("rejects unauthorized creation, payments, collection and branch access", async () => {
          const f = fixture();
          const ticket = await f.attendant.create(invoice());
          await expect(f.cashier.create(invoice("cashier-create-key"))).rejects.toThrow("authority");
          await expect(f.attendant.pay(ticket.id, payment())).rejects.toThrow("authority");
          await expect(f.cashier.collect(ticket.id, { idempotencyKey: "cashier-collect-key" })).rejects.toThrow(
               "authority",
          );
          await expect(
               new PharmacyCounterWorkflow(f.db, user("pharmacy_cashier", 3, 3), 1).find(ticket.code),
          ).rejects.toThrow("current branch");
          await expect(
               f.cashier.saveSettings({ mode: "direct", idempotencyKey: "settings-forbidden" }),
          ).rejects.toThrow("manager");
     });
     it("cancels unpaid invoices only, retains short-code history and resolves collisions", async () => {
          const codes = ["ABCD", "ABCD", "EFGH"];
          const f = fixture(() => codes.shift()!);
          const first = await f.attendant.create(invoice());
          await f.attendant.cancel(first.id, { idempotencyKey: "cancel-first-key", reason: "Customer changed mind" });
          const next = await f.attendant.create(invoice("invoice-request-002"));
          expect(next.code).toBe("EFGH");
          expect(f.rows("pharmacy_counter_invoices")).toHaveLength(2);
          await expect(f.cashier.pay(first.id, payment())).rejects.toThrow("cancelled");
          await f.cashier.pay(next.id, payment());
          await expect(
               f.attendant.cancel(next.id, { idempotencyKey: "cancel-paid-key", reason: "Not allowed now" }),
          ).rejects.toThrow("Only an unpaid");
     });
     it("refuses collection of reversed sales and leaves collection unrecorded", async () => {
          const f = fixture();
          const ticket = await f.attendant.create(invoice());
          const receipt = await f.cashier.pay(ticket.id, payment());
          await f.db.transaction(async (trx: any) => {
               await trx("pharmacy_sales").where({ id: receipt.id }).forUpdate().first();
               await trx("pharmacy_sales").where({ id: receipt.id }).update({ status: "refunded" });
          });
          await expect(f.attendant.collect(ticket.id, { idempotencyKey: "collect-refund-key" })).rejects.toThrow(
               "reversed",
          );
          expect(f.rows("pharmacy_counter_invoices")[0].status).toBe("paid");
     });
     it("switches mode per branch, prevents new staged invoices in direct mode but settles existing ones", async () => {
          const f = fixture(),
               manager = new PharmacyCounterWorkflow(f.db, user("pharmacy_manager"), 1);
          const ticket = await f.attendant.create(invoice());
          await manager.saveSettings({ idempotencyKey: "mode-setting-key", mode: "direct" });
          expect(await manager.settings()).toEqual({ mode: "direct" });
          await expect(f.attendant.create(invoice("new-invoice-key"))).rejects.toThrow("not enabled");
          expect((await f.cashier.pay(ticket.id, payment())).total).toBe(40);
     });
     it("normalizes typed short codes and generates readable four-character codes", () => {
          expect(normalizeCounterCode(" dc20 ")).toBe("DC20");
          expect(() => normalizeCounterCode("INV-DC20-1")).toThrow("four-character");
          for (let i = 0; i < 100; i++) expect(counterCode()).toMatch(/^[A-Z2-9]{4}$/);
     });
});
