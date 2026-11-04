# Result revalidation after edits

Saving laboratory results clears current validators and increments the approval revision atomically with values, comments, calculated results and culture/sensitivity changes. A save after any prior approval sets a persistent requires_revalidation flag. It remains set through repeated saves and partial approvals until the configured minimum number of validators explicitly approve the new revision. Historical revision approval events remain intact. Initial-entry validation bypass is retained, but cannot clear or bypass this amendment flag.

## Validation review interface

Single and bulk validation share a scrollable review modal with compact patient
identity, a readable parameter/reference table, current revision badges, and a
separate approval panel. Comments appear once without the printed-report footer.
The revalidation warning remains prominent. Recorded approvals come from the
loaded server revision, not the local checkbox or PIN verification state.
The review checkbox stages an approval; **Record approval** commits it using the
existing revision-bound endpoint. PIN verification remains required when enabled.
Desktop uses side-by-side review and approval; narrower screens stack the panels
with horizontal scrolling confined to the result table.
The review dialog uses up to 1600px of available width. Alternating row backgrounds
follow the active theme; existing high/low result flags receive distinct row
backgrounds without changing the clinical flag calculation or values.
Successful single/bulk validation closes the review and refreshes its caller
directly, with the existing toast feedback, rather than opening a second
"Validation Successful" modal or a new printing window.

## Retry-safe result entry (2026-11-03)

This revision rule applies to **changed** saves. An identical current save is now a no-op: no new revision, validator invalidation, edit counter, workflow write, calculated/imaging audit, critical action evaluation, notification or analytics dispatch. Existing lifecycle, payment, QC, role, tenant and edit-window restrictions remain in force (the edit window applies to changes, not a read-only retry acknowledgment). A changed save still runs the original transactional result/approval/critical-action path. The non-drug edit counter now participates in that transaction too.

### Traced surfaces and identity

- Both the daily laboratory result editor (`components/LabTestForms/testrule.jsx`, including shared visit/bulk entry) and ultrasound editor post to `/api/v1/result/entry/customtest`. The role middleware checks the authenticated tenant and laboratory role and replaces the payload employee with the authenticated actor. Controller → `Creator.resultEntry` → shared `test_results`.
- Device base processing and HL7 software processing also call `Creator.resultEntry`; they receive the same parameter and current-snapshot protections even without request IDs.
- `src/models/creator/index.js` contains the older dynamic `dboResult{testid}` check-then-insert writer. It is not imported by the active routes, and `allowJs` is not enabled. The active TypeScript writer does **not** write those dynamic tables. Do not deploy or revive that legacy writer; if a facility still executes it, upgrade/rebuild the actual backend before claiming this fix covers it. No dynamic table is renamed, altered or deduplicated here.
- The old active writer used parallel per-field existence checks followed by inserts. Two entries with the same `fieldid` in one submitted array can both observe no row before either insert. The legacy dynamic writer also had an unlocked cross-request check/insert race. The current active writer already locked the ascension across requests, but still created a revision and repeated side effects for every retry.
- The current schema/API has one current row per `(ascensionid, testid, fieldid)`; row `id` is a storage key, not a repeat ordinal. Same-name/different-ID parameters, multiple parameters, partial updates, and separate repeat ascensions remain distinct. Historical rows live in audit tables and are **not** constrained or removed. There is no separate server-side laboratory draft store on these paths; editor state is unsaved until POST, then the existing approval/revalidation process finalizes/reviews the saved revision. Formula versions and approval history remain separate.
- This API does not express an independent repeated-row/isolate identity for the same parameter in one ascension. Such existing rows are ambiguous, **not automatically classified as errors or collapsed**. If they represent legitimate clinical multirow data, stop deployment for that tenant and design/migrate an explicit row/observation identity and matching readers/editors first. Never use array order, display name, or “newest wins” to decide.

### Request contract and concurrency

`request_id` is optional for older clients and devices; updated editors always supply a secure random stable ID (16–80 ASCII letters/digits/underscore/hyphen). The synchronous in-flight guard starts **before** asynchronous PIN validation. Identical retry payloads reuse the ID, including after an uncertain network response; a changed payload or deliberate reversion gets a new ID. Payloads/IDs are retained only in editor memory, not browser persistent storage.

The server serializes on the tenant-local ascension and billing rows, rejects repeated/foreign parameter IDs and ambiguous stored parameters/comments/drugs, compares decrypted current values, originals, labels, modes, comments and requested drug reactions, and stores a keyed payload digest/actor retry receipt atomically with a keyed save. A receipt replay acknowledges the original operation without reapplying it over a later edit. Reusing an ID with another payload or employee returns HTTP 409. Receipts contain no clinical values and must not be pruned while clients may retry. The response adds `changed` and `replayed`; `approval_revision` and `requires_revalidation` describe current server state, **not necessarily the historical replayed revision**. The editor must reload/review current data on a replay; it must not validate the stale local preview. The laboratory editor does not automatically open validation on replay.

