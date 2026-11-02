# PLS Analytics and Module Audit

## Scope and status

This audit covers the backend and the sibling front end at `../lobnos`. It focuses on pharmacy analytics/accounting separation, the analytics landing page, and current module/role access. It is a static code audit plus targeted automated checks; it does not query tenant data or measure production performance.

## Confirmed implementation

- Pharmacy analytics is served by `src/controllers/pharmacy/PharmacyAnalyticsController.ts` and `src/models/pharmacy/PharmacyAnalytics.ts`. Its operational queries use pharmacy-owned tables and authenticated branch context; existing tests assert branch scoping and reject laboratory inventory and common-ledger tables in those query paths.
- `facilityModuleAccess` maps `/api/v1/pharmacy/*` to the pharmacy facility module. Pharmacy routes also use role-based middleware; finance reports require an administrator, pharmacy manager, or pharmacy accountant.
- Pharmacy reporting had operational and accounting statements exposed through the same `/pharmacy/analytics` route. The front end offered profit-and-loss, balance-sheet, cash-flow, trial-balance, and journal views in the analytics tabs.
- The administrative `/analytics` page was a static list of report links. It did not aggregate executive KPIs or apply the same role/module visibility checks used by the navigation system.
- The pharmacy overview charts use Recharts and display current report data. They do not provide previous-period comparisons or chart-point drill-down into source transactions.

## Changes in this update

- Split operational pharmacy reports from financial statements: operational reports remain at `/pharmacy/analytics`; accounting reports now use the finance-authorized `/pharmacy/accounting/reports`.
- Added a dedicated `/pharmacy/accounting` page and navigation entry. Pharmacy accounting statements and journal transactions are no longer offered in the pharmacy analytics tabs.
- Filtered the administrative analytics landing links through existing role-page and facility-module policies. The page labels itself as an analytics/report hub and does not invent KPI values.
- Added backend tests for role authorization, report-family separation, and the repeatable-read accounting endpoint.

## Remaining gaps

- No verified unified executive-summary API currently supplies all requested revenue, collections, patient, lab, imaging, pharmacy, workload, and alert metrics. The landing page therefore remains a report hub rather than a GA4-style KPI dashboard.
- Current pharmacy reporting is authenticated-branch scoped; a multi-branch selector and permission-filtered branch comparisons are not implemented.
- Previous-period comparison, selectable daily/weekly/monthly/quarterly/yearly aggregation, chart drill-down, actionable verified alerts, and customizable dashboard sections remain unimplemented.
- Reports should be reconciled against tenant data and the accounting ledger before claiming cross-report financial consistency. No live tenant data was read for this audit.

## Validation

See [PLS_IMPLEMENTATION_AND_TEST_REPORT.md](./PLS_IMPLEMENTATION_AND_TEST_REPORT.md) for commands, results, and remaining verification limitations.
