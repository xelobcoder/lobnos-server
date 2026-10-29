# SMS campaigns

## Access

| Action | Allowed staff |
| --- | --- |
| Campaign history, messages and analytics | Administrators, managers, customer-service/front-desk staff |
| Compose, schedule, review and retry a confirmed failure | Same operational roles |
| Edit pending campaigns, cancel unsent messages and maintain templates | Administrators and managers |
| Provider settings, event activation and configuration | Administrators |

Normalized super-administrators retain their existing access. Existing practitioner, pharmacy and marketer boundaries remain enforced. Manual patient/billing notifications retain their narrower operational role checks; automatic clinical notifications do not need a staff session. Module activation is still required.

Campaign history and recipient access are scoped by branch, with creator-branch fallback for legacy records. Non-administrative patient audiences include patients registered in or billed by the staff member's branch; staff without a branch are limited to their own registrations. Shared practitioner and organization directories retain their existing tenant scope.

The application uses its existing sidebar. There are no additional SMS tabs.

## Processing and delivery

The review resolves saved contact numbers, excludes invalid and duplicate contacts, personalizes templates and calculates GSM-7/Unicode segments. A fingerprint detects changes between review and submission. A request key makes retries of the same creation request idempotent.

Creation saves the campaign, frozen recipient messages and dispatch record in one transaction. The database worker starts for ready tenants independently of the accounting worker. Scheduled campaigns remain queued until their requested time. Provider calls happen outside database transactions. A lease and per-recipient submission claim prevent competing workers from submitting the same recipient.

- **Scheduled/queued:** not submitted yet.
- **Submitting:** a worker has claimed the message.
- **Submitted:** the provider acknowledged it; delivery has not been confirmed.
- **Delivered:** a provider delivery report confirms delivery.
- **Failed:** a rejection or failure was confirmed; an authorized operator may queue a retry.
- **Needs review:** acceptance is uncertain, for example after an interrupted submission. It is not automatically retried.
- **Cancelled:** remaining queued messages were cancelled. Provider-submitted messages cannot be recalled by this action.

Historical `sent` records are labelled **Submitted (legacy)**. Old untracked pending/processing records are retained for review rather than replayed. Historical confirmed failures remain retryable through safe queue adoption. Cancellation retains campaign records.

## Provider reports

