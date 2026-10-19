# PLS Accounting Module Audit

**Scope:** backend `src/accountingModule/**`, `src/controllers/accounting/*` and the modules that post into it (billing, multi-payment, organization invoices, write-off, FOC, expenses, suppliers, inventory, payroll, payment gateway). Frontend `lobnos/app/accounting/**` and `lobnos/components/accounting/**`.

**Method:** read-only code review. No tests were run, no data was queried, and no code was changed. Findings carry file references so they can be re-verified. Items marked *verify* need a check against a live tenant.

> `src/accountingModule/critique.md` is out of date. It says the AR/AP subledgers, manual journals, periods and receivable-basis billing are missing. All of them now exist. The real gaps are below.

---

## 1. Executive summary: why clients may find the module substandard

The foundation is sound: double-entry journals, an outbox with idempotency, subledgers, periods, manual-journal approval, a financial PIN, day close with record locking, and bank reconciliation. The complaints more likely come from the following:

1. **Numbers that do not tie out.**
   - AP is incomplete in the subledger.
   - Aging and the dashboard read operational tables, not the ledger.
   - Repeat bill adjustments can be silently dropped.
   - Voids do not reverse VAT.
2. **Reports that mislead.** After year-end close, the income statement shows zero profit for the closed year. Branch reports omit unallocated lines. Trial balance has no opening balance column.
3. **Weak controls.**
   - The actor identity for journals is taken from the request body.
   - Reversals and voids have no authority check.
   - Unbalanced journals up to 0.01 are accepted.
   - Periods can close while postings are still pending or dead-lettered.
4. **Missing standard features.** There is no tax return, chart-of-accounts management, budgets, fixed-asset register, exports, or audit log.
5. **Usability.** There is no report export and no drill-down from a report line to the source bill. Several pages are placeholders. Formatting is inconsistent between pages.
6. **Thin tests.** Core services and all reports have no tests.

---

## 2. Implementation status matrix

| Area | Status |
|---|---|
| Double-entry GL, idempotent outbox posting | Implemented |
| Billing on receivable basis (DR AR / CR Revenue + VAT) | Implemented |
| Payments (cash and bank) | Implemented |
| Refund / void, write-off, staff FOC | Implemented, with VAT gap |
| Organization invoices | Payment posts per bill. AR is **by patient, not by organization** |
| Gateway payments | Post as bank. No clearing or fee accounts |
| AR subledger | Implemented |
| AP subledger | **Partial** (no expense rows) |
| Expenses, goods receipt, supplier payments | Implemented (supplier error swallowing) |
| Payroll | Partial (no SSNIT, no WHT) |
| Inventory COGS / wastage | Partial |
| Commissions, outsourced cost, discounts | **Not posted** |
| Periods, manual journals, bank reconciliation, day close | Implemented |
| Year-end close | Implemented with defects |
| Tax returns (VAT/NHIL/GETFund/COVID levy) | Not implemented |
| Budgets, fixed assets, multi-currency, recurring journals | Not implemented |
| Chart-of-accounts management | Not implemented |
| Report export (PDF/Excel/CSV) | Not implemented (browser print only) |
| Accounting audit log | Not implemented |

---

## 3. Posting coverage (backend)

