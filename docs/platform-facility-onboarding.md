# Platform facility onboarding (backend)

## Master-control location bootstrap recovery

Location imports preserve facility region/district IDs and existing platform codes.
Legacy district data can reuse a code within one state (for example, Tano North
and Tano South both use `HT`). Missing districts are imported in ID order; a code
collision receives an alphanumeric ID suffix such as `HTD61`, with a warning in the bootstrap
log. These are platform disambiguators, not corrections to official district codes.
Facility source data and existing organization identifiers are unchanged.

Reference imports and their migration markers commit in one transaction. The
`20261015_reconcile_platform_references` migration also fills missing IDs left by
older interrupted imports, even if the initial bootstrap was marked complete.
After deploying and building the fix, restart normally; no database deletion,
manual migration-marker reset, or `INSERT IGNORE` workaround is needed.

## HTTP contract

### Facility branding

Company logos are stored and read per tenant. A newly provisioned facility does
not inherit another company's logo: upload its image in that facility's company
profile settings after provisioning. Reports, receipts and payroll use scoped
image URLs, alongside the tenant's company profile and address.
Legacy shared branding is restricted to the configured installation tenant.
Confirm `DEFAULT_TENANT_ID` identifies that legacy owner before deployment.
For this installation (`DATABASE=primelabtestmig`), the registered owner is
`DEFAULT_TENANT_ID=990556`; the local configuration sets that explicitly. Deploy
the same setting and restart through the normal service process to load it.
See [company image storage and access](company-images.md) for upload,
compatibility and deployment details.

### Modules, branch support and report address

The provisioning UI requires a company address (also validated server-side).
It writes that address to the main branch and `companyprofile.ADDRESS`, so the
tenant's reports use its own facility address. Optional `street` and `gpsAddress`
are trimmed strings of at most 100 characters; street is stored in
`companyprofile.STREET`, and GPS address in its location metadata.

Provisioning accepts optional `moduleConfiguration`:

```json
{
  "branchMode": "single",
  "currency": "GHS",
  "modules": {
    "pharmacy": { "enabled": false, "monthlyPrice": "0.00" },
    "email": { "enabled": true, "monthlyPrice": "20.00" },
    "sms": { "enabled": false, "monthlyPrice": "0.00" },
    "inventory": { "enabled": true, "monthlyPrice": "50.00" },
    "deviceInterfacing": { "enabled": false, "monthlyPrice": "0.00" }
  }
}
```

All five selections must be present when configuration is supplied. Flags must
be booleans, currency three uppercase letters, prices nonnegative decimal
strings with at most ten integer digits and two decimals. The server calculates
the enabled-module total using integer cents, bounded to DECIMAL(12,2).
Configuration is stored in the new tenant's settings and in master
`facility_module_configuration`. Email/SMS/inventory selections also initialize
their existing application flags. Provider setup is still necessary for delivery.
Explicit facility activation also takes precedence over legacy email flags for
queued notifications, and disabled SMS cannot send automatic event messages.
No existing client is disabled merely because it lacks module configuration.

Both branch modes create exactly one main branch. `multiple` permits subsequent
branch creation; explicit `single` configuration blocks additional branches.
Tenant-scoped module APIs enforce activation. The frontend hides disabled-module
navigation and displays a notice for direct module-page access; platform
super-admin navigation remains complete. Pharmacy activation also permits its
shared inventory functionality.

Subscription reads include `moduleConfiguration` with itemized monthly prices
and `monthlyTotal`. These are **not automatically substituted for an existing
subscription**. The payment page can fill a monthly schedule using that total;
the super admin must save the schedule. Disabled modules do not contribute to the
total. Existing schedule frequencies, recorded payments and access status are
unchanged. Legacy API callers omitting configuration retain their existing seed
defaults; the provisioning UI explicitly sends the selections.

### Temporary test-tenant deletion

