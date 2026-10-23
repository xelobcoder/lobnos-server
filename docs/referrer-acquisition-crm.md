# Referrer acquisition CRM

The CRM lead represents a prospective referring clinician or organization. It is never converted into a patient. Open `/crm/acquisition`; the old lead lists, creation, follow-up and analytics pages redirect into this workspace.

## Acquisition and ownership

The pipeline is prospect, contacted, pitched, negotiation, agreement pending, acquired or lost. Record visits, calls, meetings, emails and outcomes against a prospect. Pending follow-ups require a next-action date. Follow-ups belong to the prospect owner; reassign the prospect before delegating its tasks to another marketer. Reassignment moves outstanding tasks owned by the previous owner and updates the current referrer portfolio. Completed history keeps its original authorship.

Administrators and managers assign owners and link prospects to existing clinician/organization records. They can also create or match a referrer directly from prospect contacts through the existing referral creation service, preserving referral-code initialization. A clinician's organization/affiliation text is descriptive; establish actual clinician-organization links in the existing referrer management workflow. Do not infer historical organization referrals from today's clinician affiliation.

Existing leads are retained as unclassified prospects with their existing owners. A manager should classify them, confirm contacts, assign an operating branch/owner and link the corresponding referrer. No legacy lead is automatically treated as a patient or an approved referrer agreement. Existing follow-up ownership initializes from its lead owner, falling back to its original creator.

## Marketer role and access

Create or update a staff account using the new **Marketer** role and assign an operating branch. Marketers sign into the acquisition workspace and see only their assigned prospects and referrer portfolio. Their API access is limited to CRM and permitted session services; patient records, clinical operations, accounting and commission-payout APIs are blocked. Customer service representatives can use their assigned CRM portfolios; the rest of their front-desk workspace is retained.

Managers see the portfolios permitted by their operating branch; managers with no branch and super administrators have facility-wide access. Marketers cannot assign themselves someone else's prospect, relink existing referrers, approve commission agreements, edit authoritative financial rates or make payouts. All CRM ownership and workflow actions record the authenticated employee.

## Commission proposals

Marketers select an existing active commission plan, propose current/future dates and record negotiated context. Administrators may explicitly override percentage/fixed rates and per-case bounds for simple plans inside the CRM; notes alone never change calculated rates. Advanced tier/volume/quota plans are configured in commission settings. Create new rate templates in the existing commission configuration module when needed. Proposal cards display the full terms, including rate tiers and caps. An administrator or manager approves or rejects the proposal with review notes. Administrators and super administrators may approve their own proposals; managers require a different reviewer. The original proposer and reviewer remain recorded in the audit trail.

Approval verifies that the template and tiers have not changed since submission and freezes the terms in a dedicated commission configuration. It creates a recipient-specific assignment used by the existing commission engine. Overlapping general assignments are ended immediately before the new start date while historical eligibility remains active for its original dates. Future/current conflicting assignments must be resolved in commission settings first. Service-specific overrides and existing recipient policies still apply. Approval does not recalculate or pay historical commissions. Failed approvals roll back configurations, tiers, assignments and decision changes together.

An acquired acquisition stage requires a linked referrer and approved agreement. Acquisition is separate from agreement timing: a future approval is acquired with a scheduled agreement; expiry does not erase the acquisition. Rejecting a renewal preserves an already acquired relationship. First actual referral is tracked separately in performance reports; an agreement alone does not count as a referred case.

## Referral performance

- A case is a distinct billing order containing an active, non-refunded service attributed to the selected referrer dimension. Unpaid referrals remain included.
- Patients are counted distinctly. No patient identities are returned to the marketer dashboard.
- Tests count ordered tests attached to included services; they are distinct from cases.
- Billed revenue uses service totals. Collections are current payments against services billed in the chosen period, not cash receipts dated during that period.
- Commission is final accrued tracking after calculation adjustments for the selected recipient, including paid and unpaid amounts, excluding voided/adjusted tracking. Paying commission never removes a referral from the report.
- Global case/patient totals are calculated distinctly across the portfolio, rather than summing referrer counts. A billing order may be attributed to both a clinician and an organization; never add those two dimensions together.
- Select **Current portfolio relationships** to compare today's assigned relationships across both periods, or **Owner at referral date** for dated ownership credit. Historical mode uses the owner at the service-order timestamp. Ownership records start at rollout (or first link); earlier ownership is unknown and receives no fabricated credit. Reassignment closes the old interval and opens the next at the same timestamp. Current owner names remain visible as relationship context.
- First/last referral dates use all active, non-refunded referral history. Relationships with zero current referrals remain visible, including inactive, declining and not-activated relationships.

