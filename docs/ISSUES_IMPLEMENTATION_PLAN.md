# Implementation Plan: Issues 1-11

This document turns the requests in [`../issues.md`](../issues.md) into implementation tasks for the Prime Laboratory Software (PLS) backend backend and the sibling `lobnos` frontend. The frontend is located at `../../lobnos` relative to this document.

## Delivery Rules

- Implement tenant-aware backend validation and authorization; frontend-only restrictions do not count as enforcement.
- Keep billing, accounting, result-entry, and approval changes transactional and idempotent where they create financial or clinical records.
- Prefer the existing repository, service, controller, and bootstrapper patterns. Verify real database migrations/bootstrap schema before changing it; do not use `DatabaseTableSchema.ts` as schema authority.
- Preserve audit history for policy changes, approvals, financial postings, calculated results, QC bypasses, and other overrides.
- Add focused backend tests and frontend workflow tests for every user-visible behavior.
- Confirm the decision gates below before implementing behavior that changes financial or clinical policy.

## Current Status

| Issue | Status | Tracking note |
|---|---|---|
| 1. Referral code visibility | **Partial** | Tenant-scoped listing API and shared Settings/CRM page with search/copy are implemented. Registration attribution UI, management lifecycle, and full automated coverage remain. |
| 2. Commission recipient policy | **Implemented** | Facility setting, engine resolution, actual clinician organization lookup, and focused tests are implemented. |
| 3. Collections/refunds accounting | **Partial** | Outstanding collections, service refunds, full refunds, and transaction-management voids now write transactional, idempotent accounting outbox entries with cash/bank mapping. Billing-to-ledger reconciliation and frontend posting-error presentation remain. |
| 4. Historical sales permissions | **Not started** | Existing date queries need facility settings and server-side role enforcement. |
| 5. Expense create/approve/pay | **Implemented; follow-up remains** | Prompts, payment handoff, self-approval setting, and server enforcement are implemented. Browser workflow coverage and creator-versus-payer policy confirmation remain. |
| 6. Staff FOC accounting | **Partial** | Treatment is implemented as Staff Benefits Expense (`acc-5010`): approved FOC posts against patient receivables, reversals post the inverse, and actual cash paid remains separate. Accounting report presentation and full lifecycle/database coverage remain. |
| 7. Simple billing mode | **Partial** | Server capability detection and automatic General/Cash catalog-price mode when no effective strategy exists are implemented. Category-specific prices without strategies are not represented in the current schema and need a product/schema decision. |
| 8. Formula-based results | **Partial** | Versioned formula configuration, safe allowlisted evaluation, result-entry calculation, provenance audit, and frontend editor are implemented. Dependency recalculation, broader clinical/unit governance, clear calculated-result display on reports, and full acceptance coverage remain. |
| 9. QC enforcement | **Partial** | Per-test QC setting, result-entry gate, same-day acceptance, audited admin bypass, and configuration/session UI are implemented. Result-entry status/link UI, facility time-zone and device/level scope decisions, and full workflow coverage remain. |
| 10. Structured ultrasound reports | **Partial** | The original full-width markdown report remains unchanged and is the default. An opt-in structured form now covers early/first, second, and third trimester, postpartum, abdominal, abdominopelvic, renal, prostate, and other profiles; generated findings are editable in Markdown. Clinical-approved formulas/report wording and automated workflow coverage remain. |
| 11. Pending-result TAT overview | **Partial** | Cumulative 6/12/24/32/64-hour summary and paginated overdue list are implemented using the existing registration-to-result clock. Business-hour/time-zone policy, branch scoping, database-backed boundary/performance coverage, and operational sign-off remain. |
| Additional: suspend/resume billing and price quotes | **Implemented; browser test remains** | Separate branch-scoped draft storage, suspend/resume/cancel APIs, server-price reload on resume, patientless quote conversion, post-submit finalization, and focused validation tests are implemented. Browser end-to-end coverage and production bootstrap verification remain. |

