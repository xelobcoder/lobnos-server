# Frontend Integration Guide

This document explains how frontend should call the new APIs for:

- Discount and surcharge limits by role
- Result delivery preference and chain of delivery
- Patient personal-information audit history

## 1. Discount Limit Management

These endpoints are for admin users to configure the limits used during billing.

### 1.1 Get All Discount Rules

- Method: `GET`
- URL: `/api/v1/billing/discount-limits?tenantId={tenantId}&employeeid={adminEmployeeId}`

Example response:

```json
{
  "status": true,
  "rules": [
    {
      "id": 1,
      "role": "crm",
      "is_active": 1,
      "max_discount_per_transaction": "20.00",
      "min_transaction_total_for_discount": "200.00",
      "max_discount_per_day": "100.00",
      "max_surcharge_per_transaction": "0.00",
      "min_transaction_total_for_surcharge": null,
      "max_surcharge_per_day": "0.00",
      "updated_by_employeeid": 4,
      "created_at": "2026-04-27T13:14:00.000Z",
      "updated_at": "2026-04-27T13:14:00.000Z"
    }
  ]
}
```

### 1.2 Create Or Update A Rule

- Method: `POST`
- URL: `/api/v1/billing/discount-limits?tenantId={tenantId}&employeeid={adminEmployeeId}`

Payload:

```json
{
  "role": "crm",
  "is_active": true,
  "max_discount_per_transaction": 20,
  "min_transaction_total_for_discount": 200,
  "max_discount_per_day": 100,
  "max_surcharge_per_transaction": 0,
  "min_transaction_total_for_surcharge": null,
  "max_surcharge_per_day": 0,
  "updated_by_employeeid": 4
}
```

Expected response:

```json
{
  "status": true
}
```

Notes:

- `role` is normalized to lowercase in backend.
- Allowed roles: `crm`, `customer representative`, `customer service representative`, `manager`, `accountant`, `admin`, `super-admin`.
- The role must exist in the system `roles` table. Unknown roles are rejected.
- If a role has no rule configured, backend blocks discounts/surcharges for that role during billing submit.

### 1.3 Get Daily Usage

- Method: `GET`
- URL: `/api/v1/billing/discount-limits/daily-usage?tenantId={tenantId}&employeeid={adminEmployeeId}&date=2026-04-27&role=crm`

All filters are optional except `tenantId`.

Example response:

```json
{
  "status": true,
  "usage": [
    {
      "id": 3,
      "usage_date": "2026-04-27T00:00:00.000Z",
      "employeeid": 17,
      "role": "crm",
      "discount_total": "40.00",
      "surcharge_total": "0.00",
      "created_at": "2026-04-27T10:00:00.000Z",
      "updated_at": "2026-04-27T12:15:00.000Z"
    }
  ]
}
```

## 2. Billing Request Behavior

During billing submission, frontend does not call a separate validation endpoint. The limit check happens automatically inside billing submission.

Relevant existing billing endpoints:

- `POST /api/v1/billing/multi/submit`
- `POST /api/v1/billing/multi`
- `POST /api/v1/billing/multi/checkout` (used to recalculate and return totals before submitting)

Important behavior:

- Backend recalculates discount/surcharge server-side.
- Backend checks the current employee role.
- Backend compares the total discount and surcharge against:
  - per-transaction max
  - minimum transaction total
  - daily accumulated cap
- If rule is violated, billing is blocked.
- If no rule exists for the employee role, billing is blocked if discount/surcharge is present.

### 2.1 Showing Limits To Frontend (UI Prevention)

To prevent the user from entering a discount above what is allowed, call:

- `POST /api/v1/billing/multi/checkout`

Include `employeeid` in the payload so backend can return the user’s role limits and today’s remaining allowance.

Checkout response includes:

- `data.discountLimitInfo`

Example shape:

```json
{
  "role": "crm",
  "max_discount_per_transaction": "20.00",
  "min_transaction_total_for_discount": "200.00",
  "max_discount_per_day": "100.00",
  "usage_date": "2026-04-28",
  "daily_used_discount": 40,
  "daily_remaining_discount": 60,
  "rule_found": true,
  "allowed_role": true
}
```

Possible blocked response example:

```json
{
  "status": false,
  "message": "Discount exceeds your per-transaction limit. Please escalate to manager."
}
```

Another blocked response example:

```json
{
  "status": false,
  "message": "Daily discount limit reached for your level. Please escalate to manager."
}
```

Success response example:

```json
{
  "status": true,
  "message": "Billing submitted successfully",
  "billingid": 12345
}
```

Frontend handling recommendation:

- Show backend `message` directly to user.
- If blocked, stop billing workflow and prompt user to escalate to the next role.

## 3. Result Delivery Preference

This stores the delivery mode requested by the patient.

### 3.1 Set Patient Delivery Preference

