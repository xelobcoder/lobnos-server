# MASTER IMPLEMENTATION PROMPT
## Redesign the Prime Laboratory System (PLS) User Manual into an Enterprise-Grade, Facility-Ready Training and Operations Guide

### 1. Your Role and Mission

You are acting as a multidisciplinary team comprising:

- Senior Technical Documentation Architect
- Healthcare Software Implementation Consultant
- Laboratory Information Management System (LIMS) Specialist
- Healthcare User Experience (UX) Designer
- Clinical Workflow and Patient Safety Specialist
- Software Quality Assurance Engineer
- Instructional Designer and Training Specialist
- Information Security and Data Protection Specialist

Your assignment is to critically evaluate, restructure, improve and regenerate the existing Prime Laboratory System (PLS) user manual.

**Your objective is not to produce the longest possible manual. Your objective is to produce the clearest, most accurate, practical and professionally presented manual that enables facility employees to learn and operate PLS independently.**

The manual must be suitable for healthcare facilities in Ghana and other markets where PLS is deployed.

It must be understandable to users with limited technical experience, while remaining sufficiently detailed for supervisors, administrators and trainers.

The final documentation must be grounded in the actual implemented application, not assumptions about how healthcare software generally works.

---

### 2. Review the Existing Manual Before Making Changes

The existing document is titled:

**Prime Laboratory System — Operations, CRM, Billing and Inventory User Manual**

It contains approximately 125 pages and is organized into four primary modules:

1. Operations
2. CRM
3. Billing
4. Inventory

The current manual includes numbered procedures, prerequisites, controls, verification steps, worked examples and troubleshooting guidance.

Preserve the useful parts of this structure.

However, conduct a critical assessment of the following deficiencies:

- Excessive display of technical application URLs.
- Instructions that describe concepts rather than actual user actions.
- Repeated generic statements across procedures.
- Insufficient screenshots and visual demonstrations.
- Weak or overly generic worked examples.
- Limited guidance for complete end-to-end workflows.
- Inadequate visual distinction between important actions and supporting information.
- Insufficient detail about the actual forms and their fields.
- Limited troubleshooting examples for real operational problems.
- Limited guidance for staff who have never used PLS.

Do not automatically assume every existing procedure is correct.

Review the actual source code and compare the documented behavior against the implemented behavior.

Produce an initial documentation gap assessment before regenerating the manual.

---

### 3. Replace Technical URLs with Human-Friendly Navigation

This is a mandatory and high-priority requirement.

The current manual frequently displays application routes such as:

`/operations/laboratory/sample/collection`

`/operations/laboratory/processing`

`/operations/laboratory/validation`

These routes should not be prominently displayed as instructions for ordinary facility staff.

Healthcare workers should not need to understand technical URLs or application routing.

Instead, provide a clear, structured navigation sequence using the actual visible menu names and controls in the PLS application.

#### Required navigation format

For example:

**Task: Collect a Patient Sample**

Step 1 — Sign in to Prime Laboratory System.

Step 2 — From the main sidebar, select **Operations**.

Step 3 — Open **Laboratory Operations**.

Step 4 — Select **Sample Collection**.

Step 5 — Locate the patient using the available search controls.

Step 6 — Verify the patient, visit and requested tests.

Step 7 — Open the relevant collection form.

Step 8 — Enter the required specimen information.

Step 9 — Save the collection record.

Step 10 — Confirm that the specimen status has updated successfully.

**Important:** This example illustrates the desired documentation style. Verify every menu name, button and action against the current application before including it.

#### Navigation breadcrumbs

At the beginning of each procedure, display a visually distinct navigation breadcrumb.

Example:

**Operations → Laboratory Operations → Sample Collection**

Where the actual interface requires intermediate steps, show them.

Avoid exposing raw route strings in the main body of the manual.

Technical paths may be retained in an internal developer reference or documentation metadata, but they should not distract end users.

#### Form-based navigation

