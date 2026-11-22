# Platform facility onboarding (backend)

## Empty local database bootstrap

At startup, the registry checks the configured local database. If it has no
tables and is eligible for onboarding, an unregistered database is assigned a
new tenant identity and held in `provisioning` while the exported facility
schema and allowlisted reference data are initialized. The tenant becomes
`active` only after the required application bootstrappers complete. A marker
table makes schema/reference initialization resumable after an interrupted
startup; a non-empty database without that marker is not modified.

Existing tenant identities are preserved. Deleted, suspended, and archived
registrations are not automatically reactivated. This process does not create
a staff account or publish a default password; use the platform's master
administration workflow for access.

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

Login-username reconciliation supports legacy tenant tables whose column
collations differ from the connection default (for example,
`utf8mb4_general_ci` versus `utf8mb4_unicode_ci`). Canonical login IDs are
compared as binary strings; historical username copies explicitly use a shared
UTF-8 collation. No database-wide collation conversion or password reset is
required.

## HTTP contract

### Tenant medical device administration

In the PLS frontend, open **Platform Administration > Medical Device Interfacing**
(`/settings/facilities/devices`) and select a facility. The page reuses the existing
medical-device settings editor, but targets the selected facility rather than
the control tenant. It supports listing, adding, editing, activating/deactivating,
and deleting analyzer definitions.

