Brother, the key is to position the Prime Laboratory System (PLS) website as more than a corporate website. It should become a centralized laboratory discovery, test-booking, and patient-service platform that integrates directly with PLS while also onboarding laboratories that do not yet use the software. The architecture should support a gradual migration from non-PLS facilities to full PLS integration.

Here is a refined version of your requirements that you can use in your project documentation or give to your development team.

Prime Laboratory System (PLS): Integrated Laboratory Discovery, Test Booking, and Patient Service Platform

# Prime Laboratory System (PLS): Integrated Laboratory Discovery, Test Booking, and Patient Service Platform

## 1. Project Vision

Develop an enterprise-grade website and patient-facing platform for **Prime Laboratory System (PLS)** that serves as the central online gateway for discovering medical laboratories, exploring laboratory test catalogs, comparing test prices, requesting laboratory investigations, arranging sample collection, and tracking payment verification and service fulfillment.

The platform must integrate directly with the existing PLS core laboratory management system while also supporting independent laboratories that do not currently use PLS.

Our objective is twofold:

1. **Increase the value of PLS for existing customers** by allowing laboratories already using our software to expose their test catalogs and prices online, receive patient requests, and connect those requests to their internal laboratory workflows.

2. **Attract new laboratory facilities to the PLS ecosystem** by allowing non-PLS laboratories to register, publish their test catalogs, display prices, and receive test requests without initially requiring them to migrate to PLS.

The architecture must ensure that independent laboratories can eventually migrate to PLS with minimal disruption, without losing their catalogs, pricing information, patient requests, or relevant operational records.

## 2. Two Categories of Participating Laboratories

The platform must support two distinct facility categories.

### A. PLS-Integrated Facilities

These are laboratories that already use Prime Laboratory System.

Each facility must be connected to the central platform through a secure integration mechanism based on its facility tenancy ID and the appropriate backend integration credentials.

Once connected, the platform should retrieve or synchronize the facility's authorized test catalog, test panels, prices, availability, and other relevant information from its PLS instance.

Requirements:

* Synchronize test catalogs and panels with the facility's existing PLS configuration.

* Display the facility's name, location, contact information, available investigations, and prices.

* Allow patients to select individual tests or predefined test panels.

* Allow patients to request either in-facility sample collection or home sample collection, where supported.

* Support online booking requests and patient-submitted payment references.

* Route confirmed and verified requests into the appropriate PLS facility workflow.

* Allow authorized facility staff to review, accept, reject, schedule, and process requests.

* Ensure that accepted requests can be linked to the appropriate patient registration, billing, sample collection, and laboratory processing workflows.

* Maintain synchronization between the public-facing platform and the facility's PLS records, subject to permissions and operational rules.

The platform must not create a separate, conflicting source of truth for laboratory prices or operational records when those records are managed by the facility's PLS installation.

### B. Non-PLS Facilities

These are independent laboratories that do not currently use Prime Laboratory System.

The platform must allow these facilities to register and establish a public laboratory profile without requiring them to purchase or install PLS first.

Each facility should be clearly identified on the public platform as a **Non-PLS Facility** so patients understand that it is not yet integrated with the core PLS software.

Requirements:

* Register a laboratory facility and submit its relevant details for approval.

* Create a public profile containing its name, location, contact details, opening hours, and available services.

* Upload and manage individual laboratory tests, test panels, prices, descriptions, and sample requirements.

* Specify whether each investigation is available for in-facility collection, home collection, or both.

* Set availability, turnaround-time estimates, and other relevant service information.

* Receive and manage patient test requests through a dedicated facility dashboard.

* Review payment claims and their associated reference numbers.

* Update request statuses and communicate collection or appointment instructions to patients.

Non-PLS facilities should be able to use these marketplace and booking features without needing the full PLS laboratory management system.

However, the underlying data structures should be designed to support their future migration to PLS. Their facility profile, catalog, prices, bookings, payment-verification records, and relevant historical data should be portable into the core system through a controlled migration process.

## 3. Patient Test Discovery and Booking

The public website must provide a centralized interface through which patients can discover participating laboratories and request laboratory investigations.

A patient should be able to:

1. Search for a laboratory by name, location, or available test.

2. Browse participating facilities and identify whether each is PLS-integrated or independent.