- Method: `POST`
- URL: `/api/v1/result/delivery/preference?tenantId={tenantId}`

Payload:

```json
{
  "billingid": 55501,
  "requested_mode": "whatsapp",
  "requested_mode_detail": "Send to patient's main number",
  "employeeid": 12
}
```

Expected response:

```json
{
  "status": true
}
```

Allowed frontend values for `requested_mode` should come from UI options such as:

- `whatsapp`
- `email`
- `hard copy`
- `phone call`

### 3.2 Get Patient Delivery Preference

- Method: `GET`
- URL: `/api/v1/result/delivery/preference/{billingid}?tenantId={tenantId}`

Example response:

```json
{
  "status": true,
  "preference": {
    "id": 1,
    "billingid": 55501,
    "patientid": 101,
    "requested_mode": "whatsapp",
    "requested_mode_detail": "Send to patient's main number",
    "updated_by_employeeid": 12,
    "created_at": "2026-04-27T10:30:00.000Z",
    "updated_at": "2026-04-27T10:30:00.000Z"
  }
}
```

## 4. Result Delivery Log

This stores how the result was actually delivered to the patient.

### Reviewing previous deliveries and recording multiple methods

The single-test and bulk delivery dialogs read
`GET /api/v1/result/delivery/chain/{billingid}?tenantId={tenantId}` on opening, once
per distinct bill. Opening, selecting methods, and reviewing history never record
a delivery. The fullscreen dialog separates delivery choices and selected tests on the left
from an independently scrollable history column on the right. Choose a test using
"History for" or its "View history" button to see its vertical timeline, ordered
newest first, with successful previous methods,
dated events, the recorded operator and notes, and unsuccessful attempts. Imaging
report entry and completed imaging worklists use this same delivery workspace,
including multiple methods, existing history, and partial retries.

Imaging links to the result-ready SMS workspace with the ordered test, patient,
and bill identifiers. Sonographers may access result-ready SMS only; campaign,
provider, payment-notification, and SMS-settings permissions remain unchanged.

The workspace allows **one or several ready tests** to be selected from a bill
that can contain both imaging and laboratory orders. Unselected pending tests
do not block notification. Each selected test must have completed report entry,
finalized approval, and no pending revalidation or critical-release hold.
Custom-test flags are not approval status. A link to one test does not silently
select other ready tests when the linked test is not eligible.

The SMS always names the selected ready tests and states that the notice covers
only those tests. Staff may append an optional custom note (up to 1000 characters),
but cannot remove the generated scope. The complete preview is limited to 1600
characters and shows the saved recipient number and encoding-dependent segment
count. These selected-result notices use the existing `PATIENT_RESULT_READY`
activation switch and durable queue, rather than a whole-bill message template
that could incorrectly imply that every result is ready.

Selected-result API (authenticated `tenantId` and `billingid` query parameters):

- `GET /api/v1/sms/events/result-ready/workspace`: patient, saved SMS number,
  activation/contact blockers, all ordered tests, and specific readiness reasons.
  Optional `patientid` is checked against the bill.
- `POST /api/v1/sms/events/result-ready/preview`: body
  `{ "ascensionids": [7, 8], "message": "Please collect tomorrow." }`.
  No message is queued. The response includes the rendered message, recipient,
  selected identities, pending-test count, metrics, and `fingerprint`.
- `POST /api/v1/sms/events/result-ready/send`: the same selection and note plus
  the reviewed `fingerprint`. Send rechecks eligibility and critical holds under
  row locks and freezes the reviewed message into the queue. Changed selection,
  recipient, report revision, or message requires a fresh preview (409).
- `GET /api/v1/sms/events/result-ready/history`: all saved notification states
  with message text, job identity, timestamps, staff identity, and errors.
  `page` defaults to 1 and `count` to 10 (maximum 100).

Selections contain 1–100 distinct positive ordered-test IDs belonging to the
bill. The recipient and recording employee are server-derived. Reconfirming an
identical selection, message, recipient, and approved revisions reuses the
existing notification and returns its **current** status; it does not fabricate
a new queued attempt. A different subset or newly approved revision has a
different deduplication key.

The legacy whole-bill `GET /sms/events/trigger/send/result-ready` remains
whole-bill and requires all results to be ready; it is not the selected-result
workspace's send API. Existing automatic event behavior is unchanged.

A queued/submitted SMS is not proof of recipient delivery and does not mark the
report as delivered. History preserves queued, submitted, sent, delivered,
failed, unknown, and cancelled states rather than showing only successful sends.
Use message history and record result delivery separately.

A failed history check
is displayed explicitly; it is not treated as "never delivered".

Select one or more methods for all tests, then adjust individual tests as needed.
For example, choose both Printed copy and WhatsApp for one ordered test. Each
test/method pair is submitted to the existing record endpoint with its `ascensionid`.
The backend appends a separate `result_delivery_attempts` event for every method;
`result_delivery_log` remains the latest successful summary. Legacy summary logs
are also displayed when they predate attempt history. A failed retry does not erase
an earlier successful delivery.

