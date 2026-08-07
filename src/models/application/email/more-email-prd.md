Yes. Since you want your coding AI to **implement this into the existing PLS codebase**, the prompt should tell it to first inspect the existing architecture and then build the notification system without introducing TypeORM or changing your existing patterns.

```text id="58304"
You are working on Prime Laboratory System (PLS), an existing multi-tenant Laboratory Information Management System.

Your task is to design and implement a production-ready Notification and Email Template System inside the existing PLS backend.

IMPORTANT EXISTING ARCHITECTURE
- Backend is TypeScript.
- We use raw SQL through Knex.js.
- We DO NOT use TypeORM.
- We DO NOT want ORM entities/classes.
- Database is MySQL.
- Database access is tenant-aware through:
  KnexConnection(tenantId)
- Follow the existing project architecture and coding conventions.
- Use interfaces for entities/database row types.
- Use DTO interfaces/types for request payloads.
- Use repositories for database access.
- Use services for business logic.
- Use controllers for HTTP endpoints.
- Use migrations for database changes.
- Do not introduce a new ORM.
- Do not rewrite existing modules unnecessarily.

==================================================
OBJECTIVE
==================================================

Build a centralized Notification System with Email as the first supported channel.

The system must support:

1. Notification events
2. Default system templates
3. Tenant-specific/custom templates
4. Template variables
5. Variable resolution from real PLS data
6. HTML email templates
7. Plain-text email templates
8. Email providers
9. Dynamic/on-the-fly emails
10. Email queue
11. Queue processing
12. Retry handling
13. Recipient resolution
14. Notification event configuration
15. Email logs/auditing
16. Template preview
17. Template versioning where appropriate
18. Future support for SMS, WhatsApp and in-app notifications

The architecture must not tightly couple Patient, Sample, Result, Billing, Appointment, etc. modules to the Email implementation.

==================================================
CORE ARCHITECTURE
==================================================

Business modules should generate notification events.

Example:

Patient module:
PATIENT_CREATED

Sample module:
SAMPLE_REJECTED

Result module:
RESULT_READY

The business module should NOT directly contain SMTP/email logic.

Instead:

Business Module
    ↓
Notification Event
    ↓
Notification Service
    ↓
Event Configuration
    ↓
Recipient Resolver
    ↓
Template Resolver
    ↓
Template Context Builder
    ↓
Template Renderer
    ↓
Notification Queue
    ↓
Email Processor
    ↓
Email Provider
    ↓
Email Log

==================================================
NOTIFICATION EVENTS
==================================================

Create a centralized notification event registry.

Initial events should include:

PATIENT_CREATED
PATIENT_UPDATED
PATIENT_PORTAL_CREATED

APPOINTMENT_CREATED
APPOINTMENT_CONFIRMED
APPOINTMENT_RESCHEDULED
APPOINTMENT_CANCELLED
APPOINTMENT_REMINDER
APPOINTMENT_MISSED

SAMPLE_COLLECTION_REQUESTED
SAMPLE_COLLECTED
SAMPLE_RECEIVED
SAMPLE_ACCEPTED
SAMPLE_REJECTED
SAMPLE_RECALL_REQUIRED
SAMPLE_RECOLLECTED
SAMPLE_PROCESSING
SAMPLE_PROCESSED

RESULT_PROCESSING
RESULT_PENDING_VERIFICATION
RESULT_VERIFIED
RESULT_READY
RESULT_RELEASED
RESULT_AMENDED
RESULT_CORRECTED
CRITICAL_RESULT

INVOICE_CREATED
INVOICE_SENT
PAYMENT_RECEIVED
PAYMENT_FAILED
PAYMENT_REMINDER
REFUND_PROCESSED

IMAGING_APPOINTMENT
IMAGING_COMPLETED
REPORT_READY
REPORT_VERIFIED
REPORT_RELEASED

USER_CREATED
USER_ACTIVATED
PASSWORD_RESET

Design this so additional events can easily be added later.

==================================================
DATABASE DESIGN
==================================================

Create migrations for the required notification tables.

At minimum create:

1. notification_events

Fields should include:

- id
- event_code
- event_name
- description
- module
- is_system
- is_active
- createdOn
- updatedOn

event_code must be unique.

Example:

RESULT_READY
SAMPLE_REJECTED
PATIENT_CREATED

--------------------------------------------------

2. notification_templates

This stores actual templates.

Fields:

- id
- tenantId
- eventId
- templateName
- subject
- htmlBody
- plainBody
- isDefault
- isActive
- createdBy
- updatedBy
- createdOn
- updatedOn

The system must support:

SYSTEM DEFAULT TEMPLATE

and

TENANT CUSTOM TEMPLATE

If a tenant has not customized an event, use the system default.

If a tenant has a custom active template, use the tenant template.

Do not modify the system default when a tenant edits a template.

--------------------------------------------------

3. notification_template_variables

Fields:

- id
- eventId
- variableName
- displayName
- dataType
- description
- exampleValue
- isRequired
- createdOn

Variables must be associated with specific events.

Example RESULT_READY variables:

{{PatientName}}
{{PatientNumber}}
{{InvoiceNumber}}
{{ResultName}}
{{ResultDate}}
{{DoctorName}}
{{DoctorEmail}}
{{BranchName}}
{{BranchPhone}}
{{LaboratoryName}}
{{ResultLink}}

--------------------------------------------------

4. notification_event_settings

Fields:

- id
- eventId
- emailEnabled
- smsEnabled
- whatsappEnabled
- inAppEnabled
- defaultTemplateId
- createdOn
- updatedOn

This prepares the architecture for future communication channels.

--------------------------------------------------

5. notification_event_recipients

Create a recipient configuration table.

Recipient types may include:

PATIENT
DOCTOR
ORGANIZATION
STAFF
LAB_MANAGER
BRANCH_MANAGER
ACCOUNTANT

The system must be able to determine recipients based on the event.

For example:

RESULT_READY:
- Patient
- Doctor

SAMPLE_REJECTED:
- Patient
- Doctor
- Organization
- Appropriate laboratory staff

CRITICAL_RESULT:
- Doctor
- Appropriate laboratory staff
- Patient only where configured/appropriate

Do not hardcode recipient logic into controllers.

--------------------------------------------------

6. notification_queue

This should support asynchronous processing.

Include:

- id
- tenantId
- eventId
- channel
- templateId
- priority
- status
- scheduledAt
- processingStartedAt
- processedAt
- attempts
- maxAttempts
- lastError
- createdBy
- createdOn
- updatedOn

Statuses should include:

PENDING
PROCESSING
SENT
FAILED
CANCELLED

--------------------------------------------------

7. email_queue / email recipient data

The implementation may either use a dedicated email queue or integrate email-specific data into notification_queue.

It must support:

TO
CC
BCC
REPLY_TO

Multiple recipients must be supported.

Do not limit each field to one email address.

--------------------------------------------------

8. email_logs

Store complete audit information.

Include appropriate fields for:

- tenantId
- notification/event
- recipient
- cc
- bcc
- subject
- provider
- status
- response
- message ID
- error
- sent time
- user
- createdOn

Do not store sensitive credentials.

--------------------------------------------------

9. email_queue_attempts

Store individual delivery attempts.

Each attempt should record:

- queueId
- attemptNumber
- provider
- status
- response
- error
- startedAt
- completedAt

--------------------------------------------------

10. notification_template_versions

Implement version history for templates if compatible with the existing architecture.

Store:

- templateId
- version
- subject
- htmlBody
- plainBody
- changedBy
- createdOn

A user should be able to see previous versions.

==================================================
DEFAULT SYSTEM TEMPLATES
==================================================

Seed default templates through migrations/seeds.

The system must ship with templates for the main PLS lifecycle events.

At minimum:

PATIENT_CREATED
PATIENT_UPDATED

APPOINTMENT_CREATED
APPOINTMENT_CONFIRMED
APPOINTMENT_RESCHEDULED
APPOINTMENT_CANCELLED
APPOINTMENT_REMINDER

SAMPLE_COLLECTED
SAMPLE_RECEIVED
SAMPLE_ACCEPTED
SAMPLE_REJECTED
SAMPLE_RECALL_REQUIRED
SAMPLE_RECOLLECTED
SAMPLE_PROCESSED

RESULT_READY
RESULT_VERIFIED
RESULT_RELEASED
RESULT_AMENDED
RESULT_CORRECTED
CRITICAL_RESULT

INVOICE_CREATED
INVOICE_SENT
PAYMENT_RECEIVED
PAYMENT_FAILED
PAYMENT_REMINDER
REFUND_PROCESSED

REPORT_READY
REPORT_VERIFIED
REPORT_RELEASED

USER_CREATED
USER_ACTIVATED
PASSWORD_RESET

Each default template must have:
- Subject
- HTML body
- Plain text body
- Appropriate variables
- Appropriate recipients
- Appropriate description

Do not send all events automatically.

Some events should be disabled by default and configurable by the tenant.

==================================================
TEMPLATE VARIABLE SYSTEM
==================================================

Build a proper variable system.

The frontend should be able to request:

GET /notification/events/:eventCode/variables

and receive all variables available to that event.

Example:

RESULT_READY:

Patient
- {{PatientName}}
- {{PatientNumber}}
- {{PatientEmail}}

Result
- {{ResultName}}
- {{ResultDate}}
- {{ResultLink}}

Doctor
- {{DoctorName}}
- {{DoctorEmail}}

Branch
- {{BranchName}}
- {{BranchPhone}}

The user should not need to manually type variables.

The frontend template editor can allow the user to click a variable and insert it into the HTML or subject.

==================================================
TEMPLATE CONTEXT SYSTEM
==================================================

Do not hardcode all variable resolution inside NotificationService.

Create a TemplateContextService.

Example:

templateContextService.build(
    tenantId,
    eventCode,
    context
)

Example:

templateContextService.build(
    tenantId,
    "RESULT_READY",
    {
        patientId,
        resultId
    }
)

Return:

{
    PatientName: "John Doe",
    PatientNumber: "PL-000123",
    InvoiceNumber: "INV-10023",
    ResultName: "Full Blood Count",
    ResultDate: "2026-08-07",
    DoctorName: "Dr. Smith",
    DoctorEmail: "doctor@example.com",
    BranchName: "Prime Lab Main Branch",
    BranchPhone: "0240000000",
    ResultLink: "..."
}

Create context providers where appropriate:

PatientContextProvider
SampleContextProvider
ResultContextProvider
InvoiceContextProvider
AppointmentContextProvider
DoctorContextProvider
BranchContextProvider
UserContextProvider

These should retrieve data using the existing repositories/services where possible.

Avoid duplicating database logic.

==================================================
TEMPLATE RENDERING
==================================================

Create a TemplateRenderer.

Input:

template subject
template htmlBody
template plainBody
context

Output:

rendered subject
rendered HTML
rendered plain text

Example:

Template:

Dear {{PatientName}},

Your {{ResultName}} result is ready.

Context:

{
    PatientName: "John Doe",
    ResultName: "Full Blood Count"
}

Output:

Dear John Doe,

Your Full Blood Count result is ready.

The renderer must:
- Replace variables safely.
- Detect missing variables.
- Detect invalid variables.
- Prevent accidental template execution/code injection.
- Support HTML and plain text.
- Handle null/undefined values appropriately.

==================================================
EMAIL PROVIDERS
==================================================

The existing provider functionality should be preserved.

Create a provider abstraction.

Example interface:

IEmailProvider

Methods should include something equivalent to:

sendEmail()

testConnection()

getProviderName()

Support:

SMTP
Gmail SMTP
Microsoft 365
Amazon SES
SendGrid
Mailgun
Resend

Do not hardcode provider-specific logic into EmailService.

Use a ProviderFactory or equivalent provider resolver.

==================================================
EMAIL QUEUE
==================================================

Email sending must remain asynchronous.

Business operation:

RESULT_READY

should NOT wait for SMTP/API delivery.

Instead:

RESULT_READY
    ↓
Create notification
    ↓
Resolve recipients
    ↓
Resolve template
    ↓
Build context
    ↓
Render
    ↓
Insert queue
    ↓
Return success

Worker:

Queue Worker
    ↓
Pick PENDING
    ↓
PROCESSING
    ↓
Send using provider
    ↓
Success → SENT
    ↓
Failure → retry
    ↓
Maximum attempts → FAILED

Respect configurable queue limits.

==================================================
RETRY SYSTEM
==================================================

Support configurable:

maxAttempts
retryDelay
backoff strategy

Prefer exponential backoff.

Example:

Attempt 1
↓
2 minutes

Attempt 2
↓
5 minutes

Attempt 3
↓
15 minutes

Then FAILED.

Do not retry permanent errors unnecessarily.

==================================================
RECIPIENT RESOLUTION
==================================================

Create a RecipientResolver.

Example:

RESULT_READY

returns:

[
    {
        type: "PATIENT",
        email: "patient@example.com"
    },
    {
        type: "DOCTOR",
        email: "doctor@example.com"
    }
]

The system must ignore recipients who do not have an email address.

Do not fail the entire notification because one optional recipient has no email.

==================================================
EMAIL PREFERENCES
==================================================

Allow notification preferences.

A patient may have:

Email Results: ON
Email Appointments: ON
Email Promotions: OFF

However, mandatory/system-critical notifications should be treated separately from marketing preferences.

==================================================
API STRUCTURE
==================================================

Create appropriate controllers/routes for:

Events:

GET /notifications/events
GET /notifications/events/:eventCode
GET /notifications/events/:eventCode/variables

Templates:

GET /notifications/templates
GET /notifications/templates/:id
POST /notifications/templates
PUT /notifications/templates/:id
DELETE /notifications/templates/:id

Preview:

POST /notifications/templates/:id/preview

Providers:

GET /notifications/providers
POST /notifications/providers
PUT /notifications/providers/:id
DELETE /notifications/providers/:id
POST /notifications/providers/:id/test

Queue:

GET /notifications/queue
GET /notifications/queue/:id
POST /notifications/queue/:id/retry
POST /notifications/queue/:id/cancel

Logs:

GET /notifications/logs
GET /notifications/logs/:id

Settings:

GET /notifications/settings
PUT /notifications/settings

==================================================
FOLDER STRUCTURE
==================================================

Follow this structure, adapting it to the existing PLS project structure:

notifications/

├── controllers/
│   ├── NotificationController.ts
│   ├── NotificationTemplateController.ts
│   ├── NotificationEventController.ts
│   ├── EmailProviderController.ts
│   └── NotificationLogController.ts
│
├── services/
│   ├── NotificationService.ts
│   ├── NotificationEventService.ts
│   ├── NotificationTemplateService.ts
│   ├── NotificationQueueService.ts
│   ├── RecipientResolver.ts
│   ├── TemplateContextService.ts
│   ├── TemplateRenderer.ts
│   ├── EmailService.ts
│   ├── EmailProviderService.ts
│   └── NotificationLogService.ts
│
├── repositories/
│   ├── NotificationRepository.ts
│   ├── NotificationEventRepository.ts
│   ├── NotificationTemplateRepository.ts
│   ├── NotificationVariableRepository.ts
│   ├── NotificationQueueRepository.ts
│   ├── NotificationLogRepository.ts
│   ├── EmailProviderRepository.ts
│   └── NotificationSettingsRepository.ts
│
├── entities/
│   ├── NotificationEntity.ts
│   ├── NotificationEventEntity.ts
│   ├── NotificationTemplateEntity.ts
│   ├── NotificationVariableEntity.ts
│   ├── NotificationQueueEntity.ts
│   ├── NotificationLogEntity.ts
│   └── EmailProviderEntity.ts
│
├── dto/
│   ├── CreateNotificationDto.ts
│   ├── SendEmailDto.ts
│   ├── CreateTemplateDto.ts
│   ├── UpdateTemplateDto.ts
│   ├── PreviewTemplateDto.ts
│   ├── CreateProviderDto.ts
│   ├── UpdateProviderDto.ts
│   └── NotificationSettingsDto.ts
│
├── providers/
│   ├── IEmailProvider.ts
│   ├── SMTPProvider.ts
│   ├── GmailProvider.ts
│   ├── SESProvider.ts
│   ├── SendGridProvider.ts
│   ├── MailgunProvider.ts
│   ├── ResendProvider.ts
│   └── ProviderFactory.ts
│
├── context/
│   ├── PatientContextProvider.ts
│   ├── SampleContextProvider.ts
│   ├── ResultContextProvider.ts
│   ├── InvoiceContextProvider.ts
│   ├── AppointmentContextProvider.ts
│   ├── DoctorContextProvider.ts
│   └── BranchContextProvider.ts
│
├── workers/
│   ├── NotificationQueueWorker.ts
│   └── EmailQueueWorker.ts
│
├── migrations/
│
├── seeds/
│
├── enums/
│   ├── NotificationStatus.ts
│   ├── NotificationChannel.ts
│   ├── NotificationEvent.ts
│   └── RecipientType.ts
│
├── validators/
│
└── routes/
    └── NotificationRoutes.ts

Use interfaces instead of ORM classes.

==================================================
DEFAULT TEMPLATE ADMIN UI
==================================================

The template management UI should allow administrators to:

1. View all notification events.
2. See whether email is enabled.
3. See the default template.
4. Create/edit tenant-specific templates.
5. Reset a tenant template to the system default.
6. Edit subject.
7. Edit HTML body.
8. Edit plain text body.
9. Insert available variables.
10. Preview the template.
11. Send a test email.
12. Activate/deactivate the template.
13. View template version history.
14. Restore a previous version.

Example UI:

Event:
RESULT_READY

Email:
Enabled ✓

Template:
Result Ready - Default

Subject:
Prime Lab - Your Result is Ready | {{InvoiceNumber}}

Available Variables:

Patient
{{PatientName}}
{{PatientNumber}}

Result
{{ResultName}}
{{ResultDate}}
{{ResultLink}}

Doctor
{{DoctorName}}
{{DoctorEmail}}

Branch
{{BranchName}}
{{BranchPhone}}

[Preview]
[Send Test]
[Save]
[Reset to Default]

==================================================
SECURITY REQUIREMENTS
==================================================

- Encrypt SMTP/provider credentials at rest.
- Never return passwords/API keys through GET endpoints.
- Do not log provider passwords.
- Validate email addresses.
- Sanitize HTML where appropriate.
- Prevent arbitrary script execution in templates.
- Validate attachment types and sizes.
- Implement permission checks.
- Audit template changes.
- Audit provider configuration changes.
- Audit email sending.
- Respect tenant isolation.
- Never allow one tenant to access another tenant's templates, logs, providers, queue items or settings.

==================================================
IMPORTANT LIMS CONSIDERATIONS
==================================================

For laboratory results, the system must distinguish between:

RESULT_READY
RESULT_VERIFIED
RESULT_RELEASED
CRITICAL_RESULT
RESULT_AMENDED
RESULT_CORRECTED

Do not automatically treat RESULT_READY as equivalent to RESULT_RELEASED.

The event should only be triggered at the correct business stage.

For SAMPLE_REJECTED, support variables such as:

{{PatientName}}
{{PatientNumber}}
{{SampleNumber}}
{{SampleType}}
{{TestName}}
{{RejectionReason}}
{{CollectionDate}}
{{RejectionDate}}
{{DoctorName}}
{{BranchName}}
{{BranchPhone}}

For SAMPLE_RECALL_REQUIRED:

{{PatientName}}
{{PatientNumber}}
{{SampleNumber}}
{{SampleType}}
{{TestName}}
{{RecallReason}}
{{RequiredAction}}
{{BranchName}}

For RESULT_READY:

{{PatientName}}
{{PatientNumber}}
{{InvoiceNumber}}
{{ResultName}}
{{ResultDate}}
{{DoctorName}}
{{DoctorEmail}}
{{BranchName}}
{{BranchPhone}}
{{ResultLink}}

For CRITICAL_RESULT, carefully control which recipients receive detailed result information.

==================================================
MIGRATION/SEED REQUIREMENTS
==================================================

Create migrations in the existing PLS migration format.

Create seed data for:

1. Notification events
2. Notification variables
3. Notification event settings
4. Default templates
5. Recipient rules

Default system templates must be clearly identified as system templates.

They must not be deleted or modified by tenant users.

Tenant customization must create/update a tenant-specific template.

==================================================
IMPLEMENTATION APPROACH
==================================================

Before writing code:

1. Inspect the existing PLS codebase.
2. Identify:
   - Existing repository patterns
   - Existing service patterns
   - Existing controller patterns
   - Existing DTO conventions
   - Existing entity/interface conventions
   - Existing migration conventions
   - Existing KnexConnection implementation
   - Existing email provider implementation
   - Existing queue implementation
3. Reuse existing components where appropriate.
4. Do not duplicate functionality that already exists.
5. Do not introduce TypeORM.
6. Do not introduce another ORM.
7. Do not rewrite working email/provider/queue code unless required for integration.

Then implement incrementally.

==================================================
DELIVERABLES
==================================================

Produce:

1. Complete database migrations.
2. Seed migrations/data for default events.
3. Seed default templates.
4. Seed template variables.
5. Entity interfaces.
6. DTOs.
7. Repositories.
8. Services.
9. Controllers.
10. Routes.
11. Template renderer.
12. Template context system.
13. Recipient resolver.
14. Provider abstraction.
15. Queue integration.
16. Retry handling.
17. Notification logs.
18. Template preview endpoint.
19. Test email endpoint.
20. Permission definitions.
21. Unit tests for template rendering.
22. Unit tests for variable validation.
23. Integration tests for queue processing.
24. Documentation showing how another PLS module triggers a notification.

==================================================
EXAMPLE USAGE
==================================================

After implementation, the Result module should be able to do something similar to:

await notificationService.trigger(
    tenantId,
    "RESULT_READY",
    {
        patientId,
        resultId,
        invoiceId
    },
    createdBy
);

The Result module should NOT need to know:

- SMTP host
- SMTP port
- Provider
- Template HTML
- Template variables
- Email queue implementation
- Retry logic
- Email logging
- Provider API

The Notification System handles all of that.

==================================================
FINAL ARCHITECTURAL PRINCIPLE
==================================================

Keep these concepts separate:

EVENT
    ↓
RECIPIENTS
    ↓
CHANNEL
    ↓
TEMPLATE
    ↓
VARIABLES
    ↓
CONTEXT
    ↓
RENDERING
    ↓
QUEUE
    ↓
PROVIDER
    ↓
DELIVERY LOG

The system should be designed so that adding SMS or WhatsApp later does not require rewriting Patient, Sample, Result, Billing or Appointment modules.

Start by inspecting the existing codebase and report the existing relevant architecture before making changes. Then implement the notification system using the existing PLS conventions.
```
