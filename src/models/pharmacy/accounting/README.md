# Pharmacy accounting operational API

The router is mounted at `/pharmacy/accounting` after pharmacy access and applies
its own finance gate. Tenant, branch and actor are authentication-derived.
JSON responses are `{success:true,data}`; domain failures include a code/message.
Mutations require `idempotencyKey`; document actions also require `expectedVersion`.
Money accepts exact decimal strings or cent-exact numbers and is normally returned
as two-decimal strings. No endpoint runs schema changes or historical backfills.

## Core-control restriction

The current shared specialized reports require canonical core controls. Enabled
settings therefore require explicit mappings to:

| Local category (and applicable exact overrides) | Shared code |
|---|---|
| receivable, receivable:* | acc-1002 |
| payable, supplier_payable, payable:* | acc-2000 |
| inventory | acc-1003 |
| cost_of_sales | acc-5000 |
| cash / cash collection:* | acc-1000 |
| bank, mobile_money / corresponding collection:* | acc-1001 |

These are validated, **not automatically supplied**. An active but incompatible
core mapping returns `422 CANONICAL_CONTROL_REQUIRED`. Disabled draft settings
may be incomplete, but cannot activate with incompatible controls. Custom core
accounts require a reviewed persisted report-classification migration first.
Custom revenue, operating expense and typed tax/liability accounts remain
supported. Plain `sales_returns` and `sales_discounts` aliases are OPTIONAL revenue
mappings, not mandatory activation mappings. `revenue:credits` also remains valid.
Once shared posting links exist, existing mappings/cutover cannot be
removed, changed or disabled. Adding an exact override for a historically used
local account is also blocked.

## Additional operational endpoints

- `POST /payables/bills`:
  `{idempotencyKey,receiptId,dueDate?,reference?}` registers an existing **posted**
  receipt liability without posting inventory or payable twice. GET returns bill
  aging as of `?asOf=YYYY-MM-DD`. Approved expenses automatically register bills.
- `PUT /payables/bills/:id/due-date`: `{idempotencyKey,dueDate,reason}` fills an
  unknown due date once; existing terms cannot be silently rewritten.
- `POST /payables/settlements`:
  `{idempotencyKey,date,description,allocations:[{billId,amount}]}`. All bills must
  be in the branch and belong to one supplier. Expense bills use expense payment,
  not this workflow. GET list/detail are supported.
- `POST /payables/settlements/:id/:action`: submit, approve, pay, void. Pay adds
  `{method,reference?}` and settles the approved allocations atomically. Partial
  bill payment is a settlement for part of its open amount; further payments are
  new approved settlements.
- `PUT /receivables/:saleId/due-date`: `{idempotencyKey,dueDate,reason}`.
- `POST /receivables/adjustments`:
  `{idempotencyKey,saleId,date,kind:"credit"|"writeoff",amount,account,reason}`.
  Credits debit a mapped revenue contra-account; writeoffs debit a mapped expense.
  `POST /receivables/adjustments/:id/:action`: submit, approve, post, void.
  Corrections reduce outstanding, **not** actual cash paid. Gross-only credits
  against taxed invoices require explicit
  `taxPolicy:"original_gross_proportional_v1"` (see below).
- `GET /receivables/aging` and `/payables/aging`: `?asOf=YYYY-MM-DD`.
  Data: `{asOf,items,buckets,total,reconciliation,note}`. Buckets are current,
  days_1_30, days_31_60, days_61_90, days_91_plus, unknown_due_date.
  Unknown due dates are not invented. Unregistered AP sources, legacy unallocated
  payments/credits, and unattributed AR journals remain explicit reconciliation
  differences, not fabricated invoice allocations. Historical balances use
  financial journal/allocation dates, not today's mutable outstanding columns.
- `POST /evidence/uploads`:
  `{idempotencyKey,filename,mimeType,contentBase64}` creates a private immutable
  authorized upload object. PDF/PNG/JPEG signature and extension must match;
  limit 5 MiB. No paths/URLs. Returns `{id,filename,mimeType,byteLength,sha256,
  malwareScan:"not_performed"}`. This does not claim antivirus scanning.
