# Product Requirements Document

## Partner Billing, Laboratory Handoff, and Pharmacy

**Status:** Draft for product and engineering review  
**Owner:** Product / PrimeLab Systems  
**Target product:** Prime Laboratory Software (PLS)\
**Last updated:** 2026-09-01

## 1. Executive Summary

PLS supports staff selecting an organization or clinician as a billing source, but those partners do not have a purpose-built workflow for creating and tracking their own orders. The proposed Partner Workspace gives each approved organization or clinician a secure, entity-scoped portal for patient registration, laboratory ordering, billing submission, sample handoff, and result retrieval.

The center remains the operational authority. It owns contract prices, approves or rejects submitted bills, receives or collects samples, performs testing, validates and signs results, and releases final reports. Laboratory processing is blocked at the API and UI levels until a bill is approved.

The initiative also replaces consultation's note-only downstream workflow with structured **Investigations** and **Medications** workspaces. Medication orders can be fulfilled internally through a stock-controlled dispensary or issued as external prescriptions.

## 2. Problem Statement

### Current Problems

- Partner-originated requests use internal billing screens with controls and terminology intended for center staff.
- A partner cannot securely log in and see only its own patients, bills, samples, and results.
- Contract pricing, approval status, and laboratory readiness are not presented as one controlled workflow.
- There is no explicit bill-approval gate before every laboratory processing entry point.
- Consultation compiles clinical sections into text and redirects users to general billing for laboratory orders.
- Existing drug data supports laboratory culture testing; it is not a pharmacy catalogue and has no stock, batch, expiry, prescription, or dispensing lifecycle.

### Opportunity

Create a fast external ordering experience while strengthening center control, auditability, turnaround-time visibility, and inventory accountability.

## 3. Goals and Success Measures

### Goals

1. Let approved organizations and clinicians authenticate with their own credentials.
2. Let partners create patient orders using a center-assigned price list.
3. Route every submitted bill through a center approval queue.
4. Prevent sample processing until financial approval is valid.
5. Give partners a clear, read-only view of sample and result progress.
6. Release only validated, signed results to the originating partner.
7. Add structured investigation and medication orders to consultation.
8. Support internal dispensing with stock control and external prescriptions without stock movement.
9. Support pharmacy point-of-sale for over-the-counter and prescription medicine sales using the existing inventory system.
10. Allow a tenant or branch to operate laboratory, pharmacy, or both capabilities with role-scoped access.

### Initial Success Measures

| Measure | Target after 90 days |
| --- | ---: |
| Partner orders created without center re-entry | >= 90% |
| Submitted bills decided within the business SLA | >= 95% |
| Successful processing attempts before approval | 0 |
| Released reports containing validation and signature metadata | 100% |
| Internal medication issues linked to a signed prescription | 100% |
| Partner support tickets caused by unclear order status | < 5% of partner orders |

## 4. Users and Roles

| Role | Purpose | Core permissions |
| --- | --- | --- |
| Organization administrator | Manages the partner account | Manage partner users, view all entity records, submit orders |
| Organization billing officer | Registers and bills patients | Create/edit drafts, submit bills, respond to holds |
| Clinician partner | Refers patients directly | Create and track own referrals, retrieve released results |
| Center billing reviewer | Controls financial acceptance | Approve, hold, reject, and audit submitted bills |
| Phlebotomist / receiving officer | Handles specimens | Record collection or receipt after approval |
| Scientist | Performs laboratory workflow | Validate sample, process, enter results |
| Result validator / signatory | Authorizes results | Validate, sign, and submit final reports |
| Prescriber | Creates clinical orders | Add investigations and medication prescriptions |
| Dispensary officer | Fulfils internal prescriptions | Reserve, issue, partially dispense, or decline stock |
| Storekeeper | Controls pharmacy inventory | Manage items, batches, receipts, adjustments, and expiry |
| Pharmacy cashier | Processes pharmacy sales | Create sales, collect payment, print receipts, and open/close assigned shifts |
| Pharmacy manager | Oversees pharmacy operations | Manage pharmacy locations, prices, cashier shifts, returns, voids, and pharmacy reports |
| Administrator | Configures and audits the system | Partner activation, price assignment, policy, reporting |

