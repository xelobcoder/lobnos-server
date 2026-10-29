# Arkesel integration review — supplied API specification v2.4.0

Reviewed: 29 October 2026. This is an implementation proposal, not a record of implemented features.

## Evidence and scope

Source: `C:/Users/hamza/Downloads/api_spec.v2.4.0.yaml`. The file identifies the provider as **Arkesel**, matching the current adapter. Its filename carries v2.4.0; OpenAPI `info.title` and `info.version` are empty. The supplied document describes SMS, Voice SMS, OTP, USSD, Voice Connect surveys/IVR and KOVA IQ/WhatsApp. These are distinct products and do not all use the SMS API key.

Compared against:

- `src/models/application/integrations/Arkesel.ts`
- `src/models/application/sms/SmsCampaignService.ts`
- `src/models/application/sms/SmsCampaignWorker.ts`
- `src/models/application/sms/SmsMessageMetrics.ts`
- `src/models/application/sms/events/PrimeEventsDataSource.ts`
- `src/models/application/sms/services/SmsProviderSettingsService.ts`
- `src/models/application/sms/repositories/SmsProviderSettingsRepo.ts`
- `src/models/application/sms/types/SmsProviderModels.ts`
- `src/app.ts` callback registration
- Frontend SMS dashboard, composer, history and recipient pages.

No provider credentials were requested or read. No live requests, SMS sends, secret rotations, contact exports or production changes were performed for this review.

## Existing integration: retain these foundations

The application already uses POST `/api/v2/sms/send` with the `api-key` header. It supports immediate campaigns, local scheduling, saved templates expanded locally, audience review, segment estimates, per-recipient submission records, callbacks and individual message-report lookup. Campaigns have tenant/branch authorization, frozen messages, local request-key deduplication, worker leases, cancellation of unsent rows and conservative treatment of uncertain provider acceptance.

These mechanisms should be extended rather than replaced by direct calls from the frontend. A local creation request key does not establish provider-side send idempotency.

## Required compatibility and reliability work

### 1. Verify signed messaging callbacks

Current callbacks validate a random campaign URL token. They do not consume the documented Arkesel signature headers.

Implement verification of `X-Arkesel-Webhook-Timestamp` and every comma-separated `v1=` value in `X-Arkesel-Webhook-Signature`. Reconstruct `{timestamp}.{canonical_json}` by recursively sorting object keys, preserving array order, and using the PHP-compatible non-ASCII escaping in the supplied Node.js example. Use HMAC-SHA256 and constant-time comparison; reject timestamps outside the documented five-minute window. Persist `X-Arkesel-Webhook-Id` for duplicate detection, alongside existing message/status deduplication.

Add owner-controlled retrieval/generation/rotation through GET `/api/v2/webhooks/secret` and POST `/api/v2/webhooks/secret/rotate`. GET does not create a secret. Signed headers are enabled only after a secret is generated. Rotation has a 24-hour overlap; verification accepts any valid supplied signature. Introduce an explicit, audited migration from token-only to required-signature mode after account setup, so existing callbacks are not silently broken. Where facilities share one Arkesel account, coordinate rotation at provider-account level rather than independently rotating it for each tenant.

Continue validating the campaign token, tenant association and message identity. Keep the callback public to the provider, outside staff login, without turning it into an unrestricted update endpoint. Retain early-report handling and authenticated polling fallback.

### 2. Put automatic events through the durable outbox

`PrimeEventsSMSDataSource.sendSMSMessage` currently calls the provider directly, then saves successful sends. It does not use the campaign worker or pass the campaign callback URL. Payment/result/registration event delivery therefore does not yet have the same durable submission tracking as manual campaigns.

Create an event enqueue operation accepting a verified domain recipient and frozen message. Preserve event code, actor, source record and branch, with a unique event/source/revision key where repeated triggers represent the same notification. Use the existing worker, callback, reconciliation and unknown-acceptance rules. Keep user-facing patient/billing workflows and event activation checks intact.

### 3. Normalize provider contracts and errors

Keep V2 header authentication for new work. The adapter still contains a V1 `sendSingleSms` helper with query-string credentials; no current call sites were found in the reviewed source. Retire it or delegate it to V2 after compatibility checks.

Validate sender IDs against the documented 11-character limit; remove silent truncation in the adapter. Return actionable configuration and validation errors without exposing keys or raw request data. Preserve provider error codes and sanitized descriptions rather than discarding every non-2xx response body.

