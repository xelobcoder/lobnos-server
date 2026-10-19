First of, when you go to the operation tables and you open a folder or you open a client data to select the test. When you validate the test, when you collect the sample, you validate the sample, you start processing and in processing. What happens is that when the results entry, when you finish results entry and you save, the button for validation doesn't appear because when you look at the timeline, you realize that all those collection, the processing, the validation of sample timeline are locked, but results entry start remains now, whilst results entry end time is recorded. So in actual fact, it is a problem. So in this case, I'm not able to validate a test before I can even think of printing out. That's one. The second thing has to do with the patient portal tests, where you see the list of tests, the list of tests that the patient is doing. Now you see that it is categorized according to the date. Now I just want a table. We already have a filter there where we filter by yesterday, tomorrow, yesterday, today, last month, whatever. So the list should appear in a table. If I'm filtering by a particular date, the data should appear in a table. It should not be aggregated according to date. That's something you should know. Now thirdly, when you go to your consultation panel, now when I make a request for a test, and I even submit, when I go to my lab orders in the consultation portal, you don't see those orders. I don't know what is happening. I think you need to address it, so that anytime consultation or anytime laboratory test are recommended from the consultation panel, when you go to my lab orders, you should see it irrespective of the stage it is. That is something you need to do.



--------------------------------------------------------------------
So, still at the consultation panel. You know, the consultation panel is meant for doctors or healthcare practitioners who have been registered on this system, where they can do consultation, order lab tests, order drugs. So when I go to my lab orders, I should see the drugs that I have imported, irrespective of the stage. It says whether converted, whether submitted, whether on hold, whether rejected. And we should be able to filter it using the date reusable component. That is another thing. And also, that's one thing. Now, you realize within the same page, you have overview. The overview should be a brief summary of the orders and other, other, other things that the doctors can see. Now also, I realize there's a commission link, but however, it doesn't show anything. Remember, when you go to the commission section and you go and select a clinician, you are able to see the commission earned by the clinician. So the doctor in his portal should be able to see the commission he has made, and even in the form of a chart, showing, which has also a date reusable filter, so that at least I can see, okay, how much commission has been made within the last month, last year, whatever. We need to do that. Take note.


---------------------------------------------------------

Still under consultation portal. When I go to the laboratory request made, or let me say the request, the link request. I don't know whether you are getting me. The link request. When I go to the request test slash doctor slash requested dash test slash doctor slash requested dash test, I see the list of tests that we made. It's sortable by date, and so much, which is good. The issue is that when I open, I am not able to see the results. I should be able to see as a clinician, a doctor who has requested for a test, and I go to the requested test, I should be able to see the list of tests. The requested test will show the test I have requested as a clinician. Now, when I click open, I should be able to see the stage of the test. For example, if it's in processing, I should be able to see in processing, the stage of the test, the time the sample was collected and everything. And if the results is ready, I should be able to see the results. Now there should be two ways of seeing the results: either I see it in the format of a table where I'll see the test, the unit and the reference, or I can also choose to see it in the form of a PDF, as the scientist, when he is trying to print out the results, will see the results, or when you go to the patient portal, the way the results is printed, in the PDF format. I, that means, that should be easily done at the consultation panel. This thing should be easily done. It should be easily visible. We should be able to see the test. We should be able to open it. We should be able to see the stages of it. We should be able to see the results when it's ready.


---------------------------------------------------------------------

Another complaint the scientists have also complained, the scientists or lab scientists that are using the software in facilities, that when it comes to printing of multiple results, they're commenting. I don't know whether it's from the back end or the front end, is that it's aggregated. No. They want each test, after everything, below it, you should see the comment. So instead of aggregating all the comments and putting at the end of the last test, it should be done according to the test. So if I have four tests, the care consistency is that when I have commented on all the tests, it appears at the end of the last test, the fourth test. But each test has its comment, so it should appear directly under the test. So can we address that as well?


----------------------------------------------------------------------------



