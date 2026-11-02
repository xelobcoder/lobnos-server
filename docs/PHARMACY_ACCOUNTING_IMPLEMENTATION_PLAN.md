# Pharmacy Accounting Implementation Plan

## Status and governing decisions

**Implementation in progress.** The read-only audit and functional gap analysis
preceded financial changes. The user subsequently requested autonomous execution.
The shared GL foundation and moving weighted-average policy are retained;
actual account mappings and activation remain explicit administrative actions.
The previous report-split implementation is not acceptance of the full brief.

Goal: independent Pharmacy Accounting workflows on a reconcilable financial
foundation, not a second competing accounting engine and not nineteen dashboard
tabs. Existing real pharmacy sales, receipts, supplier credits, stock controls
and patient collections must keep working.

### Implemented foundation

The synchronous, same-transaction shared-GL bridge, immutable posting links,
explicit cutover/settings, approved journal/expense/AP/AR lifecycles, private
evidence, source reversals, tax snapshots/credits, scoped registers/statements
and bank/inventory/source reconciliation are implemented. The integrated backend
selection now passes 446 tests across 34 files and TypeScript. Reviewed replacement
of voided reversal intents, legacy AP allocation/releases, dated shared AP
attribution and full-range bounded cutover review are included. See the
[current acceptance evidence](PHARMACY_ACCOUNTING_TEST_RESULTS.md) and
[operational contracts](../src/models/pharmacy/accounting/README.md).

This is not live cutover certification. Production account assignments, opening
balance/source completeness, unallocated historical transactions, actual tax
rules and MySQL locking need explicit deployment review. No live migration or
historical posting has been executed. Final frontend refinements retain full
audit identifiers in underlying records and exports; concise UI references must
not become replacement database identities.

Audit-time policy and coordination gates, retained for traceability:

1. The shared `acc_*` engine is the authoritative organization ledger. Chosen:
   pharmacy operational journals remain immutable source/subledger evidence,
   linked one-to-one to attributed shared postings; never sum both as revenue.
2. The facility's actual account mappings, departmental assignments and handling
   of opening balances/shared assets/liabilities/equity require finance approval.
   No illustrative account-code seed or balancing equity plug.
3. Retain the current moving weighted-average inventory policy unless an approved
   migration explicitly changes it. Physical batch/expiry issue order is separate
   from financial costing; do not silently switch to FIFO.
4. Approve tax rules, exempt products, inclusive/exclusive pricing, effective
   dates and rounding. Do not infer jurisdictional tax treatment or invent rates.
5. Define organization period lock versus pharmacy day/shift close, permitted
   corrections, independent approvers, and the legacy module-configuration policy.
6. Confirm ownership of concurrent changes in pharmacy management/payment/report
   files before editing overlapping sections. Do not revert them.

No live migration/backfill is authorized by this plan. Versioned migration code
and dry-run tooling may be implemented after the design is approved; execution
against live data remains a separate decision.

## Target flow and data contracts

```text
Authorized pharmacy transaction
  -> tenant + branch + pharmacy entitlement + action permission
  -> domain document/state validation
  -> ONE database transaction
       -> period/day locks
       -> inventory/payment/AR/AP changes
       -> immutable source identity and account mapping
       -> existing shared AccountingService posting
       -> posting link + audit evidence
  -> pharmacy registers / statements / reconciliation
  -> authorized consolidated reports (shared entries counted once)
```

Final synchronization design must accommodate existing posting retries and
closed historical periods. Do not silently turn a failed shared posting into
success. If an outbox is chosen instead of synchronous posting, the source must
explicitly expose pending/failed financial status and block finalization until
reconciled; that is a material alternative requiring approval.

Required schema/API invariants:

- Tenant context comes from the authenticated request; connections remain
  tenant-specific. Branch, department/business unit, source module, stable
  document identity and actor are persisted, not inferred from account names.
- Origin module is distinct from department. A manual pharmacy journal remains
  identifiable as manual-origin and pharmacy-attributed.
- UUID source documents need a stable identity; inspect existing `sourceRef`
  support rather than casting UUIDs into numeric `sourcePk`.
- Account assignments are explicit, versioned and validated against active
  shared accounts. Customer/supplier dimensions must survive control-account
  mapping; one GL control account does not eliminate the party subledger.
- Unique source/posting links enforce one-time posting under concurrent retries.
  Changed retry payloads are rejected. Reversals link the original and retain
  attribution and effective accounting date.
- Mandatory department scope is passed through every pharmacy service,
  statement, export, count, match suggestion and drill-down. UI query parameters
  cannot broaden it. Consolidated access is a separate authorized operation.
- Posted records are immutable; account deletion with financial history is
  prohibited. Correct through audited reversals/adjustments, not record editing.

## Ordered tasks