### Data Access Rule

Every partner request derives `tenantId` and `billingEntityId` from the authenticated session. The API must not trust an entity identifier supplied only by the browser. Center users retain role-based access within their tenant.

## 5. Scope

### In Scope

- Partner invitation, activation, login, password reset, suspension, and user management.
- Separate organization and clinician experiences backed by shared partner components.
- Portal access to the existing center-owned clinician and organization billing strategies, including their effective pricing and service availability.
- Patient search/registration and duplicate warning.
- Draft, submission, approval, hold, rejection, revision, and cancellation lifecycle.
- Sample collection-at-partner or collection-at-center instructions.
- Approval guard on sample validation, processing, and result-entry initiation.
- Partner order tracking and notification history.
- Validated, signed report submission and download.
- Structured investigation and medication ordering from consultation.
- Internal and external medication fulfilment.
- A mandatory `Pharmacy` inventory category. Pharmacy medicines are standard inventory items in this category, with inventory quantity and pharmacy sale price; no separate pharmacy drug catalogue is created.
- Inventory bootstrap creates the standard category set for a tenant with no categories, ensures `Pharmacy` exists, creates `System Default Supplier` only when no supplier exists, and assigns each new inventory item a unique default brand that staff may later replace or supplement.
- Pharmacy point-of-sale for walk-in, patient-linked, prescription, and over-the-counter sales, with receipts, payments, returns, voids, and cashier shift reconciliation.
- Facility and branch capability configuration so authorized roles can operate laboratory only, pharmacy only, or both without seeing irrelevant workspaces.
- Audit trail for security-sensitive and clinical/financial status changes.

### Out of Scope for Initial Releases

- Online card or mobile-money collection from partner patients.
- Insurance claims adjudication.
- Automated courier routing or GPS tracking.
- Controlled-drug regulatory workflows beyond standard audit and role controls.
- Supplier procurement and accounts payable redesign.
- Partner-defined test catalogues or modification of center contract prices.

## 6. Product Principles

1. **One obvious next action:** each order shows its current owner, blocker, and next action.
2. **Server-enforced safety:** UI locks explain policy; APIs enforce it.
3. **Immutable decisions:** approval records preserve line items, prices, actor, time, and reason.
4. **Progressive disclosure:** partners see simple operational language; center staff retain detailed LIMS stages.
5. **Accessible by default:** keyboard operation, visible focus, semantic labels, and WCAG 2.2 AA contrast.
6. **No hidden stock movement:** every reservation, issue, reversal, and adjustment is traceable.
7. **One internal PLS experience:** pharmacy is an internal module and uses the same application shell, navigation, visual tokens, component patterns, command behavior, loading states, and accessibility standards as laboratory operations. Only the external partner workspace has a separate product surface.

## 7. Information Architecture and Routes

### Partner Workspace

Use a dedicated route boundary and layout instead of `PrimeLayout`:

```text
/partner/login
/partner/dashboard
/partner/patients
/partner/patients/new
/partner/orders
/partner/orders/new
/partner/orders/[orderId]
/partner/results
/partner/team                 organization administrators only
/partner/settings
```

The session contains `partnerType: organization | clinician`, so the same route surface can apply the correct permissions and wording. Clinician users see “My referrals”; organization users see “Our orders”.

### Center Operations

Pharmacy uses the existing internal PLS application shell and route layout used by laboratory operations. It must not introduce a separate portal shell, visual language, or navigation paradigm. Pharmacy-only users see only their authorized pharmacy navigation; combined-facility users see pharmacy alongside their existing laboratory navigation according to role and feature configuration.

```text
/billing/partner-approvals
/billing/partner-approvals/[orderId]
/operations/laboratory/...   existing laboratory workflow, guarded
/doctor/consultation/[clientId]
/pharmacy/dispensary
/pharmacy/prescriptions/[prescriptionId]
/pharmacy/pos
/pharmacy/pos/sales/[saleId]
/pharmacy/pos/shifts
/inventory/pharmacy/items
/inventory/pharmacy/batches
```

## 8. User Experience Specification

### Visual Direction: Partner Workspace

The partner portal must look and behave as a separate product surface, not as a recolored internal dashboard.

