# PLS PATIENT PORTAL — COMPLETE IMPLEMENTATION SPECIFICATION

**Project:** Prime Laboratory System (PLS) Patient Portal  
**Frontend repository:** `lobnos`  
**Backend repository:** `lobnos-server`  
**UI INSPIRATION** PrimeDeviceManager , it mus th have same ui as the folder or app that maanagers the device of PLS
**Architecture:** Existing PLS multi-tenant architecture  
**Initial scope:** Patient registration, laboratory results, appointments, billing, and payments where supported.

## 1. Mission and governing principles

Build a secure, responsive, production-quality Patient Portal as an extension of the existing PLS application.

The portal must allow patients to access their laboratory results, appointments, and billing information through a patient-friendly interface while preserving the existing PLS database structures, business rules, authentication architecture, and facility isolation.

Before implementation, inspect the actual source code in both repositories. Trace the existing authentication, tenant resolution, patient records, result verification, report generation, appointment management, billing, payment, and frontend design systems.

Do not invent APIs, database structures, routes, or configuration mechanisms without examining the current implementation.

Apply the following principles throughout the project:

1. Reuse working PLS functionality instead of duplicating it.
2. Keep patient-facing configuration and authorization enforcement at the facility level.
3. Preserve strict tenant and patient-record isolation.
4. Enforce security and business rules on the backend, not merely in the frontend.
5. Simplify the patient experience without weakening clinical governance or data integrity.
6. Preserve existing staff-facing PLS workflows and historical records.
7. Implement complete, tested functionality rather than creating placeholder pages or superficial UI demonstrations.

## 2. Facility-level ownership and enforcement

This is a mandatory architectural requirement.

**The Patient Portal must not depend on the Master Platform for patient registration, login, identity verification, patient permissions, or individual access decisions.**

Each facility must manage its own Patient Portal configuration through the existing facility-level PLS administration interface.

Facility administrators must be able to configure:

- Whether the Patient Portal is enabled for their facility.
- Whether patients can register independently.
- Whether staff can invite patients.
- The facility's result-release policy.
- Whether appointment booking is available.
- Which billing and payment features are available.
- Which notification channels are enabled.

Persist these settings using the existing facility-scoped configuration and database conventions wherever possible.

The backend serving the facility must enforce the effective configuration on every relevant request. Hiding a feature in the frontend is not sufficient.

When the portal is disabled, patient-facing operations for that facility must be denied appropriately, including direct API access, without affecting unrelated facilities.

The Master Platform must not be added to the patient-facing workflow or used as an additional patient authorization dependency. Do not introduce new Master Platform controls for individual patient accounts as part of this implementation.

## 3. Patient identity and account architecture

### 3.1 Facility-specific patient accounts

Each facility has its own patient account and patient-record access boundary.

For the initial release, do not implement a global patient identity that automatically grants access across facilities.

If the same person uses two PLS facilities, their accounts and record associations remain separate unless a future, explicitly designed and authorized linking feature is introduced.

The backend must derive the effective facility context through trusted server-side mechanisms. Never trust a browser-supplied tenant ID, facility ID, or patient ID as sufficient authorization.

### 3.2 Registration methods

Support both registration approaches:

**Patient self-registration**
- Allow patients to register when the facility enables this option.
- Verify the patient's chosen contact channel.
- Establish secure credentials and a facility-specific account.
- Provide a secure process for linking the account to an existing patient record.
- Handle ambiguous matches through additional verification or staff-assisted resolution.

**Facility-issued invitations**
- Allow authorized facility staff to initiate patient registration.
- Generate invitations tied to the intended facility and registration process.
- Use expiring, single-use, revocable invitation tokens.
- Verify the invitation before completing registration.
- Prevent invitations from being reused or transferred to another facility.

### 3.3 Patient-record linking

Do not automatically expose medical records based only on a matching name, telephone number, email address, or patient number.

Use the existing PLS patient identity and verification mechanisms where available. Where additional verification is required, implement an appropriate secure process.

Avoid creating duplicate patient records simply because a patient creates a portal account. Link the portal account to the existing facility patient record whenever identity has been adequately verified.

## 4. Patient Portal modules

### 4.1 Patient dashboard

Create a responsive dashboard summarizing:

- Recent laboratory activity.
- Investigations awaiting completion.
- Released results available for viewing.
- Upcoming appointments.
- Outstanding invoices and recent payments.
- Relevant notifications and reminders.

Show only information that the authenticated patient is authorized to access.

Use clear statuses and actionable navigation. Avoid exposing sensitive medical information in notification previews or unnecessarily displaying detailed results on the dashboard.