Now, we come to the appointment side. In creating an appointment, when we create an appointment, sometimes it goes through. It goes through and is successful created, but because the database, because the backend returns status false, in the front-end it's displayed as failed, right? Which is a bad thing. We need to correct that. Now, another thing is that we book an appointment for ultrasound. You get it? Now you click, go to the calendar, click, for Open Workflow Ultrasound, go to ultrasound, and it's virtually empty. I don't know what the intention was, but I think, for example, we book a client for ultrasound. If it's ultrasound, we need to indicate which of the ultrasound tests, or ultrasound we are booking the person for. So when we click, when the date is due, automatically, or a day or 30 minutes to that thing, we can send either an email or SMS. Now when the person comes, we click on the calendar, we open it on Workflow in the ultrasound side. It opens onto a page called recommendation. So you see the appointment. Then you can convert it to a test, or you can convert it to a bill. Now the user goes to the cashier and makes payment for that particular ultrasound and the ultrasound is done. That would have been a very good workflow. We book appointment ahead of time. We select either the test. If it's laboratory or if it's ultrasound, we select the ultrasound. It goes into the recommendation page, either in the lab tests section, the question section, or the imaging section, which is the ultrasound. It is converted to bill by whoever is operating at that side. The person goes to the cashier, makes payment, and the test is carried out. That would have been a very good approach for us all.


Brother, the appointment workflow should be treated as an end-to-end clinical workflow in PLS, not just a calendar feature. Your proposed approach is sound: an appointment schedules a future service, the relevant department receives a recommendation, that recommendation is converted into a bill, the patient pays at the cashier, and the service is performed through the existing laboratory or imaging workflow.

There are two problems to address: incorrect appointment-creation failure reporting and an incomplete appointment-to-service workflow, particularly for ultrasound.

## 1. Fix appointment creation reporting

The frontend must not display “Failed” merely because the backend returns a `status: false` field when the appointment was actually created successfully.

The implementation must distinguish between:

- Successful creation: the appointment was persisted and the response confirms the created appointment.
- Business-level failure: validation, authorization, or another genuine business rule prevented creation.
- Technical failure: the server or database operation failed.
- Indeterminate outcome: the request timed out or returned an ambiguous response, so the frontend cannot safely assume either success or failure.

The backend response contract and frontend interpretation need to be reviewed together. HTTP status, response payload, and actual persistence must be consistent. Do not simply change `false` to `true` or treat every response as successful.

For an indeterminate outcome, the frontend should check whether the appointment already exists before allowing a retry, to avoid duplicate appointments.

## 2. Appointment booking must capture the actual service

When a staff member creates an appointment, the form must adapt to the selected appointment type.

For an ultrasound appointment, the user must select the specific ultrasound examination being booked, rather than simply choosing “Ultrasound.”

Examples include:

- Obstetric ultrasound.
- Pelvic ultrasound.
- Abdominal ultrasound.
- Prostate ultrasound.
- Renal ultrasound.
- Other ultrasound examinations configured by the facility.

The list must come from the facility's configured services and applicable pricing, not a hardcoded list that becomes disconnected from the billing system.

The appointment should capture the patient, service, date, time, referring clinician where applicable, contact details, and relevant booking notes.

## 3. The complete appointment-to-service workflow

1\. Book appointment

Select the patient, service type, specific examination, date and time.

2\. Schedule reminders

Send confirmation and configured reminders by SMS or email.

3\. Appointment appears on calendar

The appointment retains its service type and examination details.

4\. Open Workflow

Route the appointment to the correct department's recommendation page: Laboratory or Imaging/Ultrasound.

5\. Convert recommendation to bill

The authorized staff member verifies the service and creates the bill using existing PLS billing rules.

6\. Cashier receives payment

The patient pays against the correct bill, with the payment recorded against the appointment's service.

7\. Perform the service

The paid order becomes available in the appropriate existing laboratory or ultrasound workflow.

The important distinction is that booking an appointment does not automatically mean the patient has been billed, paid, or examined. Each stage must have its own valid state and audit trail.

### 4. What should happen when the user clicks “Open Workflow”?

For an ultrasound appointment, clicking the calendar entry and selecting Open Workflow → Ultrasound must not open an empty page.

