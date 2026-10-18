# Prime Laboratory Software (PLS)

**High Performance Laboratory Information Management System**

## Adaptive billing capability

`GET /api/v1/billing/strategies/mode-capability?tenantId=<id>` returns the existing
`{ status: "success", mode: "simple" | "advanced", hasActiveStrategies: boolean }`
contract for the authenticated facility. A mapped non-General strategy or NHIS
strategy must be unexpired and within its validity dates to select advanced mode.
General-only mappings and unmapped non-NHIS templates do not introduce another
billing source. An active mapping with incomplete test pricing remains advanced;
it must not silently become General pricing.

The frontend uses this capability only to simplify navigation and automatically
call the existing `billing/multi/init` endpoint for General-only facilities.
There is no new sale endpoint, source identifier or database migration. Existing
session/debt checks, checkout repricing and transaction persistence still apply.
Capability query failures are errors, not a simple-mode response.

```powershell
pnpm exec vitest run src\models\clincians\billingstrategy.test.ts src\models\billing\SuspendedBillingService.test.ts
```

## Registration prompts, quick referral entry and clinician organizations

**Registration prompt settings.** `applicationsettings` has two facility-level flags,
`homeCollectionPromptEnabled` and `resultDeliveryPromptEnabled`. Both default to
off (migration `20261018_registration_prompt_settings`, also applied at startup).
When no result-delivery preference is sent with a sale, the server records
`hard copy` for every billed test, so delivery data is never left empty.

**Quick add from billing.** These endpoints need only a name; phone and email are
optional (migration `20261018_optional_clinician_phone` makes the clinician phone
nullable):

- `POST /api/v1/organization/quick-add?tenantId=<id>` with `{ name, phone?, email? }`.
  An existing organization with the same name (ignoring case) is returned instead
  of creating a duplicate.
- `POST /api/v1/clinicians/quick-add?tenantId=<id>` with
  `{ name, phone?, email?, organizationId? }`. An existing clinician is matched by
  phone when given, otherwise by name. When `organizationId` is sent, the clinician
  is linked to that organization.

**Clinicians referring from several organizations.** `clinician_organizations`
(migration `20261018_clinician_organizations`) records every organization a
clinician refers from. `clinicianbasicinfo.organization` is still the main
organization and is always listed first.

- `GET /api/v1/clinicians/:clinicianId/organizations?tenantId=<id>` returns
  `{ id, name, primary }` rows.
- `POST /api/v1/clinicians/:clinicianId/organizations?tenantId=<id>` with
  `{ organizationId }` adds a link. Adding an existing link does nothing.
- `DELETE /api/v1/clinicians/:clinicianId/organizations/:organizationId?tenantId=<id>`
  removes a link. The main organization cannot be removed here; change it on the
  clinician profile instead.

Commission rule: when organization commissions are paid on a clinician's
referrals, the recipient is the sale's referral organization if the clinician is
linked to it. Otherwise it is the clinician's main organization, as before. A sale
is never counted twice, because each clinician and organization pair can be
linked only once.

```powershell
pnpm exec vitest run src\models\referral src\models\billing\resultDeliveryDefaults.test.ts
```

## Backup security schema upgrades

Tenant startup and the first backup-security settings read/write run the existing
`20260812_backup_security_settings_password` migration. Legacy installations gain
the missing `encryption_password` and `storage_path` columns without replacing
saved settings. Concurrent requests share schema preparation per database
connection; a failed upgrade is surfaced and may be retried.

```powershell
pnpm exec vitest run src\models\security\database-backup\BackupSecurityBootstrapper.test.ts
```

## Patient portal

Patients sign in at the normal PLS login page (patient mode) and are confined to
`/api/v1/patient-portal/*`. Portal tables are created on first use by
`bootstrapPatientPortal`, so no manual migration step is required.

- **Secure defaults:** the portal and self-registration are **off**. Staff invitations,
  billing and email notifications are on. Results need payment, and appointment
  requests are off. Admins and managers change these in
  *Application Settings › Patient Portal*.
- **Activation:**
  - **Staff invitation:** single-use, valid for 72 hours by default (1–720), revocable.
  - **Self-registration:** facility code, patient ID, date of birth, registered email,
    then a 10-minute emailed code. Responses never reveal whether a patient matched.