- `GET/POST /expenses/:id/attachments`: POST `{idempotencyKey,uploadId}`.
  Only the uploader may initially bind their same-branch object. No object reuse
  across expense documents; no destructive attachment endpoint.
- `GET /expenses/:id/attachments/:attachmentId/content` rechecks branch/document
  authorization and forces attachment download, nosniff, private/no-store.
- `GET/POST /expenses/:id/refunds`: POST
  `{idempotencyKey,paymentId,date,amount,reason}` for an actual original payment
  of a fully settled expense. GET returns `{items}`.
- `GET /expense-refunds/:id`; `POST /expense-refunds/:id/:action`:
  submit, approve, receive, void. Receive adds `{reference?}`. An independent
  approver is required; receipt returns money only to the original destination.
  Partial refunds are bounded by the original payment minus previous receipts.
  Original payments/expense amounts remain immutable; refunded/net-paid totals
  and new journals record the correction. Cash refunds require a current shift;
  negative settlement-reversal evidence makes existing shift totals add cash back.

## Reviewed reversals

- `POST /payables/settlements/:id/reversals` and
  `POST /receivables/adjustments/:id/reversals`:
  `{idempotencyKey,date,reason}`. Returns
  `{id,originalDocumentId,replacesIntentId:null,status:"draft",version:1,amount}`.
- GET list/detail and POST `/:id/:action` are under
  `/payables/settlement-reversals` and `/receivables/adjustment-reversals`.
  Actions: submit, approve, post, void. Each requires `idempotencyKey` and
  `expectedVersion`; void also needs a reason. Creator and submitter cannot
  approve. Financial amount/date/accounts/allocations cannot be changed in actions.
- AP post additionally requires `confirmedReceived:true` and a new external
  `reference` for non-cash funds. This attests that payment funds were actually
  returned/cancelled, rather than inventing a bank receipt from a reversal click.
  The original collection destination is used, not today's method route. Cash
  requires an open posting-date shift.
- Original AP settlement header, payment journal and positive allocation rows
  stay unchanged. New `pharmacy_accounting_allocations` rows have exact negative
  amounts, the new correction `financial_date`,
  `reversal_of_allocation_id` (unique) and `original_financial_date`. Historical
  aging before the reversal continues to show the original payment. New negative
  supplier-payment evidence restores existing cash-shift handover totals.
- AR post restores original gross outstanding without changing actual cash paid.
  It swaps the EXACT original local journal debits/credits (including tax and
  original invoice documentRef), and posts new signed tax reversal evidence.
  Only original adjustment lifecycle metadata becomes `reversed` (version + 1);
  original amounts/journal lines/tax rows remain immutable. This lets the parent
  whole-sale refund guard distinguish inactive adjustments.
- **Voided intent replacement:** POST
  `/payables/settlement-reversals/:voidedId/replacements` or
  `/receivables/adjustment-reversals/:voidedId/replacements` with
  `{idempotencyKey,expectedVersion,date,reason}`. Version belongs to the **voided
  predecessor**, not the original payment/adjustment. Response:
  `{id,originalDocumentId,replacesIntentId,status:"draft",version:1,amount}`.
  Submit and obtain fresh independent approval before posting. No approval is
  inherited. To replace again after another void, name the latest voided intent.
  A normal create call cannot bypass this explicit lineage.
- `documents.reversal_of` is a permanent historical source link. Generated
  `active_reversal_of = CASE WHEN status <> 'voided' THEN reversal_of ELSE NULL END`
  has a unique DB index, retaining one active OR posted identity per original,
  including manual/expense journal reversals. `replaces_intent_id` is also unique.
  Schema upgrade installs this protection **before** removing the old unconditional
  `reversal_of` unique index. No posted evidence or historical links are deleted.
  Posting/retries/replacements are atomic, audited and version-checked.