Select current dates and compare with an equal previous period, the same range shifted one week/month/year, or custom dates. Month/year shifting clamps invalid month-end/leap dates. Exact compared dates are displayed; date preferences are saved per facility and employee in the browser. When the comparison value is zero, new activity is displayed without inventing a percentage increase. Relationship attention filters narrow the table; summary totals retain the full date/search/owner-filtered portfolio.

## Rollout and validation

Deploy backend and Lobnos together and restart through the normal application process. Tenant startup applies the idempotent CRM schema additions. The standalone migration allowlist includes `20261023_referrer_acquisition_crm` and `20261023_crm_relationship_workflow`. Configure eligible commission templates, classify legacy prospects, link referrers and assign portfolios before expecting marketer analytics to populate. The acquisition audit and agreements are retained on migration rollback.

The new endpoints are under `/api/v1/crm`: options, performance, prospects, prospect detail/link/proposals/review, and follow-ups. Legacy lead/follow-up routes now enforce the same CRM permissions and delegate to the new workflow. Legacy delete-lead requests archive unlinked prospects; follow-up deletion is rejected in favor of cancellation. Legacy analytics screens redirect to referral performance; consumers of the old lead-analytics response need to adopt the new report contract.

Backend build, frontend TypeScript source checks, focused CRM/security tests and the existing login-redirect tests were run. An earlier broader backend run passed 2063 tests with three unchanged facility-authority alias assertions failing in `FacilityInput.test.ts`. Browser interaction and live clinical/financial transactions were not performed. Outreach recording does not send email or SMS. A tenant reminder worker runs each minute and stores deduplicated CRM reminders for tomorrow, today, overdue tasks and escalation to active branch administrators/managers after three overdue days. The CRM inbox restricts reminders to the current authorized owner/manager, current due date and current urgency; completing/rescheduling/reassigning tasks removes obsolete reminders from view.

## After agreement approval

The prospect drawer includes a post-agreement handover panel. Its status comes from actual active general commission assignments and their date windows, rather than the acquisition stage or approval history. Effective, scheduled and missing/expired assignments are distinguished. First-referral evidence comes from active, non-refunded services attributed to the linked referrer within the signed-in branch scope; it may predate the agreement and is not proof of commission eligibility. No patient data is returned.

The marketer schedules onboarding using the prefilled follow-up action, confirms terms and referral instructions, and provides reception with the linked referrer name and ID. Reception attributes actual service orders to that record. A performance shortcut opens the relevant referrer dimension and search. Managers can open assignment settings and commission review from the handover. Commission payment remains a separate authorized finance action. These changes do not automatically send messages, create referrals or pay commission.

## Saved workflow and complete history

The referrer drawer separates Overview/onboarding, Agreements, Follow-ups and History. Onboarding steps are persisted per approved agreement with responsible current owner, due date, completion actor/time, evidence, version checks and audited reopening. First-referral verification requires actual active, non-refunded service evidence within the agreement/assignment date window and signed-in branch scope.

Pending proposals can be amended without rejection. The amendment refreshes template terms, validates new current/future dates, preserves prior data in audit history and makes the amending user the proposer. Existing negotiated overrides require an administrator to amend. Every approval checks the proposal version so a stale reviewer cannot approve terms changed in another session. Administrators may self-approve; managers require a different reviewer.

The eligibility preview is read-only and displays facility recipient policy, competing assignments, binding rates and a sample amount for simple plans. It is an illustration before period limits, not a guaranteed payout; actual recipient attribution, completion date, outsourcing, tiers, volume, quotas and caps remain authoritative. First-referral reconciliation compares actual tracking to each approved assignment and distinguishes awaiting referral/calculation, agreement applied and different rule/recipient. It returns no patient or service identifiers and never recalculates or pays commission.

Detail views explicitly label their latest-record limits. History supports independently paginated activities, follow-ups and proposals (25 per page) with totals and recorded amendment details. Approved agreement choices and pending status are queried independently of the truncated recent-proposal list.

Validation for the relationship workflow change: backend build; frontend TypeScript source check and Next SWC server/client validation; 84 CRM/commission/access/provisioning tests; 23 frontend rendering/login tests. No live browser, database migration or clinical/financial transactions were performed. Restart backend and frontend together; tenant startup applies the new schema and starts reminder workers.
