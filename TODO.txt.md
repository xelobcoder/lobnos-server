TO IMPLEMENT , ADD A COLUM WHEREE THE USER  CAN ACTIVATE AN EVENT OR DISABLE IT , 

2. WE WANT TO HAVE A FIND THE INJECTIONS FOE EVENT AND MAKE IT IS IMPLEMENTED ACROSS THE CODE WHERE THE EVNTS HAVE OCCURED
3. WE NEED TO HAVE UPDATE APLPLICATION SETTINGS , ADDA A COLUMN IS EMAILMODULEATIVATED , IF YES CLIENT CAN USE EMAIL SERVICES AND IF 0 , USER CAN NOT SO THAT MUST BE IMPLEMENT IN AS A MIDLWARE ACCROSS THE MAIN ROUTER OF THE EMAIL SERVICES 
4. WE WAN TO IMPEMENT AN EXTENSIVE ANALYTICS FOR THE EMAIL SERVICES AS WELL
5. WE MUST IMPELMENT A CRON JOB THAT WORK IN A CHILD PROCESS SO THAT WE DONT HOLD THE MAIN RPOCESS TO TO BE PROCESSSING CHILD SERVICE 
6. TO MAKE THE CONTEXT BETTER , WE MUST SPLIT IT INTO PatientContextProvider SampleContextProvider ResultContextProvider InvoiceContextProvider AppointmentContextProvider PayrollContextProvider PurchaseOrderContextProvider SupplierContextProvider InventoryContextProvider DoctorContextProvider



Yes. These are important additions. I would update the PRD so the implementation is not just a notification module, but a **fully integrated, independently processed, configurable, and observable notification subsystem**.

## PRD Addendum — Implementation & Architecture Requirements

### 1. Event activation/deactivation

Add an activation column to the event definition table.

Recommended:

```sql
ALTER TABLE notification_events
ADD COLUMN isActive TINYINT(1) NOT NULL DEFAULT 1
AFTER eventCode;
```

The event configuration should therefore contain at least:

```text
id
eventCode
eventName
module
description
isActive
createdBy
updatedBy
createdOn
updatedOn
```

### Behavior

If:

```text
isActive = 1
```

the event can generate notifications.

If:

```text
isActive = 0
```

the event must be ignored by the notification engine.

For example:

```text
RESULT_READY        ACTIVE
SAMPLE_REJECTED     ACTIVE
PAYROLL_PROCESSED   ACTIVE
STOCK_LOW           DISABLED
```

The event activation status should be checked **server-side**, not only hidden/disabled in the frontend.

Administrators should be able to activate/deactivate an event from the Notification Event Management interface.

---

# 2. Find and implement all event injections

This should be treated as a major implementation task.

Do **not** simply create the event registry and assume the events are being triggered.

The development AI must inspect the entire existing PLS codebase and identify where each business event actually occurs.

### Required process

For every event:

```text
EVENT
 ↓
Find business operation
 ↓
Find service/controller/repository responsible
 ↓
Identify exact point where operation succeeds
 ↓
Inject notification event
 ↓
Pass minimum event context
 ↓
Verify event is actually triggered
```

For example:

### Result Ready

Find the code where a result changes to its final/ready state:

```text
ResultService
    ↓
verifyResult()
    ↓
result status = READY
    ↓
notificationService.trigger()
```

The injection should happen **after the database transaction/business operation succeeds**, not before.

Example:

```typescript
await resultRepository.markAsReady(resultId);

await notificationService.trigger(
    tenantId,
    "RESULT_READY",
    {
        resultId,
        patientId,
    },
    userId
);
```

Do not inject events into arbitrary controllers if the actual business operation occurs in a service.

---

# 3. Mandatory event-injection audit

Create an implementation matrix.

| Event                   | Business location    | Injection found | Implemented | Tested |
| ----------------------- | -------------------- | --------------: | ----------: | -----: |
| PATIENT_CREATED         | PatientService       |               ✓ |           ✓ |      ✓ |
| SAMPLE_REJECTED         | SampleService        |               ✓ |           ✓ |      ✓ |
| RESULT_READY            | ResultService        |               ✓ |           ✓ |      ✓ |
| PAYMENT_RECEIVED        | PaymentService       |               ✓ |           ✓ |      ✓ |
| PAYROLL_PROCESSED       | PayrollService       |               ✓ |           ✓ |      ✓ |
| PURCHASE_ORDER_APPROVED | PurchaseOrderService |               ✓ |           ✓ |      ✓ |
| STOCK_LOW               | InventoryService     |               ✓ |           ✓ |      ✓ |

