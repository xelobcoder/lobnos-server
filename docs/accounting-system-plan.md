# Accounting System Plan for Prime Laboratory Software (PLS) backend

## Current state (verified in code, August 2026)

Before planning the full system, this is what actually exists today — treat everything else in this
document as **target architecture**, not implemented behavior:

- `src/services/finance/FinanceLedgerService.ts` — a single-entry ledger writer (`recordEntry`), not
  balanced double-entry. Each call writes one row for one direction (`credit` or `debit`); nothing
  forces a matching offsetting row to exist.
- `src/services/finance/financeLedgerInit.ts` — creates/patches one table, `finance_ledger`, with a
  unique index on `(source_module, source_table, source_pk, direction)` to avoid duplicate postings.
- `src/accountingModule/config/accountConfig.ts` — a static, in-memory `ACCOUNT_CONFIG` map (15 fixed
  accounts). There is no `acc_accounts` table; nothing enforces that `account_ref` values used
  elsewhere actually exist in this map.
- **Only one integration point exists**: `src/models/billing/billing_shared.ts` calls
  `FinanceLedgerService.recordEntry()` when a `billinghx` payment row is inserted.
- Expenses, inventory, commissions, and suppliers have **no ledger integration** today.
- There is no chart-of-accounts API, no journal entity, no trial balance computation, and no
  refund/adjustment/reversal workflow. `FinanceLedgerService.getSummary()` only sums credits/debits
  globally and per `source_module` — it is not a real trial balance per account.

This plan describes how to grow that thin ledger into a full accounting module without breaking the
existing `finance_ledger` writes from billing.

## Goals

- Provide an auditable, tenant-aware general ledger for every financial event in the system:
  billing payments, refunds/adjustments, expenses, supplier payments, commission payments, and
  inventory value changes.
- Enforce true double-entry bookkeeping: every accounting transaction posts a balanced set of
  journal lines (`sum(debits) === sum(credits)`) atomically, in one DB transaction.
- Provide a real chart of accounts (database-backed, not just a static config file), journal
  entries, a general ledger view, and a trial balance report.
- Package the module internally using NestJS-style layering (DTOs, enums, interfaces, entities,
  services, controllers, event listeners) even though the runtime is Express — this keeps the
  module self-contained, testable, and portable if it is ever extracted into its own service.
- Make every producing module (billing, expenses, inventory, commissions, suppliers) call a single
  narrow `AccountingService.postTransaction()` API instead of writing to `finance_ledger` directly.

## Non-goals (release 1)

- Full ERP-style inventory costing (FIFO/LIFO/weighted average) — inventory only posts a value
  movement, not COGS costing logic.
- Multi-currency ledgers.
- Fixed asset depreciation schedules.
- Automated dunning/collections workflows on top of AR aging (aging itself is in scope, see below).

## Module layout (NestJS-style internal structure, Express runtime)

```
src/accountingModule/
├── index.ts                         # module composition root (factory, route mount)
├── config/
│   └── accountConfig.ts             # seed data only — DB chart of accounts is the source of truth
├── constants/
│   └── ledger.constants.ts          # table names, default currency, rounding scale
├── enums/
│   ├── account-type.enum.ts         # ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE
│   ├── normal-balance.enum.ts       # DEBIT | CREDIT
│   ├── journal-status.enum.ts       # DRAFT | POSTED | VOIDED | REVERSED
│   ├── source-module.enum.ts        # BILLING | EXPENSE | INVENTORY | COMMISSION | SUPPLIER | PAYROLL
│   └── transaction-type.enum.ts     # PAYMENT | REFUND | ADJUSTMENT | ACCRUAL | REVERSAL
├── interfaces/
│   ├── IAccount.ts                  # chart-of-accounts row shape
│   ├── IJournalEntry.ts             # journal header shape
│   ├── IJournalLine.ts              # single debit/credit line shape
│   ├── IAccountingRepository.ts     # persistence contract (accounts, journals, lines)
│   └── IAccountingService.ts        # public service contract used by producer modules
├── dto/
│   ├── CreateAccountDto.ts
│   ├── PostTransactionDto.ts        # { sourceModule, sourceTable, sourcePk, transactionType, lines[] }
│   ├── PostTransactionLineDto.ts    # { accountId, direction, amount, memo? }
│   ├── ReverseTransactionDto.ts
│   └── LedgerQueryDto.ts            # filters for ledger/trial-balance/report endpoints
├── entities/
│   ├── AccountEntity.ts             # maps to acc_accounts
│   ├── JournalEntryEntity.ts        # maps to acc_journal_entries (header)
│   └── JournalLineEntity.ts         # maps to acc_journal_lines (one row per debit/credit)
├── repositories/
│   ├── AccountRepository.ts
│   └── JournalRepository.ts
├── services/
│   ├── AccountingService.ts         # implements IAccountingService — postTransaction(), reverse()
│   ├── ChartOfAccountsService.ts    # CRUD + validation for acc_accounts
│   └── LedgerReportService.ts       # trial balance, general ledger, P&L, balance sheet
├── events/
│   ├── AccountingEventBus.ts        # thin wrapper so producer modules stay decoupled
│   └── listeners/
│       ├── BillingPaymentListener.ts
│       ├── BillingRefundListener.ts
│       ├── ExpensePaidListener.ts
│       ├── CommissionPaidListener.ts
│       ├── SupplierPaymentListener.ts
│       └── InventoryValueChangeListener.ts
├── controllers/
│   ├── AccountsController.ts        # GET/POST /api/v1/accounting/accounts
│   ├── JournalController.ts         # GET /journal, POST /journal (manual entries), POST /journal/:id/reverse
│   └── ReportsController.ts         # GET /trial-balance, /general-ledger, /income-statement, /balance-sheet
├── routes.ts                        # mounted at /api/v1/accounting in src/app.ts
├── errors/
│   └── AccountingErrors.ts          # UnbalancedTransactionError, AccountNotFoundError, ...
└── migrations/
    └── create_accounting_schema.sql
```