3. Open a facility profile and view its available test catalog.

4. Select one or more tests or predefined panels.

5. Review the price of each selected investigation and the total estimated cost.

6. Choose a service method:

   * In-facility sample collection.

   * Home sample collection, if available.

7. Provide the required patient details and booking information.

8. Review the request and payment instructions.

9. Submit the booking request.

10. Submit a payment reference for verification if payment is made through an accepted external payment channel.

11. Receive confirmation when the facility accepts the request and the required payment conditions have been satisfied.

12. Track the request through collection, laboratory processing, and completion, according to the capabilities of the selected facility.

The platform should clearly distinguish between a booking request, an accepted booking, a payment claim, a verified payment, and a fulfilled laboratory service.

A submitted request must not automatically be treated as a confirmed appointment, a paid transaction, or a completed laboratory order.

## 4. Payment and Verification Workflow

Initially, the platform will not depend on a direct Mobile Money API integration. Instead, it should support a controlled manual payment-verification workflow.

The proposed workflow is:

1. The patient selects the desired tests and submits a booking request.

2. The system calculates the expected amount using the applicable facility prices.

3. The platform presents the facility's approved payment instructions.

4. The patient makes payment through the specified external channel.

5. The patient submits the payment reference number and any other required transaction details.

6. The request enters a pending-payment-verification state.

7. An authorized facility staff member or designated administrator verifies the payment against the relevant payment records.

8. If the payment is confirmed, the transaction is marked as verified and the booking can proceed according to the facility's acceptance rules.

9. If the payment cannot be confirmed, the transaction remains pending or is rejected with an appropriate explanation.

10. The system records the verification decision, verifying user, timestamp, reference number, amount, and relevant audit information.

The system must prevent duplicate payment claims from being inadvertently treated as separate verified payments. It must also support unpaid, partially paid where permitted, rejected, refunded, and cancelled requests as applicable to the business rules.

**Important:** A patient-submitted reference number is a claim, not proof of payment. The platform must never automatically mark a transaction as paid solely because a patient entered a reference number.

The system should be designed so that a future Mobile Money or payment gateway integration can replace or supplement manual verification without requiring a fundamental redesign of the booking workflow.

## 5. Integration with the Core PLS Platform

The public website and marketplace must be integrated with the existing Prime Laboratory System backend rather than developed as a disconnected application.

For PLS-integrated facilities, the platform should support the following operational flow:

**Patient website → Test selection → Booking request → Facility-specific PLS integration → Payment verification → Accepted laboratory order → Sample collection → Laboratory processing → Result and status synchronization, where authorized.**

The integration must support:

* Secure facility identification and tenant isolation.

* Authorized retrieval of test catalogs, panels, and prices.

* Controlled synchronization of changes to catalog items and prices.

* Submission of accepted bookings to the correct facility.

* Linking requests to existing patient, billing, and sample records where appropriate.

* Prevention of duplicate orders when requests are retried.

* Tracking of order acceptance and fulfillment statuses.

* Auditable synchronization and error handling.

* Protection of patient information and laboratory records.

The facility tenancy ID may be used to identify the intended PLS tenant, but it must not serve as the sole authentication or authorization mechanism. All integrations must use authenticated, authorized backend requests, with credentials and permissions managed securely.

The platform must never allow a facility to retrieve or modify another facility's records.

For non-PLS facilities, the marketplace should manage their catalogs and bookings independently until they adopt PLS or enter an approved integration arrangement.

## 6. Facility Dashboard and Administration

Every participating facility should have a dashboard appropriate to its integration category.

For PLS-integrated facilities, the dashboard should focus on connection status, incoming booking requests, payment-verification status, appointment scheduling, home collection requests, and synchronization issues. Core laboratory operations should remain within PLS wherever possible.

For non-PLS facilities, the dashboard must provide the minimum operational tools needed to manage their presence on the platform, including:

* Facility profile management.

* Test catalog and panel management.

* Price management.

* Booking and appointment management.

* Home collection scheduling.

* Payment-reference review and verification.

* Request status updates.

* Basic booking and revenue summaries.

* Staff access and permissions, where required.

The central PLS administration team should be able to review facility registrations, approve public listings, manage marketplace policies, monitor integration health, investigate disputes, and suspend facilities that violate platform requirements.