The AI must search the existing codebase for the actual implementation points.

**Do not invent locations.**

For every event, document:

```text
Event Code
Business Module
Source File
Source Method
Trigger Condition
Event Context
Injection Point
```

This prevents the common situation where an event exists in the database but is never actually fired.

---

# 4. Application-level email module activation

Add the following column to the application settings/configuration table:

```sql
ALTER TABLE application_settings
ADD COLUMN emailModuleActivated TINYINT(1) NOT NULL DEFAULT 0;
```

Meaning:

```text
1 = Email module enabled
0 = Email module disabled
```

This is a **tenant/application-level feature switch**.

---

# 5. Email module middleware

The email module activation must be enforced centrally.

Do not implement:

```typescript
if (emailModuleActivated) {
   ...
}
```

individually inside every email controller.

Instead:

```text
Request
   ↓
Main Email Router
   ↓
Email Module Middleware
   ↓
Check emailModuleActivated
   ↓
 ┌───────────────┐
 │               │
 1               0
 │               │
 ▼               ▼
Continue       Reject
```

Example:

```typescript
router.use(
    emailModuleMiddleware
);
```

Then:

```typescript
async function emailModuleMiddleware(
    req,
    res,
    next
) {
    const settings = await getApplicationSettings(
        req.tenantId
    );

    if (!settings.emailModuleActivated) {
        return res.status(403).json({
            message: "Email module is not activated."
        });
    }

    next();
}
```

### Important

This must protect **all email-module routes**, including:

```text
/templates
/providers
/queue
/logs
/settings
/test-email
```

However, the administrator endpoint used to activate/deactivate the email module itself must not be blocked by this middleware.

---

# 6. Email module activation must also apply internally

The middleware protects HTTP requests, but it is **not enough**.

Business events can trigger notifications internally without passing through the email router.

Therefore:

```text
Business Event
      ↓
NotificationService
      ↓
Email channel
      ↓
Check emailModuleActivated
      ↓
Queue / Don't queue
```

If the email module is disabled:

```text
Email notification → NOT QUEUED
```

The business operation itself must still succeed.

For example:

```text
Patient Created
      ↓
Email disabled
      ↓
Patient creation succeeds
      ↓
Email is skipped
```

The email configuration must never make patient registration, result verification, payment processing, etc. fail.

---

# 7. Event activation vs Email module activation

These are two different controls.

### Application-level

```text
emailModuleActivated
```

Controls the entire email subsystem.

### Event-level

```text
notification_events.isActive
```

Controls an individual business event.

Therefore:

```text
Email Module = OFF
    ↓
NO email events can be processed
```

While:

```text
Email Module = ON
    ↓
RESULT_READY = ON
SAMPLE_REJECTED = ON
STOCK_LOW = OFF
```

means only the enabled events can generate notifications.

---

# 8. Extensive Email Analytics

The email module should have a dedicated analytics subsystem.

At minimum track:

### Volume

```text
Total notifications
Total emails
Emails today
Emails this week
Emails this month
```

### Delivery

```text
Sent
Delivered
Failed
Bounced
Queued
Processing
Cancelled
```

### Event analytics

```text
RESULT_READY
SAMPLE_REJECTED
PAYMENT_RECEIVED
PAYROLL_PROCESSED
STOCK_LOW
...
```

Show:

```text
Event
Triggered
Queued
Sent
Failed
Success Rate
```

### Provider analytics

```text
Provider
Messages
Successful
Failed
Average Processing Time
Failure Rate
```

### Queue analytics

```text
Queue Size
Pending
Processing
Failed
Average Wait Time
Average Processing Time
Retry Count
```

### Recipient analytics

Where appropriate and privacy-compliant:

```text
Patient
Doctor
Employee
Supplier
Staff
```

### Time analytics

Provide:

```text
Hourly
Daily
Weekly
Monthly
```

analysis.

---

# 9. Recommended analytics tables

Do not calculate everything from raw queue data forever.

Maintain operational logs and derive analytics efficiently.

Potentially:

```text
notification_logs
notification_queue
notification_queue_attempts
notification_analytics_daily
```

Example:

```text
notification_analytics_daily

id
tenantId
date
eventCode
channel
providerId
totalTriggered
totalQueued
totalSent
totalFailed
totalBounced
totalCancelled
totalRetries
averageProcessingTime
createdOn
```

