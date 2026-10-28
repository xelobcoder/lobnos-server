# Accounting reports, planning and dashboard review — 28 October 2026

## References and comparison

Reviewed the signed-in Zoho Books reports centre, cash-flow forecast and recurring profile screens without changing live records. Also inspected the supplied Intuit dashboard image and the supplied 2026 QuickBooks dashboard image. Some other image hosts did not load; the implementation does not depend on them.

The useful differences were a searchable report directory, prominent receivable/payable balances, separate planning tools, explicit forecast assumptions, and charts with axes, legends and report links. PrimeLabSys previously presented the monthly trend as separate miniature progress bars and lacked native budget and recurrence records.

Sources:
- https://www.zoho.com/us/books/help/accountant/budgets.html
- https://www.zoho.com/ca/books/help/reports/business-overview.html
- https://www.zoho.com/ca/books/help/expense/other-actions.html
- https://www.zoho.com/in/books/kb/reports/detailed-general-ledger.html
- https://www.ifrs.org/issued-standards/list-of-standards/ias-7-statement-of-cash-flows/
- https://plugin.intuitcdn.net/qbo-native-dwn-ui/c5d72e7453685ab4.png

## Implemented

- Reports centre with search and real destinations, plus sidebar and workspace navigation for all 34 standalone accounting pages.
- Dashboard grouped balances and actions; monthly revenue/expense columns; selectable profit line with losses; keyboard inspection; exact monthly data table; expense mix with account drill-through. Negative expense balances remain visible instead of being forced into positive pie shares. Period gaps in actual monthly data are filled with zero months.
- Branch-specific calendar-year budgets with twelve monthly income/expense targets, exact money validation, optimistic versions, immutable audit history and posted actual comparisons. Actual accounts without targets remain visible in comparisons and are not silently inserted into edited budgets. Closing transfers are excluded from earned-income comparisons.
- Recurring expenses with anchored daily/weekly/monthly/yearly dates, pause/resume from today, generation history and failure messages. January 31 schedules return to March 31 after February. Occurrences are uniquely claimed and generated using the existing expense creation transaction. They enter pending approval; there is no automatic approval, payment or journal posting. The worker rechecks the locked profile owner and current creation authority. Closed periods/days remain protected.
- Bills page reuses the existing invoice component, visibility restrictions, detail view and payment workflow. No new parallel bills ledger was introduced.
- Rolling cash forecast from today's posted branch cash, unpaid vendor bills, optional recurring estimates, explicit receivable collection percentage/delay and temporary what-if movements. Collections default to zero. Completed non-reversed payments reduce bills; recurring items already invoiced are not counted again. Missing due dates and unresolved postings are disclosed. Forecasts never write actual financial entries.
- General ledger account summary with opening balance, period debit/credit totals, normal side and closing balance. Account buttons retain period/module filters when opening the existing transaction list. Transaction and summary views remain available.
- Indirect cash-flow presentation alongside the existing direct method. Shows net income, depreciation/non-cash adjustments, working capital, source journal reclassifications, operating/investing/financing totals, beginning/net-change/ending cash. Reclassifications are calculated per source journal and disclosed; they do not amend journals. Compound cash journals spanning different activity classes require existing reviewed classification rather than an inferred cash split. Both methods use identical posted opening/closing cash and retain reconciliation errors.
- Income statement and expense analysis accept the period passed by chart links. No new roles or authority grants were added.

## Validation

- Backend TypeScript build and full frontend TypeScript check passed.
- 226 accounting/payment/expense/authorization regression tests passed across 22 files; latest focused rerun: 47 report/planning tests passed after recurrence authority and monthly-gap refinements.
- Real Knex/SQL fixtures cover exact cents, historical balances, budget versions and branch scope, month ends, duplicate recurring generation, revoked schedule authority, closed days/periods, partial bills, forecast double counting, zero activity, indirect working capital/noncash asset purchases and reviewed disposal gains.
- Edge component-browser suites: 14 dashboard/report groups and 11 planning groups passed. Cover chart view switches, keyboard inspection, twelve-month losses, expense credits, zero activity, report search, budget save/conflict retention, read-only controls, recurrence pause/resume/history/generation, forecast assumptions/scenarios, ledger drill-through, indirect hierarchy, bill details and mobile/larger-text layouts.
- Navigation contract: 11 groups passed, including all 34 standalone pages and existing role boundaries.
- Screenshots visually reviewed; mobile forecast axis labels enlarged after review.

## Deployment scope and remaining differences

New planning tables are created by the existing tenant accounting bootstrap. Audit snapshots use LONGTEXT to retain complete monthly budget changes. This migration has not been exercised against the production MySQL database; fixture transactions do not prove production lock scheduling or live tenant reconciliation. No production data or Zoho records were modified.

This is not feature parity with all Zoho/QuickBooks products: budgets use calendar years, forecasts are rolling scenarios rather than a historical forecast engine, and there is no new multicurrency consolidation, bank-feed connection or cash-basis tax/report engine. Forecast amounts are estimates, kept separate from posted financial statements. The existing expense approval and payment requirements remain the final controls for recurring costs.

## Follow-up: company theme, accounting tables and forecast presentation

Accounting PrimeTable consumers now use an accounting presentation wrapper. The underlying filtering, sorting, server paging, custom action cells and full export source remain the existing PrimeTable implementation. The wrapper removes nested borders and rounded shells, aligns monetary columns, reduces header weight and row padding, and respects the active company accent/body colors. CSV download and content were exercised in Edge; single-row ledger and multi-row Chart of Accounts rendering were checked.

Dashboard changes include flat summary surfaces, removal of repeated daily metric cards (today remains available in the performance selector), a company snapshot for cash, net worth, profit margin and liabilities/assets, and account-category balance charts. All figures derive from existing statements. Ratios with no positive denominator show unavailable rather than a fabricated zero. Negative cash and net assets are explicit. Chart of Accounts is a new read-only page with balance-date, category, status and search filters; all 35 standalone accounting destinations are covered by the navigation contract.

The user-supplied Coupler reference (https://static.coupler.io/templates/quickbooks-financial-dashboard.png) informed the flatter comparison layout. Forecast controls are compact, four cash measures have clear actual/projected labels, and balance and receipts/payments charts appear beside each other on wide screens. A compact outlook shows the lowest balance, net movement and first shortfall. Exact balances support keyboard inspection; grouped chart totals and source data remain available. Changed/unapplied inputs disable report export until recalculated.

A source aggregation correction preserves gross receipts and payments for opposite-direction scenarios on the same date. Scenario descriptions remain distinct. The new period movement chart aggregates exact minor units from the daily projection, so it reconciles to forecast totals without treating net movements as gross cash flows.

Validation after these additions: 228 backend regression tests across 22 files passed; backend build passed; full frontend type check and component-browser checks cover the accounting wrapper, filters, sorting, density, CSV content, company accent changes, category charts, negative balances, forecast point inspection, grouped totals, mobile layout and larger text. No production records or authorization rules were changed.