Treat 401/402/403 as account/configuration conditions: pause further queued submissions and alert an authorized administrator, rather than repeatedly rejecting an entire audience. Keep uncertain network/5xx acceptance separate from a confirmed rejection. Add bounded retry/backoff for safe reads, and honor rate-limit signals where provided. Do not automatically replay uncertain sends: the supplied document does not establish a provider idempotency-key contract.

The current normalizers support Ghana numbers. For international facilities, introduce country-aware canonical storage and provider formatting using country code plus number. Preserve working Ghana-local input. `use_case` is documented for Nigerian traffic, with promotional and transactional values; do not present it as a Ghana routing requirement.

### 4. Batch delivery reports

Use POST `/api/v2/sms/message-reports` with `msg_ids`. The spec's description permits 1–1,000 UUIDs per request. The current reconciler reads reports individually, up to ten recipients per sweep.

Chunk by provider account and tenant-authorized messages; map each result back by UUID, handle per-ID errors and absent results independently, and retain `message_count`, sender and provider submission time. Preserve terminal-state rules. A report lookup failure is not evidence that a message failed or may safely be resent.

### 5. Add an explicit sandbox mode

Support `sandbox: true` on the standard send endpoint, with owner controls, a persistent environment flag and obvious TEST labels in composer, history and dashboard. The spec says these sends are not billed or forwarded to mobile networks. Exclude them from live delivery KPIs and accounting/credit consumption estimates. Template-send sandbox support is commented out in the supplied schema; do not assume every endpoint supports sandbox.

## SMS feature expansion

| Feature | Documented endpoint | Required application changes |
| --- | --- | --- |
| Credit visibility | GET `/api/v2/clients/balance-details` | Connection check, cached balance snapshot, separate SMS credits/main money balance, low-credit threshold and stale/error indicators. Do not confuse provider wallet balances with our financial ledger. |
| Bulk personalised sending | POST `/api/v2/sms/template/send` | Map existing local placeholders to provider `<%variable%>` syntax, validate recipient variable maps, claim recipients before sending, and persist per-recipient returned IDs. Keep local frozen rendered messages for audit and reconciliation. |
| Identical-message bulk send | POST `/api/v2/sms/send` | Group compatible recipients by message, sender, environment and provider configuration, with configurable chunk limits. Partial/unreadable responses leave only affected recipients uncertain. Confirm send-size/rate limits with Arkesel; the 1,000 limit above is for report lookups. |
| Provider contact groups | POST `/api/v2/contacts/groups`, POST `/api/v2/contacts`, POST `/api/v2/sms/send/contact-group` | Optional named-group mapping, explicit export and sync records, deduplication and consent/suppression checks. The SMS section does not document a complete group listing/update/delete/sync API. Maintain the local audience as authoritative; do not claim full two-way sync. |
| Provider usage analytics | Report fields including `message_count` | Show estimated local segments separately from reported provider segments, submission/delivery timestamps where actually known, provider status and rejection reason. The spec does not provide an SMS delivered-at timestamp in the shown report. Do not invent delivery latency or exact per-message cost. |

Local scheduling should remain the default. The current queue holds a campaign until its due time, so edits/cancellation can still affect unsent messages. If provider scheduling is introduced, record who owns the schedule, explicitly resolve the provider timezone/date-format ambiguity, and avoid double scheduling. The supplied SMS section does not document a remote scheduled-SMS cancellation endpoint; the WhatsApp cancellation endpoint is not an SMS recall API.

## Additional communication products: optional and separately configured

- **Provider-managed OTP:** POST `/api/otp/generate` and `/api/otp/verify`; SMS or voice, numeric/alphanumeric, expiry 1–10 minutes, code length 6–15. The spec requires the main SMS API key: subkeys do not work. Bind verification to a tenant, user and purpose, with local challenge state, expiry/resend/attempt limits and replay protection. This is an optional delivery/verification provider, not an automatic replacement for existing login/MFA/Google Workspace flows.
- **Voice SMS:** POST `/api/v2/sms/voice/send`, multipart audio, optional registered voice ID, callback outcomes such as ANSWERED/NO ANSWER/BUSY/SUBMITTED. The provider retries unanswered outcomes by default unless `retry: 'false'` is supplied. Build call-specific statuses and retry policy; never label an answered call as a read SMS or verified clinical acknowledgement.
- **WhatsApp Business through KOVA IQ:** Inbox/template selection, one-off template messages, contact groups and draft/scheduled campaign management are documented under `/ext-api/v1/whatsapp-business/...`. Use the KOVA host, `X-API-Token`, external organization `pid`, and the documented UUID types for templates/groups/inboxes. Maintain these mappings separately from our organization primary keys. WhatsApp delivery/read callbacks are not specified in the same detail as SMS in this file; confirm their contract before promising real-time read receipts.
- **USSD:** Requires subscription/shortcode setup and a separate session callback. The document explicitly says USSD signing is not currently available in this flow. Do not reuse SMS signature verification or expose clinical data through an unauthenticated session lookup.
- **Voice Connect surveys/IVR:** Surveys use the Voice Connect host and `x-api-key`; IVR apps use Bearer authentication. IVR has audio-file management and play/gather/routing actions. Its signature scheme uses `{timestamp}.{raw_request_body}`, unlike the SMS canonical-query scheme. IVR secret regeneration invalidates the old secret immediately, unlike the messaging 24-hour overlap.
- **KOVA support tickets:** Optional CRM integration for customer tickets/messages/contact lookup. These are separate from SMS campaign delivery and from clinical consultation records.

