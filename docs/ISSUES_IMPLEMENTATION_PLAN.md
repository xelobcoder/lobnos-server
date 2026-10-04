# Implementation Plan: Issues 1-11

This document turns the requests in [`../issues.md`](../issues.md) into implementation tasks for the Lobnos Server backend and the sibling `lobnos` frontend. The frontend is located at `../../lobnos` relative to this document.

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
| 3. Collections/refunds accounting | **Not started** | Existing posting hooks need full path audit and reconciliation coverage. |
| 4. Historical sales permissions | **Not started** | Existing date queries need facility settings and server-side role enforcement. |
| 5. Expense create/approve/pay | **Implemented; follow-up remains** | Prompts, payment handoff, self-approval setting, and server enforcement are implemented. Browser workflow coverage and creator-versus-payer policy confirmation remain. |
| 6. Staff FOC accounting | **Not started** | Accounting treatment decision is still required. |
| 7. Simple billing mode | **Partial** | Server capability detection and automatic General/Cash catalog-price mode when no effective strategy exists are implemented. Category-specific prices without strategies are not represented in the current schema and need a product/schema decision. |
| 8. Formula-based results | **Not started** | No configurable formula engine yet. |
| 9. QC enforcement | **Not started** | Per-test daily QC gate and audited bypass remain. |
| 10. Structured ultrasound reports | **Not started** | Structured workflow integration and generated report remain. |
| 11. Pending-result TAT overview | **Not started** | Threshold cards and drill-down remain. |
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

- [ ] Backend: map every cash collection path, including outstanding-balance payments, partial payments, bulk payments, service refunds, full refunds, and voids, to its billing transaction and accounting posting call.
- [ ] Backend: use one transactional posting boundary where billing balances, payment history, refund history, and accounting outbox/journal records must stay consistent.
- [ ] Backend: make posting idempotent using a stable source transaction identifier; prevent duplicate journals on retries.
- [ ] Backend: post collection/refund events with payment mode/account, branch, tenant, employee, billing, and source identifiers needed for reconciliation.
- [ ] Backend: reconcile billing paid/outstanding/refunded values against payment/refund history and expose actionable mismatches rather than silently diverging.
- [ ] Frontend: show collection/refund completion and accounting-posting errors distinctly; do not report success where the financial transaction failed.
- [ ] Tests: each payment/refund path, retries, partial amounts, rollback behavior, and billing-to-ledger reconciliation.

**Acceptance criteria:** every successful collection/refund is represented exactly once in accounting and the resulting billing balance agrees with its payment/refund history.

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

**Existing foundation:** Staff FOC records preserve gross amount, covered amount, payable amount, staff, patient, and billing identifiers. Accounting treatment remains undecided.

- [ ] Complete the FOC accounting decision in the table above before implementation.
- [ ] Backend: define an accounting event for an approved FOC transaction that records service value, waived amount, zero/partial patient collection, staff-benefit recipient, and billing/service identifiers.
- [ ] Backend: trigger posting only at the correct approved/committed point; reverse or adjust the posting on rejection, reversal, or billing correction.
- [ ] Backend: prevent duplicate postings and preserve links between FOC transaction, billing services, and journals.
- [ ] Backend: add accounting/report queries that distinguish normal sales, waived FOC value, and collected value.
- [ ] Frontend: show FOC designation, staff member, service value, waived amount, and collected amount in accounting detail/report views.
- [ ] Tests: fully covered, partially covered, pending approval, rejection, reversal, retries, and zero-collected transactions.

**Acceptance criteria:** FOC services remain visible as rendered services and the approved accounting treatment is traceable without inflating cash collected.

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

**Existing foundation:** result entry stores submitted fields; no generic formula registry/evaluator was found.

- [ ] Backend: design a versioned formula configuration model with target test/field, expression, declared inputs, units, precision, conditions, effective dates, active state, and approval metadata.
- [ ] Backend: implement a safe expression parser/evaluator using an allowlist of arithmetic/operators/functions; never use `eval`, dynamic code execution, or unrestricted scripting.
- [ ] Backend: validate input availability, numeric/finite values, division-by-zero, units, and formula version before calculation.
- [ ] Backend: calculate dependent fields before result persistence, distinguish measured from calculated values, and store formula/version/input provenance in an audit record.
- [ ] Backend: define dependency handling and controlled recalculation when source results change; retain prior generated values and audit history.
- [ ] Frontend: add authorized formula configuration/validation UI and visibly identify calculated result fields and their provenance.
- [ ] Tests: arithmetic, allowlisted functions, missing/invalid inputs, units, malicious expressions, version changes, and recalculation/audit behavior.

**Acceptance criteria:** an authorized user can configure a safe formula without a code release; submitted results are reproducible from the stored formula version and inputs.

### 9. Enforce Quality Control Before Result Entry

**Existing foundation:** QC sessions/readings and result entry exist, but no test-level result-entry gate was found. See also `issues.md` Issue 9.