- **Character:** calm clinical operations desk; precise, bright, and document-led.
- **Shell:** slim white top bar with partner identity, branch switcher, notifications, help, and profile; compact left rail on desktop; bottom navigation on mobile.
- **Palette:** ink `#172126`, teal `#087F73`, signal green `#2D7A46`, amber `#B66A09`, red `#B42318`, cool canvas `#F4F7F6`, and white surfaces. Avoid a blue/purple-dominant theme.
- **Typography:** “Manrope” for interface text and “Source Serif 4” only for report titles and patient/result emphasis. Use approved loading and robust fallbacks.
- **Shape:** 6px controls and panels; no pill-shaped general buttons; status badges may be pills.
- **Density:** operationally compact. Prefer tables, split panes, and timelines over decorative cards.
- **Motion:** a short page-entry fade and staged status updates only; respect `prefers-reduced-motion`.
- **Icons:** Remix Icon, matching the existing dependency. Icon-only actions require tooltips and accessible names.

### Visual Direction: Pharmacy Workspace

The pharmacy workspace is an internal PLS module and must remain visually and behaviorally consistent with existing laboratory workspaces.

- **Shell and navigation:** use the existing internal application shell, desktop/sidebar behavior, mobile navigation behavior, and role-aware navigation patterns; do not use the separate Partner Workspace shell.
- **Components:** reuse established PLS table, form, modal, command, notification, loading, empty, error, and confirmation patterns before introducing pharmacy-specific components.
- **Visual system:** use the internal application typography, spacing scale, control sizes, panel treatment, icon library, focus treatment, and status semantics. Pharmacy-specific color can clarify stock or payment state, but it cannot replace the shared internal visual language.
- **Workflow density:** match laboratory operations with compact queues, text-start tables, predictable filters, clear primary commands, and stable detail views suitable for repeated staff use.
- **Responsive behavior:** pharmacy POS, stock, dispensing, and shift screens must follow the same mobile/tablet breakpoints and accessibility behavior as laboratory operational screens.

### Navigation Model

Desktop uses a 72px icon rail that expands to 232px. The active section combines an icon, label, and 3px teal indicator. Mobile uses four primary bottom destinations: Home, Orders, Patients, Results; secondary actions live under More.

### Dashboard

- “Needs your attention” appears first: returned bills, missing sample details, and newly released results.
- Compact metrics show Draft, Awaiting decision, Sample in progress, and Results ready.
- Recent orders use a text-start table with patient, order number, submitted time, amount, status, and next action.
- A persistent **New order** command is available in the header and does not cover content on mobile.

### New Order

Use a focused four-step workspace with a fixed summary rail on desktop and collapsible summary on mobile:

1. Patient: find existing or register a new patient.
2. Services: searchable test catalogue grouped by discipline; prices are visible but read-only.
3. Sample plan: collected by partner or collected at center; show container and preparation guidance.
4. Review: totals, partner reference, notes, and submission declaration.

Autosave drafts and preserve progress after refresh. Validation appears inline and in a summary at the top. Submission requires an idempotency key to prevent duplicate bills.

### Order Detail

- Horizontal stage tracker on desktop and vertical timeline on mobile.
- Header shows order number, patient, status, total, and one primary next action.
- Tabs: Overview, Tests & Samples, Activity, Documents.
- Held orders show the center's reason in an amber action panel with **Edit and resubmit**.
- Rejected orders are read-only; **Duplicate as new order** is available when policy permits.
- Financial decisions and clinical results are visually separate.

### Center Approval Queue

- Dense table with saved filters for age, partner, amount, branch, priority, and sample location.
- Split-pane review keeps the queue visible while showing patient, duplicate, price, and test details.
- Approve is a clear command; Hold and Reject require a reason dialog.
- Bulk approval is excluded initially because each bill requires deliberate review.
- Keyboard shortcuts may accelerate navigation but are never the only control.

### Consultation Workspace

Replace the grid of free-text cards as the primary model with task-focused tabs:

- **Clinical Note:** structured history and examination fields, with a generated narrative preview.
- **Investigations:** searchable order composer, selected tests, clinical indication, priority, and order state.
- **Medications:** medication search, dose, route, frequency, duration, quantity, instructions, and internal/external fulfilment.
- **Plan & Follow-up:** diagnoses, advice, follow-up date, and referrals.

