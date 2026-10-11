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

Licensed runtime preparation and verification reject a missing/malformed packaged
`PLS_INSTALL_PASSWORD_VERIFIER`. No real verifier was created by automated tests:
test fixtures are **not release configuration**. A deployable installer cannot be made
until the release administrator supplies this configuration. Publisher code-signing
credentials and per-device signed activation remain separate prerequisites.

## Pre-provisioned facility database

The desktop application does **not** create databases, install schema, run migrations,
seed data, create MySQL users, or bootstrap an organization/admin account. A deployment
administrator provisions the client's MySQL database and completes all required migrations
and initial data setup before packaging/running the desktop frontend and backend.

The licensed desktop build is facility-specific. It reads the backend `.env`, resolves the
registered tenant from that database, and writes a desktop runtime configuration. When
`NODE_ENV` is not `production`, the application connection uses `DB_HOST`, `DB_PORT`,
`DB_USERNAME`, `DB_PASSWORD`, and `DATABASE`; in production it uses `PRODUCTION_DB_*`.
The build maps the selected connection to the desktop's production environment and carries
the `SYSTEM_CONFIG_DB_*` / `SYSTEM_CONFIG_DATABASE` settings through separately. For the
current local deployment, the configured facility database is `primelabtestmig` on port
`2309`, using the existing `.env` account. The desktop starts its backend and frontend
against that prepared database; it does not show database-provisioning setup on first run.

Because the installer includes the connection credentials required by the packaged
backend, treat it as a secret and only distribute the facility-specific installer to its
intended client/device. Do not commit `.env` or generated desktop connection configuration.
In particular, avoid distributing a package containing a MySQL root credential beyond
the machine/environment that needs it.

The installation authorization password is only the offline installer gate. It is not a
database credential, does not provision the schema, and does not replace signed-license
activation. Signed activation remains mandatory through the existing workflow.

## Encryption, compatibility and recovery

`userData/config/installation.json`, when present from an older release, remains a
version-2 encrypted envelope using Electron `safeStorage` (Windows DPAPI). The Windows
DACL is replaced, not merely appended, granting access only to the current SID and SYSTEM.
Older provisioning checkpoints are not used by this runtime. Existing environment files
and licensing state are left untouched.

Back up the original OS profile, protected configuration and databases securely.
Encrypted files are OS-account-bound; copying them to a different profile is not a
supported credential-recovery method. DPAPI protects data at rest, not from code running
as the same OS account or a privileged administrator.

If the backend cannot connect, check the packaged/per-user `config/backend.env` against
the prepared MySQL endpoint and database. The application does not repair access by
changing MySQL accounts or grants. Complete schema migrations and registry setup outside
the desktop app, then rebuild or update the facility-specific configuration as needed.
Existing installations keep their per-user config across application upgrades.

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