## Decisions Required Before Build

| Decision | Affected issue | Required decision |
|---|---:|---|
| FOC accounting treatment | 6 | Choose the approved ledger treatment and accounts for waived staff-benefit value (for example staff-benefit expense or contra-revenue). Do not classify it as bad debt by default. |
| Commission recipient precedence | 2 | Implemented: for a clinician with an organization affiliation, the facility setting selects the effective recipient before recipient-specific assignments/defaults; clinician remains the backward-compatible default. Clinician-only and organization-only billing retain their existing recipient. |
| Collection and refund posting policy | 3 | Confirm payment-account mapping, treatment of partial refunds versus transaction voids, and which accounting date/source fields are authoritative. |
| Sales access roles | 4 | Confirm which roles may view historical summaries and which may apply date/other filters; define default settings for existing facilities. |
| Expense separation of duties | 5 | Confirm whether the self-approval setting applies to all authorized users or only admins, and whether creator/approver may also pay. |
| Simple billing mode | 7 | Define what counts as an active billing strategy and map each payment category to the existing billing source and price contract. |
| Formula governance | 8 | Define who may create/approve formulas, supported units/conversions, effective-date behavior, and when historical results may be recalculated. |
| QC acceptance and scope | 9 | Define accepted QC statuses, whether QC validity is per test, device, material/level, or a combination, facility working-day/time-zone boundaries, and bypass roles. |
| Ultrasound clinical content | 10 | Approve scan types, fields, units, calculations, reference tables, and generated report language with clinical stakeholders. |
| TAT clock and thresholds | 11 | Define clock start, calendar versus working hours, pause states, tenant time zone, and cumulative versus exclusive threshold counts. |

## Work Items

### 1. Referral Code Visibility and Management

**Existing foundation:** referral codes are generated during clinician/organization creation, and billing has a referral-code lookup path. A tenant-scoped paginated listing API and shared Settings/CRM management page are implemented.

- [x] Backend: add a tenant-scoped, paginated endpoint listing clinician and organization referral codes with recipient identity and code. The current schema has no active-state or referral-total fields, so the endpoint does not invent them.
- [ ] Backend: add authorized code-management actions only if the business permits activation, deactivation, or regeneration; preserve old-code attribution and audit every change.
- [ ] Backend: validate submitted referral codes and persist the resolved referring clinician/organization on the appropriate registration/billing record, rather than storing only the raw code.
- [x] Frontend: add a reusable referral-code page with search, copy/share action, and clear clinician-versus-organization identity; expose it from Settings and CRM/Billing navigation.
- [ ] Frontend: surface referral attribution in the relevant registration workflow and show validation errors for invalid or inactive codes.
- [ ] Tests: uniqueness, tenant isolation, inactive/unknown code handling, attribution persistence, and permission checks.

**Acceptance criteria:** authorized operational users can search and share existing clinician/organization codes through either Settings or CRM. Lifecycle management, registration attribution UI, and the tests listed above remain open.

### 2. Commission Assignment Configuration

**Existing foundation:** the commission engine supports clinician and organization recipients, with facility-level recipient policy now applied when a clinician has an organization affiliation. Commission defaults and assignments remain supported.

- [x] Backend: define and persist a facility-level recipient policy using the agreed precedence rule.
- [x] Backend: apply the policy before recipient-specific assignment/default resolution, using the clinician's stored organization affiliation when organization is selected.
- [x] Backend: preserve the resolved recipient type/id in commission tracking so later setting changes do not rewrite history.
- [x] Frontend: add the setting to Application Settings, with a clear clinician-versus-organization choice; protect writes with owner authorization.
- [x] Tests: cover clinician-only, organization-only, both policies for linked recipients, and actual clinician-affiliation precedence.

**Acceptance criteria:** the selected policy deterministically chooses the recipient for new commissions; existing commission records remain unchanged and auditable.

### 3. Accounting for Cash Collections, Outstanding Payments, and Refunds