Keep old consultation records readable through a legacy adapter. New structured data is the source of truth; narrative text is generated for reports rather than parsed back into fields.

### Dispensary Queue

- Work queue ordered by clinical priority and waiting time.
- Prescription detail shows patient safety banner, allergy warning, prescriber, medication lines, available stock, and fulfilment source.
- Internal lines support full or partial dispensing and substitution only when policy and permissions allow.
- External lines produce a printable prescription and are marked “Issued externally”; they never reserve stock.

### Pharmacy Point of Sale

- Pharmacy-only facilities can use the pharmacy routes and roles without enabling laboratory or partner-portal workflows; combined facilities use the same pharmacy workflows alongside laboratory operations.
- Cashiers create an over-the-counter sale or attach an identified patient and an eligible signed prescription.
- The sale workspace supports barcode/search item entry, quantity changes, pharmacy price resolution, discounts allowed by policy, payment capture, receipt printing, and clear stock availability feedback.
- Completing a sale posts an immutable pharmacy stock issue through the existing inventory system; a void before completion posts no movement, while an approved return posts a separate reversal movement.
- Cashiers open and close shifts with opening float, expected amount, counted amount, variance reason, and supervisor review where policy requires.
- Prescription dispensing and point-of-sale use the same inventory availability, FEFO allocation, stock movement, audit, and concurrency controls; a prescription can only be sold/dispensed once for a given remaining quantity.

### Responsive and Accessibility Acceptance

- Support 360px mobile through wide desktop without horizontal page overflow; data tables may scroll within their region.
- Touch targets are at least 44px on mobile.
- Status is never communicated by color alone.
- Focus order follows visual order; dialogs trap and restore focus.
- Form errors are programmatically associated with fields.
- Monetary values align consistently and include currency.
- Loading uses skeleton rows for queues and contained spinners for commands; empty and error states provide recovery actions.

## 9. Functional Requirements

### FR-1 Partner Identity and Access

- Admin can invite an organization or clinician user against one billing entity.
- Invitations expire and can be revoked or resent.
- First login requires password setup and acceptance of terms.
- Suspending an entity or individual user invalidates active sessions.
- Organization administrators can invite users only within their entity and assign allowed partner roles.
- Authentication errors do not reveal whether an account exists.

### FR-2 Billing Strategy and Portal Catalogue

- Existing clinician and organization billing strategies remain authoritative for partner service eligibility, pricing, currency, and effective dates.
- A partner account is linked to one billing entity; the server resolves that entity's applicable existing billing strategy and does not accept it from the browser.
- Partner sees only currently eligible services and read-only resolved prices through a portal catalogue adapter.
- Draft prices refresh from the existing billing strategy until submission; submission records a resolved pricing snapshot and the strategy context used.
- Approval evaluates the submitted snapshot and flags any mismatch with the currently effective strategy.
- A billing-strategy change never silently alters a submitted or approved bill.

### FR-3 Patient and Order Creation

- Partner can search permitted patients and register a patient with required demographic fields.
- Potential duplicates appear before creation using configured matching rules.
- An order may contain one or more active contract services.
- Partner can save a draft, remove lines, add clinical notes, select sample plan, and provide its own reference.
- Submission validates patient, service availability, price version, sample plan, and required declarations.

### FR-4 Billing Decision

- Submission changes `DRAFT` to `PENDING_APPROVAL` and makes the revision read-only.
- Reviewer can `APPROVE`, `HOLD`, or `REJECT`.
- Hold and reject require a reason code plus optional note.
- Hold returns the order for correction. Resubmission creates a new revision and preserves history.
- Rejection is terminal for that revision.
- Approval records reviewer, timestamp, note, line snapshot, total, currency, and revision.
- The partner receives an in-app notification for each decision.

### FR-5 Sample Handoff and Laboratory Guard

- For partner collection, record collection time, collector, specimen identifiers, and dispatch time.
- For center collection, phlebotomy records collection through the existing workflow.
- Receiving staff records receipt, condition, and chain-of-custody event.
- Receipt may be recorded while review is pending if policy permits, but validation and processing remain blocked.
- Processing endpoints return a conflict when approval is absent, stale, revoked, or for another revision.
- UI shows the exact blocking reason and links authorized staff to the approval record.