- **Release gate:** a result is shown only when result entry is complete, minimum
  verification is met, payment rules pass and, under the `manual` policy, staff have
  released it. A withdrawal always hides it.
- **Sessions:** five failed sign-ins lock the account for 15 minutes. Disabling access,
  logging out or changing the password ends every session for that patient. Public
  endpoints allow 10 requests per 15 minutes.
- **Audit:** sign-ins, result and billing views, release decisions, invitations,
  appointment requests and settings changes are written to the portal audit log.
- **Invitation links:** built from `PATIENT_PORTAL_URL`, falling back to `FRONTEND_URL`
  (`http://localhost:2377` in development).
- **Rollback:** turn off **Enable patient portal**. Patient sessions are rejected
  immediately and staff workflows are unaffected.

```powershell
pnpm exec vitest run src\controllers\patient-portal\route.test.ts src\models\patient-portal\patientPortalPolicy.test.ts src\controllers\security\authController.token.test.ts
```

## Offline installation-bound licensing

Signed licensing is **opt-in** (`PLS_LICENSE_MODE=signed`); existing deployments default
to legacy behavior. Signed validity intersects, rather than replaces, the existing
`prime_window_access` validity/grace window. See [offline licensing](docs/offline-licensing.md)
for the CLI/API contract, desktop environment, issuer workflow, renewal, recovery,
continuity exemptions and offline security limitations. Never distribute an issuer private key.

### Build a signed Windows desktop installer

Build once from this backend checkout, then store and distribute the same installer:

```powershell
pnpm.cmd run desktop:build:licensed
```

The command creates or reuses a protected Ed25519 issuer keypair under
`%LOCALAPPDATA%\PLS-Licensing\issuer`, writes only the public key and signed mode to
an external generated configuration based on the reviewed generic template, compiles
the backend, and invokes the sibling desktop Windows NSIS build. The default is a
**GENERIC standalone installer**: no tenant binding, production database credentials,
API/email secrets, certificate or installation state is packaged. Existing backend
configuration and installed userData are not overwritten or activated. Set
`PLS_ISSUER_KEY_DIR` to an absolute directory outside both checkouts to use a different
protected issuer location. `--prepare-only` validates/creates the key and config but
skips compilation and packaging. A missing half, corrupt key or keypair mismatch fails
without silently generating a replacement.

Build configuration affects future installers only; it does not modify an installed
desktop user's userData or activate that installation. Each customer machine must
export its own activation request and receive/import a separately signed certificate.
First launch opens a trusted local setup window before starting the backend. Enter the
organization name and explicit facility/control MySQL host, port, username, password and
database names; there is no tenant-ID field. Setup identifies the organization from an
active `prime_tenants` row matching the configured facility database. If no row exists, it
transactionally adds one local registry identity using the already-prepared control schema
and platform location references. It never creates databases/users, changes an existing
registry entry, or runs migrations. The existing control database must have current
`prime_tenants` unique indexes plus active country/state/district references and a platform
user; missing prerequisites produce an actionable setup error. The generated tenant ID is
saved as `DEFAULT_TENANT_ID`/`PLS_LICENSE_TENANT_ID` for this installation. Desktop startup,
login resolution, and bootstrap serve only that local database/identity and do not enumerate
other tenants. The launcher forces `PLS_DESKTOP_STANDALONE=true` and `MULTI_TENANT=false`,
regardless of user environment values; online/cloud configuration is unchanged.

Settings are stored per installation outside the packaged runtime. **Settings > Database
setup** repairs configuration and confirms a restart; blank existing password fields retain
their values. **License > Export activation request** then **Import signed license** performs
per-device, per-local-organization offline activation. Tenant query parameters cannot select
another signed identity. Existing database validity/grace windows still apply.

`$env:PLS_DESKTOP_GENERIC='true'` explicitly selects the default (only `true`/`false`
are accepted). For intentional older facility-pinned releases only:
`pnpm.cmd run desktop:build:licensed -- --facility-specific --tenant-id <ACTUAL_TENANT_ID>`.
That opt-in retains the supplied facility environment, so review it before distributing.
Local activation is rejected for generic builds; `--activate-local` is only available with
explicit facility-specific mode, external storage and validity dates. There is no network
license service or globally enforced activation count.