| Business event | Posts to GL? | Evidence | Gap |
|---|---|---|---|
| Bill issued | Yes | `BillingAccounting.ts:47`, `billing-new-client-multi.ts:501,1272` | Legacy bills with no accrual fall back to cash basis. One flat tax line. |
| Payment | Yes | `BillingAccounting.ts:130`, `billing_shared.ts:240`, `multi-payment.ts:158` | Cash vs bank chosen by regex on the payment-mode name. A mode like "Insurance" or "POS" falls to Cash. |
| Organization invoice issue | **No** | `OrganizationInvoiceService` | AR is by patient. No organization AR view or aging. |
| Organization invoice payment | Yes, per bill | `OrganizationInvoiceService.ts:471` | The org payment row has no GL link. |
| Gateway payment | Yes | `PatientBillFulfilment.ts:18` | No fee, settlement or chargeback accounts. |
| Refund / void | Yes | `BillingAccounting.ts:409`, `WriteOff.ts:202` | **VAT not reversed.** Revenue debited at gross. |
| Discount / waive-off | **No** | Discount is netted before accrual | No contra-revenue account. |
| Write-off | Yes | `BillingAccounting.ts:206` | No allowance method. VAT not adjusted. |
| Staff FOC | Yes | `BillingAccounting.ts:272,341` | none |
| Outsourced-lab cost | **No** | no producer | Missing cost and AP. |
| Commissions | **No** | none | Only if keyed as an expense. |
| Expenses | Yes | `ExpenseAccounting.ts:50-250` | **No AP subledger rows.** Category mapping by regex. |
| Supplier payment | Yes | `SupplierAccounting.ts:21` | **Errors swallowed inside a transaction** (L61-67). `sourcePk: 0`. |
| Goods receipt | Yes | `InventoryAccounting.ts:16-181` | No landed cost. |
| Inventory adjustment | Partial | `InventoryAccounting.ts:194-196` | **Always debits Wastage, even for a stock gain.** |
| Payroll | Yes | `PayrollAccounting.ts:42` | **SSNIT Payable (2005) never used.** No employer cost. An unbalanced accrual dead-letters. |
| Bank charges, depreciation, interest, loans, tax remittance | **No** | none | Manual journals only. |

---

## 4. Confirmed defects and risks

### 4.1 Financial integrity (High)

| ID | Finding | Evidence | Fix |
|---|---|---|---|
| F1 | AP subledger lacks expense accrual, payment and reversal rows. AP reconcile always shows a gap. | `ExpenseAccounting.ts:84-85,133,187,240` vs `SubledgerService.ts:310-340` | Write AP subledger rows in the expense integration. Backfill. |
| F2 | AR/AP aging and `financialOverview` read operational tables, not the ledger. Expenses payable never appear. AP `partyId` is hard-coded null. | `AccountingReportService.ts` ~L240-295 | Drive aging from `acc_subledger_entries`. Add an organization party type. Show the reconcile difference. |
| F3 | The adjustment idempotency key includes the new payable amount. A sequence 100→150→200→150 drops the last change with no error. GL and `billing.payable` then diverge permanently. | `BillingAccounting.ts:96,117` | Key on a version or on the previous→new pair. Add a test. |
| F4 | Dead letters and failed rows do not block period or day close, and nothing alarms. The period "balanced" check is a tautology (every entry is already balanced). | `AccountingPeriodService.ts:57-72`, `FinancialDayCloseService.ts:47-48` | Require zero pending, failed and dead-letter rows before close. Alert on dead letters. |
| F5 | `BALANCE_TOLERANCE = 0.01` accepts journals up to one cent out of balance. | `AccountingService.ts:20`, `ManualJournalService.ts:17`, `AccountingCloseService.ts:15` | Compare integer cents exactly. |
| F6 | Income statement, YTD and trends include the year-end closing entry and show zero profit for a closed year. | `AccountingReportService.ts` ~L565 | Exclude `source_table = 'acc_year_close'` from P&L. |
| F7 | Year close uses a hard-coded calendar year and Retained Earnings code, has no authority gate, does not lock the year, and still accepts backdated postings. | `AccountingCloseService.ts:24-102` | Add authority, a fiscal-year setting, and reject postings into a closed year. |
| F8 | The actor ID is read from the request body, so segregation-of-duties can be bypassed and `created_by`, `approved_by` and `posted_by` can be forged. Reverse and void have no authority middleware. Reversal stamps the same user as approver and poster. | `ManualJournalController.ts:29-84`, `ManualJournalService.ts:169-173` | Use the authenticated user everywhere. Add `requireAuthority`. |
| F9 | Supplier posting swallows errors inside a caller transaction, so a failed enqueue silently drops the posting and the subledger row. | `SupplierAccounting.ts:61-67` | Re-throw when a `trx` is passed. Use a unique `sourcePk`. |