The implementation follows the [Arkesel SMS API](https://docs-staging.arkesel.com/): delivery callbacks use `sms_id` and `status`, and individual reports use the provider message UUID. The worker also polls acknowledged messages, so callback downtime does not require resending messages.

Set `SMS_CALLBACK_BASE_URL` to the public HTTPS API origin if it differs from `APPHOST_PRODUCTION`. The application builds a token-protected `/api/v1/sms-delivery/...` callback URL. The callback is outside staff login, but its campaign token, tenant and message identity are validated. Callback credentials are redacted from application request logs. Early reports are retained until the corresponding acknowledgement is recorded; repeated or late reports cannot revert confirmed delivery.

For an unknown submission without a stored provider UUID, an authorized operator may enter the UUID from the provider account. The application verifies the returned phone number and message against the retained recipient record before linking it. An unknown result is never converted to a retryable failure merely because a lookup was unavailable.

Keep this callback route uncached and reachable through the production reverse proxy. A live network delivery check is still required after deployment; automated tests intercept provider calls and never send real SMS.

## Validation

- Backend: `npm run build`
- Backend suite: `node node_modules/vitest/vitest.mjs run --maxWorkers=1 --testTimeout=30000`
- Frontend: `tsc --noEmit --incremental false`
- Frontend access policy: `node --test tests/sms-access.test.cjs`
- Browser workflows: `node scripts/test-sms-workspace-browser.cjs` from the backend workspace

The tests cover review invalidation, request-key retries, audience normalization, role and branch checks, competing workers, interrupted submissions, early/replayed delivery reports, cancellation, historical retry compatibility, provider reconciliation and desktop/mobile layouts. They use isolated database doubles and intercepted provider requests; they do not execute migrations against a production database.

## Arkesel v2 administration (29 October 2026)

The administrator-only **Arkesel connection** page is `/communications/sms/provider`. It uses tenant-bound `/prime/sms-provider` endpoints for settings, health/balance, signing-secret retrieval/rotation and queue resume. Existing application/master facility settings endpoints remain compatible. Existing V2 base URLs ending in `/api/v2` are accepted and normalized to the SMS origin to avoid duplicate API path segments.

New API/signing credentials use AES-256-GCM. Set a dedicated `SMS_SECRET_KEY` of at least 32 characters (a sufficiently strong existing `JWT_SECRET_KEY` is the compatibility fallback). Keep this key stable and backed up separately; losing/changing it prevents reading encrypted credentials. Plaintext legacy rows remain readable and are encrypted when saved. The key is never returned by provider APIs. The local development environment was configured with a generated dedicated key; deployed servers need their own configured key. Restart the backend after changing its environment.

Signed callbacks are verified at the receipt boundary, independently of outbound activation. They retain the campaign token checks. Arkesel timestamp/signature headers are verified over the complete canonical query, with PHP-compatible Unicode escaping, five-minute clock tolerance, multiple rotation signatures and durable webhook-ID collision checks. Invalid/partial signatures are rejected even in compatibility mode. Completely unsigned legacy callbacks remain supported until an administrator enables **Require signed delivery callbacks**. Retrieve/generate a provider signing secret first; no secret is automatically rotated during startup. Rotation requires an explicit administrator confirmation and affects the entire Arkesel account. Coordinate all facilities sharing that account.

Sandbox mode is frozen into campaign review and dispatch. Administrators can choose an individual test campaign; facility-wide sandbox settings also apply to ordinary composition. Sandbox acknowledgements are labelled **Sandbox test**, never confirmed delivery, and are excluded from live analytics. Switching the provider to sandbox pauses already-queued live campaigns rather than silently converting them into tests. Sandbox does not imply support for the provider template endpoint: test campaigns use standard sending.

The worker sends compatible live messages in batches of at most 50, using standard bulk send for identical content and the provider variable-template endpoint for distinct frozen messages. Returned IDs are matched by normalized recipient number; missing/duplicate acknowledgements remain unknown. Confirmed 401/402/403/429 account responses retain the unsent audience and pause dispatch. After fixing credentials, credits or gateway configuration, an administrator explicitly resumes the queue. Cancelling blocked campaigns remains available to authorized managers.

Automatic event messages now enqueue frozen snapshots rather than making inline provider calls. Stable event/source/content keys deduplicate repeated triggers; payment history/bill identity distinguishes payment and billing notifications, and birthday keys include the occurrence date. This does not create a provider-side idempotency guarantee. Unknown acceptance remains held for review.

Reconciliation uses batch message reports, up to the documented 1,000 IDs per request. Individual lookup remains for manually linking unknown provider IDs, with phone/body matching. Reported segments and raw provider statuses are retained and shown in recipient history. Reports may enrich already-confirmed deliveries with segment counts without downgrading their final state.

Balances are read from Arkesel, cached for one minute, and displayed separately as SMS credits/main balance. They do not post to our accounting ledger. This phase implements the SMS transport, reporting and administration upgrades; other communication products remain outside the enabled workflows; contact-group synchronization is described below.

Additional coverage: adapter fixtures, signature canonicalization/tampering/rotation, callback-boundary controls, encrypted storage, additive schema preservation, batch personalization and partial responses, sandbox isolation, event deduplication, setup permissions and provider administration browser flows. Automated checks make no live provider calls.

## Selected contact-group synchronization

The **Contact groups** sidebar page (`/communications/sms/contact-groups`) supports administrators and managers. Customer-service staff and other campaign readers do not gain contact-export privileges. Group lookup, candidate search, preview, queueing and history all validate the authenticated tenant and role. Managers see groups in their branch; managers without a branch see only their own groups. Patient selection reuses the existing registration/billing branch scope. Practitioner and organization directories retain their existing tenant-wide policy.

This is an explicit, additive export using Arkesel's documented group-creation and add-contact APIs. It is not a two-way address-book mirror. The supplied API does not document a complete SMS contact-group read/update/delete lifecycle. Contacts previously exported are not removed when unselected, and existing synchronized numbers are skipped rather than assuming that resubmitting them updates their names. No SMS is sent by synchronization.

Create a local group, select saved contacts individually across pages or explicitly choose all contacts matching an applied search, choose whether to include names (off by default), review the counts and confirm the export. Individual syncs support up to 10,000 contacts; narrow the search for larger audiences. Only phone numbers and optional saved contact names/company names are exported. Email, clinical, billing and birth-date data are not exported. Arbitrary caller-supplied phone numbers, provider group references and extra selection fields are rejected.

Provider group references are generated from the tenant identifier, a readable group-name slug and a random suffix. The remote destination cannot be supplied by the browser. Groups are bound to a fingerprint of their configured tenant/provider account. Changing credentials requires a new group, avoiding silent exports into a different account. An active live provider is required; contact export is not offered in sandbox mode.

Review fingerprints bind the saved contacts, opt-in fields, actor/branch, group, membership state and provider account. Queue creation is idempotent by request UUID and stores an encrypted snapshot. Only one unfinished synchronization per group is permitted. Invalid and duplicate numbers and already-synchronized contacts are counted in the review and excluded. The independent contact-sync worker rechecks the authorizing employee's current activation/role/branch, patient access, saved numbers, opted-in names and provider account before each batch. It does not delay the existing SMS campaign worker.

Provider creation and contact imports run in separate durable steps, with batches of at most 200 contacts. Successful numbers are recorded by group/phone hash; history shows progress without returning frozen payloads. Queued/blocked runs can be cancelled, preserving previously imported contacts. Blocked work can be reauthorized and rechecked by an authorized manager/administrator. Processing requests cannot be recalled.

Interrupted or uncertain provider writes are not automatically replayed. They remain **Needs provider review**, including ambiguous contact-import failures because the API has no documented per-contact acceptance report. Administrators can inspect the exact frozen batch, check the facility-specific provider group in Arkesel, explicitly attest that the entire affected batch exists, and record their user/time as manual verification. Managers cannot inspect or resolve this administrative verification. Only after verification do remaining batches continue. If an import was partial, inspect/complete it in Arkesel before attesting; a fresh group is another option. This attestation is an operator action, not a provider-generated delivery receipt.

Migration: `20261029_sms_contact_groups`; bootstrap is additive and preserves existing campaigns and synchronization snapshots. New tables are `sms_contact_groups`, `sms_contact_group_members` and `sms_contact_sync_runs`. Frozen contact payloads use the configured SMS encryption key. No group/contact data is exported during migration, page load, local group creation or automated tests.