A comprehensive, enterprise-grade LIMS (Laboratory Information Management System) built with Express.js, TypeScript, and MySQL. Designed for healthcare facilities, diagnostic labs, and pathology centers.

## Features

### Core Laboratory Operations

- 🧬 **Sample Management** - Complete sample tracking and lifecycle management
- 📊 **Test Results** - Digital test results with audit logging
- 🔬 **Quality Control** - QC module with regulatory compliance
- 📈 **Analytics** - Real-time dashboards and custom reports

### Clinical Integration

- 👥 **Patient Management** - Comprehensive patient registration and records
- 📋 **Medical Records** - Digital health records with security
- 🏥 **Clinician Management** - Multi-clinician support
- 📅 **Appointments** - Scheduling and follow-up management

### Financial Management

- 💳 **Billing System** - Invoice generation and payment tracking
- 📊 **Expense Tracking** - Comprehensive expense management
- 💰 **Commission Calculations** - Automatic commission processing
- 💸 **Payroll Integration** - Employee payroll management

### Inventory & Procurement

- 📦 **Inventory Management** - Stock tracking and alerts
- 💊 **Pharmacy Module** - Medicine/drug inventory
- 🏭 **Supplier Management** - Vendor and supplier tracking
- 🛒 **Purchase Orders** - Procurement workflow

### Compliance & Security

- 🔒 **Security Module** - User authentication and authorization
- ✅ **Compliance Tracking** - Regulatory compliance monitoring
- 📝 **Audit Logging** - Complete audit trail
- 🔐 **Data Protection** - Encrypted sensitive data

### Additional Features

- 👥 **CRM Module** - Customer and lead management
- 📧 **Email Integration** - Automated email communications
- 📱 **SMS Notifications** - Alert notifications
- 🔗 **Outsourcing Management** - Third-party lab integration
- 📱 **Multi-Platform** - Windows, Linux, Mac support

---

## Quick Start

### Organization-scoped usernames and password recovery

Sign-in accepts only `username` and `password` (plus optional browser metadata).
The username is the public organization identifier (`prime_tenants.id`) +
`S` (staff), `C` (clinician), or `P` (patient) + the positive local account ID,
for example `PLS20154S004`. The server resolves `PLS20154` in the organization
registry to its internal tenant ID (for example, `397773`), then queries that
tenant's account table by local ID 4. Organization identifiers are 3-32
letters/digits starting with a letter; account IDs are displayed with a minimum
of three digits. Caller-provided tenant query parameters cannot override this mapping.
New internal tenant IDs are random unique integers from 100000 to 999999:
they are actual six-digit numbers, not short numbers padded with zeroes.
No global patient, staff, clinician, or email directory is used.

Existing accounts are migrated during tenant bootstrap to tenant-local
`login_username` values. Their previous login is retained in
`legacy_login_username`; display names, local IDs, passwords, and clinical
identifiers are unchanged. New accounts receive the same format. To migrate
existing deployments explicitly and list old/new usernames:

```powershell
pnpm tenants --migrate all
# Or migrate a specific registered tenant:
pnpm tenants --migrate 397773
```

Distribute the new usernames to users before deploying the new login screen.
Old free-form usernames are no longer accepted for sign-in.

Existing short internal IDs are automatically migrated to unique six-digit
numbers during registry preparation, before tenant connections or login are
available. The mapping is logged, and the running local default is updated.
Tenant-local staff, patient, and clinician usernames are migrated first in
each tenant's startup bootstrap. Repeated startup leaves already migrated
tenant IDs and usernames unchanged. No manual migration command is required.
Take deployment backups before upgrading; users with sessions containing old
tenant IDs must sign in again. External integrations holding old numeric IDs
must use the new IDs from the registry.
Database names, account IDs, passwords, display names, and public organization
identifiers are not changed. Local startup also resolves its registered default
tenant by database name, preventing an old configured default from recreating
the old registry mapping.

Password recovery uses these unauthenticated POST endpoints:

- `/api/v1/prime/forgotpassword`: `{ username, email }`; the supplied email
  must match the account in the resolved tenant. The public response does not
  disclose whether an account exists.
