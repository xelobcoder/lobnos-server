# Prime Laboratory Software (PLS)

# Email Services Module

## Technical Architecture, Folder Structure & Flow Map

---

# Module Architecture

```
email/
│
├── controllers/
│   ├── EmailController.ts
│   ├── EmailTemplateController.ts
│   ├── EmailProviderController.ts
│   ├── EmailCampaignController.ts
│   └── EmailSettingsController.ts
│
├── services/
│   ├── EmailService.ts
│   ├── EmailQueueService.ts
│   ├── EmailTemplateService.ts
│   ├── EmailProviderService.ts
│   ├── EmailCampaignService.ts
│   ├── EmailSettingsService.ts
│   ├── EmailLogService.ts
│   ├── EmailAttachmentService.ts
│   ├── TemplateRenderer.ts
│   ├── SMTPService.ts
│   ├── SendGridService.ts
│   ├── SESService.ts
│   ├── MailgunService.ts
│   ├── ResendService.ts
│   └── ProviderFactory.ts
│
├── repositories/
│   ├── EmailRepository.ts
│   ├── EmailQueueRepository.ts
│   ├── EmailTemplateRepository.ts
│   ├── EmailProviderRepository.ts
│   ├── EmailSettingsRepository.ts
│   ├── EmailCampaignRepository.ts
│   ├── EmailLogRepository.ts
│   ├── EmailPreferenceRepository.ts
│   └── EmailAttachmentRepository.ts
│
├── entities/
│   ├── EmailEntity.ts
│   ├── EmailQueueEntity.ts
│   ├── EmailTemplateEntity.ts
│   ├── EmailProviderEntity.ts
│   ├── EmailSettingsEntity.ts
│   ├── EmailCampaignEntity.ts
│   ├── EmailLogEntity.ts
│   ├── EmailPreferenceEntity.ts
│   └── EmailAttachmentEntity.ts
│
├── dto/
│   ├── CreateEmailDto.ts
│   ├── SendEmailDto.ts
│   ├── ScheduleEmailDto.ts
│   ├── CreateTemplateDto.ts
│   ├── UpdateTemplateDto.ts
│   ├── CreateCampaignDto.ts
│   ├── UpdateCampaignDto.ts
│   ├── EmailProviderDto.ts
│   ├── EmailSettingsDto.ts
│   ├── RetryEmailDto.ts
│   └── EmailPreferenceDto.ts
│
├── migrations/
│   ├── 001_create_email_templates.sql
│   ├── 002_create_email_queue.sql
│   ├── 003_create_email_logs.sql
│   ├── 004_create_email_providers.sql
│   ├── 005_create_email_settings.sql
│   ├── 006_create_email_campaigns.sql
│   ├── 007_create_email_campaign_recipients.sql
│   ├── 008_create_email_preferences.sql
│   ├── 009_create_email_attachments.sql
│   └── 010_create_email_failures.sql
│
├── interfaces/
│   ├── IEmailProvider.ts
│   ├── ITemplateRenderer.ts
│   └── IEmailQueue.ts
│
├── workers/
│   ├── EmailQueueWorker.ts
│   └── RetryWorker.ts
│
├── helpers/
│   ├── EmailValidator.ts
│   ├── HtmlSanitizer.ts
│   ├── TemplateParser.ts
│   ├── AttachmentHelper.ts
│   └── ProviderSelector.ts
│
├── constants/
│   ├── EmailStatus.ts
│   ├── EmailProvider.ts
│   └── EmailVariables.ts
│
└── routes/
    └── EmailRoutes.ts
```

---

# Database Structure

```
email_templates

email_queue

email_logs

email_settings

email_providers

email_campaigns

campaign_recipients

email_preferences

email_attachments

email_failures
```

---

# Request Flow

```
Client

↓

Email Controller

↓

Email Service

↓

Template Service

↓

Provider Service

↓

Queue Service

↓

Repository

↓

Database
```

---

# Sending Flow

```
Patient Registered

↓

Registration Module

↓

Email Service

↓

Load Template

↓

Replace Variables

↓

Create Email Queue Record

↓

Queue Worker

↓

Provider Factory

↓

SMTP / SendGrid / SES / Mailgun / Resend

↓

Provider Response

↓

Update Email Log

↓

Finished
```

---

# Queue Processing

```
Pending

↓

Worker Picks Email

↓

Validate Email

↓

Generate HTML

↓

Attach Files

↓

Choose Provider

↓

Send

↓

Success?
```

If YES

```
Update Log

↓

Status = SENT

↓

Finished
```

If NO

```
Retry Count < Maximum ?

↓

YES

↓

Wait

↓

Retry

↓

Success?
```

If NO

```
Status = FAILED

↓

Store Failure Reason

↓

Notify Administrator (optional)
```

---

# Template Rendering

```
Template

↓

Find Variables

↓

Load Data

↓

Replace Variables

↓

Generate HTML

↓

Return HTML
```

Example

```
Hello {{PatientName}}

↓

Hello John Doe
```

---

# Provider Selection

```
Email Service

↓

Default Provider?

↓

YES

↓

SMTP
```

OR

```
Email Service

↓

Configured Provider?

↓

Amazon SES

↓

Use SES
```

OR

```
↓

SendGrid

↓

Use SendGrid
```

---

# Bulk Email Flow

```
Campaign

↓

Recipient List

↓

Split into Queue Items

↓

Queue

↓

Worker

↓

Provider

↓

Delivery

↓

Statistics
```

---

# Retry Flow

```
Failed

↓

Attempt 1

↓

Failed

↓

Wait

↓

Attempt 2

↓

Failed

↓

Wait

↓

Attempt 3

↓

Mark Failed

↓

Audit Log
```

---

# Logging Flow

```
Email Sent

↓

Create Log

↓

Store

Recipient

Subject

Template

Provider

Status

Response

Timestamp

User

↓

Reports
```

---

# High-Level Module Interaction

```
                 User
                  │
                  ▼
          Email Controller
                  │
                  ▼
            Email Service
                  │
     ┌────────────┼────────────┐
     ▼            ▼            ▼
Template     Queue Service   Provider
 Service                      Service
     │            │            │
     ▼            ▼            ▼
Templates     Email Queue   SMTP/API
     │            │            │
     └────────────┼────────────┘
                  ▼
          Email Repository
                  │
                  ▼
              MySQL Database
```

---

# Internal Services Communication

```
Email Service
      │
      ├──────────────► Template Service
      │
      ├──────────────► Queue Service
      │
      ├──────────────► Attachment Service
      │
      ├──────────────► Provider Service
      │
      ├──────────────► Log Service
      │
      └──────────────► Settings Service
```

---

# Future Notification Architecture

```
Notification Service
        │
 ┌──────┼───────────┐
 │      │           │
 ▼      ▼           ▼
Email   SMS     WhatsApp
 │      │           │
 ▼      ▼           ▼
Providers Providers Providers
```

This design keeps the Email module self-contained, aligns with your repository/service architecture, and prepares the system to evolve into a unified notification framework where Email, SMS, and WhatsApp share common queuing, templating, auditing, and provider-management infrastructure.
