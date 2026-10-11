# Standalone installation authorization and provisioning (baseline v1)

This flow is for **new generic standalone desktop installations only**. Cloud/facility
clients, multi-tenant onboarding, existing facility-specific configurations and signed
license validation are unchanged. This is not an unauthenticated HTTP setup endpoint:
the trusted Electron main process invokes `dist/src/scripts/standalone-setup.js` over stdin.

## Release administrator prerequisite

### Windows installer authorization

The Windows NSIS installer now checks the installation password in `customInit`,
before entering the install section or copying application files. A masked local
Windows dialog verifies a salted PBKDF2-SHA256 verifier. Cancel, an incorrect
password, an unavailable verifier, or a silent-install attempt aborts installation.
No password is passed on a command line or saved by the installer dialog.

Configure the password once in a real interactive terminal using the command
below. Existing release configurations created before the installer verifier was
introduced must be explicitly reconfigured. Builds reuse the verifier; they do
not invent a new password. The build fails closed without it.

This gate is distinct from the first-launch database setup and signed licensing.
It does not authorize operational use or replace a valid uploaded license.
An administrator able to patch/extract a local installer can bypass an offline
gate; it is not a substitute for cryptographic licensing or publisher signing.

From the backend with sibling `../lobnos` present:

```powershell
pnpm.cmd run desktop:configure-install-password
pnpm.cmd run desktop:build:licensed
```

Choose an installation password of **12 to 256 characters** and enter the same
value at confirmation. A short password is rejected before confirmation without
changing saved verifiers. Errors distinguish password validation from directory
permissions. If Git Bash cannot provide a masked terminal, use a regular
PowerShell terminal; never supply the password as a command-line argument.
Identity lookup and permission setup use native Windows System32 utilities, so
Git Bash utilities on `PATH` do not override them. If a previous attempt failed,
rerun the configuration command and confirm the password again.

The first command requires a real interactive terminal with masked input and confirmation.
It stores **only** a random-salted `scrypt-v1` verifier (N=32768, r=8, p=1, 32-byte output)
in the external issuer directory (`PLS_ISSUER_KEY_DIR`, or
`LOCALAPPDATA/PLS-Licensing/issuer`). It rejects directories inside either repository.
No password argument or environment variable is accepted. Choose a strong new password
of 12–256 characters; never reuse examples, published defaults or an exposed password.
The builder prompts when the external verifier is absent, then reuses it on later builds.
Explicit reconfiguration affects future installers only, not existing packages.

Generic runtime preparation and verification reject a missing/malformed packaged
`PLS_INSTALL_PASSWORD_VERIFIER`. No real verifier was created by automated tests:
test fixtures are **not release configuration**. A deployable installer cannot be made
until the release administrator supplies this configuration. Publisher code-signing
credentials and per-device signed activation remain separate prerequisites.

## Customer inputs and authorization

Setup asks for organization name, installation authorization password, local MySQL
host/port and temporary administrator credentials. Only `127.0.0.1`, `localhost` and
`::1` are allowed. Oracle MySQL 8.x is required by the baseline's collations/routines;
MariaDB/MySQL 5.x are explicitly refused before database creation.

The scrypt comparison is timing-safe; five incorrect attempts block further attempts
for five minutes in the main process. This is an offline installation authorization
check, not signed license activation or tamper-proof DRM. A customer-controlled OS
administrator can modify binaries; a packaged verifier also permits offline guessing.

MySQL must already be installed/running. There is **no universal administrator password**.
The supplied account must be able to create the two local schemas, inspect `mysql.user`,
create a localhost account, grant its schema-local privileges and install schema/routines.
Credentials are sent only through an anonymous child stdin pipe, not argv, config files
or logs. Remote database provisioning is not supported.

## Complete reviewed pipeline

Before connecting, setup validates all 288 structure files: **287 InnoDB tables,
71 triggers and 36 procedures**, object names, schema isolation, FK target closure and
the control catalog's dependency closure. Dump DROP/SET statements and transaction data
are never executed. Definers are removed and source-database references isolated.
All nine catalog assets and the exact 12 current up migrations/reference seed modules
must be present. Packaging copies only structure exports and the allowlisted reference
catalog assets, not transaction/patient exports or development environments.

1. Generate random application password, tenant/organization identity, separate backend/
   frontend JWT keys and window key
   and initial login password. Encrypt a durable recovery checkpoint before MySQL writes.
