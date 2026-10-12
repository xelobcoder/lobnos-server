# Prime Laboratory Software (PLS) backend deployment checklist

Reusable checklist for a self-hosted Prime Laboratory Software (PLS) backend release, primarily the
Windows/NSSM service deployment. Complete one copy per release. Mark steps
not applicable only with an explanation; do not treat an unchecked item as
implicitly complete.

## Release details

- **Release/version:**
- **Commit/tag:**
- **Environment/customer:**
- **Deployment window and timezone:**
- **Deployer:**
- **Approver / incident contact:**
- **Expected user impact or downtime:**
- **Previous known-good release and restore location:**

## Pre-deployment: go/no-go

- [ ] Release scope and affected API/workflows reviewed; code review approved.
- [ ] Build and relevant automated tests pass on the exact release revision:
  `pnpm install --frozen-lockfile`, `pnpm test`, and `pnpm build`.
- [ ] CI results reviewed if a CI workflow is configured. If CI is not
  configured for this repository/release, retain the local command results.
- [ ] No unresolved release-blocking defects; data/tenant-impacting changes
  have a named owner and explicit approval.
- [ ] Confirm the deployment target and mode: Windows service, another
  supported server deployment, or standalone desktop distribution. Do not
  apply the server procedure to a standalone desktop installation.
- [ ] Confirm Node.js, MySQL, file-system access, and required external services
  are available for this release.
- [ ] Confirm service identity has access to the application directory, `.env`,
  logs, upload/storage locations, and backup locations.
- [ ] Review the target `.env` against `.env.example`; verify the correct
  production database, port, tenant mode, `DEFAULT_TENANT_ID`, and credentials.
  Do not copy development values or commit/share secrets.
- [ ] For multi-tenant deployments, verify the master control database and
  expected tenant registry/database set. Confirm
  `TENANT_DB_CONNECTION_BUDGET`, `TENANT_DB_CACHE_MAX_ENTRIES`,
  `TENANT_DB_MYSQL_POOL_MAX`, `TENANT_DB_KNEX_POOL_MAX`, and
  `TENANT_DB_IDLE_TIMEOUT_MS` are valid for the environment and MySQL connection
  budget.
- [ ] Confirm required optional dependencies and configuration, including
  Redis/cache and email/SMS providers, against the features enabled at this
  site.
- [ ] Review database schema/bootstrap changes in the release. Identify whether
  startup bootstrap will create or alter tables, whether a separate migration
  is required, expected lock/downtime, and how it will be monitored.
- [ ] For workspace-layout releases, confirm the tenant bootstrap will add the
  `applicationsettings.workspaceLayout` column and default existing facilities
  to `classic`; include this additive schema change in backup and rollback
  planning.
- [ ] **Do not rely on `npm run migrate-sql` without verification:** the README
  mentions this command, but `package.json` does not currently define it.
  Establish the approved migration procedure for this release before proceeding.
- [ ] Review migration/provisioning scripts for embedded credentials and fixed
  production targets. In particular,
  [`migrate.ts`](../src/cron/command-line-tool-database/migrate.ts) contains
  literal connection settings and a fixed database target; do not use it for
  production deployment. Treat any committed credential as exposed, rotate it
  if it could be valid, and use an independently reviewed, secret-backed
  procedure instead.
- [ ] Take a consistent, verified backup of every affected tenant database and
  the master/control database; retain it outside the deployment target. Confirm
  the restore owner, location, and recovery procedure. A backup job being
  installed or running is not proof that a restorable backup exists.
- [ ] Document rollback triggers, decision-maker, communications path, and
  whether rollback means code-only rollback or also requires database recovery.
- [ ] Notify the on-call/support team and affected stakeholders; confirm the
  maintenance window and user communications.

## Deploy

- [ ] Record the currently running release, service state, configuration
  location, database backup identifiers, and baseline error/latency levels.
- [ ] Put the service into the approved maintenance/drain mode if required;
  confirm background jobs or other writers are safely handled.
- [ ] Deploy the reviewed release artifact/revision. Keep the prior known-good
  artifact and configuration available; do not overwrite customer `.env` or
  standalone user data.
- [ ] Install dependencies from the committed lockfile and build the release:
  `pnpm install --frozen-lockfile` and `pnpm build`.
- [ ] If this release includes schema/bootstrap changes, run only the approved
  migration procedure and record completion/errors. Do not improvise SQL or
  assume startup bootstrap is a reversible migration.