`interfaces/` hold the contracts and behavioral documentation (per repo convention — see
`/memories/repo/conventions.md`): caveats like "a transaction is rejected unless debits equal
credits" belong as JSDoc on `IAccountingService.postTransaction`, not inline in
`AccountingService`.

## Database design

Tenancy is per-database (`KnexConnection(tenantId)` selects the tenant's own MySQL database), not a
shared-table discriminator. **No accounting table carries a `tenant_id` column** — repositories and
services accept `tenantId` only to route to the correct database connection, never as a stored or
filtered column, consistent with every other table in the schema.

### `acc_accounts` (chart of accounts — new table, replaces the static config as source of truth)

| column | type | notes |
| --- | --- | --- |
| `id` | int PK | |
| `account_code` | varchar(20) unique | e.g. `1000`, `4000` |
| `name` | varchar(120) | |
| `type` | enum(asset, liability, equity, revenue, expense) | |
| `normal_balance` | enum(debit, credit) | derived from `type`, stored for query speed |
| `parent_account_id` | int nullable FK self | supports sub-accounts (e.g. `Cash > Bank > Bank-Ghana`) |
| `is_active` | boolean | |
| `created_at`, `updated_at` | datetime | |

Seed `acc_accounts` from the existing `ACCOUNT_CONFIG` map on first migration so current
`account_ref` strings map cleanly to real account codes.

### `acc_journal_entries` (transaction header — one row per business event)

| column | type | notes |
| --- | --- | --- |
| `id` | int PK | |
| `transaction_type` | enum(payment, refund, adjustment, accrual, reversal) | |
| `source_module` | enum(billing, expense, inventory, commission, supplier, payroll) | |
| `source_table` | varchar(60) | |
| `source_pk` | int | |
| `description` | varchar(255) nullable | |
| `occurred_at` | datetime | |
| `status` | enum(posted, voided, reversed) | never `draft` once written — draft entries live only in memory before posting |
| `reversal_of_entry_id` | int nullable FK self | links a reversal to the original |
| `created_by` | int nullable (employeeid) | |
| `created_at` | datetime | |

Unique key: `(source_module, source_table, source_pk, transaction_type)` — mirrors the existing
`finance_ledger` idempotency guard so the same billing/expense/commission event cannot double-post.

### `acc_journal_lines` (one row per debit or credit — replaces flat `finance_ledger` rows)

| column | type | notes |
| --- | --- | --- |
| `id` | int PK | |
| `journal_entry_id` | int FK → `acc_journal_entries.id` | |
| `account_id` | int FK → `acc_accounts.id` | |
| `direction` | enum(debit, credit) | |
| `amount` | decimal(14,2) | always positive; sign is implied by `direction` |
| `branchid`, `billingid`, `expense_id`, `invoice_id`, `employeeid` | int nullable | kept for the existing analytics that already join on these columns |
| `created_at` | datetime | |

`AccountingService.postTransaction()` must reject (throw `UnbalancedTransactionError`) any call
where `sum(lines where direction=debit) != sum(lines where direction=credit)`, and must write the
header + all lines inside a single DB transaction.

### `acc_receivables` (accounts receivable subledger — one row per outstanding invoice/billing)

| column | type | notes |
| --- | --- | --- |
| `id` | int PK | |
| `billingid` | int FK → existing `billing` table | |
| `journal_entry_id` | int FK → `acc_journal_entries.id` | the entry that first recognized the receivable |
| `invoice_amount` | decimal(14,2) | |
| `amount_paid` | decimal(14,2) | running total from `billinghx`/payment postings |
| `amount_outstanding` | decimal(14,2) generated or maintained | `invoice_amount - amount_paid` |
| `due_date` | date nullable | |
| `status` | enum(open, partially_paid, paid, written_off) | |
| `created_at`, `updated_at` | datetime | |

This reuses the existing `billing`/invoice data as the source of truth for the invoice itself;
`acc_receivables` only tracks the accounting-side outstanding balance and status so aging can be
computed without re-deriving it from raw billing/payment joins each time.

### `acc_payables` (accounts payable subledger — one row per outstanding supplier/expense bill)

| column | type | notes |
| --- | --- | --- |
| `id` | int PK | |
| `source_module` | enum(supplier, expense) | |
| `source_pk` | int | supplier invoice id or expense invoice id |
| `journal_entry_id` | int FK → `acc_journal_entries.id` | entry that recognized the payable |
| `bill_amount` | decimal(14,2) | |
| `amount_paid` | decimal(14,2) | |
| `amount_outstanding` | decimal(14,2) | |
| `due_date` | date nullable | |
| `status` | enum(open, partially_paid, paid) | |
| `created_at`, `updated_at` | datetime | |

Both subledgers are updated in the same DB transaction as the journal posting that created or
settled them — never as a separate, unguarded write.

### Migration relationship to `finance_ledger`

Keep `finance_ledger` writable during the transition (billing already depends on it for existing
reports). `AccountingService.postTransaction()` should, for release 1, write to **both**
`finance_ledger` (one row per line, unchanged shape) and the new `acc_journal_entries`/
`acc_journal_lines` tables in the same DB transaction, so existing ledger-summary consumers keep
working while new chart-of-accounts/trial-balance features are built on the new tables. Retire the
dual-write once `LedgerReportService` fully replaces `FinanceLedgerService.getSummary()` consumers.

## Integration points (event → journal lines)

Each producing module publishes through `AccountingEventBus`; it must never construct
`acc_journal_lines` rows itself. Debit/credit examples assume amounts in GHS.

| Event | Debit | Credit |
| --- | --- | --- |
| Billing payment received | Cash/Bank (by payment mode) | Service Revenue |
| Billing refund issued | Service Revenue (or Refunds/Contra-Revenue) | Cash/Bank |
| Billing adjustment (write-off/discount after invoicing) | Revenue Adjustments | Accounts Receivable |
| Expense approved & paid | Operating Expense (by category) | Cash/Bank or Accounts Payable |
| Supplier payment | Accounts Payable | Cash/Bank |
| Commission batch paid | Commission Expense | Cash/Bank or Commission Payable |
| Inventory stock received (purchase) | Inventory (asset) | Accounts Payable or Cash/Bank |
| Inventory consumption (used in service) | Cost of Goods Sold | Inventory (asset) |
| Payroll run | Salaries Expense | Cash/Bank or Payroll Liability |

Refunds, adjustments, and reversals are **never** created by mutating or deleting an existing
`acc_journal_entries` row. They are new entries with `transaction_type` = `refund`/`adjustment`/
`reversal` and `reversal_of_entry_id` pointing at the original, so the full history stays
auditable — this mirrors the existing commission-tracking invariant of never updating/deleting
posted rows.

## API surface

- `GET /api/v1/accounting/accounts` — chart of accounts (tree by `parent_account_id`).
- `POST /api/v1/accounting/accounts` — create account (admin/accountant role only).
- `GET /api/v1/accounting/journal` — filterable journal/ledger query (module, account, date range,
  status).
- `POST /api/v1/accounting/journal` — manual balanced entry (accountant role only, for corrections
  outside automated postings).
- `POST /api/v1/accounting/journal/:id/reverse` — create a reversal entry linked to the original.
- `GET /api/v1/accounting/trial-balance` — per-account debit/credit/net balance for a period.
- `GET /api/v1/accounting/general-ledger` — chronological postings per account.
- `GET /api/v1/accounting/income-statement` — revenue vs. expense accounts for a period.
- `GET /api/v1/accounting/balance-sheet` — asset/liability/equity snapshot as of a date.
- `GET /api/v1/accounting/receivables` — AR subledger: outstanding invoices, filterable by status,
  clinician/organization, and aging bucket (current, 30/60/90+ days).
- `GET /api/v1/accounting/payables` — AP subledger: outstanding supplier/expense bills, same
  filtering and aging shape as receivables.

All endpoints require `tenantId` and are role-gated (`cashier` read-only summary, `accountant`
read/write journal, `admin`/`manager` chart-of-accounts changes) following the existing
`isAuthorizedRoleAdmin`-style middleware pattern.

## Role-based access

Reuse the existing role-check middleware pattern (`isAuthorizedRoleAdmin`, etc.) rather than
inventing a new authorization mechanism:

- `cashier` — read-only access to their branch's daily cash summary.
- `accountant` — full journal/report read, manual journal entry, reversal.
- `manager` — reports read-only, no posting rights.
- `admin` — chart-of-accounts management, all accountant rights.

## Fault isolation (implemented, Phase 1)

The accounting module must never block, slow down, or roll back a producer transaction (billing,
expenses, commissions, ...). There is no message broker in this repo, so isolation is achieved
in-process via a **transactional outbox**, not a literal separate service/process:

- Producers call `enqueuePosting()` inside their own DB transaction. It only writes one row to
  `acc_posting_outbox` (source module/table/pk, transaction type, JSON payload, status `pending`)
  — cheap enough that it practically cannot fail, and failure is caught the same way any other
  insert in that transaction would be.
- Actual ledger posting (`AccountingService.postTransaction()`, including the chart-of-accounts
  lookup, balance validation, and `finance_ledger` dual-write) happens **out of band**, never
  inside the producer's transaction and never awaited by the producer's request/response path.
- Two triggers process the outbox: a fire-and-forget `processPendingOutbox()` call right after the
  producer's transaction commits (best effort, may run before the commit is visible and find
  nothing — harmless), and a periodic sweep (`setInterval` in `src/app.ts`, every 60s) that is the
  actual delivery guarantee, retrying `pending`/`failed` rows up to `MAX_ATTEMPTS` and recording
  `last_error` per row.
