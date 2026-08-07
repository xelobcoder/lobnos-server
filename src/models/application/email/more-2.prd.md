Absolutely. The important correction is that the AI must **not merely create placeholder templates**. It must build **production-quality, editable HTML templates for every event**, and every variable used in those templates must have a verified data source and fallback behavior.

Use this as the stronger instruction to append to, or replace the template/seed section of, your previous prompt:

```text
==================================================
CRITICAL REQUIREMENT — DEFAULT EMAIL TEMPLATES
==================================================

THIS REQUIREMENT IS MANDATORY.

Do NOT create lazy, minimal, plain, generic, or poorly styled HTML email bodies.

Every default email template shipped with PLS must be a COMPLETE, PROFESSIONAL, PRODUCTION-READY email.

The templates will be stored in the database and administrators will be able to edit them later. Therefore, the initial templates must be good enough to be used immediately in a real laboratory environment without requiring the administrator to redesign them.

The HTML templates must look like professionally designed transactional emails from a modern laboratory/healthcare organization.

Do NOT create templates that are simply:

<p>Hello {{PatientName}}</p>
<p>Your result is ready.</p>

That is NOT acceptable.

==================================================
EMAIL DESIGN STANDARD
==================================================

Every default HTML email must have:

- Professional header
- Prime Laboratory branding area
- Proper typography
- Consistent spacing
- Responsive layout
- Clear content hierarchy
- Proper information cards/sections
- Appropriate call-to-action where required
- Professional footer
- Branch information
- Contact information
- Appropriate disclaimer
- Mobile-friendly layout
- Inline CSS for email-client compatibility
- Table-based layout where appropriate for broad email-client compatibility
- Accessible text contrast
- Proper button styling
- Proper fallback for clients that do not support certain CSS
- No JavaScript
- No external scripts
- No unnecessary dependencies

The templates must render correctly in common email clients.

Avoid relying heavily on:

- CSS Grid
- Flexbox
- JavaScript
- External CSS files
- Unsupported CSS
- Background images that are required for the layout

Prefer email-compatible HTML and inline CSS.

==================================================
BRANDING
==================================================

Create a consistent PLS email design system.

At minimum define:

- Primary brand color
- Secondary brand color
- Background color
- Card background
- Text color
- Muted text color
- Success color
- Warning color
- Critical/error color
- Border color

Do not hardcode different visual styles randomly between templates.

All templates should look like they belong to the same Prime Laboratory email system.

The design should support future tenant branding.

For example:

{{LaboratoryName}}
{{BranchName}}
{{BranchAddress}}
{{BranchPhone}}
{{BranchEmail}}
{{LaboratoryLogo}}

The system must allow these values to be populated dynamically.

==================================================
IMPORTANT — EVERY VARIABLE MUST BE REAL
==================================================

THIS IS CRITICAL.

Do NOT put variables into templates simply because they sound useful.

Every variable used in a default template MUST have a verified source in the PLS database/application.

For example, if the template contains:

{{PatientName}}

then the implementation must demonstrate exactly where PatientName comes from.

If it contains:

{{DoctorName}}

the system must know how to retrieve the requesting doctor's name.

If it contains:

{{BranchPhone}}

the branch table/configuration must actually contain the required phone information.

If it contains:

{{ResultLink}}

the system must have a reliable mechanism for generating the link.

DO NOT create variables that cannot be populated.

==================================================
VARIABLE VALIDATION
==================================================

Implement strict template-variable validation.

When a template is created or updated:

1. Parse the template.
2. Extract every {{variable}}.
3. Determine which notification event owns the variable.
4. Verify that the variable exists in the event's variable registry.
5. Reject unknown variables.
6. Return a clear validation error.

Example:

Template contains:

{{PatientName}}
{{ResultName}}
{{SomeRandomVariable}}

If SomeRandomVariable is not registered:

REJECT TEMPLATE

with an error similar to:

"Unknown template variable: {{SomeRandomVariable}}.
This variable is not available for the RESULT_READY event."

Do not allow invalid variables to be silently saved.

==================================================
VARIABLE RESOLUTION MUST BE TESTED
==================================================

Every variable registered in the system must have an implementation that can populate it.

Do not stop at creating:

notification_template_variables

The variable registry must be connected to actual data providers.

For example:

RESULT_READY

Patient variables:
- PatientName
- PatientNumber
- PatientEmail
- PatientPhone

Result variables:
- ResultName
- ResultDate
- ResultStatus
- ResultLink

Doctor variables:
- DoctorName
- DoctorEmail

Branch variables:
- BranchName
- BranchPhone
- BranchEmail
- BranchAddress

Laboratory variables:
- LaboratoryName
- LaboratoryLogo

Each variable must have a known resolver.

==================================================
NO FUTURE VARIABLE ERRORS
==================================================

The system must be designed to prevent a situation where:

A template is saved today

↓

The system sends it six months later

↓

A variable no longer exists

↓

The email is sent with:

undefined

or

{{VariableName}}

or

null

or

[object Object]

This is NOT acceptable.

Before sending an email:

1. Load the template.
2. Parse variables.
3. Build the event context.
4. Resolve every variable.
5. Validate the complete context.
6. Detect missing required values.
7. Render the template.
8. Validate the rendered output.
9. Only then queue/send the email.

==================================================
MISSING DATA STRATEGY
==================================================

Not every piece of data will always exist.

For example:

- A patient may not have a doctor.
- A doctor may not have an email.
- A branch may not have a phone number.
- An organization may not exist.
- A result may not have a public portal link.
- A patient may not have an email address.

Do NOT allow these situations to crash the notification system.

Variables must have a defined behavior.

Classify variables as:

REQUIRED
OPTIONAL
SYSTEM

Example:

{{PatientName}}
REQUIRED

{{DoctorName}}
OPTIONAL

{{DoctorEmail}}
OPTIONAL

{{ResultLink}}
OPTIONAL depending on configuration.

If an OPTIONAL variable is unavailable, replace it with a safe empty value or configured fallback.

Example:

{{DoctorName}}

becomes:

""

rather than:

undefined

or:

null

For REQUIRED variables, the notification should not be sent if the data cannot be safely resolved.

Instead:

- Log the failure.
- Record the missing variable.
- Mark the notification appropriately.
- Make the error visible to administrators.

==================================================
VARIABLE METADATA
==================================================

Every variable should have metadata such as:

{
    variableName: "PatientName",
    displayName: "Patient Name",
    category: "Patient",
    dataType: "string",
    required: true,
    description: "Full name of the patient",
    exampleValue: "John Doe",
    resolver: "PatientContextProvider"
}

Do not store executable resolver functions in the database.

The database stores metadata only.

The application contains the resolver implementation.

==================================================
EVENT-SPECIFIC CONTEXT
==================================================

Every notification event must define the minimum context required to build the email.

For example:

RESULT_READY requires:

{
    patientId,
    resultId
}

SAMPLE_REJECTED requires:

{
    patientId,
    sampleId
}

PATIENT_CREATED requires:

{
    patientId
}

APPOINTMENT_CREATED requires:

{
    patientId,
    appointmentId
}

INVOICE_CREATED requires:

{
    patientId,
    invoiceId
}

The system must validate that the required context exists before attempting to build the notification.

==================================================
DEFAULT TEMPLATE QUALITY
==================================================

Create a professionally designed default HTML template for EVERY seeded event.

Do not reuse the same generic body for every event.

Each event must have content appropriate to its actual purpose.

For example:

PATIENT_CREATED

Should contain:

- Welcome message
- Patient identification information
- Registration information
- Branch information
- Next steps
- Contact information
- Appropriate privacy/security notice

--------------------------------------------------

SAMPLE_REJECTED

Should contain:

- Clear sample rejection notification
- Patient information
- Sample information
- Test/investigation
- Rejection reason
- Required action
- Recollection instructions where appropriate
- Branch contact information
- Professional warning/notice

--------------------------------------------------

SAMPLE_RECALL_REQUIRED

Should contain:

- Clear recall notification
- Patient information
- Sample number
- Investigation
- Reason for recall
- Required action
- Contact information

--------------------------------------------------

RESULT_READY

Should contain:

- Clear "Result Ready" heading
- Patient information
- Investigation/result information
- Date
- Requesting doctor where available
- Clear "View Result" button if ResultLink is available
- Alternative text/link if button cannot be used
- Contact information
- Privacy notice

--------------------------------------------------

CRITICAL_RESULT

Must have a visually appropriate urgent/critical design.

It should contain:

- Clear critical alert heading
- Patient information
- Investigation
- Appropriate critical result information
- Doctor/recipient information where appropriate
- Required action
- Laboratory contact information
- Appropriate disclaimer

Do not expose sensitive clinical information to recipients who should not receive it.

--------------------------------------------------

APPOINTMENT_CONFIRMED

Should contain:

- Appointment confirmation heading
- Patient information
- Date
- Time
- Branch
- Doctor/department where available
- Appointment reference
- Instructions
- Contact information

--------------------------------------------------

INVOICE_CREATED

Should contain:

- Invoice notification
- Patient/customer
- Invoice number
- Invoice date
- Amount
- Payment status
- Payment link where available
- Branch information
- Contact information

Use the actual fields available in PLS.

Do NOT invent database fields.

==================================================
TEMPLATE DATA CONTRACT
==================================================

Each notification event must have a defined data contract.

Example:

RESULT_READY

Event context:

{
    patientId: number,
    resultId: number
}

Resolver output:

{
    PatientName: string,
    PatientNumber: string,
    PatientEmail: string | null,

    ResultName: string,
    ResultDate: string,
    ResultStatus: string,
    ResultLink: string | null,

    DoctorName: string | null,
    DoctorEmail: string | null,

    BranchName: string,
    BranchPhone: string | null,
    BranchEmail: string | null,
    BranchAddress: string | null,

    LaboratoryName: string
}

The template may only use variables defined by this contract.

==================================================
AUTOMATED TEMPLATE VALIDATION
==================================================

Create a startup/administrative validation mechanism that checks all system default templates.

For every default template:

1. Extract variables.
2. Check variable registry.
3. Check resolver exists.
4. Build sample context.
5. Render HTML.
6. Render plain text.
7. Verify no unresolved variables remain.
8. Verify no "undefined" appears.
9. Verify no "null" appears where inappropriate.
10. Verify subject renders successfully.

If any template fails validation, report:

Event
Template
Variable
Reason

Example:

RESULT_READY
Default Result Ready Template
{{BranchPhone}}
Resolver returned no value

Do not allow silently broken templates.

==================================================
PREVIEW SYSTEM
==================================================

The template editor MUST have a Preview feature.

Preview should use realistic sample data.

Example:

Patient:
John Doe

Patient Number:
PL-000123

Result:
Full Blood Count

Doctor:
Dr. Michael Smith

Branch:
Prime Lab Main Branch

The preview must render the actual HTML template using the same renderer used in production.

Do not create a separate preview rendering system.

This ensures:

PREVIEW == ACTUAL EMAIL

==================================================
SEND TEST EMAIL
==================================================

Administrators should be able to send a test email from the template editor.

The test email must:

- Use the actual template
- Use the actual renderer
- Use realistic sample data
- Use the selected provider
- NOT trigger the actual business event
- NOT send to patients automatically

==================================================
DEFAULT TEMPLATE EDITING
==================================================

System templates must be protected.

The tenant administrator must NOT directly modify the global system template.

Instead:

SYSTEM DEFAULT
      ↓
Tenant selects "Customize"
      ↓
Create tenant-specific copy
      ↓
Tenant edits copy
      ↓
Tenant template becomes active

The tenant must also have:

RESET TO SYSTEM DEFAULT

This deletes/deactivates the tenant override and returns to the system template.

==================================================
TEMPLATE VERSIONING
==================================================

Every template modification must create a version.

Store:

- Version number
- Subject
- HTML body
- Plain body
- Changed by
- Changed date

Allow:

- View history
- Compare versions if practical
- Restore previous version

==================================================
HTML TEMPLATE REQUIREMENT
==================================================

Every seeded HTML template must be complete.

Use a consistent professional structure:

--------------------------------------------------
HEADER
--------------------------------------------------

Prime Laboratory branding

--------------------------------------------------
TITLE / ALERT AREA
--------------------------------------------------

Event-specific title

--------------------------------------------------
INTRODUCTION
--------------------------------------------------

Event-specific message

--------------------------------------------------
INFORMATION CARD
--------------------------------------------------

Relevant patient/order/sample/result/appointment
information

--------------------------------------------------
ACTION AREA
--------------------------------------------------

Button or required next action where applicable

--------------------------------------------------
ADDITIONAL INFORMATION
--------------------------------------------------

Instructions or explanation

--------------------------------------------------
CONTACT
--------------------------------------------------

Laboratory / branch contact information

--------------------------------------------------
FOOTER
--------------------------------------------------

Privacy notice
Automated email notice
Laboratory identity

--------------------------------------------------

Do not create empty placeholder sections.

Every section must have a real purpose.

==================================================
PLAIN TEXT REQUIREMENT
==================================================

Every HTML template MUST have a corresponding professional plain-text version.

The plain-text version must contain the same important information as the HTML version.

Do not simply strip HTML tags automatically and call that the final plain-text template.

Create intentional plain-text content.

The HTML and plain-text versions must use the same variable contract.

==================================================
EMAIL CLIENT COMPATIBILITY
==================================================

Templates should be tested/generated using conservative email HTML.

Use:

- Inline styles
- Table layouts where necessary
- Responsive media queries where appropriate
- Accessible buttons
- Proper alt text
- UTF-8
- Proper viewport metadata

Avoid:

- JavaScript
- Forms
- External scripts
- Complex unsupported CSS
- CSS frameworks
- External stylesheets

==================================================
TENANT BRANDING
==================================================

Do not hardcode "Prime Laboratory Services" permanently into every template if the system is multi-tenant.

Create branding variables/configuration such as:

{{LaboratoryName}}
{{LaboratoryLogo}}
{{BranchName}}
{{BranchLogo}}
{{BranchPhone}}
{{BranchEmail}}
{{BranchAddress}}
{{Website}}

The default system template should use these variables.

If tenant branding is not configured, provide safe system defaults.

Example:

LaboratoryName:
Prime Laboratory Services

This must be resolved through the tenant/branch configuration system.

==================================================
NO HALLUCINATED DATABASE FIELDS
==================================================

THIS IS MANDATORY.

Before creating any variable, inspect the existing PLS database schema and code.

Do not invent fields such as:

patient.portalUrl
branch.website
doctor.phone
result.downloadUrl

unless they actually exist or you implement the required functionality.

If a useful value does not currently exist:

1. Determine whether it should be derived.
2. If it can be derived, implement the resolver.
3. If it requires a new database field, explicitly identify the migration.
4. Do not silently invent it.

==================================================
FINAL QUALITY CHECK
==================================================

Before considering the implementation complete, perform a full audit of ALL default templates.

For EVERY event verify:

[ ] HTML template exists
[ ] Plain-text template exists
[ ] Professional styling exists
[ ] Subject exists
[ ] Variables are registered
[ ] Variables have resolvers
[ ] Variables have valid data types
[ ] Required/optional status is defined
[ ] Sample data exists
[ ] Preview works
[ ] Test email works
[ ] No undefined values
[ ] No null values rendered incorrectly
[ ] No unresolved {{variables}}
[ ] No fake database fields
[ ] No broken links
[ ] Tenant branding resolves
[ ] Branch information resolves
[ ] Recipient rules exist
[ ] Email enable/disable configuration exists
[ ] Template is editable by tenant
[ ] System template remains protected
[ ] Versioning works
[ ] Migration/seed works on a fresh database
[ ] Migration/seed is safe to run in the correct deployment process
[ ] Template renders correctly in HTML
[ ] Plain-text version contains all critical information

DO NOT declare the feature complete until every default event passes this validation.

The goal is not simply to create an email template database.

The goal is to create a reliable, production-grade notification/template platform where the default PLS templates are immediately usable, professionally designed, fully populated from real system data, editable by tenants, and protected against missing or invalid variables over the lifetime of the application.
```