Where a task requires multiple screens or forms, explicitly identify them.

For example:

- Screen 1: Patient Search
- Screen 2: Patient Details
- Screen 3: Specimen Collection Form
- Screen 4: Collection Confirmation

Explain what the user must do on each screen before proceeding.

Never invent screen names or assume that the application contains a wizard when it does not.

---

### 4. Introduce a Standard Procedure Template

Every procedure must follow a consistent instructional structure.

Use the following format:

**A. Procedure title**

Use an action-oriented title.

Example: "How to Register a New Patient."

**B. Purpose**

Explain briefly what the procedure accomplishes and when it should be used.

**C. Intended users**

Identify the roles normally responsible for the procedure.

**D. Before you begin**

Explain the required information, permissions and prerequisites.

**E. Navigation path**

Display the human-readable menu sequence.

**F. Step-by-step instructions**

Provide exact numbered actions in the order the user performs them.

**G. Form and field explanations**

Explain the purpose of important fields and which information is required.

**H. Expected result**

Describe what should happen after the action is completed.

**I. How to verify success**

Show the actual status, confirmation, record or report the user should inspect.

**J. Common problems and solutions**

Provide practical recovery guidance.

**K. Related procedures**

Link to the next logical task in the workflow.

Do not repeat generic instructions unnecessarily.

---

### 5. Use Real Application Screenshots Extensively

The current manual needs substantial improvement in visual instruction.

Inspect the actual frontend application and identify the important screens involved in each documented procedure.

Capture real screenshots from a controlled development or training environment.

Do not fabricate screenshots.

Do not use screenshots containing actual patient records, credentials, confidential financial information or production secrets.

Use fictional training data.

#### Screenshot requirements

Screenshots should:

1. Show the relevant application screen clearly.
2. Highlight the menu, button or field being discussed.
3. Include numbered annotations corresponding to the procedure steps.
4. Crop irrelevant browser or interface areas where appropriate.
5. Remain readable in both digital and printed PDF formats.
6. Use consistent annotation colors and typography.
7. Reflect the current application version.
8. Avoid showing unnecessary confidential information.

Where appropriate, use two or three screenshots for a complex procedure rather than compressing everything into one unreadable image.

#### Example screenshot sequence

For patient registration:

**Figure 1:** CRM navigation showing the patient registration option.

**Figure 2:** Patient registration form with important fields annotated.

**Figure 3:** Saved patient record showing successful registration.

Provide a short explanatory caption under each figure.

If a screenshot cannot be captured, mark it as requiring capture. Do not substitute an invented interface image.

---

### 6. Explain Forms and Fields Properly

The manual should teach users how to complete forms, not merely tell them to complete a form.

For each important form, identify:

- Field name.
- Purpose.
- Required or optional status.
- Accepted input format.
- Relevant validation rules.
- Dependencies on other fields.
- Common mistakes.
- Expected system behavior.

For example, a patient registration procedure should explain the actual patient identification and demographic fields implemented in PLS.

An inventory goods receipt procedure should explain the actual supplier, item, quantity, unit cost, batch, expiry and other fields present in the application.

Do not invent mandatory fields.

Verify validation behavior in frontend and backend code.

---

### 7. Document Complete End-to-End Workflows

Do not document every screen as an isolated activity.

Users need to understand how tasks connect.

Introduce visual workflow diagrams showing how one operation leads to the next.

#### Operations workflow

Document the actual supported sequence from:

Patient identification → Requested test → Specimen collection → Specimen review → Processing → Result entry → Validation → Report release → Report delivery.

Include conditional paths for rejected specimens, outsourced tests, critical results and amended results.

#### CRM workflow

Document the actual sequence from:

Patient search → Existing patient verification or new registration → Patient details → Service request or billing handoff.

Include duplicate-patient prevention and correction procedures.

#### Billing workflow

Document the actual sequence from:

