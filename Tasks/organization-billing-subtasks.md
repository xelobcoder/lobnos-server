# Partner Billing and Pharmacy Implementation Subtasks

This backlog is ordered by dependency. Each task ships behind tenant feature flags and includes role/tenant isolation tests.

## Milestone 0: Product Decisions and Technical Design

- [ ] **M0.1 Resolve commercial policy:** partner markup, cancellation, approval thresholds, sample-before-approval, and result acknowledgement.
- [ ] **M0.2 Resolve pharmacy and POS policy:** reservation timing, substitutions, partial fulfilment, returns/refunds, voids, discounts, taxes, payment methods, cashier shifts, controlled-drug scope, and retention.
- [ ] **M0.3 Confirm role matrix:** organization admin, partner biller, clinician, reviewer, receiver, scientist, signatory, dispenser, storekeeper, pharmacy cashier, pharmacy manager, and cash-shift reviewer.
- [ ] **M0.4 Threat-model partner and pharmacy access:** entity isolation, IDOR prevention, session invalidation, CSRF, rate limiting, PHI logging, POS refund/void abuse, receipt sequencing, and cashier-shift tampering.
- [ ] **M0.5 Approve state machines:** align backend, frontend, audit, and reporting vocabulary for orders, prescriptions, dispensing, POS sales, returns, and cashier shifts with the PRD.
- [ ] **M0.6 Define API schemas:** requests, responses, errors, pagination, idempotency, optimistic concurrency, POS payments, receipts, returns, and shift reconciliation.
- [ ] **M0.7 Produce UX prototypes:** mobile order creation, held-order correction, approval queue, consultation orders, dispensing, POS sale, receipt, return, and cashier shift close; pharmacy prototypes must reuse the internal laboratory shell and established Lobnos interaction patterns.

**Exit:** Release 1 product decisions are closed and signed-off schemas exist.

## Milestone 1: Partner Identity and Portal Foundation

### Backend

- [ ] **M1.1 Add partner account model** with tenant, type, billing entity, status, settings, and audit metadata.
- [ ] **M1.2 Add partner user memberships** with entity-scoped roles and uniqueness constraints.
- [ ] **M1.3 Implement invitation lifecycle:** create, expire, revoke, resend, accept, and first-password setup.
- [ ] **M1.4 Add partner session claims** without accepting tenant or billing entity from client input.
- [ ] **M1.5 Add account suspension** that invalidates active sessions.
- [ ] **M1.6 Add authorization policies** and cross-tenant/cross-entity denial tests.

### Frontend

- [ ] **M1.7 Add `/partner` route and layout** with a shell independent of `PrimeLayout`.
- [ ] **M1.8 Build partner login and activation** with generic authentication errors and accessible validation.
- [ ] **M1.9 Build responsive navigation:** expandable desktop rail, mobile bottom navigation, notifications, and profile menu.
- [ ] **M1.10 Establish portal design tokens** for color, type, spacing, focus, statuses, motion, and print.
- [ ] **M1.11 Create shared states** for loading, actionable empty state, recoverable error, forbidden, and suspended account.
- [ ] **M1.12 Extend middleware routing** so partner users stay under `/partner` and internal roles do not enter it accidentally.

### Validation

- [ ] **M1.13 Test authentication boundaries** for missing, expired, suspended, partner, clinician, and internal sessions.
- [ ] **M1.14 Run responsive/accessibility checks** at 360px, tablet, desktop, keyboard-only, and reduced motion.

**Exit:** pilot partner users can authenticate and see an empty, entity-scoped workspace.

## Milestone 2: Contract Catalogue and Patient Workflow

### Backend

- [ ] **M2.1 Trace and document existing clinician and organization billing-strategy resolution** as the authoritative source for partner service eligibility, pricing, currency, and effective dates.
- [ ] **M2.2 Extract or adapt the existing billing-strategy resolver** so internal billing and the portal use the same authoritative calculation without duplicating pricing data.
- [ ] **M2.3 Add a partner catalogue endpoint** that resolves only currently eligible services and read-only prices from the authenticated entity's existing billing strategy.
- [ ] **M2.4 Add partner patient search** with bounded results and entity/tenant privacy policy.
- [ ] **M2.5 Add patient registration** with normalized identifiers and configurable duplicate matching.
- [ ] **M2.6 Audit price assignment and patient creation** without unnecessary PHI in logs.

