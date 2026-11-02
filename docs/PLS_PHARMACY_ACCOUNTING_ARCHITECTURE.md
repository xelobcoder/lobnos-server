# PLS Pharmacy Accounting Architecture

## Current state

PLS has a shared accounting module under `src/accountingModule` and pharmacy-owned financial tables under `src/models/pharmacy/PharmacySeparationSchema.ts`.

- The shared ledger uses `acc_journal_entries` and `acc_journal_lines`. Its `SourceModule` enum and SQL enum currently cover billing, expense, inventory, commission, supplier, payroll, and manual postings; pharmacy is not a source module.
- Pharmacy journals use `pharmacy_journals` and `pharmacy_journal_lines`. `PharmacyLedger.postPharmacyJournal` commits to that ledger with pharmacy sales, receipts, supplier liabilities, expenses, transfers, and adjustments.
- Pharmacy financial reports read those pharmacy-owned journal tables. The current pharmacy ledger is not consolidated into the shared accounting module.

The separate pharmacy book protects the pharmacy operational boundary, but the absence of a shared-ledger posting/source dimension means organization-wide consolidated statements cannot include pharmacy activity from the common general ledger. A pharmacy business-unit interface alone does not solve this accounting integration gap.

## Changes in this update

- The front end now has a dedicated `/pharmacy/accounting` section for pharmacy financial statements and journal transactions.
- The backend exposes those reports through `/api/v1/pharmacy/accounting/reports`, with finance-role authorization and a repeatable-read transaction.
- The existing pharmacy analytics endpoint now accepts operational reports only.

These are interface and report-boundary changes. They do **not** migrate pharmacy journals into the shared general ledger or change existing posting tables.

## Required next architecture phase

Before consolidating the ledger, agree on and test:

1. The source identity/idempotency mapping from a pharmacy journal to a shared journal entry.
2. The account map for cash, each bank/mobile-money destination, sales, COGS, inventory, supplier/receivable balances, transfers, quarantined stock, returns, and manual journals.
3. Whether pharmacy journals remain an auditable subledger and how each subledger total reconciles to the corresponding shared GL account.
4. How prior pharmacy journals are backfilled once, with a resumable migration and duplicate detection, while preserving branch and source references.
5. How close periods, finalized records, reversals, branch transfers, and consolidated financial statements behave after cutover.

The existing pharmacy account codes and shared chart of accounts are not a complete one-to-one mapping. In particular, pharmacy collection destinations and supplier accounts need explicit treatment; silently mapping them to generic cash/AP accounts could break reconciliation. A source-module enum addition by itself is insufficient.

No schema migration, historical backfill, or live database operation was made in this update.