## Settings, data and frontend changes

Extend provider configuration with explicit account association, environment, sender, country defaults, capabilities, signing configuration and per-product credentials. Store sensitive values encrypted using a separately managed encryption key; mask values returned to administrators. Use per-product origin allowlists/authentication rather than reusing a single base URL/API key for every service.

Add versioned migrations for provider account/capability settings, webhook receipt metadata, submission attempts, environment, account-pause diagnostics, balance snapshots and optional external resource mappings. Retain existing campaign/recipient records and APIs. Add explicit external IDs, not overloaded local IDs. Protect contacts, message bodies and keys in logs.

Frontend changes should extend the existing sidebar, not add duplicate tab navigation:

- Dashboard: SMS/main balances, low-credit warnings, callback/connection health, live/test distinction and reported usage.
- Composer: clear live/test indicator, optional bulk/personalisation options, eligible groups, sender selection if configured, and review of audience/estimated segments.
- History/recipients: provider UUID, submission evidence, provider rejection reason, environment, reported segments and safe batch refresh.
- Administrator setup: connection/balance check, sandbox validation, signing-secret status/rotation and separately enabled channels.

Preserve current role and branch boundaries. Setup/secrets remain administrator-only; template/group maintenance follows existing management rights. External exports require authorized audience selection. Marketing consent and suppression are application responsibilities; the supplied SMS API does not describe a turnkey opt-out-management endpoint.

## Contract ambiguities to resolve before generating a client

1. The single-report path is declared `/api/v2/sms`, but code samples use `/api/v2/sms/{uuid}`. Our existing lookup matches the samples; validate with a controlled provider test.
2. Several `data` schemas say object while examples contain arrays. Template recipient schemas say array while examples use a phone-keyed object.
3. The batch UUID cap is described as 1,000 entries but expressed as `maxLength`, not the array keyword `maxItems`.
4. Callback IDs are described as 16-character UUIDs, but examples are standard hyphenated UUIDs. Do not tighten validation to 16 characters.
5. Scheduled timestamps mix 24-hour formatting notation with AM/PM examples and do not establish a timezone. Keep local scheduling until verified.
6. Root security references `api_key`, while the defined V2 scheme is `api-key`. Authenticate each operation explicitly.
7. No dependable general send-rate limit, provider send-idempotency contract, remote SMS cancellation, or complete SMS contact-group lifecycle is established here.

Use typed, runtime-validated adapters and fixture/contract tests rather than blindly trusting generated clients.

## Recommended sequence and acceptance tests

1. **Core reliability:** adapter contracts/errors, signing setup/verification, event outbox, sandbox, batch reconciliation and account-pause behavior.
2. **Operational SMS:** balance/health UI, reported-segment analytics, bulk identical/personalised sends and explicit contact-group export.
3. **Optional channels:** WhatsApp, provider OTP and voice; then surveys/USSD/IVR/ticket integration as separate products.

Required tests include current/rotated signatures, stale/future timestamps, duplicate webhook IDs, Unicode/emoji canonicalisation, wrong tenant/account/message, early callbacks, provider 401/402/403, partial batch acceptance/reports, unknown acceptance without replay, local schedule cancellation, sandbox separation, event duplicate prevention, branch/role checks and frontend failure recovery. Exercise 1 and 1,000 report IDs with chunking beyond the cap. Validate adapter fixtures against the supplied examples, then perform an explicitly authorized sandbox/controlled live check. Do not use live patient audiences for integration validation.
