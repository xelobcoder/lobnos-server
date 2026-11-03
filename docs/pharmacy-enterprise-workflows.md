# Pharmacy financial corrections, pricing and analytics

Pharmacy inventory and operational source journals remain separate from laboratory
inventory. Configured pharmacy accounting can post those source journals into the
shared organization GL, attributed to the pharmacy source module and branch.
All pharmacy operations and reports use the authenticated branch and employee.

## Find the right pharmacy task

The pharmacy navigation groups existing pages into **Sell & serve customers**,
**Buy & manage stock**, **Cash & day closing**, **Pharmacy Accounting**,
reports and setup. Existing routes and role restrictions remain in place.
**How to use pharmacy** (`/pharmacy/guide`) provides searchable task walkthroughs,
an explanation of each static pharmacy page and a plain-language accounting
glossary. Links are limited to pages the reader's role can access.

The overview's **What do you need to do?** launcher presents tasks for the active
role: selling, counter payment, medication handover, receiving, purchase orders,
supplier payment, customer collections and trading-day closing as authorized.
Use **Check stock & prices** for daily availability checks; **Reference registers
→ Catalogue** retains the catalogue without competing as a second stock task.
Accounting registers remain available for investigation, not mandatory navigation
for every routine task.

Previous-day guidance separates cash counting/shift closure, independent handover
review, previous-day closure and opening today. Finance shows the actual counts
of shifts needing cash counts and closed handovers awaiting review, with the
responsible roles. An accountant can coordinate and close a day, but cannot review
handovers. Cashier and overview financial controls require fresh setup data;
loading or failed refreshes cannot enable actions against a stale shift.

Accounting starts with everyday tasks: record a running expense, pay a supplier,
collect a customer balance, check profit, compare a bank statement and close
the trading day. Technical checks remain available in the navigation and a
collapsed investigation section. Every accounting page includes optional
**What do I do on this page?** help. The cash/day-closing page links to accounting
instead of offering unavailable immediate-payment/journal tabs when linked
accounting is active. Legacy mode keeps its existing operational controls.

## Supplier payments and safe corrections

**Money we owe suppliers → Record supplier payment** records an actual payment
immediately under the current user's finance authority; there is no separate
approval step. For approval before payment, use **Payment history → Prepare
payment for independent approval**, submit the draft, obtain a different eligible
reviewer's approval and then record the actual payment. Never use both workflows
for the same payment. Neither action initiates an external bank transfer.

An unpaid draft, submitted or approved supplier request can be cancelled with
evidence through **Correct this unpaid request**. Reopen its cancelled entry in
Payment history to prepare a linked replacement using the original allocations.
Review the date and current bill balances; the replacement requires fresh
independent approval. Paid requests require the existing reviewed reversal,
not cancellation or editing.

For incorrect recorded due dates, open customer **Aging** or supplier **Aged
payables**, review the source and choose **Correct due date**. Enter the corrected
due date, correction effective date and evidence, then prepare the request.
In **Due-date corrections**, submit, obtain independent approval and post.
Original bill/invoice terms remain immutable; dated reports use posted amendments
from their effective dates. Amendments do not post money, alter balances or change
earlier report dates. Stale requests must be cancelled and recreated from current
terms. These workflows reuse the existing accounting document and audit tables.

Accounting failures retain their error codes and show specific recovery links
where available. Supplier control mismatches lead to existing credits/advances,
cash-shift failures to Cashier & shift, and financial-day blockers to Finance.
Do not force a balance by recording a duplicate payment or fictional liability.

## Recover an unpaid counter invoice

Counter invoices do not reserve medicine stock. The cashier must not collect
money against an old total after prices change or release unavailable goods.
Return the code to its attendant or a pharmacy manager for guided basket review.
The recovery workflow shows current prices/stock and retains unavailable lines
for an explicit quantity change or removal. It preserves the customer, linked
patient and retail/wholesale basis.

The original invoice stays unpaid until its authorized attendant/manager
explicitly confirms cancellation and basket recovery. Review the recovered
basket before issuing a new code. Cashier-only staff see handoff guidance rather
than cancellation authority. Recovery retries retain their operation key;
refreshing or losing a response must not create another replacement invoice or
collect a second payment. Stock and prices are still checked when payment posts.

