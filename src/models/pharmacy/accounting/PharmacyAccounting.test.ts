import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
vi.mock("../../../database/KnexConnections", () => ({ default: vi.fn() }));
// Parent owns and separately SQL-tests the shared bridge. Exercise the real local writer here.
vi.mock("../PharmacyAccountingBridge", () => ({ synchronizePharmacyJournal: vi.fn() }));
import { accountingSqlDatabase } from "../../../testSupport/accountingSqlDatabase";
import { ensurePharmacyAccountingSchema } from "./PharmacyAccountingSchema";
import { AccountingContext, amount, journalLines, stableHash } from "./PharmacyAccountingCore";
import { CANONICAL_CONTROLS, MAPPING_TYPES, PharmacyAccountingCatalogue } from "./PharmacyAccountingCatalogue";
import { PharmacyAccountingWorkflows } from "./PharmacyAccountingWorkflows";
import { PharmacyAccountingReconciliation } from "./PharmacyAccountingReconciliation";
import { PharmacyAccountingRegisters } from "./PharmacyAccountingRegisters";
import { PharmacyAccountingSubledgers, agingBucket } from "./PharmacyAccountingSubledgers";
import { PharmacyAccountingEvidence } from "./PharmacyAccountingEvidence";
import { PharmacyAccountingReversals } from "./PharmacyAccountingReversals";
import { PharmacyLocalAccounts } from "./PharmacyLocalAccounts";
import {
     cappedTaxCreditMinor,
     PharmacyAccountingTaxCredits,
     TAX_CREDIT_POLICY,
     taxCreditMinor,
} from "./PharmacyAccountingTaxCredits";

let db: any,
     native: any,
     catalogue: PharmacyAccountingCatalogue,
     workflows: PharmacyAccountingWorkflows,
     bank: PharmacyAccountingReconciliation,
     registers: PharmacyAccountingRegisters,
     mappings: Record<string, string>;