- `/api/v1/prime/verify-reset-otp`: `{ username, otp }`.
- `/api/v1/prime/resetpassword`: `{ username, otp, password }`; verification
  must have succeeded and the new password must contain at least 8 characters.

OTP expiry is 10 minutes, with five failed attempts and a 60-second resend delay.
Successful reset consumes the OTP in the password-update transaction. Configure
`ACCESS_TOKEN_SECRET` and an active default email provider for each tenant.

### Development Mode

```bash
# Install dependencies
npm install

# Start TypeScript watch
npm run tsdev

# In another terminal, start the server
npm run dev
```

Server runs on `http://localhost:5000`

### Optional test-panel read cache

Client test-panel catalogue reads use Redis when available, with MySQL remaining
the source of truth. Master catalogue reads and patient result-entry data are not
cached. Response formats and route authorization remain unchanged.

Branches (`/api/v1/branches`, including pagination and ID variants), departments
(list and individual details), and company information
(`/api/v1/settings/companyprofile`) also use the same optional Redis connection.
Their default expiration is 30 minutes, configurable through the positive integer
`REFERENCE_DATA_CACHE_TTL_SECONDS`. Successful branch creation, editing, deletion,
activation/deactivation, department changes, company-profile replacement, and
profile clearing invalidate affected entries before returning. Department views
share the test-panel generation so master imports creating departments also
invalidate them. Company replacement uses transactional deletion rather than
MySQL `TRUNCATE`, which implicitly commits. Company image files remain served from
disk; binary images and internal branch validation lookups are not cached.

Cached routes:

- `/api/v1/testpanel/list` (full list and individual `id` variants).
- `/api/v1/testpanel/list/bulk` (client grouping, including filters).
- `/api/v1/testpanel/list/bulk/billing`.
- `/api/v1/gettestpanel/edit` (both department variants).

Create, custom-create, edit, rename, delete, bulk updates/pricing, successful master
imports, QC requirement changes, department changes, sample-type changes, and
outsourcing-list updates invalidate these views. Internal clinical/device metadata
queries continue reading MySQL directly. Legacy multi-statement edits invalidate
even when a later statement fails after an earlier statement committed.

The cache starts independently of the accounting worker. Its dedicated Redis
connection supports Redis 3.x and never queues commands while disconnected.
Disconnected installations use MySQL immediately; a stalled cache command is
bounded by `REDIS_CACHE_TIMEOUT_MS` (150 ms by default). A request can perform
several sequential cache commands, each with this bound. Cache failures are logged
and do not fail database reads or committed writes.

Configuration (see [.env.example](.env.example)):