Patient selection → Service selection → Billing strategy → Bill review → Payment → Receipt → Outstanding balance or settlement.

Cover partial payments, credit arrangements, refunds, organizational invoices and applicable insurance workflows.

#### Inventory workflow

Document the actual sequence from:

Item configuration → Supplier → Purchase order → Approval → Goods receipt → Inventory update → Supplier invoice/payable → Payment → Stock issue or consumption.

Show partial receipts, rejected quantities, stock shortages and inventory adjustments.

These workflows are illustrative targets. Match their actual steps, status transitions and available actions to the implemented PLS system.

Use decision diagrams where workflows branch.

---

### 8. Improve the Quality of Worked Examples

The existing manual often uses very brief hypothetical examples.

Replace these with realistic, complete training scenarios.

Examples should contain:

- A fictional patient, supplier or transaction.
- The starting situation.
- Relevant sample values.
- Actions performed.
- System calculations where applicable.
- Expected statuses.
- Verification evidence.
- Recovery steps when something goes wrong.

#### Example: Billing

A patient receives laboratory services totaling GH₵500.

The patient pays GH₵300.

Demonstrate the applicable payment workflow and show how the remaining GH₵200 is handled.

Explain what the cashier should verify on the payment record and receipt.

#### Example: Inventory

A pharmacy orders 100 units of an item.

The supplier delivers 80 units, of which 5 are damaged.

Demonstrate how the user records accepted and rejected quantities, handles the outstanding purchase order and verifies the resulting stock and supplier balance.

Do not assume the application supports a particular rejection or payable workflow until it is verified.

#### Example: Laboratory

A fictional patient requires two tests.

Demonstrate how the user identifies the patient, handles specimen collection, reviews processing requirements, records results and completes validation and report delivery.

Include at least one realistic exception.

---

### 9. Introduce Role-Based Learning Paths

The manual should support different facility employees without forcing everyone to read all 125 pages.

Develop role-based navigation and learning paths for:

- Receptionists and customer service representatives.
- Cashiers and billing officers.
- Laboratory scientists.
- Phlebotomists.
- Imaging practitioners.
- Inventory officers and storekeepers.
- Accountants and finance officers.
- Department supervisors.
- Facility administrators.

Each learning path should identify:

1. What the user is responsible for.
2. Which modules they normally use.
3. Which procedures they should learn first.
4. Which workflows they should practise.
5. Which actions require additional permissions.
6. Which competency checks they must complete.

Do not infer actual permissions from job titles alone. Read the implemented role and permission configuration.

---

### 10. Improve Troubleshooting and Recovery Instructions

Replace vague statements such as "check permissions" or "contact the administrator" with actionable troubleshooting procedures where the implemented system supports them.

For each significant operation, document:

- Common error or warning.
- Likely causes.
- Safe checks the user can perform.
- Actions the user should avoid.
- When to escalate.
- What evidence to provide to support.

Give special attention to:

- Failed patient registration.
- Duplicate patient records.
- Incorrect patient selection.
- Failed specimen collection.
- Rejected specimens.
- Result validation failures.
- Wrong result entry.
- Payment confirmation uncertainty.
- Duplicate payment prevention.
- Failed refunds.
- Purchase order discrepancies.
- Goods receipt discrepancies.
- Supplier payment reconciliation.
- Inventory shortages.
- Expired stock.
- Session expiration and network interruptions.

Do not recommend repeating a payment, stock receipt or clinical save until the original transaction state has been checked.

---

### 11. Include Clinical Safety and Data Protection Guidance

The manual is intended for healthcare facilities.

Therefore, operational safety must be integrated throughout the document.

Include practical guidance on:

- Correct patient identification.
- Specimen identification.
- Result verification.
- Authorization of clinical changes.
- Report delivery to authorized recipients.
- Confidential handling of patient records.
- Secure use of shared workstations.
- Appropriate printing and disposal of documents.
- Password and account security.
- Reporting suspected unauthorized access.
- Secure handling of exported records.
- Safe support requests.

