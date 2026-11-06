# Software critique — 6 November 2026

## Assessment and limits

PLS has substantial integrated capability, but its maturity varies by workflow. The priority is consistent behavior, operational visibility and acceptance evidence across the existing modules. This review sampled current implementation, configuration, CI, prior verified walkthroughs and their outstanding items. It is not a fresh full-system browser test, a security penetration test or a production load test. No business records, permissions, settings or workflows were changed. Earlier October audit findings are not assumed to remain open.

## Strengths established by current evidence

- Frontend CI runs full type checks, security-focused lint/type checks, tests and a production build. Next.js no longer ignores TypeScript build failures.
- The most recent recorded full frontend run passed 1,144 tests. That is a historical run, not a new execution during this critique.
- Funded inventory/payroll payments use shared funding controls, account authority and committed-payment accounting. Departmental stock separates issue, receipt and consumption.
- The fictional amended result retained revision history and required revalidation even with initial validation bypass configured.
- The training manual now distinguishes actual checks from unverified instructions rather than presenting every procedure as live accepted.

## Findings and improvement priorities

### 1. High priority: close workflow acceptance gaps before declaring completion

The 6 November walkthrough report still records final reapproval and refresh verification of the paid-service projection as pending, together with the current-facility inventory walkthrough. Prior GMS stock tests are useful evidence, but are not equivalent to a new TAMALE GENESIS acceptance run. Admin testing also does not establish denial behavior for every restricted role.

Action: maintain a release acceptance matrix for facility/branch/role/action, with successful transitions, denied transitions, retries and audit evidence. Complete result amendment/reapproval/printing and stock approval/issue/short receipt/consumption against named fictional records. Preserve PINs, limits and reviewer independence. The browser permission failure is a testing-tool limitation, not a demonstrated application defect.

Evidence: docs/reviews/manual-training-walkthrough-2026-11-06.md; docs/reviews/manual-training-walkthrough-2026-11-05.md.

### 2. Confirmed: validation displays missing timestamps as Invalid date

AsensionValidationTable.jsx formats nullable processing and result timestamps directly with moment(...).format('LLLL'). A local execution using the installed library returned Invalid date for null. Processing can legitimately be bypassed, so this presents valid configuration as corrupt data.

Action: use a shared stage/date presentation contract that distinguishes Bypassed, Not started, In progress, Complete and Unavailable. Preserve the underlying timestamps; never invent dates for bypassed steps.

Evidence: frontend components/operations/Laboratory/AsensionValidationTable.jsx:147,150,173,176.

### 3. Medium: type checking is incomplete across legacy boundaries

The backend base tsconfig does not enable strict checking. Frontend strict mode is enabled, but allowJs is true and checkJs is not enabled; this is not comprehensive strict validation of legacy JavaScript. The large legacy operations model also relies on many any values. A passing TypeScript command therefore establishes less than fully typed request/response contracts.

Action: introduce typed DTOs and runtime validation first at session, tenant, money and clinical-result boundaries. Migrate a module at a time; do not bulk-toggle strict flags and suppress errors with casts.

Evidence: backend tsconfig.json; frontend tsconfig.json; src/models/operations/operations.ts.

### 4. Medium: large mixed-purpose components make UI improvements fragile

The inventory order page is 2,207 lines and the multi-billing layout 1,365 lines. These are change-cost indicators, not defects by line count alone. Combining fetching, calculations, form state, dialogs and presentation increases the number of behaviors a visual change can affect. Accounting already has dedicated table and report primitives, while legacy operation screens still define their own representations.

Action: extract tested workflow/state logic before redesigning screens. Reuse foundational controls for money, dates, filters, tables, actions and load states. Keep section-specific layouts: clinical queues, cash collection and accounting reports have different user tasks.

Evidence: frontend app/inventory/orders/page.tsx; components/Billing/Multi/MultBillingLayout.tsx; components/accounting/AccountingTable.tsx; components/operations/Laboratory/AsensionValidationTable.jsx.

### 5. Medium: funding checks have a scaling risk

fundingAvailability loads all journal lines for the funding account and all unposted outbox rows, then performs an additional journal lookup for relevant pending rows. Under a large history/backlog this can increase query volume and extend payment-lock duration. This is a code-level scaling concern; no production slowdown or numerical error was reproduced.

Action: use SQL aggregation, narrowly indexed outbox lookups and batch existence checks. Measure realistic history and backlog sizes, concurrent payment attempts and latency while preserving the shared-GL lock, reservation semantics and duplicate-posting protection.

Evidence: src/models/Expenses/FundingAvailability.ts.

### 6. Medium: departmental stock traceability stops at the item level

The implemented custody documentation explicitly states that batch-specific departmental allocation is absent. Requisition grouping called a batch must not be confused with manufacturer lot/expiry traceability. Item totals can reconcile while a department's specific lot cannot be identified.

Action: if lot recall/expiry accountability is required, carry lot IDs and expiry through issue, receipt, consumption, waste and return. Add this as an explicit extension rather than claiming that existing aggregate custody supplies lot traceability.

Evidence: docs/funded-payments-and-department-stock.md; src/models/inventory/DepartmentStock.ts.

### 7. Operational concern: accounting degradation needs a visible support workflow

Normal startup may continue after accounting bootstrap failure; strict startup throws. Background worker startup failures are also caught and logged. Isolation can preserve non-financial services, but an operator needs clear module readiness and recovery evidence. The inspected catch blocks establish logging, not the completeness or absence of every health surface.

Action: verify tenant-specific accounting readiness, worker heartbeat, posting backlog/age and reconciliation controls are visible to authorized staff. Distinguish degraded accounting from a healthy zero-balance report. Run failure/recovery acceptance tests before claiming operational completeness.

Evidence: src/bootstrap/applicationStartup.ts:134-158.

### 8. Documentation depth and verification are still uneven

The manual contains 65 procedures but only five enhanced pilots. The result-entry pilot explicitly marks final reapproval pending; inventory receipt remains source-reviewed in the current pilot metadata. Page count is not a completion criterion.

Action: finish CRM/registration and billing as complete staff journeys, then laboratory, then inventory. Each procedure needs exact controls, prerequisites, real sanitized screenshots, an example, verification, recovery and permission behavior. Keep website reference images labelled separately from current live captures.

Evidence: frontend lib/workspaceLearning.ts; docs/reviews/manual-pilot-verification-2026-11-05.json.

## Recommended sequence

1. Finish outstanding clinical/payment/stock acceptance and restricted-role negative tests.
2. Correct misleading stage, loading, unavailable and failure displays.
3. Make accounting readiness and reconciliation visible and actionable.
4. Consolidate UI primitives and typed API contracts incrementally.
5. Load-test and optimize funding checks without weakening locking.
6. Add lot-level custody if required, and complete manuals module by module.

Avoid another broad visual reskin until these outcomes are verified. Do not revive old claims that the frontend has 86 failures, ignores build errors or lacks funded-payment controls: current evidence supersedes those earlier findings.