- `REDIS_ENABLED=false` or `REDIS_CACHE_ENABLED=false`: disable the optional cache.
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`: connection settings.
- `TEST_PANEL_CACHE_TTL_SECONDS`: positive integer expiration, default 900 seconds.
- `REDIS_CACHE_TIMEOUT_MS`: positive integer operation timeout, default 150 ms.
- `REDIS_CACHE_NAMESPACE`: unique application/database deployment namespace.
  The default is derived from the application's configured database connection.
  Instances serving the same installation must share this namespace.

Catalogue mutations invalidate a resource generation after database writes
complete, retiring all list/filter/detail variants. Redis entries are rebuilt on
the next read rather than patched independently. Old entries expire naturally;
no key scan or database-wide Redis flush is used. Publication checks the original
generation atomically, so an overlapping old database read cannot repopulate the
current generation. Dates are preserved when data is serialized.

Startup, reconnection, and recovery after a cache error rotate a shared namespace
epoch before cached reads resume. This prevents a restarted or reconnected server
from reusing entries left by offline writes. While multiple connected instances
share invalidations, a network-isolated writer cannot instantly invalidate the
cache of another still-connected instance: expiration or recovery bounds that
case. Deployments requiring strict cross-instance consistency during asymmetric
outages need a transactional database invalidation outbox before enabling caching.

Direct SQL changes bypass application invalidation. After such maintenance,
restart the application to rotate the namespace or temporarily disable caching.
Do not share a namespace between unrelated installations. Internal cache metrics
are available through `optionalRedisCache.metrics` for hits, misses, bypasses,
errors, invalidations, and coalesced loads; no public diagnostic endpoint is added.

Run the focused cache tests with:

```bash
npx vitest run --exclude "dist/**" src/services/cache src/testpanel/testpanelList.cache.test.ts src/controllers/testpanel/testPanelCacheMutations.test.ts
```

### Production Distribution

Create a complete, self-contained distribution package:

```bash
npm run create-distribution
```

This creates a `distribution/` folder with:

- ✅ Compiled application code
- ✅ All npm dependencies
- ✅ Configuration files
- ✅ Setup scripts (Windows service, backup)
- ✅ Deployment guide

See [DISTRIBUTION_QUICK_START.md](DISTRIBUTION_QUICK_START.md) for full details.

---

## System Architecture

### Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 4.x
- **Framework**: Express.js 4.x
- **Database**: MySQL 5.7+ / MariaDB 10.6+
- **Query Builder**: Knex.js
- **Cache**: Redis (optional)
- **Authentication**: JWT
- **File Storage**: Local filesystem or cloud storage

### Directory Structure

```
.
├── src/
│   ├── controllers/           # HTTP request handlers
│   ├── models/               # Business logic & data access
│   ├── middleware/           # Request processing
│   ├── database/             # Connection management
│   ├── services/             # Business logic services
│   ├── repositories/         # Data access patterns
│   ├── interfaces/           # TypeScript interfaces
│   ├── schemas/              # Validation schemas
│   └── app.ts               # Express app setup
├── dist/                     # Compiled JavaScript
├── scripts/                  # Utility and setup scripts
├── cert/                     # SSL certificates
├── public/                   # Static assets
├── docs/                     # Documentation
└── package.json             # Dependencies
```

---

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Application
NODE_ENV=development
PORT=5000

# Database (Single Tenant)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=primetenant1

# Authentication
JWT_SECRET=your_secret_key_here

# Optional: Cache
REDIS_HOST=localhost
REDIS_PORT=6379
```

See `.env.example` for all available options.

### Database Setup

```bash
# Run migrations
npm run migrate-sql

# Seed initial data (if available)
npm run seed
```

---

## Available Scripts

### Development

- `npm run dev` - Start with auto-reload (Linux/Mac)
- `npm run tsdev` - TypeScript watch compiler
- `npm run build` - Compile TypeScript to JavaScript

### Production

- `npm run kill-port` - Kill process on default port
- `npm run start` - Start application (auto-detects Windows service or direct)

### Distribution

- `npm run create-distribution` - Create complete distribution package
- `npm run create-distribution:win` - Windows distribution builder
- `npm run create-distribution:linux` - Linux distribution builder
- `npm run verify-distribution` - Validate distribution integrity

### Windows Service (Windows only)

- `npm run service:install:win` - Install as Windows service
- `npm run service:uninstall:win` - Remove from Windows
- `npm run service:start:win` - Start service
- `npm run service:stop:win` - Stop service
- `npm run service:restart:win` - Restart service
- `npm run service:status:win` - Check status

## Deployment

### Option 1: Windows Service (Recommended for Windows)

```powershell
npm run service:install:win
```

Application runs as system service and auto-starts on boot.

### Option 2: Direct Execution

```bash
npm run kill-port  # Clear port if needed
npm run start
```

### Option 3: Distribution Package

Perfect for client delivery or cloud deployment:

```bash
npm run create-distribution
# See DISTRIBUTION_QUICK_START.md for deployment
```