Use Ghana's Data Protection Act, 2012 (Act 843), as a relevant legal framework for Ghanaian deployments.

HIPAA-aligned practices may be considered where relevant, but do not claim HIPAA compliance merely because security guidance is included.

Separate legal requirements, recommended practices and application-specific controls.

---

### 12. Improve the PDF Design and Readability

The final manual should resemble a professionally published enterprise software training guide.

#### Design requirements

- Professional cover page.
- PLS logo and consistent brand identity.
- Clear document title and version.
- Clickable table of contents.
- Consistent heading hierarchy.
- Readable typography.
- Adequate margins and whitespace.
- Numbered procedures.
- Consistent screenshot styling.
- Clear workflow diagrams.
- Page numbers and section references.
- Consistent tables.
- Properly positioned warnings and notes.
- Useful cross-references.
- Bookmarks for major modules and procedures.

Avoid excessive decorative graphics that do not improve comprehension.

Use restrained colors to distinguish warnings, instructions, examples and verification steps.

Avoid splitting important screenshots or procedure steps awkwardly across pages.

Do not artificially expand the document merely to increase page count.

---

### 13. Create Two Documentation Experiences

PLS should have two complementary documentation formats.

#### A. Complete PDF User Manual

This is the official reference and training document.

It should be suitable for:

- Facility onboarding.
- Classroom training.
- Supervisor reference.
- Offline consultation.
- Printing.
- Staff competency assessment.

#### B. Interactive In-Application Learning Center

Retain and improve the application's existing Learning Center.

It should allow users to:

- Search for a task by its common name.
- Browse procedures by module.
- Browse procedures by role.
- View screenshots and instructions.
- Open the relevant application screen.
- Navigate between related procedures.
- See applicable documentation version information.

Where technically feasible, the Learning Center should show contextually relevant help based on the current screen.

Do not create a second independent source of documentation content.

Both the PDF and Learning Center should be generated from a shared, version-controlled documentation source.

---

### 14. Verify Every Procedure Against the Actual Application

This requirement is mandatory.

Inspect the actual frontend and backend implementations.

For each procedure, verify:

- The route exists.
- The menu item exists.
- The visible labels are accurate.
- The form fields match the documentation.
- Required fields and validation rules are correct.
- The documented action is available to the intended role.
- The backend supports the described operation.
- The workflow transitions are accurate.
- The expected success state is correct.
- The recovery guidance is safe.

Source-code review alone does not prove runtime behavior.

Where possible, validate procedures in a controlled training environment using representative roles.

Classify each procedure as:

- **Verified:** Confirmed through appropriate application testing.
- **Source-reviewed:** Supported by code inspection but not live-tested.
- **Requires validation:** Not sufficiently verified.
- **Outdated:** Does not match the current application.
- **Unsupported:** Describes functionality not implemented.

Do not silently present unverified functionality as confirmed.

---

### 15. Documentation Governance and Version Control

Introduce formal documentation management.

Include:

- Document identifier.
- Document version.
- Applicable PLS software version.
- Publication date.
- Document owner.
- Reviewer.
- Approver.
- Revision history.
- Next review date.

Documentation should be updated when relevant features, forms, permissions or workflows change.

Maintain traceability between documentation procedures and the application features they describe.

Consider automated checks for broken routes, missing screenshots, invalid links and outdated documentation references.

---

### 16. Competency-Based Training

At the end of each module, include practical exercises.

Each exercise should have:

- Objective.
- Fictional training scenario.
- Required starting conditions.
- Tasks to perform.
- Expected system state.
- Evidence the trainer should inspect.
- Pass/fail criteria.
- Common mistakes.

Do not rely only on multiple-choice questions.

For example, a cashier should demonstrate the ability to process a partial payment and verify the outstanding balance.

An inventory officer should demonstrate a partial goods receipt without overstating stock.

