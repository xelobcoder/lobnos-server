# MASTER DEVELOPMENT PROMPT: PRIME LABORATORY SYSTEMS (PLS) — ENTERPRISE CORPORATE WEBSITE & DIGITAL PORTAL

Implementation brief updated against the current Lobnos software on 2026-10-10.
The verified capability inventory below is the source of truth for product copy.
Public claims must distinguish available workflows from provider configuration,
deployment prerequisites, and future integrations.

## 1. Project Overview

Design, develop, and implement a modern, premium, enterprise-grade corporate website for **Prime Laboratory Systems (PLS)**, hosted on the primary domain:

[**https://primelabsys.com**](https://primelabsys.com)

Use the `primelabsys` domain spelling in site metadata and deployment examples.
`https://primelabsys.com` is the configurable default; confirm the actual owned
domain/TLD before deployment. Do not create DNS records or assume portal
subdomains exist.

The website must establish Prime Laboratory Systems as a professional provider of Laboratory Information Management Systems (LIMS), laboratory automation, diagnostic workflow management, billing, inventory, financial management, reporting, analytics, and integrated healthcare technology solutions.

This must not be a generic template website. It should be a comprehensive corporate digital platform combining:

* An enterprise marketing and corporate website.

* A product and capabilities showcase.

* A laboratory facility discovery experience.

* A secure portal entry point for existing facilities.

* A patient results portal entry point.

* A business enquiry, sales, and customer acquisition platform.

* SEO-focused content and search-engine discovery.

* A scalable foundation for future PLS products and services.

The final result must communicate trust, innovation, reliability, operational efficiency, and professional healthcare technology.

## 2. Repository and Application Architecture

Create the website in a **new, independent project folder**, completely separate from the existing PLS frontend and backend repositories.

The required location is
`D:\Primelabsys\PHIMS\primelabsys-current-working-version\primelaboratorysystems`.
It must be a sibling of both `lobnos` and `lobnos-server`, never a subdirectory
of either application. Develop and build it independently on port `2380`;
do not replace the existing application on port `2377` or the backend service.

The existing applications are:

* `lobnos`: the existing application frontend.

* `lobnos-server`: the existing application backend.

These applications must remain intact and operational.

The new website must have its own application directory, package configuration, dependencies, source code, assets, environment configuration, build process, and deployment documentation.

Suggested project structure:

```
primelaboratorysystems/
├── public/
│   ├── images/
│   ├── icons/
│   ├── logos/
│   ├── illustrations/
│   └── fonts/
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── about/
│   │   ├── solutions/
│   │   ├── features/
│   │   ├── industries/
│   │   ├── facilities/
│   │   ├── resources/
│   │   ├── contact/
│   │   ├── request-demo/
│   │   ├── facility-login/
│   │   ├── patient-portal/
│   │   ├── privacy-policy/
│   │   └── terms/
│   ├── components/
│   │   ├── layout/
│   │   ├── navigation/
│   │   ├── marketing/
│   │   ├── solutions/
│   │   ├── facilities/
│   │   ├── forms/
│   │   └── ui/
│   ├── lib/
│   ├── data/
│   └── types/
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

This is a proposed starting structure. Refine it as needed without mixing the new website into either existing application.

### Technology requirements

* Next.js using the App Router.

* React and TypeScript.

* PNPM as the package manager.

* Server-side rendering and static generation where appropriate.

* Next.js Metadata API for SEO.

* CSS Modules, global CSS, or another maintainable CSS architecture.

* Bootstrap or custom CSS for responsive layouts; do not introduce Tailwind CSS unless explicitly approved.

* Framer Motion or Motion for React for purposeful, performant animations.

* Reusable, typed components and well-organized application modules.

Use compatible, stable dependency versions. Commit the PNPM lockfile and document the required Node.js and PNPM versions.

The website must build independently and must not depend on the existing LIMS application to render its public pages.

### Implementation tasks and acceptance

1. Verify implemented workflows against application routes, services, migrations,
   and relevant tests; use those findings to update the capability inventory.
2. Build the independent sibling website with centralized typed content,
   responsive navigation, all corporate pages and substantive solution/industry
   pages.
3. Implement facility discovery and separate employee/patient entry points.
   Publish only approved facility data; do not harvest the private tenant registry.
4. Implement validated demo/contact submission with explicit delivery and error
   states, rate limits, and server-only integration credentials.
5. Add metadata, sitemap, robots, structured data, accessibility, reduced-motion
   behavior, security headers, health check, and deployment examples.
6. Verify automated tests, type checking, lint, production build, internal links,
   responsive layouts, portal destination rejection, and form failures/success.
   Record exactly which checks were performed, not an unmeasured performance claim.

Business inputs are configuration requirements, not reasons to fabricate content:
approved logo, contacts, customer publication permissions, facility/portal URLs,
lead-delivery destination, and legal review. A missing lead destination must
return a clear unavailable state without retaining or claiming delivery of the
request. Do not change production DNS, infrastructure, or existing authentication.

## Verified current-software capability inventory

This inventory supersedes tentative feature lists elsewhere in this brief.
Evidence is the current application code, not proof of a particular customer's
deployment, configured equipment, delivery provider, or business outcome.

| Area | Capabilities to show on the website | Evidence in `lobnos-server` unless stated otherwise |
| --- | --- | --- |
| Registration and CRM | Patient demographics and contact records, registration, patient audit history, leads and customer lists/filtering, appointments, practitioner slots and reminder-call history | `src/controllers/registration/route.ts`, `src/controllers/crm/leads/route.ts`, `src/controllers/customers/route.ts`, `src/controllers/appointments/appointment.ts` |
| Physical specimen workflows | Collection worklists, container/sample identification and barcode lookup, reception, assessment, validation/review decisions, rejection, recollection and sample audit history | `src/controllers/samples/physicalSampleRoutes.ts`, `src/controllers/samples/PhysicalSampleController.ts`, `src/controllers/operations/route.ts` |
| Laboratory results | Structured result entry, critical-value alerts, report printing with applicable payment/access checks, delivery preferences and handover tracking | `src/controllers/result/route.ts` |
| Home collection | Service areas, collection staff, orders including orders from billing, assignment, status changes and collection checklists | `src/controllers/operations/homeCollection/routes.ts` |
| Ultrasound | Waiting lists, ultrasound test/template management and image uploads/retrieval | `src/controllers/operations/route.ts`, `src/controllers/operations/testHandler.ts` |
| Billing and revenue | General/cash, organization, private insurance, clinician and NHIS-related pricing; packages, referrals/promotions, collection, adjustments, refunds with approval/cash-out steps, transaction audit history | `src/controllers/billing/index.ts`; `lobnos/components/Billing/AdjustBillingSourceModal.tsx` |
| Suspended lab transactions | Suspend an unfinished sale or patientless quote, preserve tests/services/source/entity/options, resume at current prices, convert a quote after patient selection, finalize after the normal sale succeeds | `src/models/billing/SuspendedBillingService.ts`; `lobnos/lib/Multi/suspendedBilling.ts` |
| Accounting | General ledger, trial balance, income statement, balance sheet, cash flow, receivables/payables aging, inventory valuation, subledger statements/reconciliation, manual journals and approval/posting/reversal, accounting periods, daily close, bank-statement import and matching/unmatching | `src/controllers/accounting/route.ts`, `src/controllers/accounting/AccountingReportController.ts`, `src/controllers/accounting/BankReconciliationController.ts` |
| Inventory | Items, categories, brands, suppliers, storage locations, units, purchase orders, stock and consumption movements, supplier payments, journals and analytics | `src/controllers/inventory/routes/index.ts` |
| Pharmacy and prescriptions | Catalogue/stock, sales and held sales, history/reversals, clinician prescription orders with fulfillment/referral workflows | `src/controllers/pharmacy/routes.ts`, `src/controllers/prescriptions/routes.ts` |
| Payroll and workforce | Compensation, allowances, bonuses, salary grades, attendance, leave, taxes/deductions, payroll periods, processing, approvals, locking, paid status and reversals | `src/controllers/payroll/routes.ts` |
| Commissions | Commission tracking/rates, untracked-service review, batch processing and payment histories | `src/controllers/commission/routes.ts` |
| Quality and compliance | QC readings/dashboards, sessions, control materials/parameters, device/calibration records, session acceptance; incidents, incident analytics and audit trails | `src/controllers/QualityControl/qualityControlRoutes.ts`, `src/controllers/compliance/routes.ts` |
| Communications | Email settings/providers/templates, queued sends, retries/logs/analytics; SMS events/templates/jobs; in-app inbox and notification event/template/queue configuration | `src/controllers/email/route.ts`, `src/controllers/sms/route.ts`, `src/controllers/notifications/route.ts` |
| Platform administration | Facility provisioning, status management, module activation, branch mode, subscriptions, payment records/voids and audit history | `src/controllers/platform/facilities.ts`, `src/models/Tenancy/FacilityModules.ts`, `src/models/Tenancy/FacilityProvisioningService.ts` |
| Doctor and patient workspaces | Doctor consultations, orders, results and commissions; patient portal application and patient authentication surfaces. The public website links only to approved deployment destinations | `lobnos/app/doctor/`, `lobnos/app/patientportal/`, `lobnos/app/api/patient-auth/login/route.ts` |
| Analyzer interfacing | Device management, result receiving, HL7 ORU^R01 structures, device/test mappings and BioLab/Mindray-related message handling | `src/controllers/settings/devices/route.ts`, `src/controllers/settings/devices/hl7SoftwareProcessing.ts`, `src/controllers/settings/devices/DevicePrecessorBase.ts` |

### Product-copy boundaries

- Budget planning and budget-vs-actual reporting are not verified implemented
  capabilities. Do not advertise them as available.
- Imaging copy must say ultrasound workflows, not universal radiology,
  DICOM/PACS archiving, or support for every imaging modality.
- NHIS-related billing/pricing and member/claim-check fields do not establish
  external electronic claims submission or NHIS accreditation.
- HL7 and specific device mappings are evidenced; universal analyzer support,
  ready-to-use ASTM support, and compatibility with every hospital system are not.
  Compatibility requires model/protocol assessment and integration testing.
- Email/SMS delivery requires configured providers. Module activation and
  subscription payment records are not a third-party payment gateway or proof of
  automated subscription collection.
- Home collection is an operational staff/order workflow, not verified consumer
  self-booking or live GPS tracking.
- Multi-tenancy, branch mode and module activation depend on deployment and
  schema provisioning. Do not imply all customer deployments enable all modules.
- QC/compliance tools are not regulatory certification or laboratory accreditation.
  Do not claim certified security, guaranteed availability or patient outcomes.
- Portal routes establish application surfaces, not approved public deployment
  hostnames. Require explicitly approved HTTPS destinations and an allowlist.

### Public laboratory catalog integration

The website must integrate with the core platform's read-only public API so
visitors can navigate to an individual approved laboratory and browse its test
names, descriptions and general/cash prices. This is not a static fabricated
catalog or a public copy of private tenant/billing data.

- `GET /api/v1/public/facilities` supplies explicitly published, active laboratories.
- `GET /api/v1/public/facilities/:slug/catalog` supplies public facility metadata,
  configured tests, additional services, currency, pricing context and update time.
- The core resolves approved slugs to tenant connections; the browser cannot
  choose tenant IDs or obtain private payer concessions.
- Facility and catalog publication require separate operator-controlled approval
  flags in `PUBLIC_FACILITY_DIRECTORY_JSON`. Default publication is empty.
- Descriptions come from the facility's test catalog. If absent, disclose that the
  laboratory has not supplied one; do not invent clinical descriptions,
  preparation instructions, diagnoses or medical advice.
- Display prices with currency and explain that packages, insurance, promotions,
  taxes and other adjustments can change the final bill.
- Fetch only the public endpoints through the website's server-side,
  origin-validated core integration. Show retrieval failures explicitly; do not
  substitute sample catalogs or fake successful empty responses.
- Public browsing never includes patient records/results or staff credentials.
- Provide accessible name/description search and clear entry points from facility
  discovery to each catalog, employee login and patient access where configured.
- Product visuals must follow actual Lobnos module/layout/workflow structures.
  Use explicitly illustrative synthetic values until real screenshots have been
  approved and scrubbed of private information. Do not publish unrelated photos
  or portray fabricated dashboards as real customer screenshots.
- Use a deliberate readable typographic system, consistent size/weight hierarchy,
  and local/system fonts that do not require external network font downloads.

See [public catalog integration](docs/public-facility-catalogs.md) for the core
contract, publication controls and deployment requirements.

## 3. Brand Identity and Visual Direction

### Shared marketplace extension

The website is also a laboratory discovery, booking-request and patient-service
gateway. The core marketplace has one shared facility identity and two operational
models; do not build disconnected independent and PLS applications.

**PLS-integrated laboratories** use authorized, current catalogs from their core
tenant. Prices and operational records remain authoritative in PLS. Facility IDs
are routing identifiers, not credentials. Staff review bookings and link accepted
requests to the correct patient, bill and physical-sample workflows through
authenticated, tenant-scoped actions.

**Independent / Non-PLS laboratories** may register without purchasing PLS.
Registration and public listing require platform approval. Their authorized
facility staff manage profiles, tests/panels, prices, public descriptions, sample
requirements, collection methods, availability and turnaround estimates in the
marketplace dashboard. Public pages clearly disclose the facility's integration
category in readable text. No category implies accreditation or endorsement.

#### Patient journey

1. Discover an approved facility by name/location/test and browse its catalog.
2. Select tests or panels and review individual prices and estimated total.
3. Choose in-facility collection or home collection when the facility supports it.
4. Supply required booking/patient details through the private request form.
5. Submit a booking **request**, not a confirmed appointment or paid lab order.
6. Review approved external payment instructions and submit a payment reference
   as a **claim**, not proof of payment.
7. Receive confirmation only after authorized staff acceptance and applicable
   payment conditions are satisfied.
8. Track approved scheduling, collection, processing and completion status through
   a private authenticated/opaque-token flow; never expose private data in SEO,
   shared caches, public directories or URL query parameters.

#### Manual payment accountability

Do not integrate or simulate Mobile Money settlement automatically. Staff must
verify an external reference against real payment records before marking a claim
verified. Record reference, amount, reviewer, timestamp, decision and explanation.
Duplicate references must not result in multiple verified payments. Keep payment
claim state separate from booking acceptance and fulfillment. Support pending,
rejected, partial where permitted, cancellation/refund records with audit history;
never imply money was refunded automatically without settlement confirmation.

#### Facility and platform administration

Provide facility-scoped profile/catalog/booking/payment-review controls and
appropriate staff access. Integrated dashboards additionally expose connection,
workflow-linkage and synchronization errors while core lab operations stay in
PLS. Platform administrators approve registration/listings, enforce publication
policies, suspend facilities, and review audited actions. Never authorize access
solely from a tenant ID or let facility staff inspect other facilities' bookings.

#### Migration and core linkage

Preserve the independent facility's public ID/slug, catalog and price snapshots,
booking and payment-verification history when connecting it to PLS. Require
explicit catalog mappings, identity matching and reconciliation. A migration must
not silently duplicate facilities, patients or orders or overwrite core prices.
Retried booking creation and linkage must be idempotent. Do not claim a booking
entered the core workflow until the corresponding patient/billing/sample record
is verified in the target tenant. Failed linkage remains a visible retryable
integration issue, never a success-shaped fallback.

All marketplace data must be persisted in the core platform with documented
schema/bootstrap requirements. Marketing pages remain independent and public;
sensitive marketplace screens use private no-store handling and narrowly scoped
server-side API integration.

Develop a distinctive PLS visual identity that feels comparable to a mature international healthcare technology company.

### Brand colors

Use the user-confirmed official PLS green as the primary brand color:

* Primary green: `#27ae60`

* White: `#FFFFFF`

* Deep forest green for strong headings and emphasis.

* Soft green for highlights and backgrounds.

* Cool light grey for secondary surfaces.

* Dark charcoal or navy for readable text.

* Restrained blue accents where they support the healthcare technology aesthetic.

Use a consistent design-token system for colors, typography, spacing, radii, shadows, and transitions.

Apply the exact primary green to brand accents, primary actions and selected
controls. Use measured, accessible darker shades for text and supporting states.
White text on `#27ae60` has only 2.87:1 contrast, so primary buttons need a dark
foreground meeting at least 4.5:1 for normal-sized labels.

### Visual style

Learn from CrelioHealth's public product presentation: clear outcome-led
headlines, prominent demo actions, interactive software walkthroughs and connected
product groupings. Create original PLS layouts, copy and synthetic interface
illustrations; do not copy competitor source code, media, customer claims or
capabilities that are not evidenced in PLS.

The design should combine:

* Premium enterprise SaaS aesthetics.

* Modern healthcare technology branding.

* Spacious layouts and strong visual hierarchy.

* Crisp typography and carefully controlled line lengths.

* Large, confident headlines.

* Sophisticated product-interface mockups.

* Subtle gradients and restrained glass effects.

* Professional photography of laboratory environments.

* Custom diagrams illustrating laboratory workflows.

* High-quality icons and meaningful visual storytelling.

Avoid excessive gradients, generic stock-template layouts, unnecessary glassmorphism, oversized empty spaces, and distracting animations.

The site should look convincing to hospital executives, laboratory owners, medical directors, finance managers, laboratory professionals, and technology partners.

### Logo handling

Inspect the available project assets for the official PLS logo. Reuse the genuine brand asset if available and preserve its proportions.

The existing files named `public/asserts/companylogo/companylogo.png` and
`companylogo.jpg` in `lobnos` were inspected and are unrelated personal images,
not verified PLS brand assets. Do not copy them. Use a replaceable typographic
PLS wordmark until an official approved asset is supplied.

Do not invent a new official logo or alter the existing logo unnecessarily. If the official logo is unavailable, create a clearly replaceable placeholder component.

## 4. Global Navigation

Build a polished, responsive navigation system with desktop mega-menus and a mobile-friendly navigation drawer.

Suggested desktop navigation:

* Home

* Solutions

* Features

* Industries

* Facilities

* Resources

* About Us

* Contact

Primary action: **Request a Demo**

Secondary action: **Client Login**

Provide clear portal links without overwhelming the marketing navigation.

### Mega-menu: Solutions

Organize solutions into meaningful categories:

**Laboratory Operations**

* Laboratory Information Management System.

* Patient and sample registration.

* Test management and result reporting.

* Quality control and laboratory workflow.

**Financial Operations**

* Laboratory billing and cash collection.

* Insurance and organizational billing.

* Accounts receivable and outstanding balances.

* Expenses, accounting, and financial reporting.

**Business Operations**

* Inventory and supply management.

* Payroll and staff management.

* Commission management.

* Analytics and management reporting.

**Integration and Infrastructure**

* Laboratory analyzer interfacing.

* Healthcare system integration.

* Data backup and disaster recovery.

* Multi-facility management and enterprise architecture.

Only present capabilities that are implemented or genuinely planned. Label roadmap features clearly instead of presenting them as available today.

## 5. Homepage: Premium Enterprise Landing Page

Build a detailed homepage with the following sections.

### Section A: Announcement bar

A restrained announcement bar for product updates, new integrations, or important company announcements.

Content must be editable from a centralized configuration. Hide the bar when no announcement is configured.

### Section B: Hero section

Create a compelling headline that immediately communicates the value of PLS.

Suggested headline:

**One Intelligent Platform. Complete Laboratory Operations.**

Supporting copy:

Prime Laboratory Systems helps diagnostic laboratories streamline patient workflows, manage results, control inventory, simplify billing, and gain better visibility into their operations through a connected laboratory management platform.

Primary CTA: **Request a Personalized Demo**

Secondary CTA: **Explore Our Solutions**

Additional CTA: **Access Your Laboratory**

The hero should include a sophisticated product visual showing a realistic laboratory management dashboard, such as:

* Daily patient registrations.

* Laboratory workload.

* Sample processing status.

* Results awaiting authorization.

* Revenue and billing summaries.

* Inventory alerts.

* Facility performance indicators.

These visuals should be created using illustrative or synthetic data, never real patient information.

Use subtle entrance animations, restrained background movement, and responsive product mockups.

### Section C: Trust and credibility

Create a trust section highlighting genuine operational experience, real customer facilities, and relevant integrations.

Potential content categories:

* Laboratories using PLS.

* Supported operational workflows.

* Analyzer integration capabilities.

* Facility locations.

* Customer support and implementation.

Do not invent customer counts, uptime percentages, certifications, testimonials, partnerships, or performance statistics.

Use verified customer names and logos only when permission exists. Otherwise, provide a clearly marked, configurable facility showcase.

### Section D: The operational challenges

Describe the common problems faced by laboratories:

* Fragmented workflows.

* Manual paperwork.

* Billing discrepancies.

* Poor visibility into outstanding payments.

* Inventory shortages and wastage.

* Delays in result processing.

* Difficulty consolidating operational reports.

* Disconnected laboratory equipment and software.

* Limited visibility across facilities.

Explain how PLS can address these challenges with connected workflows and better operational visibility.

### Section E: Complete PLS capabilities

Present the core capabilities as visually rich, navigable feature cards.

**1. Patient Registration and Management**

* Patient demographics.

* Registration and identification.

* Visit and order tracking.

* Historical patient records.

* Duplicate detection where implemented.

**2. Test and Sample Workflow**

* Test ordering and registration.

* Sample identification and tracking.

* Specimen collection and processing status.

* Test assignment and workflow tracking.

* Result entry, validation, and authorization.

* Multi-test specimen support where configured.

**3. Laboratory Results and Reporting**

* Structured result entry.

* Reference intervals and units.

* Calculated parameters and formulas.

* Result authorization workflows.

* Printable laboratory reports.

* Historical results where authorized.

* Configurable report layouts.

**4. Billing and Revenue Management**

* Cash billing.

* Organization billing.

* Clinician and referral pricing.

* Insurance and NHIS-related workflows where configured.

* Discounts and approved adjustments.

* Outstanding balances.

* Cash collection and transaction tracking.

* Refunds and financial audit trails.

**5. Inventory and Supply Management**

* Reagent and consumable tracking.

* Stock receipts and issues.

* Stock balances.

* Expiry monitoring.

* Reorder alerts.

* Supplier management.

* Inventory reporting.

**6. Accounting and Financial Oversight**

* Expense management.

* Financial approvals.

* Revenue summaries.

* Receivables and outstanding balances.

* Financial reports.

* Role-based approval workflows.

* Audit trails and finalized transaction reporting.

General ledger, receivables/payables aging, subledger reconciliation and
bank-statement matching are implemented. Show those alongside trial balance,
income statement, balance sheet, cash flow, journal workflows, accounting periods
and daily close. Budget planning is not verified and must not be shown as available.

**7. Payroll and Workforce Management**

* Staff records.

* Payroll-related workflows.

* Employee-linked operational records.

* Commission calculations and reporting.

* Appropriate access restrictions.

**8. Analyzer and Healthcare Integrations**

Show the integration strategy for compatible laboratory analyzers and healthcare information systems.

Potential integration standards and technologies include:

* HL7.

* Additional protocols only after capability verification; do not claim current
  ASTM support without evidence.

* Device-specific communication protocols.

* Healthcare system interoperability.

* Future standards-based integrations.

Do not claim compatibility with every analyzer or hospital system. Explain that compatibility depends on the equipment model, available protocol, and integration configuration.

**9. Analytics and Management Reporting**

* Daily operational summaries.

* Workload and turnaround monitoring.

* Revenue and billing analysis.

* Inventory consumption.

* Outstanding balances.

* User activity and audit reporting.

* Multi-facility summaries when the relevant enterprise functionality is available.

**10. Security, Backup, and Operational Resilience**

Describe implemented safeguards accurately, including role-based access, controlled approvals, auditability, backup processes, and recovery procedures where available.

Do not claim regulatory certification, end-to-end encryption, guaranteed uptime, or other security assurances unless verified.

### Section F: One platform, multiple operational roles

Create a visual role-based section demonstrating how PLS supports:

* Laboratory owners and directors.

* Laboratory scientists and technicians.

* Reception and registration teams.

* Cashiers and billing officers.

* Accountants and finance managers.

* Inventory officers.

* Facility administrators.

* Authorized referring organizations and clinicians.

Explain how appropriate permissions and workflows help each role work efficiently.

### Section G: Product walkthrough

Create an interactive product showcase with tabs or segmented controls.

Suggested views:

* Laboratory Overview.

* Patient Registration.

* Sample Workflow.

* Results Management.

* Billing and Collections.

* Inventory.

* Financial Reports.

* Multi-Facility Oversight.

Each view should show a relevant product-interface mockup, concise description, and associated benefits.

Use real product screenshots only when they are available and approved. Otherwise, build realistic illustrative interfaces using synthetic data.

The showcase must work on desktop and mobile, support keyboard navigation, and avoid loading every large image at once.

### Section H: Industries and use cases

Create dedicated cards and supporting landing pages for:

* Independent diagnostic laboratories.

* Hospital laboratories.

* Diagnostic centres.

* Medical laboratory groups.

* Corporate and occupational health laboratories.

* Healthcare organizations and referral networks.

Explain how each setting may use PLS, while avoiding unsupported claims about current deployments or specialized compliance.

### Section I: Facility network

Create a professional section introducing laboratories currently using PLS.

Each approved facility listing may contain:

* Facility name.

* Logo or approved image.

* Region and locality.

* Brief description.

* Public contact information.

* Public facility profile.

* A link to the facility's official result portal, if available.

Provide filters by region and facility type when enough verified facilities exist.

For Ghana, design the information architecture to support regions and localities, including Northern Ghana and other regions where PLS has verified deployments.

Use a centralized facility data source so the list can be expanded without rewriting the interface.

Do not fabricate facilities, addresses, customer counts, or deployment locations. Provide clearly marked sample content in development and keep unverified entries out of production.

### Section J: Why laboratories choose PLS

Communicate the benefits in operational terms:

* More connected workflows.

* Better visibility into laboratory activity.

* Improved billing oversight.

* Greater control over inventory.

* More accessible management reports.

* Reduced reliance on disconnected manual processes.

* A scalable foundation for growing laboratory operations.

Use carefully worded benefit statements rather than guaranteeing specific financial or clinical outcomes.

### Section K: Implementation and onboarding

Explain the typical customer journey:

1. Initial consultation.

2. Facility requirements assessment.

3. Product demonstration.

4. Configuration and implementation planning.

5. Staff training.

6. Go-live support.

7. Ongoing assistance and product improvements.

Allow visitors to request an assessment or schedule a demonstration.

Do not promise fixed implementation timelines until they have been established by the business.

### Section L: Testimonials and case studies

Create a reusable testimonial and case-study system.

Each published case study should support:

* Facility name and approved branding.

* Operational challenge.

* Implemented PLS workflows.

* Verified results.

* Customer-approved quotation.

* Publication permission.

Use placeholders or hide the section until real, approved testimonials are available.

### Section M: Final conversion section

Use a strong call to action:

**Ready to Bring Your Laboratory Operations Together?**

Invite visitors to arrange a product demonstration and discuss their facility's needs.

Buttons:

* Request a Demo.

* Talk to Our Team.

* Explore PLS Solutions.

### Section N: Comprehensive footer

Include:

* Company overview.

* Solutions.

* Product capabilities.

* Industry pages.

* Facility directory.

* Resources.

* Contact information.

* Customer login.

* Patient results portal.

* Privacy policy.

* Terms of service.

* Cookie preferences where applicable.

* Copyright notice.

Use centrally configured company contact details. Do not invent a postal address, telephone number, email address, or social profile.

## 6. Dedicated Website Pages

Build fully designed, substantive pages rather than empty placeholders.

### Corporate pages

* `/about`

* `/contact`

* `/request-demo`

* `/solutions`

* `/features`

* `/industries`

* `/facilities`

* `/resources`

* `/privacy-policy`

* `/terms`

### Solution pages

Examples:

* `/solutions/laboratory-management-system`

* `/solutions/laboratory-billing`

* `/solutions/inventory-management`

* `/solutions/laboratory-analytics`

* `/solutions/analyzer-integration`

* `/solutions/financial-management`

* `/solutions/multi-facility-management`

Each page should have a distinct search intent, relevant examples, contextual internal links, appropriate calls to action, and accurate product information.

### Industry pages

Examples:

* `/industries/diagnostic-laboratories`

* `/industries/hospital-laboratories`

* `/industries/diagnostic-centres`

* `/industries/laboratory-groups`

### Facility directory

* `/facilities`

* `/facilities/[facility-slug]`

Facility profile pages should be generated only for approved, verified facilities and contain useful public information.

## 7. Facility Login and Patient Results Access

This is a critical part of the website architecture.

The public marketing website must offer two distinct entry points.

### A. Facility login

Route: `/facility-login`

Provide a polished portal selection experience for existing laboratory facilities.

Support the intended PLS tenancy architecture without confusing it with patient access.

Depending on the final authentication design, the flow may allow a user to:

1. Search for or select their facility.

2. Continue to the appropriate facility login endpoint.

3. Authenticate using the facility's approved authentication process.

4. Access only the authorized facility and resources.

If the existing PLS application already has a working authentication endpoint, integrate with it through a documented, secure interface. Do not recreate authentication unnecessarily.

If the production facility application uses tenant-aware login without a separate facility selection step, preserve that behavior and provide a direct login option.

Never collect or store facility passwords in the marketing website. Never transmit credentials through query parameters or expose tenant secrets in URLs.

Use the correct canonical domain and redirect configuration for the production deployment.

### B. Patient results portal

Route: `/patient-portal`

Create a patient-friendly experience for finding the correct laboratory results portal.

The flow should allow patients to:

1. Select or search for their laboratory facility.

2. Open that facility's approved patient portal.

3. Authenticate using the facility's supported patient verification method.

4. Access only their own authorized results.

Facility discovery and patient authentication must remain separate concerns.

Do not expose patient names, test results, phone numbers, medical records, or other personal information in public facility directories, page metadata, URLs, analytics events, or search-engine indexes.

Do not create a publicly searchable database of laboratory results.

If the existing patient portal is not ready for integration, implement the discovery interface and a clearly documented integration boundary. Do not simulate a successful production login.

### C. Patient portal privacy

Apply the following requirements:

* No patient credentials stored in marketing-site analytics.

* No patient medical information in public page content.

* No sensitive identifiers in URL parameters.

* No indexing of authenticated result pages.

* No caching of personalized patient results in shared caches.

* No unauthorized cross-facility access.

* Appropriate session, access-control, and audit requirements enforced by the actual patient portal.

Public SEO pages and authenticated patient data must be architecturally separated.

## 8. Facility Discovery and Search

Create a centralized facility registry with a typed data model.

A facility record may contain:

* Unique internal identifier.

* Public slug.

* Official facility name.

* Public logo.

* Region.

* District or locality.

* Facility category.

* Approved public description.

* Public contact information.

* Public profile visibility.

* Facility login destination.

* Patient portal destination.

* Verification and publication status.

Only expose fields explicitly approved for public use.

Build reusable search and filtering components. Use normalized search text and accessible controls.

For a small facility directory, filtering can happen locally. If the directory grows substantially, introduce a suitable searchable data service.

Validate all external portal destinations and allow only approved HTTPS destinations.

## 9. Search Engine Optimization

SEO must be treated as a core architecture requirement rather than a final cosmetic task.

### Technical SEO

Implement:

* Unique titles and meta descriptions for every indexable page.

* Canonical URLs.

* Semantic HTML.

* Clean, descriptive URLs.

* XML sitemap.

* `robots.txt`.

* Open Graph metadata.

* Social sharing metadata.

* Favicon and web app icons.

* Breadcrumbs where appropriate.

* Correct heading hierarchy.

* Image alt text.

* Descriptive internal links.

* Redirect handling for changed URLs.

* Search Console verification configuration.

* Google Analytics integration only when approved and configured appropriately.

Use the Next.js Metadata API and generate metadata from typed page data where appropriate.

### Structured data

Implement relevant JSON-LD structured data where accurate, such as:

* `Organization`.

* `WebSite`.

* `BreadcrumbList`.

* `SoftwareApplication`, when applicable.

* `Article` for genuine editorial content.

* `LocalBusiness` or a suitable subtype only for eligible, verified facility profiles.

Ensure structured data agrees with visible page content. Do not invent ratings, reviews, addresses, awards, or organization details.

### Keyword strategy

Build content around legitimate search intent, including:

* Laboratory management software.

* Laboratory information management system.

* Diagnostic laboratory software.

* Laboratory billing software.

* Laboratory inventory management.

* Laboratory analyzer integration.

* Laboratory reporting software.

* Healthcare laboratory management in Ghana.

* Laboratory software for diagnostic centres.

* Multi-facility laboratory management.

Use keywords naturally in titles, headings, explanatory content, and internal links. Avoid keyword stuffing and automatically generated thin landing pages.

### Performance and crawlability

* Render essential page content server-side or statically.

* Ensure navigation links are crawlable.

* Avoid requiring client-side JavaScript to reveal core SEO content.

* Optimize images with Next.js image tooling where appropriate.

* Use responsive image sizes.

* Lazy-load below-the-fold media.

* Prevent duplicate indexable URLs.

* Keep authenticated portal pages out of search indexes.

Prepare the site for Google Search Console and other relevant webmaster tools. Do not claim indexing or search ranking improvements before they are measured.

## 10. Animations and Interaction

Use subtle, intentional animations to make the website feel polished.

Implement:

* Hero entrance transitions.

* Staggered feature-card reveals.

* Scroll-triggered section entrances.

* Smooth navigation-menu transitions.

* Product mockup transitions.

* Interactive feature tabs.

* Subtle hover and focus states.

* Lightweight decorative movement where useful.

Requirements:

* Respect `prefers-reduced-motion`.

* Keep animations performant.

* Avoid blocking user interaction.

* Do not use excessive parallax or distracting motion.

* Do not introduce layout shifts during animation.

* Ensure every interactive element works without a mouse.

Use a consistent motion system with defined durations and easing functions.

## 11. Contact and Lead Generation

Build functional, validated forms for:

### Request a demo

Fields may include:

* Full name.

* Work email.

* Telephone number.

* Facility or organization.

* Country and region.

* Facility type.

* Number of facilities.

* Approximate daily workload, if useful.

* Interested solutions.

* Additional message.

### General enquiries

Include:

* Name.

* Contact email.

* Subject.

* Message.

Requirements:

* Client-side and server-side validation.

* Accessible validation messages.

* Spam protection.

* Submission state and error handling.

* Clear privacy notice.

* Server-side secret management.

* Rate limiting and abuse prevention.

Do not claim that an enquiry was delivered unless the backend confirms successful submission.

Use a dedicated server-side handler, secure external CRM integration, or an approved email service. Never expose SMTP credentials, API keys, or private integration tokens in client-side code.

If no backend integration is available, document the integration requirements and present a clear fallback rather than silently discarding submissions.

## 12. Content Management and Maintainability

Keep public content separate from layout components.

Use typed content objects for:

* Navigation.

* Product features.

* Solutions.

* Industries.

* Facilities.

* Testimonials.

* FAQs.

* Company information.

* Contact information.

* Announcements.

Create reusable components and consistent data schemas.

For the initial version, a centralized TypeScript content layer is acceptable. Design it so that a CMS can be added later without rebuilding the entire website.

Do not hardcode the same facility details in multiple components.

Include development-only sample data and prevent it from appearing as real customer information in production.

## 13. Accessibility and Responsive Design

Target WCAG 2.2 AA accessibility practices where feasible.

Implement:

* Semantic landmarks.

* Keyboard-accessible navigation.

* Visible focus indicators.

* Accessible forms and labels.

* Appropriate text contrast.

* Meaningful image alternatives.

* Screen-reader-friendly status messages.

* Accessible dropdowns and dialogs.

* Reduced-motion support.

* Touch-friendly controls.

Test layouts across:

* Small mobile devices.

* Large mobile devices.

* Tablets.

* Standard desktop screens.

* Large desktop displays.

The site must remain usable on slower connections and common mobile devices used by healthcare staff in Ghana.

## 14. Security and Privacy

Apply secure development practices throughout the project.

* Never commit secrets.

* Provide `.env.example` with variable names and safe example values.

* Validate external redirect destinations.

* Sanitize and validate incoming form data.

* Apply rate limiting to public submission endpoints.

* Configure appropriate security headers.

* Use a restrictive Content Security Policy compatible with actual site dependencies.

* Avoid unnecessary third-party scripts.

* Apply consent requirements to non-essential tracking where applicable.

* Do not place patient records or sensitive facility credentials in public assets.

* Avoid leaking internal API endpoints or infrastructure details unnecessarily.

* Separate marketing content from authenticated applications.

* Document how production environment variables are configured.

Security controls must be compatible with the actual deployment architecture and verified in testing.

## 15. Performance Targets

Optimize for strong Core Web Vitals and reliable performance on real devices.

Use the following initial targets as engineering goals, measured under documented test conditions:

* Largest Contentful Paint: 2.5 seconds or less.

* Interaction to Next Paint: 200 milliseconds or less.

* Cumulative Layout Shift: 0.1 or less.

Aim for these targets at the 75th percentile of real-user visits once sufficient field data is available.

Use Lighthouse and appropriate browser testing to identify bottlenecks.

Avoid:

* Oversized hero videos.

* Unoptimized background imagery.

* Excessive client-side JavaScript.

* Unnecessary libraries.

* Repeated font downloads.

* Layout shifts caused by images.

* Loading every animation and image immediately.

## 16. Deployment and Domain Configuration

Prepare the application for deployment on the existing Ubuntu VPS infrastructure, subject to confirmation of available resources and domain configuration.

Requirements:

* Independent production build.

* Dedicated application directory.

* Dedicated environment variables.

* Documented production start command.

* PM2 configuration or an equivalent process-management setup.

* Nginx reverse-proxy configuration.

* HTTPS support.

* Static asset caching.

* Compression.

* Health-check endpoint where appropriate.

* Logs and deployment troubleshooting instructions.

The intended public domain is:

`primelabsys.com`

Use the `www` hostname only with a deliberate canonical-domain and redirect policy.

The website should become the public homepage of the primary domain. Existing LIMS application routes and APIs must not be overwritten.

Before deployment, inspect the existing DNS, Nginx virtual hosts, SSL configuration, and application routing. Reuse the existing domain certificate only if its coverage and configuration are suitable.

Document the intended routing architecture, for example:

* Public corporate pages served by the new Next.js website.

* Facility application served at an approved application hostname or route.

* Patient results portal served through the approved patient-access architecture.

* API requests routed only to the appropriate backend.

Do not change production DNS or replace an existing Nginx site without verifying the current deployment and preparing a rollback plan.

## 17. Testing and Quality Assurance

Before declaring the project complete:

* Install dependencies with PNPM.

* Run linting and type checks.

* Build the production application.

* Resolve build errors and console errors.

* Test all navigation links.

* Test mobile menus and interactive components.

* Test forms and validation.

* Test facility search and filters.

* Test valid and invalid portal destinations.

* Verify page metadata and canonical URLs.

* Verify sitemap and robots rules.

* Validate structured data.

* Test reduced-motion settings.

* Test keyboard navigation.

* Test accessibility and responsive layouts.

* Test production environment configuration.

* Verify that private data cannot leak into public pages.

* Confirm that existing PLS applications remain unchanged.

Include automated tests for important user flows where appropriate.

## 18. Deliverables

Deliver a fully implemented project, not merely a design proposal.

Required deliverables:

1. A separate Next.js website project.

2. PNPM dependency configuration and lockfile.

3. Responsive homepage.

4. Fully designed corporate and product pages.

5. Facility directory and approved facility profiles.

6. Facility login entry point.

7. Patient portal discovery entry point.

8. Reusable solution and feature components.

9. Search-engine optimization infrastructure.

10. Motion and interaction system.

11. Validated lead-generation forms.

12. Accessibility and responsive styling.

13. Security-conscious configuration.

14. `.env.example`.

15. README with setup, development, build, testing, and deployment instructions.

16. Deployment and Nginx configuration examples.

17. A list of outstanding external integrations.

18. A list of any features that remain incomplete or require business verification.

## 19. Definition of Done

The project is complete only when:

* The new website is visually polished and responsive.

* It runs independently of the existing PLS applications.

* PNPM is used for dependency management.

* The production build succeeds.

* The homepage communicates the complete PLS value proposition.

* Solutions and features have substantive dedicated pages.

* Facility discovery works with verified data.

* Facility and patient portal entry points are distinct and secure.

* SEO metadata, sitemap, robots rules, and structured data are implemented appropriately.

* Forms either submit successfully to a configured destination or clearly document the missing integration.

* The website contains no fabricated testimonials, facility deployments, statistics, certifications, or product claims.

* All major controls are functional.

* Deployment instructions are complete.

* Existing applications and APIs remain unaffected.

## Final Instruction

First inspect the existing repositories, available brand assets, current application routes, deployment architecture, and existing authentication and patient portal capabilities.

Then implement the new website in its own independent folder.

Prioritize a production-quality implementation with complete navigation, polished visual design, accurate product content, functional interactions, strong SEO foundations, secure portal routing, and maintainable architecture.

Do not stop after producing a homepage mockup. Complete the site structure, reusable components, required pages, testing, and deployment documentation.

Where customer information, production endpoints, external integrations, or product capabilities are unknown, use configurable placeholders and document the required verification instead of inventing facts.

**The final objective is to make Prime Laboratory Systems a credible enterprise healthcare technology brand, with its primary website serving as the central gateway for prospective customers, existing laboratory facilities, and patients.**

## My recommendations before implementation

Brother, there are three architectural decisions I would emphasize because they will affect the long-term success of the website.

![GCLabs | Modern Lab Management System](https://images.openai.com/static-rsc-4/5xfD47mK1YAItFcSoRIBAeTwNvxBYtKAVV3ZSjk0ufwLGZ8D_e9aGpOR-bcdJp7YNu38teCn7NgvTT-5zmGZQ5kw_FNgyvRV_-60PDHccO2du8sAJchwoOfT9f5NFO4TLDptD2etKQqUUgC40RGTqbO8PfbxRdeiwSWLSNd2QKo?purpose=inline)

Add to Favorites

1. Separate the marketing website from the LIMS application

Keep the new Next.js website in its own folder and deployable application. It should not share the existing application's codebase simply because both belong to PLS. This lets you update the corporate website without destabilizing laboratory operations.

![Fundación Santa Fe de Bogotá | Drupal.org](https://images.openai.com/static-rsc-4/ZdBsvi5qoeHBbbuMN2esCESLKXlXbm7Ng_pKLcIT2XuhM_ohrjswhfXFxnN68bQeF6Vqp73qMSXtfz3Ik_kfw9BaekGtn4v8pP2Eb3YF_cBYe7SMULB9tWoYr1uO5YDf6P609HSZ72sIlz1MDxPhI3fT10wiwRDEBVG3Qx7usV8?purpose=inline)

Add to Favorites

2. Make facility access and patient access separate journeys

Laboratory employees and patients have different authentication requirements. The corporate website should help each group find the correct portal without exposing credentials, patient records, or facility-specific private information.

![Clinic Website designs, themes, templates and downloadable graphic elements on Dribbble](https://images.openai.com/static-rsc-4/3d0hV3QBFLkFbF0Re02JNfy_o8C8t1rGQPXYgSwvItr4nC7KihZ76_9l7s0HleheW6sWdz3jOcopD3ECmcetu7PemQyRrDZRq_hX2y6ivh-JPoANmblFxjMWNnvrugOb5Xc_Bqd81UPqNtdkWPzKKba5nfI_EPzN3CKMAhBkZZo?purpose=inline)

Add to Favorites

3. Build the site around credibility and customer acquisition

The strongest homepage will combine a convincing product demonstration, verified facility deployments, detailed solution pages, and clear demo-request calls to action. SEO should bring the right visitors, while the content should turn those visitors into enquiries.

## One important domain decision

Before deployment, decide how you want the different users to access PLS. My recommended arrangement is:

| Purpose                       | Suggested address                    |
| ----------------------------- | ------------------------------------ |
| Corporate website             | `primelabsys.com`         |
| Facility application          | `app.primelabsys.com`     |
| Patient results portal        | `results.primelabsys.com` |
| API, if independently exposed | `api.primelabsys.com`     |

These are proposed addresses, not assumptions about your existing DNS. The facility application and patient portal can use different routing arrangements if your current architecture requires it.

My recommendation: Build the corporate website as the public-facing entry point for the entire PLS ecosystem, while keeping authentication and patient-result retrieval within the appropriate application and backend. This gives you a professional marketing platform today and room to expand into a larger healthcare technology ecosystem later.