`DELETE /api/v1/platform/facilities/:tenantId` requires the same platform
super-admin authority and `{confirmation: "<exact organization identifier>",
reason: "<3–500 characters>"}`. It permanently removes only the registry record,
preserves the tenant database and subscription/payment/facility audit records,
and writes a `tenant_deleted` audit event in the deletion transaction. Legacy
registry-linked migration/provisioning records follow their existing FK cascades.
The platform-home tenant and tenants still provisioning cannot be deleted.
The frontend confirmation form explicitly distinguishes this from deactivation.
Registry caches are invalidated after commit. This is a testing cleanup action,
not a database-drop operation or the existing soft deactivation.

All three endpoints require the PLS staff session, supplied in the
`pls-prime-tenant-session` cookie or the same-named request header. They do not
require an `employeeid` or `tenantId` parameter. If `tenantId` is supplied, it must
be the current registered default/control tenant ID.

* `GET /api/v1/platform/facilities/options`
  returns `{status:"success",result:{countries,states,districts}}`.
  Countries are `{id,country_name}`, states `{id,country_id,state_name}`, districts
  `{id,state_id,district_name}`. All IDs are numbers. Inactive/deleted locations
  and descendants of inactive/deleted parents are excluded.
* `GET /api/v1/platform/facilities`
  returns `{status:"success",result:RegisteredTenant[]}`. Entries include
  `name`, `platformId`, `tenantId`, `status`, `databaseName` and the existing
  registry metadata. The platform-only response also includes `email`, `phone`,
  `countryId`, `stateId`, and `districtId` so a failed reservation can be safely
  prefilled for retry, plus isControlTenant:boolean (display hint only; the server
  independently refuses control-tenant status/subscription changes). status is the
  lowercase registry value (ctive, suspended, provisioning, ailed, ...).
  Failed/provisioning facilities remain visible for diagnosis.
* `POST /api/v1/platform/facilities`
  accepts `companyName,email,phone,address,countryId,stateId,districtId,adminName,
  adminEmail,adminPassword`, plus optional `licenseDays`.
  Location IDs must be JSON numbers (positive integers), all other required fields
  strings. `licenseDays` defaults to 365; supplied values must be integers 1–3650.
  HTTP 200 is returned only after complete initialization:

  ```json
  {
    "status": "success",
    "result": {
      "organizationIdentifier": "NRAM11",
      "tenantId": 123456,
      "databaseName": "pls_nram11_123456",
      "adminUsername": "NRAM11S001"
    }
  }
  ```

  These IDs are examples, not fixed values. Organization IDs use the existing
  location-code sequence convention, tenant IDs are cryptographically random
  unique six-digit integers, and staff usernames use the public organization ID.
  New facility databases use `pls_<lowercase organization identifier>_<tenant ID>`,
  for example `pls_abdee_108660`. The suffix remains a six-digit tenant ID.
  Existing database names and table names are not renamed. Tenant connections
  use the database name stored in the registry.

* `POST /api/v1/platform/facilities/:tenantId/retry`
  accepts the same validated onboarding payload as the initial provisioning
  request. It is available only when the registry status is `failed`. The
  company identity, contact, and location fields must match the failed
  reservation; administrator, address, license, and module values may be
  corrected for the new attempt. The endpoint preserves the organization
  identifier and six-digit tenant ID. Before rebuilding, it releases cached
  tenant connections, verifies the stored database name exactly matches the
  generated facility naming convention, and drops that partial database with
  `DROP DATABASE IF EXISTS`. Concurrent retries and retries of active,
  suspended, or currently provisioning facilities return HTTP 409. A retry
  failure returns the facility to `failed` and records the failed stage.

Errors use existing `customError` shape: `{status:"error",statusCode,message}`.
Invalid input is 400, duplicate company email 409, unavailable configuration 503,
and a reserved facility's bootstrap failure 500. Invalid/expired sessions are
401; insufficient authority is 403, with an explicit control-tenant/super-admin
message. Existing revoked/device-session failures retain their existing codes.

### Tenant-scoped runtime upgrades

Result configuration bootstrap creates/upgrades `resultsettings` and initializes
row `id=1`, including `resultsEntrySettings` required by token verification.
Defaults are a source-controlled snapshot of `primelabtestmig`, with its hotline
removed and source staff approval IDs excluded. Existing populated settings are
preserved; only missing/empty columns are backfilled. Configure qualified
result-approval staff in each facility rather than inheriting another tenant's IDs.
This runs both during provisioning and ordinary application startup.