**Existing foundation:** accounting posting helpers exist, but the collection/refund paths must be inventoried to ensure every relevant operation reaches them.

- [x] Backend: map outstanding cash collections, partial service refunds, full refunds, and admin transaction voids to their billing history and accounting posting calls; normal initial-payment posting remains in the existing bill-history repository.
- [x] Backend: enqueue collection, refund, and bill-receivable postings in the billing transaction; transactional outbox failures now abort the associated billing mutation.
- [x] Backend: use payment/refund history IDs as idempotency sources so retries cannot duplicate postings.
- [x] Backend: include branch, tenant, employee, billing, history, event-date, and cash/bank GL account dimensions on new collection/refund postings.
- [ ] Backend: reconcile billing paid/outstanding/refunded values against payment/refund history and accounting entries, and expose actionable mismatches.
- [ ] Frontend: show collection/refund completion and accounting-posting errors distinctly; do not report success where the financial transaction failed.
- [x] Tests: cover outstanding collection enqueue, collection date and cash/bank mapping, refund history idempotency, and transactional posting failures. Remaining: database-backed refund/void lifecycle and reconciliation coverage.

**Acceptance criteria:** core collection/refund mutations now enqueue exactly-once accounting records atomically. Full acceptance remains open until billing-to-ledger reconciliation and frontend workflow coverage are implemented.

### 4. Historical Sales Access and Filtering

**Existing foundation:** sales APIs support date filters, while selected summary routes and frontend views restrict non-admin roles to current-day data.

- [ ] Backend: add tenant/facility-level settings for summary visibility and historical filtering, with secure defaults for existing facilities.
- [ ] Backend: enforce permissions on every summary/detail endpoint and validate date/filter ranges server-side; do not rely on frontend role checks.
- [ ] Frontend: expose settings to authorized facility administrators.
- [ ] Frontend: remove unconditional today-only restriction when permissions allow historical access; independently enable/disable summary viewing and filters according to settings.
- [ ] Tests: role × setting matrix, direct API access, date boundaries, and default behavior for existing facilities.

**Acceptance criteria:** a permitted front-desk user can view/filter historical records; denied users cannot retrieve those records by calling the API directly.

### 5. Expense Create → Approve → Pay and Self-Approval

**Existing foundation:** backend expense workflow controls include self-approval and payer-separation fields; create, decision, and payment APIs are separate. The create flow now retains the expense ID and can continue through the existing approval and invoice-payment workflow.

- [x] Backend: approval enforces configured self-approval for single and bulk decisions; payment enforces the configured approver/payer separation and existing authority, audit, and idempotency rules.
- [x] Backend: single expense creation returns `expenseId` and `workflowStatus`, retaining the legacy `status` response field.
- [x] Frontend: after creation, prompt to approve; on approval, prompt to pay and open the existing payment flow targeted to that expense and its invoice.
- [x] Frontend: allow declining either prompt and report approval, invoice-generation, and payment errors without recreating the expense.
- [x] Frontend: expose expense controls from Application Settings for admins; backend binds control changes to the authenticated branch and validates boolean values.
- [x] Tests: backend tests cover self-approval enabled/disabled, approver/payer separation, rollback, and existing idempotent payment behavior.
- [ ] Follow-up: add automated browser coverage for the create-to-approval-to-payment navigation and confirm whether separate-payer policy must also prohibit the expense creator from paying when another user approved it.

**Acceptance criteria:** eligible users can complete create → approve → pay without searching for the expense; self-approval and separation-of-duties settings are enforced by the server. The follow-up above remains to confirm creator-versus-payer policy and browser automation.

### 6. Staff FOC Accounting and Reporting

**Existing foundation:** Staff FOC records preserve gross amount, covered amount, payable amount, staff, patient, and billing identifiers. Approved waived value is classified as Staff Benefits Expense (`acc-5010`), not bad debt.

