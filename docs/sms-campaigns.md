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
