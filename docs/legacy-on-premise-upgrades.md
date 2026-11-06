# Existing on-premise database upgrades

Older installations have independent schema histories. Use an assessed compatibility baseline followed by the application's idempotent bootstrappers. Run against a restored copy before upgrading the working installation.

## Collation release gate

The ordinary-text standard is `utf8mb4_unicode_ci`. Explicit binary and case-sensitive
columns are retained for exact-match behavior; they are reported separately, not
silently converted. A correct database default does not establish that existing
tables and columns have been converted.

Run `pnpm run build` in the source checkout when preparing the release. The audit
and collation conversion commands ship as compiled JavaScript in the standard
distribution and need no source checkout or TypeScript runtime on the on-premise
installation.

Run the read-only installation check before and after maintenance:

```powershell
pnpm run tenant:audit-collation -- --database CLIENT_DATABASE --output CLIENT_RELEASE-collation.json
```

For the active registry fleet, including each configured database endpoint:

```powershell
pnpm run tenant:audit-collation -- --registered --output FLEET_RELEASE-collation.json
```

The commands query schema metadata only, start no workers and run no bootstrappers
or registry repairs. They use deployment-owned database credentials and TLS policy.
Output files are created exclusively and never overwritten. Exit code 0 means all
checked schemas meet the collation policy, 1 means drift remains, and 2 means the
audit is incomplete or failed. Block release activation for either nonzero exit
code. An unreachable tenant is not a pass. These checks do
not certify backups, data preservation, permissions or clinical/financial behavior.
Offline on-premise installations must run the same check locally and return their
dated report; absence from the reachable registry is not evidence of compliance.

Pause application and worker writes, authenticate and restore a fresh backup, and
rehearse the conversion on that restore before touching the working installation.
Use the existing backup/restore procedure below, then:

```powershell
pnpm run tenant:upgrade-collation -- --database CLIENT_DATABASE --backup-manifest VERIFIED_BACKUP_MANIFEST --output CLIENT_RELEASE-conversion.json
```

The configured database must match the requested database, and the backup fingerprint
and restore evidence must pass. The conversion checks unique-key conflicts and
foreign-key membership and restores intentional exact-match column definitions.
It now checks database, table and column collation again before reporting completion.
MySQL DDL is not transactionally reversible: a failure can leave partial changes.
Keep maintenance mode active, inspect the report and use the rehearsed recovery plan.
Do not repeatedly run conversions against a writing production database.

The legacy `setup:new-client` clone normalizes copied DDL using the same policy
as facility provisioning, sets the database default explicitly, and stops on a DDL
error instead of skipping it. It verifies database, table and text-column collation
before reporting completion, and checks again after reference seeds. Its `--force`
mode still leaves pre-existing tables untouched and now fails if they are not
compliant; convert those tables through the maintenance path before activation.

Strict facility provisioning and client migration bootstrap normalize and verify
collation both before and after the runtime bootstrappers, before starting workers
or reporting readiness. This includes tables introduced during that upgrade.
Ordinary application startup does not rebuild existing tables automatically.
Keep writes paused throughout strict migration bootstrap as well as conversion.
The authoritative exported schema files remain historical source assets; their
DDL is normalized before execution, and regression tests cover every exported table.

Include provisioning-source and control databases in installation maintenance, not
only active registered tenants. For an application database without a registered
tenant identity, the encrypted backup command accepts `--database-scope` instead
of `--tenant TENANT_NUMBER`. Such snapshots explicitly use the non-tenant namespace
0 and a database-scoped manifest; do not invent a tenant number. Exact configured
database matching, authenticated encryption, backup fingerprint and restore
verification remain mandatory. Preserve historical backup/restore databases as
recovery evidence rather than treating them as current application schemas.

## Tenant identity

`DEFAULT_TENANT_ID` identifies a registered database. Changing `DATABASE` does not transfer that identity. The registry must continue to reject a tenant number owned by another database.

To register a client database that is already configured in this installation's environment file, run

