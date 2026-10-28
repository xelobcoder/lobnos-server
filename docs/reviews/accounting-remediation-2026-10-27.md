# Accounting corrections and verification — 27 October 2026

## Delivered

This patch addresses the correctness findings in `accounting-vs-quickbooks-2026-10-27.md`. Existing billing, cashier, expense approval, manual-journal segregation of duties and accountant/manager/owner permissions remain in place. No live balances, patient transactions or historical journals were rewritten.

| Finding | Correction |
|---|---|
| Currency precision | Shared minor-unit validation rejects non-finite values, negative payment amounts, unsupported precision and even a one-pesewa journal imbalance. Binary floating-point noise such as 0.1 + 0.2 is normalized. Opening-balance and manual-journal validation use the same exact-money boundary. |
| Collection integrity | Bill and service rows are locked, duplicate services and wrong bill associations are rejected, and payment plus waiver cannot exceed the current outstanding amount. Totals are recomputed in pesewas. Bill recalculation no longer multiplies service totals by joined refund rows. |
| Retry safety | Cash Collection carries a durable request key and canonical payload fingerprint. The server stores it in the same transaction as the collection. A repeated key returns the prior success without recording cash again; changing amounts under that key is rejected. The frontend retains the key for uncertain network failures and page reloads. The verified gateway reference flow remains supported. |
| Waivers | Cash and waiver sums preserve the entered totals. Each collection's write-off also gets a unique accounting/subledger source reference so later partial waivers are not silently discarded. Noncash bad-debt records remain in their existing operational workflow but are excluded from daily cash-paid totals. |
| Historical reporting | Financial AR/AP aging and party statements reconstruct balances from dated, posted control-account movements. Later settlements do not reduce an earlier cutoff. Expense obligations, supplier receipts, reversals, credits and unapplied balances remain visible. Supplier UUIDs survive statement navigation. Operational patient outstanding screens retain their billing workflow. |
| AP coverage | Expense accruals, payments and reversals now also append signed AP subledger events with merchant identity and settlement dates. Financial aging includes all posted AP sources, including manual/unassigned balances, rather than inventory receipts only. |
| Statement consistency | Aging totals are computed across the filtered report before pagination. Party statement running balances are computed before slicing. Unapplied credits are retained rather than hidden. Multi-query financial reports run in one repeatable-read transaction. |
| Cash flow | Opening/closing cash are read independently from actual ledger balances, including configured bank GL accounts. Ordinary entries preserve signed cents; internal cash/bank transfers net to zero. Ambiguous compound cash/noncash entries stay in an explicit unclassified section until reviewed, rather than receiving a guessed split. An inline allocation must sum exactly to the journal cash movement. Saving uses existing `accounting.journal.post` authority, records history, and rejects finalized/closed records. |
| Financial statement signs | Contra assets such as accumulated depreciation reduce assets. Profit/loss, monthly analysis and branch performance use the appropriate financial-statement sign rather than assuming every normal-balance label is the statement sign. |
| Period closing | Posting, outbox enqueue and period close use the same period row lock. Close checks journal equality, unresolved posting jobs, cash-flow reconciliation and required classifications in its transaction. Close/reopen events retain before/after audit records, with the signed-in actor. Soft-close behavior is unchanged. |
| Reversals | Reversal creation and marking the original reversed commit or roll back together. Concurrent/repeated reversals serialize, retries reuse the saved reversal, and reversing a reversal is rejected in favor of an explicit correcting journal. |
| Bank reconciliation | Manual matching validates existence, signed amount, bank GL, branch, active account and statement state inside a transaction. Ledger matches receive a database uniqueness constraint. Unmatch/ignore actions retain audit evidence; ignoring a matched line requires unmatching first. Historical summaries exclude future statement matches and use the bank's branch and a consistent read snapshot. |
| User-visible evidence | Financial reports show their basis and warn about unresolved accounting postings. Cash-flow differences and classification requirements are visible on the report. `/accounting/control-history` provides read-only, paged, date/action-filtered history for authorized accounting users. |

## Verification

- 203 tests passed across 21 backend test files, covering accounting, collection, gateways, expenses and existing identity/authority guards.
- The SQL accuracy fixtures execute real Knex queries against isolated in-memory SQLite databases. They test historical cutoffs, AP merchant/supplier identity, UUIDs, credits, statement balances, depreciation, cash-flow totals, compound allocations, period controls, rollback and request replay. SQLite serializes the fixture transactions; this is not a claim that MySQL lock behavior was exercised on a live server.
- 18 browser checks passed against real cashier/billing components with synthetic transport, including the supplied three-service example and a lost-response retry.
- 9 browser checks passed for financial report warnings, inline classification, history filtering/paging/errors, supplier statements and mobile overflow.
- The original exhaustive allocation test covers all 14,851 whole-pesewa waiver totals for the supplied bill.
- Backend build and full frontend TypeScript checks are recorded in the task's `tmp/accounting-*` logs.

The supplied bill allocation remains: 148.50 outstanding, 48.50 waived, 100.00 collected, zero remaining. Service payments are 25.92, 37.04 and 37.04.

## Deployment and live-data reconciliation

Deploy frontend and backend together, then restart the backend so each tenant's existing schema bootstrap installs:

- `acc_collection_requests` for transactional payment idempotency;
- `acc_control_audit` and its append-only triggers;
- `acc_cash_flow_classifications` and finalized-record protection;
- the unique nullable `acc_bank_statement_lines.matched_journal_line_id` index.

The upgraded HTTP collection endpoint requires a request key; an already-open older frontend receives a reload message. Do not silently remove legacy duplicate bank matches to install the uniqueness constraint: review them before applying the upgrade if any exist.

These read-only preflight checks can identify existing inconsistencies without altering financial data:

```sql
SELECT e.id,
       SUM(CASE WHEN l.direction = 'debit' THEN l.amount ELSE -l.amount END) AS difference
FROM acc_journal_entries e
JOIN acc_journal_lines l ON l.journal_entry_id = e.id
WHERE e.status <> 'voided'
GROUP BY e.id
HAVING difference <> 0;

SELECT matched_journal_line_id, COUNT(*) AS matches
FROM acc_bank_statement_lines
WHERE matched_journal_line_id IS NOT NULL
GROUP BY matched_journal_line_id
HAVING COUNT(*) > 1;

SELECT status, COUNT(*) AS jobs
FROM acc_posting_outbox
WHERE status <> 'posted'
GROUP BY status;
```

Production MySQL migration/locking tests and reconciliation against live tenant balances were not run in this task. Existing historical gaps require the established review/backfill or correcting-journal workflow; they are not erased, balanced with invented entries, or hidden by report formatting. The separate operational subledger coverage/reconciliation endpoint remains available to identify source-history gaps even though financial aging now ties directly to the posted control ledger.

## Product comparison scope

The current reporting basis is explicitly labeled. This patch does not invent a second cash-basis reporting engine or connect an unspecified bank-feed provider. Those QuickBooks comparison items are additional product capabilities rather than corrections to the identified accounting arithmetic and integrity defects.