It should open the relevant Imaging/Ultrasound recommendation screen with the appointment and patient information already populated.

That screen should allow authorized staff to:

- Review the booked ultrasound examination.
- Confirm the patient and appointment details.
- Convert the recommendation into a bill.
- Send the patient through the normal cashier payment process.
- Continue into the ultrasound workflow once the applicable billing and authorization requirements are satisfied.

For a laboratory appointment, the same principle applies, but the destination must be the Laboratory recommendation workflow.

The implementation should use existing PLS recommendation, billing, payment, and service-order mechanisms wherever possible. It must not create a second, disconnected pathway just for appointments.

## 5. Appointment reminders: email and SMS

The reminder system should support configurable notification schedules, including:

| Trigger                              | Action                                   |
| ------------------------------------ | ---------------------------------------- |
| Appointment created                  | Send confirmation, if enabled.           |
| 24 hours before                      | Send a reminder, if enabled.             |
| 30 minutes before                    | Send a reminder, if enabled.             |
| Appointment rescheduled or cancelled | Send the appropriate update, if enabled. |

These are proposed defaults that the facility should be able to configure. The notification engine must respect the facility's enabled channels, available contact details, tenant-specific SMS/email configuration, and notification preferences.

Reminders should be scheduled as background jobs, with duplicate prevention, retry handling, and delivery logs. A reminder should not be sent for a cancelled appointment or an obsolete appointment time after rescheduling.

## 6. Critical implementation rules

- One appointment, one linked workflow: prevent duplicate recommendations, bills, and orders when users reopen the same appointment.
- Correct billing: use the configured price for the selected ultrasound or laboratory service and existing facility billing rules.
- Payment integrity: payment confirmation must come from the actual billing/payment records, not merely from opening the workflow.
- State synchronization: appointment, recommendation, bill, payment, and service-order statuses must accurately reflect the actual stage reached.
- Auditability: record who created, rescheduled, converted, billed, and processed the appointment.
- Facility isolation: all appointment configuration, services, prices, notifications, and patient data must remain within the correct facility's existing tenancy and authorization boundaries.

## 7. Acceptance tests

Before considering this complete, verify these scenarios:

1. Create an appointment successfully and confirm that the frontend reports success when persistence succeeds.
2. Simulate an actual creation failure and confirm that a meaningful failure is displayed.
3. Book a specific ultrasound examination and confirm it appears correctly on the calendar.
4. Open its workflow and verify that the Imaging/Ultrasound recommendation page contains the correct patient and examination.
5. Convert the recommendation into a bill and verify that the cashier can collect payment against that bill.
6. Confirm the paid service becomes available in the correct ultrasound workflow without duplicate orders.
7. Repeat the process for a laboratory appointment.
8. Verify reminders at the configured intervals and confirm cancelled or rescheduled appointments do not generate stale reminders.
9. Confirm that reopening an appointment or retrying a request cannot create duplicate bills or recommendations.

Brother, this should be implemented as an extension of the existing PLS appointment, recommendation, billing, and notification architecture—not as a new standalone appointment module.&#x20;

------------------------------------------------------------------
suggestion to consulttion portal commission

Brother, noted. This is an enhancement to the PLS Consultation Panel and Clinician Portal. The goal is to ensure registered doctors and healthcare practitioners can manage their laboratory orders, drug orders, and earned commissions from one place, using the existing PLS workflows and reusable UI components.

## PLS Consultation Panel — Requirements to Implement

### 1. Lab Orders: Complete Order Visibility

The Lab Orders page must display all orders associated with the clinician, irrespective of their current processing stage.

- Include orders that have been converted, submitted, placed on hold, rejected, or are in other existing workflow states.
- Do not exclude an order simply because it has progressed to another stage.
- Provide status filters so clinicians can quickly find orders in a particular state.
- Integrate the existing reusable date-range filter component to filter orders by the relevant order date.
- Preserve existing pagination, search, sorting, and authorization rules where applicable.

### 2. Overview: A Meaningful Summary

