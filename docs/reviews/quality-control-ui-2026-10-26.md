# Quality-control UI and workflow review — 26 October 2026

The first redesign improved visual structure but left creation disconnected from recording, competing pagination paths, premature acceptance actions and nonfunctional setup controls. The follow-up addresses those gaps.

## Completed

- Creation returns the inserted session UUID and control material reference while retaining `status: true`. The frontend opens that exact session's recording route, retains failed selections, ignores stale control-list responses and blocks repeat clicks. Legacy responses without an ID direct the user to existing sessions rather than encouraging duplicate creation.
- One server-backed session list handles pagination, error recovery and page sizes. Acceptance is offered inside the results review only, after readings load; empty/non-normal sessions remain disabled. Existing acceptance endpoints and backend eligibility checks remain authoritative. Admin-only bypass UI access is unchanged.
- Review displays recorded values, targets and statuses separately. Readings repository projections no longer allow `cp.*` to overwrite recorded reading IDs, values or timestamps. Missing targets are not invented from observed values. Charts remain available in an expandable section above the reading table.
- Recording waits for existing readings and parameters, uses controlled inputs, avoids false critical messages for normal results, retains failed edits and locks repeated submissions. Back and successful Save return to the sessions tab. Successful UUID reading inserts with MySQL insertId zero are correctly treated as success.
- Setup persists warning/action defaults through authenticated `GET/PUT qc/settings`. Admins/managers can save; scientists can read. Values must be positive, action greater than warning and no more than four decimal places. Revision checks reject stale edits. The per-tenant `qc_configuration` table is created on first access; updates retain operator/time metadata.
- New parameter drafts use saved SD defaults rather than test-panel clinical reference ranges. Existing saved material limits and readings are not rewritten. No Westgard rule toggle or notification preference is presented as functional; no dispatcher was added.

## Verification

- 13 browser checks exercise the real workspace, setup form, creator, session review, charts, recorder and parameter manager with synthetic APIs. Includes save/reload, validation/retry, duplicate clicks, UUID route handoff, paging, empty/warning review guards, backend rejection recovery, read-only settings, admin-only bypass UI, mobile containment and new-versus-existing default behavior.
- 47 backend tests passed across QC creation, settings persistence/conflict/permission checks, reading projection/UUID persistence, existing review enforcement and laboratory authorization.
- Backend build passed. Full frontend `tsc --noEmit --incremental false` passed.
- No real sessions, readings, reviews or notifications were submitted. Browser tests replace the API transport; backend repository tests use database doubles/generated SQL rather than a production database.

Deploy/restart the backend alongside the frontend so the new settings endpoints and additive creation response are available. Existing QC thresholds and review authorization were not broadened.