### 4.2 Laboratory results and reports

Provide a dedicated **My Results** section.

Patients should be able to:

- View their authorized investigations.
- See investigation dates and accurate processing statuses.
- Access released laboratory reports.
- View and download authorized PDF reports.
- Review historical results where permitted.
- See reference ranges, units, and laboratory comments included in approved reports.

Distinguish between registered, collected, processing, completed, verified, and released states according to the actual PLS workflow.

**A result being entered or marked complete must not automatically make it visible to the patient.**

The backend must enforce the facility's result-release policy and any applicable report-specific authorization requirements for every view and download request. A direct URL must never bypass those checks.

If a result is amended, corrected, or withdrawn, handle its patient-facing availability consistently with the existing PLS clinical audit and reporting rules.

### 4.3 Result-release configuration

Implement result-release settings within the facility's existing application settings interface.

First inspect the existing verification, authorization, and release workflows.

Support the facility's approved release policy without bypassing mandatory clinical review. A configurable policy may determine when an otherwise authorized report becomes available, but it must not override required verification or authorization.

If a facility's existing workflow cannot safely support automatic release, retain the required staff authorization step.

Record relevant release decisions and patient report access in the appropriate audit history.

### 4.4 Appointments

Provide a **My Appointments** section.

Where the existing PLS application supports appointment scheduling, reuse the established services and data structures.

Patients should be able to:

- View upcoming and previous appointments.
- Request or book appointments when the facility permits it.
- See appointment confirmations and visit instructions.
- Request rescheduling or cancellation subject to facility rules.
- Receive appointment reminders through configured notification channels.

If appointment-booking functionality does not currently exist, inspect the existing scheduling model before introducing new tables or services. Do not create a disconnected calendar that cannot integrate with facility operations.

Enforce patient ownership and appointment availability on the backend.

### 4.5 Billing and payments

Provide a **My Billing** section showing the authenticated patient's authorized financial records.

Include:

- Invoices and outstanding balances.
- Invoice details and available billing documents.
- Payment history and transaction status.
- Receipts for confirmed payments.
- Online payment when a supported provider is configured and enabled by the facility.

Reuse existing PLS billing and payment services. The portal must not introduce an independent billing engine or a separate financial ledger.

The backend remains authoritative for invoice amounts, balances, payment status, and reconciliation.

Never mark an invoice as paid solely because the browser reports payment success. Verify provider callbacks or transaction status using the existing secure payment integration.

If online payments are not configured, allow patients to view the supported billing information without displaying nonfunctional payment controls.

### 4.6 Notifications

Reuse the existing PLS notification infrastructure where appropriate.

Support relevant notifications for:

- Released results.
- Appointment confirmations and reminders.
- Appointment changes.
- Available invoices and confirmed payments.
- Other facility-enabled patient communications.

Respect facility configuration and patient contact preferences.

Do not include complete laboratory results, sensitive diagnoses, passwords, session tokens, or unnecessary medical information in SMS, email, or push-notification previews.

## 5. Frontend design and user experience

The portal must use the established PLS visual identity.

Inspect the actual `lobnos` frontend and reuse its existing:

- Logo and brand assets.
- Primary colors and design tokens.
- Typography and spacing conventions.
- Form controls, buttons, tables, cards, and status indicators.
- Loading, empty, success, and error states.
- Responsive layout and navigation patterns.

Create a patient-specific interface rather than copying the staff application's full navigation.

Recommended navigation:

- Home
- My Results
- My Appointments
- My Billing
- Notifications
- My Profile
- Account & Security

The interface must be responsive on mobile, tablet, and desktop.

Use accessible form labels, keyboard navigation, clear validation messages, and readable report layouts.

Do not introduce a separate visual design system or unnecessary frontend dependencies if the existing PLS components can meet the requirements.

## 6. Backend and multi-tenant integration

Inspect `lobnos-server` and reuse the existing authentication, tenant resolution, database connection, DTO validation, service, and routing conventions.

Implement patient-specific backend operations for:

- Registration and account verification.
- Invitation creation and acceptance.
- Patient-record linking.
- Login, logout, and account recovery.
- Patient dashboard data.
- Authorized result listing and report retrieval.
- Appointment operations.
- Invoice, payment, and receipt access.
- Facility-level portal configuration.
- Notification preferences and relevant audit events.

These are functional requirements, not prescribed endpoint names. Determine the correct routes and API contracts from the actual project.

For every operation:

1. Authenticate the patient.
2. Resolve the trusted facility context.
3. Confirm the portal is enabled and the requested feature is available.
4. Authorize access to the specific patient record and requested resource.
5. Apply the facility's applicable business rules.
6. Return only the minimum necessary information.
7. Record relevant audit events.