The Overview section should provide a concise operational summary rather than empty or redundant dashboard cards.

It should summarize relevant information such as:

- Total laboratory orders.
- Orders grouped by status.
- Total drug orders and their current statuses.
- Recent activity and outstanding orders.
- Commission earned within the selected period, where appropriate.

The summary should be calculated from the actual underlying data, respect clinician-level access, and remain consistent with the detailed pages.

### 3. Clinician Commissions: Functional Reporting

The existing Commission link must become a fully functional section of the clinician portal.

## Proposed Commission Dashboard

Illustrative layout — figures below are examples, not actual PLS data.

Total Commission Earned

# GHS 2,450

Current Month

# GHS 680

Commission Transactions

# 38

Pending Commission

# GHS 320

### Commission Trend

Illustrative monthly commission trend

Example data showing the proposed chart format only.

GHS 300GHS 450GHS 600GHS 750MayJunJulAugSepOct

The production dashboard must use actual commission records from the existing PLS commission module.

Required functionality:

- Retrieve commission records for the authenticated clinician.
- Reuse the same commission calculation and transaction logic already used in the facility's Commission section when a clinician is selected.
- Display commissions earned over time in a chart.
- Integrate the reusable date-range filter so clinicians can select today, this week, this month, last month, this year, last year, or a custom date range, subject to the component's existing capabilities.
- Show a transaction-level breakdown, including the applicable service or order reference, commission amount, date, and available status.
- Clearly distinguish earned, pending, approved, and paid amounts where those states exist in the current PLS commission model. Do not invent new financial states or treat pending amounts as paid.
- Ensure the totals, chart, and transaction list all respond to the selected date range.

### 4. Drug Orders: Full Lifecycle Visibility

The consultation workflow also allows clinicians to order drugs. The drug-order section should follow the same visibility principle as Lab Orders.

- Display all relevant drug orders, including imported orders, regardless of whether they have been converted, submitted, placed on hold, or rejected.
- Preserve the actual statuses supported by the existing drug-order workflow.
- Provide date-range and status filtering.
- Keep drug orders distinct from laboratory orders while maintaining a consistent user experience.

### 5. Implementation and Acceptance Criteria

| Area               | Required outcome                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| Lab Orders         | All relevant orders are visible across workflow stages.                                           |
| Date filtering     | The existing reusable date component filters the correct records.                                 |
| Overview           | Accurate, useful summaries based on real data.                                                    |
| Commission link    | Opens a working clinician-specific commission dashboard.                                          |
| Commission chart   | Shows actual earnings over the selected period.                                                   |
| Commission details | Summary figures reconcile with transaction records and existing facility commission calculations. |
| Drug Orders        | Imported orders remain visible across workflow stages.                                            |
| Security           | A clinician can access only records they are authorized to view.                                  |
| UI consistency     | Follow the established PLS frontend patterns and reusable components.                             |

Important implementation principle: Do not create a separate commission calculation engine for the clinician portal. Reuse the existing facility commission logic and expose the appropriately authorized data to the clinician's portal. This prevents discrepancies between what the facility sees and what the clinician sees.

I would treat this as a cross-layer implementation task: inspect the existing frontend, APIs, database queries, commission calculations, and order-status workflows first; identify why the current sections are incomplete; then implement and test the changes end to end. Avoid introducing duplicate components or parallel business logic where reusable PLS functionality already exists.


----------------------------------------------------------------------

/patientportal/results  should be a table and not agreagted by date in the table


---------------------------------------------------------------------

So when you go to the daily sales, select the branch, or you go to the daily sales, you select the branch and go to the main page. In the admin, or super admin, you see something we call pivot table, and I think most of the clients are not use the pivot table. So we should take it off. That is fine. Now within that page you realize that when you go to the actions, there are a lot of options: view transaction details. Some of my clients have complained that they have to navigate to another page to see the transaction details. That is the breakdown of the test that the person is doing. And when you go to the view transaction details, there are a lot of functionalities like refunding, so many functionalities. So in the daily sales side, maybe sometimes they don't need to, they don't want to go to the view transaction details to carry out any transaction, any action, but then they just want to see the list of the test for that particular client. So maybe in sort of we can make it in a way that we can always click something to see the list of tests within that particular page instead of moving to the view transaction details page. So that anytime we want to carry an action, then we now move to the view transaction detail. But if we just want to see, what's the name, the list of tests, we should be able to just get something so that for that particular transaction I can see the list of tests. Okay.


