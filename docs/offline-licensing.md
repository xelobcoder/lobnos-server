# Offline signed licensing (backend v1)

## Deployment and environment

No migration or new dependency is required. Build with `pnpm.cmd build` before using the
runtime CLI. **Do not enable signed mode in a real deployment until the public key,
external storage permissions, activation workflow and existing DB renewal are ready.**
The frontend/desktop UX is owned by the parent project, not this backend.

**Staging/release prerequisite:** previously built `.desktop-runtime` directories and
already-installed desktop releases predate `dist/src/scripts/license.js` and cannot perform
offline request/activation. Do not overwrite or silently mutate an installed customer
release. Build the backend (`pnpm.cmd build`), verify the compiled CLI exists, then create
and stage a new desktop release containing that `dist` output. Existing installations need
the normal explicit desktop release/update procedure before file-based activation is
available. No signing certificate is provisioned by a build; the issuer must create one per
installation from its activation request.

### One-command signed Windows installer build

From the backend checkout, with the sibling `..\lobnos` desktop checkout present:

```powershell
pnpm.cmd run desktop:build:licensed
```

The script creates/reuses `LOCALAPPDATA\PLS-Licensing\issuer\issuer-private.pem` and
`issuer-public.pem`, writes an external generic config from the reviewed
`lobnos\desktop\config\generic-backend.env.example` template, compiles the backend,
then runs `pnpm run desktop:dist:win` in the desktop
checkout. The private key is restricted to the current Windows SID and local
Administrators before key creation, and re-restricted on reuse. ACL setup failure is fatal.
To select another absolute external key directory, set `PLS_ISSUER_KEY_DIR`; it may not be
inside either checkout. Protect and back up this key independently: an incomplete, corrupt,
or mismatched keypair causes a hard failure and is never silently replaced. Key creation
and config preparation without compilation/package generation can be checked with:

```powershell
pnpm.cmd run desktop:build:licensed -- --prepare-only
```

The default is **GENERIC standalone**, with `PLS_DESKTOP_GENERIC=true`. It pins only
signed mode, the public issuer key and a salted scrypt installation-password verifier;
no tenant lookup or backend `.env` is needed. The first build requires a masked terminal
prompt to create the external verifier. Administrators may configure it explicitly first:

```powershell
pnpm.cmd run desktop:configure-install-password
```

The command saves `installation-verifier.json` (scrypt) and
`installer-verifier.json` (PBKDF2) alongside the external issuer keys, never the plaintext password.
Windows identity and ACL setup use native System32 utilities rather than `PATH`,
including when launched from Git Bash. Use PowerShell if masked input is unavailable.
There is no password CLI/environment option. Later builds reuse the verifier without a prompt.
Missing/malformed verifier configuration blocks a real generic release. Use a new strong
password, not any example or previously exposed password.
It packages no database/API/email secrets, tenant binding, certificate or state. Store
the resulting installer and distribute the same file to any client. Staging verification
rejects settings outside the reviewed allowlist and historical frontend token settings.
Existing installed userData and source environment files remain untouched. Issuer keys and
local request/certificate temporaries are not copied into the runtime/installer. The built
installer enforces signed licensing for future installs, but does not ship a certificate
for the build machine or activate all installations.

First launch opens a sandboxed local setup window before backend launch. Installation
authorization is verified first, before disk writes or database access. Enter only the
organization name, installation password and temporary **local MySQL 8.x administrator**
host/port/user/password. There is no universal MySQL password. Database names, application
account and tenant identity are hidden/generated. Setup creates `Primelabsys` and
`primelabmaster_control`, installs the complete reviewed baseline, runs guarded migrations,
reference seeds and runtime bootstrappers, then verifies readiness. Existing unowned
databases/accounts are refused, never adopted or overwritten. MySQL itself must already
be installed and running. See [standalone provisioning](standalone-installation.md) for
the pipeline, privileges, failure/retry behavior and release prerequisites.

The launcher enforces `PLS_DESKTOP_STANDALONE=true` and `MULTI_TENANT=false` for the
generic desktop, overriding conflicting user environment values. Desktop login looks up only
the local configured database identity; startup validates and bootstraps only that identity,
without tenant-wide registry migration/enumeration. Cloud/multi-tenant deployments do not
use the desktop override. Signed licensing remains bound to the local numeric identity as
well as installation key and device; a caller-supplied tenant query cannot select or borrow
another tenant's certificate.

