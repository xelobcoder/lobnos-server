---
name: enterprise-manual-architect
description: Produce accurate, evidence-based user manuals, SOPs, admin guides and troubleshooting guides for a real software application by inspecting its actual code, UI and data model. Use this skill whenever the user asks for a user manual, operations manual, training guide, SOP, admin guide, "how-to" documentation, role-based guide, or wants existing software documentation audited, updated or brought in line with a new release, even if they only say "document this system" or "write help docs for this app". Works for any domain (ERP, healthcare/LIS, finance, HR, e-commerce, internal tools). Do not use for API reference generation, README files, or marketing copy.
---

# Enterprise Manual Architect

Write manuals that a first-time user can follow to complete real tasks without a developer beside them. Every claim must come from evidence in the actual application, not from feature names, table names, or assumptions. A confident manual that describes a button that does not exist is worse than no manual, so accuracy outranks length, polish and speed.

## Two layers: keep them apart

Every project produces two kinds of output. Never mix them.

**Reader-facing manuals** are written for whoever uses the software: a receptionist, a lab scientist, a cashier, a manager. They contain only what the person sees and does on screen, in the words the screen uses. They must NOT contain: URL routes, file paths, component or controller names, API endpoints, middleware or function names, database tables, permission-check code names, status labels such as "Verified (source)", or words like "source inspection", "backend", "handler" or "evidence". Permissions are written in human terms ("Only a Laboratory Manager can do this", "Only a Super Administrator can delete a test"), never as code identifiers. The only technical manual is Technical Administration, and even there, keep code references out unless the reader is a developer.

**Internal working files** (evidence register, verification report, gap report, screenshot manifest, coverage matrix) hold the technical traceability: routes, components, backend handlers, permission checks, verification status. They live in a separate `internal/` folder, are never pasted into or appended to a manual, and are delivered to the project team, not to end users.

If a manual draft contains a route, file path or code name, it is a defect: move that detail to the internal register and rewrite the manual text in plain language.

## 0. How to work (read first)

Follow these phases in order. Do not skip to drafting.

1. **Scope** (Phase 1): confirm audience, roles, modules, version, formats.
2. **Discover** (Phase 2): inspect the application and build the evidence register.
3. **Checkpoint**: present the discovery report and outline. Wait for the user's confirmation or corrections before drafting the full manual. If the user said "just do it" or cannot respond, proceed and state your assumptions at the top of the report.
4. **Draft incrementally** (Phase 3): one workflow or chapter at a time, verifying each before moving on.
5. **Quality gate** (Phase 4): run the checks, then export.
6. **Report** (Phase 5): state what is verified, what is not, and what is missing. Never claim completion if the acceptance criteria are unmet.

## 1. Scope

Establish, asking at most a few focused questions and inferring everything else from the project:

- Application name and exact version (commit hash, tag, or build number). A manual with no version is unusable.
- Intended readers: end users, department staff, administrators, finance staff, IT/DevOps.
- Which modules are in scope. Default to everything reachable by a user, but say so.
- Output formats wanted. Default: Markdown source plus DOCX and PDF. Offer fewer if the project is small.
- Language and any house style or template.

Produce only the manuals that fit the project. Typical set (merge or drop as appropriate):

| Manual | Reader | Contents |
|---|---|---|
| Getting Started | Everyone | Purpose, access, login, navigation, dashboard, preferences, first-use setup |
| End-User Operations | Daily users | Core workflows with worked examples |
| Departmental Operations | Department staff | Procedures by department, cross-department hand-offs |
| Administration and Configuration | Admins | Users, roles, permissions, settings, integrations, audit |
| Financial and Accounting Operations | Finance | Billing, payments, approvals, reconciliation, reports, controls (only if implemented) |
| Technical Administration | IT | Install, deploy, environments, backups, monitoring, recovery |
| Troubleshooting and FAQ | Everyone | Symptom-led fixes and escalation paths |

## 2. Discovery

### 2.1 Establish what access you have

State at the start which of these you have, because it sets the maximum verification level you can honestly claim:

- Source repository only (static inspection)
- Running application with a browser or UI test tool (can capture real screenshots and run workflows)
- Test or staging data and credentials
- Production data (avoid; use demo data)

If you have no repository and no running app (for example, only a description), say so plainly. Produce a draft clearly labelled "unverified, based on user description" and list every item the user must confirm. Do not pretend to have inspected anything.