This allows dashboards to remain fast even with millions of historical notification records.

---

# 10. Analytics dashboard

Create an Email Analytics dashboard containing:

### Overview cards

```text
Emails Sent
Emails Failed
Delivery Rate
Failure Rate
Queue Pending
Average Processing Time
```

### Event chart

```text
RESULT_READY       12,430
PAYMENT_RECEIVED    8,221
SAMPLE_REJECTED     1,024
PAYROLL_PROCESSED     350
```

### Delivery chart

```text
Sent
Failed
Bounced
Pending
```

### Provider performance

```text
Provider A
Success: 98.7%
Failure: 1.3%

Provider B
Success: 96.2%
Failure: 3.8%
```

### Failure analysis

Show:

```text
SMTP Authentication
Invalid Recipient
Connection Timeout
Provider Rate Limit
Mailbox Rejected
Template Error
Missing Required Variable
```

This will make troubleshooting considerably easier.

---

# 11. Child-process email worker

This is an important architectural change.

The main PLS API process must **not continuously process the email queue**.

Use a separate child process/worker.

Recommended architecture:

```text
                    PLS API
                      │
       ┌──────────────┴──────────────┐
       │                             │
       ▼                             ▼
Business API                  Notification API
       │                             │
       └──────────────┬──────────────┘
                      ▼
                Notification Queue
                      │
                      ▼
              Email Worker Process
                      │
                      ▼
                  Provider
                      │
                      ▼
                  SMTP/API
```

---

# 12. Cron/worker architecture

I would **not use a traditional cron job that performs the entire email processing operation**.

Instead:

```text
Cron / Scheduler
       ↓
Starts or signals worker
       ↓
Email Worker
       ↓
Claims queue jobs
       ↓
Processes jobs
       ↓
Updates status
```

The worker should run independently from the HTTP server.

For example:

```text
pm2
├── pls-api
└── pls-email-worker
```

This is preferable to literally spawning a new child process for every email.

---

# 13. Email worker responsibilities

The worker should:

1. Find pending jobs.
2. Claim jobs safely.
3. Mark them `PROCESSING`.
4. Build context.
5. Resolve variables.
6. Render template.
7. Select provider.
8. Send email.
9. Record provider response.
10. Mark successful jobs `SENT`.
11. Retry temporary failures.
12. Mark permanent failures `FAILED`.
13. Record analytics.
14. Continue processing.

---

# 14. Prevent duplicate processing

Multiple workers must not process the same queue record.

Use an atomic claim mechanism.

Conceptually:

```text
PENDING
   ↓
atomic claim
   ↓
PROCESSING
   ↓
worker owns job
```

Use:

* Transaction
* Row locking where appropriate
* Worker ID
* Processing timestamp
* Lock timeout

If a worker crashes:

```text
PROCESSING
     ↓
timeout detected
     ↓
return to PENDING
```

This provides recovery without manual intervention.

---

# 15. Worker configuration

Example configuration:

```text
EMAIL_WORKER_CONCURRENCY=5
EMAIL_QUEUE_BATCH_SIZE=50
EMAIL_MAX_RETRIES=5
EMAIL_RETRY_DELAY=120
EMAIL_PROCESS_INTERVAL=5000
EMAIL_PROCESSING_TIMEOUT=300000
```

These should ultimately be configurable rather than hardcoded.

---

# 16. Context Provider Architecture

Your point #6 is particularly important.

Do **not** create one giant:

```text
EmailContextProvider
```

Instead split context resolution into specialized providers:

```text
context/
│
├── PatientContextProvider.ts
├── SampleContextProvider.ts
├── ResultContextProvider.ts
├── InvoiceContextProvider.ts
├── AppointmentContextProvider.ts
├── PayrollContextProvider.ts
├── PurchaseOrderContextProvider.ts
├── SupplierContextProvider.ts
├── InventoryContextProvider.ts
└── DoctorContextProvider.ts
```

Also consider:

```text
BranchContextProvider.ts
LaboratoryContextProvider.ts
UserContextProvider.ts
```

---

# 17. Context provider contract

Create a common interface:

```typescript
interface NotificationContextProvider {
    getContext(
        tenantId: number,
        context: NotificationEventContext
    ): Promise<Record<string, unknown>>;
}
```

Example:

```typescript
class PatientContextProvider
    implements NotificationContextProvider
{
    async getContext(
        tenantId: number,
        context: NotificationEventContext
    ) {
        // Resolve patient information
    }
}
```