Settings are saved atomically using Electron `safeStorage` in
`app.getPath("userData")/config/installation.json`. Generated recovery credentials are
protected similarly in `provisioning.json` **before** the first database write. Windows
ACLs restrict these files/directories to the current OS account and SYSTEM. Setup refuses
unencrypted fallback storage. Neither supplied password is saved or logged. Legacy JSON
setup remains readable and is migrated to encrypted storage; source/per-user environment
files and license state are not rewritten. IPC accepts only the local setup main frame and
exact file URL. The initial administrator login is shown only in a native dialog.
**Settings > Database setup** can verify/retry the owned installation with confirmation
before restart; it cannot replace an existing legacy installation. Mode/public key remain
package-pinned. Setup does not issue, activate or extend a signed license.

`PLS_DESKTOP_GENERIC` accepts only `true` or `false`. To intentionally retain a
facility-pinned environment build, use
`--facility-specific --tenant-id <ACTUAL_REGISTERED_TENANT_ID>` (or explicitly set
`PLS_DESKTOP_GENERIC=false`). Only that compatibility mode resolves tenant from the
explicit options/environment or a unique backend database registry match; it preserves
unrelated facility env values, which must be reviewed for distribution.

### Customer request signing

Each standalone signed desktop automatically creates its own activation request in
`app.getPath("userData")/config/PLS-activation-request.json` on first launch. On Windows,
the default folder is `%APPDATA%\Prime Laboratory System\config`. Transfer that request
to the licensing administrator through the organization's approved offline path.
After `pnpm.cmd build`, sign the request interactively. Place the request in the backend
project directory with the default name `PLS-activation-request.json`, then run:

```powershell
pnpm.cmd run license:sign-request
```

Enter a duration such as `14 days` or `3 weeks` when prompted. The start is set to
midnight at the beginning of the current UTC day, and the end is the final millisecond
of the requested duration. The certificate is saved beside the request under a unique
name and existing files are never overwritten. If the default request file is absent,
the command prompts for its path. The issuer key is read from the default external
`LOCALAPPDATA\PLS-Licensing\issuer` directory or `PLS_ISSUER_KEY_DIR`.

For automation or non-interactive use, provide a request and duration explicitly:

```powershell
pnpm.cmd run license:sign-request -- `
  --request .\PLS-activation-request.json `
  --weeks 3 `
  --grace-days 0
