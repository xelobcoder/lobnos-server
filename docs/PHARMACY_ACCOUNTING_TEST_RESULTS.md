# Pharmacy Accounting Test Results

## Current sign-off: incomplete

Passing the selections below is not a claim that every implementation gap or
frontend UI/UX issue has been resolved. Current implementation and evidence boundaries:

| Area | Confirmed gap / evidence boundary |
|---|---|
| Reversal lifecycle | Implemented explicit replacement of the latest voided AP/AR reversal intent, immutable predecessor/original links, fresh independent approval, version/retry checks and generated database uniqueness for active/posted reversals. Included in the passing integrated backend selection. |
| Large cutover ranges | Implemented full-range keyset inspection with bounded 100-source review batches, exact global mismatch/orphan counts and server-side preflight. Isolated SQL verifies 15,100 same-date lines, differences beyond displayed samples, 10,001 orphans, empty shared sources and malformed source precision. Included in the passing integrated backend selection; fixtures use the production shared-line and source-journal lookup indexes, without raising the test timeout. |
| Legacy AP allocation | Implemented reviewed partial attribution of original supplier payments/credits and signed releases, cumulative limits, source evidence, independent approval and dated local/consolidated aging. Actual workflow-to-shared-report SQL tests verify selection of the newer bill rather than guessed FIFO and unchanged shared journal lines. |
| Payroll / Lab Accounting alignment | Owner feedback rejected the earlier dashboard-only approach. The corrective pass uses the actual Lab Accounting ReportShell/AccountingTable styles, neutral Payroll summaries, themed controls, form/review/save layouts and separate AR/AP workflow views. Financial-statement summaries reuse the overview's label/value/description component, including operating expenses. The subsequent guidance/purchasing selection passed 121 tests and frontend TypeScript. |
| Visual/accessibility acceptance | The expanded UI passed 116 isolated real-Chrome cases covering 19 accounting destinations, seven additional AR/AP views and three guidance/purchasing pages on desktop/mobile and light/dark. Assertions include computed table frames, configured font, theme actions, preserved drafts, exact IDs, readable purchasing tables, heading hierarchy and four print-to-PDF checks. This is synthetic component-browser evidence, not authenticated deployment or subjective owner approval. |
| Guidance and purchasing | Searchable pharmacy instructions, task-based navigation, contextual accounting help and request -> independent approval -> exact order -> delivery navigation are implemented. The targeted backend selection passed 17 tests using the transactional test adapter; this is not live MySQL certification. |
| Production accounting acceptance | Live MySQL concurrency, tenant migration/cutover, actual opening balances and facility policy/configuration remain unexecuted or unapproved. |

## Implementation verification

The audit baseline below is retained as historical evidence, not the current
implementation status.

Implemented and verified with isolated real SQL:

- Mapped local/shared/legacy GL posting and immutable source links, transaction
  rollback, explicit activation/cutover, shared period locks, account ownership,
  and repeat synchronization without duplicate postings.
- Actual credit sale, invoice-specific partial customer collection, changed-payload
  retry rejection and full refund through the local and consolidated books.
- Per-source/per-account reconciliation that detects missing or altered shared
  postings.
- Historical opening and running balances despite GL filters/pagination, net
  trial-balance columns, structured profit subtotals, and classified cash flow
  with internal transfers excluded.
- HTTP role denial and authenticated tenant/branch scope for the dedicated GL,
  plus parsing and checking a genuine generated Excel workbook.

Verification commands:

```powershell
pnpm exec vitest run src/models/pharmacy/PharmacyAccountingBridge.test.ts src/models/pharmacy/PharmacyFinancialReports.test.ts src/models/pharmacy/PharmacyPayments.test.ts src/models/pharmacy/PharmacyManagement.test.ts src/models/pharmacy/PharmacyOperations.test.ts src/controllers/pharmacy/PharmacyAnalyticsAccess.test.ts src/controllers/pharmacy/PharmacyAnalyticsTransaction.test.ts src/accountingModule/services/AccountingAccuracy.test.ts src/accountingModule/services/SubledgerService.test.ts src/middleware/facilityModuleAccess.test.ts
pnpm exec vitest run src/controllers/pharmacy/PharmacyAccountingLedgerController.test.ts src/models/pharmacy/PharmacyAccountingBridge.test.ts src/models/pharmacy/PharmacyFinancialReports.test.ts
pnpm exec tsc --noEmit
```