- [x] Complete the FOC accounting decision: post approved waived value to Staff Benefits Expense (`acc-5010`), not bad debt.
- [x] Backend: post approved FOC value with staff, patient, branch, billing, and transaction linkage; the Staff FOC transaction retains gross value and patient-payable amounts.
- [x] Backend: trigger posting at approval, defer pending transactions, and post the inverse on reversal.
- [x] Backend: use the FOC transaction as the idempotent posting source and preserve its links to billing and patient receivables.
- [ ] Backend: add accounting/report queries that distinguish normal sales, waived FOC value, and collected value.
- [ ] Frontend: show FOC designation, staff member, service value, waived amount, and collected amount in accounting detail/report views.
- [x] Tests: cover approved benefit posting, receivable subledger reduction, reversal, and reversal subledger restoration.
- [ ] Tests: add database-backed coverage for fully/partially covered, pending approval, rejection, retries/idempotency, and zero-collected transactions.

**Acceptance criteria:** approved FOC value is posted separately from cash and reversed when the FOC transaction is reversed. Accounting report presentation and the remaining lifecycle test matrix are still open.

### 7. Simple Billing When No Strategies Are Configured

**Existing foundation:** billing strategy lookup and established billing submission contracts exist. The test catalog contains one base price per test; category-specific overrides are stored in active billing strategies.

- [x] Backend: provide a tenant-scoped capability response based on mapped strategies not marked expired and within their effective dates, plus valid NHIS strategies; failures are distinct from no-strategy results.
- [x] Backend: retain the existing server-owned catalog price and checkout recalculation as the simple-mode price authority.
- [x] Frontend: select simple mode only when the capability response confirms no active strategy; preserve the advanced workflow when strategies exist, and do not downgrade if capability lookup fails.
- [x] Frontend: automatically use General/Cash catalog pricing when no active strategies exist, then continue through the existing patient/services/billing flow; capability errors do not silently downgrade.
- [ ] Product/schema decision: define how a payment/billing category receives its own price without a strategy; current `test_panels` schema has only one base `price`, so category-specific amounts cannot be safely inferred.
- [ ] Tests: no strategy, one or more active strategies, inactive strategies only, capability API failure, payment-category pricing, and price tampering.

**Acceptance criteria:** facilities without active strategies can use General/Cash catalog pricing through a reduced workflow; configured facilities retain the advanced workflow. Selecting NHIS/insurance category-specific rates in simple mode remains blocked on the pricing model decision above.

### 8. Formula-Based and Calculated Laboratory Parameters

**Existing foundation:** formula configuration is versioned by test and output field. A safe evaluator calculates configured outputs during result entry and records formula version/input provenance.

- [x] Backend: add versioned formula configuration for target test/field, expression, declared inputs, units, precision, numeric conditions, effective dates, and active state. Formula approval workflow/metadata remains open.
- [x] Backend: implement a safe expression parser/evaluator with allowlisted arithmetic and functions; no `eval` or dynamic code execution.
- [x] Backend: validate required numeric inputs, finite results, division by zero, basic configured-unit consistency, active version, and effective date. Unit conversion is not implemented.
- [x] Backend: calculate configured fields before result persistence, mark them with calculated entry mode, and audit formula version plus input values.
- [ ] Backend: define dependency handling and controlled recalculation when source results change; retain prior generated values and audit history.
- [x] Frontend: add admin-protected formula configuration, editing as a new version, conditions, and formula history in the test editor.
- [ ] Frontend: visibly identify calculated values and their formula provenance in result entry and printed reports.
- [x] Tests: cover core arithmetic/functions, unsafe or unsupported expressions, missing inputs, division by zero, formula result replacement, and basic version/input provenance.
- [ ] Tests: add unit conversion, database-backed effective-version selection, demographics, dependency recalculation, and end-to-end report coverage.

**Acceptance criteria:** authorized users can configure safe formulas and result entry reproduces a value from its stored formula version and inputs. Recalculation, advanced clinical/unit governance, report labeling, and broader acceptance coverage remain.

