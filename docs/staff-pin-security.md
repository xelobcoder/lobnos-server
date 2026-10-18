# Staff authorization PIN security

**Navigation:** Settings → Application Settings → Staff authorization PIN security.

This is the staff four-digit authorization PIN, not a patient portal access code,
password, or OTP. The shared `POST prime/validate-user-pin` flow and financial
day-close authorization use the same per-account counter.

- Administrators (including super administrators) can configure **1–20**
  consecutive incorrect attempts; the default is **5**.
- A correct PIN before exhaustion clears consecutive failures. Malformed PIN
  submissions count as failures too.
- At exhaustion the API returns HTTP **429** using the existing
  `PIN_RATE_LIMITED` financial error code. The shared confirmation endpoint keeps
  its existing `{ status: false, message }` response.
- Lockout persists across time, devices, restarts, and policy increases.
  Shared-IP staff accounts do not lock each other out. A lower limit takes effect
  on the next verification. Changing the policy does not reset counters.
- After the staff member contacts the administrator and their identity is verified
  through the facility's support process, select **Reset attempts**, enter a
  support reference/reason, and confirm. This **does not change or reveal the PIN**.
  Do not enter PINs, passwords, or patient information in reasons.
- The counter/reset is serialized on the staff account row. Failed financial
  actions cannot roll back PIN attempts. Reset and policy writes fail atomically
  if their audit insert fails; verification fails closed if attempt auditing fails.

## Administrator API

All routes require a current staff session, matching `tenantId` query parameter,
and administrator role. Actor and tenant come from authentication, never the body.
Paths below are relative to `/api/v1/applicationsettings/pin-security`:

| Method | Path | Input |
| --- | --- | --- |
| GET | `/` | Current `{ pinAttemptLimit }` policy |
| PUT | `/` | `{ pinAttemptLimit: number, reason: string }` |
| GET | `/staff` | `page=1&count=20` (maximum 100); safe account/counter fields only |
| POST | `/staff/:employeeid/reset` | `{ reason: string }` |

Reasons must contain 3–255 trimmed characters. Reset returns 404 for a missing
staff account and 409 when not exhausted (including a repeated reset).

## Deployment and audit

`20261018_staff_pin_security.ts` is idempotently applied by the existing tenant
application-settings bootstrap. It adds `applicationsettings.pinAttemptLimit`,
`staff_pin_security`, and append-only application audit records in
`staff_pin_security_events`. Existing active per-account failures from the old
15-minute audit window are imported once, when the state table is first created.
The former IP-wide rolling-window rule is deliberately replaced by the persistent
per-account rule.

Existing `financial_authorization_attempts` continue to record verification
outcomes without PIN values/hashes. `staff_pin_security_events` records the
administrator, target, reason, previous count/limit, new limit, and timestamp.
Neither resetting attempts nor saving general application settings alters a PIN.

Restart/rebuild the backend normally to apply tenant bootstrap before using the
new routes. No manual production-data edits are needed. Database-backed migration,
locking, and browser checks still require the deployment's MySQL/runtime environment.
