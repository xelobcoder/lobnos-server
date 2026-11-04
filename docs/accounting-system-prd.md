# Accounting System PRD for Prime Laboratory Software (PLS) backend

## Purpose

Enable a complete accounting subsystem within Prime Laboratory Software (PLS) backend so financial operations from billing,
expenses, inventory, commissions, and supplier payments are recorded, reported, and auditable as a
true double-entry general ledger, not a flat single-entry log.

## Business objectives

- Provide a single source of truth for financial transactions.
- Improve financial reporting for laboratory operations (trial balance, income statement, balance sheet).
- Support auditing, compliance, and management review.
- Reduce manual reconciliation between billing, expenses, commissions, and supplier payments.
- Give every financial event a documented refund/adjustment/reversal path instead of ad-hoc fixes.

## Financial integrity corrections (2026-11-03)

- Year-end sweeps use actual debit/credit positions, including debit-normal contra-revenue
  and credit-normal contra-expense accounts. Calculation and posting share a transaction and
  the year's posting-period locks. This operation creates the closing journal; period status
  changes remain the separately authorized period workflow.
- New non-pharmacy shared journal dual-writes identify each legacy row by immutable journal
  line ID (`source_ref = acc-line:<id>`). Pharmacy retains its existing source/line identity.
  Producer retries do not rewrite or automatically backfill historical legacy evidence.
- Shared inventory valuation compares facility stock plus explicitly consolidated pharmacy
  branches against the same `acc-1003` population. Independent pharmacy books are excluded.
  Migrated physical items are counted once. Missing inventory posting links or mismatching
  local/shared pharmacy controls fail with `INVENTORY_POPULATION_INCOMPLETE` (409).
- Current stock is valued at persisted moving weighted-average cost, including inactive items
  still holding stock. Earlier `asOf` dates require a complete zero-opening movement snapshot
  chain with incoming base-unit total costs, consistent outflow costs, and reconciliation to
  persisted quantity/cost. Costs are replayed at facility precision (2 decimals) or pharmacy
  precision (6 decimals), with each item's value rounded to currency precision. Missing
  opening evidence, gaps, ambiguous ordering, unsupported revaluations or inconsistent costs
  fail with `INVENTORY_HISTORY_UNSUPPORTED` (409); present balances are never substituted.
- Cash-only transfers are excluded from external cash flows. Zero-net compound journals with
  external counterparts remain classification issues, as do ambiguous mixed cash receipts/
  payments. Gross amounts remain visible pending review; net reconciliation alone does not
  establish classification completeness.
- Shared cash-flow classification accepts existing signed `operating`, `investing`, `financing`
  totals (including opposite zero-net allocations), or explicit gross `allocations`:
  `[{category:"operating",inflow:100,outflow:100}]`. Gross fields are nonnegative currency
  values and their net must equal the journal cash movement. The response retains `amount`
  and adds `inflow`/`outflow` to each cash-flow line.
  Across all categories, reviewed inflows must not exceed the actual journal cash debits,
  and reviewed outflows must not exceed its cash credits. These ceilings apply to signed
  category totals too; net equality cannot authorize fabricated offsetting gross activity.
  Exceeding either ceiling returns `CASH_FLOW_GROSS_EXCEEDS_EVIDENCE` (400), without changing
  classification or audit history. Less than both ceilings is permitted when the reviewer
  excludes an evidenced internal-transfer offset while retaining the exact journal net.
  Report reads revalidate saved reviews against the same gross evidence; oversized historical
  reviews are not trusted or deleted and ambiguous journals reappear for classification.
- Pharmacy has its own authenticated-branch review endpoint, relative to its accounting router:
  `PUT /cash-flow/:journalId/classification`. It requires `idempotencyKey`, evidence `reason`,
  and the same category/gross fields. Reviews are atomic, audited and enforce organization
  period, pharmacy-day and finalized-bank locks. Local pharmacy review does not silently
  alter shared-GL classification or original posted journals.
- Pharmacy revenue registers include `sales_returns` and `sales_discounts`, consistently with P&L.
- Bank workbook uploads accept `dateFormat: "YMD" | "DMY" | "MDY"`. ISO `YYYY-MM-DD` text
  is always unambiguous; other text needs the explicitly selected format, never a row-wise
  locale guess. Native Excel dates and 1900/1904 serial systems are supported. Signed amount
  convention: `(100)` and `100 DR` are -100, `100 CR` is +100. Comma thousands grouping is
  validated; invalid syntax, conflicting signs or excess precision are rejected. Debit/credit
  columns contain nonnegative magnitudes, with at most one populated positive side per row.
  Invalid rows reject the entire workbook before persistence (`INVALID_BANK_WORKBOOK_ROWS`,
  400, with row-number diagnostics); duplicate valid rows retain normal import idempotency.

Deployment: apply additive migration `20261103_cash_flow_reviews` through the normal tenant
migration process before using gross/local reviews (startup schema initializers also ensure
the storage). It adds nullable `gross_allocations` to shared classifications and creates
`pharmacy_cash_flow_classifications`; no posted monetary rows are modified or removed.
Previously incorrect year-end journals require reviewed linked corrections. Previously missing
legacy lines require source-to-ledger reconciliation and a controlled repair plan, not blind
producer replay. Neither correction is performed automatically at startup or migration time.
No current/non-current statement classification metadata exists in the account contract;
consumers must explicitly present term classification as unavailable rather than infer it
from account numbers or names.

