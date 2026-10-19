# PLS Comprehensive Codebase Audit

**Scope:** this repository only (`lobnos-server`, the Express/TypeScript backend). No frontend or device-manager repository was found here, so frontend responsiveness and UI/backend consistency are **not assessed**.
**Mode:** audit-only. No source, schema, config or dependency was changed. No tests, builds or database calls were run.

> **Limitation of this report:** the audit brief was truncated at section I (User Management), so sections I onward (including any performance, reporting and output-format requirements) were never seen. The audit is therefore partial. Evidence is static code reading and grep only. No performance was measured, so no performance claims are made as facts.

Finding labels: **[Confirmed]** = verified in code read; **[Probable]** = strong indication, not fully traced; **[Unverified]** = not checked; **[Decision]** = needs a product or clinical decision.

---

## 1. Files and checks inspected

- Repo inventory: `git ls-files` (1,882 tracked files), `.gitignore`, `package.json` scripts, `tsconfig.json`, `.github/` contents, `.env` key names only (values deliberately not read or reproduced).
- [src/app.ts](src/app.ts) (middleware order, CORS, body limits), [src/middleware/validateTenancy.ts](src/middleware/validateTenancy.ts) (auth, session, tenancy).
- [src/models/inventory/InventoryTransaction.ts](src/models/inventory/InventoryTransaction.ts), [src/models/inventory/InventoryPaymentAnalytics.ts](src/models/inventory/InventoryPaymentAnalytics.ts) and its controller.
- [src/controllers/result/route.ts](src/controllers/result/route.ts), [src/controllers/result/testResultsAuditLogsController.ts](src/controllers/result/testResultsAuditLogsController.ts).
- Pattern greps over `src/` for raw SQL interpolation, transactions, `forUpdate`, idempotency, refunds, commissions, HL7 handling, rate limiting, audit logs and tests.

Not inspected in depth: the billing calculation internals, commission math, HL7/analyzer parsing logic, QC workflows, payroll, patient registration/duplicate detection, and the frontend. They are marked **Unverified** below.

## 2. Architecture map (confirmed)

- Express + TypeScript, compiled to `dist/`; 1,231 `.ts` and 18 `.js` files under `src/`; about 754 files in `src/models`, 307 in `src/controllers`, 94 migrations in `src/migrations` plus 44 Knex migration files under `src/cron/command-line-tool-database`.
- Request pipeline ([src/app.ts](src/app.ts)): CORS → JSON/urlencoded (50 MB) → `signedLicenseGuard` → license, marketplace, platform and public routers → `ValidateTenancyAgreement` → `facilityModuleAccess` → `subscriptionRouter` → **global `checkTokenExists`** → ~60 domain routers. Auth is now global, not per-route as older project notes say.
- Auth: JWT cookie plus server-side session check (`verifyStaffSession`), token tenant id (`tid`) compared with the request tenant, role lookup per request.
- Domains present: patients/registration, billing/invoices/packages/free services/write-offs, organization credit invoices, commissions, results/QC/critical values, samples (including physical samples), inventory/pharmacy/suppliers, accounting module (journals, subledger, bank reconciliation, periods, day close, outbox), payroll, appointments, patient/clinician portals, SMS/email/notifications, device (HL7) interfacing, licensing and marketplace.
- Accounting module is the most mature area: idempotency keys, row locks (`forUpdate`), finalized-record and day-close triggers (`FINANCIAL_RECORD_FINALIZED`), immutable audit-record triggers.

## 3. Findings

### 3.1 Security and configuration

