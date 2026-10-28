# Daily sales analytics overlay — 28 October 2026

## Final presentation

The original daily-sales summary, date controls, transaction table and separate BreakDown report remain. View chart breakdown sits in the top toolbar alongside the existing sales report action. An analytics overlay opens automatically when the applied branch/period loads, and can be closed or reopened.

The overlay uses a Google Analytics-style overview: a compact date header, prominent metric totals, consistent chart cards and a date trend. It inherits the company theme and application font. The former inline introduction, tab strip and additional breakdown tables have been removed.

Every authorized category has a chart by default: Collections, Cashiers, Billing sources, Bills, Services, Departments, Outstanding and Expenses. Collections and Bills use donut charts. All other categories use horizontal SVG bar charts with a shared monetary axis, exact values, keyboard selections, long-label wrapping and an option to show more than the leading eight groups. Single-day billed/received comparisons use columns; multiple dates use lines. Empty and failed data have explicit states.

Selecting a bill-related chart group closes the overlay and filters the original transaction table. Show all transactions resets it. Expense bars remain in the overlay and do not filter unrelated bills. No extra data list or tabbed breakdown is inserted into the page. Existing receipt, correction, update, settlement, billing-detail and per-bill test actions remain. Menus use the established portal component so filtered one-row tables do not clip them.

## Data and access

The existing sales report endpoint is reused with optional inlineDetails=true, adding cashier names and active service-line detail inside the same read snapshot. Ordinary report/PDF requests retain the existing response shape. Its signed-session tenant, branch checks and role guards are unchanged. Cashiers use existing bill data and retain today-only restrictions. Existing manager/report access and admin/accountant expense-metric visibility remain.

Collections use actual receipt/refund dates, include older bills and respect organization invoice payment dates. They are not inferred from cumulative bill-paid amounts. Billing sources use registration types, not clinical categories. Mixed-source bills remain a group without arbitrary splitting. Monetary grouping uses integer cents; service quantities are counts of service lines on bills created during the applied period. Expenses are payments rather than profit.

The legacy daily-sales bill/service query and summary CTEs now filter the selected branch. Refunds aggregate by service before joining, avoiding duplicate totals and retaining services with no refunds. Expense details use payment dates and the owning branch. Registered-patient counts are distinct registrations during the period associated with a bill at the branch; an unknown registration-location column is not assumed. Legacy labels distinguish paid amounts on selected services from receipts received during the period.

## Verification

- Backend build and 285 financial/payment/expense/sales-report/authorization regression tests passed across 25 files for the data changes.
- The grouping check covers exact cents, older-bill receipts/refunds, service counts, statuses, payer sources, outstanding grouping and empty data.
- The latest browser checks exercise all eight chart cards, SVG bars for Outstanding and Expenses, absence of the removed intro/tab list, chart-to-transaction filtering, existing bill actions, mobile/larger text, overlay close/reopen, permissions and retry states.
- Full frontend type check passed. Desktop/mobile captures were inspected.

Browser transport and report fixtures are synthetic; no live tenant records were changed. Production MySQL reconciliation and deployment were not performed. No schema migration, payment write path or authority grant is added.

Design references:
- https://support.google.com/analytics/answer/13818312?hl=en
- https://www.globalassignmenthelp.com/images/GAH/2025/6.Revenue_dashboard_for_Quick_Books_in_Power_BI.jpg

## Table presentation restored

At the user’s request, BilledClientsView.tsx was restored exactly to its original tracked version and the added table stylesheet removed. The ledger, font, merged-column and compact-menu experiments are reverted. Sales analytics overlay, chart grouping/filtering and prior branch/report accuracy work remain.

## Excel worksheet presentation
The original billed-client columns, actions and billing calculations are retained. A scoped worksheet stylesheet adds compact Calibri/Aptos text, neutral gridlines, shaded green headers and right-aligned monetary columns. Browser smoke checks verify the original columns, computed worksheet font and numeric alignment, chart filtering, test expansion and role visibility. The rendered desktop screenshot was reviewed using synthetic data.