## Request, approve and receive a purchase

1. In **Buy & manage stock → Inventory & purchasing**, choose
   **Submit purchase request**. Select the supplier, medicines, quantities in
   base units, quoted unit costs and the reason.
2. Open **Purchase requests** (`/pharmacy/inventory/purchase-requests`).
   A manager other than the requester reviews the supplier quotation.
   Storekeepers can inspect requests and add alternative supplier quotations,
   but cannot make the manager's approval decision.
3. Approval creates one purchase order; rejection creates none. The review
   sends the current `expectedVersion`, selected `quoteIndex`, decision reason
   and the shared document helper's retry/idempotency key. A pending operation
   must be confirmed before a new review is started.
4. Choose **Open approved order & receive delivery** to open that exact order in
   Inventory & purchasing. Receive only the delivered quantity against its
   original order line, with batch/expiry evidence where required.
5. Review the supplier bill/evidence and any payment in Pharmacy Accounting.
   Requesting or approving a purchase does not add stock or pay the supplier.
   Do not record the same delivery again as a running expense.

The request list explicitly shows the latest 200 branch requests, matching the
existing API bound. It is not presented as an unlimited historical register.
Unverified supplier names or failed/malformed retrievals do not permit a new
approval. The existing independent-manager, branch, version and retry rules
remain authoritative on the backend.

## Reopen a mistaken close

In **Pharmacy → Cash & day closing → Cash & Financial Days**, a pharmacy manager or administrator can select **Reopen a closed day**, choose today's or a previous closed date, and enter a reason of at least ten characters. Reopening preserves the previous closer, close time and financial-day events. Each subsequent close records a journal-balance snapshot. Existing closed shifts, handovers, receipts and payments are retained.

Reopening today's day permits normal operations after opening a new cashier shift. Reopening an older day permits correction journals explicitly dated to that day. It does not backdate new sales or reopen old cashier shifts. Choose the historical financial date in **Journals**, post the reviewed balanced correction, and close that date again. Later days remain intact. Future dates are rejected; reopening retries do not duplicate audit events.

## Retail and wholesale prices

Maintain both prices per base selling unit when creating or managing a medicine. At POS choose the default price for newly added medicines, or choose Retail/Wholesale on each basket line. The server loads the selected configured price; submitted prices cannot override it. A missing wholesale price blocks wholesale selling rather than becoming a zero-price sale.

Held sales and receipts retain the selected price basis. Checkout retries must match the original request, including its price choices. Expected totals detect price changes before payment. Refunds use the prices and costs captured by the original receipt.

## Analytics

**Pharmacy → Analytics & Reports** provides overview trends, sales and margins, stock/replenishment, batch expiry, purchase-order fulfilment, supplier performance, and stock movements. **Pharmacy → Accounting** provides account activity, profit and loss, balance sheet, cash flow, trial balance, and journal transactions. Accounting statements are no longer offered through the pharmacy analytics UI or operational analytics API. Both workspaces use date/search filters, pagination where supported, and CSV/PDF export. Reports run in a repeatable-read transaction, so their totals and rows share a database snapshot.

Every authorized Pharmacy Accounting page displays **Financial reports** links for
**Profit & loss (Income statement)**, **Cash flow**, **Balance sheet**, and **Trial balance**.
The first three also appear individually in the accounting sidebar and open
`/pharmacy/accounting/statements?report=profit_loss`, `?report=cash_flow`, or
`?report=balance_sheet`. Journal transactions remain available on the statements page.
The active link identifies the displayed report; changing reports retains applied date
filters in the current statements workspace. Viewing a report never posts accounting entries.
Statements use one continuous table for account lines, section headings, available
server-supplied subtotals and final totals, matching the facility statement layout.
Currency values are right-aligned; account numbers are not formatted as amounts.
Balance sheet, cash flow and trial balance do not display the profit-and-stock summary.

Sales and refunds use their respective event dates. Cost reversals apply only to goods restored to stock. Book profit includes correction journals; receipt-based net sales can therefore differ from book revenue. Stock valuation and expiry are current snapshots, independent of historical date filters. Reorder quantities and days of cover use dispensable stock, excluding expired or untraceable tracked stock. Supplier fill rate averages line fulfilment percentages, avoiding quantity weighting across different medicines.