2. Acquire a server-local named lock. Inspect **both** schema ownership markers and any
   existing generated account before mutating either database.
3. Create `Primelabsys` (Windows MySQL may normalize its spelling to lowercase) and
   `primelabmaster_control`, with installation-bound markers.
4. Create a random `pls_<installation fragment>` localhost account. Grant database-local
   application DML/DDL/routine permissions to the facility schema and SELECT only to
   control. No global grants, FILE, PROCESS, SUPER, CREATE USER or GRANT OPTION are given.
   Existing matching accounts are authenticated with the saved secret, never reset.
5. Install missing baseline tables and programmable objects. Control receives the ten
   catalog/reference tables plus `roles`, needed by catalog-author foreign keys, and
   a local-only active registry row. It does not need cloud location/platform data.
6. Run the reviewed, guarded up migrations with a private Knex migration checkpoint.
   MySQL DDL is not transactional; failures never imply readiness.
7. Seed only an owned, unseeded, empty reference set. Reference data and its seeded marker
   commit together. Create a single facility administrator with bcrypt password hash.
   Control gets a disabled catalog-author row, not a copied staff account.
   No legacy employee/password seed, branch reset, patient data, home-collection demo
   order, legacy validity window, certificate or background sender/worker is created.
8. Run current bootstrappers strictly, observe caught query/error failures, check the
   master catalog and verify actual foreign-key integrity in both schemas. Mark ready
   only when all checks pass. Already-ready installations do not reseed or reset logins.
9. Save encrypted application configuration; show initial login credentials only in
   a native dialog. Signed activation remains mandatory through the existing workflow.

The generated frontend session key is supplied only to the local Next.js process at
runtime, for its existing PLS-SESSION signing/verification. It is not embedded at build
time or returned to a renderer; database/backend credentials are not passed to that process.

New/changed migration sets or incomplete baseline assets require explicit pipeline review;
setup fails with a provisioning-prerequisite error rather than best-effort partial success.
No production database or migration was executed during implementation validation.

## Encryption, compatibility and recovery

`userData/config/installation.json` and `provisioning.json` are version-2 encrypted
envelopes using Electron `safeStorage` (Windows DPAPI). The Windows DACL is replaced,
not merely appended, granting access only to the current SID and SYSTEM. Encryption
unavailable/basic-text fallback or ACL failure blocks setup. Existing plaintext JSON
configuration is read compatibly and rewritten encrypted without changing database
identity. Existing environment files and licensing state are left untouched.

Back up the original OS profile, protected configuration and databases securely.
Encrypted files are OS-account-bound; copying them to a different profile is not a
supported credential-recovery method. DPAPI protects data at rest, not from code running
as the same OS account or a privileged administrator.

After failure, **retain `provisioning.json`** and retry with the original organization and
endpoint. The administrator password may be supplied again; it is never persisted.
The generated application user and database markers must agree. Unowned databases,
duplicate/case-conflicting schemas, foreign accounts, incompatible versions, incomplete
assets, DDL, migration, seed, FK and runtime failures are explicit errors.

DDL can leave incomplete owned schemas. Retry installs missing objects without dropping
existing tables or changing saved passwords. A crash between CREATE DATABASE and its
ownership marker cannot safely be adopted automatically: an administrator must inspect
the orphan and perform an explicitly scoped recovery. Setup does not automatically
drop, overwrite, adopt or migrate unrelated databases. Never delete recovery files or
rename production schemas as a shortcut.

An interrupted Knex migration can also retain its migration lock. It is not force-unlocked
automatically: an administrator must first confirm no provisioning process is running,
inspect the owned migration checkpoint and authorize a scoped recovery.

Legacy setups remain usable but the simplified UI does not edit their generated/account
fields. Restore their original configuration through an administrator if repair is needed.
Reverification of a new owned setup requires confirmation before restart. Initial login
credentials are not reset on retries; change the password after first login.

## Validation

```powershell
pnpm.cmd build
pnpm.cmd exec vitest run src/bootstrap src/models/Tenancy src/models/auth
node --test scripts/licensing/*.test.cjs
node --test ../lobnos/desktop/*.test.cjs
```

Database tests use mocks only. Encryption/ACL tests cover enforcement and failure paths
with mocked encryption; a real packaged Electron/DPAPI + disposable MySQL 8 smoke test
is still required before distribution. It must be explicitly authorized and isolated from
production. Web compilation alone is not installer/runtime or real DB validation.