### Frontend

- [ ] **M2.7 Link center billing-strategy administration** to the existing clinician/organization configuration; do not create parallel portal price-list management.
- [ ] **M2.8 Build partner patient directory** with search, pagination, and recent patients.
- [ ] **M2.9 Build patient registration** with duplicate warnings and explicit selection of existing matches.
- [ ] **M2.10 Build service catalogue picker** grouped by discipline with search, read-only prices, availability, and preparation notes.

### Validation

- [ ] **M2.11 Test billing-strategy resolution and snapshots** across deactivated, changed, future, current, and past cases; prove portal and internal billing resolve the same price.
- [ ] **M2.12 Test patient isolation and duplicate behavior** including direct-ID attempts.

**Exit:** a partner selects a permitted patient and sees only the catalogue resolved from its current existing billing strategy.

## Milestone 3: Order Drafting and Submission

### Backend

- [ ] **M3.1 Add partner order and line models** with revision, status, source, patient, sample plan, and reference.
- [ ] **M3.2 Add draft CRUD** with ownership checks and optimistic concurrency.
- [ ] **M3.3 Add submission validation** for patient, service, price version, sample plan, and declarations.
- [ ] **M3.4 Snapshot submitted lines and totals** including service name, resolved price, currency, billing-strategy reference, revision, and hash.
- [ ] **M3.5 Make submit idempotent** so retries cannot create duplicate bills.
- [ ] **M3.6 Add order list/detail queries** with filters, paging, activity timeline, and entity scope.

### Frontend

- [ ] **M3.7 Build four-step order workspace** for Patient, Services, Sample Plan, and Review.
- [ ] **M3.8 Add draft autosave and recovery** with saved, saving, and error indicators.
- [ ] **M3.9 Build responsive order summary** with read-only pricing, currency, test count, and total.
- [ ] **M3.10 Build dashboard attention queue** and status metrics from live order data.
- [ ] **M3.11 Build order list** with status, patient, age, total, next action, filters, and mobile rows.
- [ ] **M3.12 Build order detail** with stage tracker, tabs, decision panel, timeline, and documents.

### Validation

- [ ] **M3.13 Test autosave and retries** for stale drafts, refresh, network loss, and double submit.
- [ ] **M3.14 Add end-to-end partner order test** from patient selection through pending approval.

**Exit:** an order reaches `PENDING_APPROVAL` exactly once with an immutable submitted snapshot.

## Milestone 4: Center Approval Workflow

### Backend

- [ ] **M4.1 Add billing decision model** with revision, snapshot hash, action, reason, actor, and time.
- [ ] **M4.2 Implement approve command** with role, revision, transaction, and idempotency checks.
- [ ] **M4.3 Implement hold and reject** with required reason and separate partner-visible/staff-only notes.
- [ ] **M4.4 Implement held-order revision** so edits never mutate the reviewed snapshot.
- [ ] **M4.5 Add approval queue query** with aging, branch, entity, amount, priority, and decision filters.
- [ ] **M4.6 Publish decision notifications** to the partner inbox and optional external channels.

### Frontend

- [ ] **M4.7 Build dense approval queue** with saved filters, aging indicators, and text-start tables.
- [ ] **M4.8 Build split-pane review** with duplicates, contract comparison, test details, total, and timeline.
- [ ] **M4.9 Build approval confirmation** showing the exact revision and total to freeze.
- [ ] **M4.10 Build hold/reject dialogs** with reason, optional note, limits, and focus management.
- [ ] **M4.11 Build held-order correction** with highlighted requests and resubmission summary.
- [ ] **M4.12 Add partner notification center** with unread state and order deep links.

### Validation

- [ ] **M4.13 Test decision races:** duplicate approval, approve-versus-hold, stale revision, mismatch, and unauthorized reviewer.
- [ ] **M4.14 Add end-to-end decision tests** for approve, hold/resubmit, and reject.

**Exit:** every submitted bill gets a traceable decision and approved data cannot be edited in place.

## Milestone 5: Sample Handoff and Processing Guard

### Backend