A laboratory scientist should demonstrate correct result entry and understand why a changed result requires appropriate revalidation.

---

### 17. Required Deliverables

Produce the following:

**Deliverable 1 — Documentation Audit**

`PLS_MANUAL_AUDIT.md`

Include identified weaknesses, missing instructions, duplicated content, outdated guidance, verification gaps and recommended improvements.

**Deliverable 2 — Documentation Improvement Plan**

`PLS_MANUAL_IMPROVEMENT_PLAN.md`

Include prioritized work, affected modules, dependencies and acceptance criteria.

**Deliverable 3 — Revised Complete User Manual**

Generate the improved PDF using actual application information, verified navigation sequences, screenshots, workflow diagrams and practical training examples.

**Deliverable 4 — Role-Based Quick-Start Guides**

Create concise onboarding guides for each supported staff role.

**Deliverable 5 — Procedure Verification Matrix**

`PLS_MANUAL_VERIFICATION_MATRIX.md`

Map every procedure to its frontend implementation, backend behavior, required permissions, screenshots and verification status.

**Deliverable 6 — Documentation Change Log**

Document which procedures were added, revised, removed or flagged for further verification.

**Deliverable 7 — Updated Learning Center**

Where the existing architecture permits, improve the in-application documentation experience using the shared documentation source.

---

### 18. Execution Strategy

Work in controlled phases.

**Phase 1 — Discovery and audit**

Inspect the existing manual, application navigation, source code, role permissions and available documentation infrastructure.

Do not modify application behavior.

**Phase 2 — Information architecture**

Design the improved manual structure, navigation format, procedure template and screenshot strategy.

**Phase 3 — Pilot procedures**

Rewrite a representative set of procedures:

- Patient registration.
- Sample collection.
- Result entry and validation.
- Patient billing and partial payment.
- Purchase order and goods receipt.

Use these to establish the documentation quality standard before revising the entire manual.

**Phase 4 — Full revision**

Apply the approved structure to all four modules.

**Phase 5 — Visual documentation**

Capture, annotate and insert verified screenshots and diagrams.

**Phase 6 — Quality assurance**

Validate procedural accuracy, links, screenshots, readability, PDF layout and role-specific guidance.

**Phase 7 — Final delivery**

Generate the finished PDF, role-based guides, audit report and verification matrix.

---

### 19. Strict Rules

1. Do not invent functionality.
2. Do not invent interface screenshots.
3. Do not expose production patient information.
4. Do not expose passwords, tokens or API credentials.
5. Do not make unnecessary application code changes.
6. Do not alter production data.
7. Do not confuse source-code verification with live testing.
8. Do not replace useful existing content merely for stylistic reasons.
9. Do not use technical URLs as the primary user-facing navigation instructions.
10. Do not write vague steps such as "complete the form" without explaining the relevant fields and actions.
11. Do not introduce excessive repetition.
12. Do not present unsupported compliance claims.
13. Do not mark a procedure verified without supporting evidence.
14. Do not publish the final manual without completing its quality checks.

---

### 20. Final Acceptance Criteria

The assignment is complete only when:

- A new staff member can follow the instructions without needing to understand application URLs.
- Every procedure uses clear, sequential navigation.
- Important forms and buttons are explained.
- High-risk workflows include actual annotated screenshots.
- Clinical and financial actions include explicit verification steps.
- Common errors have safe recovery instructions.
- Worked examples demonstrate realistic transactions.
- The documentation reflects the implemented application.
- Each role can identify its relevant learning path.
- The PDF is professionally formatted and easy to navigate.
- The manual and Learning Center share consistent documentation content.
- Unverified procedures are clearly identified.
- The final documentation can be used by facility administrators to train employees.

**Final instruction:** Approach this assignment as the development of an official healthcare software training product, not a routine AI-generated PDF. The goal is to make Prime Laboratory System easy to learn, safe to operate, and straightforward to deploy across facilities with different levels of technical expertise.