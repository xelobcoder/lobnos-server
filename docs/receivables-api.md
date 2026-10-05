# Outstanding Receivables

`GET /api/v1/accounting/reports/receivables`

Requires the existing authenticated accounting role and a positive integer `tenantId`.

This endpoint lists **current unpaid patient bills**, not historical AR ledger balances.
It reads `billing.outstanding` directly. Once Cash Collection settles a bill and its
outstanding becomes zero, the bill no longer appears. Journal history is retained.
This list does not depend on outbox processing, aging allocation, or reconciliation.

## Query

- `from`, `to`: inclusive bill-date range, formatted `YYYY-MM-DD`.
- `search`: patient name/identifier, patient ID, billing ID, or `BILL-<id>`.
- `sortby`: `documentDate:desc` (default) or `documentDate:asc`.
- `page`, `count`: server pagination, default 1/25; count capped at 500.

Both sorting and pagination run in SQL. Same-date records are ordered by billing
timestamp and ID. Date bounds use `billedon >= from` and `billedon < dayAfterTo`
to include the entire end date without wrapping the column in `DATE()`.

## Response

The standard success wrapper contains `result` with:

- `rows`: current page of patient identities, `BILL-<id>` references, bill dates,
  and current outstanding amounts.
- `total`, `page`, `count`: document count and pagination metadata.
- `totals.total`: outstanding amount across **all matching bills**, not just the page.

The Receivables frontend uses this endpoint instead of receivable-aging and AR
reconciliation. Those older endpoints remain available for ledger analysis. A bill
dated in an older selected range can have zero outstanding today; the date filter
does not restore its historical unpaid balance.