Selecting a previously recorded method intentionally adds another delivery event.
This records a handoff that occurred; it does not automatically send results.
Partial submissions keep the dialog open, show per-method failures, refresh history,
and remove successfully saved pairs from the retry selection.

### 4.1 Record Delivery To Patient

- Method: `POST`
- URL: `/api/v1/result/delivery/record?tenantId={tenantId}`

Payload:

```json
{
  "billingid": 55501,
  "delivered_mode": "email",
  "delivered_by_employeeid": 21,
  "notes": "Delivered after phone confirmation"
}
```

Expected response:

```json
{
  "status": true,
  "id": 9
}
```

Notes:

- Backend resolves `patientid` from `billingid`.
- Backend also copies the patient requested mode into the log, if preference exists.

## 5. Result Handover Chain

This tracks handover between staff, such as scientist to front desk.

### 5.1 Record Internal Handover

- Method: `POST`
- URL: `/api/v1/result/delivery/handover?tenantId={tenantId}`

Payload:

```json
{
  "billingid": 55501,
  "from_employeeid": 31,
  "to_employeeid": 18,
  "status": "handover",
  "notes": "Validated and handed to front desk"
}
```

Expected response:

```json
{
  "status": true,
  "id": 14
}
```

### 5.2 Get Complete Delivery Chain

- Method: `GET`
- URL: `/api/v1/result/delivery/chain/{billingid}?tenantId={tenantId}`

Example response:

```json
{
  "status": true,
  "billingid": 55501,
  "handovers": [
    {
      "id": 14,
      "billingid": 55501,
      "patientid": 101,
      "from_employeeid": 31,
      "to_employeeid": 18,
      "status": "handover",
      "notes": "Validated and handed to front desk",
      "created_at": "2026-04-27T11:30:00.000Z",
      "from_username": "dr_ali",
      "from_role": "scientist",
      "to_username": "marusha",
      "to_role": "front desk"
    }
  ],
  "deliveries": [
    {
      "id": 9,
      "billingid": 55501,
      "patientid": 101,
      "requested_mode": "whatsapp",
      "delivered_mode": "email",
      "delivered_by_employeeid": 21,
      "delivered_at": "2026-04-27T13:20:00.000Z",
      "notes": "Delivered after phone confirmation",
      "delivered_by_username": "jane",
      "delivered_by_role": "front desk"
    }
  ]
}
```

## 6. Patient Personal-Information Audit History

This tracks historical changes on `new_patients` personal information updates.

### 6.1 Important Frontend Requirement

When frontend updates patient personal information using:

- `PUT /api/v1/register/personalinformation?tenantId={tenantId}&patientid={patientId}`

make sure `employeeid` is included inside `body.data`.

Payload example:

```json
{
  "data": {
    "designation": "Mr",
    "firstname": "Kwame",
    "lastname": "Mensah",
    "middlename": "Kojo",
    "age": "34",
    "ageType": "years",
    "gender": "male",
    "email": "kwame@example.com",
    "mobile": "0206363644",
    "mobileownership": "self",
    "days": 12,
    "months": 5,
    "years": 1990,
    "maritalstatus": "single",
    "occupation": "Teacher",
    "patientOrganization": "ABC Ltd",
    "whatAppcontact": "0206363644",
    "employeeid": 12
  }
}
```

If `employeeid` is omitted, the audit record will still be created, but `changed_by_employeeid` may be null.

### 6.2 Get Patient Audit History

- Method: `GET`
- URL: `/api/v1/register/personalinformation/audit?tenantId={tenantId}&patientid={patientId}`

Example response:

```json
{
  "status": true,
  "result": [
    {
      "id": 1,
      "auditid": "2d4df9de-59a2-11ef-bc7d-0242ac120002",
      "patientid": 101,
      "fullpatientid": "ABC-000101-XYZ",
      "firstname": "Kwame",
      "lastname": "Mensah",
      "middlename": "Kojo",
      "email": "kwame@example.com",
      "mobile_number": "0206363644",
      "section": "personal_information",
      "action_type": "UPDATE",
      "changed_by_employeeid": 12,
      "changed_fields": [
        {
          "field": "mobile_number",
          "oldValue": "0206360000",
          "newValue": "0206363644"
        },
        {
          "field": "email",
          "oldValue": "old@example.com",
          "newValue": "kwame@example.com"
        }
      ],
      "changed_at": "2026-04-27T14:10:00.000Z",
      "changed_by_username": "frontdesk1",
      "changed_by_role": "front desk"
    }
  ]
}
```

Frontend usage recommendation:

- Use `changed_fields` for compact audit timeline display.
- Show `changed_by_username`, `changed_by_role`, and `changed_at` prominently.