```powershell
npm run tenants -- --register-local CLIENT_DATABASE
```

This explicitly creates a fresh registration or returns the existing active registration for that database. It preserves existing registrations and rejects suspended registrations. Set `DEFAULT_TENANT_ID` to the returned number. Preserve the returned organization identifier for staff, patient and practitioner login migration. For an existing live organization that already has an assigned registry identity, use that original identity and its original registry instead of creating a second organization.

## Assessment and SQL

```powershell
npm run tenant:upgrade-plan -- --database CLIENT_DATABASE --reference REVIEWED_CURRENT_DATABASE --output docs/migrations/CLIENT_RELEASE
```

The command reads schema metadata and checks whether required-column additions need backfills. It writes `assessment.json` and `compatibility.sql` and refuses to overwrite an existing output file. It does not read business records into those files or execute the migration.

The reference must be a reviewed current schema on the same MySQL server. A local test database is a comparison source, not an authoritative replacement for reviewing current application requirements. Generated changes only add absent columns and tables. Existing column types, nullability, defaults, indexes, triggers and views require separate review. Additional target-only tables are retained. New tables contain no reference data or accounts. Foreign-key dependencies are ordered, and unresolved dependencies are reported. Existing required columns are added only when the target table is empty. Otherwise their backfills are reported for explicit review.

Each generated column addition checks the actual target schema first. Table creation uses `IF NOT EXISTS`. The SQL temporarily permits existing zero-date values in its migration session and retains strict mode. It restores the previous session mode on successful completion. If an error stops execution, close that migration connection before resuming normal application use. MySQL DDL commits implicitly, so use a verified restorable backup, pause application/worker writes, stop on the first error and regenerate the assessment after any partial run. Do not use the old hard-coded knexfile or replay historical create-table migrations against a populated client database.

## Bootstrap handover

After reviewing and applying the compatibility SQL to the restored copy, set this installation's configured database and tenant number to that copy's identity and run

```powershell
npm run tenant:upgrade-bootstrap -- --database CLIENT_DATABASE
```

The maintenance command requires an exact database-name match and an active matching registration. It limits all connections to that one configured database, uses strict bootstrap error handling and starts no application background workers. Historical zero dates remain intact while structural upgrades run. Normal application sessions retain their existing SQL mode. Normal startup still enforces tenant identity and authorization.

Run the command a second time to check repeatability. Compare patient, billing, service, result and account totals and protected clinical values with the pre-upgrade copy. Exercise registration, billing, payment, result entry/validation, reports and the enabled modules with facility-specific settings before cutover. Keep original account passwords, patient IDs and clinical rows. Legacy usernames are preserved in a widened history field. Retired package/commission structures are archived with a `legacy_` prefix. Refund witnesses are copied to `legacy_refund_witnesses` before normalization. Existing archives are protected from table-name collisions.

## GMS cutover completed on 4 November 2026

The original `gmsprimelab` database was upgraded after an encrypted pre-upgrade backup was authenticated and restored successfully into `gmsprimelab_preupgrade_restore_20261104`. All 213 original table row counts matched the restored snapshot before cutover.

GMS now has tenant `876954`, organization/login prefix `NRTAM19`, and facility code `GLOB01`. The former configured tenant `990556` continues to belong to `primelabtestmig`. This installation's `.env` uses `DEFAULT_TENANT_ID=876954` and `MULTI_TENANT=false` to serve GMS only. Existing tenant mappings were preserved. The earlier `gmsprimelab_upgrade_rehearsal` registration remains archived.

The compatibility baseline added 223 absent tables and 168 absent columns. All 24 original column-level review items were resolved through `ReviewedGmsColumns.ts`, including monetary precision, identifier widths, supported enumeration values, vital-sign nullability and default corrections. The reviewed profile validates stored value ranges before changing definitions, preserves text collations and retains the original incident status in an audit table before normalizing an obsolete spelling. See `docs/migrations/gmsprimelab-20261104/resolutions.json` for each decision.

