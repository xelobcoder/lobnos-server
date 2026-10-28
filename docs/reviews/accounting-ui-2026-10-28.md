# Accounting UI/UX improvements — 28 October 2026

## Changes

- Replaced saturated gradient summary cards with neutral surfaces, readable values and restrained status colors.
- Added a compact accounting workspace navigation inside the existing AccountingGuard. All destinations reuse existing accounting pages.
- Moved New journal, Reconcile bank and Review periods to the top of the dashboard.
- Rebuilt the shared ReportShell with a breadcrumb, one visible page title, a wrapping action toolbar, compact filters and a distinct report surface. Report titles remain visible in print.
- Removed global CSS forcing financial values to the left. Numeric cells now remain right-aligned with tabular figures.
- Increased table-header readability, reduced heavy uppercase labels and normalized label weights while inheriting the application's font family.
- Replaced the dashboard's long monthly list with a compact responsive grid using one common bar scale, so months are visually comparable.
- Added explicit dashboard errors and a retry action; unavailable data is displayed as unavailable rather than as zero balances.
- Included pending postings in the attention state and made missing queue timing readable.
- Corrected mobile financial-performance rows after screenshot inspection, so ordinary currency values are not split into narrow columns.
- Corrected the shared warning's Review postings link to the existing `/accounting/posting-health` page.

## Scope

Frontend presentation and navigation only. Existing APIs, accounting calculations, payment workflows, journal posting permissions, approval rules and AccountingGuard remain unchanged.

## Verification

The accounting browser harness renders the actual dashboard, report shell, cash-flow report, statement page, history page, navigation, styles and HTTP helpers with synthetic transport. It covers reporting warnings, numeric alignment, visible headings, print controls, existing inline classification, supplier UUIDs, history filters/paging, recoverable dashboard errors, navigation destinations, mobile width and larger application text. Desktop and mobile screenshots are saved under `tmp/accounting-ui-*`.

Full frontend TypeScript verification uses `tsc --noEmit --incremental false`, with results in `tmp/accounting-ui-types-final-2026-10-28.log`. No live financial records were modified during these checks.

Final result: all 12 browser checks passed, the full frontend TypeScript check exited successfully, and the changed accounting frontend files passed the whitespace/error diff check. Screenshot review included desktop and mobile with the application base text increased to 20px.