## Compact worksheet and dropdown verification
All original columns remain visible using a fixed proportional table layout, compact padding and wrapped names/identifiers. Action menus use the existing body portal to avoid clipping within the table container. Edge checks with synthetic transport passed at widths 768, 1024, 1280 and 1440 without table horizontal overflow. Single-row and multiple-row checks exercised View More, Update Transaction, Correct Billing Source, receipt destinations (navigation intercepted), transaction details, settlement navigation, void confirmation (cancelled), and keyboard opening/Escape. Frontend full type check passed. No billing calculations, write endpoints or authorization rules changed.

## Accounting presentation follow-up
Billing now uses the shared AccountingTableSurface from AccountingTable.tsx, retaining existing native row expansion and billing actions. This shares the accounting typography, header and horizontal-rule styling without replacing workflows with new pagination. Pending rows are explicitly shaded red and partial rows amber. Overlay menus remain portalled above the table. Browser checks passed for the shared surface, status background, column fit from 768–1440px, single/multiple-row actions and role visibility.

## Bill actions and test breakdown overlay
Critique found that inline test expansion, separate action menus, very small text and the red first-day marker made the ledger hard to scan. The financial ledger now uses the shared accounting surface with inherited application font, accounting weights and a .9rem desktop body size. The date is split into readable date/time lines. Pending/unpaid bills use amber and partial bills pale blue, with readable payment-status text; voided bills do not receive payment-warning shading. Every original column remains present, with compact proportional sizing and a collapsed column guide. Long names/identifiers have two-line previews with full hover text and full details in the bill overlay.

Each row has one accessible action trigger opening a Bootstrap dialog. The dialog holds client identity, payment summary, test breakdown and all existing actions. Existing action callbacks and destinations are reused; the prior overlay closes before opening a follow-up workflow. Test breakdown is no longer rendered inside the ledger. Amounts use the same GHS currency formatter as accounting, including currency labels, grouping and decimals. API failures show an accessible error and Retry, distinct from a genuinely empty breakdown.

Final browser smoke checks with synthetic transport passed: column fit at 768/1024/1280/1440px, accounting surface, distinct pending/partial colors, currency values, single/multiple-row overlays, action modals, navigation, receipt destinations, cancelled void confirmation, keyboard entry/Escape, breakdown retry/empty states and existing role visibility. Desktop ledger and overlay screenshots were reviewed. Full frontend type check passed. No authorization or billing-calculation changes were made; no live financial writes were performed.

## Actual accounting table component and compact grouped actions
The previous implementation reused AccountingTableSurface around a native ledger, rather than AccountingTable itself. That mismatch is corrected: both billed clients and the overlay test breakdown now render AccountingTable, sharing the accounting section's real search/sort/density controls and typography. The ledger retains every original column and local row-status colors. The existing PrimeTable rowStyling prop receives a JSDoc type annotation (no runtime change). Search matches both the client name and full patient identifier.

Overlay critique: a flat eight-action list was too tall, mixed money actions with corrections, and left the test table visually secondary. Actions are now compact two-column groups: Payment & receipts, Change bill, Review, and a distinct Void bill section. Identity and payment summary use less vertical space. The test breakdown uses the accounting table with named columns and a separate active-test total strip. Existing callbacks, reason selection, destinations, confirmation and auth headers remain unchanged.

Validation: the final browser suite passed actual accounting search by patient ID, numeric sorting, density toggles, all 16 visible columns with no horizontal scroll at 768/1024/1280/1440px, paid/unpaid and one/many-row overlays, all follow-up action modals, add-test reason continuation parameters, cancelled and confirmed void, authenticated void request payload and table refresh, actual A4 receipt renderer/browser print invocation, actual thermal POS PDF generation and printed-status update, error/retry/empty breakdown states, keyboard behavior and existing role visibility. Requests used synthetic transport; no live financial writes or physical printer tests were performed. The existing cashier browser suite passed all 18 checks, including actual payment controls, allocations, receipt reprinting and retry idempotency. Screenshots of the final ledger and overlay were reviewed. Add-test coverage verifies continuation into the existing add-service workflow, not a live database insertion.