Brother, the improvement here is to make the PLS Daily Sales page faster for routine work by showing the test breakdown inline, without forcing users into the full transaction details page just to see which tests a patient was billed for.

## Daily Sales — Proposed UI improvements

### 1. Remove the Pivot Table

- Remove the Pivot Table feature from the Daily Sales landing page if it is not being used by clients.
- Preserve the existing daily sales summaries, branch selection, filters, and transaction listing.
- Check whether the pivot table has any dependencies before removing its UI entry. Do not accidentally remove underlying reporting functionality that another feature uses.

### 2. Add “View Tests” directly to each transaction

Instead of navigating to another page just to inspect the tests, each transaction should have a lightweight inline expansion or a small View Tests action.

## Daily Sales

Selected branch: Main Branch · Example transaction

Paid

TXN-001245

Patient: Example Patient

3 tests · GHS 180.00

View TestsTransaction Details

### Example inline test breakdown

Full Blood Count (FBC)

GHS 80.00

Malaria RDT

GHS 30.00

Widal Test

GHS 70.00

Total

### GHS 180.00

Illustrative data only. In production, show the actual tests and amounts recorded against the selected transaction.

The example demonstrates the intended layout. The production implementation should use the existing PLS design system and transaction data.

### 3. Keep transaction details for actions

The inline test breakdown is for quick inspection. The existing View Transaction Details page remains the place for actions that require the full transaction context, such as:

- Refunds and applicable refund approvals.
- Transaction corrections or other authorized adjustments.
- Detailed payment and billing history.
- Other existing transaction-level operations.

This separation prevents routine viewing from becoming unnecessarily complicated while preserving existing financial controls and audit trails.

### 4. Implementation requirements

- Display the test list within the Daily Sales page, ideally by expanding the transaction row or opening a compact panel.
- Show the test name and relevant recorded amount, with other useful fields such as quantity or status where supported.
- Load details for the selected transaction only, using existing APIs where possible.
- Preserve branch filtering, pagination, and search.
- Ensure the breakdown reflects the actual billed items, including applicable discounts or adjustments according to existing PLS transaction rules.
- Enforce existing permissions and branch-level access.
- Avoid duplicating the transaction details page or introducing a separate test-pricing calculation.

Acceptance criterion: A user can select a branch, open Daily Sales, and see the tests associated with any transaction without leaving the page. When a financial or administrative action is required, the user can still open the full transaction details page.

----------------------------------------------------------------------

Suggestions from clients. There are instances. The person is referred from an organization. They come to do the test, or a list of tests, and it's on postpaid basis. That is a contract between the facility and the organization. So they invite a client. The client comes. We do the test. They are not paying anything. It's on credit. Now, when that happens, we need to be able to generate an invoice where we have from, which is our facility, our details, to the facility, their details, the list of tests we are doing, the cost, and the amount due. A very professional, standard, very professional, extremely professional and standard invoice where we generate a PDF out of it, just as we generate PDF in the report side. We print it out, give it to the person, or keep it later for when we get our money. That would have been a very good one for us well. So it should have the company headers and everything, the logo. If the facility has a logo, that's fine. If it doesn't, then we use the details. I believe you know what I'm talking about.

Brother, this is an important addition to the PLS billing system. What you are describing is a professional organizational credit invoice for services rendered to patients referred by companies, institutions, and other contracted organizations.

The key principle is that the patient receives the service without paying at the point of care, while the facility records the amount owed by the referring organization. PLS should then generate a formal, printable PDF invoice that can be given to the organization or retained for accounts receivable follow-up.

## Proposed PLS organizational credit invoice

# INVOICE

ORGANIZATIONAL CREDIT BILLING