Managers/accountants can access financial reports. Storekeepers can access stock, expiry, purchasing and movement reports without receiving sales/profit summary fields. CSV exports include the full filtered report and escape cells that could be interpreted as spreadsheet formulas.

## Shared GL posting and reconciliation

The versioned `20261102_pharmacy_accounting` migration adds the pharmacy accounting
workflow schema and permits `pharmacy` as a shared GL source. Normal startup also
ensures the new pharmacy workflow tables. No migration or backfill is executed by
the coding task itself.

GL synchronization is **not enabled automatically**. An authorized administrator
must configure actual shared-account mappings and an effective date in Accounting
Settings. Do not copy illustrative account codes or allocate equity merely to make
a balance sheet balance. Existing moving weighted-average stock costing remains
unchanged.

When enabled, a source journal, its mapped shared GL lines, the legacy finance
ledger lines and the source-to-GL link commit or roll back together. Missing,
inactive, wrong-type or foreign-branch account references reject the transaction.
A closed shared accounting period rejects posting even if the pharmacy's
operational financial day has been reopened. Legacy directly posted manual
journals, unapproved paid-expense entries and unallocated immediate supplier
payments are rejected while mapped posting is enabled; use the accounting
lifecycle and bill-allocated settlement workflows instead.

Historical local journals are not replayed automatically:

- `GET /api/v1/pharmacy/accounting/consolidation` lists unlinked sources.
- `GET /api/v1/pharmacy/accounting/consolidation/reconciliation?from=YYYY-MM-DD&to=YYYY-MM-DD`
  compares each source/account's debit and credit with its linked shared posting.
- `POST /api/v1/pharmacy/accounting/consolidation` requires manager/administrator
  access, reviewed `from`/`to`, `confirmed: true`, a `reason` and `idempotencyKey`.
  It changes the shared books and must only be invoked after financial review.
  Closed periods are not reopened by the endpoint. A bounded batch is atomic;
  existing links are not posted again, and the action records audit evidence.
  Supply the reviewed `journalIds` (API maximum 2,000) for a busy date/range.
  The workspace loads 100 unlinked sources per review batch, ordered by exact ID;
  reload and separately confirm remaining batches.
  Reconciliation scans the entire range in 100-journal keyset batches, rather
  than rejecting a single date over 10,000 source lines. Its global
  `linkedMismatchCount`, `unlinkedShared` and `fullyChecked` describe the full
  inspection; displayed source/mismatch/orphan samples remain explicitly bounded.
  `rowsTruncated` and `orphanSharedEntriesTruncated` describe sample visibility,
  not a silently incomplete integrity check. The POST repeats the full-range
  integrity preflight and rejects existing linked differences/orphans even if
  they fall outside the displayed source batch.

Shared organization reports count shared entries once. Never add pharmacy source
journal totals to those consolidated totals.

The dedicated `GET /api/v1/pharmacy/accounting/ledger` register supports account,
date, search and pagination filters. Running balances retain prior history even
when a search or page hides preceding transactions. The `/ledger/export` and
`/reports/export` endpoints produce real Excel workbooks with identical financial
scope; exports over 10,000 rows are explicitly rejected rather than truncated.
Use printable accounting layouts for PDF output.

The trial balance displays net debit/credit balances, not lifetime movements.
Cash flow excludes internal cash/bank transfers from inflow/outflow totals and
classifies supported transactions. Ambiguous compound or unknown accounts are
returned as `classificationIssues`; these must not be presented as a fully
classified statement. Departmental opening balances and shared allocations remain
subject to explicit financial policy.

## Operational accounting and tax

The on-screen ledger shows concise, kind-aware references such as `JRN-266A7E7D`
and `PHM-F262EB76`, date-only financial dates and formatted monetary amounts.
Full references remain available through keyboard-focusable reference tooltips
and exact-ID journal links. Internal row/branch IDs and duplicate signed balances
are not visible ledger columns. Searching accepts the displayed reference or the
full journal/original document ID. Stored identities and CSV/Excel/PDF audit
identifiers are never shortened.

