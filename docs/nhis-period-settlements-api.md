# NHIS service-period settlements (backend contract)

All paths below are under `/api/v1/accounting/nhis`. Tenant connection and active
branch come exclusively from the authenticated session. A mismatched query
`tenantId` is rejected. Body schemas are strict; client allocations/IDs/totals are
not accepted. Existing per-bill receipts, adjustments and reversals remain available.

## Preview and post

`POST /period-settlements/preview`:

```ts
type PreviewInput = {
  from: string; to: string; // inclusive YYYY-MM-DD, billing.billedon service cohort
  amount: string | number; // GHS, at most two decimal places; prefer decimal string
  date: string; // today's UTC date, not the historic service date
  remainingDisposition: 'pending' | 'appeal' | 'disputed' | 'final';
  adjustmentKind?: 'revenue_adjustment' | 'write_off';
};
type Preview = {
  from: string; to: string;
  billCount: number; eligibleOutstanding: number; received: number;
  remaining: number; adjusted: number; outstandingAfter: number;
  allocationMethod: 'proportional'; snapshotToken: string;
  excludedMixedBillCount: number; excludedMissingAccrualBillCount: number;
  allocationSample: Array<{
    billingId: number; reference: string; outstanding: number;
    received: number; remaining: number; // before optional noncash adjustment
  }>; // first <=20 eligible bills ordered by billing ID
};
```

`POST /period-settlements`:

```ts
type SettlementInput = PreviewInput & {
  requestKey: string; // /^[a-zA-Z0-9_-]{16,80}$/
  snapshotToken: string; // 64 lowercase hex characters from matching preview
  reference: string; // trimmed 1..120
  reason: string; // trimmed 1..1000
  paymentAccountCode?: 'acc-1000' | 'acc-1001';
  remainingReason?: string; // trimmed 1..1000
  adjustmentReference?: string; // trimmed 1..120; explicit approval reference
  adjustmentReason?: string; // trimmed 1..1000
};
type SettlementMetadata = Preview & {
  id: number; date: string;
  remainingDisposition: PreviewInput['remainingDisposition'];
  remainingReason: string | null;
  adjustmentKind: PreviewInput['adjustmentKind'] | null;
  adjustmentReference: string | null; adjustmentReason: string | null;
  reference: string; reason: string;
  paymentAccountCode: 'acc-1000' | 'acc-1001' | null; createdBy: number;
  state: 'applied' | 'partially_reversed' | 'reversed';
  reversalEventIds: number[];
  totalsBasis: 'at_posting_not_current_balance';
};
type EventHeader = {
  id: number; kind: 'receipt' | 'revenue_adjustment' | 'write_off' | 'reversal';
  reverses_kind: 'receipt' | 'revenue_adjustment' | 'write_off' | null;
  reversal_of_event_id: number | null; reference: string; reason: string;
  event_date: string; branchid: number; amount: number;
  payment_account_code: string | null; created_by: number;
  allocationCount: number; allocations: [];
  // DB headers also retain request_key and created_at. fingerprint is never exposed.
};
type SettlementResult = {
  receiptEvent: EventHeader | null;
  adjustmentEvent?: EventHeader;
  settlement: SettlementMetadata;
  alreadyApplied?: boolean;
};
```

Success envelope: `{status:'success',statusCode:200|201,result:...}`.
Preview is 200; posting/reversal is 201, including successful idempotent retries.
Errors: `{status:'error',statusCode,code,message}` (generic 500 has no internal detail).

### Validation and decisions

- Inclusive service dates must be valid and ordered; `to <= date`; a new operation
  posts today (UTC). Historic accounting periods are neither reopened nor finalized.
  Today's accounting period and financial day must be open.
- Positive cash requires a payment account and `accounting.journal.post` authority
  against the **whole received total**, not individual shares.
- `pending`, `appeal` and `disputed` retain all remaining AR. Appeal/disputed require
  `remainingReason`; nonfinal requests cannot include adjustment fields.
- `final` requires explicit `adjustmentKind`, `adjustmentReference` and
  `adjustmentReason`, and `accounting.journal.approve` against the **whole noncash
  remainder**. No automatic bad debt decision occurs.
- `amount:'0.00'` is allowed **only** for final adjustment. Omit the payment account:
  no receipt event/journal or journal.post check occurs; `receiptEvent:null`.
  `reference` and `reason` are still required as settlement audit metadata; the
  noncash event uses `adjustmentReference`/`adjustmentReason`.
- Fully received final cohorts create no zero-value noncash event. Empty/fully
  settled cohorts and cash exceeding eligible outstanding are rejected.
- Mixed/non-NHIS, voided/corrected/written-off and zero-balance bills are excluded.
  Missing accrual coverage is excluded and counted, not silently re-accrued.
  Coverage follows the existing billing outbox/journal accrual-or-adjustment contract.
  Negative balances and invalid tax on a revenue adjustment require reconciliation.