### PRIME / FACILITY NAME

Facility logo, address, telephone, email and other registered details

INVOICE

PDF / Print

FROM — SERVICE PROVIDER

Facility Name

Registered facility address

Telephone · Email

Facility registration details, if configured

BILL TO — CONTRACTED ORGANIZATION

Organization Name

Organization's registered address

Accounts department / contact

Organization reference or contract number

Invoice Number

INV-2026-000123

Invoice Date

19 October 2026

Payment Terms

As agreed in contract

Patient / Reference

Patient or referral reference

Description of Services

| Service / Test           | Qty | Amount (GHS) |
| ------------------------ | --- | ------------ |
| Full Blood Count         | 1   | 80.00        |
| Malaria Test             | 1   | 30.00        |
| Other contracted service | 1   | 50.00        |

Subtotal

GHS 160.00

Payments received

GHS 0.00

## AMOUNT DUE

# GHS 160.00

Illustrative invoice only. All names, amounts, invoice references and dates must come from actual facility and transaction records in production.

Payment instructions: Use the facility's configured bank or approved payment details.

Authorized by: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Thank you for your continued partnership.

## How it should work in PLS

1. Register the organization and its credit terms. The facility maintains the organization's billing details, agreed payment terms, applicable contract pricing, and credit arrangement.
2. Register the patient and order the services. Associate the patient and requested tests with the referring organization. The order must be identified as organizational credit or postpaid, rather than ordinary cash billing.
3. Perform the services without collecting patient payment. The workflow must allow the authorized staff to proceed under the organization's credit arrangement, while recording the financial obligation.
4. Generate the invoice. Authorized staff generate a professional PDF containing the facility's details, organization details, invoice number, service descriptions, quantities, agreed charges, payment terms, and amount outstanding.
5. Print, download, or retain the invoice. The invoice should be available from the relevant transaction and the organization's accounts receivable records.
6. Record payment when the organization pays. Payments must be allocated to the appropriate invoice, with outstanding balances updated accurately. Support partial payments and outstanding balances where appropriate.

## Essential requirements for an enterprise-standard invoice

1\. Facility branding

- Use the facility's configured logo when available.
- If no logo exists, produce a clean, professional document using the registered facility name and contact details.
- Include configured addresses, tax or registration identifiers where applicable, and payment instructions.
- Use consistent typography, spacing, alignment, and page numbering for multi-page invoices.

2\. Correct financial records

- Generate a unique invoice number using a reliable, concurrency-safe sequence.
- Use the organization's agreed prices and applicable contract terms.
- Show subtotal, applicable discounts or taxes, payments already received, and the outstanding amount as appropriate.
- Never mark a credit invoice as paid merely because the tests were completed.
- Ensure the PDF reconciles with the underlying invoice and accounts receivable records.

3\. Confidentiality

Organizational invoices may contain patient information. Include only the identifying information needed for billing and contract reconciliation, and enforce the facility's existing authorization rules.

4\. PDF generation

Use the existing PLS PDF/report-generation infrastructure where suitable, but implement an invoice-specific template. The invoice should be optimized for A4 printing, readable in PDF viewers, and consistent across facilities.

5\. Accounts receivable integration

The invoice must not be an isolated PDF. It must be linked to the organization, the relevant services and transactions, and the outstanding receivable. This allows the facility to track unpaid invoices, payment history, and balances owed by each organization.

## One important distinction

PLS should distinguish between a service-level credit transaction and a consolidated organizational invoice. A facility might issue an invoice for one referred patient, or combine multiple eligible services or patients into a periodic invoice according to its contract with the organization. Consolidation should be supported only when the facility's billing policy permits it.

The recommended implementation is to begin with a complete, individually traceable organizational credit invoice and ensure it integrates correctly with accounts receivable. Periodic consolidated invoicing can then use the same underlying invoice and allocation model.

Acceptance criterion: A facility can process a patient referred under an organization's postpaid contract, perform the authorized services without collecting payment from the patient, generate and print a professional PDF invoice, and later record the organization's payment without losing the link between the invoice, services, and receivable.