### FR-6 Result Release

- Scientists enter results through the existing laboratory workflow.
- An authorized validator completes validation and signature.
- A separate **Submit to partner** action records who released the final report and when.
- Only the latest released, signed version is visible in the Partner Workspace.
- Corrected reports retain prior versions and identify the replacement.
- Partner view, download, and acknowledgement actions are audited.

### FR-7 Structured Investigations

- Prescriber can add laboratory and imaging investigations from consultation.
- Each investigation stores service, indication, priority, notes, and requesting clinician.
- The system creates the downstream order without re-entry in a generic billing-source chooser.
- Billing source and entity derive from encounter context and are shown for confirmation.
- Investigation status appears in the consultation timeline.

### FR-8 Medication Prescription

- Prescriber selects medication, form/strength, dose, unit, route, frequency, duration, quantity, instructions, and fulfilment source.
- The system checks allergies, duplicate active medications, and completeness before signing.
- Signed prescriptions are immutable; changes use discontinue/reorder with audit history.
- Mixed prescriptions may contain internal and external lines.
- External lines produce a prescription document and do not affect stock.

### FR-9 Pharmacy Inventory and Dispensing

- Pharmacy stock is separate from laboratory antimicrobial sensitivity drug data.
- Items support generic name, brand, form, strength, unit, pack size, barcode, reorder level, and active status.
- Stock is maintained by branch, location, batch, expiry, on-hand, reserved, and unit cost.
- Internal prescriptions reserve eligible stock using FEFO (first-expiry, first-out).
- Dispensary can fully dispense, partially dispense, decline with reason, or mark unavailable.
- Issue posts an immutable movement linked to prescription, patient, dispenser, batch, and quantity.
- Cancellation releases reservations; returns use separate authorized movements.
- Expired, quarantined, or insufficient stock cannot be issued.

### FR-10 Pharmacy Point of Sale and Facility Operations

- Tenants and branches can enable laboratory, pharmacy, or both capabilities; navigation, commands, and authorization follow the enabled capability and assigned role.
- Authorized pharmacy cashiers can sell eligible active pharmacy inventory items over the counter or against a patient and signed prescription.
- Sales capture item, quantity, resolved pharmacy sale price, allowed discount, tax where configured, payment method, cashier, branch/location, receipt number, and timestamp.
- Completing a sale atomically allocates available eligible stock using FEFO and posts an immutable inventory issue movement; expired, quarantined, inactive, and insufficient stock cannot be sold.
- A sale cannot exceed the remaining quantity of an attached prescription. Over-the-counter sales have no prescription requirement.
- Voids are allowed only before completion; completed sales use role-authorized returns/refunds that create explicit reversal records and inventory movements.
- Cashiers operate within auditable shifts with opening float, expected and counted totals, variance reason, and approval rules defined by tenant policy.
- Pharmacy POS financial records, receipt sequence, returns, voids, discounts, and shifts are auditable and cannot be destructively edited.

### FR-11 Notifications and Audit

- In-app notifications cover bill decisions, sample receipt exceptions, released results, and prescription readiness.
- Email/SMS can be enabled by tenant policy without blocking the core action.
- Audit records actor, role, tenant, entity, action, subject, prior/new status, reason, time, and correlation ID.
- Audit records are append-only and available only to authorized center users.

## 10. State Models

### Partner Order

```text
DRAFT -> PENDING_APPROVAL
PENDING_APPROVAL -> APPROVED | ON_HOLD | REJECTED
ON_HOLD -> DRAFT_REVISION -> PENDING_APPROVAL
APPROVED -> SAMPLE_EXPECTED -> SAMPLE_RECEIVED -> IN_PROCESS
IN_PROCESS -> RESULT_ENTERED -> RESULT_VALIDATED -> RELEASED_TO_PARTNER
```

`CANCELLED` may be reached from draft, pending, hold, or approved-before-processing subject to permissions. A processed order cannot be deleted.

### Prescription