Every new facility runs the shared `runApplicationBootstrappers(tenantId, true)`
sequence after its exported tables/stored programs and reference seeds are
installed, before administrator/license initialization and activation. This is
the same bootstrap sequence used at application startup, scoped to the new
tenant's registry-resolved database. Adding an upgrade to that shared sequence
also includes it in future provisioning; no separate upgrade list or server
restart is needed to initialize the new tenant. Strict provisioning omits the
legacy demo home-collection order seeds but still creates their tables.

### Legacy ultrasound catalog compatibility

The supplied catalog contains 12 known ultrasound-report placeholders with an
empty `testcreationrules.plan`. Strict MySQL rejects that value with
`WARN_DATA_TRUNCATED`. On import, only those exact rule/test ID pairs with the
original empty field/value/unit configuration are converted to the existing
`ultrasoundFields` type. This conversion is logged; other field types and
unrecognized invalid rows are not changed. Strict SQL mode remains enabled.

Provisioning failures log the stage, organization identifier, tenant ID and safe
driver code, without logging submitted credentials or SQL statements. Failed
reservations and their databases remain inactive and intact; this fix does not
automatically activate, delete or resume existing failed facilities.

Subscription-schema reconciliation uses fresh Knex schema builders for every
column inspection and ALTER. It resumes installations where only `is_effective`
was added, adds the missing replacement-history columns, and preserves the
existing plan's effective/replaced state when backfilling.

Accounting and finance bootstrap inspect index definitions before adding or
removing them. Exported indexes are reused rather than producing duplicate-index
errors, and absent legacy indexes are not dropped. Replacement unique indexes
are installed before removing legacy constraints. Wrong index definitions and
unexpected SQL failures still prevent activation; bootstrap query failures log
safe driver codes and facility identifiers without SQL or credentials.

### Request validation for frontend forms

Every required string except the password is trimmed; whitespace-only strings
are rejected. Company/admin email strings are also lowercased and must match the
server's basic `^[^\s@]+@[^\s@]+\.[^\s@]+$` email check.

| Field | Exact limit/default |
| --- | --- |
| `companyName` | Required string; 1–100 characters after trim |
| `adminName` | Required string; 1–100 characters after trim |
| `address` | Required string; 1–200 characters after trim |
| `phone` | Required string; exactly 7–10 ASCII digits after trim, numeric value at most `4294967295`; no `+`, spaces or punctuation |
| `adminPassword` | Required string; at least 12 characters and at most 72 **UTF-8 bytes**; preserved as supplied, not trimmed; no default |
| `licenseDays` | Optional JSON number; defaults to `365` only when omitted; integer `1`–`3650`; `null` and numeric strings rejected |
| `email` | Required company email, at most 100 characters after trim |
| `adminEmail` | Required administrator email, at most 200 characters after trim |
| `countryId`, `stateId`, `districtId` | Required positive safe integer JSON numbers; active location hierarchy must match |

String lengths use JavaScript `.length` (UTF-16 code units), except the password's
upper bound, which uses UTF-8 bytes. No password-complexity regex is imposed.
Names/email/address/phone are additionally checked against the supplied exported
column widths before a facility is reserved.

## Authority boundary

`platform_users` is currently registry metadata, not a PLS authenticated user
directory: it has no password/token login architecture. Therefore these routes
authorize **only** an authenticated, active staff account with the **exact stored
role `super-admin` in `configuration.defaultTenantId`**. The tenant must be active;
JWT signature, expiry, numeric tenant and employee claims, current account email,
live role/activation and current staff session are checked. A token's role is not
authority. Ordinary tenant admins and even super-admins of other tenants cannot
list, read options or provision facilities. Aliases such as `super_admin` and
`superadmin` are deliberately not accepted.

The default tenant ID is resolved by `TenantRegistry.ensureReady()` from this
installation's configured local database, including its existing automatic ID
migration. Sign in again after a tenant-ID migration. The frontend may recognize
role aliases for display, but that must not imply server access.

The router is mounted before the generic query-tenant agreement middleware so
platform requests do not need caller-controlled tenancy parameters. It performs
its own active-control-tenant agreement check and staff session validation.