### 9. Enforce Quality Control Before Result Entry

**Existing foundation:** QC sessions are linked to test-specific control materials. A test-level requirement, central result-entry gate, review audit, and frontend session actions are implemented. The current working-day check uses database `CURRENT_DATE()`; facility timezone and device/level scope are not yet configurable.

- [x] Backend: inspect the existing QC schema and use control-material-to-test linkage; acceptance currently requires same-day readings with `normal` status and active, unexpired material.
- [x] Backend: add the test-level QC-required setting through the startup bootstrapper. Device/level-specific matching remains open.
- [x] Backend: add a daily QC eligibility check and invoke it in shared result entry before result writes.
- [x] Backend: add scientist/admin QC acceptance and admin-only reasoned bypass, recording actor, test, session, working date, and decision in an audit table.
- [x] Frontend: expose the test setting and QC-session accept/bypass actions; bypass is admin-only and requires a reason.
- [ ] Frontend: show per-test QC status/block reason in result entry and link directly to QC recording.
- [x] Tests: cover missing-QC blocking, accepted-QC allowing, normal-reading acceptance, failed-reading rejection, and required bypass reason.
- [ ] Tests: add database-backed coverage for optional/required tests, expired/failed QC, timezone boundaries, device/material/level scope, mixed batches, and bypass authorization/audit.

**Acceptance criteria:** API result entry is blocked for a QC-required test unless a same-database-day accepted QC review or audited admin bypass exists. Facility timezone/device-level scope, result-entry UX, and broad acceptance tests remain open.

### 10. Structured Ultrasound Reporting

**Existing foundation:** ultrasound templates, configured test-field rules, markdown editing, result submission, and print routes already exist. The result-entry editor now maps configured dropdown, measurement/range, date/time, and text rules to appropriate controls; unspecified legacy field types remain markdown. Entered structured values can generate a neutral editable findings table. No clinical interpretation or formula is automatically invented.

- [ ] Clinical stakeholders: approve scan types, required fields, units, formulas, and generated report text before implementing scan-specific calculations or interpretations.
- [ ] Backend: define versioned structured template data compatible with the existing ultrasound report/result API; do not create a parallel reporting system.
- [ ] Backend: calculate approved derived values using validated clinical formulas and persist source measurements/calculation version.
- [x] Frontend: preserve the existing full-width markdown report and template workflow as the default; add a separate Structured ultrasound form option with early/first, second, and third trimester, postpartum, abdominal, abdominopelvic, renal, prostate, and other forms.
- [x] Frontend: provide number, select, and text inputs for the structured fields; generate the entered findings into the existing editable Markdown report and submit through the existing result/comment path.
- [ ] Tests: template/version handling, field validation, calculation cases, free-text additions, report persistence, and legacy report compatibility.

**Acceptance criteria:** users can enter configured structured measurements and edit/save a neutral generated draft through the existing backend flow. Approved scan-specific derived values and conventional clinical report text remain blocked on stakeholder approval and validation.

### 11. Pending-Result TAT Monitoring Overview

**Existing foundation:** completed TAT uses `test_ascension.ascension_date` through `resultEntryEnd`. A pending-result summary and paginated drill-down now use the same start clock, cumulative wall-clock thresholds, and exclude deleted, voided, refunded, cancelled, or written-off services.

- [x] Backend: use the existing registration-to-result clock (`ascension_date` to `resultEntryEnd`) and database current time for elapsed wall-clock minutes; business-hour/pause/time-zone overrides remain undecided.
- [x] Backend: add tenant-scoped summary counts for cumulative 6, 12, 24, 32, and 64-hour thresholds and a paginated selected-threshold drill-down.
- [x] Backend: exclude completed results and deleted, voided, refunded, cancelled, and written-off services from the pending view.
- [x] Frontend: add threshold cards and a paginated Laboratory Operations list with patient/lab number, test, section, registration/collection times, elapsed time, configured TAT, and pending status.
- [x] Frontend: include loading, empty, and error states.
- [x] Tests: cover threshold definitions, minute conversions, pending completion/status/deletion filters, and stable pagination query ordering.
- [ ] Operations: confirm whether existing calendar-time semantics are acceptable across facility time zones and shift/calendar policies.
- [ ] Tests: add database-backed threshold-boundary, timezone, and count/list consistency checks; verify query performance against tenant data.