```text
DRAFT -> SIGNED
SIGNED + external line -> ISSUED_EXTERNAL
SIGNED + internal line -> RESERVED -> READY -> PARTIALLY_DISPENSED | DISPENSED
RESERVED -> UNAVAILABLE | CANCELLED
PARTIALLY_DISPENSED -> DISPENSED | CANCELLED_REMAINDER
```

## 11. Data Model Outline

| Entity | Key fields |
| --- | --- |
| PartnerAccount | id, tenantId, type, billingEntityId, status, settings |
| PartnerUser | id, partnerAccountId, identityId, role, status, lastLoginAt |
| Existing billing strategy | Existing clinician/organization billing strategy and pricing configuration; remains authoritative for eligible services, pricing, currency, and effective dates |
| PartnerOrder | id, tenantId, partnerAccountId, billingStrategyReference, patientId, revision, status, samplePlan, reference |
| PartnerOrderLine | orderId, serviceId, serviceNameSnapshot, priceSnapshot, currency, billingStrategyReference |
| BillingDecision | orderId, revision, decision, reasonCode, note, actorId, decidedAt, snapshotHash |
| ChainOfCustodyEvent | orderId, specimenId, event, actorId, location, occurredAt, condition |
| PartnerReportRelease | orderId, reportVersionId, signedBy, releasedBy, releasedAt, acknowledgedAt |
| InvestigationOrder | consultationId, patientId, serviceId, indication, priority, status |
| Prescription | consultationId, patientId, prescriberId, status, signedAt |
| PrescriptionLine | prescriptionId, medicationId, dose details, quantity, fulfilmentSource, status |
| Existing inventory item | Standard inventory item in the mandatory `Pharmacy` category, with pharmacy sale price; laboratory sensitivity-drug data remains separate |
| Existing inventory stock/batch | Existing inventory location and batch records extended as needed for pharmacy expiry, reservation, and FEFO allocation |
| Existing inventory movement | Existing immutable inventory movement records linked to prescription lines, patient, dispenser, batch, and reason |
| Pharmacy sale | `pharmacy_sales`: sale header with patient/prescription links, status, totals, payment summary, cashier, receipt, and completed/voided timestamps |
| Pharmacy sale line | `pharmacy_sale_lines`: pharmacy inventory item, quantity, charged-price snapshot, and return quantities |
| Pharmacy payment | `pharmacy_payments`: sale payment method, amount, reference, status, received/refunded timestamps, and actor |
| Pharmacy shift | `pharmacy_shifts`: cashier, branch/location, opening float, expected and counted totals, variance, status, and approval metadata |

All records include standard created/updated metadata. All new pharmacy-owned database tables begin with `pharmacy_`; existing inventory tables retain their established names and are referenced rather than duplicated. Financial, signature, decision, stock-movement, POS sale, payment, return, and shift records use append-only history instead of destructive updates.

## 12. API Contract Outline

Use the existing authenticated API utilities from the UI, but add resource-oriented endpoints with server-side tenant and entity scoping.

```text
POST   /partner/auth/invitations
GET    /partner/catalog/services          # resolved from the existing billing strategy
GET    /partner/patients/search
POST   /partner/patients
POST   /partner/orders
PUT    /partner/orders/:id/draft
POST   /partner/orders/:id/submit
GET    /partner/orders
GET    /partner/orders/:id

GET    /partner-billing/approvals
POST   /partner-billing/orders/:id/approve
POST   /partner-billing/orders/:id/hold
POST   /partner-billing/orders/:id/reject

POST   /laboratory/orders/:id/specimens/receive
POST   /laboratory/orders/:id/processing/start
POST   /laboratory/orders/:id/reports/release

POST   /consultations/:id/investigations
POST   /consultations/:id/prescriptions
POST   /prescriptions/:id/sign
POST   /dispensary/prescriptions/:id/reserve
POST   /dispensary/prescriptions/:id/dispense
POST   /pharmacy/pos/shifts/open
POST   /pharmacy/pos/shifts/:id/close
GET    /pharmacy/pos/catalog
POST   /pharmacy/pos/sales
POST   /pharmacy/pos/sales/:id/complete
POST   /pharmacy/pos/sales/:id/void
POST   /pharmacy/pos/sales/:id/returns
```