const context: AccountingContext = { tenantId: 1, branch: 2, actor: 3, role: "pharmacy_accountant" };
const other = { ...context, actor: 4 };
const date = "2026-11-02";
const journalInput = (key = "journal-create-1") => ({
     idempotencyKey: key,
     date,
     description: "Office rent adjustment",
     lines: [
          { account: "expense:rent", debit: "100.01" },
          { account: "collection:10", credit: "100.01" },
     ],
});
const expenseInput = (key = "expense-create-1") => ({
     idempotencyKey: key,
     date,
     description: "Monthly office rental",
     amount: "100.01",
     expenseAccount: "expense:rent",
     supplierId: "s1",
     dueDate: "2026-11-30",
});
beforeEach(async () => {
     ({ db, native } = accountingSqlDatabase());
     native.exec(`
       CREATE TABLE acc_accounts(id INTEGER PRIMARY KEY,account_code TEXT UNIQUE,name TEXT,type TEXT,normal_balance TEXT,parent_account_id INTEGER,is_active INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
       CREATE TABLE acc_journal_lines(id INTEGER PRIMARY KEY,account_id INTEGER);
       CREATE TABLE acc_periods(id INTEGER PRIMARY KEY,period_code TEXT UNIQUE,period_start TEXT,period_end TEXT,status TEXT,created_at TEXT,updated_at TEXT);
       CREATE TABLE pharmacy_financial_days(id INTEGER PRIMARY KEY,branchid INTEGER,financial_date TEXT,status TEXT);
       CREATE TABLE pharmacy_journals(id TEXT PRIMARY KEY,branchid INTEGER,source_ref TEXT,kind TEXT,description TEXT,financial_date TEXT,created_by INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(source_ref,kind));
       CREATE TABLE pharmacy_journal_lines(id INTEGER PRIMARY KEY,journal_id TEXT,account_code TEXT,document_ref TEXT,debit NUMERIC DEFAULT 0,credit NUMERIC DEFAULT 0);
       CREATE TABLE pharmacy_collection_accounts(id INTEGER PRIMARY KEY,branchid INTEGER,name TEXT,account_type TEXT,currency TEXT,is_active INTEGER);
       CREATE TABLE pharmacy_payment_routes(id INTEGER PRIMARY KEY,branchid INTEGER,method TEXT,account_id INTEGER);
       CREATE TABLE pharmacy_shifts(id TEXT PRIMARY KEY,branchid INTEGER,active_key TEXT,financial_date TEXT);
       CREATE TABLE pharmacy_suppliers(id TEXT PRIMARY KEY,branchid INTEGER,name TEXT,is_active INTEGER);
       CREATE TABLE pharmacy_customer_accounts(id INTEGER PRIMARY KEY,branchid INTEGER,patient_id INTEGER,is_active INTEGER);
       CREATE TABLE pharmacy_cash_events(id TEXT PRIMARY KEY,branchid INTEGER,sale_id TEXT);
       CREATE TABLE pharmacy_tax_events(id TEXT PRIMARY KEY,branchid INTEGER,sale_id TEXT,sale_line_id TEXT,rule_id TEXT,event_type TEXT,gross_amount NUMERIC,net_amount NUMERIC,tax_amount NUMERIC,rate NUMERIC,local_account TEXT,financial_date TEXT);
       CREATE TABLE pharmacy_tax_rules(id TEXT PRIMARY KEY,branchid INTEGER,local_account TEXT,is_active INTEGER);
       CREATE TABLE pharmacy_documents(id TEXT PRIMARY KEY,branchid INTEGER,kind TEXT,request_key TEXT UNIQUE,request_hash TEXT,supplier_id TEXT,amount NUMERIC,created_by INTEGER,details TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
       CREATE TABLE pharmacy_sales(id TEXT PRIMARY KEY,branchid INTEGER,customer_account_id INTEGER,patient_id INTEGER,customer_name TEXT,receipt_number TEXT,total_amount NUMERIC,paid_amount NUMERIC,outstanding_amount NUMERIC,status TEXT,completed_at TEXT,accounting_version INTEGER);
       CREATE TABLE pharmacy_inventory_items(id TEXT PRIMARY KEY,branchid INTEGER,name TEXT,sku TEXT,current_stock NUMERIC,cost_price NUMERIC,is_active INTEGER,status TEXT);
     `);
     await ensurePharmacyAccountingSchema(db);
     const types = ["asset", "liability", "equity", "revenue", "expense"];
     for (const [i, type] of types.entries())
          await db("acc_accounts").insert({
               id: i + 1,
               account_code: "gl-" + type,
               name: type + " control",
               type,
               normal_balance: ["asset", "expense"].includes(type) ? "debit" : "credit",
               is_active: true,
          });
     await db("acc_accounts").insert({
          id: 6,
          account_code: "gl-rent",
          name: "Rent expense",
          type: "expense",
          normal_balance: "debit",
          is_active: true,
     });
     for (const code of [...new Set(Object.values(CANONICAL_CONTROLS))])
          await db("acc_accounts").insert({
               account_code: code,
               name: code,
               type: code === "acc-2000" ? "liability" : code === "acc-5000" ? "expense" : "asset",
               normal_balance: code === "acc-2000" ? "credit" : "debit",
               is_active: true,
          });
     mappings = Object.fromEntries(Object.entries(MAPPING_TYPES).map(([local, type]) => [local, "gl-" + type]));
     Object.keys(CANONICAL_CONTROLS)
          .filter((k) => k !== "supplier_payable")
          .forEach((k) => {
               mappings[k] = CANONICAL_CONTROLS[k];
          });
     mappings["expense:rent"] = "gl-rent";
     mappings["expense:bad_debt"] = "gl-expense";
     mappings["revenue:credits"] = "gl-revenue";
     mappings["liability:vat_a"] = "gl-liability";
     mappings["liability:vat_b"] = "gl-liability";
     await db("pharmacy_accounting_settings").insert({
          branchid: 2,
          tenant_id: 1,
          enabled: false,
          mappings: JSON.stringify(mappings),
          updated_by: 3,
     });
     await db("pharmacy_financial_days").insert([
          { branchid: 2, financial_date: date, status: "open" },
          { branchid: 9, financial_date: date, status: "open" },
     ]);
     await db("pharmacy_collection_accounts").insert([
          { id: 10, branchid: 2, name: "Pharmacy bank", account_type: "bank", currency: "GHS", is_active: true },
          { id: 11, branchid: 2, name: "Pharmacy cash", account_type: "cash", currency: "GHS", is_active: true },
          { id: 99, branchid: 9, name: "Other branch", account_type: "bank", currency: "GHS", is_active: true },
     ]);
     await db("pharmacy_payment_routes").insert([
          { branchid: 2, method: "card", account_id: 10 },
          { branchid: 2, method: "cash", account_id: 11 },
     ]);
     await db("pharmacy_suppliers").insert([
          { id: "s1", branchid: 2, name: "Local landlord", is_active: true },
          { id: "s9", branchid: 9, name: "Other landlord", is_active: true },
     ]);
     await db("pharmacy_customer_accounts").insert([
          { id: 21, branchid: 2, patient_id: 100, is_active: true },
          { id: 29, branchid: 9, patient_id: 900, is_active: true },
     ]);
     catalogue = new PharmacyAccountingCatalogue(db, context);
     workflows = new PharmacyAccountingWorkflows(db, context);
     bank = new PharmacyAccountingReconciliation(db, context);
     registers = new PharmacyAccountingRegisters(db, context);
});
afterEach(async () => {
     await db.destroy();
});
async function approvedJournal() {
     const row = await workflows.createJournal(journalInput());
     await workflows.journalAction(row.id, "submit", { idempotencyKey: "journal-submit-1", expectedVersion: 1 });
     await new PharmacyAccountingWorkflows(db, other).journalAction(row.id, "approve", {
          idempotencyKey: "journal-approve-1",
          expectedVersion: 2,
     });
     return row.id;
}
async function approvedExpense() {
     const row = await workflows.createExpense(expenseInput());
     await workflows.expenseAction(row.id, "submit", { idempotencyKey: "expense-submit-1", expectedVersion: 1 });
     await new PharmacyAccountingWorkflows(db, other).expenseAction(row.id, "approve", {
          idempotencyKey: "expense-approve-1",
          expectedVersion: 2,
     });
     return row.id;
}
async function book(value: string, branch = 2, account = "collection:10", ref = "bank-book-1") {
     const id = "book-" + ref;
     await db("pharmacy_journals").insert({
          id,
          branchid: branch,
          source_ref: ref,
          kind: "fixture",
          description: "Real book movement",
          financial_date: date,
          created_by: 3,
     });
     const n = Number(value);
     const [lineId] = await db("pharmacy_journal_lines").insert({
          journal_id: id,
          account_code: account,
          debit: n > 0 ? n : 0,
          credit: n < 0 ? -n : 0,
     });
     return lineId;
}
async function imported(value = "100.01", key = "bank-import-1") {
     return bank.importStatement({
          idempotencyKey: key,
          accountId: 10,
          reference: key,
          startDate: date,
          endDate: date,
          openingBalance: "0.00",
          closingBalance: value,
          lines: [{ reference: key + "-tx", date, amount: value }],
     });
}
describe("Pharmacy accounting precision and authorization", () => {
     it.each(["0.001", "-0.01", "1000000000000.00", Infinity, NaN, "", null])("rejects invalid money %s", (value) => {
          expect(() => amount(value)).toThrow();
     });
     it("preserves exact cents, supports signed bank money and rejects imbalance", () => {
          expect(amount("0.01")).toBe("0.01");
          expect(amount("-0.01", true)).toBe("-0.01");
          expect(
               journalLines([
                    { account: "sales", credit: "0.30" },
                    { account: "collection:10", debit: "0.10" },
                    { account: "collection:11", debit: "0.20" },
               ]),
          ).toHaveLength(3);
          expect(() =>
               journalLines([
                    { account: "sales", credit: "0.31" },
                    { account: "collection:10", debit: "0.30" },
               ]),
          ).toThrow("balance");
          expect(() =>
               journalLines([
                    { account: "sales", credit: 1, debit: 1 },
                    { account: "sales", debit: 1 },
               ]),
          ).toThrow("exactly one");
     });
     it("rejects missing context and non-finance roles before reads/writes", () => {
          expect(() => new PharmacyAccountingWorkflows(db, { ...context, branch: 0 })).toThrow("authenticated branch");
          expect(() => new PharmacyAccountingWorkflows(db, { ...context, role: "pharmacy_cashier" })).toThrow(
               "finance",
          );
          expect(() => new PharmacyAccountingWorkflows(db, { ...context, tenantId: 0 })).toThrow("tenant");
     });
     it("schema upgrades are idempotent and preserve history", async () => {
          await ensurePharmacyAccountingSchema(db);
          expect((await catalogue.settings()).mappings).toEqual(mappings);
     });
     it("canonical request hashing ignores object key order, not amount changes", () => {
          expect(stableHash({ b: 2, a: 1 })).toBe(stableHash({ a: 1, b: 2 }));
          expect(stableHash({ amount: 1 })).not.toBe(stableHash({ amount: 2 }));
     });
});
describe("Journal lifecycle, retry identity and immutability", () => {
     it("creates one draft on retry and rejects payload/actor key reuse", async () => {
          const first = await workflows.createJournal(journalInput());
          expect(
               await workflows.createJournal({ ...journalInput(), lines: journalInput().lines.map((l) => ({ ...l })) }),
          ).toEqual(first);
          await expect(
               workflows.createJournal({ ...journalInput(), description: "Changed description" }),
          ).rejects.toThrow("different request");
          await expect(new PharmacyAccountingWorkflows(db, other).createJournal(journalInput())).rejects.toThrow(
               "different request",
          );
          expect(await db("pharmacy_accounting_documents")).toHaveLength(1);
          expect(await db("pharmacy_accounting_audit")).toHaveLength(1);
     });
     it("enforces submit, independent approval, version and branch isolation", async () => {
          const { id } = await workflows.createJournal(journalInput());
          await expect(
               workflows.journalAction(id, "post", { idempotencyKey: "invalid-post-1", expectedVersion: 1 }),
          ).rejects.toThrow("Cannot post");
          await workflows.journalAction(id, "submit", { idempotencyKey: "journal-submit-1", expectedVersion: 1 });
          await expect(
               workflows.journalAction(id, "approve", { idempotencyKey: "self-approve-1", expectedVersion: 2 }),
          ).rejects.toThrow("cannot approve");
          await expect(
               new PharmacyAccountingWorkflows(db, other).journalAction(id, "approve", {
                    idempotencyKey: "stale-approve-1",
                    expectedVersion: 1,
               }),
          ).rejects.toThrow("changed");
          await expect(
               new PharmacyAccountingWorkflows(db, { ...other, branch: 9 }).journalAction(id, "approve", {
                    idempotencyKey: "foreign-approve-1",
                    expectedVersion: 2,
               }),
          ).rejects.toThrow("not found");
          await expect(
               new PharmacyAccountingWorkflows(db, { ...other, branch: 9 }).detail(id, "journal"),
          ).rejects.toThrow("not found");
     });
     it("also prevents the submitter approving a document created by another actor", async () => {
          const { id } = await workflows.createJournal(journalInput());
          const approver = new PharmacyAccountingWorkflows(db, other);
          await approver.journalAction(id, "submit", { idempotencyKey: "other-submit-1", expectedVersion: 1 });
          await expect(
               approver.journalAction(id, "approve", { idempotencyKey: "other-approve-1", expectedVersion: 2 }),
          ).rejects.toThrow("submitter");
     });
     it("posts once, reverses with linked new entries and never changes posted lines", async () => {
          const id = await approvedJournal(),
               request = { idempotencyKey: "journal-post-1", expectedVersion: 3 };
          await workflows.journalAction(id, "post", request);
          const original = await db("pharmacy_journal_lines").orderBy("id");
          expect(await workflows.journalAction(id, "post", request)).toMatchObject({ status: "posted", version: 4 });
          expect(await db("pharmacy_journals")).toHaveLength(1);
          await expect(
               workflows.journalAction(id, "void", {
                    idempotencyKey: "invalid-void-1",
                    expectedVersion: 4,
                    reason: "Void posted",
               }),
          ).rejects.toThrow("Cannot void");
          const reversed = await workflows.journalAction(id, "reverse", {
               idempotencyKey: "journal-reverse-1",
               expectedVersion: 4,
               date,
               reason: "Correction by linked reversal",
          });
          expect(reversed.status).toBe("reversed");
          expect(reversed.reversalId).toBeTruthy();
          expect(
               await db("pharmacy_journal_lines")
                    .whereIn(
                         "id",
                         original.map((l) => l.id),
                    )
                    .orderBy("id"),
          ).toEqual(original);
          const rows = await db("pharmacy_journal_lines");
          expect(rows.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0)).toBe(0);
          expect(await db("pharmacy_accounting_documents").where({ reversal_of: id }).first()).toMatchObject({
               status: "posted",
          });
          await expect(
               workflows.journalAction(id, "post", { idempotencyKey: "repost-reversed-1", expectedVersion: 5 }),
          ).rejects.toThrow("Cannot post");
     });
     it("closed shared periods roll back posting and the action request/audit", async () => {
          const id = await approvedJournal();
          await db("acc_periods").insert({
               period_code: "2026-11",
               period_start: "2026-11-01",
               period_end: "2026-11-30",
               status: "closed",
          });
          await expect(
               workflows.journalAction(id, "post", { idempotencyKey: "closed-post-1", expectedVersion: 3 }),
          ).rejects.toThrow("closed");
          expect(await db("pharmacy_journals")).toHaveLength(0);
          expect(await db("pharmacy_accounting_requests").where({ request_key: "closed-post-1" })).toHaveLength(0);
          expect((await workflows.detail(id, "journal")).status).toBe("approved");
     });
     it("audit failure rolls back both posting and lifecycle changes", async () => {
          const id = await approvedJournal();
          native.exec(
               "CREATE TRIGGER reject_post_audit BEFORE INSERT ON pharmacy_accounting_audit WHEN NEW.action='journals:post' BEGIN SELECT RAISE(ABORT,'audit storage failure'); END",
          );
          await expect(
               workflows.journalAction(id, "post", { idempotencyKey: "audit-fail-post-1", expectedVersion: 3 }),
          ).rejects.toThrow("audit storage failure");
          expect(await db("pharmacy_journals")).toHaveLength(0);
          expect((await workflows.detail(id, "journal")).version).toBe(3);
     });
     it("serializes competing retries, approvals and posting transitions", async () => {
          const created = await Promise.all([
               workflows.createJournal(journalInput()),
               workflows.createJournal(journalInput()),
          ]);
          expect(created[0]).toEqual(created[1]);
          expect(await db("pharmacy_accounting_documents")).toHaveLength(1);
          const id = created[0].id;
          await workflows.journalAction(id, "submit", { idempotencyKey: "journal-submit-1", expectedVersion: 1 });
          const approvals = await Promise.allSettled(
               [4, 5].map((actor) =>
                    new PharmacyAccountingWorkflows(db, { ...context, actor }).journalAction(id, "approve", {
                         idempotencyKey: "competing-approve-" + actor,
                         expectedVersion: 2,
                    }),
               ),
          );
          expect(approvals.filter((r) => r.status === "fulfilled")).toHaveLength(1);
          const postings = await Promise.allSettled(
               [1, 2].map((n) =>
                    workflows.journalAction(id, "post", { idempotencyKey: "competing-post-" + n, expectedVersion: 3 }),
               ),
          );
          expect(postings.filter((r) => r.status === "fulfilled")).toHaveLength(1);
          expect(await db("pharmacy_journals")).toHaveLength(1);
     });
});
describe("Approved non-inventory expenses", () => {
     it("allows a standalone expense and supplier payable without facility mappings", async () => {
          await db("pharmacy_accounting_settings").where({ branchid: 2 }).update({ mappings: JSON.stringify({}) });
          const expense = await workflows.createExpense({ ...expenseInput("standalone-expense"), expenseAccount: "operating_expenses" });
          expect(expense.status).toBe("draft");
     });
     it("cannot self-approve or pay a draft expense", async () => {
          const { id } = await workflows.createExpense(expenseInput());
          await expect(
               workflows.expenseAction(id, "pay", {
                    idempotencyKey: "draft-expense-pay-1",
                    expectedVersion: 1,
                    date,
                    method: "card",
                    amount: "1.00",
                    reference: "BANK-001",
               }),
          ).rejects.toThrow("Cannot pay");
          await workflows.expenseAction(id, "submit", { idempotencyKey: "expense-submit-1", expectedVersion: 1 });
          await expect(
               workflows.expenseAction(id, "approve", { idempotencyKey: "self-expense-approve-1", expectedVersion: 2 }),
          ).rejects.toThrow("cannot approve");
          expect(await db("pharmacy_journals")).toHaveLength(0);
     });
     it("accrues once, supports partial payment and exact remaining cents", async () => {
          const id = await approvedExpense();
          expect(await db("pharmacy_journal_lines").where({ account_code: "expense:rent" }).first()).toMatchObject({
               debit: 100.01,
          });
          const request = {
               idempotencyKey: "expense-pay-1",
               expectedVersion: 3,
               date,
               amount: "40.01",
               method: "card",
               reference: "BANK-001",
          };
          expect(await workflows.expenseAction(id, "pay", request)).toMatchObject({
               status: "partially_paid",
               paidAmount: "40.01",
               outstandingAmount: "60.00",
               version: 4,
          });
          await workflows.expenseAction(id, "pay", request);
          expect(await db("pharmacy_accounting_expense_payments")).toHaveLength(1);
          expect(
               await workflows.expenseAction(id, "pay", {
                    ...request,
                    idempotencyKey: "expense-pay-2",
                    expectedVersion: 4,
                    amount: "60.00",
                    reference: "BANK-002",
               }),
          ).toMatchObject({ status: "paid", paidAmount: "100.01", outstandingAmount: "0.00" });
          expect((await registers.payables()).totals.outstanding).toBe("0.00");
     });
     it("rejects overpayment, reused references, and a foreign-branch destination", async () => {
          const id = await approvedExpense();
          const request = {
               idempotencyKey: "expense-pay-1",
               expectedVersion: 3,
               date,
               amount: "100.02",
               method: "card",
               reference: "BANK-001",
          };
          await expect(workflows.expenseAction(id, "pay", request)).rejects.toThrow("exceeds");
          await db("pharmacy_payment_routes").where({ method: "card" }).update({ account_id: 99 });
          await expect(workflows.expenseAction(id, "pay", { ...request, amount: "1.00" })).rejects.toThrow(
               "destination",
          );
          expect(await db("pharmacy_accounting_expense_payments")).toHaveLength(0);
     });
     it("serializes competing expense payments and rejects duplicate external references", async () => {
          const id = await approvedExpense();
          const request = { expectedVersion: 3, date, amount: "60.01", method: "card", reference: "BANK-001" };
          const payments = await Promise.allSettled(
               [1, 2].map((n) =>
                    workflows.expenseAction(id, "pay", { ...request, idempotencyKey: "competing-pay-" + n }),
               ),
          );
          expect(payments.filter((r) => r.status === "fulfilled")).toHaveLength(1);
          await expect(
               workflows.expenseAction(id, "pay", {
                    ...request,
                    expectedVersion: 4,
                    amount: "1.00",
                    idempotencyKey: "duplicate-reference-1",
               }),
          ).rejects.toThrow("reference already recorded");
          expect(await db("pharmacy_accounting_expense_payments")).toHaveLength(1);
     });
     it("does not pay beyond the supplier control after unallocated supplier payments", async () => {
          const id = await approvedExpense();
          await book("100.01", 2, "payable:s1", "legacy-supplier-payment");
          await expect(
               workflows.expenseAction(id, "pay", {
                    idempotencyKey: "over-control-pay-1",
                    expectedVersion: 3,
                    date,
                    amount: "1.00",
                    method: "card",
                    reference: "BANK-001",
               }),
          ).rejects.toThrow("reconcile unallocated");
          expect(await db("pharmacy_accounting_expense_payments")).toHaveLength(0);
     });
     it("rejects stock capitalization disguised as operating expense and foreign supplier", async () => {
          await expect(workflows.createExpense({ ...expenseInput(), expenseAccount: "inventory" })).rejects.toThrow(
               "stock purchases",
          );
          await expect(workflows.createExpense({ ...expenseInput(), receiptId: "stock-receipt" })).rejects.toThrow(
               "Inventory purchases",
          );
          await expect(workflows.createExpense({ ...expenseInput(), supplierId: "s9" })).rejects.toThrow(
               "supplier in this branch",
          );
          expect(await db("pharmacy_accounting_documents")).toHaveLength(0);
     });
     it("cash payments require a shift and persist shift handover evidence without double expensing", async () => {
          const id = await approvedExpense(),
               request = {
                    idempotencyKey: "cash-expense-pay-1",
                    expectedVersion: 3,
                    date,
                    amount: "10.00",
                    method: "cash",
               };
          await expect(workflows.expenseAction(id, "pay", request)).rejects.toThrow("cash shift");
          await db("pharmacy_shifts").insert({ id: "shift-3", branchid: 2, active_key: "2:3", financial_date: date });
          await workflows.expenseAction(id, "pay", request);
          const evidence = await db("pharmacy_documents").first();
          expect(evidence.kind).toBe("supplier_payment");
          expect(JSON.parse(evidence.details).shiftId).toBe("shift-3");
          expect(await db("pharmacy_journals").where({ kind: "expense_accrual" })).toHaveLength(1);
     });
     it("reverses unpaid accrual with new lines; never invents refunds for paid expenses", async () => {
          const id = await approvedExpense();
          expect(
               await workflows.expenseAction(id, "reverse", {
                    idempotencyKey: "expense-reverse-1",
                    expectedVersion: 3,
                    date,
                    reason: "Cancelled landlord accrual",
               }),
          ).toMatchObject({ status: "reversed", outstandingAmount: "0.00" });
          expect((await registers.payables()).totals.outstanding).toBe("0.00");
          const { id: paid } = await workflows.createExpense(expenseInput("expense-create-2"));
          await workflows.expenseAction(paid, "submit", { idempotencyKey: "expense-submit-2", expectedVersion: 1 });
          await new PharmacyAccountingWorkflows(db, other).expenseAction(paid, "approve", {
               idempotencyKey: "expense-approve-2",
               expectedVersion: 2,
          });
          await workflows.expenseAction(paid, "pay", {
               idempotencyKey: "expense-pay-2",
               expectedVersion: 3,
               date,
               amount: "1.00",
               method: "card",
               reference: "BANK-PAID-2",
          });
          await expect(
               workflows.expenseAction(paid, "reverse", {
                    idempotencyKey: "paid-reverse-1",
                    expectedVersion: 4,
                    date,
                    reason: "Not evidence of refund",
               }),
          ).rejects.toThrow("refund workflow");
     });
});
describe("Standalone pharmacy chart", () => {
     const create = (key = "local-account-create") => ({
          idempotencyKey: key, accountCode: "LOCAL_RENT", name: "Premises rent", type: "expense", normalBalance: "debit",
     });
     it("provides standard and collection accounts without shared accounts or mappings", async () => {
          await db("pharmacy_accounting_settings").where({ branchid: 2 }).update({ mappings: "{}" });
          await db.schema.dropTable("acc_accounts");
          const chart = await catalogue.accounts();
          expect(chart.facilityAvailable).toBe(false);
          expect(chart.items.map((row: any) => row.account_code)).toEqual(expect.arrayContaining(["operating_expenses", "asset:input_tax", "liability:output_tax", "collection:10"]));
          expect(chart.sharedAccounts).toEqual([]);
          expect(JSON.parse((await db("pharmacy_accounting_settings").where({ branchid: 2 }).first()).mappings)).toEqual({});
     });
     it("creates and validates local accounts without creating a facility account", async () => {
          await db("pharmacy_accounting_settings").where({ branchid: 2 }).update({ mappings: "{}" });
          const local = new PharmacyLocalAccounts(db, context), before = await db("acc_accounts").count("* as count").first();
          const account = await local.create(create());
          expect(account.local_code).toBe("expense:LOCAL_RENT");
          expect(await local.create(create())).toEqual(account);
          expect((await db("acc_accounts").count("* as count").first()).count).toBe(before.count);
          expect((await catalogue.accounts()).items).toEqual(expect.arrayContaining([expect.objectContaining({ id: `local:${account.id}`, local_codes: ["expense:LOCAL_RENT"] })]));
          await workflows.createJournal({ ...journalInput("local-journal-create"), lines: [{ account: "expense:LOCAL_RENT", debit: "20" }, { account: "collection:10", credit: "20" }] });
          await expect(local.remove(account.id, { idempotencyKey: "remove-used-local" })).rejects.toThrow("history");
          await expect(workflows.createExpense({ ...expenseInput("missing-local-account"), expenseAccount: "expense:not_created" })).rejects.toThrow("active pharmacy account");
          await expect(workflows.createExpense({ ...expenseInput("foreign-supplier"), expenseAccount: "expense:LOCAL_RENT", supplierId: "s9" })).rejects.toThrow("supplier in this branch");
          await expect(new PharmacyLocalAccounts(db, { ...context, branch: 9 }).remove(account.id, { idempotencyKey: "other-branch-remove" })).rejects.toThrow("not found");
     });
     it("deletes only unused local accounts and audits the deletion", async () => {
          const local = new PharmacyLocalAccounts(db, context), account = await local.create(create("local-delete-create"));
          const request = { idempotencyKey: "local-delete-request" };
          expect(await local.remove(account.id, request)).toEqual({ id: account.id, deleted: true });
          expect(await local.remove(account.id, request)).toEqual({ id: account.id, deleted: true });
          expect(await db("pharmacy_local_accounts").where({ id: account.id })).toHaveLength(0);
          expect(await db("pharmacy_accounting_audit").where({ action: "local-accounts:remove", entity_id: String(account.id) })).toHaveLength(1);
     });
     it("does not allow case variants to shadow standard, legacy or custom posting codes", async () => {
          const local = new PharmacyLocalAccounts(db, context);
          await expect(local.create({ ...create("reserved-input-tax"), accountCode: "INPUT_TAX", type: "asset" })).rejects.toThrow("already exists");
          await expect(local.create({ ...create("legacy-rent-duplicate"), accountCode: "RENT" })).rejects.toThrow("already exists");
          await db("pharmacy_accounting_settings").where({ branchid: 2 }).update({ mappings: "{}" });
          await local.create(create("case-original"));
          await expect(local.create({ ...create("case-duplicate"), accountCode: "local_rent" })).rejects.toThrow("already exists");
     });
     it("enforces compatible, branch-scoped parents and protects child accounts", async () => {
          const local = new PharmacyLocalAccounts(db, context);
          const parent = await local.create({ ...create("parent-create"), accountCode: "PREMISES", parentAccountId: "operating_expenses" });
          const child = await local.create({ ...create("child-create"), accountCode: "REPAIRS", parentAccountId: parent.local_code });
          await expect(local.update(parent.id, { idempotencyKey: "parent-cycle-check", parentAccountId: child.local_code })).rejects.toThrow("cycle");
          await expect(local.update(child.id, { idempotencyKey: "parent-type-check", parentAccountId: "liability:grni" })).rejects.toThrow("same type");
          await expect(local.remove(parent.id, { idempotencyKey: "parent-delete-check" })).rejects.toThrow("child accounts");
          await expect(new PharmacyLocalAccounts(db, { ...context, branch: 9 }).create({ ...create("foreign-parent-check"), parentAccountId: parent.local_code })).rejects.toThrow("same type");
     });
     it("retains used accounts, mappings and tax rules instead of deleting history", async () => {
          const local = new PharmacyLocalAccounts(db, context), account = await local.create(create("local-tax-create"));
          await db("pharmacy_tax_rules").insert({ id: "rule", branchid: 2, local_account: account.local_code, is_active: true });
          await expect(local.remove(account.id, { idempotencyKey: "local-tax-remove" })).rejects.toThrow("history");
          await expect(local.update(account.id, { idempotencyKey: "local-tax-deactivate", isActive: false })).rejects.toThrow("active tax rule");
          await db("pharmacy_tax_rules").where({ id: "rule" }).update({ is_active: false });
          expect((await local.update(account.id, { idempotencyKey: "local-safe-deactivate", isActive: false })).is_active).toBe(false);
     });
     it("allows an archived account's original journal to be reversed but not used for a new journal", async () => {
          await db("pharmacy_accounting_settings").where({ branchid: 2 }).update({ mappings: "{}" });
          const local = new PharmacyLocalAccounts(db, context), account = await local.create(create("archive-create"));
          const draft = await workflows.createJournal({ ...journalInput("archive-journal"), lines: [{ account: account.local_code, debit: "20" }, { account: "collection:10", credit: "20" }] });
          await workflows.journalAction(draft.id, "submit", { idempotencyKey: "archive-submit", expectedVersion: 1 });
          await new PharmacyAccountingWorkflows(db, other).journalAction(draft.id, "approve", { idempotencyKey: "archive-approve", expectedVersion: 2 });
          await workflows.journalAction(draft.id, "post", { idempotencyKey: "archive-post", expectedVersion: 3 });
          await local.update(account.id, { idempotencyKey: "archive-deactivate", isActive: false });
          await expect(workflows.createJournal({ ...journalInput("archive-new-journal"), lines: [{ account: account.local_code, debit: "20" }, { account: "collection:10", credit: "20" }] })).rejects.toThrow("active pharmacy account");
          const reversal = await workflows.journalAction(draft.id, "reverse", { idempotencyKey: "archive-reverse", expectedVersion: 4, date, reason: "Correct original journal" });
          expect(reversal.status).toBe("reversed");
          expect(await db("pharmacy_journal_lines").where({ account_code: account.local_code })).toHaveLength(2);
     });
     it("removes a legacy Pharmacy assignment without deleting its facility account or history", async () => {
          const account = await catalogue.createAccount({ idempotencyKey: "legacy-account-create", accountCode: "LEGACY", name: "Old account", type: "asset", normalBalance: "debit" });
          await db("acc_journal_lines").insert({ account_id: account.id });
          await catalogue.removeOwnedAccount(account.id, { idempotencyKey: "legacy-account-remove" });
          expect(await db("acc_accounts").where({ id: account.id }).first()).toBeTruthy();
          expect(await db("acc_journal_lines").where({ account_id: account.id })).toHaveLength(1);
          expect((await catalogue.accounts()).items.some((row: any) => row.id === account.id)).toBe(false);
     });
     it("still requires explicit mappings when shared posting is enabled", async () => {
          await db("pharmacy_accounting_settings").where({ branchid: 2 }).update({ enabled: true, mappings: "{}" });
          await expect(workflows.createExpense({ ...expenseInput("linked-requires-mapping"), expenseAccount: "operating_expenses" })).rejects.toThrow("explicit shared account mapping");
     });
     it("does not reactivate an archived local account merely because it has a shared mapping", async () => {
          const local = new PharmacyLocalAccounts(db, context), account = await local.create(create("linked-archive-create"));
          await local.update(account.id, { idempotencyKey: "linked-archive-disable", isActive: false });
          await db("pharmacy_accounting_settings").where({ branchid: 2 }).update({ enabled: true, mappings: JSON.stringify({ ...mappings, [account.local_code]: "gl-rent" }) });
          await expect(workflows.createExpense({ ...expenseInput("linked-archive-expense"), expenseAccount: account.local_code })).rejects.toThrow("active pharmacy account");
     });
     it("allows removing a stale disabled mapping without revalidating unrelated stale mappings", async () => {
          const stale = { "expense:old": "deleted-one", "expense:other": "deleted-two" };
          await db("pharmacy_accounting_settings").where({ branchid: 2 }).update({ enabled: false, mappings: JSON.stringify(stale) });
          const result = await catalogue.saveSettings({ idempotencyKey: "remove-stale-mapping", enabled: false, effective_date: null, mappings: { "expense:other": "deleted-two" } });
          expect(result.mappings).toEqual({ "expense:other": "deleted-two" });
     });
     it("requires mappings for existing tax rules before enabling shared posting", async () => {
          await db("pharmacy_tax_rules").insert({ id: "local-output-tax", branchid: 2, local_account: "liability:output_tax", is_active: true });
          const input = { idempotencyKey: "enable-with-local-tax", enabled: true, effective_date: date, mappings };
          await expect(catalogue.saveSettings(input)).rejects.toThrow("explicit shared account mapping is required for liability:output_tax");
          expect(await catalogue.saveSettings({ ...input, idempotencyKey: "enable-with-mapped-tax", mappings: { ...mappings, "liability:output_tax": "gl-liability" } })).toMatchObject({ enabled: true });
     });
});