## Operator setup

1. Enable multi-tenancy (`MULTI_TENANT` must not be `false`).
2. Prepare the existing master/control database, including `prime_tenants`,
   `platform_users`, `platform_countries`, `platform_states`,
   `platform_districts`, and `tenant_code_sequences`. Registry preparation
   continues to own its existing `tenant_number`/`facility_code` upgrades.
3. Set `FACILITY_PROVISIONING_PLATFORM_USER_ID` to an existing **active**,
   nondeleted `platform_users` row with role `system` or `platform_admin`.
   This is a server-configured FK/audit identity, **not** an authorization grant.
   The actual initiating control-tenant employee is separately recorded in each
   lifecycle audit event. No arbitrary first platform user is silently selected.
4. Deploy the authoritative **288 structure files** under
   `db-exports/primelabmaster/tables-structure`: 287 table structures and the
   routines export. These contain 71 triggers and 36 procedures. No live tenant
   database is queried or copied for schema provisioning; there is no
   `FACILITY_REFERENCE_DATABASE` override. The MySQL 8 exports require a
   compatible MySQL 8 server (including `utf8mb4_0900_ai_ci` support).
   Target database identifiers must match `[A-Za-z][A-Za-z0-9_]{0,63}`.
5. Configure `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`,
   `PRIME_WINDOWS_KEY` and existing JWT keys. Provisioning uses the same DB
   credentials/host as `tenantConnections`, including in production. The
   production target host is the DB_* server, not an arbitrary live source tenant.
   The account needs CREATE DATABASE/table/trigger/routine and ALTER permissions,
   plus tenant DML and master registry/audit DDL/DML permissions. No credentials
   are accepted from the request or returned.
6. Deploy `db-exports/primelabmaster/seeds/primelabmaster_*.sql` for the nine
   allowlisted catalog tables alongside the server tree. These assets are required,
   not silently skipped in the compiled server. Compile with `pnpm.cmd build`.

**Packaging warning:** the supplied `tables-structure` directory is git-ignored
in this checkout. `tsc` does not copy SQL assets. Include the supplied structures
and catalog seed dumps explicitly in deployment/distribution; a dist-only package
without them fails preflight and never reserves/activates a facility. The loader
checks the complete 288-file snapshot; changing that snapshot requires a reviewed
update to the expected table/trigger/procedure inventory.

The additive `facility_provisioning_events` table is automatically created in the
master database on first POST (same runtime-schema pattern as existing
bootstrappers). No manual data migration is required for this feature if the
existing master schemas are already installed.

**Automatic:** existing registry preparation resolves/upgrades the local registry
and its internal IDs/codes; this feature creates its audit table, allocates the
public/internal IDs, creates a new tenant database, installs exported structures
and stored programs, seeds reference defaults, runs runtime upgrades, initializes
company/admin/license and activates only after successful completion.
**Operator-required:** install the existing master/control schema and location
data, configure an existing control-tenant exact `super-admin` account, required
env/keys/platform audit identity/DB permissions, and deploy the SQL assets. This
endpoint does not invent a platform identity, grant a super-admin role, install
the master database or repair failed facilities automatically.

### Actual reference seed locations and allowlists

The supplied SQL seed directory is
`db-exports/primelabmaster/seeds` (absolute path in this checkout:
`D:\Primelabsys\PHIMS\primelabsys-current-working-version\lobnos-server\db-exports\primelabmaster\seeds`),
not `db-exports/seeds`. Only these SQL tables/files are loaded:

`samplecontainer`, `sampletype`, `testdetailcategory`, `test_panels`,
`testdetails`, `testcreationrules`, `testconditiondefinitions`, `testconditions`,
`test_report_settings`, from `primelabmaster_<table>.sql`.

Existing TypeScript reference seeds under
`src/cron/command-line-tool-database/Seeds` provide `regions`,
`samplecontainer`, `applicationsettings`, `paymentmodes`, `sampletype`,
`districts`, `registrationsettings`, `shifts` and projected `departments`.
Catalog samplecontainer/sampletype snapshots replace their initial generic seed
rows. Runtime bootstrappers add their existing reference/system defaults. Neither
the legacy employee/default-password seed nor the destructive branch reset nor
demo home-collection transactions are loaded.