- [ ] **M5.1 Add specimen plan and identifiers** linked to partner order lines and existing accessions.
- [ ] **M5.2 Add chain-of-custody events** for collect, dispatch, receive, quarantine, reject, and recollect.
- [ ] **M5.3 Implement receipt policy** for approved and policy-permitted pending orders.
- [ ] **M5.4 Add central approval guard service** that verifies order revision and decision snapshot.
- [ ] **M5.5 Apply the guard to every processing entry point** including single, bulk, alternate UI, and direct APIs.
- [ ] **M5.6 Audit blocked processing attempts** with stable reason codes and correlation IDs.
- [ ] **M5.7 Map partner progress states** without exposing draft clinical data.

### Frontend

- [ ] **M5.8 Build partner collection form** for collector, time, specimen IDs, dispatch, and manifest.
- [ ] **M5.9 Build center receiving view** with condition, discrepancies, quarantine, rejection, and custody timeline.
- [ ] **M5.10 Add approval status to laboratory workspaces** with an actionable blocker panel.
- [ ] **M5.11 Disable processing commands consistently** while keeping the API authoritative.
- [ ] **M5.12 Add partner sample timeline** using plain-language states and expected next action.

### Validation

- [ ] **M5.13 Inventory every processing endpoint** and prove each is guarded through integration tests.
- [ ] **M5.14 Add end-to-end handoff tests** for partner collection, center collection, quarantine, and approved processing.

**Exit:** no UI path or direct request starts processing without a valid current approval.

## Milestone 6: Result Validation and Partner Release

### Backend

- [ ] **M6.1 Add report release record** linked to signed report version, order, partner, actor, and time.
- [ ] **M6.2 Enforce signed-and-validated precondition** on release.
- [ ] **M6.3 Add partner report queries/download** limited to released versions and owning entity.
- [ ] **M6.4 Add corrected-report replacement** retaining prior versions and release history.
- [ ] **M6.5 Add report acknowledgement** and notification delivery status.

### Frontend

- [ ] **M6.6 Add Submit to Partner command** with report/version confirmation.
- [ ] **M6.7 Build partner results inbox** with new/corrected state, patient, order, release time, and acknowledgement.
- [ ] **M6.8 Build report viewer/download** with signature metadata and safe print behavior.
- [ ] **M6.9 Show release state in order timeline** without internal validation notes.

### Validation

- [ ] **M6.10 Test unreleased-result denial** through lists, details, guessed IDs, downloads, and corrections.
- [ ] **M6.11 Add end-to-end release test** through partner acknowledgement.

**Exit:** partners access only explicitly released, validated, signed report versions.

## Milestone 7: Structured Consultation and Investigations

### Backend

- [ ] **M7.1 Define structured consultation schema** for notes, diagnoses, plan, follow-up, investigations, and medications.
- [ ] **M7.2 Preserve legacy notes** through a read-only adapter; never parse generated prose as the new source of truth.
- [ ] **M7.3 Add investigation commands** for laboratory and imaging services with indication and priority.
- [ ] **M7.4 Derive billing context from encounter** and validate it on the server.
- [ ] **M7.5 Add narrative renderer** for reports and existing consultation views.
- [ ] **M7.6 Add investigation timeline query** for consultation status.

### Frontend

- [ ] **M7.7 Replace free-text card grid with tabs:** Clinical Note, Investigations, Medications, Plan & Follow-up.
- [ ] **M7.8 Build structured clinical-note editor** with autosave, validation, and narrative preview.
- [ ] **M7.9 Build investigation composer** with service search, indication, priority, summary, and billing confirmation.
- [ ] **M7.10 Embed downstream status timeline** without the generic billing-source chooser.
- [ ] **M7.11 Keep previous consultations accessible** and label legacy narrative records.

### Validation

- [ ] **M7.12 Test legacy display and new record round-trip** without data loss.
- [ ] **M7.13 Add end-to-end investigation test** from consultation to downstream status.

**Exit:** clinicians create structured investigations without re-entering billing context.

## Milestone 8: Pharmacy Inventory

### Backend

- [ ] **M8.1 Bootstrap inventory defaults:** when a tenant has no categories, create the standard category set including mandatory `Pharmacy`; always ensure `Pharmacy` exists, create `System Default Supplier` only when no supplier exists, and create a unique default brand whenever an inventory item is created. Every pharmacy medicine is a standard inventory item in `Pharmacy`, while laboratory sensitivity drugs remain separate.
- [ ] **M8.2 Extend existing inventory branch/location and batch stock** for pharmacy expiry, on-hand, reserved, quarantined, and available quantities.
- [ ] **M8.3 Extend existing inventory receipt, adjustment, and immutable movement workflows** with pharmacy permissions and reasons.
- [ ] **M8.4 Implement FEFO availability over existing inventory batches** excluding expired, quarantined, and inactive stock.
- [ ] **M8.5 Add low-stock and near-expiry queries** with configurable thresholds.
- [ ] **M8.6 Add opening-balance import** with validation, dry run, and signed import report.
- [ ] **M8.7 Define pharmacy-only, laboratory-only, and combined facility/branch capabilities** with feature flags, role-scoped authorization, and navigation rules that retain the existing internal laboratory application shell and hide only unauthorized module links.