### 2.2 Inspect

Work from the user's point of view outward, using whatever the stack provides.

Frontend: routes and navigation, layouts, pages, tabs, dialogs, forms, field labels, defaults, validation messages, tables (filter, sort, search, pagination), export and print, role-dependent UI, and loading, empty, success and error states.

Backend: endpoints and controllers, request/response contracts, authentication and authorization, business rules and validations, transactions, approvals, audit logging, migrations and relationships, background jobs, external integrations.

Cross-cutting: roles and permission matrix, feature flags, environment-specific behavior, and configuration that changes how workflows behave.

For large codebases, do not read everything. Start from route definitions and navigation config, rank modules by how often users reach them, and go deep on one workflow at a time. Use subagents for independent modules if available.

### 2.3 Trace each workflow end to end

For every workflow, follow it from UI action to API handler to persistence and side effects (notifications, audit events, status changes, downstream records). When UI labels and code disagree, the running UI is the source of truth for wording; the code is the source of truth for rules and permissions. Record the conflict.

### 2.4 Assign a verification status to everything

Use exactly these labels, everywhere:

| Status | Meaning |
|---|---|
| **Verified (executed)** | Performed in a running application and the result observed |
| **Verified (source)** | Confirmed by reading code only; not executed |
| **Implemented, untested** | Code exists, no evidence it works |
| **Partial** | Some paths missing or stubbed |
| **Disabled / inaccessible** | Present but unreachable (flag off, no menu entry, permission-blocked) |
| **Planned** | Not implemented |

Document Verified features normally. Document Partial and Implemented-untested features with a visible caveat. Do not document Planned features in procedures; list them only in the gap report. Never describe a partial or planned feature as operational.

### 2.5 Build the evidence register (internal file only)

A table kept in `internal/evidence-register.md`, never inside a manual. It is where routes, components, handlers and permission code belong. It powers traceability for the project team:

| Procedure ID | Route / screen | Component or file | Backend handler | Permission | Status | Notes |
|---|---|---|---|---|---|---|

Every procedure must have at least one row. Technical claims in the manual that have no row are unsupported and must be removed or flagged.

### 2.6 Discovery report (the checkpoint deliverable)

Present concisely: application and version, access level and what that limits, module and role inventory, workflow inventory with status, proposed manual set and chapter outline, questions or assumptions needing confirmation, and early gaps found.

## 3. Drafting

### 3.1 Organize by work, not by screen

Structure chapters around complete business processes, in the order users actually do them. Example for a laboratory: Patient Registration, Service Selection, Billing, Payment, Sample Collection, Processing, Result Entry, Approval, Report Printing. For each workflow, state who starts each stage, required permissions, data entered, what changes on submit, what happens on failure, what can be reversed, what needs approval, and what records and audit events are produced. Use a flowchart or decision diagram for any process with branches or approvals.

Use chapter headings with plain task names ("Register a New Patient", "Approve and Release Results"), numbered like 2.1, 2.2. Do not use headings built from code structure such as "Operations / Laboratory / Pages".

### 3.2 Procedure format

Use this for every task. Keep it as short as accuracy allows, and omit a field only if it is genuinely empty (write "None" instead of deleting it for required fields).

```
### P-<AREA>-<NNN>  <Action-oriented title>
Purpose:            one sentence
Roles:              who may do this
Prerequisites:      permissions, configuration, records that must already exist
Navigation:         exact menu path as a user clicks it (e.g. Settings > Test Panels > Test List)

Steps
1. <Verb> ...                       (one action per step)
2. ...
N. Confirm that <observable result>.

Fields (table): Field | Required? | What to enter | Validation / dependencies
Expected result:    what the user sees and what the system records
Alternatives:       optional paths
Warnings:           operational, financial, clinical or security consequences
Common errors:      message or symptom -> cause -> fix  (only documented or observed ones)
Related:            prerequisite and follow-on procedure IDs
```

Rules:

- The procedure's verification status goes in the internal register, not in the manual. In the manual, mention limits only in plain language when a user needs to know ("This option is not yet available", "Ask your administrator to enable this"). Do not tell readers how the writer checked the feature.
- Write for the person at the screen. Describe buttons, tabs, fields and messages as they appear. Say who can do the task in role names, not permission code. Describe consequences in business terms ("The test will no longer appear when registering patients").
- IDs are stable. Never renumber a published ID; retire it instead.
- One action per step, imperative verb, UI labels in bold exactly as displayed.
- Use real field names, menu labels and error messages copied from the UI or code. If you cannot confirm a label, write it as `[label to confirm]` and log a gap. Never invent navigation labels, error text, expected results or screenshots.
- Put warnings before the step they concern, not at the end.
- Use tables for fields and role comparisons, and short worked examples with safe demo data where they clarify.

