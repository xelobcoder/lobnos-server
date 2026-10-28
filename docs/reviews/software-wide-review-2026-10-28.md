# Software-wide review and feature gaps — 28 October 2026

## Assessment

The application has substantial functional breadth, but its enterprise readiness is uneven. The principal risk is inconsistent enforcement and reliability across older and newer workflows. Adding screens alone will not close that gap. This review made no functional source changes and did not submit live patient or financial transactions.

Scope: mapped 1,323 backend source/test files in the principal model/controller/middleware/accounting/payment areas and 1,576 frontend source files under app/components/lib. Inspected central request/session boundaries and sampled laboratory/QC, consultation, pharmacy, inventory, billing/refunds, organizations, payroll, accounting, settings, portals and provisioning. This is a broad code review with targeted reproductions, not a line-by-line certification or a production penetration test. Features described as “not found” below require product confirmation; a keyword search alone cannot establish absence across all deployments.

## Confirmed findings, in priority order

### 1. High: legacy business APIs lack consistent role/permission enforcement

Authentication is not sufficient authorization. Global `checkTokenExists` validates staff identity/session and explicitly constrains marketers; practitioner/pharmacy boundaries add narrower restrictions. They do not supply a general permission check for ordinary cashier/CRM/scientist accounts.

Examples of sensitive paths without an operation-level role/authority check in the inspected route → controller → repository chain:

- Organization payment details/pricing: `src/controllers/organization/route.ts:43` and `:47`, `handlers.ts:151` and `:238`, `src/models/organization/organization.ts:246`. Account/bank/mobile-money/commission fields are accepted from the body and written by organization ID.
- Payroll compensation reads/writes: `src/controllers/payroll/routes.ts:17` and `:31`; `compensationController.ts:9` and `:36`. These reach compensation records by caller-selected employee ID without an actor policy in that chain.
- QC target setup: `src/controllers/QualityControl/qualityControlRoutes.ts:49` and `:50`; `ControlParameterController.ts:14`. The controller validates tenant and parameter array, but not clinical configuration authority.

Impact: authenticated non-specialist staff can reach sensitive operations through direct API requests even when navigation hides the screen. This is a same-tenant authorization finding, not evidence of anonymous or cross-tenant access. Validate with negative HTTP tests for every role, then enforce server-side capabilities, branch scope and audit identity centrally.

### 2. High: refund identity and amount validation are unsafe in the legacy flow

`src/controllers/billing/controllers.ts:273` trusts body `employeeid` and only checks that `refundAmount` is truthy. A negative amount is truthy. It forwards the entire body to the refund model. `RefundClass.ts:312` also resolves witness authority from a caller-supplied employee ID, and can auto-approve when that selected employee has an administrative role.

The isolated reproduction executed the actual transpiled cash-out handler with an authenticated employee of 7 and a body employee of 99/amount -10. It forwarded employee 99 and amount -10 to the model, rather than rejecting or replacing them.

Further source evidence: `RefundClass.ts:405` checks existing remaining funds without accepting the requested amount; `obso/billing.ts:977` reads billing/service balances before opening its transaction and does not bind the selected service to the selected bill in its service query. Arithmetic subtracts the supplied amount. `BillingAccounting.ts:411` returns without a posting when both refund amounts are non-positive. These paths need strict finite positive/bounded amounts, session-derived actor, service-to-bill binding, locked reads, idempotency and atomic posting. The isolated handler reproduction did not make a live refund or prove an end-to-end production exploit.

### 3. High: pending-service removal leaks transactions on ordinary failure paths

`src/models/billing/billing-new-client-multi.ts:1233` opens a manual transaction. Missing service at `:1238`, already-deleted service at `:1251`, and some following checks return without commit or rollback. There is no final cleanup for those returns.

An isolated execution of the actual method with a missing service produced: transactions opened=1, commits=0, rollbacks=0. Repeated invalid/retried removal requests can consume the connection pool. Prefer callback transactions or guaranteed completion on every exit.

### 4. High: laboratory sales-session close route is shadowed

`src/controllers/billing/index.ts:117` registers PUT `/billing/sales/session/:sessionId` before PUT `/billing/sales/session/endsession` at `:118`. Express matches `endsession` as a session ID first; `handleUpdateSalesSession` rejects it as non-numeric instead of reaching the close handler.

An isolated Express reproduction using the route order extracted from the current source matched the dynamic route with `sessionId="endsession"`. Move the static route first and add a real route-level close test. Separately, session update/closing authority should be bound to the verified actor; `SessionManger/handler.ts:49` currently accepts `validatedby` from the body.