### Frontend

- [ ] **M8.8 Reuse the existing Inventory Items workspace for pharmacy medicines** with `Pharmacy` preselected and required, inventory quantity, unit, barcode/SKU, stock thresholds, location, and pharmacy sale price.
- [ ] **M8.9 Build batch receiving workspace** with expiry, location, quantity, unit cost, and labels.
- [ ] **M8.10 Build stock ledger** with movement filters and immutable source links.
- [ ] **M8.11 Build low-stock and near-expiry queues** with export and action filters.

### Validation

- [ ] **M8.12 Test stock invariants** so available equals on-hand minus reserved and quantities never become negative.
- [ ] **M8.13 Reconcile opening balances** against signed source totals before enablement.

**Exit:** each pilot branch has trusted pharmacy stock through the existing inventory system, by item, location, batch, and expiry.

## Milestone 9: Prescribing and Dispensing

### Backend

- [ ] **M9.1 Add prescription and line models** with dose instructions, source, status, and signature.
- [ ] **M9.2 Validate prescriptions** for required fields, allergies, duplicates, active item, and permissions.
- [ ] **M9.3 Implement immutable signing** plus discontinue/reorder for changes.
- [ ] **M9.4 Implement internal reservation through existing inventory** with transactional FEFO batch allocation.
- [ ] **M9.5 Implement full and partial dispense** with identity check, batches, movement, and remainder.
- [ ] **M9.6 Implement cancellation and release** plus authorized return movements.
- [ ] **M9.7 Implement external issue** that creates a document and never creates an inventory reservation or movement.
- [ ] **M9.8 Add concurrency controls** preventing over-reservation and over-dispensing.

### Frontend

- [ ] **M9.9 Build medication composer** for drug, strength, dose, route, frequency, duration, quantity, instructions, and source.
- [ ] **M9.10 Show safety warnings** for allergies, duplicates, unavailable items, and incomplete dosing.
- [ ] **M9.11 Build dispensary queue** ordered by priority and waiting time with branch filters.
- [ ] **M9.12 Build dispense workspace** with patient banner, safety context, batches, partial fulfilment, and confirmation.
- [ ] **M9.13 Build external prescription document** with prescriber, patient, instructions, signature, and print layout.
- [ ] **M9.14 Add patient/consultation status** for reserved, ready, partial, dispensed, unavailable, and external.

### Validation

- [ ] **M9.15 Add concurrency tests** for reserve, dispense, cancel, and adjustment operations.
- [ ] **M9.16 Add end-to-end internal test** from signed prescription to stock movement.
- [ ] **M9.17 Add end-to-end external test** proving no reservation or stock movement occurs.

**Exit:** internal dispensing is auditable and stock-safe; external prescriptions are inventory-neutral.

## Milestone 10: Pharmacy Point of Sale

### Backend

- [ ] **M10.1 Add `pharmacy_`-prefixed POS tables** for sale headers, sale lines, payments, returns, and cashier shifts; reference existing inventory records rather than duplicating them.
- [ ] **M10.2 Implement pharmacy POS catalogue and price resolution** for active pharmacy inventory items, branch/location availability, barcode lookup, and policy-controlled discounts/taxes.
- [ ] **M10.3 Implement sale creation and completion** with idempotency, transactional FEFO allocation, inventory issue movement, receipt sequencing, and patient/prescription linkage.
- [ ] **M10.4 Implement cashier shifts** with open, close, expected/count totals, variance reason, and authorized review.
- [ ] **M10.5 Implement voids, returns, and refunds** with state rules, permissions, immutable records, and explicit inventory reversal movements.
- [ ] **M10.6 Enforce prescription quantity and sale concurrency controls** so POS and dispensary cannot sell or issue the same remaining quantity twice.
- [ ] **M10.7 Add pharmacy-only and combined-facility authorization policies** for cashier, pharmacy manager, storekeeper, dispenser, and prescriber roles.