| # | Sev | Status | Finding | Evidence |
|---|-----|--------|---------|----------|
| S1 | High | Confirmed | `.env` and `cert/server.key` (plus `server.cert`) are **tracked in git** even though `.gitignore` lists `cert/`. `.env` contains key names for DB passwords, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `APPLICATION_ENCRYTION_KEY`, `BACKUP_MASTER_KEY`, email and SMS credentials. Anyone with repo access, or history access, holds production-class secrets. | `git ls-files` output; `.env` key names |
| S2 | High | Confirmed | CORS reflects any request origin with `credentials: true`. Combined with cookie auth this lets any website call the API with a logged-in user's cookie, subject to cookie `SameSite` settings (not checked). | [src/app.ts](src/app.ts) lines 86-92 |
| S3 | High | Confirmed | Result audit-log API is open to any authenticated user: `POST /api/v1/result/auditlogs` accepts a client-supplied body, and `DELETE /api/v1/result/auditlogs/:id` deletes records. No role check at route or controller. Same pattern on critical-value alert `PUT`/`DELETE` and printing-tracking `DELETE`. This defeats the purpose of an audit trail. | [route.ts](src/controllers/result/route.ts) lines 98-114; [controller](src/controllers/result/testResultsAuditLogsController.ts) |
| S4 | Medium | Confirmed | SQL built by string interpolation from query parameters: `start_date` / `end_date` go straight into raw SQL in the inventory payment analytics model with no validation in the controller. Likely SQL injection by any authenticated user. | [InventoryPaymentAnalytics.ts](src/models/inventory/InventoryPaymentAnalytics.ts) lines 39, 66, 94, 121, 143-144; controller lines 33-50 |
| S5 | Low-Med | Probable | Other interpolation sites: `synchronization.ts` (`IN (${testList})`), `TiifuWorkingClass.ts` (`SHOW COLUMNS FROM ${tableName}`), `literature.ts` (map lookup; probably safe), `ascension.ts` (query fragment). Need source-of-value tracing. | greps listed in §1 |
| S6 | Medium | Probable | Login rate limiting appears limited to `authHandlers.ts` and patient-portal routes. Other sensitive endpoints (PIN, OTP) were not checked. | grep of `createRateLimiter` |
| S7 | Low | Confirmed | 50 MB JSON/urlencoded limit applied globally, before auth. Unauthenticated requests can send large bodies to public routes. | [src/app.ts](src/app.ts) lines 94-95 |
| S8 | Low | Confirmed | `/api/v1/health` is registered after the license guard and request logger; 255 `console.log` calls remain in `src/` (patient/result data exposure in logs not verified). | grep |

### 3.2 Data integrity and workflows

| # | Sev | Status | Finding | Evidence |
|---|-----|--------|---------|----------|
| D1 | High | Confirmed | **Inventory lost-update race.** `InventoryTransaction.create` reads `current_stock` *outside* the transaction, computes `newStock`, then writes the absolute value inside the transaction with no row lock or conditional update. Two concurrent consumptions (for example two result entries consuming the same reagent) can overwrite each other and the negative-stock check can be bypassed. | [InventoryTransaction.ts](src/models/inventory/InventoryTransaction.ts) lines 72-175 |
| D2 | High | Probable | Core billing/payment creation has no idempotency key; idempotency appears only in accounting (`acc_*`, corrections) and pharmacy POS. A retried or double-clicked payment/bill request may duplicate charges. Needs tracing through `billing-new-client-multi.ts`. | grep for `idempotency` |
| D3 | Medium | Probable | Refunds exist (`dbobillingrefundtable`) but no credit-note/void concept was found for patient billing (only for organization invoices and facility management). Refund-to-commission reversal not traced. | greps |
| D4 | Medium | Probable | Analyzer/HL7 path has tests and PID helper code, but no duplicate-message detection, ACK/MSA handling or retry reconciliation was found in the current device code (a `DeviceModelsVerisonProcessing-old-re.ts` legacy file remains). Duplicate results or wrong-patient association cannot be ruled out. | grep of `settings/devices` |
| D5 | Medium | Unverified | Result release/amendment: approval fields exist (`approvalStatus`, `ApprovedBy` in `test_ascension`), but whether edits after approval are blocked and whether amendments keep history was not traced. Audit logs are client-writable (S3). | [queries.ts](src/models/result/queries.ts) |
| D6 | Medium | Probable | Patient merge / duplicate-detection: no merge or duplicate-detection logic found under `src/models/patients` (only emergency-contact DTOs matched). Registration-time duplicate checks not inspected. | grep |
| D7 | Low | Probable | Commission duplicate protection exists in code (`Service is already tracked for commission`, batch checks) but relies on application checks; a DB unique constraint was not found. Race-safety not verified. | `CommissionTrackingRepository.ts`, `CommissionBatchPaymentServicesRepo.ts` |
| D8 | Low | Confirmed | Multi-step billing code uses transactions in 10 files, but 563 `promisifyQuery` calls (legacy, no transaction handle) remain; atomicity of those flows is unverified. | grep counts |

### 3.3 Quality, maintainability and testing