## Final user-requested restoration and manual charts
The billed-client redesign is reverted completely. BilledClientsView.tsx is byte-for-byte equal to its tracked HEAD version, restoring the original columns, fonts, amounts, dropdown actions and inline View Tests breakdown. The added BilledClientsExcel.module.css is removed. AccountingTable.tsx and the PrimeTable row-styling type edit introduced for the redesign are also restored exactly; unrelated report and backend work remains.

Sales chart overlay state now starts false. Branch/date changes close it rather than opening it; the View chart breakdown button is the only path setting it true. Browser checks passed for original columns, inline tests, dropdown/details/update flows, receipt destinations, explicit chart opening/closing/filtering, reload/date navigation without automatic chart opening, and admin/cashier/manager/accountant chart visibility. No browser runtime errors were observed.

## Final native table based on the supplied image
The final user instruction explicitly superseded the temporary PrimeTable request: use the table in the image, not PrimeTable. BilledClientsView now renders a native table with white rows, subtle horizontal dividers, a plain divided header, compact inherited application typography and proportional columns. Payment statuses have small highlights rather than whole-row fills. Original dropdown actions and inline test expansion are retained; fixed-position menu placement keeps them outside table clipping. No shared PrimeTable implementation changes remain.

BID and separate Billed By columns are removed. The employee is shown beneath the date without the billing-source label. Financial cells use the existing application GHS formatter with grouped currency/number spans to avoid splitting decimal places unnecessarily. All matching records render without pagination. Local search matches client name, full/numeric patient ID, bill ID and billed-by name. Payment and transaction status selectors, clear filters, match count and empty results are included. Charts remain button-only.

Font choices now clearly identify the already-loaded Lato (Slack), and add Avenir Next (QuickBooks style) and Zoho Puvi. The latter two use installed fonts, falling back to loaded Nunito Sans and Inter respectively; their availability notes are visible in both font settings surfaces. No proprietary font files were downloaded or embedded. Legacy font-name aliases remain valid. Font selection persists after reload and takes precedence over Slack workspace defaults. The font picker scrolls within the viewport.

Browser checks passed for native rendering with no PrimeTable controls/pagination, every retained column, currency values, original actions and inline tests, patient/bill/status searches and empty/clear states, chart manual opening/filtering and role visibility. Main table, expanded tests and action menus fit at 768/1024/1280/1440px. Font-choice application, persistence and alias compatibility passed in the actual FontSelector. Full frontend type check passed. Final rendered screenshots were reviewed against the supplied reference. Synthetic transport was used; financial workflows and authorization were not changed.

## Fixed identity columns and single-line currency
At the user's request, Date and Client Name are now sticky on the left (180px/240px). Remaining columns scroll horizontally within the labelled table region; the page itself does not scroll horizontally. Currency cells render the complete application-formatted amount as one non-wrapping text run, replacing the split symbol/value flex layout. Filters, all existing actions and inline test breakdown remain.

Browser checks passed at 768/1024/1280/1440px: date/name positions remain unchanged during scrolling, monetary columns move by the actual scroll distance, monetary labels occupy one line, actions work after scrolling to the right, and there is no horizontal page overflow. Existing filter/chart/font checks also passed. The rendered screenshot was reviewed.

## Outstanding rows, status colors, full sticky headings and activity counts
Danger row shading now depends only on a finite outstanding amount greater than zero, including the sticky date/name cells. Zero-balance rows are not danger-shaded. Payment Status cells independently use green for paid, amber for partial, red for pending/unpaid, and neutral for voided/other values. This corrects the earlier interpretation that colored the Outstanding column itself.