The catalog load uses one Knex transaction/connection for FK disable, reverse-order
clears, explicit-column INSERTs and reference-author normalization. FK checks are
restored in `finally` on success or error; this is not an unpinned pooled session
toggle. These are fresh target tables only, never reference/control-tenant data.
Author references are normalized to the future initial admin ID 1, which is
created before activation. The inspected noncatalog reference seeds have no FK
constraints requiring an already-existing staff account.

## Initialization and data safety

* A transaction reserves the registry row in `provisioning` and records `reserved`.
  District-row locking serializes sequence allocation; unique registry indexes
  arbitrate random tenant-ID/facility-code races.
* The database is created with **CREATE DATABASE**, never reused. The supplied
  `tables-structure` exports are parsed with MySQL delimiter/comment handling.
  Only CREATE TABLE/TRIGGER/PROCEDURE/FUNCTION statements are executed. Dump
  DROP/SET commands are ignored; top-level data writes and unsupported commands
  are refused. Source-qualified references are rewritten to the target; external
  database dependencies are refused. Auto-increment counters are reset and old
  DEFINER accounts removed. The authoritative exported triggers/routines are
  installed before current runtime bootstrappers, which retain ownership of their
  financial/timing-trigger upgrades. No live source schema or source data is used.
  Users, passwords, patient data, financial transactions, stock movements and
  queue data are not copied.
* Existing source-controlled reference seeds are allowlisted. The legacy branch
  reset and employee/default-password seeds are never run. The catalog loader
  imports only allowlisted INSERTs, not dump session commands or the unrelated
  malformed DDL appended to one existing dump. Explicit snapshot column lists
  preserve defaults on newer schema columns. Imported configuration author IDs
  are assigned to the initial administrator. Department definitions are reused
  through a projection that never inserts the seed's hardcoded staff names.
* Runtime bootstrappers run in strict mode, including accounting. A suppressed
  query failure is still considered a provisioning failure. Legacy home-collection
  seeds referring to demo order 1 are not run for a new facility.
* Selected locations replace tenant application-setting defaults. Company profile,
  activated initial **tenant admin** (not a platform super-admin), bcrypt password
  hash and encrypted renewed license are written transactionally. The license is
  verified before activation. Staff account ID 1 receives the returned username.
* No default password or PIN is installed. Set a PIN through the existing staff
  settings flow before using PIN-protected financial actions.

The inspected exported triggers/procedures do not write staff/portal credential,
password/PIN, encryption-key or license tables. A regression test rejects those
write targets in the supplied snapshot. Table defaults are not used for the admin
PIN: both `pin` and `pin_hash` are explicitly `NULL`.

After a successful POST, use the returned `adminUsername` and supplied
`adminPassword` with existing `POST /api/v1/prime/login`. Its existing username
resolver selects the active organization, the encrypted renewed license is
already verified, and the active account passes bcrypt validation. No restart,
email verification, default-password reset or PIN is needed for login. This is
verified by implementation tracing and focused tests, not a live provisioning
exercise; database/JWT/session services must remain available.