Integrated backend result before the reference-readability refinement: **408/408 tests across 33 files** and
**`pnpm exec tsc --noEmit` passed**:

```powershell
pnpm exec tsc --noEmit
pnpm exec vitest run src\models\pharmacy src\controllers\pharmacy src\accountingModule src\middleware\facilityModuleAccess.test.ts
```

The selection includes the real-SQL receipt -> bill registration -> independently
approved partial settlement -> accrued/part-paid expense integration. It checks
the attributed shared AP aging, local inventory control and source-by-source
consolidation, not merely balanced mocked journals.

Additional covered cases include frozen inclusive tax/refunds, reviewed AP/AR
reversals and proportional tax credits, evidence ownership/downloads, bank
finalization guards, original invoice attribution, contra-account normal balances,
operational journal drill-down, orphan shared postings, SQL-error redaction and
additive schema upgrades preserving existing rows. MySQL enum-upgrade tests
inspect generated statements; they do not execute live MySQL DDL.

### Latest integrated backend verification

After reversal replacement, reviewed legacy AP allocation, bounded cutover review
and consolidated document attribution: **446/446 tests across 34 files passed**,
followed by **`pnpm exec tsc --noEmit` passed**:

```powershell
pnpm exec vitest run src\models\pharmacy src\controllers\pharmacy src\accountingModule src\middleware\facilityModuleAccess.test.ts
pnpm exec tsc --noEmit
```

The actual reviewed payment and supplier-credit allocation/release tests compare
historical dates before application, after application and after release. Shared
AP aging keeps unreviewed credits visible as negative unapplied rows; it does not
silently apply pharmacy credits to the oldest bill. The exact GL lines are
unchanged by either application or release. Shared party statements continue to
show the original posted transactions, not fictitious cash/AP movements.

Original legacy payments and credited supplier-return evidence currently have no
exposed financial-cancellation API. They remain immutable; the source-retirement
helper is a prerequisite for any future dedicated correction implementation,
not a claim that such a correction endpoint exists.

After the reference-readability refinement, backend TypeScript and **33/33 tests
across the bridge and ledger-controller files** passed. That selection includes
compact/full reference searches without mutation of original identifiers,
unchanged balances and branch isolation:

```powershell
pnpm exec tsc --noEmit
pnpm exec vitest run src\models\pharmacy\PharmacyAccountingBridge.test.ts src\controllers\pharmacy\PharmacyAccountingLedgerController.test.ts
```

Before the Billing-inspired UI refactor, the frontend separately passed **94 focused tests**, TypeScript and its production
build (481 pages). These include rendered-table checks for concise references,
date formatting, exact-ID drill-down and unchanged full-ID Excel/PDF/CSV export
inputs. A subsequent two-test reference/ledger-only selection also passed.
This is rendered-component/build evidence, not a live authenticated-browser run.
Earlier selections overlap and must not be added together.

### Pharmacy guidance and purchasing verification

The latest usability pass adds the searchable **How to use pharmacy** page,
task-based sidebar groups, optional accounting explanations and everyday money
tasks. Accounting investigation tools remain available behind a disclosure.
Repeated Expenses/Liabilities headings and the redundant on-screen Section
column are removed without changing export data.

Purchase requests now have a dedicated review page with supplier quotations,
independent approval/rejection, version-aware retry and navigation to the exact
approved order. Submitting or approving a request does not itself receive stock
or record payment. Cash/day closing is explained separately from accounting,
and linked-mode finance hides unavailable legacy-only tabs.

Latest focused frontend result: **121/121 tests passed**, and **TypeScript
passed**, from the sibling frontend:

```powershell
pnpm exec tsc --noEmit
node --test tests\pharmacy-guidance.test.cjs tests\pharmacy-accounting-workflows.test.cjs tests\pharmacy-operations-ui.test.cjs tests\role-link-consistency.test.cjs
```

The expanded isolated real-Chrome harness passed **116 cases with no detected
issues or runtime exceptions**. It additionally exercises guide search,
single statement headings, own-request approval denial, independent approval,
the exact version/quotation/idempotency payload, request submission and the
approved order's receiving form. Mobile quotation/request tables have explicit
scroll hints, focusable regions and readable action widths. Review headings
are checked against the page title size and visually inspected.

The targeted backend procurement/management selection passed **17/17 tests**
and **backend TypeScript passed**:

```powershell
pnpm exec vitest run src\models\pharmacy\PharmacyProcurement.test.ts src\models\pharmacy\PharmacyManagement.test.ts
pnpm exec tsc --noEmit
```

Procurement tests use the existing transactional adapter to exercise independent
approval, alternate quotations, stale versions, rejection, role/branch denial,
partial/full receipt and idempotent retry. These are service/adapter tests,
not actual MySQL concurrency or SQL-engine certification. Browser mutations
use in-memory fixtures, not tenant data. This pass changes no financial
calculations or backend production rules. No production build or live tenant
operations were performed. Owner usability acceptance remains outstanding;
the passing tests do not establish that every pharmacy gap is resolved.

### Billing-inspired frontend alignment

#### Corrective Payroll / Lab Accounting composition

The earlier checks did not establish that the presentation matched the owner's
strategy. The earlier comparison to Lab filtering/worklists did not address Lab
Accounting. The corrective comparison covers Payroll dashboard, screen styles,
period creation and summary strips, plus Lab Accounting report shells, tables
and journal/ledger pages. It replaces the prior Billing summary composition.
Accounting now:

- Reuses feature-sidebar navigation rather than repeating 19 links on every page.
- Uses one concise page heading, contextual subtitle and relevant task actions.
- Reuses Lab Accounting ReportShell and AccountingTable CSS modules rather than
  introducing another generic table and heading style.
- Uses neutral Payroll-style summary strips, themed buttons and consistent fields.
- Gives journal/expense editors a main form, review aside and save bar.
- Keeps editable journal/bank tables readable on mobile using minimum control
  widths, a labelled keyboard-focusable scroll region and an explicit scroll hint.
- Separates AR/AP invoices/bills, adjustments/settlements, existing credits,
  reversals and aging. Unvisited views do not mount; visited forms remain mounted
  so switching views does not discard unfinished edits.
- Keeps filters, print and full-filtered exports separate. Registers without
  supported filters do not show a meaningless Apply button.
- Preserves exact identifiers, financial handlers, independent approvals and exports.

Financial-statement summaries no longer render as generic facts. They reuse the
same label/value/supporting-description component as the overview's Receivables
and Payables, grouped into Sales, Stock, and Ledger & expenses. Refunds, tax
(including zero) and expenses use shared currency formatting; counts remain
numbers. Stock descriptions identify current snapshots. Operating expenses have
a separate metric and review link; the server's profit is not recalculated.
Missing values are not invented as zeros.

The preceding summary-card pass had **74/74 tests passed**, with **TypeScript passed**.
Its real-Chrome matrix passed **104 cases with no detected issues or runtime
exceptions**, including real PrimeTable, date controls, supplier keyboard
selection, original API-handler payloads and shared currency/select helpers.
Statement checks verify all 14 metrics, expense navigation and million-scale
currency values fitting without line breaks in both viewports and themes.
Unknown synthetic endpoints fail explicitly instead of returning empty success.
Four in-memory PDF checks cover ledger, statements, inventory and tax.
The harness includes the real Pharmacy feature-layout CSS and explicitly selects
the application's Segoe UI font option. Earlier isolated screenshots did not
reproduce the application font variables. Next-generated Google fonts and the
authenticated application shell remain outside this harness.