### Option 4: Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install --omit=dev
RUN npm run build
EXPOSE 5000
CMD ["node", "--env-file=./.env", "./dist/src/app.js"]
```

---

## API Documentation

### Authentication

All API endpoints (except login) require JWT token in `pls-prime-tenant-session` cookie.

### Main Routes

- `/api/v1/prime/` - Authentication endpoints
- `/api/v1/patients/` - Patient management
- `/api/v1/billing/` - Billing operations
- `/api/v1/inventory/` - Inventory management
- `/api/v1/clinicians/` - Clinician management
- `/api/v1/analytics/` - Analytics & reporting
- `/api/v1/appointments/` - Appointment scheduling, calendar, and practitioner availability

Appointment CRUD, calendar, patient-history, and practitioner-slot endpoints use the
`tenantId` query parameter (for example,
`/api/v1/appointments/practioner/slots?employeeid=1&tenantId=957782`).
The legacy `tenant` alias is still accepted when `tenantId` is absent; `tenantId`
takes precedence when both are supplied. Missing or invalid tenant IDs return
HTTP 400 before database access.

See code documentation in `src/controllers/` for detailed endpoint specifications.

---

## Project Features

### Multi-Tenancy Support

The system supports both single and multi-tenant deployments:

- **Single Tenant** (default): All data in one database
- **Multi-Tenant**: Separate database per tenant with tenant isolation

Configure in `.env`:

```env
MULTI_TENANT=false  # Set to true for multi-tenant
```

### Security

- JWT-based authentication
- Password hashing with bcrypt
- SQL injection prevention (parameterized queries)
- CORS protection
- Input validation and sanitization
- Audit logging for compliance

### Performance

- Redis caching for frequently accessed data
- Database connection pooling
- Query optimization with Knex.js
- Async/await for non-blocking operations
- File upload compression

---

## Development

### Code Structure

**Controllers** - HTTP request handling

```typescript
export class PatientController {
  async getPatient(req: Request, res: Response) {
    // Handle request
  }
}
```

**Services** - Business logic

```typescript
export class PatientService {
  async registerPatient(data: PatientData) {
    // Business logic
  }
}
```

**Repositories** - Data access

```typescript
export class PatientRepository {
  async findById(id: number) {
    // Database query
  }
}
```

### Testing

```bash
# Run tests (if configured)
npm test

# With coverage
npm run test:coverage
```

### Linting & Formatting

```bash
# Check code quality
npm run lint

# Fix formatting
npm run format
```

---

## Troubleshooting

### Port Already in Use

```bash
npm run kill-port
```

### Database Connection Error

- Verify MySQL/MariaDB is running
- Check `.env` database credentials
- Ensure database user has CREATE/SELECT/INSERT/UPDATE privileges

### TypeScript Compilation Errors

```bash
npm run build -- --noEmit  # Check errors without output
```

### Service Won't Start (Windows)

```powershell
# Check service status
Get-Service -Name PrimeLabSystemRuntime

# Check event log
Get-EventLog -LogName Application -Source "PrimeLabSystemRuntime" -Newest 10
```

---

## Documentation

- [Distribution Quick Start](DISTRIBUTION_QUICK_START.md) - Creating distribution packages
- [Distribution Build Guide](docs/DISTRIBUTION_BUILD_GUIDE.md) - Detailed build process
- [API Documentation](docs/) - Endpoint specifications
- [Architecture Decisions](docs/) - System design docs

---

## System Requirements

### Minimum

- Node.js 18.x
- MySQL 5.7 or MariaDB 10.6
- 2 GB RAM
- 500 MB disk space (more for uploads)

### Recommended for Production

- Node.js 18+ LTS
- MySQL 8.0 or MariaDB 10.7+
- 4+ GB RAM
- SSD storage (50+ GB)
- Redis 6.0+ for caching
- SSL/TLS certificates

### Supported Platforms

- ✅ Windows Server 2016+
- ✅ Linux (Ubuntu 20.04+, CentOS 7+)
- ✅ macOS 11+
- ✅ Docker containers
- ✅ Cloud platforms (AWS, Azure, GCP)

---

## Contributing

1. Create a feature branch (`git checkout -b feature/AmazingFeature`)
2. Commit changes (`git commit -m 'Add AmazingFeature'`)
3. Push to branch (`git push origin feature/AmazingFeature`)
4. Open a Pull Request

---

## License

This project is licensed under the ISC License - see LICENSE file for details.

---

## Support & Contact

For issues, questions, or support:

- 📧 Email: support@primelabsystem.com
- 🐛 Bug Reports: [Issues](./issues)
- 📖 Documentation: [Docs](./docs/)

---

## Changelog

### v0.0.1

- Initial release
- Core laboratory operations
- Patient management
- Billing system
- Inventory management
- User authentication & authorization

---

**Prime Laboratory Software v0.0.1**\
_High Performance Laboratory Information Management System_

Built with ❤️ for healthcare professionals