- New bill settlements/invoice corrections cannot be backdated before later
  allocation/correction/reversal evidence to spend restored balances twice in a
  historical period. Shared period/day and finalized-bank locks still apply.

## Reviewed allocation of already-posted supplier payments/credit notes

These are **attribution-only** operations. Neither application nor release emits
a new journal, changes an original payment/credit note, nor recognizes cash, AP,
inventory or expense again. Do not use the settlement `pay` action for this.
Dates are explicit; no inference or automatic historical backfill occurs.

### UI/API contract (paths relative to `/pharmacy/accounting`)

All data below is wrapped in `{success:true,data:...}`. POST creates return HTTP
201; actions/read return 200. Money below is a two-decimal string.

1. `GET /payables/allocation-sources/candidates?sourceKind=payment|credit_note`
   accepts optional `supplierId`, `limit` (1-100, default 50), `offset` (0-100000).
   Data: `{items:[{sourceKind,sourceRef,supplierId,amount,financialDate,journalId}],
   limit,offset,scanned,nextOffset}`. Pagination advances by **scanned** rows:
   ineligible/already registered rows are filtered, so an empty page is not
   necessarily the last page. Candidate discovery verifies original source,
   supplier, destination, terminal credit status and balanced journal evidence.
2. `POST /payables/allocation-sources`:
   `{idempotencyKey,sourceKind:"payment"|"credit_note",sourceRef}`.
   Data: `{id,sourceKind,sourceRef,supplierId,amount,allocatedAmount:"0.00",
   availableAmount:amount,financialDate,status:"available"}`.
   `GET /payables/allocation-sources` accepts the same optional supplier/kind/page
   filters; data `{items,limit,offset}`. Item fields are the POST fields plus
   `journalId` and `unappliedAmount` (original amount minus signed applications).
   Retired source `availableAmount` is zero, even when unappliedAmount is positive.
3. `POST /payables/allocations`:
   `{idempotencyKey,sourceId,date,reason,allocations:[{billId,amount}]}`.
   Select 1-100 distinct registered receipt OR approved expense bills, all from
   the original supplier and authenticated branch. Data:
   `{id,sourceId,status:"draft",version:1,amount}`.
4. `GET /payables/allocations` supports `status,limit,offset` (existing document
   pagination: max 200). Data `{items,limit,offset}`. Each document includes
   `kind:"supplier_allocate"`, `status,version,financial_date,amount,description`,
   `details:{sourceId,sourceHash,supplierId,allocations:[{billId,documentRef,amount}]}`.
   `GET /payables/allocations/:id` adds `audit,payments:[],journals:[],reversals`
   and `sourceUses` (at most 100 exact posted rows, empty before post). Use rows
   include `id,source_id,document_id,bill_id,allocation_id,financial_date,amount,
   reversal_of_use_id,created_by,created_at`; amount is signed, two-decimal.
5. `POST /payables/allocations/:id/:action(submit|approve|post|void)`:
   `{idempotencyKey,expectedVersion}`; void also requires `reason`.
   Data `{id,sourceId,status,version,amount}`. Workflow:
   `draft -> submitted -> approved -> posted`; creator AND submitter cannot
   approve. Draft/submitted may be voided. Approved terms cannot be edited.
   Source hash, remaining source capacity and bill balances are checked again
   in the posting transaction. Retry returns the stored result; changed payload
   or actor on the same key returns `409 IDEMPOTENCY_CONFLICT`.
6. `POST /payables/allocations/:postedId/reversals`:
   `{idempotencyKey,date,reason}` creates a reviewed release of the EXACT original
   applications, not a financial refund. Data:
   `{id,originalDocumentId,replacesIntentId:null,status:"draft",version:1,amount}`.
   To replace a voided release intent, also pass
   `{replacesIntentId:<latest voided intent>,expectedVersion:<its version>}`.
   GET list/detail and POST actions are at `/payables/allocation-reversals`,
   `/payables/allocation-reversals/:id`, and
   `/payables/allocation-reversals/:id/:action(submit|approve|post|void)`.
   Same action bodies/results and fresh independent approval as above.
   Kind is `supplier_unallocate`; details contain original source/hash/use hash.
   Detail `sourceUses` contains the actual posted negative rows/lineage, not a
   client-side reconstruction of a refund.
   Posting adds exact negative evidence linked uniquely to the originals.
   The original application stays posted and immutable.