Reproduce from the sibling frontend using the
[isolated browser harness](../../lobnos/tests/browser/accounting-harness/README.md).
The harness replaces transport, identity, server authentication and Next links;
it does not certify the full application shell/router, live authentication,
persisted mutations, exhaustive accessibility or owner design acceptance.
The owned server/browser and exact generated bundle/profile were cleaned up.
No production application build or live tenant operations were performed.

The following paragraphs retain the earlier verification history.

The accounting destinations now use unboxed semantic sections for forms,
prescribed summary metric cards, shared currency formatting, PrimeTable,
established date presets/loaders and searchable supplier names. Document
creation/review uses progressive disclosure; approval versions, exact source
identifiers, links and exports remain preserved. Compound date/supplier controls
have explicit labels outside their secondary controls and retry buttons.

Latest validation after this refactor: **62/62 focused tests** and
**frontend TypeScript passed**:

```powershell
pnpm exec tsc --noEmit
node --test tests\pharmacy-accounting-workflows.test.cjs tests\pharmacy-operations-ui.test.cjs
```

The selection includes mocked React/JSDOM rendering of all 19 accounting
destinations, form ancestry and summary structure, supplier selection, error
states, financial transaction payloads and legacy finance/day/handover workflows.
The shared PrimeTable and date-control dependencies are mocked in this coverage;
these results are not complete live-browser integration certification.
No production build was run after this refactor: current UI instructions require
permission before building. No shared application server was started or stopped,
and no live tenant operations were performed.

These are not live-MySQL/cutover certification. No live migration or backfill was
performed. Actual account assignments, tax policy, opening balances, previously
unallocated supplier credits/payments and production locking remain financial
review/deployment concerns, not fabricated successful test results.

## Current acceptance evidence

The later audit-phase table is historical. Current automated evidence is:

| ID | Implemented and tested evidence | Remaining evidence boundary |
|---|---|---|
| V01 | Real local/shared/legacy sale posting; frozen tax split and original-rate refund. | Facility-approved rates and live receipt review. |
| V02 | Actual composite credit sale posts patient AR into both books. | Insurance/NHIS claim registration is not automatic payer recognition. |
| V03 | Actual invoice-specific partial collection/retry, original invoice identity and historical aging. | No inferred historical payment allocation. |
| V04 | Actual stock receiving creates AP; bill registration does not recognize it twice. | Existing unlinked history requires reviewed cutover. |
| V05 | Independent approval, bill allocation, partial settlement/retry, dated reversal, and reviewed legacy payment/credit application and release. | Unreviewed history remains explicitly unapplied; live opening balances and source completeness require finance review. |
| V06 | Moving-average receiving, sale COGS/returns/stock workflows and current stock-to-control comparison. | Live opening quantities/costs and historical physical snapshots are not inferred. |
| V07 | Explicit expense mapping, draft/submit/independent approval, accrual, partial payment, evidence and refund. | Input-tax treatment is not guessed from an attachment. |
| V08 | Exact source reversals/refunds, tax-credit reversal, allocation reversal and guarded whole-sale refunds. | Source-specific corrections are mandatory; shared-only pharmacy reversal is rejected. |
| V09 | Net debit/credit balances, not gross movement columns, tested against the ledger. | Live source completeness still needs cutover reconciliation. |
| V10 | Local statements and actual shared party/control balances reconcile in isolated SQL. | No invented departmental shared-asset/equity allocation. |
| V11 | Pharmacy-only source tables and branch-scoped APIs; shared entries explicitly attributed once. | Authorized organization consolidation intentionally includes pharmacy. |
| V12 | HTTP role, branch/source ID and tenant-context checks; disabled-module middleware tests. | Full production JWT/deployment topology is not simulated. |
| V13 | Retry identity, changed-payload rejection, posting links and transactional rollback. | Real MySQL concurrency is not certified by SQLite tests. |
| V14 | Day/shared period locks, independent approvals, immutable audit evidence and finalized-bank locks. | Organization-wide period actions retain facility authority. |
| V15 | One-time historical synchronization, per-source/account reconciliation and orphan posting detection. | Live source inventory and historical approval are never automatic. |

## Audit-phase result