All endpoints require `requirePlatformFacilityAuthority`: a live, active
super-admin session from the default/control tenant in multi-tenant mode.
The optional `tenantId` query continues to identify the authenticated control
tenant; **the URL path selects the facility being managed**:

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/v1/platform/facilities/:tenantId/medical-devices` | Device array |
| POST | `/api/v1/platform/facilities/:tenantId/medical-devices` | `{id}` |
| PUT | `/api/v1/platform/facilities/:tenantId/medical-devices/:id` | `{id}` |
| DELETE | `/api/v1/platform/facilities/:tenantId/medical-devices/:id` | `{deleted}` |

Responses use `{status:"success",result:...}`. Writes accept `name`, `ip`,
`dial_port`, optional `listen_port`, `connection_mode` (`pull`, `feed`, `hybrid`,
`server`), `use_tls` and `active` (booleans or 0/1), optional `testid`
(comma-separated positive IDs or an array), `last_known_ip`, and `device_info`.
The name, IP, dial port, mode, and flags are required. Test IDs refer to the
selected tenant's test panels. The route ID is authoritative for updates;
caller-supplied tenant or staff identity fields are not accepted.

The facility must exist, not be deleted, and be active or suspended. Device
definitions use its existing `medicalinterfacingdevices` table. Missing devices
return 404. Successful mutations add `medical_device_created`,
`medical_device_updated`, or `medical_device_deleted` events to the platform
facility audit stream with the verified platform actor and target tenant.

Configuration does not enable device interfacing, change the tenant's license,
or bypass operational access checks. Device Manager discovers the same
tenant-local definitions through its authenticated device API.

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

### Tenant deletion and failed provisioning cleanup

`DELETE /api/v1/platform/facilities/:tenantId` requires the same platform
super-admin authority and `{confirmation: "<exact organization identifier>",
reason: "<3–500 characters>"}`. For a facility whose registry status is `failed`,
it releases cached tenant connections, permanently drops the partial database
with `DROP DATABASE IF EXISTS`, and removes the registry record so provisioning
can start fresh with the same company email. Cleanup requires multi-tenant mode,
the exact generated database name, and a database distinct from the control and
local application databases. Failed marketplace application links are cleared in
the same registry transaction; the application remains `provision_failed` and its
retry endpoint can start a fresh reservation.

For all other deletable statuses, only the registry record is removed and the
database is preserved. All deletions preserve subscription/payment/facility audit
records and write a `tenant_deleted` audit event in the deletion transaction, with
`details.databasePreserved` indicating whether the database was kept. The response
includes `{tenantId,organizationIdentifier,deleted:true,databasePreserved}`. Legacy
registry-linked migration/provisioning records follow their existing FK cascades.
The platform-home tenant and tenants still provisioning cannot be deleted.
For an interrupted attempt that still shows `provisioning`, use **Recover
interrupted setup** in the facility directory. It requires the exact organization
identifier and a reason. The authenticated endpoint is
`POST /api/v1/platform/facilities/:tenantId/recover-provisioning` with
`{confirmation, reason}`. It marks the reservation `failed` without dropping data,
records a `provisioning_recovered` management audit event, and returns
`{tenantId, organizationIdentifier, status:"failed", databasePreserved:true}`.
The same row then offers **Retry provisioning** or **Delete tenant**.

Provisioning, retry, recovery and failed-database cleanup share a per-tenant MySQL
advisory lock held by the dedicated DDL connection. Recovery returns 409 while
a worker holds that lock, regardless of elapsed time; old rows are never treated
as failed just because a timeout elapsed. Recovery/rebuild/partial-database deletion
also reject a reservation with `provisioned_at` set, an unexpected database name,
or the control/local database. Stop/restart **all** old backend processes when
deploying this change before recovering legacy attempts: older workers do not
participate in the advisory-lock protocol. A dropped worker connection releases
the lock automatically.

The registry startup reconciler adds missing onboarding location, actor and
lifecycle columns to older master databases (including `provisioned_at` and
`updated_by`). Failure recording falls back to a status-only update when an actor
column write fails. Status and audit write failures are logged separately; if
the master remains unavailable, the response explicitly directs the operator to
recovery instead of claiming a successful failure-state update.
The frontend confirmation form warns that deleting a failed facility permanently
deletes its named database and labels the action "Delete database and tenant".
The success message uses the returned `databasePreserved` value, rather than
assuming the database was kept. An open retry form is reset to a fresh attempt
when its failed tenant is deleted. This is distinct from deactivation. Registry caches are
invalidated after commit. Database cleanup errors are returned explicitly and
retain the failed registry reservation. MySQL DDL cannot be rolled back: if a
later registry transaction/commit fails, the failed reservation may remain with
its database already removed. Repeating the confirmed deletion safely handles an
already-missing database. No active or suspended database is dropped.

These endpoints require the PLS staff session, supplied in the
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
  independently refuses control-tenant status changes). status is the
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

The master platform uses a dedicated owner account stored in the control
database. The owner signs in at `/master-platform/login`. The server stores a
hash of the opaque session secret, and the browser receives an HTTP-only cookie.
Master authentication has no tenant staff ID or tenant license dependency.
Staff credentials and developer tenant sessions cannot authorize master APIs.

Opening a facility issues a temporary, tenant-scoped developer session. Tenant
requests verify the live master session and target scope. The developer can
access an expired tenant through this session. The tenant's ordinary staff
continue to use its normal license checks.

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
   Build the backend and initialize the dedicated owner once with
   Run the initialization on each deployment against its own control database. The tenant super-admin signs in through the facility login and lands in the tenant workspace. The platform owner signs in at `/master-platform/login`.

   `pnpm master:init` creates the owner with username `plsmaster` and prompts
   twice for a hidden, policy-compliant password. For non-interactive use,
   provide the password through standard input with
   `pnpm master:init --password-stdin`. To copy an existing active super-admin
   password hash during migration, use
   `pnpm master:init --import-staff <tenantId> <employeeId>`.
   The import copies the hash once. Later tenant password or role changes do
   not affect the dedicated account.
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
   **REFERENCES** (the exported tables declare foreign keys, and MySQL 8.0.22+
   checks REFERENCES on every parent table), plus tenant DML and master
   registry/audit DDL/DML permissions. No credentials are accepted from the
   request or returned.

   Windows installs usually connect as `root`, which already holds every
   privilege. Linux servers normally use a dedicated account (root uses
   `auth_socket`), and those accounts are often created without REFERENCES.
   That makes onboarding fail during `schema_creation` with
   `ER_TABLEACCESS_DENIED_ERROR: REFERENCES privilege missing`. Grant it on the
   tenant database pattern, not globally. Use the account and host returned by
   `SELECT CURRENT_USER()` when logged in with the backend's `.env` credentials.
   Checking grants from `sudo mysql` shows `root@localhost`, which is a different
   account from the one the backend uses:

   ```sql
   GRANT CREATE, ALTER, DROP, INDEX, REFERENCES, TRIGGER, CREATE ROUTINE, ALTER ROUTINE,
         EXECUTE, SELECT, INSERT, UPDATE, DELETE, LOCK TABLES, CREATE TEMPORARY TABLES
      ON `pls\_%`.* TO 'pls_app'@'%';
   SHOW GRANTS FOR 'pls_app'@'%';
   ```

   If binary logging is on, installing the exported triggers and routines also
   requires `log_bin_trust_function_creators = 1` for a non-SUPER provisioning
   account. A database administrator must review this server-wide setting; the
   backend does not change it. Master registries created by older bootstraps lacked
   `prime_tenants.updated_by`/`deleted_by`, which failed activation with
   `ER_BAD_FIELD_ERROR` and left the facility in `provisioning`. The registry now adds
   them at startup; use **Recover interrupted setup** for any such facility still
   marked `provisioning`. Then use **Retry provisioning**: it drops the
   retained failed database and rebuilds it.
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
  If the company profile is empty, startup creates the required profile row from
  the active tenant registry metadata, leaving address and street blank for later editing.
  An active default branch (ID 1) is created from the company profile when the
  branch table is empty; any existing branch rows are preserved.
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

### Legacy license expiry

`GET /api/v1/platform/facilities/license-windows` returns `{mode, facilities}`.
The facilities list includes every active or suspended tenant, including the
default/control tenant, with `{tenantId, status, expiresAt}`. Status is `missing`,
`active`, `expired`, `inactive`, or `unavailable`.

`PUT /api/v1/platform/facilities/:tenantId/license-window` accepts
`{endDate: "YYYY-MM-DD", reason}`. In legacy-license mode, the platform admin can
change the expiry of any active or suspended tenant, including the control
tenant. The expiry must be in the future and within ten years; the change is
audited with its previous and new expiry. This changes the legacy license window,
not the subscription schedule or facility status. Signed-license mode returns
409 and requires a renewed signed certificate instead.

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

## Recovering a runtime bootstrap failure

MySQL rejects identifiers longer than 64 characters. The accounting bootstrap
previously generated a 67-character unique index name for recurring expense
occurrences. The updated bootstrap uses explicit names and restores missing
unique keys on partially created MySQL tables. Existing equivalent unique keys
are retained. If duplicate occurrence rows prevent restoring a key, bootstrap
reports the database error and preserves the rows for review.

For a facility such as NRNT13 in Failed status, deploy and restart the updated
backend, then open **Platform Administration → Provisioning → Retry
provisioning** for the existing facility. Expand **Provisioning history** for
the most recent failed stage and any recorded driver code. Older entries may
have only the stage. Retry rebuilds the partial tenant database using the
existing reservation. Confirm the facility reaches Active, then check the
administrator login and the expected branch. Use the separately confirmed
deletion workflow only when abandoning the facility.

## Master platform coverage and remaining work

The platform provides a tenant registry with provisioning, interrupted-setup
recovery, retry, suspension/reactivation and deletion. It also manages plan
tiers and module entitlements, billing schedules and payment history, website
applications, public profiles, SMS settings, medical device definitions and
facility audit logs. A billing schedule and the effective license window are
stored and enforced through separate workflows today.

| Work item | Dependencies | Acceptance criteria |
| --- | --- | --- |
| Signed-installation license expiry management | Define certificate renewal and its interaction with signed offline licenses | A renewed signed certificate updates effective access without enabling legacy license-window edits. |
| Durable provisioning jobs | Facility reservation, per-facility lock, versioned schema bundles and a durable job store | Duplicate requests resolve to the same job. The admin can reload and see progress. An interrupted worker resumes or exposes a safe retry. Failed stages retain an actionable code and the tenant stays inactive. |
| Fleet readiness and database upgrades | Durable jobs, compatible schema version tracking and deployment metadata | The platform lists each tenant's schema version and last check. A failed upgrade identifies the tenant and stage. Operators can verify a release on a clean facility and a populated upgrade fixture before widening rollout. |
| Backup, restore and retirement | Verified tenant-to-database mapping, backup storage and retention policy | The platform shows backup age and verification status per tenant. A restore can be tested in an isolated database before cutover. Retirement has an auditable retention and deletion workflow. |

## Developer tenant switching

Sign in at `/master-platform/login`. From the master facility list, select
**Open facility** on an active client. To open the protected platform home,
enable **Show protected platform home facility** and select **Open platform
home** on its active row. The facility dashboard shows a **Developer session**
banner with its name and a **Return to master platform** button. After
returning, select another facility using the same master session. The active
workspace is shared across tabs in one browser profile.

The first visit initializes a dedicated password-disabled developer identity in
that tenant. The facility's administrator and staff sessions remain independent.
The configured local tenant may also be opened; single-tenant mode restricts
developer sessions to that active registered local database.
The developer session expires within 30 minutes or when the master session
expires, whichever comes first. Target requests recheck the live master
identity and session. The target identity is scoped to one tenant and cannot
authorize master operations. Return normally closes the tenant session and
restores the master session. The facility audit records entry and exit.

For reverse-proxy deployments, forward the public `Host` (or overwrite `X-Forwarded-Host` with the public host) and set `X-Forwarded-Proto` to the public scheme. The proxy should overwrite client-supplied forwarding headers.