Independent tabs with different/no IDs and identical current content still converge without another write. A client can optionally submit integer `expected_revision`; changed saves with a stale revision return HTTP 409. Existing editors do not yet load an atomic value/revision snapshot for optimistic editing, so ordinary **different** edits retain existing last-writer/edit-window semantics. Delayed unkeyed device/old-client messages after an intervening different edit cannot be distinguished from intentional reversions. Stable device message identities are a follow-up requirement for that case. No automatic retries of failed transactions or external deliveries are introduced.

### Deployment and reviewed repair

Rebuild/restart the backend and deploy the frontend. The existing tenant startup
pipeline automatically runs the idempotent **`20261103_result_save_identity`**
schema initializer for every served tenant before marking that tenant ready.
The standalone migration allowlist includes the same implementation. No manual
migration command is required. Check server bootstrap logs for any blocked tenant;
the initializer never deletes or chooses between existing clinical observations.

The migration preflights duplicate/unidentified current `test_results` identities and fails before DDL if any exist. On clean data it creates `uq_result_current_parameter` on `(ascensionid, testid, fieldid)` and tenant-local `lab_result_save_requests` with a unique, case-sensitive `(ascensionid, request_id)`. Pause result writers during preflight/DDL/rollout; confirm InnoDB transaction/row-lock behavior and existing trigger definitions in staging. MySQL DDL is not atomic; rerunning is guarded by index/table existence. Rollback deliberately retains both uniqueness and receipts.

For an existing tenant reporting a missing `lab_result_save_requests`, rebuild
and restart the backend so the tenant bootstrap creates the retry table and
current-parameter index automatically. A failed bootstrap is recorded in server
logs. Any unexpected missing-table request fails closed with a user-facing
temporary-unavailability message; deployment instructions and SQL details are
not exposed in the client response.

For a blocked tenant: take a secure verified backup; have an authorized laboratory reviewer reconcile **all original row IDs**, values/originals, patient/billing/ascension ownership, audit/edit sessions, validators, culture rows and delivered copies. Record the review decision and rationale in an append-only, access-controlled repair manifest/archive preserving complete original rows and their references. If rows are true repeats, introduce their proper row/observation identity rather than removing them. For confirmed accidental duplicate current projections, use a separately reviewed maintenance migration to preserve every original row/reference in that archive and designate the approved current projection; then re-run the preflight. There is intentionally no generic repair/delete SQL here: it cannot safely choose the clinical truth. Retain all audit, validation and delivery history; amendments still require review/revalidation. Current save attempts against ambiguous data return a clear HTTP 409 instead of updating every duplicate row.

Regression coverage uses the real `Creator.resultEntry` with a transactional in-memory adapter, plus migration contract tests, existing authorization/approval tests, and frontend guard tests. This is not a substitute for MySQL lock/unique-index/trigger integration testing or live browser/provider verification.

Post-commit notification/analytics remain the existing fire-and-forget behavior, not a durable outbox: this fix suppresses duplicate dispatch on retries but cannot guarantee delivery across a process crash. Legacy comments remain billing/test-scoped rather than repeat-ascension-scoped; the billing-row lock prevents concurrent creation races but does not change that pre-existing ownership model.

Retry-fix validation: 101 backend regressions across 15 files and 6 frontend regressions passed, including the old parallel-insert reproduction, simultaneous/delayed retries, clinical amendments/reversion, repeats, rollback, imaging/culture audit behavior, authorization, tenant isolation and migration preflight. Frontend `pnpm exec tsc --noEmit --incremental false` passed. A focused backend TypeScript program including every changed backend source/test, imported dependencies and existing ambient declarations passed with zero diagnostics. The final full backend `pnpm exec tsc --noEmit` run reported only four unrelated `totalpayable` typing errors in the concurrently edited `src/models/billing/authoritativeSubmission.test.ts` (lines 36, 40, 41, 45); those files were not changed by this work.

The validator modal first loads an authoritative revision snapshot for every selected test, then mounts the result preview. Both single and bulk approval submit that revision; an intervening edit returns HTTP 409 and requires reloading/reviewing current values. Missing revision requests are rejected. The snapshot endpoint uses the authenticated tenant, employee and branch. Validator permission and minimum/maximum validation settings remain authoritative.

Result entry returns the current revision and amendment flag, with an explicit revalidation message. The validation queue marks changed results. Validation date filters follow last approval/result activity; direct ordered-test or billing links are not hidden by an unrelated default registration-date range.

Amended results cannot be printed/released by the staff report endpoint, marked delivered, or shown as approved in patient/clinician portals while revalidation is required. Existing delivery/audit history is retained. This does not retract copies already printed or sent and does not infer which historical edits were clinically reviewed before deployment.

Deploy backend and Lobnos together, restart the backend to apply the idempotent schema addition, then reload the frontend. The standalone migration allowlist includes 20261023_result_revalidation. Rollback retains revision safety/history. Live clinical transactions and migration execution were not performed during implementation.

The ultrasound editor also exposes the authorized result validation dialog, so amended imaging results have a review route. Validation permissions still apply.

Validation: 167 focused backend tests across entry, operations, revision API, portal release, delivery and provisioning; backend TypeScript build; frontend TypeScript source check; Next SWC compilation of the edited entry/validation screens. Live browser interaction and live migration execution remain untested.