**Existing focused baseline passed: 155 tests across 10 files.**
This is evidence for existing behavior, not certification of the complete
Pharmacy Accounting module. No application fixes were made during this audit.
No migrations, live tenant queries, bank imports, or backfills were executed.

Run from the backend repository:

```powershell
pnpm exec vitest run src/models/pharmacy/PharmacyPayments.test.ts src/models/pharmacy/PharmacyManagement.test.ts src/models/pharmacy/PharmacyOperations.test.ts src/models/pharmacy/PharmacyFinancialReports.test.ts src/models/pharmacy/PharmacyCheckout.test.ts src/controllers/pharmacy/PharmacyAnalyticsAccess.test.ts src/controllers/pharmacy/PharmacyAnalyticsTransaction.test.ts src/accountingModule/services/AccountingAccuracy.test.ts src/accountingModule/services/SubledgerService.test.ts src/middleware/facilityModuleAccess.test.ts
```

The runner returned exit code 0. It emitted a Vite configuration-loader
compatibility warning, not a test failure.

## What these tests actually verify

| Suite | Verified existing behavior | Limitation |
|---|---|---|
| `PharmacyPayments.test.ts` | Local cash/COGS journal balance, destination checks, transaction rollback, refund retry protection and day locks. | Uses the in-memory transactional fixture; explicitly leaves shared accounting untouched. |
| `PharmacyManagement.test.ts` | Stock receipt/payable, units, retries, branch/supplier checks, partial receiving, opening import and write-off behavior. | Does not establish bill-level payment allocation or consolidated posting. |
| `PharmacyOperations.test.ts` | Explicit days, close/reopen history, historical corrections, shift safeguards and purchase-unit behavior. | Day closure is not a consolidated accounting-period lock. |
| `PharmacyFinancialReports.test.ts` | Account grouping, derived earnings and inventory-adjustment inclusion. | Does not test report query reconciliation, net trial-balance columns or allocated departmental equity. |
| `PharmacyCheckout.test.ts` | Checkout, persisted totals/payment, failed-tender rollback and reversal. | Not a complete credit/insurer/subledger integration test. |
| `PharmacyAnalyticsAccess.test.ts` | Finance role/report allowlists and separation from operational report families. | Calls middleware directly, not the complete authenticated HTTP chain. |
| `PharmacyAnalyticsTransaction.test.ts` | Transaction setup and accounting handler snapshot wiring. | Does not connect to a real tenant MySQL database. |
| `AccountingAccuracy.test.ts` | Shared engine/report SQL, exact money, AR/AP, reversals, closing, cash flow, bank matches and report consistency. | Isolated SQLite-backed adapter with mocked tenant connection/legacy ledger side effects; no pharmacy consolidation. |
| `SubledgerService.test.ts` | Existing shared subledger behavior under its fixtures. | Does not prove pharmacy department scoping. |
| `facilityModuleAccess.test.ts` | Explicit module denials, pharmacy-only versus inventory activation, super-admin policy and legacy configuration behavior. | Unit-level entitlement checks; legacy absent configuration remains allowed. |

## Reproduced report gap

A no-database probe imported the actual `statementRows` function with
`node -r ts-node/register/transpile-only` and checked:

```javascript
const balances = [
  { account: 'collection:1', debit: 100, credit: 40 },
  { account: 'sales', debit: 0, credit: 100 },
  { account: 'operating_expenses', debit: 40, credit: 0 },
];
const rows = statementRows(balances, 'trial_balance');
```

The cash row has `amount: 60`, `debit: 100`, and `credit: 40`. Source inspection
of `pharmacyFinancialReport` confirms the trial-balance columns select `debit`
and `credit`, not the net `amount`. Thus the displayed report contains movements
rather than the required debit/credit balances. The probe passed its assertions
of this current behavior; it did **not** verify a fix.

For these fixtures, a net trial balance should display cash debit 60, expense
debit 40 and revenue credit 100, with total debit/credit balances of 100 each.
The current movement totals are 140 each. Both sum equally; checking equality
alone misses the defect.

## Corrective-brief acceptance traceability

