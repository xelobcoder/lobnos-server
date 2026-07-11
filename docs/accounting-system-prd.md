# Accounting System PRD for Lobnos Server

## Purpose

Enable a complete accounting subsystem within Lobnos Server so financial operations are recorded, reported, and auditable alongside existing billing, expense, payroll and inventory workflows.

## Business objectives

- Provide a single source of truth for financial transactions.
- Improve financial reporting for laboratory operations.
- Support auditing, compliance, and management review.
- Reduce manual reconciliation between billing and expenses.

## Scope

### Included

- Chart of accounts support.
- Double-entry posting for accounting transactions.
- Ledger query, trial balance, and account summaries.
- Tenant-aware accounting data storage.
- Integration with billing, expenses, payroll, and supplier payments.

### Not included

- Full ERP inventory costing.
- Fixed asset depreciation.
- Multi-currency accounting.
- Accounts receivable aging and collections workflows.

## User stories

1. As an accountant, I want to see posted ledger entries so I can audit financial transactions.
2. As a finance manager, I want to view trial balance by period to validate account balances.
3. As a product owner, I want billing payments to generate revenue and cash entries automatically.
4. As an operations manager, I want expense payments recorded as expense and cash/bank transactions.
5. As a developer, I want accounting APIs to integrate with existing tenant and billing architecture.

## Requirements

### Functional

- `POST /api/v1/accounting/transactions` accepts a balanced transaction payload with debit/credit entries.
- `GET /api/v1/accounting/ledger` returns ledger entries with filtering by account, module, date range, and status.
- `GET /api/v1/accounting/trial-balance` returns account balances grouped by debit/credit and net balance.
- `GET /api/v1/accounting/accounts` returns chart of accounts metadata.
- `FinanceLedgerService` enforces ledger table initialization and tenant-aware writes.

### Non-functional

- All requests must require `tenantId` query or request data.
- Ledger writes must be atomic and consistent.
- Reporting endpoints must return totals for credits and debits.
- Existing database schema should remain compatible with current finance workflows.

## Acceptance criteria

- Accounting routes are available under `/api/v1/accounting`.
- A balanced transaction cannot be posted if debits do not equal credits.
- Posted ledger entries are visible in ledger query results.
- Trial balance correctly reports totals by account reference and net balance.
- The new SQL schema file can create the required accounting tables.

## Metrics

- Number of ledger entries posted per day.
- Number of balanced transactions created.
- Count of accounts in the chart of accounts.
- Performance of ledger query under tenant filters.

## Risks

- Duplicate ledger entries created by repeated source references.
- Incomplete account metadata if account setup is not maintained.
- Tenant mismatch when posting across multi-tenant connection.

## Out of scope for release 1

- Complex closing entries and month-end consolidations.
- Multi-currency handling.
- Detailed fixed asset ledger and depreciation schedules.

## Implementation deliverables

- `src/services/finance/FinanceLedgerService.ts` extended for balanced posting and reporting.
- `src/controllers/accounting/AccountingController.ts`.
- `src/controllers/accounting/route.ts`.
- `src/services/finance/migrations/create_accounting_schema.sql`.
- Documentation in `docs/accounting-system-plan.md` and `docs/accounting-system-prd.md`.