Accounting follows the established Payroll / Lab Accounting PLS presentation: compact
filter/action toolbars, shared currency formatting, standard summary metrics,
PrimeTable registers and progressive document review. Forms remain in unboxed
page sections, never inside cards or table panels. Supplier statements use a
searchable supplier-name selector while retaining exact IDs in requests.

The dedicated accounting pages use branch-scoped accounts, journal/expense
lifecycles, invoice/bill registers, statements and actual bank matching.
See the [operational API contracts](../src/models/pharmacy/accounting/README.md)
for approvals, allocations, evidence uploads, expense refunds, corrections and
their exact request/version requirements.

Activation validates the existing shared canonical AR/AP, inventory/COGS and
cash/bank controls; it does not invent or automatically select account mappings.
Custom expense, revenue and tax liability accounts remain explicitly assignable.
Once linked history exists, cutover and historical mappings are protected.

Selling prices remain tax-inclusive: no tax rate or jurisdiction is inferred.
Approved manager/admin medicine rules use an explicit rate, mapped liability,
effective date and reason. Sale-line gross/net/tax/rate/account snapshots are
frozen in the sale transaction. Revenue and stored margins exclude output tax;
refunds reverse the original snapshot, never today's rate. The tax register
supports date filters and rejects ranges over 10,000 rows instead of truncating.
Rate changes cannot be backdated. Exclusive-price repricing and tax filing are
not implied by this configuration.

Taxed invoice credit notes require the explicitly selected
`original_gross_proportional_v1` policy. Original-gross weighted, integer
allocations and cumulative residual limits preserve original net/tax exactly;
approved reversals copy the original amounts. Write-offs do not silently claim
VAT relief. Operational NHIS claims remain a manually evidenced register, not
automatic external submission or duplicate revenue recognition.

`GET /api/v1/pharmacy/accounting/inventory/reconciliation` compares current
moving-average on-hand valuation with the inventory control. Quarantine, transit
and pending supplier-return balances remain separately identified. A difference
requires investigation and an approved adjustment; no balancing entry is
fabricated. Historical dates do not masquerade as historical physical snapshots.

Finalized bank statements reject later postings dated on or before their closing
date. Correct after that date through the source workflow. Shared-only pharmacy
reversals are blocked so local books, party allocations and shared books cannot
be unwound independently. Consolidation checks both missing local links and
extra shared pharmacy entries without a local link.

Voided AP/AR reversal intents can be explicitly replaced with the latest voided
version, reason and date. Original/predecessor lineage is retained, fresh
independent approval is required, and the database permits only one active or
posted reversal per original.

Original legacy supplier payments and credited supplier returns can be registered
as immutable allocation sources. Reviewed applications and exact signed releases
attribute them to selected bills without another cash/AP posting. Source capacity,
bill outstanding, supplier/branch identity, approval and effective dates are
checked. Local aging uses the dated allocation evidence; consolidated AP aging
projects the same signed evidence onto the original bill references while
retaining the GL control total. Unreviewed pharmacy credits stay visible as
negative unapplied rows, never guessed FIFO settlements. Shared statements retain
the original actual financial movements. See the
[workflow API contracts](../src/models/pharmacy/accounting/README.md).

Legacy original payments/credited returns currently have no financial cancellation
endpoint. They remain immutable. A future source-correction path must atomically
retire its allocation source before correction and reject unreleased allocations
or pending reviews; the retirement helper alone is not a correction workflow.

## Deployment

### Accounting presentation

Accounting uses the existing pharmacy feature sidebar, not a second 19-link
navigation bar. Its overview groups tasks by transactions, reports and controls.
Page headers and primary actions follow the Payroll task hierarchy; compact
filter placement follows laboratory worklists. Financial summaries reuse the
shared Billing summary component. Exports are secondary actions outside filter
forms; underlying source identifiers and financial workflows are unchanged.
Forms remain in unboxed sections, and statuses remain readable text.

The isolated browser harness in the sibling frontend verifies the real components
with synthetic transport. Passing those checks is not full authenticated
deployment certification or subjective owner approval.

Apply `20261024_pharmacy_price_types` or run the normal backend startup bootstrap before serving the updated POS. This adds `price_type` to sale and held-sale lines; existing lines default to retail. No historical financial day is reopened automatically.