### 4.2 Medium

| ID | Finding | Fix |
|---|---|---|
| F10 | A void or refund does not reverse Output VAT. | Split voided amount into net and VAT using the stored tax value. |
| F11 | A stock gain posts to Wastage expense. | Use the movement sign. Add a stock-gain account. |
| F12 | Payroll omits SSNIT and employer cost. An unbalanced accrual dead-letters. | Add the lines. Validate before enqueue. |
| F13 | Commissions, outsourced cost and discounts are not posted. | Add integrations and contra accounts. |
| F14 | The outbox lock is an in-process `Set`. Two processes both sweep, and the loser records a failed attempt. | Claim rows with `SKIP LOCKED` or a status update. |
| F15 | Only one reversal can exist per source key. | Include the original entry id in the key. |
| F16 | Branch reports omit lines with no branch. | Default to the producer's branch or show an "unallocated" row. |
| F17 | No account create/update/deactivate API. `is_active` is not checked when posting. No DB trigger blocks UPDATE or DELETE on `acc_journal_*`. | Add endpoints with audit. Add immutability triggers. |
| F18 | `DATE(occurred_at)` filters bypass indexes. Naive DATETIME with no time-zone handling can move a late sale to the next day. | Use half-open ranges in a fixed accounting zone. |
| F19 | Financial PIN is not required for manual journal post, period close, year close or outbox replay. | Require the PIN. |
| F20 | Opening balances have no authority gate and do not seed subledger rows. | Gate it and seed both subledgers. |
| F21 | `soft_closed` periods do not block posting. Reopening is possible with the same permission. | Block posting or require a higher permission to reopen. |
| F22 | Outbox replay has no authority check or audit record. | Add both. |
| F23 | Trial balance shows period activity only, with no opening column, and accounts with no lines in range vanish. | Add opening, movement and closing. |
| F24 | Cash flow is an approximation that splits mixed entries pro-rata with hard-coded account groups. | Classify by account type per line. |
| F25 | Reports have no pagination or caching. `financialOverview` runs about eight heavy queries in parallel. | Add summary tables or caching. |

### 4.3 Low

- General ledger passes the sort value as the direction (`AccountingReportService`).
- Money math uses JS `Number`, rounded per row.
- The inventory valuation uses the latest transaction cost, not an average or FIFO cost.
- Dead Redis and queue code (`AccountingQueue.ts`, `AccountingWorker.ts`, `redisConnection.ts`) is a no-op and creates log noise.
- The `dividends` account type is not in the DB enum.
- `acc_journal_entries.transaction_type` has only five values, so write-offs, FOC, year close and stock moves are all `adjustment`.
- A closed-period posting retries 5 times and then dead-letters, after the operational record has already committed.

**Corrections to earlier assumptions:** posting does not use Redis, and the periodic outbox sweep runs every 15 seconds (`bootstrap/applicationStartup.ts:139`). Tenant isolation holds, since the token tenant id is cross-checked (`validateTenancy.ts:138`). Report SQL is parameterised, and no injection was found.

---

## 5. Frontend findings

| Page | State |
|---|---|
| Dashboard, balance sheet, income statement, cash flow, general ledger, statements, reconciliation, daily close, opening balances, bank accounts, bank reconciliation, periods, posting health, delegations, branches, inventory valuation | Implemented. Mostly no export or drill-down. |
| Trial balance | Uses an as-of input, not the reusable date filter. |
| Receivables, payables | Appear to be placeholders (no API call found). *verify* |
| Management revenue / expenses, inventory adjustments / COGS / wastage, payment accounts | Appear to be placeholders. *verify* |
| Year-end close | Action only. No preview or impact report. |

