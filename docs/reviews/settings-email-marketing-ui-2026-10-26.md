# Settings, email and marketing UI — 26 October 2026

Applied the pending frontend changes and the follow-up request to match billing-strategy / commission configuration styling.

## Changes

- Sample validation: set checkbox `indeterminate` through the DOM ref, with a mixed accessible state. No invalid HTML attribute is emitted.
- Result-entry settings: clear header, validation panel, visible scientist actions, associated limit labels, normalized numeric IDs/limits, inline success/error/retry, duplicate-submit guard, disabled controls during save. Existing settings fields and selected-validator payload remain intact.
- Report settings: consistent page header and tabs/panels; all five existing tabs retained. Save errors keep nested edits and no longer reload over them. Failed initial loads block editing until retry. Existing `{ data: settings }` save envelope retained.
- Test-panel pricing: paginated/searchable catalogue with saved amount hints, changed-only filter and unsaved count. Preserve drafts across paging/search; blank/negative/nonfinite amounts cannot be saved. Submit only changed numeric records through the same bulk API. Explicit confirmation for copying all prices to costs and for discarding changes. Retain failed edits and prevent duplicate saves.
- Email: reuse billing-strategy workspace/header/icon/stat primitives, restrained neutral panels, inherited application font, consistent green actions and no gradient hero. Shared treatment across providers, templates, delivery settings, queue and logs. Hub links use actual routes. Email settings normalize numeric-string marketing flags, validate retry/attachment inputs, retain failed edits and block duplicate saves. Log viewer actions are labeled. Added narrow gitignore exceptions so the email log route source is retained rather than treated as runtime logs.
- Marketing: searchable campaign directory and correct creation/linked-promo routes; campaign and promo forms retain failed entries, validate date order and prevent duplicate submission. Percentage promos cannot exceed 100. Existing endpoints/payloads retained. Promo string-zero active flags display correctly; list remains server-paginated. Fixed mobile card overflow.
- Navigation roles, backend authorization and calculations were not modified.

## Verification

`scripts/test-settings-ui-browser.cjs` bundles actual frontend components, report tabs, API mapping helpers and PrimeTable with synthetic transport/application context. Only unrelated sample dialogs/date helpers/server actions and Next routing are replaced. Edge checks cover none/mixed/all sample selection, settings load failures and retries, all five report tabs, failed-save draft retention, duplicate clicks, API payloads, cross-page pricing changes, bulk copy/reset, email settings, campaign and linked promo creation, numeric flags, email provider/template/queue/log rendering and log detail viewing. Mobile overflow is checked for 13 views. No real emails, settings, prices or marketing records are changed. This is component/workflow integration coverage, not a live backend authorization test.

17 grouped browser checks passed. Desktop/mobile screenshots were reviewed under `tmp/settings-ui-followup/browser-*`. Full frontend `tsc --noEmit --incremental false` is recorded in `tmp/settings-ui-followup/types-final.log`. `git diff --check` passed (only standard Windows line-ending warnings).