### 5. High: clean-install provisioning baseline is out of sync

`src/bootstrap/standalonePipeline.ts:53` requires the on-disk migration list to equal `LOCAL_MIGRATIONS` exactly. Five current migrations are absent from that approved list:

- 20261024_pharmacy_enterprise_workflows
- 20261024_pharmacy_price_types
- 20261025_billing_layout
- 20261027_lab_cashier_workflow
- 20261027_organization_directory

The offline provisioning prerequisite test failed again in an isolated serial rerun. This can prevent clean local provisioning before any database is created. Update the reviewed baseline deliberately and verify a new install plus upgrade/rollback recovery; do not simply disable the guard.

### 6. Medium: customization offers currency/precision settings that are not applied

`lobnos/app/settings/applicationsettings/customization/page.tsx:19` exposes currency and decimal-place inputs, but its settings initialization/save mapping omits them. `lobnos/components/Auth/customFetch.js:1038` builds a fixed en-GH/GHS formatter. Selecting another currency/precision therefore does not implement consistent financial behavior.

Distinguish a display preference from true multi-currency accounting. Either implement/persist the supported display contract everywhere or remove unavailable options. Actual foreign-currency ledgers additionally need exchange rates and realized/unrealized differences.

### 7. Medium: failed data loads can look like valid zero-balance transactions

`lobnos/app/billing/transactions/previous-transaction/[billingid]/PreviousTransactionWorkspace.tsx:154` catches failed fetches by setting `{}`/`[]`; its summary then renders numeric fallbacks as zero. There is no explicit load-error/retry state in that path. The recent offcanvas extraction reused this existing behavior, so it remains my responsibility to flag it rather than presenting the offcanvas as fully hardened.

A network/server failure must produce an unavailable/error state, not a plausible zero-value financial report. Separate loading, empty, forbidden, conflict and failure states in a shared API contract.

### 8. Medium: the test baseline is red and release gates are incomplete

Backend full run: 243 files, 2,644 tests: 2,625 passed / 19 failed. Serial rerun of the failing suites: 105 passed / 10 failed. The remaining failures include migration baseline mismatch, date-dependent portal booking fixtures, report tests attempting localhost MySQL, and super-admin policy assertions that no longer agree with current role normalization. Earlier timeout failures passed serially; two licensing CLI failures were caused by the initial run's workspace TEMP override and passed with the normal temp directory.

Frontend full run: 434 tests: 348 passed / 86 failed. Failures include stale source/visual expectations and test harnesses rejecting newly imported navigation modules. They are not evidence of 86 independently reproduced user-facing bugs, but they mean the suite cannot currently certify a release.

Backend compilation and independent frontend type check passed. However, `lobnos/next.config.js:41` sets `ignoreBuildErrors: true`, so a Next build alone can pass with TypeScript failures. Restore a trustworthy regression baseline and make type checks/tests mandatory release gates.

### 9. Medium: production dependency advisories require triage

The projects use pnpm lockfiles. `pnpm audit --prod --json` reported backend: 1 critical, 15 high, 20 moderate; frontend: 7 critical, 37 high, 25 moderate, 8 low. These are lockfile advisory counts, not validated application exploits. Some frontend paths run through the legacy `tauri` package and old asset tooling. Prioritize reachable server parsers, upload/image handling, rich-text rendering and clinical/report imports; remove unused legacy dependencies and retest deliberate updates. Do not blindly force-upgrade.

The initial npm audit command was inapplicable because the project uses pnpm lockfiles; no lockfile was generated or modified. Advisory details are retained in `tmp/software-review-backend-pnpm-audit.json` and `tmp/software-review-frontend-pnpm-audit.json`.

### 10. Medium: frontend architecture produces repeated inconsistency and high change cost

Examples: frontend PrimePivotTable ~3,893 lines; inventory orders ~2,207; billing layout/payment ~1,350 each; shared transaction workspace ~1,300. Backend inventory analytics controller ~4,319 lines. JS/TS, multiple table implementations, repeated money/date formatting, and independent role/navigation rules increase the number of places each change must remain correct.

The recent billed-client iterations illustrate this: a visual change repeatedly touched identity, horizontal overflow, sticky headers and action placement. Establish shared primitives for tables, numeric formatting, filters, action panels and load states, while allowing appropriate section-specific styling. Extract business logic before redesigning whole screens.