"Partial evidence" means some existing local/shared behavior passed, but the
complete pharmacy-to-consolidated workflow is not verified.

| Acceptance ID | Required scenario | Current evidence / result | Missing acceptance proof |
|---|---|---|---|
| V01 | Cash pharmacy sale posts correctly | Partial evidence: pharmacy payment/checkout suites pass. | Same transaction traced once into attributed shared GL and formal statements, including tax/discount policy. |
| V02 | Credit sale creates AR | Partial evidence: implementation inspected in `PharmacySettlement.ts`. | Direct isolated automated credit-sale/control-account test and consolidated trace. |
| V03 | Partial customer payment reduces correct AR | Partial evidence: invoice-locked receive implementation inspected. | Competing payment/retry, invoice allocation and historical AR reconciliation tests. |
| V04 | Credit purchase creates AP | Partial evidence: receipt test posts local supplier liability. | Invoice/receipt recognition contract, attributed shared AP and no second invoice accrual. |
| V05 | Partial supplier payment reduces correct AP | Partial evidence: aggregate supplier-payment code inspected. | Selected bill allocations and approval/reconciliation tests; workflow not complete. |
| V06 | Inventory/COGS recognized correctly | Partial evidence: local receipts/cash-sale/returns tests pass. | Multi-cost receipts/sales/returns/write-offs/transit/quarantine reconciled to control account. |
| V07 | Expenses post to appropriate accounts | Not satisfied: paid local expense uses one `operating_expenses` account. | Categories, approval, accrual/payment, attachment and reversal lifecycle. |
| V08 | Refund/reversal preserves integrity | Partial evidence: local refunds and shared generic reversals pass independently. | Pharmacy/consolidated reversal linkage, credit and supplier cases, closed-period corrections. |
| V09 | Trial balance debits equal credits | Partial evidence: balanced local journals and shared SQL checks. | Net trial-balance representation is incorrect; fix and reconcile net balances. |
| V10 | GL reconciles to statements | Partial evidence: shared generic SQL report tests pass. | Pharmacy reports against shared attributed GL and approved balance-sheet allocations. |
| V11 | Pharmacy excluded from lab-only views | Partial evidence: local-table separation tests pass. | Mixed-module shared-GL fixtures, report/export/drill-down and consolidation tests after integration. |
| V12 | Unauthorized accounting API access denied | Partial evidence: finance-role and explicit module-denial unit tests pass. | Full tenant/session/branch/role/module HTTP matrix; decide absent-config compatibility. |
| V13 | Duplicate financial posting prevented | Partial evidence: local document/payment retry tests pass. | Shared/local posting-link uniqueness, changed-payload retry and MySQL concurrency proof. |
| V14 | Period locks and audit trails work | Partial evidence: pharmacy day and shared period tests pass separately. | Unified policy, journal/expense approvals, close/post races, audit workspace and denied corrections. |
| V15 | Consolidation does not double-count | Not satisfied: pharmacy-to-shared integration is absent. | Historical dry-run, stable source mapping, rerun with zero extras and cross-book reconciliation. |

Source search found no `*.test.ts` references to `PharmacyCustomerAccounts`,
`collectCompositeSale`, `pharmacySettlement`, or `receivable_collection`.
This is a coverage gap, not proof that indirect invocation is impossible.

## Deferred checks

- No full backend suite, new build, or front-end suite was run in this
  documentation-only audit phase.
- Earlier front-end build/type checks and focused UI tests passed; the earlier
  full front-end run had 65 failures. Those are historical results, not a fresh
  baseline, and their cause must not be labelled pre-existing without comparison.
- MySQL uniqueness/locking/migration behavior, live source completeness,
  departmental allocations, and production financial reconciliation remain
  unverified.

The [implementation plan](PHARMACY_ACCOUNTING_IMPLEMENTATION_PLAN.md) defines
the changes and gates. A01-A19/X01-X03 remain tracked in the
[gap analysis](PHARMACY_ACCOUNTING_FUNCTIONAL_GAP_ANALYSIS.md); none is completed
merely by a chart, menu entry, or passing unrelated shared-engine test.