Current schema limits are intentionally enforced: company name/admin name 100,
company email 100, admin email 200, address 200 characters. Phone must contain
7–10 digits and fit `branch.contact`'s unsigned integer; this also fits
`roles.mobile` (10 characters). International `+` formats require a separate,
explicit schema/API change. Passwords must be at least 12 characters and at most
72 UTF-8 bytes (bcrypt's limit); they are not trimmed.

## Facility status and subscription management

All routes below use the same authority as onboarding (live control-tenant
`super-admin`, verified session). The audit actor is always the authenticated
session's `{tenantId, employeeId}`, never a body value. `:tenantId` is the
six-digit tenant ID (`^[1-9]\d{5}$`). Every success response is
`{status:"success",result}`; errors are `{status:"error",statusCode,message}` with
400 validation, 403 policy (control-tenant self-suspension), 404 unknown/deleted facility or
payment, 409 lifecycle/duplicate/concurrency conflicts, 503 unavailable. A 503 body adds
`code` (`FACILITY_SCHEMA_MISMATCH` | `FACILITY_DATABASE_UNAVAILABLE` | `FACILITY_DATABASE_BUSY` |
`FACILITY_INTERNAL_ERROR`) and `reference` (`FAC-XXXXXXXX`); the same reference, mapped code and
driver error code (e.g. `ER_BAD_FIELD_ERROR`) are in the server log line
`[platformFacilities] FAC-... <METHOD> <route> failed: ...`. SQL text, messages, credentials
and body values are never returned or logged.

### Access status (manual)

`PATCH /api/v1/platform/facilities/:tenantId/status` body
`{status:"active"|"suspended", reason:string}` (reason trimmed, 3–500 chars).

* The control tenant is refused with 403 (no self-suspension or reactivation).
* Only facilities currently `active` or `suspended` can change; `provisioning`,
  `failed` and other states are refused with 409 (they cannot be activated here).
* Same status → `changed:false`, no audit row.
* Result: `{tenantId, organizationIdentifier, previousStatus, status, changed, isControlTenant:false}`.
* The registry row is locked (`SELECT ... FOR UPDATE`) and updated in one master
  transaction with the `facility_management_events` audit row (`status_changed`,
  from/to, reason, actor). Suspending sets `prime_tenants.suspended_at`; activating
  clears it. `updated_by` is not touched (it references `platform_users`).
* Access is **manual only**: overdue periods never suspend or reactivate a facility.

Enforcement on suspended tenants (unchanged paths, verified): new logins are denied by
`resolveLoginTenant` (403 `TENANT_INACTIVE`), and **every** existing-session request is
denied by the global `ValidateTenancyAgreement` (403), which reads registry status.
After a change the in-process registry cache is invalidated. A race was fixed:
a registry refresh that started before the change could previously repopulate the
cache with the stale `active` status for up to 30 s; refreshes now only cache if no
invalidation happened during their read. If the master database is unreachable right
after a change, requests fail closed (503), not open. Status changed by another
process (e.g. a CLI script) is picked up within the 30 s cache TTL.

### Subscription schedule and periods

`GET /api/v1/platform/facilities/:tenantId/subscription[?asOf=YYYY-MM-DD]`

```ts
result: {
  tenantId: number; organizationIdentifier: string; facilityStatus: string;
  isControlTenant: boolean;
  asOf: 'YYYY-MM-DD';                       // default: today (UTC)
  plan: null | { frequency: 'daily'|'weekly'|'monthly'|'yearly'; amount: string; currency: string; startDate: 'YYYY-MM-DD' };
  schedule: Array<{ frequency; amount: string; currency; startDate; endDate: 'YYYY-MM-DD' | null }>;
  window: null | { from; to; label: string; pastPeriods: number; futurePeriods: number; currentPeriodStart: string | null };
  periods: Array<{ periodStart; periodEnd; dueDate; amount: string; currency: string;
                   status: 'paid'|'unpaid'|'overdue';
                   payment: null | { id: number; paidAt; reference: string; notes: string } }>;
  overdueBeforeWindow: number;              // unpaid (all overdue) periods older than window.from
  history: Array<{ id: number; periodStart; periodEnd; amount: string; currency: string; paidAt;
                   reference: string; notes: string; voidedAt: string | null; voidReason: string | null }>;
  historyTruncated: boolean;                // history is the newest 500 payments (incl. voided)
}
```

* Amounts are decimal strings with exactly two decimals (`"150.00"`); stored as
  `DECIMAL(12,2)`, handled as exact integer cents, never fractional floats.
* `plan` is the schedule segment in effect on `asOf` (the first segment if `asOf`
  precedes it). `schedule` lists all effective segments ascending.
* Periods: anchored on the segment `startDate`. Month/year periods are computed from the
  anchor (never chained) and clamp to month end: Jan 31 → Feb 28/29 → Mar 31 → Apr 30;
  yearly Feb 29 → Feb 28 in non-leap years → Feb 29 again in leap years. `periodEnd` is
  inclusive (day before next start). Billing is in advance: `dueDate = periodStart`.
* Status: `paid` if an active (non-voided) payment exists for exactly that
  `periodStart/periodEnd`; otherwise `overdue` if `dueDate < asOf`, else `unpaid` (due
  today is `unpaid`). A paid period shows the payment's snapshot amount/currency.
* Bounded window (no unbounded generation): the current period plus up to N previous and
  M upcoming periods, sized by the current segment's frequency — daily 30/7, weekly 12/4,
  monthly 12/3, yearly 5/1. If `asOf` is before the plan starts, the first M periods are
  returned and `currentPeriodStart` is null. `window.label` describes the bound.
  Older unpaid periods are counted in `overdueBeforeWindow`.
* `history` includes payments from all plan segments, including replaced plans and
  voided payments, so nothing is hidden when the plan changes.

`PUT /api/v1/platform/facilities/:tenantId/subscription` body
`{frequency, amount:string, currency:string, startDate:'YYYY-MM-DD'}` returns
`{changed:boolean, mode:'create'|'append'|'replace'|'unchanged', ...GET result}`.

Plan changes are **effective-dated** and never drop earlier obligations:

* No plan yet → `create`.
* `startDate` **after** the latest segment's start → `append`: a scheduled change. It
  must fall on a period boundary of the preceding segment (else 400 with the next valid
  boundary), so no period is split or prorated. Earlier periods keep their original
  amount and their paid/unpaid/overdue status. The new segment anchors on its own
  `startDate` day (e.g. a change on Nov 30 makes later monthly periods start on the 30th).
* `startDate` **on or before** the latest segment's start → `replace` (correct the latest
  segment). The old row is kept with `is_effective=0` + `replaced_at/by`. It must
  still start after the previous segment's start (earlier segments cannot be rewritten) on
  its boundary. An identical PUT is `unchanged`.