Applications cannot predate source/bill recognition or later applications/releases
for either source or bill. Releases cannot predate the original application or
later bill/source activity. Shared periods, pharmacy day and enabled cutover are
enforced. When enabled, original source AND target bill recognition must already
have shared posting links; otherwise explicit reviewed consolidation is required.
Bank-finalization does not prevent attribution-only operations: they move no cash.

Expense bills retain `details.paidAmount` as cash paid through their own payment
workflow; `externalAllocatedAmount` records these external source applications
separately. `outstandingAmount`, version and settlement status are updated
transactionally; further expense payments use the true remaining amount.
Reverse an expense only after releasing its external supplier applications.
Expense refund APIs reference actual managed payment IDs, not allocation IDs.

### Source guards and reporting integration

**Current producers have no exposed correction route for these immutable originals.**
`POST /pharmacy/management/supplier-payments` calls
`PharmacyManagement.disburse('supplier_payment', ...)` to create a new source
(and rejects this legacy creation path when accounting is enabled).
`POST /pharmacy/enterprise/supplier-returns/:id/credit` calls
`PharmacyEnterpriseManagement.creditNote(...)` for the terminal transition
`awaiting_credit -> credited`. Neither method reverses/cancels an existing
supplier payment or confirmed credit. There is therefore **no current producer
caller to wire** for source retirement. Shared-only pharmacy reversal is also
blocked by the parent. Do not call retirement from either creation method.

The exported helper below is a tested **future correction-path prerequisite**,
not an outstanding integration obligation for either current producer. If a
source-correction route is introduced, it must call
`retirePharmacySupplierAllocationSource(trx, {branch,actor,sourceKind,sourceRef,reason})`
inside its correction transaction **before** cancelling/reversing the original
payment/credit, preferably before taking original-source locks. Lock order is
settings -> registered source -> original producer evidence -> retirement key.
It rejects nonzero signed applications (`409 SOURCE_ALLOCATED`) and pending
draft/submitted/approved requests (`409 SOURCE_REVIEW_PENDING`). Release committed
applications and void pending requests first. Retirement/audit/tombstone roll back
if the producer correction fails. Even never-registered sources get an immutable
tombstone so a later registration cannot revive corrected cash/AP.
Any future source mutation route outside this folder remains parent-owned; this
helper does not create such a route or pretend one is already guarded.

- `pharmacy_accounting_supplier_sources`: `id` UUID PK; unique
  `(branchid,source_kind,source_ref)`; unique `journal_id`; supplier_id, source_hash,
  original amount/date, immutable evidence JSON text, registration actor/time;
  status `available|retired`, retirement metadata.
- `pharmacy_accounting_supplier_uses`: `id` UUID PK, branchid, source_id,
  document_id, bill_id, unique allocation_id, signed amount, financial_date,
  unique nullable reversal_of_use_id, actor/time.
- Each use links `pharmacy_accounting_allocations.id`; negatives also preserve
  unique reversal_of_allocation_id and original_financial_date. Each bill's
  `source_ref` identifies the original receipt/expense.
- `pharmacy_accounting_supplier_retirements`: composite PK
  `(branchid,source_kind,source_ref)`, created_by, reason, created_at.
- Local AP aging reads signed allocations by effective date. Example:
  bill 100.01, original payment 40.01, later reviewed allocation 40.01:
  before allocation bill balance 100.01/control 60.00/difference -40.01;
  on allocation date bill/control both 60.00. A later release restores bill
  100.01 and explicit -40.01 unallocated difference until source correction or
  reapplication. No new money/journal is invented to hide that difference.
- Consolidated **document-level** AP aging must consume these dated signed uses
  through source journal -> bill source_ref. Original GL document_ref is never
  overwritten. Aggregate supplier/control balances do not change on application.