### Frontend

- [ ] **M10.8 Build pharmacy POS sale workspace** within the existing internal Lobnos/laboratory shell, reusing established navigation, tables, forms, dialogs, loading, error, and accessibility patterns for barcode/search entry, patient and prescription lookup, quantity editing, payment, receipt, and availability feedback.
- [ ] **M10.9 Build cashier shift open/close and reconciliation views** with variance handling and supervisor review.
- [ ] **M10.10 Build completed-sale detail, receipt, void, return, and refund workflows** with role-aware actions and immutable history.
- [ ] **M10.11 Apply facility capability and role scope** so pharmacy-only users can operate the pharmacy without laboratory links, while combined facilities can use both workspaces in the same internal Lobnos shell.

### Validation

- [ ] **M10.12 Test POS stock and financial invariants** for sale completion, failed payment, void, return, refund, discount, tax, and shift variance.
- [ ] **M10.13 Add concurrency tests** across POS sale, prescription dispense, reservation, return, and inventory adjustment.
- [ ] **M10.14 Add end-to-end tests** for pharmacy-only over-the-counter sales, patient-linked prescription sales, and combined laboratory/pharmacy role access.

**Exit:** authorized pharmacy users can complete auditable retail sales without laboratory access, and combined facilities share the same stock-safe pharmacy workflows.

## Milestone 11: Reporting, Hardening, and Rollout

- [ ] **M11.1 Build dashboards** for approval aging, partner volume, rejection reasons, TAT, acknowledgement, stock, expiry, dispensing, POS sales, returns, and cashier variance.
- [ ] **M11.2 Add audit explorer** with actor, subject, action, date, and correlation filters.
- [ ] **M11.3 Add monitoring and alerts** for failed decisions, guard conflicts, notification failures, stock errors, POS payment/receipt failures, cashier-shift variance, and release failures.
- [ ] **M11.4 Complete performance testing** for search, queues, order detail, report download, dispense transactions, POS completion, and shift close.
- [ ] **M11.5 Complete accessibility audit** for core desktop/mobile workflows and remediate WCAG 2.2 AA failures.
- [ ] **M11.6 Complete penetration/privacy review** including entity access, IDOR, sessions, and sensitive logs.
- [ ] **M11.7 Create runbooks** for recovery, stuck orders, reversal policy, report correction, reconciliation, and rollback.
- [ ] **M11.8 Train pilot users** and capture completion time, errors, and support questions.
- [ ] **M11.9 Run pilot reconciliation** across bills, samples, reports, and stock movements.
- [ ] **M11.10 Roll out by feature flag** with checkpoints and a named rollback decision owner.

**Exit:** operational owners approve production rollout and monitoring confirms data integrity.

## Cross-Cutting Test Matrix

Each applicable milestone covers:

- [ ] Happy path and empty state.
- [ ] Validation and recoverable API errors.
- [ ] Unauthorized role, wrong tenant, and wrong partner entity.
- [ ] Direct URL and guessed resource ID access.
- [ ] Duplicate requests and idempotent retry.
- [ ] Stale version and concurrent command conflict.
- [ ] Audit contents without secret or unnecessary PHI leakage.
- [ ] Pharmacy-only, laboratory-only, and combined facility capability and role boundaries.
- [ ] POS price, payment, receipt, void, return/refund, stock allocation, and cashier-shift reconciliation invariants.
- [ ] Pharmacy UI consistency with internal laboratory shell, navigation, components, responsive behavior, keyboard flow, and accessibility states.
- [ ] Desktop, tablet, and 360px mobile layouts.
- [ ] Keyboard navigation, focus restoration, labels, errors, and contrast.
- [ ] Loading, slow network, interruption, and refresh recovery where relevant.

## Suggested Release Slices

| Release | Milestones | User value |
| --- | --- | --- |
| Release 1 | M0-M4 | Partners create bills; center reviews and decides |
| Release 2 | M5-M6 | Approved orders move through samples to released results |
| Release 3 | M7 | Consultation creates structured investigations |
| Release 4 | M8-M9 | Prescriptions support internal dispensing and external issue |
| Release 5 | M10 | Pharmacy POS for pharmacy-only and combined facilities |
| Hardening | M11 throughout | Secure, accessible, observable production rollout |