- **No CI**: `.github/` has agent/skill docs only, no `workflows/`. Tests and `tsc` are never run automatically.
- **Tests exist** (about 50 `*.test.ts` files, vitest): strong on accounting, licensing, bootstrap, auth, portals and HL7 helpers. **No tests found** for billing totals, commission calculation, result entry/validation, inventory transactions or patient registration, which are the highest-risk areas.
- **Type safety**: `tsconfig.json` has no `strict`; about 3,100 `any` usages.
- **Oversized files**: `InventoryAnalyticsController.ts` (272 KB), `MarketplaceService.ts` (96 KB), `InventoryConsumptionController.ts` (73 KB), `billing-new-client-multi.ts` (64 KB). These are hard to review and test.
- **Dual migration systems** (`src/migrations` and the CLI Knex migrations) plus a large `DatabaseTableSchema.ts` and committed `db-exports/` SQL; the source of truth for schema is unclear.
- Duplicated router registration in [src/app.ts](src/app.ts): `smsAnalytics`, `BillingRouter` and `SecurityRouter` are each mounted twice.
- Documentation is substantial (`docs/`), but project instructions still describe a per-route auth model that no longer matches the code.

### 3.4 Performance
Not measured. Static observations only, **all unverified as bottlenecks**: very large analytics controllers; the payment analytics endpoint runs five queries in parallel per request; index management exists (`ensureIndexes.ts` with a test) but index coverage on hot tables was not reviewed.

## 4. Module status

| Area | Status |
|---|---|
| Accounting / financial controls | Implemented, strongest area (locks, idempotency, immutability triggers, tests); other findings not found |
| Auth / sessions / tenancy | Implemented; session + tenant claim checks present; CORS issue (S2) |
| Billing and payments | Implemented; correctness and idempotency **unverified** (D2, D3) |
| Referrals/commissions | Implemented; duplicate guards in code; math and reversals **unverified** |
| Inventory | Implemented; race condition confirmed (D1) |
| Results / clinical validation | Implemented; release/amendment rules **unverified**; audit trail weak (S3) |
| Analyzer integration | Partially verified; duplicate/ACK handling not found (D4) |
| QC | Routes exist; **unverified** |
| Patient registration/identity | **Unverified**; merge not found (D6) |
| Specimens | Physical-sample service exists; **unverified** |
| Frontend / device manager | Not in scope of this repo |

## 5. Prioritized recommendations (not applied)

1. Remove `.env` and `cert/` from git tracking, rotate every secret and certificate listed in `.env`, and consider history rewrite. (S1)
2. Restrict CORS to an allow-list of known origins. (S2)
3. Make audit-log and critical-alert tables append-only from the API: remove client-supplied `POST` and all `DELETE` routes, write entries server-side only, add role checks. (S3)
4. Parameterize date filters and validate date format in payment analytics; review S5 sites. (S4, S5)
5. Fix stock updates with a locked read inside the transaction (`forUpdate`) or an atomic `current_stock = current_stock - ?` with a non-negative guard. (D1)
6. Trace billing/payment creation and add an idempotency key plus a unique constraint on repeat submissions. (D2)
7. Add a CI workflow running `tsc` and `vitest`, and write tests for billing totals, commissions, result validation and inventory concurrency.
8. Verify analyzer message de-duplication and ACK behaviour against a device simulator in a non-production environment. (D4)
9. Enable TypeScript `strict` incrementally; split the oversized controllers.

## 6. Questions needing a product or clinical decision

- Are result edits after approval meant to be blocked, or allowed with an amendment history?
- Is patient merge a required feature, and what are the duplicate-matching rules?
- Should refunds reverse commissions automatically?

## 7. Next step

Please review. Nothing will be changed until you authorize specific items. If you can resend the full brief (sections I onward), I will extend the audit to cover the missing sections and the deeper unverified areas.

---

# 8. Payment Gateway Integrations (PaySwitch, Hubtel, "AySta ck")

**Assumption:** "AySta ck" in the brief is read as **Paystack**. Please confirm. Gateway names were matched case-insensitively across all tracked `.ts/.js/.json/.md` files, excluding `db-exports/` and lockfiles.

**Documentation limitation:** I tried to read the official developer documentation. Paystack returned HTTP 403, PaySwitch's host did not resolve from this machine, and Hubtel's checkout page redirected to a generic landing page. **No provider capability, endpoint, signature scheme, status vocabulary or refund support below is confirmed.** Items marked "(verify)" must be checked against official docs, and sandbox credentials are needed, before any provider-specific design is fixed. No payments were initiated and no credentials were used.

## 8.1 Implementation-status matrix

| Provider | Status | Evidence |
|---|---|---|
| PaySwitch | **Not implemented** | Zero matches for the name in code, config, docs or env templates. |
| Hubtel | **Not implemented** | Only match is `docs/UI-DESIGN-SYSTEM-HUBTEL.md`, a UI design-system document unrelated to payments. No API client, SDK, webhook or env variable. |
| Paystack ("AySta ck") | **Not implemented** | Zero matches. |