Administrative access must be governed by role-based permissions and audit logs.

## 7. Gradual Migration of Non-PLS Facilities

A major strategic objective is to use the platform as an entry point into the wider PLS ecosystem.

Independent laboratories should receive immediate value from online visibility, test discovery, catalog publishing, and booking management without having to adopt a full laboratory information management system at the outset.

The system should therefore be designed for a gradual migration pathway:

**Stage 1 — Marketplace Registration:** The facility registers, creates its profile, publishes its test catalog, and receives bookings without using PLS.

**Stage 2 — Operational Adoption:** The facility begins using additional PLS capabilities, potentially including patient registration, billing, inventory, sample tracking, and results management.

**Stage 3 — PLS Integration:** The facility connects its public marketplace profile to its PLS tenant, and authorized catalog and booking workflows begin synchronizing with the core system.

**Stage 4 — Full Platform Adoption:** The facility manages its laboratory operations through PLS while continuing to use the public website for patient acquisition, test booking, and service delivery.

Migration must preserve the facility's public identity and, wherever appropriate, its existing catalog, pricing history, booking history, and payment-verification records. The migration process must include identity matching, duplicate detection, validation, and reconciliation to avoid creating duplicate facilities, patients, or laboratory orders.

## 8. Architectural and Business Principles

The entire platform must be designed around the following principles:

* **One connected ecosystem:** The public website, marketplace, and core PLS platform must work together.

* **Multiple adoption paths:** Facilities can participate before or after adopting PLS.

* **Clear facility identity:** Patients must be able to distinguish PLS-integrated facilities from independent facilities.

* **Tenant isolation:** Each facility's data and operational permissions must remain separate.

* **Catalog integrity:** PLS facilities should use authorized data from their core configuration, while independent facilities manage their own catalog.

* **Payment accountability:** Payment claims, verification decisions, and transaction records must be auditable.

* **Operational consistency:** Booking requests must be processed according to explicit acceptance, payment, collection, and laboratory-order rules.

* **Future payment integration:** The payment workflow must support later automation without major architectural changes.

* **Migration readiness:** Independent facilities must be able to transition to PLS without rebuilding their online presence from scratch.

* **Patient privacy:** Access to personal information, results, and other sensitive records must be authenticated, authorized, and appropriately audited.

* **Extensibility:** The architecture must accommodate additional branches, facilities, service types, payment providers, and integrations as PLS grows.

## 9. Expected Outcome

The final product should establish Prime Laboratory System as both a laboratory management platform and a gateway connecting patients to participating medical laboratories.

Existing PLS customers gain an additional channel for attracting patients and managing digital bookings. Independent laboratories gain online visibility and booking capabilities without an immediate software migration requirement. Patients gain a convenient way to discover available investigations, compare published prices, choose a facility, arrange sample collection, and follow the progress of their requests.

Most importantly, the platform should create a practical commercial pathway through which independent laboratories can become full PLS customers over time, while preserving a consistent patient experience across the entire ecosystem.

## My key architectural recommendation

Brother, there is one decision I would establish before implementation: the marketplace should be a shared platform with two operational models, not two separate applications.

| Capability                     | PLS-integrated facility       | Non-PLS facility                           |
| ------------------------------ | ----------------------------- | ------------------------------------------ |
| Public facility profile        | Marketplace                   | Marketplace                                |
| Test catalog and prices        | Synchronized from PLS         | Managed on marketplace                     |
| Booking management             | Connected to PLS workflows    | Managed on marketplace                     |
| Payment verification           | Shared verification framework | Shared verification framework              |
| Sample and laboratory workflow | Primarily managed in PLS      | Managed through the facility dashboard     |
| Patient results                | Authorized access through PLS | Only when a secure results workflow exists |
| Future migration               | Already integrated            | Connect existing facility to a PLS tenant  |

This approach gives you one marketplace, one patient-facing booking experience, and a consistent integration layer, while allowing each facility to operate at its current level of technological adoption.

One additional point: Do not automatically create a laboratory order in PLS immediately when a patient submits a booking. First establish the facility's acceptance rules, payment requirements, and order-creation trigger. That will help prevent duplicate orders, unverified billing, and bookings that the laboratory has not agreed to fulfill.


OFFICIAL COLOR CODE #27ae60