```

Use `--days <number>` instead of `--weeks <number>` for a day count. Optional
`--output <path>` chooses the certificate location, `--private-key <path>` selects
the issuer key, and `--grace-days <0-365>` sets the signed grace period. The default
grace period is zero.

Use the approved existing license validity window for these signed dates, or explicitly
approved terms; signed validity does not renew or extend the `prime_window_access` database
window. Choose a duration that fits within the approved terms and that database window.
Transfer the resulting certificate back to the same installation. Place it in the
per-user config folder as `PLS-signed-certificate.json`, then restart PLS. The desktop
verifies and imports the signed file and removes it only after successful activation.
The request and certificate are bound to the
requesting tenant, installation identity, and device, so another customer machine needs a
separate request and certificate.

The desktop does not display License or Settings menus. A certificate's JSON fields,
including its validity dates, are readable; this is intentional and is not what protects
them. The Ed25519 signature is verified when activation occurs and whenever signed
license status is checked. Editing a payload date or any other signed field makes the
signature invalid. Hiding menus and keeping a certificate's dates out of view are not
security boundaries; do not rely on obfuscation instead of signature verification.

`--activate-local` is rejected for generic builds. It is an opt-in facility-specific
build-machine convenience only (`--facility-specific`). It requires
`--local-storage-dir` (the exact external `app.getPath("userData")/licensing` directory)
plus explicit `--starts-at` and `--ends-at` terms. It stores activation in that local
userData directory and never copies its certificate into the installer. Do not include this
option in a normal customer release build.

| Variable | Contract |
| --- | --- |
| `PLS_LICENSE_MODE` | Unset/empty or `legacy`: existing behavior. Exactly `signed`: enable signed enforcement. Other values fail closed. |
| `PLS_LICENSE_STORAGE_DIR` | Required for signed mode and activation requests; absolute external directory. Desktop: `app.getPath('userData')/licensing`. No checkout/distribution paths or symlink/junction aliases. |
| `PLS_LICENSE_PUBLIC_KEY` | Literal Ed25519 SPKI `-----BEGIN PUBLIC KEY-----` PEM. Dotenv double-quoted `\n` expands to actual newlines; raw literal backslash-n strings are not accepted. |
| `PLS_LICENSE_PUBLIC_KEY_FILE` | Alternative public-only PEM file. Configure **exactly one** of the two public-key sources. Never supply a private PEM. |
| `PLS_LICENSE_TENANT_ID` | Desktop selector for CLI `--tenant-id`. Not read as a server tenant-routing override. Use the actual organization ID (`DEFAULT_TENANT_ID` in single-tenant mode). |

The CLI does **not** load `.env`, connect to MySQL/Redis, or start application bootstrap.
Its caller supplies the environment (Electron main process may use Electron's Node
runtime and a vendor module resolver). For a source checkout/staged backend directory, set
the child process `cwd`/`backendDirectory` to the backend repository root and
`NODE_PATH=<backendDirectory>/node_modules`; do not set `PLS_VENDOR_PATH` for this CLI.
Its current runtime modules use Node builtins and relative compiled imports; the repository
`node_modules` resolver is sufficient. Staff authentication retains existing cookie/header,
JWT expiration and live-session checks. No HTTP recovery secret is implemented: local CLI
recovery is simpler and avoids anonymous activation writes.

All runtime processes and operators must use the same storage directory and issuer public
key. On Windows, install a restrictive directory ACL for the service account/desktop user
and local administrators; POSIX creation modes are directory `0700`, files `0600`.
Node permission modes do not establish Windows ACLs. No DPAPI/TPM protection is claimed.
Do not expose the licensing directory through HTTP/static serving or include it in software
distributions. Public keys and request hashes are not secrets, but are identifying metadata.

For signed desktop distributions, the parent launcher should pin mode and trusted public key
from its packaged configuration so a writable user-data env file cannot downgrade licensing
or substitute an issuer. Standalone deployments trust their operator-controlled environment;
a local administrator can deliberately select legacy mode. A patched executable remains
outside what offline application checks can prevent.

## Runtime CLI (customer-side, public verifier only)

```text
node dist/src/scripts/license.js request --tenant-id 3 --output <new-request.json>
node dist/src/scripts/license.js status --tenant-id 3
node dist/src/scripts/license.js activate --file <signed-certificate.json> --tenant-id 3
```

Arguments are strict; tenant ID must be a positive safe integer. Output files are exclusive:
`request` refuses to overwrite an existing file or export inside the licensing storage directory
(which could corrupt state or create a stale lock). Parent native dialogs must handle overwrite
confirmation by choosing a new filename or explicitly removing the old export beforehand.
`request` creates/persists installation identity if absent, but has no DB side effects.
Requests contain:

```text
version: 1
tenantId: number
installationId: 32 lowercase hex characters
installationPublicKey: SPKI PEM public identity
installationPublicKeyFingerprint: SHA-256 of identity public key SPKI DER, 64 lowercase hex
deviceFingerprint: SHA-256 device binding, 64 lowercase hex
```

The installation key is only a random public identity; its unused private half is discarded,
never persisted, never an issuer key, and not proof of possession. No issuer private key is
generated by the customer CLI. Device binding is described below.

CLI stdout is a single JSON success result. Errors are sanitized JSON on stderr and exit 1.
`status` is a diagnostic command: exit 0 with `signedValid:false` is possible and **must not**
be interpreted as an active license. Status result includes `existingWindowValidation:
"not_checked"` and `operationalValid:null` because the CLI deliberately has no DB access.

Activation writes a validated certificate only, using a lock and atomic state-file rename.
Tampering, wrong bindings, invalid inputs, wrong keys, rollback and certificates past their
signed grace end are rejected before replacement. Future-dated certificates may be installed;
they remain `not_started` until their start timestamp. A replacement preserves clock history
and other tenants' certificates.

**Activation is not DB renewal or operational authorization.** Success includes:

```json
{
  "status": "success",
  "message": "Signed certificate installed. Existing validity/grace window remains authoritative and may require separate administrator renewal.",
  "result": { "existingWindowValidation": "not_checked", "operationalValid": null }
}
```

If the DB window has expired, an administrator must also use the existing license renewal
flow. No cross-filesystem/MySQL transaction is claimed. Signed expiry remains an upper bound
even if somebody extends DB dates.

## HTTP contract and recovery

New routes are registered before subscription-standing middleware and before generic
security routers. All require explicit `?tenantId=ID`, a valid live staff session and the
live `admin`/`super-admin` role. They do not trust `employeeid` supplied in body/query or a
token role without DB lookup. Session tenant mismatch, closed/replaced sessions and expired
tokens remain rejected. Single-tenant recovery rejects IDs other than `DEFAULT_TENANT_ID`.
Subscription standing is intentionally bypassed **only** for these recovery routes, not
authentication. If DB/session authentication is unavailable, use the local CLI.

* `GET /api/v1/security/license/status?tenantId=ID`
  * `{status:"success", statusCode:200, result:{mode,state,signedValid,reason?,
    licenseId?,startsAt?,endsAt?,graceDays?,existingWindowValid,operationalValid}}`
  * `operationalValid = existingWindowValid && (mode === "legacy" || signedValid)`.
  * Existing-window query errors return sanitized 503, not a fabricated validity result.
* `GET /api/v1/security/license/request?tenantId=ID`
  * `{status:"success",statusCode:200,result:<activation request>}`.
* `POST /api/v1/security/license/activate?tenantId=ID`
  * Body **exactly** `{ "certificate": { "payload": ..., "signature": ... } }`.
  * Success 200 has the same renewal warning as CLI, with
    `result:{existingWindowValidation:"not_checked"}`. No token, secret or key is returned.

New-route errors use `customError`: `{status:"error",statusCode,message:<reason code>}`.
Invalid inputs are 400; authorization/license rejection 401/403; unavailable configuration,
state or services 503. Existing authentication response conventions are retained.
No arbitrary remote unauthenticated activation is permitted.

Existing `/api/v1/security/license/add`, `/revoke/:id`, `/check`, `/data` contracts remain.
In signed mode their security router requires a live authenticated administrator, and
renewal/revoke APIs are licensing-gate exceptions. Existing tenant-standing requirements
still apply to these legacy routes. In legacy mode their previous behavior is unchanged.

### Status states and stable reason codes

States: `legacy`, `missing`, `active`, `grace`, `not_started`, `expired`, `invalid`.
`signedValid` is `null` in legacy mode, otherwise boolean. Diagnostic status never exposes
the certificate, issuer key, raw device ID, licensed features, or unenforced count limits.

Reasons:

* `LICENSE_MISSING`, `LICENSE_NOT_STARTED`, `LICENSE_EXPIRED`
* `LICENSE_SIGNATURE_INVALID`, `LICENSE_INSTALLATION_MISMATCH`,
  `LICENSE_DEVICE_MISMATCH`, `LICENSE_TENANT_MISMATCH`
* `LICENSE_CERTIFICATE_INVALID`, `LICENSE_INVALID_TENANT`
* `LICENSE_MODE_INVALID`, `LICENSE_SIGNED_MODE_REQUIRED`
* `LICENSE_PUBLIC_KEY_REQUIRED`, `LICENSE_PUBLIC_KEY_INVALID`
* `LICENSE_STORAGE_DIR_REQUIRED`, `LICENSE_STORAGE_INSIDE_RUNTIME`,
  `LICENSE_STORAGE_LINK_NOT_ALLOWED`, `LICENSE_STORAGE_BUSY`, `LICENSE_STORAGE_FAILED`,
  `LICENSE_STATE_INVALID`
* `LICENSE_DEVICE_UNAVAILABLE`, `LICENSE_CLOCK_INVALID`, `LICENSE_CLOCK_ROLLBACK`
* HTTP/operational: `LICENSE_EXISTING_WINDOW_INVALID`,
  `LICENSE_EXISTING_WINDOW_UNAVAILABLE`, `LICENSE_VALIDATION_UNAVAILABLE`, `LICENSE_INVALID`
* CLI: `LICENSE_CLI_ARGUMENTS_INVALID`, `LICENSE_CLI_OUTPUT_IN_STORAGE`, `LICENSE_CLI_IO_FAILED`

Absent `reason` means no signed failure; HTTP may instead supply
`LICENSE_EXISTING_WINDOW_INVALID`. Invalid licenses are explicitly reported/logged with
sanitized reason codes, not silently treated as legacy licenses.

## Signed certificate/issuer workflow

Issuer tools live at `scripts/licensing/issuer.cjs`, **outside `src`/`dist`**, and are excluded
from all three repository distribution scripts. Run only on a trusted issuer workstation.
No signing private key or sample production certificate is included. Do not place real
private keys inside the repository. Supply file paths out of band; use encrypted storage/ACLs
and a separate secure key-management process.

```text
pnpm.cmd build
node scripts/licensing/issuer.cjs keygen --private-key <secure-external/private.pem> --public-key <public.pem>
node scripts/licensing/issuer.cjs sign --private-key <secure-external/private.pem> --payload <payload.json> --output <certificate.json>
```

Create `payload.json` from the installation's request binding fields plus the approved
license term. For the normal request workflow, avoid hand-writing that JSON and use:

```powershell
node scripts/licensing/issuer.cjs sign-request `
  --private-key <secure-external/private.pem> `
  --request <activation-request.json> `
  --output <certificate.json> `
  --starts-at <UTC_ISO_START> --ends-at <UTC_ISO_END> --grace-days 0