No payment SDK exists in `package.json`. The only outbound HTTP integration found is the SMS provider ([Arkesel.ts](src/models/application/integrations/Arkesel.ts)). Statuses are "Not implemented" rather than "Blocked", since there is nothing to assess. Provider documentation access is a separate blocker for design (see above).

## 8.2 Existing payment-related code (none is gateway code)

- **Manual SaaS subscription payments:** `facility_subscription_payments` table, `recordPayment` / `voidPayment` in [FacilityManagementService.ts](src/models/Tenancy/FacilityManagementService.ts). A super-admin types in amount, `reference` (free text, max 100) and paid date. One active payment per exact period is enforced by a unique `active_period_key`, and voids null that key. Status is derived (`paid` / `unpaid` / `overdue`). There is **no provider reference, no status lifecycle, and no verification**.
- **Marketplace manual payment claims:** `marketplace_payment_claims` ([MarketplaceService.ts](src/marketplace/MarketplaceService.ts) around lines 770-830). Patients submit a claimed reference and amount through the public `POST .../bookings/payment-claims`; staff then verify or reject manually (`payment_status`: `unpaid | pending_verification | verified | rejected | refund_pending | refunded`). Facility `payment_instructions` is free text. This is a good pending-versus-verified model, but verification is human, not provider-driven.
- **Patient-portal billing requests:** [PatientBillingRequestService.ts](src/models/patient-portal/PatientBillingRequestService.ts) deliberately refuses payment data; conversion is tests-only with no payments.
- **Core billing:** payment modes are seeded rows such as `Momo` ([05_payment_modes.ts](src/cron/command-line-tool-database/Seeds/05_payment_modes.ts)). These are labels only and carry no provider reference.
- **Accounting:** the `acc_*` posting and idempotency layer ([BillingAccounting.ts](src/accountingModule/integrations/BillingAccounting.ts)) is reusable for gateway-originated entries.
- **Authenticity-check precedent:** `requireLeadWebhookToken` in [marketplaceRouter.ts](src/marketplace/marketplaceRouter.ts) uses `timingSafeEqual` against a configured token, a good pattern for a signature check.
- **Config:** no gateway variables in `.env.example` or in `.env` (key names only inspected). Secrets are read via `process.env`.

## 8.3 Confirmed defects and gaps (per provider, identical for all three)

1. No provider adapter, client, checkout/initiation endpoint, callback/webhook route, status-inquiry call or refund call exists.
2. No table for gateway transactions, provider references, raw callback payloads or status history.
3. No webhook route exempt from `checkTokenExists` / tenant-query checks. Because [app.ts](src/app.ts) applies global auth and `tenantId` resolution before domain routers, a webhook route needs an explicit public mount placed before those middlewares, with its own authenticity check and tenant derivation from the stored transaction (not from the caller).
4. No env template entries for credentials, sandbox/production switching or callback base URL.
5. Subscription activation today is an admin action with a free-text reference, so a future gateway must not be able to bypass or duplicate this path; a unique constraint on provider reference is absent.

## 8.4 Shared architecture proposed (not implemented)

Keep existing layering (controller → service → repository, Knex, `tenantId`).

- `PaymentGatewayService` (provider-neutral) with an `IPaymentGatewayAdapter` interface: `initiate`, `verify(reference)`, `parseAndAuthenticateWebhook(rawBody, headers)`, `refund` (optional), `capabilities`.
- One adapter each: `PaySwitchAdapter`, `HubtelAdapter`, `PaystackAdapter`. Adapters own only provider HTTP, signing and field mapping, and return a **normalized** result `{ providerRef, ourRef, amountMinor, currency, status }`.
- Normalized statuses: `initiated → pending → succeeded | failed | cancelled | expired`, plus `refund_pending → refunded`. Transitions are enforced in one place and every transition is appended to a history table.
- Tables (names indicative): `payment_gateway_transactions` (own reference unique, provider, provider_reference unique per provider, purpose type and id, amount in minor units, currency, status, tenant id, expiry, timestamps), `payment_gateway_events` (append-only raw callbacks with a dedupe hash, verification result), `payment_gateway_status_history`.
- **Payment collection is separate from fulfilment.** A `PaymentFulfilmentHandler` per purpose (subscription period, patient invoice, marketplace booking) runs only on the transition into `succeeded`, inside one DB transaction with a row lock on the gateway transaction and a unique fulfilment key. Accounting posting uses the existing idempotent `acc_*` service.
- Own reference generation: server-generated, unguessable, never accepted from the client. The client only receives a checkout URL or reference.
- Credentials per provider and environment held in server environment or an encrypted store, with a sandbox/production switch. They are never sent to the frontend or logged. The callback URL is built server-side from a configured public base URL.
- Reconciliation job: a scheduler that finds `pending` or unverified transactions older than a threshold and calls the provider's inquiry API, plus an admin report of mismatches (provider says paid, PLS says not, or amount differs).