Decision, submission, release, dispense, sale completion, void, return, and shift-close commands require idempotency keys. Conflicting state transitions return `409` with a stable machine-readable reason.

## 13. Security, Privacy, and Reliability

- Extend middleware and backend authorization for partner roles and `/partner` routes.
- Keep session cookies HTTP-only, secure in production, and same-site according to deployment topology.
- Enforce tenant, branch, partner entity, patient, and role access on every endpoint.
- Do not expose internal cost, margin, other partners, staff-only comments, or unreleased results.
- Rate-limit authentication and high-volume search endpoints.
- Protect state-changing commands against CSRF according to the cookie strategy.
- Encrypt protected health information in transit and according to platform storage policy.
- Log authorization failures without logging clinical payloads or credentials.
- Approval and dispense commands use transactions and optimistic concurrency/version checks.
- Define backup, restore, retention, and report-version recovery before production launch.

## 14. Reporting and Analytics

- Orders by partner, status, branch, and period.
- Approval turnaround time and aging queue.
- Hold/rejection reasons and resubmission rate.
- Sample receipt and laboratory turnaround by partner.
- Released-result acknowledgement rate.
- Pharmacy stock on hand, near-expiry, stockout, consumption, and dispensing turnaround.
- Tables are text-start aligned except numeric columns, which are end-aligned.

## 15. Acceptance Criteria by Epic

### Partner Billing MVP

- An active partner can log in and cannot navigate into internal staff routes.
- The user creates orders only from assigned active services and prices.
- Submission appears in the center approval queue exactly once.
- Hold and rejection cannot be saved without a reason.
- Editing a held order creates a new revision and requires a new decision.
- One partner cannot retrieve another partner's order by changing an ID.

### Laboratory Handoff

- Processing start fails in UI and API until the current order revision is approved.
- Approval status and block reason are visible to authorized laboratory staff.
- Chain-of-custody events remain ordered and immutable.
- Partner sees operational progress but not draft result values.
- A report is inaccessible until validated, signed, and released.

### Pharmacy

- A signed external prescription causes no internal reservation or movement.
- A signed internal prescription cannot reserve expired or quarantined stock.
- Dispensing reduces the selected batch and records an immutable movement.
- Concurrent dispense attempts cannot issue more than available stock.
- Partial dispensing preserves an explicit remaining quantity and status.

## 16. Rollout and Migration

1. Add tenant feature flags: `partnerPortal`, `partnerApprovalGate`, `structuredConsultation`, and `pharmacyDispensary`. The pharmacy flag supports full pharmacy and in-lab dispensary configurations over the same inventory foundation.
2. Pilot with one organization and one clinician billing entity.
3. Backfill accounts from existing billing entities only after identity and ownership review.
4. Keep internal billing available during pilot; label partner-created orders by source.
5. Enable the processing guard after approval data and operational training are verified.
6. Introduce structured consultation with legacy notes read-only and generated narrative for new records.
7. Load opening pharmacy balances with a signed migration report before dispensing.

## 17. Open Decisions

Resolve these before the affected implementation milestone:

1. Does a partner charge exactly the center contract price, or may it add a markup? If so, who owns and sees it?
2. Can staff receive a sample while approval is pending, or only after approval?
3. Which roles can approve, and is dual approval required above an amount threshold?
4. Can an approved order be cancelled before processing, and who absorbs used consumables?
5. Are clinician accounts single-user entities or can a clinic administrator manage multiple users?
6. Which channels deliver results, and is acknowledgement mandatory?
7. Are substitutions allowed in dispensary, and must a prescriber approve them?
8. Which controlled-drug and retention rules apply in each jurisdiction?
9. Should stock reserve at prescription signing or only when dispensary accepts the request?
10. Which patient fields are reliable enough for duplicate matching?

## 18. Definition of Done

- Product decisions and acceptance criteria are approved.
- Threat model and privacy review are complete.
- APIs enforce authorization and state transitions independently of UI controls.
- Unit, integration, permission, concurrency, and end-to-end tests pass.
- Desktop and mobile usability checks pass for order creation and approval.
- Accessibility audit covers keyboard, labels, focus, contrast, and errors.
- Audit records are verified for every decision, report release, and stock movement.
- Runbooks, user training, feature flags, rollback, and monitoring are ready.