A post-cutover assessment found zero missing tables or columns relative to the comparison database. Its only three differences are accepted widenings of `legacy_login_username` to LONGTEXT. The reference used VARCHAR(64), which cannot preserve some GMS historical usernames. These three deliberate widenings resolve the discovered truncation risk.

Normal backend startup completed on port 2300 using GMS's own tenant identity. The health endpoint returned 200. An unauthenticated protected request and a login attempt for another tenant both returned 401. Existing account passwords and account IDs are preserved. Generated login IDs use `NRTAM19S...` for staff, `NRTAM19P...` for patients and `NRTAM19C...` for practitioners. The normal sign-in workflow uses organization-prefixed IDs. Existing passwords remain available through the organization-prefixed sign-in workflow.

## Data-preservation and runtime fixes

Every original table was compared with the authenticated pre-upgrade restore. Existing rows and original columns were checked by primary key and null-safe value comparisons. Non-keyed tables used row counts and aggregate original-column checksums, with this weaker comparison explicitly recorded. Patient, billing and result records matched, including 6,035 patients, 8,689 bills, 25,597 services, 25,595 test orders and 114,198 result parameters. All 37 migrated PINs verified against their secure hashes.

The automatic timestamp update on `patients_credentials.updated_on` was detected during verification and restored from the snapshot. Login migration now explicitly preserves existing account update timestamps. Legacy usernames, original passwords, original IDs, staff roles and permissions were retained.

All six retired refund-witness fields matched the original evidence for 25,606 refund records in `legacy_refund_witnesses`. Retired package and commission structures were archived. Existing empty or older `patient_portal_notifications` tables now acquire the missing `attempts` column, fixing the notification-worker error found during normal startup. The notification sweep was rerun successfully. Portal notification settings and authorization were retained.

## Recovery artifacts and commands

The encrypted backup, sealed data key, restore verification, migration report and full data-preservation report are under the ignored private directory `backups/migrations/gmsprimelab-cutover-20261104/`. Retain the installation's existing `BACKUP_MASTER_KEY` or `BACKUP_MASTER_KEY_FILE` separately. It is required to recover the sealed backup key. The backup SQL was encrypted directly from the dump stream and restored through authenticated streaming. Encryption and restore verification used streams throughout.

The verified pre-upgrade restore database and archived rehearsal contain client data and are retained for recovery and verification. They are excluded from active tenant routing.

The facility-specific apply command is

```powershell
npm run tenant:upgrade-gms -- --database gmsprimelab --reference primelabtestmig --backup-manifest backups/migrations/gmsprimelab-cutover-20261104/manifest.json
```

It validates the configured tenant, backup fingerprint and restored snapshot before applying the baseline and the reviewed profile, then hands over to strict application bootstrap without starting workers. Future facilities need their own assessment and reviewed profile. Do not reuse GMS's tenant identity, backup or client-specific assumptions.

For another encrypted snapshot and restore rehearsal, use a fresh output directory and fresh restore database

```powershell
npm run tenant:upgrade-backup -- --database CLIENT_DATABASE --tenant TENANT_NUMBER --output backups/migrations/CLIENT_RELEASE --verify-restore CLIENT_preupgrade_restore_RELEASE
```

Pause application writes first. The helper requires a configured backup master key, verifies the authenticated stream before restoring, and refuses to overwrite an existing restore database. Non-InnoDB tables or scheduled database events require a separately reviewed snapshot/restore plan.

## Final cutover verification

The backend build passed and all 3,965 backend tests passed across 327 files. Normal service startup succeeded on port 2300. Health returned 200, unauthenticated protected access returned 401, cross-tenant sign-in returned 401 and GMS's own invalid-credential request reached its credential validator and returned 401. The patient notification sweep succeeded after its existing-table column upgrade. A final comparison with the pre-upgrade restore, performed after normal startup, reported zero differing original tables and zero PIN verification failures across all 213 original tables.