| Concern | Finding |
|---|---|
| Export | No PDF, Excel or CSV report export. Only browser print through `ReportShell.tsx:27`. |
| Drill-down | The API returns `source_module`, `source_table`, `source_pk`, `billingid`, `expense_id` and `invoice_id` (`lib/accounting/accountingApi.ts:26-42`), but nothing links to the source document. |
| Pagination | Statements and bank reconciliation use a fixed `count: 200`. General ledger and manual journals have no reliable pagination. |
| States | Loading, error and empty handling is inconsistent. There is no shared component. |
| Currency | No shared formatter or tenant currency source. Formatting is per page. |
| Permissions | Only a module-level client guard (`AccountingGuard.tsx`). Approve, post, close and void need finer gating, and server checks must be verified. |
| Accessibility | Icon-only buttons, and tables and modals need keyboard and screen-reader review. |
| Duplication | Fetch, date, loading, table and total logic is repeated per page. |
| Missing pages | Chart-of-accounts management, journal detail and reversal, AR/AP aging, tax reports, budgets, fixed assets, audit log. |

---

## 6. Missing standard features

Tax returns and levy accounts (NHIL, GETFund, COVID levy, Withholding Tax), employer SSNIT, budgets and variance, a fixed-asset register with depreciation, multi-currency, recurring and accrual journals, cost centres, organization statements and aging, report exports, and an accounting change log.

---

## 7. Test coverage

Present: `BillingAccounting.test.ts`, `AccountingOutboxService.test.ts`, `SubledgerService.test.ts`, plus narrow tests for receivables, authority and day close.

Missing:
- `AccountingService` posting and reversal
- reports
- periods
- year-end close and opening balances
- manual journals
- bank reconciliation
- inventory, payroll and supplier integrations
- expense amounts
- refund and write-off postings

The producer tests (expenses, multi-payment) mock the accounting module, so they do not verify what is posted.

Add invariant tests:
- every posted journal balances
- the subledger equals the control account
- the P&L excludes the closing entry
- the adjustment sequence 100→150→200→150

---

## 8. Proposed implementation sequence

| Phase | Work | Depends on | Acceptance criteria |
|---|---|---|---|
| 0 | Add test harness on a test database. Add invariant tests (above). | none | Tests fail on the current code for F3, F5 and F6. |
| 1 | Integrity fixes: F3, F5, F9, F8, F4, F6. | 0 | Invariant tests pass. Close is blocked while the outbox has pending, failed or dead rows. The actor comes from the token. |
| 2 | Subledger and reporting: F1, F2, F23, F16, F18. Backfill AP. Run reconcile per tenant. | 1 | AR and AP reconcile to the control accounts. Dashboard aging matches the ledger. |
| 3 | Posting completeness: F10-F13, F15, F20. | 1 | Void reverses VAT. Discounts, commissions, outsourced cost and SSNIT post. |
| 4 | Controls: F7, F17, F19, F21, F22, F14. | 1 | Year close is gated and locked. Posted journals are immutable. PIN required on high-risk actions. |
| 5 | Frontend: exports, source drill-down, shared report shell (states, formatter, pagination), real receivables and payables pages, journal detail and reversal, chart-of-accounts management, aging. | 2 | Every report exports. Every ledger line links to its source. |
| 6 | New features: tax returns, budgets, fixed assets, audit log. | 3, 4 | Per-feature acceptance to be agreed. |

**Migration note:** after F1, F3 and F10, run a reconcile for each tenant, backfill missing subledger rows, and drain dead letters before closing any period. Schema changes go through the `ensure*` routines, which are the only migration path here.

---

## 9. Safe validation checklist