All abbreviated headers are replaced with full labels and the redundant abbreviation legend is removed. Column widths are expanded within the existing horizontally scrolling region, headings do not wrap, and the header row is sticky while vertically scrolling the bounded table area. Date and Client Name remain horizontally frozen; corner headings stay above body cells. Transaction/Billing/Patient counts use separate compact definition-list summaries with clear labels and larger numeric values, preserving their existing data sources.

Browser checks passed for full one-line sticky headings, vertical header retention, fixed identity columns, horizontal scrolling and currency values, positive-outstanding row rules, distinct paid/partial/pending backgrounds, activity counts, filters, original actions and chart/font behavior. Rendered desktop screenshot was reviewed.

## Page-level sticky headers without a table height limit
Horizontal overflow prevents native CSS sticky headings from following page scrolling. A scoped usePageStickyTableHeader hook now mirrors the read-only heading outside that overflow container, synchronizes its horizontal offset and column widths, and keeps Date/Client Name frozen in both header and body. The mirror is aria-hidden and non-interactive; the original table retains semantic headers. It accounts for visible application headers and vertically scrolling main-content panels, updates on resizing, hides before the table and after its end, and cleans up listeners/observers on unmount. No maximum table height or internal vertical scrolling is added.

Browser checks passed with 63 rendered rows (over 3,000px table height): page scrolling pins the heading, horizontal scroll keeps it aligned to body cells, the first two header cells remain frozen, a fixed 54px application bar is respected, a nested scrolling main panel also works, and the heading disappears after leaving the table. Prior action/filter/currency/status/chart/font checks also passed. The full frontend type check passed and the scrolled desktop screenshot was reviewed.

## View Tests offcanvas with the full previous-transaction workspace
View Tests now opens a right-side offcanvas for the selected bill instead of expanding a row. The previous-transaction page implementation was extracted intact into PreviousTransactionWorkspace.tsx, taking an explicit billing ID; the original route now passes its route ID to that same component. The offcanvas passes the clicked bill ID, re-keys on bill changes and lazy-loads the shared workspace. Existing service summary, service/tax details, refunds, refund details, witnesses, removals, write-off and configured online-payment UI are reused with the same endpoints, payloads and role/lock checks. The original transaction-details link remains available. Embedded-only CSS reduces spacing without changing the standalone page presentation.

Browser checks passed for selected-bill summary/service requests, offcanvas opening and closing, service/tax details, nested individual-refund/refund-all/write-off dialogs (opened and cancelled), standalone route rendering, and existing admin/manager versus cashier/accountant Refund All availability. Prior sticky header, frozen identity columns, native table filters/status/currency, manual charts and font persistence checks also passed. The offcanvas screenshot was reviewed. Financial mutations were not submitted to a live database.

## Offcanvas service table aligned with the main native table
Embedded previous-transaction services now reuse BilledClientsLayout's actual native-table styles: same typography, light dividers, full one-line headings, uppercase blue identity columns, right-aligned non-wrapping currency, danger rows for positive outstanding and independent payment-status cell colors. Date Added and Service Name are frozen horizontally; service ID is beneath the name. The abbreviated legend is hidden in embedded mode. Embedded-only columns include Payment Status; all existing service fields/actions remain available. Organization/clinician/adjustment/actions columns receive suitable widths inside the scrolling table. The standalone page's prior table presentation and every action handler/authorization condition are preserved.

The page-sticky header hook accepts an optional layer so embedded service headers can remain visible above the offcanvas body, below nested modal backdrops. Browser checks passed with 24 services for vertical header retention, synchronized horizontal scrolling, positive-outstanding danger styling, distinct partial-payment shading and header cleanup on close. Full headers, frozen date/service columns, nested tax/refund/write-off dialogs, standalone route and role restrictions also passed, alongside prior main-table regressions. Screenshots were reviewed. Full frontend type check passed; no live financial writes were performed.