- Snapshot is a stable hash of tenant/branch, preview intent and ordered eligible
  bill balances, service dates, payable/tax and accrual eligibility. It has no expiry.
  Amount strings/numbers normalize to pesewas. A changed cohort returns
  `409 NHIS_SNAPSHOT_STALE`, even if the changed total cannot cover the receipt.
- Successful retries are looked up **before** cohort/current-day revalidation.
  Request fingerprints bind actor, branch, all intent and metadata; a changed
  intent under the same key returns `409 NHIS_REQUEST_CONFLICT`.
- Existing external reference uniqueness remains `(branchid, kind, reference)`.
  A conflicting receipt or noncash approval reference returns
  `409 NHIS_REFERENCE_CONFLICT` and rolls back the entire new settlement.

## Allocation audit and reversal

`GET /events` retains its existing report envelope. Each row now also has:

```ts
{
  allocationCount: number;
  allocations: Array<{id:number,event_id:number,billingid:number,amount:number|string,tax_amount:number|string}>;
  allocationsTruncated: boolean;
  periodSettlement: SettlementMetadata | null;
}
```

Period events (including their reversals) return `allocations:[]`. Other events
return at most 20 allocations. Do not mount all allocations from the activity list.

`GET /events/:id/allocations?page=1&count=25`:

```ts
{
  eventId: number; allocationCount: number; total: number;
  page: number; count: number;
  rows: Array<{id:number,event_id:number,billingid:number,amount:number,tax_amount:number}>;
}
```

`page` is a positive integer up to 1,000,000; `count` is 1..100; bill-ID ordering is
deterministic. Other-branch/nonexistent events return 404. Reversal allocations
are negative. Amounts in this paginated response are numbers in GHS.

`POST /period-settlements/:id/reversal`:

```ts
{requestKey:string,date:string,reference:string,reason:string}
```

Same key/reason/date validations; reference max **100** to accommodate event-ID
suffixes. A new reversal posts today and requires
`accounting.financial_correction.execute` against receipt + adjustment total.
Returns `SettlementResult & {reversalEvents: EventHeader[]}` (reversal headers also
include `periodSettlement`). Linked receipt and adjustment reverse atomically via
the existing append-only event/subledger/outbox mechanism. Individual reversal of
a paired event returns `409 NHIS_SETTLEMENT_REVERSAL_REQUIRED`. Single-event
settlements may still use the existing event reversal endpoint.

Repeated identical settlement reversals return `alreadyApplied:true`, including
later/closed-day retries. A different reversal key cannot reverse an event twice.
Metadata totals are the **original posting snapshot**, never a claim about today's
balances. Use `state` to distinguish applied/reversed; use receivables/preview for
current AR. Reversing a settlement restores its bill balances without changing
the immutable original settlement decision or invoice history.

## Calculation and persistence

GHS800,000 outstanding / GHS600,000 received yields GHS200,000 remaining.
Bills outstanding GHS300,000 and GHS500,000 receive GHS225,000 and GHS375,000.
`allocateMinor` uses integer pesewas and BigInt products, largest remainders and
bill-ID ties; zero allocations are omitted. No share exceeds its outstanding.
Explicit final adjustment allocates each bill's exact post-receipt remainder.
Revenue adjustments split gross/tax using the existing exact allocation helper.

MySQL preview/post explicitly use REPEATABLE READ, locking the entire branch
service-date bill range and batched live-service/allocation/coverage reads.
Posting also uses the existing accounting-period/financial-day locks. Bill reads
are not constrained by report pagination. Candidate detail queries use batches of
400, allocation inserts 100, subledger inserts 40 and independently balanced
outbox journal chunks of 40 bills (TEXT payload stays below 64KB). Stable outbox
source references are `eventId:batch:index` for multi-chunk events.

Receipt + optional adjustment + settlement metadata + allocations + subledger +
all outbox chunks commit in one transaction. Ledger delivery is asynchronous;
different chunks can be posted at different times. Existing outbox readiness and
financial-close controls remain responsible for detecting incomplete delivery.
No receipt/payment history or historic invoice is mutated.

## Deployment and verification

Apply `20261104_nhis_period_settlements.ts` through existing tenant migration
procedures, or run accounting bootstrap on each tenant database before using these
APIs. It adds `acc_nhis_period_settlements` with immutable MySQL update/delete
triggers and bill range index `idx_nhis_cohort_branch_date`. No tenant_id column,
historic re-accrual, destructive down migration or data rewrite is introduced.
Large production index creation should be scheduled appropriately.

Focused tests use real Knex/SQLite SQL, including 5,001 bills, exact pennies,
stale coverage/membership/balances, disposition metadata, rollback and reversal.
SQLite does not implement InnoDB next-key locking; live MySQL contention tests
were not run. Financial write atomicity does not mean asynchronous journal chunks
become visible atomically; monitor/retry outbox failures through existing tooling.