## 8.5 Transaction-verification and reconciliation risks (to design against)

- Trusting a redirect, client message or webhook body alone. Required: authenticate the webhook per provider (verify), then **independently call the provider inquiry API** before marking success.
- Amount, currency, merchant and reference must be compared with the stored expectation, in minor units, with no floating-point.
- Duplicate, delayed and out-of-order callbacks: use the unique provider reference plus event dedupe hash, and allow only forward status transitions (a late "pending" must not overwrite "succeeded").
- Verification endpoint down: keep the transaction pending, retry with backoff, and surface it in the reconciliation report rather than failing or succeeding silently.
- A single transaction activating a subscription twice: today only the `active_period_key` unique index protects the period; a fulfilment-key unique constraint is also needed.
- Refunds/reversals: support differs by provider (verify); void must also reverse the accounting entry and any commission, consistent with existing void rules.
- Webhook endpoint exposure: needs a rate limit, a body-size cap (global 50 MB is too large), and raw-body capture for signature checks (Express JSON parsing runs first at present).
- Cross-tenant risk: derive tenant from the stored transaction, never from `tenantId` in the callback query.

## 8.6 Security and credential concerns

- `.env` is tracked in git (finding S1). Adding gateway secrets there would commit them. Fix S1 first.
- CORS reflecting any origin with credentials (S2) would expose initiation endpoints to cross-site requests.
- `console.log` is widespread (255 uses); gateway code must log only references and statuses, never keys, signatures, card or phone data.
- Requirements per provider (verify): sandbox vs production base URLs and keys, signing/webhook secret, merchant or account id, callback URLs registered in the provider dashboard, IP allow-listing if offered, HTTPS with a valid public certificate.
- Credential rotation procedure and who holds the secrets need to be a documented decision (see §8.9).

## 8.7 Proposed implementation sequence

| Step | Work | Depends on | Acceptance criteria |
|---|---|---|---|
| 0 | Resolve S1, S2; obtain official docs and sandbox credentials for all three | none | Secrets removed from git and rotated; docs and sandbox access confirmed per provider |
| 1 | Gateway tables + normalized status machine + repository | 0 | Illegal transitions rejected; unique provider ref; history written on every change |
| 2 | `IPaymentGatewayAdapter` + gateway service + config loader | 1 | Adapter contract tests pass against a fake adapter; no credentials reachable from responses or logs |
| 3 | First provider adapter in sandbox (initiate, verify, webhook) | 2 | Sandbox success, failure and pending flows reach correct states via verified inquiry |
| 4 | Webhook route (public, raw body, authenticity, rate limit) | 2 | Forged and replayed callbacks rejected or ignored; tenant derived from stored transaction |
| 5 | Fulfilment handlers (subscription first, then invoices) | 1, 4 | One success activates once; failure and pending never activate; accounting entry posted once |
| 6 | Reconciliation job + admin report | 3, 5 | Stale pending transactions resolved or flagged; mismatches listed |
| 7 | Remaining two adapters | 3 | Same contract and test suite pass for each |
| 8 | Refund/reversal support where the provider supports it | 5, 7 | Refund updates status, accounting reversal and audit trail once |

## 8.8 Safe test cases (sandbox or fake adapter only; never production)

- **Success:** initiate → provider reports success → inquiry confirms matching amount and currency → fulfilled exactly once, receipt and ledger entry once.
- **Failure/cancel/expiry:** each ends non-successful with no activation and an audit entry.
- **Pending:** callback "pending" or inquiry unavailable → stays pending, picked up by reconciliation; never activates.
- **Duplicate callback:** same event delivered 5 times, including concurrently → one fulfilment, one accounting entry.
- **Delayed/out-of-order:** "success" followed by a late "pending" → status stays succeeded; success arriving after expiry job → handled by inquiry result.
- **Unverifiable:** invalid signature, unknown reference, amount or currency mismatch, wrong merchant → rejected, logged, no state change.
- **Client forgery:** client posts "paid" or visits the success redirect URL without provider confirmation → no state change.
- **Verification outage:** inquiry times out, retried with backoff, then flagged.
- **Cross-tenant:** callback carrying another tenant's id → ignored.
- **Secrets:** grep logs and responses to confirm no key or signature content.