## Frozen-snapshot tax credit policy

Taxed credit creation explicitly selects
`taxPolicy:"original_gross_proportional_v1"`; writeoffs reject tax-relief policies
and never reverse VAT. No new tax rate, taxable basis or input tax rule is guessed.

1. Read immutable original `pharmacy_tax_events(event_type='sale')`, validate
   gross = net + tax and compare original tax accounts with the posted sale
   liability. Any remaining original invoice gross is an untaxed residual bucket,
   with null rate/account (not an invented exemption rate).
2. Freeze the original snapshot hash and policy at draft creation. Re-read and
   validate them at posting; changed source evidence requires fresh review.
3. Allocate this credit's integer gross minor units by original gross weights,
   using deterministic largest remainder (snapshot ID order; untaxed last).
   Saturated components are capped at their remaining original gross; remaining
   amounts are redistributed by the same weighted largest-remainder policy.
4. Compute cumulative tax targets from each original gross/tax snapshot using
   integer HALF_UP arithmetic. Bound each increment by remaining original tax,
   net and gross capacity, net of exact earlier reversals. These cumulative
   residual bounds prevent excess relief and exhaust frozen tax/net exactly on
   a full credit, including repeated one-cent credits.
5. Post debit net to the selected revenue contra-account, debit credited tax to
   each ORIGINAL mapped tax liability account, credit gross to invoice AR.
   The rate displayed is the original frozen rate; current tax rules are unused.

`pharmacy_accounting_tax_adjustments` is append-only evidence:
`id`, `branchid`, `sale_id`, `credit_document_id`, `source_credit_id`,
`component_ref`, `tax_event_id`, `sale_line_id`, `event_type` (`credit|reversal`),
`policy`, `financial_date`, signed `gross_amount/net_amount/tax_amount`,
`original_gross_amount/original_net_amount/original_tax_amount`, nullable original
`rate/local_account`, `reversal_of_adjustment_id` (unique), actor and timestamp.
Original credit component rows are unique on `(credit_document_id,component_ref)`.
Reversals copy exact original gross/net/tax/rate/account with negative amounts;
no proportional recomputation or new rates are used for a reversal.

`GET /tax-credits? saleId=&sourceCreditId=&from=&to=&limit=&offset=` (omit spaces)
returns `{items,totals:{count,gross,net,tax},limit,offset,policy}`. Items expose the
above original account/rate and credit/reversal lineage fields. Totals include
signed reversals. Untaxed residual rows have null original tax account/rate.
Earlier active taxed credits without allocation evidence require explicit
historical reconciliation; this workflow does not silently backfill them.

## Integration obligations and limitations

- The parent-owned posting bridge supplies shared party/document attribution.
  AP allocations carry original receipt/expense documentRef on each payable line;
  AR adjustments carry original sale documentRef.
- Parent posting must lock/reject `collection:<id>` movements dated on or before
  any same-branch/account `pharmacy_accounting_statements.end_date` with
  `status='finalized'` (not only dates within the statement range).
- Legacy whole-sale refunds must reject invoices with posted AR adjustments until
  adjustment-aware refunds exist. Supplier payments must serialize supplier
  balance reads and do not silently allocate historical payments to bills.
- Shared periods remain organization-wide and read-only through this router.
- Base tax-rule management and historical due-date amendments remain separately
  controlled. Legacy supplier allocation is supported only through explicit
  authenticated source registration and independently reviewed applications.
  Tax credit policy here covers gross invoice reductions only, not selected-item
  returns, inventory restocking, cash refunds or writeoff VAT relief.
- Tests use isolated SQLite SQL and actual short-lived HTTP servers mounting only
  this router, with the shared bridge separately tested by its owner. Native MySQL
  generated identity/index DDL is compile-tested without connecting. Upgrade
  history, concurrent workflow operations and DB uniqueness are exercised against
  SQLite; actual MySQL DDL execution/lock semantics are not certified.