- [ ] For workspace-layout releases, verify application-settings bootstrap
  completed for every expected tenant before enabling the new API or UI; do not
  assume a successful service start means every tenant bootstrapped.
- [ ] For an already-installed Windows service, restart it using
  `npm run service:restart:win` (or the configured service name). Verify status
  with `npm run service:status:win`. Do not reinstall/uninstall a service as a
  routine update.
- [ ] If a backup-scheduler service is part of this installation, verify its
  status separately with `npm run service:backup:status:win`.
- [ ] Confirm the application starts from the expected release and logs show
  successful database connection, master catalog readiness, marketplace
  bootstrap, and every expected tenant marked ready. Investigate every skipped
  tenant, bootstrap failure, or accounting-worker/outbox failure before
  declaring success.

## Post-deploy verification

- [ ] Verify `GET /api/v1/health` responds successfully. This endpoint is a
  liveness check only; it does **not** prove database or tenant readiness.
- [ ] Verify database connectivity and tenant readiness in startup/service
  logs; confirm the expected tenant set is serving requests.
- [ ] Verify Redis with `GET /api/v1/health/redis` only when Redis is required
  by this deployment. A Redis failure is a release blocker only when it breaks
  configured required behavior.
- [ ] Smoke-test authenticated sign-in and the release-affected user flows using
  approved test accounts and non-production/test records where possible.
- [ ] For workspace-layout releases, verify an administrator can save each
  supported facility layout, non-administrators cannot change it, and another
  user sees the selected layout after sign-in or refresh. Confirm existing
  facilities default to Classic.
- [ ] At minimum, verify one representative patient registration, test
  ordering/result access, billing/payment, and report/notification flow as
  applicable to the changed modules.
- [ ] For multi-tenant releases, verify requests and data remain isolated to
  the intended tenant; verify no expected facility was omitted at startup.
- [ ] Confirm background workers/outbox processing and scheduled backups are
  healthy where enabled.
- [ ] Monitor application/service logs, database connection pressure, error
  rates, and latency for at least 15 minutes and through one representative
  transaction cycle. Compare with the recorded baseline and agreed
  environment-specific thresholds.
- [ ] Check no unexpected schema errors, failed queries, stuck jobs, duplicate
  processing, or increase in support reports is occurring.
- [ ] Remove maintenance mode, confirm user access, update release notes, and
  notify stakeholders that deployment is complete.
- [ ] Record final release revision, deployment time, validation results,
  migration/backup references, exceptions, and follow-up actions.

## Rollback criteria and response

Stop rollout and start the rollback/incident procedure if any of the following
occurs:

- A required tenant fails bootstrap, the master catalog is unavailable, or
  startup indicates users cannot reliably access required data.
- A critical patient, test-result, billing, payment, or tenant-isolation flow
  fails or produces incorrect/persisted data.
- Sustained error rate or latency exceeds the pre-agreed environment baseline
  or release threshold; there is no universal safe numeric threshold.
- Database connection exhaustion, repeated service restarts, data corruption,
  or an unrecoverable migration/bootstrap failure occurs.
- A required backup, migration, or security prerequisite cannot be verified.

Rollback procedure:

- [ ] Stop further rollout and notify the deployment approver/on-call team.
- [ ] Decide and record whether to roll back code only, apply a forward fix, or
  restore databases. Database restore may discard valid transactions made
  after the backup; obtain explicit authorization and coordinate a write
  freeze before restoring.
- [ ] Restore the prior known-good application artifact/configuration using the
  deployment method for this environment; restart the service and verify status.
- [ ] Restore database backups only under the approved recovery plan, in
  dependency order for tenant and control databases; verify integrity before
  reopening writes.
- [ ] Re-run health, tenant-readiness, and critical-flow checks; retain logs and
  incident evidence.
- [ ] Communicate the outcome, user impact, data-recovery point, and any manual
  reconciliation required. Keep the deployment open until the incident owner
  accepts service health.

## Standalone desktop release notes

For a generic offline-licensed desktop build, use the dedicated installer
workflow and its review requirements in the [README](../README.md#build-a-signed-windows-desktop-installer)
and [offline licensing guide](./offline-licensing.md). Verify the generated
installer without packaging production credentials, secrets, certificates, or
installation state. Customer database configuration, schema preparation, and
per-installation activation are separate steps; desktop setup does not run
migrations or create tenant databases.