* Refused with 409 if any active payment on/after the new `startDate` would no longer
  match a period exactly (the message lists payment IDs; void them first).
* Allowed for every registered facility **including the default/control tenant** (the
  super-admin bills all facilities); refused for non-`active`/`suspended` facilities (409).
  Recording and voiding payments follow the same rule. Only status changes refuse the
  control tenant (no self-suspension).
* Known limitation: moving the *first* segment's start date later is not a correction
  (it schedules a change); the original early periods remain obligations.

### Payments (per-period full-payment markers)

`POST /api/v1/platform/facilities/:tenantId/payments` body
`{periodStart, paidAt, reference, notes}` returns `{payment: HistoryItem, ...GET result}`.

* A payment marks exactly one whole period paid. It is not cash accounting, does not
  support partial payments, and does not post to the accounting ledger.
* `periodStart` must be the first day of a period in the schedule (400 otherwise),
  at most M periods after today's period (in advance, M as in the window table).
* Amount, currency, `periodEnd`, frequency and plan ID are derived server-side from
  the governing segment and **snapshotted** on the payment; later plan changes do not
  alter them.
* One active payment per exact period: a second one is 409 (application check plus the
  unique index `uq_fspay_tenant_active_period`). Corrections = void, then record again.
* Requires a plan (409 otherwise). Suspended facilities can still be billed and paid.

`DELETE /api/v1/platform/facilities/:tenantId/payments/:paymentId` body `{reason}`
(3–500 chars) voids the payment. The row is kept; `voided_at/by` and `void_reason` are set,
and the period becomes unpaid/overdue again. Already voided → 409; other tenant's or
unknown ID → 404. Returns `{payment: HistoryItem, ...GET result}`.

### Input limits (server-authoritative)

| Field | Rule |
| --- | --- |
| `amount` | JSON **string** `^(0\|[1-9]\d{0,9})(\.\d{1,2})?$`, > 0 (max `9999999999.99`); numbers rejected; returned normalized to 2 decimals |
| `currency` | `^[A-Z]{3}$` (uppercase required, not coerced) |
| `frequency` | `daily`, `weekly`, `monthly`, `yearly` |
| dates (`startDate`, `periodStart`, `paidAt`, `asOf`) | strict `YYYY-MM-DD`, real calendar date, 2000-01-01..2100-12-31 |
| `paidAt` | not after server UTC today + 1 day (tolerance for UTC+ operators) |
| `reference` | trimmed, 1–100 chars, required |
| `notes` | optional string, trimmed, 0–500 chars (defaults to empty) |
| `reason` (status, void) | trimmed, **3**–500 chars, required |