---

# 18. Context composition

The event should declare which providers it needs.

Example:

```text
RESULT_READY

PatientContextProvider
ResultContextProvider
DoctorContextProvider
BranchContextProvider
LaboratoryContextProvider
```

Then:

```text
RESULT_READY
      ↓
PatientContextProvider
      +
ResultContextProvider
      +
DoctorContextProvider
      +
BranchContextProvider
      +
LaboratoryContextProvider
      ↓
Merged Context
      ↓
Variable Resolver
```

This prevents unrelated queries from being executed.

---

# 19. Context example

For:

```text
RESULT_READY
```

the context builder might produce:

```typescript
{
    PatientName: "John Doe",
    PatientNumber: "PL-000123",

    ResultName: "Full Blood Count",
    ResultDate: "2026-08-07",
    ResultStatus: "Ready",
    ResultLink: "...",

    DoctorName: "Dr. Smith",
    DoctorEmail: "...",

    BranchName: "Prime Lab Main Branch",
    BranchPhone: "...",
    BranchEmail: "...",

    LaboratoryName: "Prime Laboratory Services"
}
```

The template renderer receives this final context.

---

# 20. Event-to-provider mapping

Create a registry rather than hardcoding provider calls throughout the application.

Example:

```typescript
const eventContextProviders = {
    RESULT_READY: [
        "patient",
        "result",
        "doctor",
        "branch",
        "laboratory"
    ],

    SAMPLE_REJECTED: [
        "patient",
        "sample",
        "doctor",
        "branch"
    ],

    PAYMENT_RECEIVED: [
        "patient",
        "invoice",
        "branch"
    ],

    PAYROLL_PROCESSED: [
        "payroll",
        "employee",
        "branch"
    ],

    PURCHASE_ORDER_APPROVED: [
        "purchaseOrder",
        "supplier",
        "branch"
    ],

    STOCK_LOW: [
        "inventory",
        "branch"
    ]
};
```

---

# 21. Final architecture

The complete system should now look like:

```text
                     PLS APPLICATION
                           │
                           ▼
                    BUSINESS EVENT
                           │
                           ▼
                NotificationService
                           │
              ┌────────────┴────────────┐
              │                         │
       Event Active?             Email Module Active?
              │                         │
              └────────────┬────────────┘
                           │
                           ▼
                  Recipient Resolver
                           │
                           ▼
                  Context Orchestrator
                           │
        ┌──────────┬───────┼────────┬─────────┐
        ▼          ▼       ▼        ▼         ▼
     Patient     Result   Sample   Invoice   Doctor
     Context     Context  Context  Context   Context
        │          │       │        │         │
        └──────────┴───────┴────────┴─────────┘
                           │
                           ▼
                    Merged Context
                           │
                           ▼
                  Variable Validator
                           │
                           ▼
                   Template Renderer
                           │
                  ┌────────┴────────┐
                  ▼                 ▼
                HTML             Plain Text
                  │                 │
                  └────────┬────────┘
                           ▼
                     Notification Queue
                           │
                           ▼
                 ┌─────────────────────┐
                 │  EMAIL WORKER       │
                 │  CHILD PROCESS      │
                 └──────────┬──────────┘
                            │
                            ▼
                       Email Provider
                            │
                            ▼
                         Internet
                            │
                            ▼
                        Recipient
                            │
                            ▼
                    Delivery / Log
                            │
                            ▼
                       Analytics
```

## 22. Updated implementation order

I would implement this in this order rather than building everything simultaneously:

```text
PHASE 1
Event registry
Event activation
Application emailModuleActivated
Middleware
        ↓
PHASE 2
Context provider architecture
        ↓
PHASE 3
Template/variable validation
        ↓
PHASE 4
Search existing codebase
Find every business event
Inject events
        ↓
PHASE 5
Queue + retry system
        ↓
PHASE 6
Independent email worker
        ↓
PHASE 7
Provider management
        ↓
PHASE 8
Professional default templates
        ↓
PHASE 9
Analytics
        ↓
PHASE 10
Testing + event coverage audit
```

The **event-injection audit in Phase 4 is essential**. It should produce a concrete report showing every event, where it occurs in the existing PLS code, where the notification trigger was inserted, and whether that trigger has been tested. This is what ensures the notification system actually becomes part of PLS's business workflows rather than remaining a standalone email module.