## 8.9 Decisions needed from you

- Confirm "AySta ck" = Paystack.
- Which payments does each provider collect (SaaS subscription fees, patient invoices, marketplace bookings, or all)?
- Currency (GHS only?) and whether the platform or each facility owns the merchant account (per-tenant credentials vs platform-level).
- Who supplies sandbox credentials and documentation access?
- Refund policy by provider.

### 8.10 Implementation status (added after approval)

The gateway core and the three adapters are now implemented in `src/payments/`. **None has been exercised against a real provider sandbox**; field names, endpoints and status values come from public API knowledge because the official documentation could not be fetched during development. Treat every adapter as **present but not verified** until the sandbox checklist below passes.

| Provider | Status | Notes |
|---|---|---|
| Paystack (assumed to be "AySta ck") | Implemented, unit-tested with mocked HTTP, not sandbox-verified | Signed webhook (HMAC-SHA512 of raw body), verify API, minor units |
| Hubtel | Implemented, unit-tested with mocked HTTP, not sandbox-verified | Unsigned callback: PLS callback token plus mandatory status-check API; status API may need server IP allow-listing |
| PaySwitch | Implemented, unit-tested with mocked HTTP, not sandbox-verified | No webhook: return route + reconciliation worker; if the status response lacks an amount the payment is flagged for review, never auto-applied |

**What exists**
- Core: `types.ts` (statuses, forward-only transitions), `PaymentGatewayService.ts` (initiate, verify-and-apply, webhook, return, reconcile), `PaymentGatewayRepository.ts` (tables `payment_gateway_transactions`, append-only `payment_gateway_events`, master DB, compare-and-set transitions, one open checkout per period via `open_key`), `SubscriptionPaymentFulfilment.ts` (idempotent via the PLS reference stored on the subscription payment), `PaymentReconciliationWorker.ts` (5 min), `paymentRoutes.ts`.
- Routes: `POST /api/v1/payments/webhooks/:provider` and `GET /api/v1/payments/return/:provider` (raw body, mounted before JSON/licence/auth, rate limited); platform-only `POST /api/v1/platform/facilities/:tenantId/gateway-payments`, `GET /api/v1/platform/payments/providers|transactions|transactions/:reference`, `POST .../transactions/:reference/verify`, `POST /api/v1/platform/payments/reconcile`.
- `FacilityManagementService` gained `quoteSubscriptionPeriod` and `findActivePaymentByReference`.
- Config placeholders were added to `.env.example` (no real values).

**Controls implemented:** amount and currency come from the server quote, never the client; success requires provider API verification with matching amount (and currency when reported); webhook authenticity per provider; a browser redirect is never proof (return route re-verifies and reports the PLS record's status); duplicate callbacks are idempotent; mismatches, unverifiable amounts, refused fulfilment and provider refunds set `needs_review` instead of activating anything; transient provider outages keep the transaction open for the reconciler; expired checkouts accept a late verified payment; every status change is an audit event; secrets are never logged.

**Known gaps / prerequisites before production**
1. Sandbox validation of each adapter against official docs (endpoints, status values, reference length limits, Hubtel IP allow-listing, PaySwitch amount in status response). Run the safe test cases in 8.8 per provider.
2. Provision credentials through a secret store; resolve findings S1/S2 (`.env` tracked in git) first. Set `PAYMENT_PUBLIC_BASE_URL` (HTTPS) and configure the Paystack webhook URL in its dashboard.
3. Refunds are detected only for unsettled transactions and flagged; there is no automatic refund or void. Refund detection on already-settled payments needs a product policy.
4. Initiation is platform-admin only; a tenant self-service checkout and a frontend are not built.
5. Only facility subscription payments are supported; invoice/patient billing is out of scope.
6. Open decisions in 8.9 (provider identity of "AySta ck", currency, per-tenant merchants) still need confirmation.

**Tests:** `src/payments/PaymentGatewayService.test.ts` (17 cases) covers success, failure, pending, duplicate, delayed/late, forged signature/token, client-claimed success, amount/currency/unverifiable amount, outage-then-recovery, refused fulfilment, audit trail, Paystack signature and adapter mappings.