| Task | Priority / prerequisites | Work and affected surfaces | Completion gate |
|---|---|---|---|
| T0 | Audit; completed for this phase | Critical audit, A01-A19/X01-X03 gap analysis, existing test baseline. | Evidence and limitations published; no financial changes. |
| T1 | P0; T0 and policy decisions | Define posting matrix, account mappings, attribution/period/access contracts and cutover manifest. Review `AccountingService`, source enum/DTOs/schema, pharmacy ledger/context, authority and entitlement middleware. | Approved policies plus isolated mapping and denial test cases; no invented equity/tax. |
| T2 | P1; T1 | Extend existing engine/schema with department assignments and stable posting links; scoped account/GL/journal/audit APIs; use existing journal lifecycle with atomic transitions. Wire pharmacy events without losing local evidence. | Balanced atomic posting, retries, reversals, close races, immutable history and scoped query tests pass. |
| T3 | P2; T2 | Complete patient/organization/insurer AR, AP bills/due dates/allocations/approvals, categorized accrued/paid expenses and attachment handling, inventory/COGS, bank statement matching and tax contract. Reuse pharmacy settlement/management/enterprise workflows and shared subledger/bank services after scoping. | Real document/state transitions and party control reconciliations; no duplicate receipt/invoice recognition. |
| T4 | P3; T2/T3 | Implement net trial balance, formal income statement, approved departmental balance sheet, classified cash flow where supported, aging and stock-control reconciliation. Replace independent summary calculations with common verified queries. | V09/V10/V15 and opening/movement/closing identities pass; unsupported allocation remains explicitly blocked. |
| T5 | P0 cutover gate; T2/T3/T4 | Versioned schema upgrades and dry-run historical source inventory, mapping exceptions, source links, account/day/party reconciliation. Treat legacy versions/opening balances/previous reversals explicitly. | No unexplained difference or duplicate source; rerun produces zero extra postings; finance approval before live execution. |
| T6 | P4; scoped contracts from T2-T4 | Dedicated nested accounting pages, shared table/form/statement components, real navigation and permission-aware actions. Integrate existing pharmacy finance/accounts workflows without breaking old URLs. | Each exposed destination has working authorized APIs and tests; no placeholder buttons/pages. |
| T7 | P5 / release; T5/T6 | Overview summaries and separate operational analytics; final tests, docs and release review. | All acceptance scenarios verified, no unexplained reconciliation or access failure. |

T6 can proceed per completed API slice, but cannot turn unimplemented T3/T4
requirements into menu-only features. Historical cutover verification is a release
prerequisite, not a cosmetic follow-up.

## Interface shape

Retain `/api/v1/pharmacy/...` as the entitlement boundary. Proposed nested
resources under `/api/v1/pharmacy/accounting` cover accounts/assignments,
ledger, journals and lifecycle actions, receivables, payables, expenses,
bank accounts/reconciliations, periods, audit, settings and reports.
Controllers must delegate to scoped existing services where correct.

The front end should use nested `/pharmacy/accounting/...` destinations for all
A01-A19 requirements. General Ledger and trial balance are tables; journals and
expenses have forms/state actions; AR/AP use invoice/bill registers with party
statements and allocations; reconciliation is a statement-matching workspace.
Financial statements use formal printable layouts. PDF/Excel exports must
preserve the same scope, filters, totals and authorization as their registers.
Charts belong only in the overview and separate Pharmacy Analytics.

## Reuse decisions and trade-offs

- Reuse `AccountingService`, account catalogue, period guard, manual-journal
  lifecycle, subledger and bank matching. Do not copy their unscoped queries or
  expose facility-wide controllers directly to pharmacy roles.
- Prefer one authoritative posting with an immutable source link over a new
  pharmacy accounting engine. Retaining local journals as evidence costs
  reconciliation work but preserves existing transaction history.
- Synchronous consolidation simplifies atomicity but couples operational posting
  to shared period/account readiness. An outbox improves decoupling but creates
  a pending-posting lifecycle that must be visible and close-blocking.
- Audit shared integration adapters before reuse: existing expense category
  heuristics and inventory VAT defaults are not approved pharmacy accounting
  policies.

Revisit synchronization and report indexing if measured transaction volume
requires it; do not add queues, caching or new infrastructure solely for this
brief. Correctness and financial traceability precede visualization.

## Verification and release policy

Track all A/X requirements against V01-V15 in the
[test results](PHARMACY_ACCOUNTING_TEST_RESULTS.md).
Use existing Vitest and front-end runners. Add real-SQL isolated fixtures for
report math and MySQL-specific migration/locking coverage before release.
No production patient/financial data is needed for automated fixtures.

Rollback must disable new posting at a controlled boundary without deleting
posted entries or replaying already linked sources. Resolve any committed
financial correction through authorized reversal. Preserve a cutover manifest,
exception report, approvals, and before/after reconciliation evidence.