describe("Shared catalogue assignments and cutover controls", () => {
     it("enabling requires explicit complete, active, typed mappings and date", async () => {
          const input = { idempotencyKey: "settings-enable-1", enabled: true, effective_date: date, mappings };
          await expect(catalogue.saveSettings({ ...input, effective_date: null })).rejects.toThrow("effective_date");
          await expect(catalogue.saveSettings({ ...input, mappings: { sales: "gl-asset" } })).rejects.toThrow(
               "revenue",
          );
          await expect(catalogue.saveSettings({ ...input, mappings: { sales: "gl-revenue" } })).rejects.toThrow(
               "inventory mapping",
          );
          expect(await catalogue.saveSettings(input)).toMatchObject({
               enabled: true,
               effective_date: date,
               tenant_id: 1,
          });
     });
     it("posted cutover cannot be disabled, redated, remapped or historically overridden", async () => {
          await catalogue.saveSettings({
               idempotencyKey: "settings-enable-1",
               enabled: true,
               effective_date: date,
               mappings,
          });
          await db("pharmacy_accounting_posting_links").insert({
               journal_id: "history-journal",
               shared_entry_id: 1,
               branchid: 2,
          });
          const input = { idempotencyKey: "settings-change-1", enabled: true, effective_date: date, mappings };
          await expect(catalogue.saveSettings({ ...input, enabled: false })).rejects.toThrow("cannot be disabled");
          await expect(catalogue.saveSettings({ ...input, effective_date: "2026-11-01" })).rejects.toThrow("redated");
          await expect(
               catalogue.saveSettings({ ...input, mappings: { ...mappings, "expense:rent": "gl-expense" } }),
          ).rejects.toThrow("reassigned");
          await book("1.00");
          await expect(
               catalogue.saveSettings({ ...input, mappings: { ...mappings, "collection:10": "acc-1001" } }),
          ).rejects.toThrow("historical local account");
          expect(
               await catalogue.saveSettings({ ...input, mappings: { ...mappings, "expense:travel": "gl-expense" } }),
          ).toMatchObject({ enabled: true });
     });
     it("creates assigned shared accounts, not duplicate financial engines; protects unrelated accounts", async () => {
          const row = await catalogue.createAccount({
               idempotencyKey: "account-create-1",
               accountCode: "PH-TRAVEL",
               name: "Pharmacy travel",
               type: "expense",
               normalBalance: "debit",
               localCode: "expense:travel",
               parentAccountId: 5,
          });
          expect(row.local_codes).toEqual(["expense:travel"]);
          expect((await catalogue.accounts()).items.some((a) => a.id === row.id)).toBe(true);
          await db("acc_accounts").insert({
               id: 100,
               account_code: "LAB-ONLY",
               name: "Facility only",
               type: "asset",
               normal_balance: "debit",
               is_active: true,
          });
          await expect(
               catalogue.updateAccount(100, { idempotencyKey: "lab-edit-1", name: "Take over lab account" }),
          ).rejects.toThrow("not assigned");
          await expect(
               catalogue.updateAccount(row.id, { idempotencyKey: "account-cycle-1", parentAccountId: row.id }),
          ).rejects.toThrow("cycle");
          await expect(
               catalogue.updateAccount(row.id, { idempotencyKey: "account-code-1", accountCode: "OTHER" }),
          ).rejects.toThrow("immutable");
          await db("acc_journal_lines").insert({ account_id: row.id });
          await expect(
               catalogue.updateAccount(row.id, { idempotencyKey: "history-edit-1", name: "Rename posted history" }),
          ).rejects.toThrow("posting history");
     });
     it("rejects foreign collection overrides and mismatched stored tenant", async () => {
          await expect(
               catalogue.saveSettings({
                    idempotencyKey: "foreign-mapping-1",
                    enabled: false,
                    effective_date: null,
                    mappings: { ...mappings, "collection:99": "gl-asset" },
               }),
          ).rejects.toThrow("this branch");
          await db("pharmacy_accounting_settings").where({ branchid: 2 }).update({ tenant_id: 77 });
          await expect(workflows.createJournal(journalInput())).rejects.toThrow("tenant");
     });
     it("cannot enable arbitrary core controls, including otherwise-valid exact overrides", async () => {
          const input = { idempotencyKey: "canonical-settings-1", enabled: true, effective_date: date, mappings };
          await expect(
               catalogue.saveSettings({ ...input, mappings: { ...mappings, receivable: "gl-asset" } }),
          ).rejects.toThrow("must use acc-1002");
          await expect(
               catalogue.saveSettings({ ...input, mappings: { ...mappings, "payable:s1": "gl-liability" } }),
          ).rejects.toThrow("must use acc-2000");
          await expect(
               catalogue.saveSettings({ ...input, mappings: { ...mappings, "collection:10": "acc-1000" } }),
          ).rejects.toThrow("must use acc-1001");
          await expect(
               catalogue.saveSettings({ ...input, mappings: { ...mappings, cost_of_sales: "gl-expense" } }),
          ).rejects.toThrow("must use acc-5000");
          expect(await catalogue.saveSettings(input)).toMatchObject({ enabled: true });
     });
     it("allows optional sales_returns/sales_discounts aliases without making them required settings", async () => {
          expect(
               await catalogue.createAccount({
                    idempotencyKey: "return-account-create-1",
                    accountCode: "PH-RETURNS",
                    name: "Pharmacy sales returns",
                    type: "revenue",
                    normalBalance: "debit",
                    localCode: "sales_returns",
               }),
          ).toMatchObject({ local_codes: ["sales_returns"] });
          await expect(
               catalogue.saveSettings({
                    idempotencyKey: "bad-discount-mapping-1",
                    enabled: false,
                    mappings: { ...mappings, sales_discounts: "gl-asset" },
               }),
          ).rejects.toThrow("revenue");
          expect(
               await catalogue.saveSettings({
                    idempotencyKey: "optional-alias-enable-1",
                    enabled: true,
                    effective_date: date,
                    mappings,
               }),
          ).toMatchObject({ enabled: true });
     });
});
describe("Real bank statement reconciliation", () => {
     it("imports signed exact movements, matches once and finalizes only a reconciled book", async () => {
          const journalLineId = await book("100.01"),
               statement = await imported();
          expect(await imported()).toEqual(statement);
          const line = await db("pharmacy_accounting_statement_lines").where({ statement_id: statement.id }).first();
          const request = {
               idempotencyKey: "bank-match-1",
               statementId: statement.id,
               statementLineId: line.id,
               journalLineId,
          };
          await bank.match(request);
          await bank.match(request);
          await expect(
               bank.finalize({
                    idempotencyKey: "bank-self-finalize-1",
                    statementId: statement.id,
                    reason: "Verified against bank advice",
               }),
          ).rejects.toThrow("cannot finalize");
          expect(
               await new PharmacyAccountingReconciliation(db, other).finalize({
                    idempotencyKey: "bank-finalize-1",
                    statementId: statement.id,
                    reason: "Verified against bank advice",
               }),
          ).toMatchObject({ status: "finalized", closingBalance: "100.01" });
          expect((await bank.list({ statementId: statement.id })).ledgerLines[0].matched).toBe(true);
          await expect(bank.match({ ...request, idempotencyKey: "bank-rematch-1" })).rejects.toThrow("immutable");
     });
     it("rejects non-bank/foreign ownership, bad closing totals and overlapping imports", async () => {
          const input = {
               idempotencyKey: "bank-bad-import-1",
               accountId: 99,
               reference: "STATEMENT-BAD",
               startDate: date,
               endDate: date,
               openingBalance: "0.00",
               closingBalance: "1.00",
               lines: [{ reference: "BANK-REF", date, amount: "1.00" }],
          };
          await expect(bank.importStatement(input)).rejects.toThrow("in this branch");
          await expect(bank.importStatement({ ...input, accountId: 11 })).rejects.toThrow("bank account");
          await expect(bank.importStatement({ ...input, accountId: 10, closingBalance: "1.01" })).rejects.toThrow(
               "must equal",
          );
          await imported();
          await expect(bank.importStatement({ ...input, accountId: 10 })).rejects.toThrow("overlap");
     });
     it("rejects foreign branch and amount mismatches, and does not auto-match ambiguous amounts", async () => {
          const foreignLine = await book("100.01", 9),
               wrong = await book("100.02", 2, "collection:10", "wrong-amount"),
               statement = await imported();
          const line = await db("pharmacy_accounting_statement_lines").first(),
               input = {
                    idempotencyKey: "bad-bank-match-1",
                    statementId: statement.id,
                    statementLineId: line.id,
                    journalLineId: foreignLine,
               };
          await expect(bank.match(input)).rejects.toThrow("not in this branch");
          await expect(bank.match({ ...input, journalLineId: wrong })).rejects.toThrow("exactly match");
          expect((await bank.list({ statementId: statement.id })).items[0].journal_line_id).toBeNull();
          await expect(
               new PharmacyAccountingReconciliation(db, { ...context, branch: 9 }).list({ statementId: statement.id }),
          ).rejects.toThrow("not found");
     });
     it("cannot finalize unmatched statement or additional unmatched book movements", async () => {
          const journalLineId = await book("100.01"),
               statement = await imported(),
               request = { idempotencyKey: "bank-finalize-1", statementId: statement.id, reason: "Review complete" };
          const reviewer = new PharmacyAccountingReconciliation(db, other);
          await expect(reviewer.finalize(request)).rejects.toThrow("Every statement line");
          const line = await db("pharmacy_accounting_statement_lines").first();
          await bank.match({
               idempotencyKey: "bank-match-1",
               statementId: statement.id,
               statementLineId: line.id,
               journalLineId,
          });
          await book("0.01", 2, "collection:10", "extra-book");
          await expect(reviewer.finalize(request)).rejects.toThrow("Unmatched bank ledger");
          expect((await bank.list({ statementId: statement.id })).statement.status).toBe("imported");
     });
});
describe("Scoped operational registers and statements", () => {
     it("reports real partial invoice balances without inventing due dates or bill allocations", async () => {
          await db("pharmacy_sales").insert([
               {
                    id: "sale2",
                    branchid: 2,
                    customer_account_id: 21,
                    total_amount: 100.01,
                    paid_amount: 40.01,
                    outstanding_amount: 60,
                    accounting_version: 3,
                    completed_at: date,
                    status: "completed",
               },
               {
                    id: "sale9",
                    branchid: 9,
                    customer_account_id: 29,
                    total_amount: 900,
                    paid_amount: 0,
                    outstanding_amount: 900,
                    accounting_version: 3,
                    completed_at: date,
                    status: "completed",
               },
          ]);
          const ar = await registers.receivables({ from: date, to: date });
          expect(ar.items).toHaveLength(1);
          expect(ar.totals).toMatchObject({ paid: "40.01", outstanding: "60.00" });
          expect(ar.items[0].due_date).toBeNull();
          await approvedExpense();
          expect((await registers.payables()).totals.outstanding).toBe("100.01");
          expect((await registers.statement("s1", "supplier")).closingBalance).toBe("100.01");
          await expect(registers.statement("s9", "supplier")).rejects.toThrow("not found");
          await expect(registers.statement("29", "customer")).rejects.toThrow("not found");
          expect((await registers.payables()).capabilities.legacyUnallocatedPaymentsRequireReview).toBe(true);
     });

     async function receiptBill(value = "100.01", ref = "receipt-bill-1", supplier = "s1") {
          await db("pharmacy_documents").insert({
               id: ref,
               branchid: 2,
               kind: "receipt",
               request_key: ref,
               request_hash: "source",
               supplier_id: supplier,
               amount: value,
               details: "{}",
          });
          await db("pharmacy_journals").insert({
               id: ref,
               branchid: 2,
               source_ref: ref,
               kind: "receipt",
               description: "Posted stock receipt",
               financial_date: "2026-10-01",
               created_by: 3,
          });
          await db("pharmacy_journal_lines").insert([
               { journal_id: ref, account_code: "inventory", debit: value, credit: 0 },
               { journal_id: ref, account_code: "payable:" + supplier, credit: value, debit: 0, document_ref: ref },
          ]);
          return new PharmacyAccountingSubledgers(db, context).registerBill({
               idempotencyKey: "register-" + ref,
               receiptId: ref,
               dueDate: "2026-10-15",
               reference: "SUP-INV-" + ref,
          });
     }
     async function approvedSettlement(bill: any, value = "40.01", suffix = "1") {
          const service = new PharmacyAccountingSubledgers(db, context),
               row = await service.createSettlement({
                    idempotencyKey: "settlement-create-" + suffix,
                    date,
                    description: "Approved supplier bill settlement",
                    allocations: [{ billId: bill.id, amount: value }],
               });
          await service.settlementAction(row.id, "submit", {
               idempotencyKey: "settlement-submit-" + suffix,
               expectedVersion: 1,
          });
          await new PharmacyAccountingSubledgers(db, other).settlementAction(row.id, "approve", {
               idempotencyKey: "settlement-approve-" + suffix,
               expectedVersion: 2,
          });
          return row.id;
     }
     async function creditInvoice(id = "invoice-1", branch = 2) {
          await db("pharmacy_sales").insert({
               id,
               branchid: branch,
               customer_account_id: branch === 2 ? 21 : 29,
               customer_name: "Credit patient",
               receipt_number: "PH-" + id,
               total_amount: 100.01,
               paid_amount: 0,
               outstanding_amount: 100.01,
               accounting_version: 3,
               completed_at: "2026-10-01",
               status: "completed",
          });
          await db("pharmacy_journals").insert({
               id,
               branchid: branch,
               source_ref: id,
               kind: "sale",
               description: "Original credit sale",
               financial_date: "2026-10-01",
               created_by: 3,
          });
          await db("pharmacy_journal_lines").insert([
               {
                    journal_id: id,
                    account_code: "receivable:" + (branch === 2 ? 21 : 29),
                    debit: 100.01,
                    credit: 0,
                    document_ref: id,
               },
               { journal_id: id, account_code: "sales", credit: 100.01, debit: 0 },
          ]);
          return id;
     }
     async function frozenTaxInvoice(
          id: string,
          parts: Array<{ gross: string; net: string; tax: string; rate: string; account: string }>,
          untaxed = "0.00",
     ) {
          await creditInvoice(id);
          const total = parts.reduce((s, p) => s.plus(p.gross), new Decimal(untaxed)).toFixed(2);
          const net = parts.reduce((s, p) => s.plus(p.net), new Decimal(untaxed)).toFixed(2);
          await db("pharmacy_sales").where({ id }).update({ total_amount: total, outstanding_amount: total });
          await db("pharmacy_journal_lines")
               .where({ journal_id: id, account_code: "receivable:21" })
               .update({ debit: total });
          await db("pharmacy_journal_lines").where({ journal_id: id, account_code: "sales" }).update({ credit: net });
          for (let i = 0; i < parts.length; i++) {
               const part = parts[i];
               await db("pharmacy_tax_events").insert({
                    id: id + "-tax-" + i,
                    branchid: 2,
                    sale_id: id,
                    sale_line_id: id + "-line-" + i,
                    event_type: "sale",
                    financial_date: "2026-10-01",
                    gross_amount: part.gross,
                    net_amount: part.net,
                    tax_amount: part.tax,
                    rate: part.rate,
                    local_account: part.account,
               });
               if (Number(part.tax))
                    await db("pharmacy_journal_lines").insert({
                         journal_id: id,
                         account_code: part.account,
                         credit: part.tax,
                         debit: 0,
                         document_ref: id,
                    });
          }
          return id;
     }
     async function approvedAdjustment(
          saleId: string,
          value = "10.00",
          suffix = "1",
          kind = "writeoff",
          financialDate = date,
     ) {
          const s = new PharmacyAccountingSubledgers(db, context),
               row = await s.createAdjustment({
                    idempotencyKey: "adjustment-create-" + suffix,
                    saleId,
                    date: financialDate,
                    kind,
                    amount: value,
                    account: kind === "credit" ? "revenue:credits" : "expense:bad_debt",
                    reason: "Reviewed invoice correction evidence",
                    ...(kind === "credit" ? { taxPolicy: TAX_CREDIT_POLICY } : {}),
               });
          await s.adjustmentAction(row.id, "submit", {
               idempotencyKey: "adjustment-submit-" + suffix,
               expectedVersion: 1,
          });
          await new PharmacyAccountingSubledgers(db, other).adjustmentAction(row.id, "approve", {
               idempotencyKey: "adjustment-approve-" + suffix,
               expectedVersion: 2,
          });
          return row.id;
     }
     async function paidExpense() {
          const id = await approvedExpense();
          const payment = await workflows.expenseAction(id, "pay", {
               idempotencyKey: "full-expense-payment-1",
               expectedVersion: 3,
               date,
               amount: "100.01",
               method: "card",
               reference: "BANK-EXPENSE-FULL",
          });
          return { id, paymentId: payment.paymentId };
     }
     async function approvedRefund(expenseId: string, paymentId: string, value = "40.01", suffix = "1") {
          const e = new PharmacyAccountingEvidence(db, context),
               row = await e.createRefund(expenseId, {
                    idempotencyKey: "refund-create-" + suffix,
                    paymentId,
                    amount: value,
                    date,
                    reason: "Supplier refund received evidence",
               });
          await e.refundAction(row.id, "submit", { idempotencyKey: "refund-submit-" + suffix, expectedVersion: 1 });
          await new PharmacyAccountingEvidence(db, other).refundAction(row.id, "approve", {
               idempotencyKey: "refund-approve-" + suffix,
               expectedVersion: 2,
          });
          return row.id;
     }
     describe("AP bill allocations, approvals and historical aging", () => {
          it("registers existing receipt liability without recognizing purchases a second time", async () => {
               const bill = await receiptBill();
               expect(bill).toMatchObject({ amount: "100.01", due_date: "2026-10-15", source_kind: "receipt" });
               expect(await db("pharmacy_journals")).toHaveLength(1);
               await expect(
                    new PharmacyAccountingSubledgers(db, context).registerBill({
                         idempotencyKey: "duplicate-bill-1",
                         receiptId: bill.source_ref,
                    }),
               ).rejects.toThrow("already registered");
               await expect(
                    new PharmacyAccountingSubledgers(db, { ...context, branch: 9 }).registerBill({
                         idempotencyKey: "foreign-bill-1",
                         receiptId: bill.source_ref,
                    }),
               ).rejects.toThrow("not found");
          });
          it("partially allocates exact cents only after independent settlement approval", async () => {
               const bill = await receiptBill(),
                    s = new PharmacyAccountingSubledgers(db, context);
               const draft = await s.createSettlement({
                    idempotencyKey: "settlement-draft-1",
                    date,
                    description: "Supplier partial settlement",
                    allocations: [{ billId: bill.id, amount: "40.01" }],
               });
               await expect(
                    s.settlementAction(draft.id, "pay", {
                         idempotencyKey: "draft-settlement-pay-1",
                         expectedVersion: 1,
                         method: "card",
                         reference: "BANK-AP-1",
                    }),
               ).rejects.toThrow("Cannot pay");
               await s.settlementAction(draft.id, "submit", {
                    idempotencyKey: "settlement-submit-1",
                    expectedVersion: 1,
               });
               await expect(
                    s.settlementAction(draft.id, "approve", {
                         idempotencyKey: "settlement-self-approve-1",
                         expectedVersion: 2,
                    }),
               ).rejects.toThrow("cannot approve");
               await new PharmacyAccountingSubledgers(db, other).settlementAction(draft.id, "approve", {
                    idempotencyKey: "settlement-approve-1",
                    expectedVersion: 2,
               });
               const req = {
                    idempotencyKey: "settlement-pay-1",
                    expectedVersion: 3,
                    method: "card",
                    reference: "BANK-AP-1",
               };
               expect(await s.settlementAction(draft.id, "pay", req)).toMatchObject({ status: "paid", version: 4 });
               await s.settlementAction(draft.id, "pay", req);
               expect(await db("pharmacy_accounting_allocations")).toHaveLength(1);
               const before = await s.payableAging({ asOf: "2026-11-01" }),
                    after = await s.payableAging({ asOf: date });
               expect(before.total).toBe("100.01");
               expect(after.total).toBe("60.00");
               expect(after.reconciliation.reconciled).toBe(true);
               expect(after.buckets.days_1_30).toBe("60.00");
               expect(
                    await db("pharmacy_journal_lines").where({ account_code: "payable:s1", debit: 40.01 }).first(),
               ).toMatchObject({ document_ref: bill.source_ref });
          });
          it("competing approved settlements cannot overallocate the same bill", async () => {
               const bill = await receiptBill(),
                    one = await approvedSettlement(bill, "60.01", "1"),
                    two = await approvedSettlement(bill, "60.01", "2");
               const s = new PharmacyAccountingSubledgers(db, context);
               const results = await Promise.allSettled(
                    [one, two].map((id, i) =>
                         s.settlementAction(id, "pay", {
                              idempotencyKey: "competing-ap-pay-" + i,
                              expectedVersion: 3,
                              method: "card",
                              reference: "BANK-AP-" + i,
                         }),
                    ),
               );
               expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
               expect((await s.payableAging({ asOf: date })).total).toBe("40.00");
               expect(await db("pharmacy_accounting_allocations")).toHaveLength(1);
          });
          it("shows unallocated historical payments as discrepancies, never fictitious bill allocation", async () => {
               await receiptBill();
               await book("20.00", 2, "payable:s1", "legacy-unallocated");
               const result = await new PharmacyAccountingSubledgers(db, context).payableAging({ asOf: date });
               expect(result.total).toBe("100.01");
               expect(result.reconciliation).toMatchObject({
                    controlBalance: "80.01",
                    difference: "-20.00",
                    reconciled: false,
               });
          });
          it("expense accruals and partial expense payments have real dated bill allocations", async () => {
               const id = await approvedExpense(),
                    s = new PharmacyAccountingSubledgers(db, context);
               expect((await s.payableAging({ asOf: "2026-11-01" })).items).toHaveLength(0);
               expect((await s.payableAging({ asOf: date })).total).toBe("100.01");
               await workflows.expenseAction(id, "pay", {
                    idempotencyKey: "expense-partial-allocate-1",
                    expectedVersion: 3,
                    date,
                    amount: "40.01",
                    method: "card",
                    reference: "BANK-EXP-ALLOC",
               });
               const result = await s.payableAging({ asOf: date });
               expect(result.items[0]).toMatchObject({
                    source_kind: "expense",
                    outstanding_amount: "60.00",
                    bucket: "current",
               });
               expect(result.reconciliation.reconciled).toBe(true);
          });
          it("does not silently alter recorded terms or use missing due dates as overdue", async () => {
               const bill = await receiptBill(),
                    s = new PharmacyAccountingSubledgers(db, context);
               await expect(
                    s.billDueDate(bill.id, {
                         idempotencyKey: "change-ap-terms-1",
                         dueDate: "2026-12-01",
                         reason: "Unsupported redating",
                    }),
               ).rejects.toThrow("immutable");
               expect(agingBucket(null, date)).toBe("unknown_due_date");
               expect(agingBucket("2026-07-01", date)).toBe("days_91_plus");
          });
     });
     describe("Reviewed due-date corrections and unpaid request recovery", () => {
          it.each(["payables", "receivables"] as const)("preserves original %s terms and money while independently applying dated corrections", async party => {
               const service = new PharmacyAccountingSubledgers(db, context);
               const sourceId = party === "payables" ? (await receiptBill()).id : await creditInvoice();
               if (party === "receivables") await service.invoiceDueDate(sourceId, { idempotencyKey: "terms-original", dueDate: "2026-10-15", reason: "Original agreed credit terms" });
               const input = { idempotencyKey: "terms-correction-create", date, expectedDueDate: "2026-10-15", dueDate: "2026-12-01", reason: "Supplier or customer agreed revised terms" };
               const before = await db("pharmacy_journal_lines").orderBy("id");
               const correction = await service.createTermsAmendment(party, sourceId, input);
               expect(await service.createTermsAmendment(party, sourceId, input)).toEqual(correction);
               const aging = (asOf: string) => party === "payables" ? service.payableAging({ asOf }) : service.receivableAging({ asOf });
               expect((await aging(date)).items[0].due_date).toBe("2026-10-15");
               await service.termsAmendmentAction(party, correction.id, "submit", { idempotencyKey: "terms-correction-submit", expectedVersion: 1 });
               await expect(service.termsAmendmentAction(party, correction.id, "approve", { idempotencyKey: "terms-correction-self", expectedVersion: 2 })).rejects.toThrow("own document");
               await new PharmacyAccountingSubledgers(db, other).termsAmendmentAction(party, correction.id, "approve", { idempotencyKey: "terms-correction-approve", expectedVersion: 2 });
               await expect(service.termsAmendmentAction(party, correction.id, "post", { idempotencyKey: "terms-correction-tamper", expectedVersion: 3, dueDate: "2027-01-01" })).rejects.toThrow("immutable");
               const post = { idempotencyKey: "terms-correction-post", expectedVersion: 3 };
               await service.termsAmendmentAction(party, correction.id, "post", post);
               await service.termsAmendmentAction(party, correction.id, "post", post);
               expect((await aging(date)).items[0].due_date).toBe("2026-12-01");
               expect((await aging("2026-11-01")).items[0].due_date).toBe("2026-10-15");
               const source = party === "payables" ? await db("pharmacy_accounting_bills").where({ id: sourceId }).first() : await db("pharmacy_accounting_invoice_terms").where({ sale_id: sourceId }).first();
               expect(source.due_date).toBe("2026-10-15");
               const current = party === "payables" ? await registers.payables() : await registers.receivables();
               expect((party === "payables" ? current.receipts : current.items)[0].due_date).toBe("2026-12-01");
               expect(await db("pharmacy_journal_lines").orderBy("id")).toEqual(before);
          });
          it("rejects cross-branch, stale and backdated terms and resolves same-day corrections by revision", async () => {
               const service = new PharmacyAccountingSubledgers(db, context), bill = await receiptBill();
               const input = { idempotencyKey: "terms-first-create", date, dueDate: "2026-12-01", expectedDueDate: "2026-10-15", reason: "Reviewed extension of supplier terms" };
               await expect(new PharmacyAccountingSubledgers(db, { ...context, branch: 9 }).createTermsAmendment("payables", bill.id, input)).rejects.toThrow("not found");
               const first = await service.createTermsAmendment("payables", bill.id, input);
               const competing = await service.createTermsAmendment("payables", bill.id, { ...input, idempotencyKey: "terms-competing-create" });
               const review = async (id: string) => {
                    await service.termsAmendmentAction("payables", id, "submit", { idempotencyKey: "terms-submit:" + id, expectedVersion: 1 });
                    await new PharmacyAccountingSubledgers(db, other).termsAmendmentAction("payables", id, "approve", { idempotencyKey: "terms-approve:" + id, expectedVersion: 2 });
               };
               await review(first.id); await review(competing.id);
               await service.termsAmendmentAction("payables", first.id, "post", { idempotencyKey: "terms-post-first", expectedVersion: 3 });
               await expect(service.termsAmendmentAction("payables", competing.id, "post", { idempotencyKey: "terms-post-competing", expectedVersion: 3 })).rejects.toThrow("changed");
               await service.termsAmendmentAction("payables", competing.id, "void", { idempotencyKey: "terms-void-stale", expectedVersion: 3, reason: "Superseded by another reviewed amendment" });
               await expect(service.createTermsAmendment("payables", bill.id, { ...input, idempotencyKey: "terms-stale-create" })).rejects.toThrow("changed");
               await expect(service.createTermsAmendment("payables", bill.id, { ...input, idempotencyKey: "terms-backdated", expectedDueDate: "2026-12-01", dueDate: "2026-12-15", date: "2026-11-01" })).rejects.toThrow("latest correction");
               const next = await service.createTermsAmendment("payables", bill.id, { ...input, idempotencyKey: "terms-next-create", expectedDueDate: "2026-12-01", dueDate: "2026-12-15" });
               await review(next.id);
               await service.termsAmendmentAction("payables", next.id, "post", { idempotencyKey: "terms-post-next", expectedVersion: 3 });
               expect((await service.payableAging({ asOf: date })).items[0].due_date).toBe("2026-12-15");
          });
          it("cancels approved but unpaid settlements and links replacements without recording money", async () => {
               const bill = await receiptBill(), id = await approvedSettlement(bill), service = new PharmacyAccountingSubledgers(db, context);
               const before = await db("pharmacy_journal_lines").orderBy("id");
               await expect(service.createSettlement({ idempotencyKey: "replacement-too-soon", date, description: "Correct payment request", replacesSettlementId: id, allocations: [{ billId: bill.id, amount: "20.00" }] })).rejects.toThrow("Cancel");
               await service.settlementAction(id, "void", { idempotencyKey: "cancel-approved-unpaid", expectedVersion: 3, reason: "Wrong date on unpaid request" });
               const replacement = await service.createSettlement({ idempotencyKey: "replacement-after-cancel", date, description: "Correct payment request", replacesSettlementId: id, allocations: [{ billId: bill.id, amount: "20.00" }] });
               expect((await workflows.detail(replacement.id, "ap_settlement")).details.replacesSettlementId).toBe(id);
               expect(await db("pharmacy_journal_lines").orderBy("id")).toEqual(before);
               expect((await workflows.detail(id, "ap_settlement")).status).toBe("voided");
          });
     });
     describe("AR due dates, independently controlled corrections and historical aging", () => {
          it("records invoice terms and reconstructs historic partial payments and writeoffs from journals", async () => {
               const saleId = await creditInvoice(),
                    s = new PharmacyAccountingSubledgers(db, context);
               await s.invoiceDueDate(saleId, {
                    idempotencyKey: "invoice-terms-1",
                    dueDate: "2026-10-15",
                    reason: "Approved patient credit terms",
               });
               await db("pharmacy_cash_events").insert({ id: "credit-collection-1", branchid: 2, sale_id: saleId });
               await db("pharmacy_journals").insert({
                    id: "collection-journal",
                    branchid: 2,
                    source_ref: "credit-collection-1",
                    kind: "receivable_collection",
                    financial_date: date,
                    description: "Actual partial collection",
                    created_by: 3,
               });
               await db("pharmacy_journal_lines").insert([
                    {
                         journal_id: "collection-journal",
                         account_code: "receivable:21",
                         debit: 0,
                         credit: 40.01,
                         document_ref: saleId,
                    },
                    { journal_id: "collection-journal", account_code: "collection:10", debit: 40.01, credit: 0 },
               ]);
               await db("pharmacy_sales").where({ id: saleId }).update({ paid_amount: 40.01, outstanding_amount: 60 });
               const adjustment = await approvedAdjustment(saleId);
               await s.adjustmentAction(adjustment, "post", {
                    idempotencyKey: "adjustment-post-1",
                    expectedVersion: 3,
               });
               expect((await s.receivableAging({ asOf: "2026-11-01" })).total).toBe("100.01");
               const result = await s.receivableAging({ asOf: date });
               expect(result.total).toBe("50.00");
               expect(result.buckets.days_1_30).toBe("50.00");
               expect(result.reconciliation.reconciled).toBe(true);
               expect(await db("pharmacy_sales").where({ id: saleId }).first()).toMatchObject({
                    paid_amount: 40.01,
                    outstanding_amount: 50,
               });
               expect((await registers.statement("21", "customer", { to: "2026-11-01" })).closingBalance).toBe(
                    "100.01",
               );
               expect(
                    await db("pharmacy_journal_lines")
                         .where({
                              journal_id: (await db("pharmacy_journals").where({ source_ref: adjustment }).first()).id,
                              account_code: "receivable:21",
                         })
                         .first(),
               ).toMatchObject({ document_ref: saleId });
          });
          it("requires correct counterpart types, branch ownership and immutable invoice terms", async () => {
               const saleId = await creditInvoice(),
                    foreign = await creditInvoice("invoice-9", 9),
                    s = new PharmacyAccountingSubledgers(db, context);
               const input = {
                    idempotencyKey: "ar-bad-adjustment-1",
                    saleId,
                    date,
                    kind: "writeoff",
                    amount: "1.00",
                    account: "inventory",
                    reason: "Wrong account type",
               };
               await expect(s.createAdjustment(input)).rejects.toThrow("expense account");
               await expect(s.createAdjustment({ ...input, saleId: foreign })).rejects.toThrow("not found");
               await s.invoiceDueDate(saleId, {
                    idempotencyKey: "invoice-terms-1",
                    dueDate: "2026-10-15",
                    reason: "Agreed invoice terms",
               });
               await expect(
                    s.invoiceDueDate(saleId, {
                         idempotencyKey: "invoice-terms-2",
                         dueDate: "2026-10-20",
                         reason: "Change historical terms",
                    }),
               ).rejects.toThrow("immutable");
          });
          it("requires explicit frozen-snapshot policy for taxed revenue credits", async () => {
               const saleId = await frozenTaxInvoice("tax-policy-invoice", [
                         { gross: "110.00", net: "100.00", tax: "10.00", rate: "10", account: "liability:vat_a" },
                    ]),
                    s = new PharmacyAccountingSubledgers(db, context);
               await expect(
                    s.createAdjustment({
                         idempotencyKey: "tax-credit-1",
                         saleId,
                         date,
                         kind: "credit",
                         amount: "10.00",
                         account: "revenue:credits",
                         reason: "Tax allocation not configured",
                    }),
               ).rejects.toThrow("explicit taxPolicy");
               expect(await db("pharmacy_accounting_documents").where({ kind: "ar_adjustment" })).toHaveLength(0);
          });
          it("competing approved credits cannot overadjust or fabricate cash paid", async () => {
               const saleId = await creditInvoice(),
                    one = await approvedAdjustment(saleId, "60.01", "1", "credit"),
                    two = await approvedAdjustment(saleId, "60.01", "2", "credit");
               const s = new PharmacyAccountingSubledgers(db, context);
               const result = await Promise.allSettled(
                    [one, two].map((id, n) =>
                         s.adjustmentAction(id, "post", {
                              idempotencyKey: "competing-adjustment-post-" + n,
                              expectedVersion: 3,
                         }),
                    ),
               );
               expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
               expect(await db("pharmacy_sales").where({ id: saleId }).first()).toMatchObject({
                    paid_amount: 0,
                    outstanding_amount: 40,
               });
               expect((await s.receivableAging({ asOf: date })).total).toBe("40.00");
          });
          it("requires independent adjustment approval and rolls back an audit failure", async () => {
               const saleId = await creditInvoice(),
                    s = new PharmacyAccountingSubledgers(db, context),
                    row = await s.createAdjustment({
                         idempotencyKey: "ar-adjustment-1",
                         saleId,
                         date,
                         kind: "writeoff",
                         amount: "1.00",
                         account: "expense:bad_debt",
                         reason: "Approved debt evidence",
                    });
               await s.adjustmentAction(row.id, "submit", { idempotencyKey: "ar-submit-1", expectedVersion: 1 });
               await expect(
                    s.adjustmentAction(row.id, "approve", { idempotencyKey: "ar-self-approve-1", expectedVersion: 2 }),
               ).rejects.toThrow("cannot approve");
               await new PharmacyAccountingSubledgers(db, other).adjustmentAction(row.id, "approve", {
                    idempotencyKey: "ar-approve-1",
                    expectedVersion: 2,
               });
               native.exec(
                    "CREATE TRIGGER reject_ar_post BEFORE INSERT ON pharmacy_accounting_audit WHEN NEW.action='ar_adjustment:post' BEGIN SELECT RAISE(ABORT,'audit storage failure'); END",
               );
               await expect(
                    s.adjustmentAction(row.id, "post", { idempotencyKey: "ar-post-1", expectedVersion: 3 }),
               ).rejects.toThrow("audit storage failure");
               expect((await db("pharmacy_sales").where({ id: saleId }).first()).outstanding_amount).toBe(100.01);
               expect(await db("pharmacy_journals").where({ kind: "receivable_adjustment" })).toHaveLength(0);
          });
     });
     describe("Safe immutable evidence objects and paid expense refunds", () => {
          it("uploads verified bytes, attaches only an authorized object and downloads through branch scope", async () => {
               const { id } = await workflows.createExpense(expenseInput()),
                    e = new PharmacyAccountingEvidence(db, context);
               const bytes = Buffer.from("%PDF-1.7\nReceipt evidence");
               const input = {
                    idempotencyKey: "evidence-upload-1",
                    filename: "Receipt.pdf",
                    mimeType: "application/pdf",
                    contentBase64: bytes.toString("base64"),
               };
               const upload = await e.upload(input);
               expect(await e.upload(input)).toEqual(upload);
               const attached = await e.attach(id, { idempotencyKey: "evidence-attach-1", uploadId: upload.id });
               const list = await e.attachments(id);
               expect(list.items).toHaveLength(1);
               expect(JSON.stringify(list)).not.toContain("content_base64");
               expect((await e.content(id, attached.id)).content.equals(bytes)).toBe(true);
               await expect(
                    new PharmacyAccountingEvidence(db, { ...context, branch: 9 }).content(id, attached.id),
               ).rejects.toThrow("not found");
               await expect(
                    e.attach(id, { idempotencyKey: "duplicate-attachment-1", uploadId: upload.id }),
               ).rejects.toThrow("already attached");
          });

          async function postedSettlement(method = "card", value = "40.01") {
               const bill = await receiptBill(),
                    id = await approvedSettlement(bill, value);
               if (method === "cash")
                    await db("pharmacy_shifts").insert({
                         id: "settlement-cash-shift",
                         branchid: 2,
                         active_key: "2:3",
                         financial_date: date,
                    });
               await new PharmacyAccountingSubledgers(db, context).settlementAction(id, "pay", {
                    idempotencyKey: "posted-settlement-pay-1",
                    expectedVersion: 3,
                    method,
                    ...(method === "cash" ? {} : { reference: "BANK-ORIGINAL-SETTLEMENT" }),
               });
               return { bill, id };
          }
          async function reversalReady(
               originalId: string,
               kind: "ap_reversal" | "ar_reversal",
               suffix = "1",
               reversalDate = "2026-11-03",
          ) {
               const r = new PharmacyAccountingReversals(db, context);
               const row = await r.create(originalId, kind, {
                    idempotencyKey: "reversal-create-" + suffix,
                    date: reversalDate,
                    reason: "Reviewed correction of original posting",
               });
               await r.action(row.id, kind, "submit", {
                    idempotencyKey: "reversal-submit-" + suffix,
                    expectedVersion: 1,
               });
               await new PharmacyAccountingReversals(db, other).action(row.id, kind, "approve", {
                    idempotencyKey: "reversal-approve-" + suffix,
                    expectedVersion: 2,
               });
               return row.id;
          }
          async function openReversalDay() {
               await db("pharmacy_financial_days").insert({
                    branchid: 2,
                    financial_date: "2026-11-03",
                    status: "open",
               });
          }
          describe("Audited replacement of voided reversal intents", () => {
               it.each(["ap_reversal", "ar_reversal"] as const)(
                    "replaces %s without losing lineage or inheriting review",
                    async (kind) => {
                         let originalId: string;
                         if (kind === "ap_reversal") originalId = (await postedSettlement()).id;
                         else {
                              originalId = await approvedAdjustment(await creditInvoice());
                              await new PharmacyAccountingSubledgers(db, context).adjustmentAction(originalId, "post", {
                                   idempotencyKey: "replace-original-ar-post",
                                   expectedVersion: 3,
                              });
                         }
                         await openReversalDay();
                         const r = new PharmacyAccountingReversals(db, context);
                         const initial = await r.create(originalId, kind, {
                              idempotencyKey: "replace-initial-create",
                              date: "2026-11-03",
                              reason: "Original reversal request",
                         });
                         await r.action(initial.id, kind, "void", {
                              idempotencyKey: "replace-initial-void",
                              expectedVersion: 1,
                              reason: "Incorrect review evidence, retained for audit",
                         });
                         const input = {
                              idempotencyKey: "replace-next-create",
                              expectedVersion: 2,
                              date: "2026-11-03",
                              reason: "Replacement with corrected review evidence",
                         };
                         const replacement = await r.replace(initial.id, kind, input);
                         expect(await r.replace(initial.id, kind, input)).toEqual(replacement);
                         expect(replacement).toMatchObject({
                              status: "draft",
                              version: 1,
                              replacesIntentId: initial.id,
                              originalDocumentId: originalId,
                         });
                         expect(
                              await db("pharmacy_accounting_documents").where({ id: initial.id }).first(),
                         ).toMatchObject({ reversal_of: originalId, status: "voided" });
                         expect(
                              await db("pharmacy_accounting_documents").where({ id: replacement.id }).first(),
                         ).toMatchObject({
                              reversal_of: originalId,
                              replaces_intent_id: initial.id,
                              submitted_by: null,
                              approved_by: null,
                         });
                         await expect(
                              r.action(replacement.id, kind, "post", {
                                   idempotencyKey: "replace-bypass-post",
                                   expectedVersion: 1,
                              }),
                         ).rejects.toThrow("Cannot post");
                         await r.action(replacement.id, kind, "submit", {
                              idempotencyKey: "replace-next-submit",
                              expectedVersion: 1,
                         });
                         await expect(
                              r.action(replacement.id, kind, "approve", {
                                   idempotencyKey: "replace-self-approve",
                                   expectedVersion: 2,
                              }),
                         ).rejects.toThrow("own document");
                         await new PharmacyAccountingReversals(db, other).action(replacement.id, kind, "approve", {
                              idempotencyKey: "replace-other-approve",
                              expectedVersion: 2,
                         });
                         await r.action(replacement.id, kind, "post", {
                              idempotencyKey: "replace-reviewed-post",
                              expectedVersion: 3,
                              ...(kind === "ap_reversal"
                                   ? { confirmedReceived: true, reference: "BANK-REPLACEMENT-RETURN" }
                                   : {}),
                         });
                         expect(
                              await db("pharmacy_accounting_documents").where({ reversal_of: originalId }),
                         ).toHaveLength(2);
                         await expect(
                              r.replace(initial.id, kind, { ...input, idempotencyKey: "replace-again-forbidden" }),
                         ).rejects.toThrow(/active or posted|already reversed/);
                         expect(
                              await db("pharmacy_accounting_audit").where({ entity_id: replacement.id }),
                         ).toHaveLength(4);
                    },
               );
               it("serializes replacement races, enforces predecessor version/branch and retains a chain of voided intents", async () => {
                    const originalId = (await postedSettlement()).id,
                         r = new PharmacyAccountingReversals(db, context);
                    const initial = await r.create(originalId, "ap_reversal", {
                         idempotencyKey: "chain-initial-create",
                         date,
                         reason: "First reversal intent",
                    });
                    await r.action(initial.id, "ap_reversal", "void", {
                         idempotencyKey: "chain-initial-void",
                         expectedVersion: 1,
                         reason: "Review evidence incomplete",
                    });
                    const input = {
                         idempotencyKey: "chain-replacement-one",
                         expectedVersion: 2,
                         date,
                         reason: "Re-reviewed replacement evidence",
                    };
                    await expect(
                         r.replace(initial.id, "ap_reversal", { ...input, expectedVersion: 1 }),
                    ).rejects.toThrow("changed");
                    await expect(
                         new PharmacyAccountingReversals(db, { ...context, branch: 9 }).replace(
                              initial.id,
                              "ap_reversal",
                              input,
                         ),
                    ).rejects.toThrow("not found");
                    const results = await Promise.allSettled([
                         r.replace(initial.id, "ap_reversal", input),
                         r.replace(initial.id, "ap_reversal", { ...input, idempotencyKey: "chain-replacement-two" }),
                    ]);
                    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
                    const next: any = (results.find((x) => x.status === "fulfilled") as any).value;
                    await r.action(next.id, "ap_reversal", "void", {
                         idempotencyKey: "chain-next-void",
                         expectedVersion: 1,
                         reason: "Further evidence is required",
                    });
                    await expect(
                         r.replace(initial.id, "ap_reversal", { ...input, idempotencyKey: "chain-old-predecessor" }),
                    ).rejects.toThrow("already replaced");
                    const final = await r.replace(next.id, "ap_reversal", {
                         ...input,
                         idempotencyKey: "chain-final-create",
                    });
                    expect(final.replacesIntentId).toBe(next.id);
                    expect(await db("pharmacy_accounting_documents").where({ reversal_of: originalId })).toHaveLength(
                         3,
                    );
                    expect(await db("pharmacy_journals").where({ source_ref: final.id })).toHaveLength(0);
               });
          });
          describe("Reviewed immutable AP settlement reversals", () => {
               it("restores exact bill amounts on the correction date without changing original settlement evidence", async () => {
                    const { bill, id } = await postedSettlement(),
                         original = await workflows.detail(id, "ap_settlement");
                    const allocations = await db("pharmacy_accounting_allocations").orderBy("id");
                    const lines = await db("pharmacy_journal_lines").orderBy("id");
                    await openReversalDay();
                    const reversal = await reversalReady(id, "ap_reversal"),
                         r = new PharmacyAccountingReversals(db, context);
                    const request = {
                         idempotencyKey: "ap-reversal-post-1",
                         expectedVersion: 3,
                         confirmedReceived: true,
                         reference: "BANK-AP-RETURN-1",
                    };
                    expect(await r.action(reversal, "ap_reversal", "post", request)).toMatchObject({
                         status: "posted",
                         originalDocumentId: id,
                    });
                    await r.action(reversal, "ap_reversal", "post", request);
                    expect((await workflows.detail(id, "ap_settlement")).details).toEqual(original.details);
                    expect((await workflows.detail(id, "ap_settlement")).status).toBe("paid");
                    expect(
                         await db("pharmacy_accounting_allocations")
                              .whereIn(
                                   "id",
                                   allocations.map((a) => a.id),
                              )
                              .orderBy("id"),
                    ).toEqual(allocations);
                    expect(
                         await db("pharmacy_journal_lines")
                              .whereIn(
                                   "id",
                                   lines.map((l) => l.id),
                              )
                              .orderBy("id"),
                    ).toEqual(lines);
                    const negative = await db("pharmacy_accounting_allocations")
                         .where({ document_id: reversal })
                         .first();
                    expect(negative).toMatchObject({
                         bill_id: bill.id,
                         amount: -40.01,
                         financial_date: "2026-11-03",
                         original_financial_date: date,
                         reversal_of_allocation_id: allocations[0].id,
                    });
                    const s = new PharmacyAccountingSubledgers(db, context);
                    expect((await s.payableAging({ asOf: date })).total).toBe("60.00");
                    expect((await s.payableAging({ asOf: "2026-11-03" })).total).toBe("100.01");
                    expect((await s.payableAging({ asOf: "2026-11-03" })).reconciliation.reconciled).toBe(true);
               });
               it("requires independent review, returned-funds evidence and a single reversal intent per original", async () => {
                    const { id } = await postedSettlement(),
                         r = new PharmacyAccountingReversals(db, context);
                    const draft = await r.create(id, "ap_reversal", {
                         idempotencyKey: "ap-review-create-1",
                         date,
                         reason: "Settlement needs reviewed reversal",
                    });
                    await expect(
                         r.create(id, "ap_reversal", {
                              idempotencyKey: "ap-second-create-1",
                              date,
                              reason: "Duplicate reversal is forbidden",
                         }),
                    ).rejects.toThrow("already exists");
                    await r.action(draft.id, "ap_reversal", "submit", {
                         idempotencyKey: "ap-review-submit-1",
                         expectedVersion: 1,
                    });
                    await expect(
                         r.action(draft.id, "ap_reversal", "approve", {
                              idempotencyKey: "ap-self-approve-1",
                              expectedVersion: 2,
                         }),
                    ).rejects.toThrow("cannot approve");
                    await new PharmacyAccountingReversals(db, other).action(draft.id, "ap_reversal", "approve", {
                         idempotencyKey: "ap-other-approve-1",
                         expectedVersion: 2,
                    });
                    await expect(
                         r.action(draft.id, "ap_reversal", "post", {
                              idempotencyKey: "ap-no-funds-post-1",
                              expectedVersion: 3,
                              reference: "BANK-NOT-RETURNED",
                         }),
                    ).rejects.toThrow("actually returned");
                    await expect(
                         new PharmacyAccountingReversals(db, { ...context, branch: 9 }).action(
                              draft.id,
                              "ap_reversal",
                              "post",
                              { idempotencyKey: "foreign-ap-reversal-1", expectedVersion: 3 },
                         ),
                    ).rejects.toThrow("not found");
               });
               it("uses the original cash destination and appends cash-shift reversal evidence", async () => {
                    const { id } = await postedSettlement("cash");
                    await openReversalDay();
                    await db("pharmacy_shifts")
                         .where({ id: "settlement-cash-shift" })
                         .update({ financial_date: "2026-11-03" });
                    await db("pharmacy_payment_routes").where({ method: "cash" }).update({ account_id: 99 });
                    const reversal = await reversalReady(id, "ap_reversal");
                    await new PharmacyAccountingReversals(db, context).action(reversal, "ap_reversal", "post", {
                         idempotencyKey: "cash-ap-reversal-post-1",
                         expectedVersion: 3,
                         confirmedReceived: true,
                    });
                    const evidence = await db("pharmacy_documents").where({ id: reversal }).first();
                    expect(evidence.amount).toBe(-40.01);
                    expect(JSON.parse(evidence.details)).toMatchObject({
                         accountId: 11,
                         shiftId: "settlement-cash-shift",
                         direction: "refund_received",
                    });
               });
               it("rolls back negative allocations when the bank is finalized or audit persistence fails", async () => {
                    const { id } = await postedSettlement();
                    await openReversalDay();
                    const reversal = await reversalReady(id, "ap_reversal"),
                         r = new PharmacyAccountingReversals(db, context),
                         request = {
                              idempotencyKey: "blocked-ap-reversal-1",
                              expectedVersion: 3,
                              confirmedReceived: true,
                              reference: "BANK-AP-RETURN-1",
                         };
                    await db("pharmacy_accounting_statements").insert({
                         id: "finalized-bank",
                         branchid: 2,
                         account_id: 10,
                         reference: "BANK-CLOSED",
                         start_date: date,
                         end_date: "2026-11-03",
                         opening_balance: 0,
                         closing_balance: 0,
                         status: "finalized",
                         created_by: 3,
                    });
                    await expect(r.action(reversal, "ap_reversal", "post", request)).rejects.toThrow("finalized");
                    expect(await db("pharmacy_accounting_allocations").where({ document_id: reversal })).toHaveLength(
                         0,
                    );
                    await db("pharmacy_accounting_statements")
                         .where({ id: "finalized-bank" })
                         .update({ status: "imported" });
                    native.exec(
                         "CREATE TRIGGER reject_ap_reversal BEFORE INSERT ON pharmacy_accounting_audit WHEN NEW.action='ap_reversal:post' BEGIN SELECT RAISE(ABORT,'audit storage failure'); END",
                    );
                    await expect(r.action(reversal, "ap_reversal", "post", request)).rejects.toThrow(
                         "audit storage failure",
                    );
                    expect(await db("pharmacy_accounting_allocations").where({ document_id: reversal })).toHaveLength(
                         0,
                    );
                    expect(await db("pharmacy_journals").where({ source_ref: reversal })).toHaveLength(0);
               });
          });
          describe("Reviewed AR credit/writeoff reversals", () => {
               it.each(["credit", "writeoff"])(
                    "restores %s outstanding exactly while preserving original posted lines",
                    async (kind) => {
                         const sale = await creditInvoice(),
                              adjustment = await approvedAdjustment(sale, "10.00", "1", kind),
                              s = new PharmacyAccountingSubledgers(db, context);
                         await s.adjustmentAction(adjustment, "post", {
                              idempotencyKey: "original-ar-post-1",
                              expectedVersion: 3,
                         });
                         const originalLines = await db("pharmacy_journal_lines").orderBy("id");
                         await openReversalDay();
                         const reversal = await reversalReady(adjustment, "ar_reversal");
                         await new PharmacyAccountingReversals(db, context).action(reversal, "ar_reversal", "post", {
                              idempotencyKey: "ar-reversal-post-1",
                              expectedVersion: 3,
                         });
                         expect(await db("pharmacy_sales").where({ id: sale }).first()).toMatchObject({
                              paid_amount: 0,
                              outstanding_amount: 100.01,
                         });
                         expect((await workflows.detail(adjustment, "ar_adjustment")).status).toBe("reversed");
                         expect(
                              await db("pharmacy_journal_lines")
                                   .whereIn(
                                        "id",
                                        originalLines.map((l) => l.id),
                                   )
                                   .orderBy("id"),
                         ).toEqual(originalLines);
                         expect((await s.receivableAging({ asOf: date })).total).toBe("90.01");
                         expect((await s.receivableAging({ asOf: "2026-11-03" })).total).toBe("100.01");
                         expect((await registers.statement("21", "customer")).closingBalance).toBe("100.01");
                    },
               );
               it("permits only one of competing reversal posts and never bypasses period locks", async () => {
                    const sale = await creditInvoice(),
                         adjustment = await approvedAdjustment(sale);
                    await new PharmacyAccountingSubledgers(db, context).adjustmentAction(adjustment, "post", {
                         idempotencyKey: "original-ar-post-1",
                         expectedVersion: 3,
                    });
                    await openReversalDay();
                    const reversal = await reversalReady(adjustment, "ar_reversal"),
                         r = new PharmacyAccountingReversals(db, context);
                    await db("acc_periods").where({ period_code: "2026-11" }).update({ status: "closed" });
                    await expect(
                         r.action(reversal, "ar_reversal", "post", {
                              idempotencyKey: "closed-ar-reversal-1",
                              expectedVersion: 3,
                         }),
                    ).rejects.toThrow("closed");
                    expect((await db("pharmacy_sales").where({ id: sale }).first()).outstanding_amount).toBe(90.01);
                    await db("acc_periods").where({ period_code: "2026-11" }).update({ status: "open" });
                    const results = await Promise.allSettled(
                         [1, 2].map((n) =>
                              r.action(reversal, "ar_reversal", "post", {
                                   idempotencyKey: "race-ar-reversal-" + n,
                                   expectedVersion: 3,
                              }),
                         ),
                    );
                    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
                    expect((await db("pharmacy_sales").where({ id: sale }).first()).outstanding_amount).toBe(100.01);
               });
          });
          describe("Frozen original-gross proportional tax credits", () => {
               it("uses exact largest remainder, residual caps and safe integer arithmetic at maximum currency", () => {
                    expect(cappedTaxCreditMinor(5, [3, 3, 1], [3, 3, 1])).toEqual([2, 2, 1]);
                    expect(cappedTaxCreditMinor(4, [100, 1], [1, 10])).toEqual([1, 3]);
                    expect(
                         cappedTaxCreditMinor(
                              99999999999999,
                              [50000000000000, 49999999999999],
                              [50000000000000, 49999999999999],
                         ),
                    ).toEqual([50000000000000, 49999999999999]);
                    expect(() => cappedTaxCreditMinor(8, [3, 3, 1], [3, 3, 1])).toThrow("residual capacity");
                    for (let gross = 1; gross <= 30; gross++)
                         for (let tax = 0; tax <= gross; tax++) {
                              let usedTax = 0;
                              for (let usedGross = 0; usedGross < gross; usedGross++) {
                                   const credited = taxCreditMinor(gross, tax, usedGross, usedTax, 1);
                                   expect(credited).toBeGreaterThanOrEqual(0);
                                   expect(credited).toBeLessThanOrEqual(1);
                                   usedTax += credited;
                              }
                              expect(usedTax).toBe(tax);
                         }
               });
               it("splits gross credits into original net and VAT without applying a new/current rate", async () => {
                    const sale = await frozenTaxInvoice("tax-invoice-1", [
                         { gross: "110.00", net: "100.00", tax: "10.00", rate: "10.0000", account: "liability:vat_a" },
                    ]);
                    const snapshot = await db("pharmacy_tax_events").orderBy("id");
                    const id = await approvedAdjustment(sale, "55.00", "tax-1", "credit");
                    await new PharmacyAccountingSubledgers(db, context).adjustmentAction(id, "post", {
                         idempotencyKey: "tax-credit-post-1",
                         expectedVersion: 3,
                    });
                    const header = await db("pharmacy_journals").where({ source_ref: id }).first(),
                         lines = await db("pharmacy_journal_lines").where({ journal_id: header.id });
                    expect(lines.find((l) => l.account_code === "revenue:credits")).toMatchObject({ debit: 50 });
                    expect(lines.find((l) => l.account_code === "liability:vat_a")).toMatchObject({
                         debit: 5,
                         document_ref: sale,
                    });
                    expect(lines.find((l) => l.account_code === "receivable:21")).toMatchObject({ credit: 55 });
                    const register = await new PharmacyAccountingTaxCredits(db, context).register({ saleId: sale });
                    expect(register.totals).toMatchObject({ gross: "55.00", net: "50.00", tax: "5.00" });
                    expect(register.items[0]).toMatchObject({
                         local_account: "liability:vat_a",
                         rate: 10,
                         source_credit_id: id,
                         original_gross_amount: 110,
                         original_tax_amount: 10,
                    });
                    expect(await db("pharmacy_tax_events").orderBy("id")).toEqual(snapshot);
               });
               it("exhausts mixed-rate and untaxed cent residuals exactly over multiple partial credits", async () => {
                    const sale = await frozenTaxInvoice(
                         "tiny-tax",
                         [
                              { gross: "0.03", net: "0.02", tax: "0.01", rate: "50", account: "liability:vat_a" },
                              { gross: "0.03", net: "0.02", tax: "0.01", rate: "50", account: "liability:vat_b" },
                         ],
                         "0.01",
                    );
                    const s = new PharmacyAccountingSubledgers(db, context);
                    for (let n = 0; n < 7; n++) {
                         const id = await approvedAdjustment(sale, "0.01", "tiny-" + n, "credit");
                         await s.adjustmentAction(id, "post", {
                              idempotencyKey: "tiny-tax-post-" + n,
                              expectedVersion: 3,
                         });
                    }
                    const register = await new PharmacyAccountingTaxCredits(db, context).register({ saleId: sale });
                    expect(register.totals).toMatchObject({ gross: "0.07", net: "0.05", tax: "0.02" });
                    expect((await db("pharmacy_sales").where({ id: sale }).first()).outstanding_amount).toBe(0);
                    for (const component of ["tiny-tax-tax-0", "tiny-tax-tax-1"]) {
                         const rows = register.items.filter((r) => r.component_ref === component);
                         expect(rows.reduce((v, r) => v + Number(r.tax_amount), 0)).toBeCloseTo(0.01, 2);
                    }
               });
               it("reverses exact original credited tax and restores capacity for a later credit", async () => {
                    const sale = await frozenTaxInvoice("tax-reverse", [
                         { gross: "110.00", net: "100.00", tax: "10.00", rate: "10", account: "liability:vat_a" },
                    ]);
                    const s = new PharmacyAccountingSubledgers(db, context),
                         id = await approvedAdjustment(sale, "55.00", "tax-original", "credit");
                    await s.adjustmentAction(id, "post", { idempotencyKey: "tax-original-post-1", expectedVersion: 3 });
                    const originals = await db("pharmacy_accounting_tax_adjustments").where({ credit_document_id: id });
                    await openReversalDay();
                    const reversal = await reversalReady(id, "ar_reversal");
                    await new PharmacyAccountingReversals(db, context).action(reversal, "ar_reversal", "post", {
                         idempotencyKey: "tax-ar-reversal-post-1",
                         expectedVersion: 3,
                    });
                    expect(await db("pharmacy_accounting_tax_adjustments").where({ credit_document_id: id })).toEqual(
                         originals,
                    );
                    const negative = await db("pharmacy_accounting_tax_adjustments")
                         .where({ credit_document_id: reversal })
                         .first();
                    expect(negative).toMatchObject({
                         gross_amount: -55,
                         net_amount: -50,
                         tax_amount: -5,
                         local_account: "liability:vat_a",
                         rate: 10,
                         reversal_of_adjustment_id: originals[0].id,
                         source_credit_id: id,
                    });
                    expect(
                         (await new PharmacyAccountingTaxCredits(db, context).register({ saleId: sale })).totals.tax,
                    ).toBe("0.00");
                    const next = await approvedAdjustment(sale, "55.00", "tax-after-reversal", "credit", "2026-11-03");
                    await s.adjustmentAction(next, "post", {
                         idempotencyKey: "tax-after-reversal-post-1",
                         expectedVersion: 3,
                    });
                    expect(
                         (await new PharmacyAccountingTaxCredits(db, context).register({ saleId: sale })).totals.tax,
                    ).toBe("5.00");
               });
               it("writeoffs and their reversals leave original VAT and tax-credit evidence untouched", async () => {
                    const sale = await frozenTaxInvoice("tax-writeoff", [
                         { gross: "110.00", net: "100.00", tax: "10.00", rate: "10", account: "liability:vat_a" },
                    ]);
                    const id = await approvedAdjustment(sale, "55.00", "tax-writeoff", "writeoff");
                    await new PharmacyAccountingSubledgers(db, context).adjustmentAction(id, "post", {
                         idempotencyKey: "tax-writeoff-post-1",
                         expectedVersion: 3,
                    });
                    await openReversalDay();
                    const reversal = await reversalReady(id, "ar_reversal");
                    await new PharmacyAccountingReversals(db, context).action(reversal, "ar_reversal", "post", {
                         idempotencyKey: "tax-writeoff-reverse-1",
                         expectedVersion: 3,
                    });
                    expect(await db("pharmacy_accounting_tax_adjustments")).toHaveLength(0);
                    const vat = await db("pharmacy_journal_lines").where({ account_code: "liability:vat_a" });
                    expect(vat).toHaveLength(1);
                    expect(vat[0]).toMatchObject({ debit: 0, credit: 10 });
               });
               it("rejects source snapshot changes after approval and rolls tax allocation back on audit failure", async () => {
                    const sale = await frozenTaxInvoice("tax-audit", [
                         { gross: "110.00", net: "100.00", tax: "10.00", rate: "10", account: "liability:vat_a" },
                    ]);
                    const id = await approvedAdjustment(sale, "55.00", "tax-audit", "credit"),
                         s = new PharmacyAccountingSubledgers(db, context),
                         request = { idempotencyKey: "tax-audit-post-1", expectedVersion: 3 };
                    await db("pharmacy_tax_events").where({ sale_id: sale }).update({ rate: 9 });
                    await expect(s.adjustmentAction(id, "post", request)).rejects.toThrow("snapshot changed");
                    await db("pharmacy_tax_events").where({ sale_id: sale }).update({ rate: 10 });
                    native.exec(
                         "CREATE TRIGGER reject_tax_credit BEFORE INSERT ON pharmacy_accounting_audit WHEN NEW.action='ar_adjustment:post' BEGIN SELECT RAISE(ABORT,'audit storage failure'); END",
                    );
                    await expect(s.adjustmentAction(id, "post", request)).rejects.toThrow("audit storage failure");
                    expect(await db("pharmacy_accounting_tax_adjustments")).toHaveLength(0);
                    expect((await db("pharmacy_sales").where({ id: sale }).first()).outstanding_amount).toBe(110);
               });
               it("rejects snapshot/journal mismatch and prevents spending restored tax capacity on a backdated credit", async () => {
                    const sale = await frozenTaxInvoice("tax-backdate", [
                         { gross: "110.00", net: "100.00", tax: "10.00", rate: "10", account: "liability:vat_a" },
                    ]);
                    const s = new PharmacyAccountingSubledgers(db, context);
                    await db("pharmacy_journal_lines")
                         .where({ journal_id: sale, account_code: "liability:vat_a" })
                         .update({ credit: 9 });
                    await expect(approvedAdjustment(sale, "55.00", "broken-source", "credit")).rejects.toThrow(
                         "originally posted tax liability",
                    );
                    await db("pharmacy_journal_lines")
                         .where({ journal_id: sale, account_code: "liability:vat_a" })
                         .update({ credit: 10 });
                    const credit = await approvedAdjustment(sale, "110.00", "backdate-original", "credit");
                    await s.adjustmentAction(credit, "post", {
                         idempotencyKey: "backdate-original-post-1",
                         expectedVersion: 3,
                    });
                    await openReversalDay();
                    const reversal = await reversalReady(credit, "ar_reversal");
                    await new PharmacyAccountingReversals(db, context).action(reversal, "ar_reversal", "post", {
                         idempotencyKey: "backdate-reversal-post-1",
                         expectedVersion: 3,
                    });
                    const backdated = await approvedAdjustment(sale, "110.00", "backdated-credit", "credit");
                    await expect(
                         s.adjustmentAction(backdated, "post", {
                              idempotencyKey: "backdated-credit-post-1",
                              expectedVersion: 3,
                         }),
                    ).rejects.toThrow("cannot predate");
                    expect((await s.receivableAging({ asOf: date })).total).toBe("0.00");
                    expect((await s.receivableAging({ asOf: "2026-11-03" })).total).toBe("110.00");
               });
          });
          it("rejects filesystem paths, spoofed MIME, arbitrary attachment URLs and another uploader object", async () => {
               const e = new PharmacyAccountingEvidence(db, context),
                    { id } = await workflows.createExpense(expenseInput());
               const input = {
                    idempotencyKey: "evidence-upload-1",
                    filename: "../secret.pdf",
                    mimeType: "application/pdf",
                    contentBase64: Buffer.from("%PDF-1.7\nEvidence").toString("base64"),
               };
               await expect(e.upload(input)).rejects.toThrow("path components");
               await expect(e.upload({ ...input, filename: "receipt.png", mimeType: "image/png" })).rejects.toThrow(
                    "matching mimeType",
               );
               const upload = await e.upload({ ...input, filename: "receipt.pdf" });
               await expect(
                    e.attach(id, {
                         idempotencyKey: "attachment-url-1",
                         uploadId: upload.id,
                         url: "file:///private/secret",
                    }),
               ).rejects.toThrow("uploadId only");
               await expect(
                    new PharmacyAccountingEvidence(db, other).attach(id, {
                         idempotencyKey: "other-attachment-1",
                         uploadId: upload.id,
                    }),
               ).rejects.toThrow("Authorized upload");
          });
          it("requires independent refund approval and reverses only actual received money against original account", async () => {
               const { id, paymentId } = await paidExpense(),
                    e = new PharmacyAccountingEvidence(db, context);
               const refundId = await approvedRefund(id, paymentId);
               await db("pharmacy_payment_routes").where({ method: "card" }).update({ account_id: 99 });
               const request = { idempotencyKey: "refund-receive-1", expectedVersion: 3, reference: "BANK-REFUND-1" };
               expect(await e.refundAction(refundId, "receive", request)).toMatchObject({ status: "received" });
               await e.refundAction(refundId, "receive", request);
               const expense = await workflows.detail(id, "expense");
               expect(expense).toMatchObject({ status: "partially_refunded", amount: 100.01 });
               expect(expense.details).toMatchObject({
                    paidAmount: "100.01",
                    refundedAmount: "40.01",
                    netPaidAmount: "60.00",
                    outstandingAmount: "0.00",
               });
               const journal = await db("pharmacy_journals").where({ source_ref: refundId }).first();
               expect(
                    await db("pharmacy_journal_lines")
                         .where({ journal_id: journal.id, account_code: "collection:10" })
                         .first(),
               ).toMatchObject({ debit: 40.01 });
               expect((await e.refunds(id)).items).toHaveLength(1);
               expect((await new PharmacyAccountingSubledgers(db, context).payableAging({ asOf: date })).total).toBe(
                    "0.00",
               );
               const finalRefund = await approvedRefund(id, paymentId, "60.00", "2");
               await e.refundAction(finalRefund, "receive", {
                    idempotencyKey: "refund-receive-2",
                    expectedVersion: 3,
                    reference: "BANK-REFUND-2",
               });
               expect((await workflows.detail(id, "expense")).status).toBe("refunded");
               expect((await workflows.detail(id, "expense")).details).toMatchObject({
                    paidAmount: "100.01",
                    refundedAmount: "100.01",
                    netPaidAmount: "0.00",
               });
          });
          it("prevents self-approval, overrefund races, arbitrary original payment and unpaid expense refunds", async () => {
               const unpaid = await approvedExpense(),
                    e = new PharmacyAccountingEvidence(db, context);
               await expect(
                    e.createRefund(unpaid, {
                         idempotencyKey: "unpaid-refund-1",
                         paymentId: "made-up",
                         date,
                         amount: "1.00",
                         reason: "Invalid refund",
                    }),
               ).rejects.toThrow("fully settled");
               const payment = await workflows.expenseAction(unpaid, "pay", {
                    idempotencyKey: "pay-before-refund-1",
                    expectedVersion: 3,
                    date,
                    amount: "100.01",
                    method: "card",
                    reference: "BANK-PAY-REFUND",
               });
               const draft = await e.createRefund(unpaid, {
                    idempotencyKey: "self-refund-1",
                    paymentId: payment.paymentId,
                    date,
                    amount: "1.00",
                    reason: "Refund needs approval",
               });
               await e.refundAction(draft.id, "submit", { idempotencyKey: "self-refund-submit-1", expectedVersion: 1 });
               await expect(
                    e.refundAction(draft.id, "approve", {
                         idempotencyKey: "self-refund-approve-1",
                         expectedVersion: 2,
                    }),
               ).rejects.toThrow("cannot approve");
               const one = await approvedRefund(unpaid, payment.paymentId, "70.00", "1"),
                    two = await approvedRefund(unpaid, payment.paymentId, "70.00", "2");
               const results = await Promise.allSettled(
                    [one, two].map((id, n) =>
                         e.refundAction(id, "receive", {
                              idempotencyKey: "race-refund-receive-" + n,
                              expectedVersion: 3,
                              reference: "BANK-REFUND-" + n,
                         }),
                    ),
               );
               expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
               expect((await workflows.detail(unpaid, "expense")).details.refundedAmount).toBe("70.00");
          });
          it("records cash refunds as new settlement-reversal evidence for existing shift handovers", async () => {
               const id = await approvedExpense(),
                    e = new PharmacyAccountingEvidence(db, context);
               await db("pharmacy_shifts").insert({
                    id: "cash-refund-shift",
                    branchid: 2,
                    active_key: "2:3",
                    financial_date: date,
               });
               const payment = await workflows.expenseAction(id, "pay", {
                    idempotencyKey: "cash-paid-for-refund-1",
                    expectedVersion: 3,
                    date,
                    amount: "100.01",
                    method: "cash",
               });
               const refund = await approvedRefund(id, payment.paymentId, "20.00");
               await e.refundAction(refund, "receive", { idempotencyKey: "cash-refund-receive-1", expectedVersion: 3 });
               const docs = await db("pharmacy_documents").where({ kind: "supplier_payment" });
               expect(docs.reduce((s: number, d: { amount: any; }) => s + Number(d.amount), 0)).toBeCloseTo(80.01, 2);
               const received = docs.find((d) => Number(d.amount) < 0);
               expect(JSON.parse(received.details)).toMatchObject({
                    direction: "refund_received",
                    shiftId: "cash-refund-shift",
                    accountId: 11,
               });
               expect(
                    await db("pharmacy_journal_lines").where({ account_code: "collection:11", debit: 20 }).first(),
               ).toBeTruthy();
          });
     });
     it("shows actual inventory valuation difference and scoped net revenue movements", async () => {
          await db("pharmacy_inventory_items").insert([
               {
                    id: "drug2",
                    branchid: 2,
                    name: "Medicine",
                    sku: "DRUG",
                    current_stock: 3,
                    cost_price: "1.333333",
                    is_active: true,
               },
               { id: "drug9", branchid: 9, name: "Other", current_stock: 100, cost_price: 10, is_active: true },
          ]);
          await book("4.00", 2, "inventory", "inventory-book");
          const inventory = await registers.inventory();
          expect(inventory.items).toHaveLength(1);
          expect(inventory.totals).toMatchObject({
               onHandValue: "4.00",
               inventoryControlBalance: "4.00",
               difference: "0.00",
          });
          await book("-100.01", 2, "sales", "sale-revenue");
          await book("10.00", 2, "sales", "sale-refund");
          await book("-999.00", 9, "sales", "other-revenue");
          expect((await registers.revenue()).totals.netRevenue).toBe("90.01");
     });
});
