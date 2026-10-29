# Payroll UI/UX and functional audit — 29 October 2026

## Scope and evidence limits

Inventory: 39 payroll route pages, their layout/navigation and shared payroll components.
The inventory and shared styling review cover every listed route. Detailed source review
and browser tests focus on the critical setup, compensation, processing and payment paths.
This is not a claim that every possible live-data state on all 39 pages was exercised.
No live payroll, compensation dates, approvals or payments were changed by testing.
Security findings are owned by the separate managed Codex Security scan, not this document.

## UI/UX findings and changes

| Finding | Resolution |
|---|---|
| Hard-coded orange primary accents across payroll conflicted with the application theme | Use application primary variable; preserve semantic status/chart colors |
| Excessive bold text and inconsistent control typography | Payroll-scoped inherited font, moderate heading weights, tabular financial figures and keyboard focus outlines |
| Mobile page headers and controls crowded the viewport | Wrap toolbar actions, reduce mobile page padding and keep wide data inside local table scroll areas |
| Failed dashboard request looked like a zero-value payroll | Explicit unavailable totals and retry; no false zero summary |
| Setup links buried and duplicate getting-started guidance | One preparation section linking statutory setup, templates, compensation and periods |
| Compensation load/delete failures had no useful visible outcome | Error/retry and inline action feedback |
| Compensation export was a placeholder | Export all filtered records as CSV, without bank details; quote values and neutralize formula prefixes |
| Compensation displayed both record currency and an unrelated formatter currency | Format with the record's own currency |
| Blocking browser alerts on principal management forms | Accessible inline success/error feedback; failed form data retained |
| Active compensation, history and YTD failures resembled empty lists | Distinct failure state and retry |
| Payroll Settings and Employee Payroll parent destinations did not exist | Remove obsolete Settings entry; point Employee Payroll to history in both navigation definitions |
| Payment dialog closed even when payment failed | Close only on success; retain fields and display feedback inside the dialog |
| Payment dialog lacked focus management | Use the existing Bootstrap modal implementation with dialog semantics, focus trapping and Escape handling |
| Processing eligibility only became clear after an error | Explain complete-period compensation coverage before submission; name failed employees and link compensation |
| Search-filter select-all dropped other selected employees | Preserve selection outside the visible filter |
| Unpaid history rows rendered invalid payment dates | Show Not paid; empty pagination starts at zero |
| Analytics accepted invalid date ranges | Reject missing/reversed dates before request |

Browser verification (actual components; all API writes intercepted):
- Overview unavailable/retry, desktop and 390px mobile layout.
- Compensation filtering, numeric database active status, per-record USD display and CSV download.
- Active compensation, history and YTD failure/retry.
- Compensation failed-save field preservation and inline feedback.
- Payment rejection retains the method, keeps review open and permits Escape after completion.
- Existing salary template reuse, bank/date preservation, archival and role gating.
- Ghana setup wizard, tax configuration linkage, profile edits, stale requests and existing role gating.
- Processing plain-text failure, failed selection retention, period switching and success navigation.

Follow-up UX work remains: replace raw employee-ID entry on the YTD landing page with
an employee finder; improve the two older history breakdown dialogs' keyboard behavior;
review every form with representative production data, screen readers and tenant themes.
These are not covered by the passing critical-path browser checks.

## Functional findings and changes

| Finding | Resolution / status |
|---|---|
| Hourly pay counted overtime both in total hours and overtime earnings | Subtract overtime from regular hours before applying the overtime multiplier |
| Unapproved overtime was included in payroll summaries | Separate ordinary hours from approved overtime; pending overtime is excluded from payroll overtime |
| Half-day summary compared half-day rather than stored half_day | Correct stored-status comparison |
| Legacy deductions could exceed gross pay | Reject negative net pay with correction guidance, as the Ghana path already does |
| Recalculation returned success even with employee errors | Reuse structured success/partial/error outcome; show failed employees in review |
| YTD response fields did not match the report and pension totals were constant zero | Build compatible totals and period rows from paid transaction snapshots; preserve legacy ytd_* aliases |
| Employer contributions appeared in the employee deduction total | Exclude employer contribution from that display; reconcile gross less employee deductions to net |
| Employee history discarded backend record totals | Add pagination metadata without changing result-array contract; consume total in both history pages |

YTD pension mapping uses the existing Ghana transaction snapshot parser. Historical legacy
pension definitions with no explicit employee/employer mapping still need a reviewed mapping;
this audit does not infer or rewrite their allocation.

Remaining functional gaps (not implemented or represented as safe to use):
- Commission and hybrid commission earnings still contain placeholder zero calculations.
  They need an agreed earned-commission source, approval/period rules and reversals.
- Recalculation/reversion after approval needs end-to-end accounting reversal/reposting
  verification; do not treat the existing action as proof of corrected ledger balances.
- days_leave remains a zero placeholder in calculation; absence/leave proration requires
  an explicit salary policy and tests before changing salaried payroll behavior.
- Ghana preset support remains limited to its verified dates and supported compensation
  types; no tax rates or statutory eligibility checks were weakened in this audit.
- MySQL concurrent approval/payment tests are still needed; SQLite regression tests do
  not establish production row-lock behavior.

## Verification