### 3.3 Language

Plain, direct, consistent with the application's own terminology. Define unfamiliar terms once. Avoid marketing language, repeated paragraphs, and jargon in end-user manuals. Technical manuals may use technical terms but must still give exact commands and expected output.

### 3.4 Screenshots

Capture from the running application when a browser or UI test tool is available (Playwright or similar), at the documented version, with demo data only. Each figure needs a number, a descriptive caption, alt text, a reference from its procedure, and consistent callout style (numbered markers matching the steps).

Redact or avoid real patient, customer, employee or financial data. Check every capture before use.

If capture is not possible, insert an explicit placeholder: `[Figure N pending: <screen>, <state>, <data needed>]`, and list it in the screenshot manifest as incomplete. Never use mockups or generated images as evidence of the real interface.

## 4. Quality gate

Run these before declaring any section or the whole manual done.

- **Accuracy:** each procedure maps to an evidence-register row and a status.
- **Completeness:** all in-scope modules, roles and major workflows are covered, or listed in the gap report.
- **Consistency:** labels, terms, figure numbering, and status labels match throughout.
- **Usability:** walk through each procedure as a first-time user. Are prerequisites stated, is each step a single action, is the result checkable? If a running app is available, actually execute the steps and fix what breaks.
- **No technical leakage:** search every reader-facing manual for slashes in paths, `.tsx`/`.ts` names, `/api/`, "controller", "middleware", "handler", "endpoint", "source inspection", "Verified (". Any hit is moved to the internal files and the text rewritten in plain language.
- **Security:** no passwords, tokens, API keys, private keys, connection strings, real personal data or production records anywhere, including in screenshots, examples and source files. Scan the output before export.
- **Accessibility:** logical heading hierarchy, alt text for every figure, readable font sizes, table headers, no information conveyed by color alone.
- **Publication:** contents page, working internal links, no table overflow, legible images, correct pagination, export opens cleanly in the target format.

## 5. Deliverables

Scale to the project. For a substantial application, produce:

**Reader-facing (for end users):**
1. Manual(s) as Markdown source, DOCX and PDF (per user's formats), with table of contents
2. Plain-language quick reference by role (optional, e.g. "What a Cashier can do")
3. Changelog written as "what's new / what changed for users"

**Internal (for the project team, in `internal/`, never included in the manuals):**
4. Evidence register (routes, components, handlers, permission checks, verification status)
5. Role-to-procedure coverage matrix
6. Workflow inventory with statuses
7. Screenshot manifest (captured vs pending)
8. Documentation gap report (undocumented, broken, inaccessible, partial or unverifiable items, with severity)
9. Verification and QA report (what was executed, what was source-only, what failed)
10. Technical changelog tied to the application version

Store sources in a dedicated `docs/` directory (or the project's convention) so they can be versioned with the code. For DOCX, PDF and other file outputs, read and follow the corresponding skill before generating them.

## 6. Maintenance mode

When the application changes, do not regenerate everything:

1. Diff the code or release notes to find affected routes, components, APIs, rules and permissions.
2. Map those to procedures through the evidence register.
3. Update only affected sections and refresh affected screenshots.
4. Re-verify affected workflows and update their status labels.
5. Bump the documentation version, record changes in the changelog, and mark unresolved verification failures.

Never overwrite a Verified (executed) procedure with an unverified description. If new evidence conflicts with old text, downgrade the status and flag it.

## 7. Acceptance criteria

The documentation is complete only when:

- Every in-scope module and important end-to-end workflow is covered or listed as a gap.
- Procedures follow the format and use consistent numbered steps.
- Roles and permissions match the code.
- Warnings and failure scenarios are present for risky actions.
- Screenshots are genuine or marked pending.
- Technical claims trace to the evidence register; unsupported assumptions are listed.
- Exports pass the publication checks.
- The version corresponds to a known application revision.

If any criterion fails, finish with a clear list of remaining gaps instead of claiming completion. Final message should lead with: what was produced, the highest verification level achieved, and what the user must still do.