- [ ] Backend: inspect the actual QC schema and test/device/material relationships; define the authoritative accepted status and working-day boundary before changing schema.
- [ ] Backend: add a test-level QC-required setting and any necessary mapping for device/material/level scope, using the repository's established schema/bootstrapper process.
- [ ] Backend: add a QC eligibility service that finds valid accepted QC for each required test for the facility's current working day.
- [ ] Backend: invoke the check in the shared result-entry service before any result writes; reject the full batch if any required QC is missing/failed/expired.
- [ ] Backend: provide a permission-checked bypass requiring a reason, and persist an immutable audit record with actor, tests, date/time, and justification.
- [ ] Frontend: expose the test setting, show QC status in result entry, explain blocked tests, and link to QC recording; only show bypass controls to authorized roles.
- [ ] Tests: optional/required tests, accepted/missing/failed QC, date/time-zone boundary, device/material scope, mixed batches, and bypass permissions/audit.

**Acceptance criteria:** API result entry cannot save a QC-required test without valid QC or a valid audited override; optional tests continue normally.

### 10. Structured Ultrasound Reporting

**Existing foundation:** ultrasound templates and result submission exist; a first-trimester form has some fixed calculations but is not a complete structured workflow integrated with generated editable reports.

- [ ] Clinical stakeholders: approve scan types, required fields, units, formulas, and generated report text before development.
- [ ] Backend: define versioned structured template data compatible with the existing ultrasound report/result API; do not create a parallel reporting system.
- [ ] Backend: calculate approved derived values using validated clinical formulas and persist source measurements/calculation version.
- [ ] Frontend: build scan-type selection and conditional structured fields for approved templates, with validation and appropriate units.
- [ ] Frontend: generate conventional report text from structured values, permit edits, then submit through the existing report path.
- [ ] Tests: template/version handling, field validation, calculation cases, free-text additions, report persistence, and legacy report compatibility.

**Acceptance criteria:** a sonographer can enter structured measurements, see approved derived values, edit generated findings, and save a report through the existing backend flow.

### 11. Pending-Result TAT Monitoring Overview

**Existing foundation:** TAT analysis and paginated TAT data exist, but the requested live pending-result threshold summary was not found.

- [ ] Product/operations: resolve clock start, business-hour rules, pauses, tenant time zone, and cumulative/exclusive threshold behavior.
- [ ] Backend: create a tenant-scoped query/service for tests still pending result entry and calculate elapsed time from the approved clock rules.
- [ ] Backend: return counts for 6, 12, 24, 32, and 64-hour thresholds and a paginated drill-down endpoint accepting the selected threshold and standard filters.
- [ ] Backend: ensure cancelled, completed, refunded, or otherwise excluded work is handled consistently and query performance is indexed/verified.
- [ ] Frontend: add the overview to Laboratory Operations with summary cards and click-through lists containing patient/lab number, test, sample/collection time, elapsed time, status, and responsible section/user where available.
- [ ] Frontend: refresh counts and list data reliably; show loading, empty, and error states.
- [ ] Tests: exact threshold boundary, overdue pending cases, completed/excluded cases, time zones, pagination, and count/list consistency.

**Acceptance criteria:** cards count only eligible pending work under the agreed clock rules, and selecting a card returns the corresponding affected tests.

### Additional Enhancement: Suspend and Resume Billing / Price Quotes

This enhancement was requested separately from Issues 1-11. Suspended drafts are not billing rows and do not create payment history, outstanding debt, or a `billingid` until the normal billing submit succeeds.

- [x] Backend: create branch-scoped `suspended_billing_transactions` storage through the startup bootstrapper, with suspended/finalized/cancelled states.
- [x] Backend: add authenticated create/list/get/update/cancel/finalize APIs; list and mutation scope is restricted to the actor's branch.
- [x] Frontend: add a Suspend Transaction action for unfinished new billings and a Suspended Transactions list with resume/cancel actions.
- [x] Frontend: persist selected test/service identifiers and relevant options, then reload prices from the server when resuming rather than trusting saved prices.
- [x] Frontend: allow a patientless price-list quote to be suspended, resumed, and converted to sale after patient selection while preserving source/entity selection.
- [x] Backend/frontend: finalize the draft only after a real billing record is created and verify that patient (except patientless quote conversion) and branch match.
- [x] Tests: focused service validation covers patientless quotes, patient-bound drafts, NHIS eligibility, required selections, and branch scope.
- [ ] Tests: database-backed lifecycle coverage for branch isolation, cancel, resume, price changes, concurrent finalize, and mismatch rejection; browser test for quote-to-patient-to-sale flow.
- [ ] Deployment: verify startup bootstrap has run on every tenant before exposing the navigation link.

**Acceptance criteria:** suspended work remains separate from billed debt; staff can resume it with current prices; only the standard billing submit finalizes it and creates the actual sale.

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