```

The issuer copies the tenant, installation identity, public-key fingerprint and device
binding from the validated request, then combines them with the explicitly approved term.
The signer validates the strict payload and exclusively writes the output. `sign` remains
available for controlled integrations that already construct payloads. Keygen also refuses
overwrite. Transfer only the public key and certificate to the customer.

Certificate envelope is exactly `{payload,signature}` with no extra properties. Payload:

```json
{
  "version": 1,
  "licenseId": "issuer-assigned-id",
  "tenantId": 3,
  "installationId": "<32 lowercase hex>",
  "installationPublicKeyFingerprint": "<64 lowercase hex>",
  "deviceFingerprint": "<64 lowercase hex>",
  "startsAt": "2026-10-01T00:00:00.000Z",
  "endsAt": "2027-10-01T00:00:00.000Z",
  "graceDays": 3
}
```

`licenseId`: 1–128 ASCII letters/digits/underscore/hyphen. Dates are exact UTC ISO timestamps
with milliseconds, calendar-valid and start ≤ end. End is inclusive, grace is inclusive
through `endsAt + graceDays*86400000`; graceDays is an integer 0–365. This is timestamp
semantics, not local date-only interpretation. The DB's current renewed/non-renewed window
logic and local Date behavior are unchanged.

Optional `features` is a unique array of at most 100 strings, each matching
`[a-z][a-z0-9_-]{0,63}`. It is accepted signed metadata only; **v1 does not enforce or expose
feature entitlements**. Existing facility-module authorization still applies independently.
No user-limit or installation-count payload fields are accepted or claimed.

Signature is canonical base64 of the 64-byte Ed25519 signature (88 characters, ending `==`).
Signing input: UTF-8 JSON, no whitespace, fixed field order exactly as the example,
with `features` last if present (array order preserved). There is no BOM/newline in the signing
input. Envelope/payload serialization order otherwise does not matter. No algorithm selector,
private key, issuer URL, SQL or dynamic expression is accepted.

## Enforcement and deliberate continuity exceptions

In signed mode a global middleware runs before **all API routers**, including marketplace,
platform facilities, device interfaces, uploads and caches. Ordinary reads and writes both
require signed validity **and** existing DB validity. HTTP OPTIONS preflight passes through.
Marketplace/public directory control-database operations use the server's control/default
tenant, not a caller-selected license ID, preserving their tenantless query contracts.
Platform facility authority and integrated marketplace core authority enforce licensing
after authenticating and deriving the actual control/linked tenant; the global middleware
defers those specific surfaces to their owning guards. A linked tenant cannot borrow the
control tenant's certificate for integrated clinical/financial operations.
Non-API static assets are not licensing-gated; they must not contain private data/licensing
state. `/billing/receipt` is also gated. Existing auth/resource/module/tenant checks are not
removed. GET endpoints can mutate state, so there is **no blanket GET exception**.

Exact method/path exceptions (case-insensitive matching, no broad prefixes):

* Recovery: GET health `/api/v1/health`, `/api/v1/health/redis`;
  POST staff/patient/clinician login, forgotpassword/verify-reset-otp/resetpassword,
  `/api/v1/logins/logout`; GET `/api/v1/prime/validate-token`,
  `/api/v1/settings/companyprofile/images`; the new license routes and existing
  add/check/data/revoke methods above. In signed mode staff login/token recovery skips
  the old login-only DB gate; operational APIs still intersect both checks. In legacy
  mode that login-only DB gate is unchanged.
* Patient results: **GET only**
  `/api/v1/result/printout/ascension/getResult` and
  `/api/v1/result/printout/ascension/multiple/getResult`.
  In signed mode a live staff session is required; portal patient/clinician sessions are
  not sufficient for these staff APIs. Downstream `employeeid` is set from the authenticated
  staff actor, preserving payment/approval/result-access-window checks without trusting an
  arbitrary administrator ID. Result entry, approval, printing-count mutations, broad
  result lists, preview drafts and analytics are **not** exceptions.
* Backup/export: administrator-only POST
  `/api/v1/security-features/backup/database`; administrator-only GET backup
  `/logs`, `/stats`, `/logs/:id`, `/logs/:id/download`.
  Backup creation writes maintenance metadata but does not change clinical/business data.
  Downloads provide explicit safe export continuity. Deletion, decryption, key rotation,
  security-settings changes and schedule mutations are **not** exceptions.

Backup scheduler `src/scripts/backup-scheduler.ts` and local administrative export
`scripts/export-database.ts` remain ungated so expiry cannot trap patient data or stop
scheduled preservation. Their existing OS/DB permissions remain authoritative.

Email dispatch `EmailQueueService.processQueue` and `processSingle` check operational validity
before processing or mutating a queue job, so the standalone worker cannot bypass the API
gate. Existing email-module activation checks remain. Blocked jobs stay queued without
consuming retries.

Accounting **already-committed** outbox reconciliation is deliberately exempt: preventing
completion could leave billing and books inconsistent across expiry. New financial operations
are gated at the API; the disabled BullMQ accounting worker remains disabled, and the durable
existing outbox sweep completes prior committed obligations. Database bootstrap/schema
maintenance and optional Redis startup are not business-license entrypoints. No new
background producers are introduced.

## Device binding, clock, storage recovery and limits

Windows binding hashes a specific `reg.exe query
HKLM\SOFTWARE\Microsoft\Cryptography /v MachineGuid /reg:64` result with a v1 domain
separator and platform. Linux binding hashes `/etc/machine-id` with the same scheme.
No raw OS identifier is persisted, returned or logged. Unsupported platforms/unavailable
device identity fail closed rather than silently using a portable hostname/random fallback.
Copying the licensing state to a machine with a **different** fingerprint fails.

This is **not piracy-proof**. VM/OS images may clone machine identifiers. A privileged operator
can spoof hardware identity, restore a complete filesystem snapshot, change trusted config,
or patch the runtime. Installation IDs/public identities alone do not prevent cloning.
Reinstallation/device replacement needs a fresh request and issuer certificate.

Clock rollback detection is **best effort, not absolute**: `lastSeenAt` is the greatest local
time observed on signed status/activation/operational checks; more than five minutes backwards
is rejected. Signed dates use the observed high-water time, so smaller backward adjustments
do not extend expiry. There is no hidden DB-derived baseline and no network-time dependency.
Activation does not erase clock history. Correct an accidentally advanced OS clock with an
operator-reviewed recovery plan; do not silently erase state as a normal renewal action.
Snapshots and administrator tampering can defeat local rollback detection.

`license-state.json` holds identity, clock observation and tenant-keyed certificates in one
atomically replaced file. `license.lock` serializes backend/CLI/workers; a process crash can
leave a lock. Stop all users of this directory and confirm no live operation before removing
only a stale lock. Malformed state is reported, not auto-reset. Do not delete the state to
repair a certificate: a new identity invalidates previously issued bindings. Maintain a
secure backup and restore only to the same installation/device with a reviewed clock state.
Atomic rename/fsync offers best-effort local durability, not an OS power-loss guarantee.

Offline scope excludes online licensing, global activation/install-count limits, remote
revocation, trusted time, TPM attestation and cross-machine anti-cloning guarantees.

## Verification

```text
pnpm.cmd build
pnpm.cmd exec vitest run src/licensing
```

Tests cover strict payloads/keys, signature tampering, installation/tenant/device binding,
different-machine clones, expiry/grace boundaries, rollback, legacy behavior, atomic rejection
and real JWT/session/role wiring for HTTP protection. DB behavior is mocked; no production
DB, `.env`, patient records, signing key or external service is used.
