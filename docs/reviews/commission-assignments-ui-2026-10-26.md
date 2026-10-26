# Commission assignments UI — 26 October 2026

The assignments page now uses an administration-focused list and a dedicated inline editor, rather than putting a long form above the searchable list. Typography inherits the selected application family with regular/medium weights.

## Changes

- Explicit Apply/Enter and Clear filters with separate draft and applied values. Removed duplicate list-loading paths in favor of one paginated request lifecycle, stale-response guards, honest page-local record counts and loading/error/empty/retry states.
- The explicit all-status option is sent as `status=all`, so the existing backend does not silently default to enabled-only. Availability filters are labeled Enabled/Disabled to match the server contract. Row badges distinguish disabled, scheduled, expired and currently active assignments, treating numeric/string zero correctly.
- Lists show configuration, recipient/scope, service restrictions, both validity dates, priority and labeled Edit/Delete actions. Deletion retains confirmation and blocks repeat clicks.
- The editor provides searchable checkbox selection, Select matches, Clear selection and selected counts for batch assignment. Editing retains its single-recipient contract; system assignments retain a null recipient.
- A review summary accompanies schedule, availability and priority fields. Optional service restrictions are collapsed. All fields have accessible names; dates from existing records are normalized for date inputs. The misleading 100+/50–99 priority guidance was replaced by the existing supported 1–10 range.
- Validation and save errors stay inline without discarding selections. Failed loads can retry, recipient responses cannot overwrite a newer scope, repeated saves are locked and Cancel confirms unsaved changes.

No backend route, commission resolution calculation or authorization changed. The existing create/batch/update/delete contracts remain in use.

New-assignment summaries explicitly explain the existing repository behavior: creating a new assignment disables the previous enabled assignment for the same recipient. This is explanatory copy, not a new replacement rule.

## Verification

Ten browser checks render the real page/editor/list/API helpers with synthetic transport. They cover status badges, applied filters, pagination, failed loads, multi-recipient payloads and retry, double-click protection, editing a disabled record, system scope, confirmed deletion, mobile containment and runtime errors. Desktop/mobile screenshots were inspected. No real assignments were created or deleted. Full frontend type-check and existing commission regression results are recorded under `tmp/commission-assignments-ui`.

Full frontend type checking passed with zero errors. The broader legacy commission UI suite passed 17 of 25 tests; eight unrelated tests fail because their mock hook harness invokes React `use()` without a renderer. These older organization/clinician test files and their application pages were not changed for this assignment UI task.

## Billing strategy visual alignment and defaults

At the user's request, assignments now reuse `StrategyWorkspace.module.css` for the branded heading/icon, green primary actions, secondary/text actions, tables, badges and review panel. Assignment-specific layout rules retain readable font weights and mobile behavior. The billing strategy page itself was not changed.

The main `/settings/applicationsettings/commisions-defaults` page now uses the same design. It exposes the two actual global scopes, a configuration selector, calculation/validity review, save/reset, and accurately labeled disable/restore actions. The old individual-recipient selector was misleading: the defaults controller ignores recipient IDs and saves one fallback per recipient type. Recipient-specific rules are now clearly directed to assignments. No backend contract or authorization was changed; the existing create/update/deactivation endpoints are retained, and the hardcoded tenant ID was removed from the client payload.

Seven defaults browser checks cover load/review, failed saves and retry, duplicate clicks, organization fallback creation, disable/restore, reset, load recovery and mobile behavior. All ten assignment browser checks also pass after visual alignment. Desktop/mobile screenshots were inspected; no real assignments or defaults were mutated.