Use a test tenant, never production credentials or real payments.
- Reconcile one trading day: daily sales report against trial balance revenue.
- AR subledger against GL account 1002 and AP against 2000. Expect a gap on AP until F1 is fixed.
- Edit a bill amount 100→150→200→150 and compare `billing.payable` to AR.
- Void a taxed bill and check Output VAT 2002.
- Close a period while an outbox row is dead-lettered. It should be blocked after F4.
- View the income statement for a year after year-end close.
- Forge `employeeid` in a manual journal approval request.

## Live verification and fixes applied

Tests: `npx vitest run src/accountingModule` passes (39 tests). `tsc --noEmit` is clean for the touched files. Live checks ran read-only against the tenant database, then one backfill.

### Live findings
- Ledger is internally sound: all journals balance, no failed or dead-lettered outbox rows, periods open.
- Billing is connected but has gaps. About 3,000 bills and about 9,100 payments pre-date go-live (2026-08-29) and were never posted. After go-live, 2 bills and 17 payments (₵4,356.40) were missing.
- Payroll is only partly connected. Only 2 of 10 paid periods are posted. Several periods did not balance (statutory deductions and employer cost were ignored), so they would have been rejected and the error swallowed.
- Inventory: receipts and supplier payments post. Consumption posted no COGS, because 114 of 118 items have cost price 0 and transactions carried no unit cost. GL inventory (₵177,616) does not equal the stock-card value (₵127,612).
- The legacy `POST /billing/payment/update` route wrote billing and history with no ledger posting. Its SQL also used non-existent columns (`paid_amount`, `billing`), so it was broken.

### Fixes applied
1. Payroll accrual now balances: SSNIT/statutory residual and employer contribution are posted to SSNIT payable (acc-2005). A failed enqueue now rolls back the caller's transaction.
2. Supplier and inventory-movement posting errors now propagate when inside a transaction instead of being swallowed.
3. Stock transactions fall back to the item's cost price when no unit cost is supplied, so COGS can post (items still need cost prices set).
4. Billing adjustment idempotency key is now `previous>new` payable, so repeated A→B→A edits are no longer dropped.
5. Legacy payment route repaired: correct columns, decimal amounts, overpayment guard, and ledger posting.
6. New `AccountingCoverageService`: `GET /api/v1/accounting/reconciliation/coverage` (compares documents with postings, split pre/post go-live) and `POST /api/v1/accounting/reconciliation/backfill` (owner only, dry-run unless `{"execute": true}`, post-go-live billing only). Backfill was executed: post-go-live billing gaps went from 2 bills / 17 payments to 0.

### Remaining decisions and work
- Pre-go-live history (about 3,000 bills, 9,100 payments, 7 payroll periods) needs an opening-balance decision. Do not backfill it blindly, since cash-basis revenue and AR would double count.
- Set cost prices on inventory items and reconcile GL inventory against the stock card.
- Run backfill for payroll periods and 4 unposted goods receipts after review.
- Bill edits and voids that change `billing.payable` without calling the receivable hook still drift; route them through `enqueueBillingReceivable`.
- Expense payment reversals are not posted as reversals.
- Frontend page for the coverage report is not built; the endpoint is ready.
- Not verified: the 3 failing `FacilityInput` tests are pre-existing and unrelated; the running server needs a rebuild from `src` for the code fixes to take effect.

### Frontend check and AP follow-up
- Reconciliation page (`/accounting/reconciliation`) now shows a "Ledger coverage by module" table from the new coverage endpoint, plus a bill-drift warning. AR reconciles (₵2,803.20 both sides).
- AP subledger root cause: supplier IDs are strings (`SUP-…`), `Number()` gave NaN, and the subledger insert failed silently, so supplier payments never reached the AP subledger. Fixed; backfill now posts post-go-live supplier payments.
- AP still differs by ₵50,500 (subledger -₵45,560 vs GL ₵4,940). Supplier payments after go-live (₵173,176) exceed supplier bills in the subledger (₵127,616), and 4 goods receipts are unposted. Needs accountant review (prepayments, the 4 receipts, opening AP).