### Master tables (created on first use, same create-if-missing pattern as the audit table)

* `facility_subscription_plans` — append-only plan segments (`is_effective`,
  `replaced_at`, `replaced_by_employee_id`, creator actor).
* `facility_subscription_payments` — snapshot payments; `active_period_key`
  (`start/end`, NULL once voided) uniquely indexed per tenant; void columns.
* `facility_management_events` — audit for `status_changed`, `plan_create|append|replace`,
  `payment_recorded`, `payment_voided` with the actor, reason and JSON details.

**Legacy plan table reconciliation.** An earlier build created `facility_subscription_plans`
with `is_current`, `superseded_at`, `superseded_by_employee_id`. Because the bootstrap only
creates missing tables, every plan query on `is_effective` failed with `ER_BAD_FIELD_ERROR`
(GET subscription ? 503). `ensureSchema` now additively: adds `is_effective` (nullable),
`replaced_at`, `replaced_by_employee_id`; backfills rows with `is_effective IS NULL` from
`is_current`/`superseded_*`; adds `idx_fsp_tenant_effective`; then sets `is_effective` NOT NULL
DEFAULT 1. Resumable after a partial run; legacy columns are kept and no longer used.
It runs on the first facility-management request after the new build is deployed/restarted.

All writes lock the tenant registry row (`FOR UPDATE`), which serializes status, plan and
payment changes for one facility, and run inside a single master transaction.
### Audit trail

`GET /api/v1/platform/facilities/:tenantId/audit?page=1&pageSize=25` (same authority).
Query is strict: only `page` (1?100000) and `pageSize` (1?100, default 25) as plain decimal
strings, plus the middleware-validated `tenantId`; anything else is 400. Unknown/deleted
facility ? 404. Result:

```
{ events: [{ id, source: 'management'|'provisioning', action, createdAt (ISO UTC),
             actorTenantId, actorEmployeeId, reason, fromStatus, toStatus, details }],
  page, pageSize, total }
```

Union of `facility_management_events` and `facility_provisioning_events` for that tenant,
ordered `createdAt DESC, source ASC, id DESC` (`id` is only unique within a `source`).
`total` = sum of both counts. Management `details` = stored JSON plus `planId`/`paymentId`,
with secret-like keys dropped (password/secret/token/hash/credential/connection/?), depth ? 4;
provisioning `details` = `{stage, failed}` and `reason/fromStatus/toStatus` are null.

## Failure and recovery

Lifecycle stages are recorded without passwords, credentials, body values or SQL
errors: `reserved`, `schema_cloned`, `programmable_objects_installed`,
`reference_seeded`, `runtime_bootstrapped`, `initialized`, `active`, or
`failed:<stage>`.

MySQL DDL is nontransactional. A failure marks the registry `failed` and closes its
cached connections. **No database is dropped or broadly cleaned up.** If the master
becomes unavailable, the row can remain `provisioning` (still nonactive); inspect
and reconcile it when the master returns. A server crash can likewise leave a
nonactive reservation. Failed emails/IDs remain reserved; repeating POST is not a
repair/retry endpoint. Diagnose the named organization and audit stage, then have
an operator repair/reconcile the specific facility. There is no automatic recovery
or destructive cleanup route.

POST is synchronous; do not blindly retry after a browser timeout. Check the list
and lifecycle events first. New facilities become addressable through existing
tenant resolution without a restart. Existing scheduled-worker discovery behavior
is unchanged; this feature does not start a second set of background workers.

## Focused validation

```powershell
pnpm.cmd exec vitest run src/models/Tenancy src/middleware/platformFacilityAuthority.test.ts src/controllers/platform
pnpm.cmd build
```

Tests cover authority boundaries, input limits, reference isolation/asset loading,
activation ordering and failure stages, plus status/subscription management (route
authority, control-tenant refusal, lifecycle refusal, calendar boundaries, paid/unpaid/overdue,
duplicates, voids, plan-change history and the registry cache race) using mocked/in-memory databases. These tests are
not a live end-to-end provisioning test against MySQL.