Do not expose staff-only APIs to patient accounts. Do not rely on frontend checks to enforce access control.

Use existing facility databases as the authoritative source of patient records, laboratory results, invoices, and appointments wherever these already exist.

## 7. Database changes and migrations

Before creating tables or altering constraints, inspect the actual schema and identify which entities already exist.

Introduce only the additional data structures genuinely required for portal accounts, invitations, account-to-patient associations, facility configuration, or audit history.

Requirements:

- Keep patient accounts facility-scoped.
- Preserve existing patient identifiers and relationships.
- Enforce appropriate uniqueness and referential integrity.
- Use safe, versioned migrations compatible with existing installations.
- Avoid destructive migrations and hard deletion of clinical or financial history.
- Ensure new configuration values have safe defaults.
- Ensure one facility cannot accidentally reference another facility's patient or transaction records.

Do not duplicate existing patient, result, appointment, invoice, or payment tables simply to accommodate the portal.

## 8. Security, privacy, and clinical governance

Implement and test:

- Secure password hashing.
- Rate limiting and protections against credential attacks.
- Secure session handling, expiration, and logout.
- Appropriate protections for account recovery and invitation tokens.
- Patient-to-record ownership checks.
- Facility-level authorization and tenant isolation.
- Server-side result-release enforcement.
- Secure report access and download authorization.
- Input validation and protection against common web vulnerabilities.
- Audit logging for relevant account, access, and administrative actions.
- Safe error messages that do not reveal whether an unverified patient or medical record exists.
- Appropriate data minimization and retention practices.

Assess applicable Ghanaian data protection and health-record obligations, including the Data Protection Act, 2012 (Act 843), before production deployment.

Never log passwords, invitation secrets, session tokens, or unnecessary sensitive clinical content.

## 9. Testing and acceptance criteria

Create or extend automated tests using the project's existing testing conventions.

At minimum, verify:

1. Two facilities can independently enable or disable their Patient Portals.
2. Disabling one facility's portal does not affect another facility.
3. Patients can register independently when permitted.
4. Invitation-based registration works, and expired, revoked, or reused invitations are rejected.
5. Patient accounts can be linked to the correct existing records without unauthorized disclosure.
6. A patient from Facility A cannot retrieve Facility B's records by changing IDs, URL parameters, request bodies, or API endpoints.
7. Unreleased results remain inaccessible through both the UI and direct API requests.
8. Authorized released reports can be viewed and downloaded.
9. Appointments are accessible and modifiable only by authorized users.
10. Billing information and receipts are limited to the correct patient and facility.
11. Payment status is confirmed by the backend or payment provider rather than trusted from the browser.
12. Existing staff registration, billing, result verification, report generation, and facility workflows continue to work.
13. The interface remains responsive and consistent with PLS branding.
14. Database migrations and configuration defaults work on both existing and newly provisioned facilities.

Test failure cases as well as successful workflows.

## 10. Required implementation workflow

Follow this sequence:

### Step 1 — Source inspection

Examine the actual frontend and backend code. Identify existing modules, API contracts, database relationships, authentication flows, result-release controls, and reusable UI components.

### Step 2 — Produce a source-grounded change plan

List the actual files to change, existing services to reuse, required new services, configuration changes, database migrations, and security tests.

Do not invent file paths or claim that existing functionality is present without verifying it.

### Step 3 — Implement the foundation

Establish facility-specific patient authentication, patient-record linking, configuration persistence, and server-side authorization.

### Step 4 — Implement the patient features

Deliver results and report access first, then appointments, billing, payments where configured, and notifications.

### Step 5 — Validate end to end

Test both repositories, tenant isolation, result-release enforcement, and regression behavior before declaring completion.

### Step 6 — Document deployment

Document migrations, required configuration, deployment steps, facility activation, rollback considerations, and operational checks. Preserve existing facility data and working services.

## 11. Definition of done

The Patient Portal is complete only when patients can securely register or accept an invitation, access their authorized laboratory results, manage supported appointments, and view their billing information through a responsive PLS-branded interface.

All authorization and facility policies must be enforced by the appropriate facility-serving backend. Existing PLS workflows must remain intact, and automated tests must demonstrate that one patient's account cannot access another patient's records or cross facility boundaries.

**Final architectural rule: The facility owns patient access configuration and enforcement. The Master Platform is not part of the patient-facing authentication, registration, or authorization workflow. Reuse the existing PLS architecture, implement only the necessary changes, and validate every critical workflow before deployment.**