## Scope

### Included

- Chart of accounts, database-backed (`acc_accounts`), replacing the current static config map.
- Double-entry posting for accounting transactions (`acc_journal_entries` + `acc_journal_lines`),
  with balance validation before commit.
- Ledger query, trial balance, general ledger, income statement, and balance sheet reports.
- Tenant-aware accounting data storage.
- Integration with billing (payment, refund, adjustment), expenses, inventory value movement,
  commission payments, and supplier payments.
- Accounts receivable and accounts payable subledgers (`acc_receivables`, `acc_payables`) with
  outstanding-balance tracking and aging buckets.
- Reversal workflow for refunds/adjustments/corrections that never mutates a posted entry.
- Role-gated access (cashier, accountant, manager, admin).

### Not included (release 1)

- Full ERP inventory costing (FIFO/LIFO/weighted average).
- Fixed asset depreciation.
- Multi-currency accounting.
- Automated dunning/collections workflows on top of AR aging.

## User stories

1. As an accountant, I want to see posted journal entries so I can audit financial transactions.
2. As a finance manager, I want to view trial balance and income statement by period to validate
   account balances and profitability.
3. As a product owner, I want billing payments, refunds, and adjustments to generate the correct
   revenue/cash/contra-revenue entries automatically.
4. As an operations manager, I want expense payments and supplier payments recorded as expense/
   payable and cash/bank transactions.
5. As a payroll/commission user, I want commission batch payments to post commission expense and
   cash/payable entries without duplicating tracking amounts already recorded in `commission_tracking`.
6. As a developer, I want a single `AccountingService.postTransaction()` API so producer modules
   never construct ledger rows directly.

## Requirements

### Functional

- `POST /api/v1/accounting/journal` accepts a balanced transaction payload (header + debit/credit
  lines) and rejects it if debits do not equal credits.
- `POST /api/v1/accounting/journal/:id/reverse` creates a linked reversal entry; the original entry
  is never edited or deleted.
- `GET /api/v1/accounting/journal` returns entries/lines with filtering by account, module, date
  range, and status.
- `GET /api/v1/accounting/trial-balance`, `/general-ledger`, `/income-statement`, `/balance-sheet`
  return the respective reports computed from posted lines only.
- `GET /api/v1/accounting/accounts` / `POST /api/v1/accounting/accounts` manage the chart of accounts.
- `AccountingService` enforces schema initialization, tenant-aware writes, and idempotent posting
  keyed on `(source_module, source_table, source_pk, transaction_type)`.

### Non-functional

- All requests must require `tenantId` query or request data.
- Ledger writes must be atomic (single DB transaction for header + lines) and consistent.
- Reporting endpoints must return totals for credits and debits and reconcile to zero net variance.
- Existing `finance_ledger` consumers keep working during the migration (dual-write in Phase 1).

## Acceptance criteria

- Accounting routes are available under `/api/v1/accounting`.
- A balanced transaction cannot be posted if debits do not equal credits (`UnbalancedTransactionError`).
- Posted journal entries are visible in ledger/general-ledger query results.
- Trial balance correctly reports totals by account, and asset/liability/equity/revenue/expense
  balances net to zero for a fully posted period.
- Refunds/adjustments/reversals create new linked entries; no posted entry is ever mutated.
- The new SQL migration creates `acc_accounts`, `acc_journal_entries`, and `acc_journal_lines` and
  seeds `acc_accounts` from the existing `ACCOUNT_CONFIG` map.

## Metrics

- Number of journal entries posted per day, by source module.
- Number of unbalanced-transaction rejections (should trend to zero after producer modules migrate).
- Count of accounts in the chart of accounts.
- Performance of ledger/trial-balance queries under tenant filters.
- Reconciliation variance between billing revenue, commission tracking, expense payments, and
  posted journal totals for a given period (target: zero).

## Risks

- Duplicate postings from retried requests — mitigated by the idempotency key on
  `(source_module, source_table, source_pk, transaction_type)`.
- Incomplete/stale account metadata if chart-of-accounts changes aren't reviewed by an accountant role.
- Tenant mismatch when posting across the multi-tenant connection.
- Divergence between `finance_ledger` (legacy) and `acc_journal_lines` (new) during the dual-write
  transition period if one write succeeds and the other fails outside the same transaction.

## Out of scope for release 1

- Complex closing entries and month-end consolidations.
- Multi-currency handling.
- Detailed fixed asset ledger and depreciation schedules.
- Full inventory costing methods (FIFO/LIFO/weighted average).

## Implementation deliverables

- `src/accountingModule/migrations/create_accounting_schema.sql` — `acc_accounts`,
  `acc_journal_entries`, `acc_journal_lines`.
- `src/accountingModule/services/AccountingService.ts` — `postTransaction()`, `reverse()`.
- `src/accountingModule/services/ChartOfAccountsService.ts`, `LedgerReportService.ts`.
- `src/accountingModule/controllers/AccountsController.ts`, `JournalController.ts`,
  `ReportsController.ts`, mounted via `src/accountingModule/routes.ts`.
- `src/accountingModule/events/AccountingEventBus.ts` and listeners for billing, expenses,
  commissions, supplier payments, and inventory.
- Documentation in [accounting-system-plan.md](accounting-system-plan.md) and
  [accounting-system-flow-map.md](accounting-system-flow-map.md).