- `bootstrapAccountingTables(1)` runs once at server startup in `src/app.ts` (alongside
  `bootstrapBillingTables`, `bootstrapCommissionTables`, etc.) wrapped in its own `try/catch` so an
  accounting bootstrap failure never prevents the server from starting.
- Known gap: if the process crashes between a producer's commit and the outbox row being posted,
  that one posting is delayed until the next sweep, not lost (the row is already committed with the
  producer's transaction) — so recovery is automatic, just not instantaneous.

## Phased roadmap

1. **Phase 1 — Foundation**: `acc_accounts`, `acc_journal_entries`, `acc_journal_lines`,
   `acc_posting_outbox` migrations; `AccountingService.postTransaction()` with balance validation
   and dual-write to `finance_ledger`; billing payments enqueue through the outbox instead of
   calling `FinanceLedgerService.recordEntry()` directly from `billing_shared.ts`.
2. **Phase 2 — Automation**: add outbox-enqueuing call sites for expenses, supplier payments,
   and commission batch payments so those modules stop needing direct knowledge of account codes.
3. **Phase 3 — Reporting**: `LedgerReportService` — trial balance, general ledger, income
   statement, balance sheet; retire `FinanceLedgerService.getSummary()` once parity is confirmed.
4. **Phase 4 — Inventory & reconciliation**: inventory stock-in/consumption postings, period
   closing helpers, and a reconciliation report comparing billing revenue, tracked commissions,
   expense payments, and posted journal totals for a given period.
5. **Phase 5 — AR/AP subledgers**: `acc_receivables`/`acc_payables` tables, populated alongside the
   journal postings that create/settle them; `GET /accounting/receivables` and `/payables` with
   aging buckets, replacing any ad-hoc "outstanding invoice/bill" queries against raw billing/
   supplier/expense tables.

## Non-functional requirements

- Tenant-aware for every read/write (`tenantId` required).
- Every posting is atomic: header + all lines in one DB transaction, or none at all.
- Idempotent by `(source_module, source_table, source_pk, transaction_type)` — repeat calls from
  retried requests must not double-post.
- No `console.log` of financial line items in production paths (existing repo convention).
- Preserve the source module/table/pk linkage so every posted line is traceable back to the
  originating billing/expense/commission/inventory/supplier record.

## Related documents

- [accounting-system-prd.md](accounting-system-prd.md) — product requirements for this plan.
- [accounting-system-flow-map.md](accounting-system-flow-map.md) — event-by-event flow diagrams.

