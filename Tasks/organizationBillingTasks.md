# Partner Billing and Pharmacy Initiative

This folder contains the product and implementation plan for a new partner-facing billing workflow and the pharmacy/dispensary extension.

## Product Goal

Give approved organizations and clinicians a dedicated workspace where they can register patients, create laboratory orders using prices resolved by their existing center-configured billing strategy, submit bills for center approval, track samples and results, and receive final reports. Add structured investigation and medication ordering to consultation, internal dispensing backed by the existing inventory system, external prescriptions, and pharmacy point-of-sale for retail medicine sales.

## Non-Negotiable Rules

1. Existing clinician and organization billing strategies remain the authoritative pricing and service-eligibility source. A partner cannot define or edit its center-configured billing strategy or resolved price.
2. A bill must be approved before sample processing can start.
3. Hold and rejection actions require a reason and create an audit event.
4. Approval freezes the bill lines and prices. Any later edit creates a revision that requires approval again.
5. Only validated and signed results can be submitted to a partner.
6. Internal medication orders reserve and issue tracked existing inventory stock; external prescriptions never create inventory reservations or movements.
7. Organization and clinician users see only records owned by their billing entity.
8. Pharmacy point-of-sale sales, prescription dispensing, and returns use the same existing inventory availability and immutable stock-movement controls.
9. Pharmacy-only users can work without laboratory access; combined facilities may enable both pharmacy and laboratory workflows through capability and role configuration.
10. `Pharmacy` is a mandatory inventory category. Every medicine available to pharmacy workflows is created as a standard inventory item in this category; it carries its quantity and pharmacy sale price in inventory, without a separate pharmacy drug catalogue.
11. Pharmacy is an internal Lobnos module and uses the existing laboratory application shell, navigation, UI components, visual conventions, and accessibility behavior. The partner workspace remains the only separate product surface.

## Documents

- [Product requirements](./organization-billing-prd.md)
- [Workflow maps](./flowmap.md)
- [Implementation subtasks](./organization-billing-subtasks.md)

## Recommended Delivery

- **Release 1:** Identity, partner portal, existing billing-strategy integration, bill submission, and center approval queue.
- **Release 2:** Sample handoff, processing guard, partner tracking, and signed-result delivery.
- **Release 3:** Structured investigation ordering, prescriptions, pharmacy extensions to existing inventory, and dispensing.
- **Release 4:** Pharmacy point-of-sale, cashier shifts, retail receipts, returns, and pharmacy-only or combined-facility role access.

The detailed acceptance criteria and unresolved policy decisions are maintained in the PRD.