Additional privacy/operations observations: receipt rendering logs complete billing objects in the browser (`pos-receipt-test/page.tsx:186`); legacy error helpers can return raw database error messages (`src/hooks/helper.ts:20`). Review and redact these deliberately. Global reflected-origin CORS and the 50MB general JSON allowance warrant a separate deployment/security-hardening review; I have not established a working cross-site exploit from those settings.

## Existing strengths and module coverage

- Identity/tenancy: live staff-session checks, role switching/recovery, explicit portal/pharmacy boundaries and tenant separation exist. Older endpoint authorization remains the main gap.
- Laboratory: sample/assignment workflows, result revisions/revalidation, QC and instrument interfacing exist. Prioritize QC configuration permissions, failure states, and external quality/accreditation coverage.
- Consultation/portals: practitioner access/invitations, consultation and patient portal workflows exist. Improve uniform error handling and API-level negative-role coverage.
- Pharmacy: separate cashier/direct-sale modes, shifts/financial days, clinical reviews, stock counts, transfers, recalls and internal NHIS records exist. External insurer and clinical-data automation are partial.
- Inventory: procurement, receiving, stock reporting and analytics exist. Large controllers/screens and permission consistency require attention.
- Billing/refunds: extensive workflows exist, but the legacy refund/session paths above need immediate hardening.
- Accounting: chart of accounts, journals, trial balance, profit/loss, balance sheet, cash flow, subledgers, bank reconciliation, budgets, recurring expenses and forecasting exist. Financial integrity must include every legacy writer, not just accounting screens.
- HR/payroll: extensive records/calculations exist; verified identity must be supplemented with role/record authorization.
- Messaging/settings: email/SMS providers, notifications, templates and customization exist. Dependency upkeep and settings round-trip correctness need work.
- Deployment/backup: local/desktop packaging, tenant provisioning and backup/restore controls exist. Clean-install baseline and repeatable release checks are essential.

## Missing or partially implemented features

| Capability | Evidence/status | Practical feature still needed |
|---|---|---|
| Live NHIS/insurer integration | Confirmed partial: PharmacyClaims explicitly returns manual_register/liveSubmissionAvailable:false and rejects live submit | Provider/member verification, permitted tariff synchronization, actual submission acknowledgements, automated rejection/remittance reconciliation through an approved integration |
| Automated medication safety | Confirmed partial: PharmacyClinical returns automatedClinicalChecks:false | Licensed drug-knowledge integration for interaction/duplicate-therapy/dose/contraindication alerts, review/override audit and provider updates; existing pharmacist review must remain |
| Bank feeds | Manual bank-statement import/matching exists; no bank-feed connector found | Secure connector credentials, scheduled sync, deduplication and reconciliation status |
| Multi-currency accounting | Currency setting incomplete; core shared display formatter is GHS | Transaction/base currencies, rate history, FX differences and currency-aware reports; do not treat a symbol change as this feature |
| Staff MFA / enterprise SSO | Passwords, PINs and recovery OTP exist; no TOTP/passkey/SAML/OIDC login implementation found | Enrolment/recovery, step-up access for privileged actions and optional organization identity-provider login |
| Controlled patient merge | Registration/search/audit exist; no patient merge/unmerge workflow found | Duplicate review, approved survivor identity, linked-history transfer, conflict checks and an audit/reversal plan |
| Standards-based interoperability | Device interfacing exists; no FHIR or DICOM integration found | Patient/order/result exchange contracts and, where required, imaging/PACS integration; existing device interfaces are not proof of this feature |
| Full laboratory quality-management layer | Internal QC/calibration/incidents/audits exist; SOP approval/versioning and EQA/proficiency workflows not found | Controlled SOP lifecycle, staff acknowledgement and external proficiency participation/results/corrective follow-up |

Additional product choices to confirm rather than label absent without further review: enterprise consent/retention workflows, independently tested disaster-recovery targets, and cross-site/offline synchronization. A home-collection consent checklist and backup/restore pages already exist; those should not be mistaken for complete governance or recovery certification.

## Recommended implementation order

1. Stabilize authorization, refund validation/audit identity, transaction cleanup, sales-session routing and provisioning.
2. Repair test/release gates and validate real MySQL concurrency/reconciliation with synthetic fixtures.
3. Complete NHIS and clinical integrations where approved provider access is available, and add staff MFA.
4. Add patient merge, bank feeds and interoperability according to actual customer demand.
5. Introduce multi-currency and extended quality-management workflows where the facility model requires them.

No production deployment, package upgrade, schema change or financial mutation was performed for this review. Temporary test artifacts and this report are the only review deliverables; compilation regenerated local build output.