- Frontend full type check passed after the UI and report-contract changes.
- Backend build passed after functional changes.
- 38 targeted calculation/reporting tests passed (including Ghana statutory tests).
- Full suite passed 2,953 tests before the final two YTD regression tests were added.
  The first concurrent run timed out in an unrelated catalog-parser test; the repeat
  with --maxWorkers=2 passed. A final complete repeat should include the YTD tests.

## Route inventory

- `allowance/page.tsx`
- `analytics/page.tsx`
- `attendance/[id]/edit/page.tsx`
- `attendance/[id]/page.tsx`
- `attendance/create/page.tsx`
- `attendance/page.tsx`
- `attendance/summary/page.tsx`
- `bonuses/page.tsx`
- `compensation/[id]/edit/page.tsx`
- `compensation/[id]/page.tsx`
- `compensation/active/page.tsx`
- `compensation/create/page.tsx`
- `compensation/page.tsx`
- `deduction-definitions/page.tsx`
- `deductions/other/page.tsx`
- `employee/[id]/page.tsx`
- `employee/history/[employeeid]/page.tsx`
- `employee/history/page.tsx`
- `employee/ytd/page.tsx`
- `ghana-setup/page.tsx`
- `leave/page.tsx`
- `page.tsx`
- `periods/[id]/page.tsx`
- `periods/create/page.tsx`
- `periods/page.tsx`
- `periods/process/page.tsx`
- `periods/reverse-payrol-payments/page.tsx`
- `salary-grades/[id]/edit/page.tsx`
- `salary-grades/[id]/page.tsx`
- `salary-grades/create/page.tsx`
- `salary-grades/page.tsx`
- `salary-templates/page.tsx`
- `tax-configurations/[id]/audit/page.tsx`
- `tax-configurations/[id]/edit/page.tsx`
- `tax-configurations/[id]/page.tsx`
- `tax-configurations/[id]/reliefs/create/page.tsx`
- `tax-configurations/create/page.tsx`
- `tax-configurations/page.tsx`
- `tax-reliefs/page.tsx`


## UI redesign after visual review

The overview, periods and compensation lists were rebuilt with a dedicated
PayrollDashboard.module.css, using the same --pls-primary theme variables as billing
strategy. This replaces the earlier generic card presentation.

- Overview: compact joined summary, date range, actual gross/net bar chart, latest
  payroll workflow, recent-period table and compact tool links. Charts have an
  accessible data table and explicit loading/empty/error states. No sample data is
  added to the product; fixture data appears only in isolated tests/screenshots.
- Periods: one compact financial table with search by name/ID, status filter,
  workflow counts and clear Review actions. Draft deletion uses a keyboard-accessible
  confirmation retaining the selected period name through its exit animation.
- Compensation: seven grouped columns replace eleven separate columns. Employee ID,
  salary level/frequency and effective end date appear as secondary information;
  View/Edit are named buttons; payment accounts are masked in the list.
- Desktop and 390px mobile screenshots were inspected. First-paint chart animation
  and closing-dialog text flicker were corrected after inspection.
- Staff history now requests the authenticated employee's own records unless the
  role has existing admin/accountant/superadmin finance authority.

Final test counts and security remediation details are recorded in the implementation
summary. This document does not assert that the remaining commission, post-approval
reposting or production concurrency gaps have been resolved.


## Final checks after the redesign and authorization fixes

- Full backend suite: 266 files / **2,985 tests passed** (`npx vitest run --maxWorkers=2`).
- Backend build and full frontend type check passed.
- Actual-component browser checks passed for the redesigned screens, filters,
  export, populated charts, own-history routing, retry and payment failure recovery.
- 68 focused finance/identity boundary and existing configuration permission tests passed.
- No live payroll, compensation or payments were changed by tests.

## Continued functional audit — 29 October 2026

Confirmed and corrected in this pass:

- All payroll calculations resolve compensation against the requested period rather than today's active rate. A newer effective term within the period blocks a silent full-period calculation at the old rate; no new proration policy is introduced.
- Payroll processing no longer uses the first ten current compensation rows to choose employees. The existing authorized compensation endpoint accepts a payroll-period query and returns distinct candidates whose compensation overlaps that period. Full-period validation remains in calculation.
- Final balance-backed deductions are capped at the remaining balance; zero balances are omitted. Deductions without a balance keep their configured amount. Calculation does not mutate balances; the existing payment workflow applies them.
- Failed whole-period recalculation now persists draft, matching its response. Workflow transitions lock the payroll-period row to serialize against processing/payment requests.
- Attendance rejects overtime greater than supplied worked hours and absent records containing worked hours; zero hours remain zero when reading records.
- Tax configuration create/edit now use a main editor and live review panel, clearer bounds headings, and the shared save footer. YTD uses the compact shared summary, with the accurate label 'Average net per period'.

Remaining limits requiring explicit policy/integration work: automatic mid-period salary proration, commission/hybrid earnings integration, and post-approval accounting reversal/reposting. Existing compensation records that were deactivated without end dates are not automatically rewritten. Production MySQL contention is not proven by the isolated SQL regression tests.

No permission middleware or role list was changed in this pass. Browser writes are intercepted; SQL fixtures are disposable and use no production connection.
