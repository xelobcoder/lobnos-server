# Accounting System Plan for Lobnos Server

## Overview

This document describes how to integrate a complete accounting subsystem into the existing Lobnos LIMS backend.
The accounting system will reuse the existing ledger scaffolding while adding double-entry bookkeeping, chart of accounts, journal and trial balance reporting, and transaction-level accounting integration across billing, expenses, payroll, and supplier payments.

## Goals

- Provide an auditable general ledger for all financial activity.
- Support double-entry bookkeeping for every accounting transaction.
- Reuse existing tenant-aware database connection and finance ledger table.
- Add accounting APIs for ledger reports, trial balances, accounts list, and transaction posting.
- Enable integration with billing, expense, payroll, inventory supplier payments and commission workflows.

## Core modules

1. `finance_ledger` ledger storage
2. `acc_accounts` account master table
3. `FinanceLedgerService` accounting ledger service
4. `AccountingController` API surface
5. `AccountingRouter` route registration

## Table design

### `finance_ledger`

- `id` int PK
- `occurred_at` datetime
- `direction` enum('credit','debit')
- `amount` decimal(12,2)
- `account_ref` varchar(50)
- `source_module` varchar(30)
- `source_table` varchar(60)
- `source_pk` int
- `billingid`, `expense_id`, `invoice_id`, `employeeid`, `branchid`
- `status` enum('posted','voided')
- `reversal_of_ledger_id` int
- `reversed_at` datetime
- `created_at` datetime

### `acc_accounts`

- `account_id` varchar(50) PK
- `name` varchar(120)
- `type` enum('asset','liability','equity','revenue','expense','dividends')
- `normal_balance` enum('debit','credit')
- `description` text
- `created_at` datetime
- `updated_at` datetime

## Accounting flow

1. Business event occurs (billing payment, payroll run, expense payment, supplier payment).
2. Service constructs a balanced accounting transaction with matching debit and credit entries.
3. `FinanceLedgerService.postDoubleEntry()` writes the two or more ledger rows in a database transaction.
4. Entries are tagged with source module/table/PK and reference metadata.
5. Reports are computed from the posted ledger rows.

## Initial integration points

- billing: post revenue and cash/bank entries on payment.
- expenses: post expense and cash/bank payables when expense is approved/paid.
- payroll: post salary expense and cash/bank or payroll liability entries.
- supplier payments: post accounts payable and cash/bank reduction.
- commissions: post commission expense entries when commission is paid.

## API endpoints

- `GET /api/v1/accounting/accounts` — list chart-of-accounts.
- `POST /api/v1/accounting/transactions` — post a balanced accounting transaction.
- `GET /api/v1/accounting/ledger` — query ledger entries.
- `GET /api/v1/accounting/trial-balance` — get trial balance by account.
- `GET /api/v1/accounting/summary` — ledger credit/debit summary.

## Non-functional requirements

- Tenant-aware database access (`tenantId` required in requests).
- Support auditability and source references.
- Avoid duplicate ledger posting by unique source direction constraints.
- Use existing `KnexConnection` and finance initialization.

## Implementation notes

- Use `FinanceLedgerService.recordEntry()` for single entry posting and add `postDoubleEntry()` for balanced transactions.
- Keep account metadata in `src/accountingModule/config/accountConfig.ts` until a full account master table is required.
- Mount accounting routes in `src/app.ts` under `/api/v1/accounting`.

## Next step

Implement the service, controller, route, and documentation files.