**Acceptance criteria:** cards count and drill into eligible pending work using the existing wall-clock start point. Facility calendar/time-zone policy and database-backed boundary/performance verification remain open.

### Additional Enhancement: Suspend and Resume Billing / Price Quotes

This enhancement was requested separately from Issues 1-11. Suspended drafts are not billing rows and do not create payment history, outstanding debt, or a `billingid` until the normal billing submit succeeds.

- [x] Backend: create branch-scoped `suspended_billing_transactions` storage through the startup bootstrapper, with suspended/finalized/cancelled states.
- [x] Backend: add authenticated create/list/get/update/cancel/finalize APIs; list and mutation scope is restricted to the actor's branch.
- [x] Frontend: add a Suspend Transaction action for unfinished new billings and a Suspended Transactions list with resume/cancel actions.
- [x] Frontend: persist selected test/service identifiers and relevant options, then reload prices from the server when resuming rather than trusting saved prices.
- [x] Frontend: allow a patientless price-list quote to be suspended, resumed, and converted to sale after patient selection while preserving source/entity selection and the newly selected patient through draft loading.
- [x] Backend/frontend: finalize the draft only after a real billing record is created and verify that patient (except patientless quote conversion) and branch match.
- [x] Tests: focused service validation covers patientless quotes, patient-bound drafts, NHIS eligibility, required selections, and branch scope.
- [ ] Tests: database-backed lifecycle coverage for branch isolation, cancel, resume, price changes, concurrent finalize, and mismatch rejection; browser test for quote-to-patient-to-sale flow.
- [ ] Deployment: verify startup bootstrap has run on every tenant before exposing the navigation link.

**Acceptance criteria:** suspended work remains separate from billed debt; staff can resume it with current prices; only the standard billing submit finalizes it and creates the actual sale.

The lab multi-billing screen submits the draft fields directly (`billingSource`,
`selectedTestIds`, `selectedServiceIds`, and `isPricingQuote`), not a nested UI
snapshot or snake-case storage columns. Only selected services are saved, not the
available service catalog. Resuspending updates the same draft. Resume reloads
current prices and reapplies saved selections/options. Patientless quotes expose
**Convert to Sale**, which saves the quote and requests a patient before restoring
it as a sale. Payments must be entered again after resuming. A successful sale
marks the draft finalized; a failed finalization displays an explicit retry
without submitting the sale again.

## Suggested Delivery Order

1. **Resolve policy gates:** commission precedence, accounting posting/treatment, access defaults, billing strategy definition, formula governance, QC acceptance/scope, ultrasound clinical approval, and TAT clock rules.
2. **Close integrity and safety gaps:** Issues 3, 6, and 9. Add backend tests before UI completion.
3. **Complete existing workflow foundations:** Issues 2, 4, and 5.
4. **Build smaller configuration/workflow gaps:** Issues 1 and 7.
5. **Deliver new clinical/reporting capabilities:** Issues 8, 10, and 11, each behind reviewed requirements and acceptance tests.

## Definition of Done

- [ ] Backend and frontend behavior match the issue acceptance criteria.
- [ ] Authorization, tenant isolation, validation, and audit requirements are covered by tests.
- [ ] Database changes use the verified migration/bootstrapper path and are safe for existing tenant databases.
- [ ] API contracts and settings defaults are documented.
- [ ] Relevant focused tests/type checks pass; any environment-dependent checks are recorded in the delivery notes.
- [ ] No unrelated files or generated output are included in the change.
