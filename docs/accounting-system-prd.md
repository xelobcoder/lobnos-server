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

