# Prime Laboratory Software (PLS): software audit and critique

Audit date: 1 November 2026. Scope: current local working copies of the backend, staff application, public website, and deployment/backup tooling.

## 1. Scope, evidence and limitations

This is a broad engineering and product critique, not a claim that every line, screen, integration or deployment was exhaustively certified. Representative implementations were inspected across the repositories, with suspected defects traced to supporting code. Findings distinguish demonstrated implementation defects, structural weaknesses, and risks requiring operational confirmation.

Repository roots relative to this document:

- Backend and operational tooling: `.`.
- Staff application: `../lobnos`.
- Public website: `../primelaboratorysystems`.

Other sibling products, native device applications, mobile applications and external services were not independently audited. Device integration and portals were assessed only where represented in the reviewed repositories. No production records were inspected, no credentials are reproduced, and no production databases, messages, payments, deployments or restore operations were exercised.

The worktrees contain concurrent, uncommitted work. This report describes the inspected working copies, not a release tag or an immutable deployed artifact. Existing audits were not treated as proof that old findings remain unresolved. Source anchors identify starting lines; sibling links require the repositories to remain adjacent.

### Evidence labels

- **Defect:** the inspected implementation demonstrates the failure condition. A live production reproduction is not implied.
- **Weakness:** an observable design, maintainability or process limitation.
- **Risk:** the consequence depends on configuration, workload, deployment or behavior not established in this audit.

Priority is separate from confidence:

- **P0:** resolve or explicitly mitigate before relying on the affected path in production.
- **P1:** high-value next engineering cycle.
- **P2:** planned improvement after reliability and access-control gates.

Effort bands are estimates, not delivery promises: 1 = localized change; 2 = small cross-file change; 3 = domain-sized change; 4 = coordinated multi-domain work; 5 = platform-level work. Each finding has impact, risk and effort scores from 1 to 5. The ranking aid is `(impact + risk) x (6 - effort)`. Clinical safety, access control and recoverability can override numerical ordering.

## 2. Executive critique

PLS has substantial real functionality. Its main problem is not a lack of modules: it is the uneven engineering discipline connecting a growing set of modules into a dependable healthcare product. More dashboards and cosmetic redesigns will not compensate for fragile releases, misleading backup success, inconsistent access boundaries or poorly surfaced failures.

The appropriate direction is to strengthen the existing modular product, not immediately rewrite it or split it into microservices. Preserve implemented laboratory, billing, stock, accounting, payroll and portal workflows while making their contracts, permissions, failure handling and operational evidence consistent.

The highest-priority work is to protect actor identity and result history, make backups truthfully recoverable, constrain attachment/SQL boundaries, and replace the current in-place deployment behavior. Next comes reliable submission/delivery, clear failure UX and accessibility. Product presentation and larger refactoring should follow those controls.

### Strengths worth preserving

- There is real breadth across laboratory operations, specimens, results, billing, inventory, payroll, accounting, communications and portals. This is not merely a screenshot collection or a thin registration system.
- Current global authentication validates tenant/session context. Newer workflow-specific middleware derives actor identity from the session, even though legacy exceptions remain.
- Payroll processing locks the period, uses a transaction and checks funding/approval before related posting: [`src/services/payroll/PayrollProcessingService.ts:215`](./src/services/payroll/PayrollProcessingService.ts#L215).
- Current inventory transactions use ordered locks and transactional stock/accounting writes: [`src/models/inventory/InventoryTransaction.ts:92`](./src/models/inventory/InventoryTransaction.ts#L92), [`InventoryTransaction.ts:131`](./src/models/inventory/InventoryTransaction.ts#L131). Older audit claims about lost updates were not simply carried forward.
- Result-release paths include revision/critical-release guards; SMS has callback verification and transactional dispatch leasing. The critique of email is not a claim that all communication delivery shares its weaknesses.
- The real specimen lifecycle workspace persists actions and exposes load/failure states: [`../lobnos/components/phelobotomy/SpecimenLifecycleWorkspace.tsx:80`](../lobnos/components/phelobotomy/SpecimenLifecycleWorkspace.tsx#L80), [`SpecimenLifecycleWorkspace.tsx:113`](../lobnos/components/phelobotomy/SpecimenLifecycleWorkspace.tsx#L113).
- Cash collection retains a retry request key and prevents concurrent submission: [`../lobnos/app/billing/cash-collection/page.tsx:394`](../lobnos/app/billing/cash-collection/page.tsx#L394), [`page.tsx:890`](../lobnos/app/billing/cash-collection/page.tsx#L890). Do not erase that protection while fixing the separate ordinary-billing path.
- Report settings preserve edits on save failure, offer retry and announce outcomes: [`../lobnos/app/settings/applicationsettings/reportSettings/page.tsx:41`](../lobnos/app/settings/applicationsettings/reportSettings/page.tsx#L41), [`page.tsx:112`](../lobnos/app/settings/applicationsettings/reportSettings/page.tsx#L112).
- The website has 42 actual screenshots and 18 reporting views, honest custom-quotation copy and evidence-backed scope limitations. Its marketplace proxy constrains upstream paths and private-data caching: [`../primelaboratorysystems/src/app/api/marketplace/[...path]/route.ts:13`](../primelaboratorysystems/src/app/api/marketplace/[...path]/route.ts#L13), [`route.ts:164`](../primelaboratorysystems/src/app/api/marketplace/[...path]/route.ts#L164).

### Coverage matrix

| Area | Evidence inspected | What this audit does not establish |
|---|---|---|
| Deployment/distribution | Bash deploy, Windows installation/control assumptions, packaging/environment handling | Actual PM2/NSSM production topology or a successful rollback |
| Backup/recovery | Scheduler, dispatch, retention, process state, manual checklist | Restorability of a real customer backup, offsite durability or measured RPO/RTO |
| Identity/tenant boundary | Global auth context, legacy role helpers, domain authority gates | Exhaustive authorization certification of every route or every tenant |
| Laboratory/results/specimens | Workbench, audit/printing history, release safeguards, legacy and real storage routes | Clinical validation of every test template, reference interval or instrument adapter |
| Billing/finance/payroll | Actor/discount rules, submission retry safety, deferred commission work, attendance/leave and transaction strengths | Complete accounting, payroll-tax or commission formula reconciliation |
| Inventory/reporting | Transaction strengths and payment analytics query/date semantics | Formula accuracy, query plans and load performance of every dashboard |
| Communications | Email attachments/queue state and SMS reliability contrast | Provider deliverability, contractual guarantees or production queue recovery |
| Staff UX/accessibility | Lab, cash collection, report settings, shared fetch/auth policy and test strategy | A whole-application browser, mobile or assistive-technology certification |
| Public website | Claims, screenshots, pricing, leads, booking/legal copy, portal configuration, API proxy and tests | Live conversion rates, approved legal compliance, real bookings or deployed configuration |

There are **45 consolidated findings** below. A lower-priority weakness is not equivalent to a production incident, and a source-level defect is not proof that it has already been exploited.

## 3. Deployment, recovery and engineering controls

### O01. Runtime environment files are tracked and the distribution builder copies the working environment

**P0 | Weakness with configuration-dependent exposure risk | Confidence: high | Impact 5, risk 5, effort 2 | Score 40**

Evidence: `git ls-files -- .env production.env` returned both files. The ignore file says environment variables should be excluded but does not contain an effective environment-file exclusion: [`.gitignore:2`](./.gitignore#L2). The legacy distribution builder names the working `.env` as its template source and copies it into the distribution: [`scripts/create-distribution.js:119`](./scripts/create-distribution.js#L119), invoked at [`scripts/create-distribution.js:357`](./scripts/create-distribution.js#L357). The packaging manifest also declares `.env` as an asset: [`package.json:11`](./package.json#L11).

**Critique:** customer/developer configuration is not separated reliably from source and distributable artifacts. Contents and credential validity were deliberately not inspected; this is not a claim that a particular live secret was stolen. Nevertheless, tracked runtime configuration and direct copying are unsuitable defaults for a multi-facility healthcare product.

**Remedy:** remove runtime environments from future tracking through a reviewed process, use a sanitized example and per-install provisioning, and make artifact inspection reject forbidden environment/private-key files. Independently identify and rotate any valid credentials previously committed or distributed. Removing a file from the latest revision does not remove its history.

**Acceptance:** clean-checkout and distribution tests prove that only approved placeholder configuration is included; existing facilities retain their own configuration.

### O02. Deployment restores the old dependency manifest after pulling new source

**P0 | Defect | Confidence: high | Impact 5, risk 5, effort 2 | Score 40**

Evidence: [`deploy.sh:19`](./deploy.sh#L19) backs up `package.json`; [`deploy.sh:28`](./deploy.sh#L28) pulls new source; [`deploy.sh:36`](./deploy.sh#L36) restores the old manifest; [`deploy.sh:40`](./deploy.sh#L40) restores an npm lockfile, although installation uses pnpm at [`deploy.sh:45`](./deploy.sh#L45).

**Critique:** a source release adding or changing dependencies can be deployed with its predecessor's manifest. The pnpm lockfile and restored manifest can disagree. Preserving the environment is sensible; preserving old dependency definitions is not.

**Remedy:** deploy an approved revision with its matching manifest and pnpm lockfile, use `pnpm install --frozen-lockfile`, and preserve only explicitly external customer configuration. Reject unexpected dirty tracked files rather than autostashing them into a production release.

**Acceptance:** a fixture release with a new dependency installs and builds from the release lockfile; the deployed revision and manifest are recorded together.

### O03. Deployment is in-place, unscoped and has no automatic readiness or rollback gate

**P0 | Weakness | Confidence: high | Impact 5, risk 5, effort 3 | Score 30**

Evidence: [`deploy.sh:28`](./deploy.sh#L28), [`deploy.sh:49`](./deploy.sh#L49), [`deploy.sh:53`](./deploy.sh#L53). The script builds in the live checkout and restarts **all** PM2 applications. It prints success after restart without testing application/database/tenant readiness. A substantially better manual checklist already exists: [`docs/deployment-checklist.md:73`](./docs/deployment-checklist.md#L73), [`docs/deployment-checklist.md:103`](./docs/deployment-checklist.md#L103).

**Critique:** this can interrupt unrelated colocated services and leave a partially changed release directory after failure. `set -e` stops a failing command; it does not restore a coherent previous release. The issue is failure to operationalize the existing checklist, not absence of all deployment documentation.

**Remedy:** build a versioned artifact outside the active directory, stage it, restart only the configured PLS service, run liveness plus tenant/database/worker checks, and switch back to a known-good artifact on a failed gate. Schema rollback needs a separate, reviewed recovery policy.

**Acceptance:** simulated install/build/readiness failures preserve or restore the prior serving release; no unrelated process is restarted.

### O04. Scheduled "full system" backups run only the database branch

**P0 | Defect | Confidence: high | Impact 5, risk 5, effort 3 | Score 30**

Evidence: the type explicitly permits `full_system` at [`src/models/security/database-backup/backup.ts:35`](./src/models/security/database-backup/backup.ts#L35). Dispatch at [`src/models/security/database-backup/backup.ts:588`](./src/models/security/database-backup/backup.ts#L588) distinguishes only `files` from an `else` database backup. Patient images also require separate file backup: [`README.md:60`](./README.md#L60).

**Critique:** a schedule labeled full system can complete without its file payload. Restoring the database alone can leave referenced patient images and other stored documents missing. This finding concerns scheduled dispatch, not every possible manual backup path.

**Remedy:** implement an explicit full-system operation with a manifest joining database, approved file roots, metadata and key-recovery requirements, or reject the unsupported schedule type. Do not claim full-system success when only one component succeeded.

**Acceptance:** a restore into an isolated fixture verifies database rows and referenced private files from the same backup set.

### O05. Failed scheduled backups advance the schedule and still delete old backups

**P0 | Defect | Confidence: high | Impact 5, risk 5, effort 2 | Score 40**

Evidence: [`src/models/security/database-backup/backup.ts:616`](./src/models/security/database-backup/backup.ts#L616) updates `last_run` after either a success or failure result; [`src/models/security/database-backup/backup.ts:622`](./src/models/security/database-backup/backup.ts#L622) runs retention before returning the result.

**Critique:** a failed backup can postpone the next ordinary attempt while retention removes previous successful recovery points. This can convert an operational outage into loss of recovery options.

**Remedy:** separate last attempt from last verified success, retry failed attempts with bounded backoff, and gate destructive retention on a verified replacement and a minimum recovery-point policy.

**Acceptance:** injected dump/encryption failures leave verified backups intact, record failure, alert the operator and remain eligible for retry.

### O06. Retention policy is shared by storage-path prefix, not by schedule

**P1 | Defect/design weakness | Confidence: high | Impact 5, risk 4, effort 2 | Score 36**

Evidence: [`src/models/security/database-backup/backup.ts:638`](./src/models/security/database-backup/backup.ts#L638) selects successful backups by path prefix and cutoff date, without a schedule predicate. Each schedule passes its own retention period at [`src/models/security/database-backup/backup.ts:622`](./src/models/security/database-backup/backup.ts#L622).

**Critique:** two schedules sharing a storage root do not retain independently. A short-retention job can delete a long-retention job's backups. Secure-deletion results are also not consistently checked before records are removed: [`src/models/security/database-backup/backup.ts:660`](./src/models/security/database-backup/backup.ts#L660).

**Remedy:** scope retention to tenant and backup policy/set, validate canonical directory boundaries, preserve the configured minimum successful generations, and keep failed-deletion records actionable.

**Acceptance:** hourly/daily/monthly fixture schedules sharing a root cannot shorten one another's retention; failed file deletion cannot be reported as completed cleanup.

### O07. Scheduler coverage and coordination do not scale automatically with tenants or processes

**P1 | Risk | Confidence: high for implementation, medium for deployment impact | Impact 5, risk 4, effort 3 | Score 27**

Evidence: [`src/services/backup-scheduler.ts:18`](./src/services/backup-scheduler.ts#L18) resolves one tenant from the environment or defaults to 1; [`src/services/backup-scheduler.ts:67`](./src/services/backup-scheduler.ts#L67) runs only that tenant. `isChecking` is process-local at [`src/services/backup-scheduler.ts:61`](./src/services/backup-scheduler.ts#L61); due jobs are selected and executed without an atomic claim at [`src/models/security/database-backup/backup.ts:720`](./src/models/security/database-backup/backup.ts#L720).

**Critique:** this is adequate only if deployment explicitly provisions one worker per intended tenant and prevents overlapping workers. Otherwise facilities can be omitted or the same schedule can be executed concurrently. The actual production worker topology was not inspected.

**Remedy:** either enforce/document one leased worker per tenant or enumerate registered tenants with bounded concurrency and a database-backed schedule claim. Publish per-tenant last-success age, not merely process heartbeat.

**Acceptance:** all configured tenants are accounted for; two workers cannot both claim one due generation.

### O08. Backup status/stop CLI commands operate on a fresh local object, not the running service

**P1 | Defect in operational semantics | Confidence: high | Impact 3, risk 4, effort 2 | Score 28**

Evidence: [`src/scripts/backup-scheduler.ts:33`](./src/scripts/backup-scheduler.ts#L33) calls local `getStatus()`; [`src/scripts/backup-scheduler.ts:38`](./src/scripts/backup-scheduler.ts#L38) calls local `stop()`. The object is instantiated in the new CLI process, with local state at [`src/services/backup-scheduler.ts:11`](./src/services/backup-scheduler.ts#L11).

**Critique:** a separate status command cannot report the existing worker's actual state; a separate stop command cannot stop it. Windows service-control commands do exist, so operators should not confuse these two interfaces.

**Remedy:** remove misleading daemon-control commands or implement authenticated IPC/service-manager integration. Report durable last-run/last-success evidence separately from service process state.

**Acceptance:** status reflects an independently running worker and stop demonstrably affects that worker, or the CLI clearly refuses unsupported control.

### O09. Windows installation does not check native build/service-tool exit codes

**P1 | Defect | Confidence: high | Impact 4, risk 4, effort 2 | Score 32**

Evidence: [`scripts/windows/install-service.ps1:52`](./scripts/windows/install-service.ps1#L52) invokes the build and later checks only whether an entry file exists. Native NSSM and `sc.exe` results are piped away without exit-code checks at [`scripts/windows/install-service.ps1:106`](./scripts/windows/install-service.ps1#L106) and [`scripts/windows/install-service.ps1:116`](./scripts/windows/install-service.ps1#L116). The backup installer repeats this pattern at [`scripts/windows/install-backup-scheduler-service.ps1:56`](./scripts/windows/install-backup-scheduler-service.ps1#L56).

**Critique:** under Windows PowerShell 5.1, `$ErrorActionPreference = "Stop"` does not by itself turn nonzero native exits into terminating errors. Existing stale output can allow installation to proceed after compilation failure. This audit environment runs PowerShell 5.1.

**Remedy:** check every native result explicitly, abort on build failure before touching the service, and verify installed configuration plus readiness before printing success.

**Acceptance:** fake native tools returning nonzero exits terminate installation with a clear failure and do not start a stale release.

### O10. The default startup command assumes a PowerShell variable unavailable in Windows PowerShell 5.1

**P1 | Defect on that supported execution environment | Confidence: high | Impact 4, risk 3, effort 1 | Score 35**

Evidence: [`package.json:26`](./package.json#L26) launches `powershell` and branches on `$IsWindows`. The audit shell reported PowerShell `5.1.26100.9711`; `Get-Variable IsWindows` returned no variable.

**Critique:** Windows PowerShell 5.1 takes the false branch rather than the intended Windows service branch. This audit did not run the startup command because it can stop/restart shared services.

**Remedy:** use platform detection compatible with the invoked shell, or explicitly require and invoke PowerShell 7. Standardize pnpm commands and startup entry points across supported distributions.

**Acceptance:** safe mocked tests prove Windows service selection in every supported shell without stopping real processes.

### O11. Release quality gates are documented but not enforced by repository CI or one complete test command

**P1 | Weakness | Confidence: high | Impact 4, risk 4, effort 3 | Score 24**

Evidence: no tracked `.github/workflows/*` files were found. [`package.json:22`](./package.json#L22) runs Vitest, while [`vitest.config.ts:10`](./vitest.config.ts#L10) discovers only `src/**/*.test.ts` and [`vitest.config.ts:15`](./vitest.config.ts#L15) excludes email's separate runner. Desktop build tests have another command at [`package.json:23`](./package.json#L23); additional installer/signing `node:test` files exist outside that discovery pattern.

**Critique:** passing `pnpm test` is not proof that all repository tests ran. This does not prove that external CI is absent; external branch protections and CI services were not assessed. The local checklist correctly asks for evidence but relies heavily on operators.

**Remedy:** add a documented aggregate quality gate and CI matrix for supported runtimes, including isolated unit tests, relevant integration contracts and native packaging tests. Keep destructive/live-data checks separate and opt-in.

**Acceptance:** a clean checkout produces a recorded, reproducible gate covering every supported test runner; intentionally excluded tests are listed with reasons.

### O12. TypeScript compilation is permissive and the runtime/dependency support contract is unclear

**P2 | Weakness/risk | Confidence: high | Impact 4, risk 3, effort 4 | Score 14**

Evidence: [`tsconfig.json:2`](./tsconfig.json#L2) does not enable strict mode; [`tsconfig.json:10`](./tsconfig.json#L10) skips library checks; broad includes also cover legacy locations at [`tsconfig.json:16`](./tsconfig.json#L16). [`package.json:15`](./package.json#L15) has a Node 18 packaging target, while startup scripts use `--env-file` and the manifest does not declare an engines/package-manager contract.

**Critique:** a passing compile is valuable but does not establish strong nullability and boundary typing. Different development, service and legacy packaging paths may assume different Node capabilities. Installed dependency advisories were not queried, so no current CVE claim is made.

**Remedy:** declare supported Node/pnpm versions, exercise each actual packaging path, type new/changed domain boundaries strictly, and progressively tighten compiler policy rather than introducing an indiscriminate rewrite.

**Acceptance:** supported clean-checkout builds and packaging tests pass; stricter domain targets prevent unvalidated request/SQL values from flowing through untyped boundaries.

### O13. Legacy distribution verification resolves the wrong file and converts failure into completion

**P1 | Defect | Confidence: high | Impact 4, risk 4, effort 1 | Score 40**

Evidence: [`scripts/create-distribution.js:237`](./scripts/create-distribution.js#L237) generates the verifier inside the distribution directory. [`scripts/create-distribution.js:374`](./scripts/create-distribution.js#L374) changes the process working directory and then uses a relative CommonJS `require`, which resolves relative to the calling script rather than the changed working directory. Its catch prints "Verification complete."

**Critique:** the builder can announce completion without loading the verifier it just created. This does not establish that every newer licensed-desktop build path is broken; the finding is about this legacy distribution command.

**Remedy:** execute the generated verifier by its resolved absolute path in an isolated process, propagate a nonzero result, and emit completion only after verification passes. Use a fixture output directory to avoid overwriting customer artifacts.

**Acceptance:** deliberately removing a required fixture file makes the distribution command fail rather than print successful completion.

## 4. Backend domain critique

### B01. Legacy role middleware authorizes a caller-selected employee rather than the session actor

**P0 | Defect | Confidence: high | Impact 5, risk 4, effort 2 | Score 36**

Evidence: [`src/middleware/validateTenancy.ts:238`](./src/middleware/validateTenancy.ts#L238) reads a query/body employee ID for administrator authorization. The scientist/phlebotomist helper has the same identity-trust problem. Global session authentication at [`src/app.ts:152`](./src/app.ts#L152) does not correct helpers that ignore the established actor. Billing management uses these helpers at [`src/controllers/billing/index.ts:90`](./src/controllers/billing/index.ts#L90).

**Critique:** possession of a valid session and the identity of a privileged employee must not be interchangeable with being that employee. Stronger newer authorization middleware coexists with legacy gates, creating inconsistent protection.

**Remedy/acceptance:** derive authorization exclusively from the verified session actor and tenant. Add route-contract tests proving that a lower-privilege actor cannot acquire permissions by submitting another employee ID. Preserve employee selection only as an independently authorized resource field.

### B02. Ordinary billing trusts body-supplied identity for discount policy and audit attribution

**P0 | Defect | Confidence: high | Impact 5, risk 4, effort 3 | Score 27**

Evidence: [`src/controllers/billing/index.ts:67`](./src/controllers/billing/index.ts#L67), [`src/controllers/applicationsettings/handler.ts:501`](./src/controllers/applicationsettings/handler.ts#L501), [`src/models/billing/billing-new-client-multi.ts:274`](./src/models/billing/billing-new-client-multi.ts#L274). The supplied employee's role determines whether discount-limit enforcement is bypassed; that identity also participates in billing attribution.

**Critique:** this is a business-integrity problem as well as an access-control problem. A transaction can be attributed to someone other than the authenticated operator, and privileged discount treatment can follow that supplied identity.

**Remedy/acceptance:** bind the authenticated actor throughout submission, pricing exceptions, payment creation and audit history. Tests must distinguish the operator from any legitimate selected clinician, marketer or beneficiary and reject impersonated discount overrides.

### B03. Result audit history exposes ordinary create/delete operations without a dedicated authority gate

**P0 | Defect | Confidence: high | Impact 5, risk 4, effort 2 | Score 36**

Evidence: [`src/controllers/result/route.ts:104`](./src/controllers/result/route.ts#L104), [`src/controllers/result/testResultsAuditLogsController.ts:5`](./src/controllers/result/testResultsAuditLogsController.ts#L5), [`src/controllers/result/testResultsAuditLogsController.ts:54`](./src/controllers/result/testResultsAuditLogsController.ts#L54), [`src/controllers/result/testResultsAuditLogs.ts:32`](./src/controllers/result/testResultsAuditLogs.ts#L32), [`src/controllers/result/testResultsAuditLogs.ts:131`](./src/controllers/result/testResultsAuditLogs.ts#L131). Create uses submitted data and delete removes the selected record; ordinary global authentication is not an audit-governance policy.

**Critique:** a clinical audit trail is not just another editable CRUD resource. Its credibility depends on server-generated identity, linkage to the actual mutation, and protection from ordinary deletion.

**Remedy/acceptance:** generate history inside clinical write transactions; remove ordinary user deletion/forged creation paths. If correction or legal retention deletion is required, implement a narrowly privileged, separately recorded process. Test that ordinary authenticated users cannot alter history.

### B04. Email attachment paths cross an insufficiently constrained filesystem boundary

**P0 | Defect in source boundary; exposure depends on enabled provider and file access | Confidence: high | Impact 5, risk 4, effort 3 | Score 27**

Evidence: [`src/controllers/email/route.ts:69`](./src/controllers/email/route.ts#L69), [`src/controllers/email/route.ts:89`](./src/controllers/email/route.ts#L89), [`src/models/application/email/dtos/CreateEmailJobDto.ts:1`](./src/models/application/email/dtos/CreateEmailJobDto.ts#L1), [`src/models/application/email/services/providers/SmtpEmailProvider.ts:38`](./src/models/application/email/services/providers/SmtpEmailProvider.ts#L38). Queue/process routes have module activation but not the provider-management owner-role boundary. Submitted attachment paths reach the transport.

**Critique:** allowing request-supplied server paths confuses approved tenant documents with arbitrary files readable by the service. No file-send attempt was made in this audit.

**Remedy/acceptance:** authorize queue/process actions and recipients, accept tenant-scoped attachment IDs, resolve approved files under canonical storage roots and enforce type/size limits. Tests reject foreign-tenant attachments and paths outside approved roots without reading or transmitting them.

### B05. Inventory payment analytics interpolates request dates into SQL and returns raw errors

**P0 | Defect | Confidence: high | Impact 4, risk 4, effort 2 | Score 32**

Evidence: [`src/controllers/inventory/InventoryPaymentAnalyticsController.ts:33`](./src/controllers/inventory/InventoryPaymentAnalyticsController.ts#L33), [`src/controllers/inventory/InventoryPaymentAnalyticsController.ts:71`](./src/controllers/inventory/InventoryPaymentAnalyticsController.ts#L71), [`src/models/inventory/InventoryPaymentAnalytics.ts:30`](./src/models/inventory/InventoryPaymentAnalytics.ts#L30), [`src/models/inventory/InventoryPaymentAnalytics.ts:57`](./src/models/inventory/InventoryPaymentAnalytics.ts#L57), [`src/models/inventory/InventoryPaymentAnalytics.ts:143`](./src/models/inventory/InventoryPaymentAnalytics.ts#L143).

**Critique:** free-form date input is embedded in raw SQL literals instead of bound values. Returning database error messages also reveals implementation details. This source finding was not tested against a live database.

**Remedy/acceptance:** validate supported date formats/order and bind parameters in every query. Use repository-standard error responses with sanitized diagnostic logging. Tests must prove request values remain parameters and invalid ranges fail explicitly.

### B06. Payment analytics applies inconsistent date predicates across related metrics

**P1 | Defect | Confidence: high | Impact 3, risk 4, effort 1 | Score 35**

Evidence: [`src/models/inventory/InventoryPaymentAnalytics.ts:91`](./src/models/inventory/InventoryPaymentAnalytics.ts#L91), [`src/models/inventory/InventoryPaymentAnalytics.ts:119`](./src/models/inventory/InventoryPaymentAnalytics.ts#L119), [`src/models/inventory/InventoryPaymentAnalytics.ts:143`](./src/models/inventory/InventoryPaymentAnalytics.ts#L143). Payment count omits the requested upper bound that the amount includes; daily/hourly series introduce fixed recent-window lower bounds.

**Critique:** apparently related counts, amounts and trend series can describe different populations. Attractive charts make this more dangerous, not less: staff reasonably expect one selected period to mean one coherent reporting scope.

**Remedy/acceptance:** build one validated range definition and reuse it for every metric. Fixture tests include transactions before, within and after a historical requested range and verify counts, amounts and series agree.

### B07. Credentialed CORS reflects arbitrary requesting origins

**P1 | Configuration-dependent risk | Confidence: medium | Impact 4, risk 3, effort 2 | Score 28**

Evidence: [`src/app.ts:107`](./src/app.ts#L107) reflects the origin and enables credentials.

**Critique:** the trusted browser-origin boundary is not explicit. Cookie attributes, CSRF policy, reverse proxies and real deployed origins were not fully evaluated, so this is not a claim that every browser can presently perform cross-site authenticated actions.

**Remedy/acceptance:** configure an explicit allowed-origin set and verify it with session cookie and CSRF policy. Tests cover approved frontend origins, hostile origins, absent origins and preflight behavior without breaking legitimate deployments.

### B08. Email processing lacks an atomic claim and guards against replaying completed jobs

**P1 | Weakness with demonstrated unsafe state transition | Confidence: high | Impact 3, risk 4, effort 3 | Score 21**

Evidence: [`src/models/application/email/repositories/EmailQueueRepo.ts:46`](./src/models/application/email/repositories/EmailQueueRepo.ts#L46) selects eligible rows; [`src/models/application/email/services/EmailQueueService.ts:117`](./src/models/application/email/services/EmailQueueService.ts#L117) processes selected jobs; [`src/models/application/email/services/EmailQueueService.ts:145`](./src/models/application/email/services/EmailQueueService.ts#L145) loads and changes a job to processing without requiring an eligible prior state.

**Critique:** multiple processors can select the same work, and direct processing can replay an already-sent job. For result communication, duplicate sends and inaccurate delivery histories matter.

**Remedy/acceptance:** use conditional transactional claims/leases, explicit job-state transitions and audited manual retry. Concurrent fixture processors must produce one provider invocation per claimed generation; sent jobs must not silently re-enter processing. Do not promise exactly-once external delivery without provider support.

### B09. Attendance and leave require an explicit role/resource boundary

**P1 | Weakness; intended policy needs confirmation | Confidence: high for inspected routing, medium for policy | Impact 4, risk 4, effort 3 | Score 24**

Evidence: [`src/middleware/payrollAuthority.ts:5`](./src/middleware/payrollAuthority.ts#L5), [`src/controllers/payroll/routes.ts:65`](./src/controllers/payroll/routes.ts#L65), [`src/controllers/payroll/attendanceController.ts:224`](./src/controllers/payroll/attendanceController.ts#L224), [`src/controllers/payroll/leaveController.ts:205`](./src/controllers/payroll/leaveController.ts#L205). The inspected authority middleware gates finance/selected reports but passes other paths through. Bulk attendance, overtime approval and leave actions accept selected employee IDs.

**Critique:** self-service, supervisor approval and HR administration are materially different powers. They should not depend on an implicit UI convention.

**Remedy/acceptance:** document and enforce a role/resource matrix. Self-service derives the employee from the session; cross-employee changes require authorized HR/supervisor scope. Test approval, rejection, bulk writes and balance initialization separately.

### B10. Ordinary billing submission lacks a durable, visible retry-idempotency contract

**P1 | Reliability risk | Confidence: high for source gap | Impact 5, risk 3, effort 4 | Score 16**

Evidence: [`src/controllers/applicationsettings/handler.ts:548`](./src/controllers/applicationsettings/handler.ts#L548), [`src/models/billing/billing-new-client-multi.ts:56`](./src/models/billing/billing-new-client-multi.ts#L56), [`src/models/billing/billing-new-client-multi.ts:220`](./src/models/billing/billing-new-client-multi.ts#L220). The ordinary handler does not provide the optional write hooks; duplicate checking is hook-dependent and submission without a billing ID generates a new one.

**Critique:** a timeout after commit can encourage a cashier to submit again and potentially produce a second bill/order. This audit did not establish that duplicate bills have occurred.

**Remedy/acceptance:** persist a tenant-scoped idempotency key and original response in the billing transaction under a unique constraint. Test concurrent duplicates and retries after a simulated lost response; reject reuse with a different payload.

### B11. Commission calculation is launched after billing commit without a proven durable recovery handoff

**P1 | Reliability risk | Confidence: medium | Impact 4, risk 3, effort 4 | Score 14**

Evidence: [`src/models/billing/billing-new-client-multi.ts:628`](./src/models/billing/billing-new-client-multi.ts#L628), [`src/models/billing/billing-new-client-multi.ts:669`](./src/models/billing/billing-new-client-multi.ts#L669), [`src/models/billing/billing-new-client-multi.ts:742`](./src/models/billing/billing-new-client-multi.ts#L742). Deferred failures are logged and service-level iteration can continue.

**Critique:** financial follow-up work should survive a process crash rather than depend on an in-memory continuation. An independent reconciliation mechanism might mitigate this, but its completeness was not established.

**Remedy/acceptance:** persist commission work in a transactional outbox, process it idempotently and expose pending/failed reconciliation. Preserve the existing paid-amount and eligible outsourced-net business rules; test crash recovery and compare results against a defined ledger fixture.

### B12. General request parsing allows large unauthenticated allocation before rejection

**P1 | Resource-exposure risk, not a measured performance incident | Confidence: high for source ordering | Impact 2, risk 3, effort 1 | Score 25**

Evidence: [`src/app.ts:118`](./src/app.ts#L118) configures 50 MB JSON/URL-encoded parsers before global authentication at [`src/app.ts:152`](./src/app.ts#L152).

**Critique:** every general endpoint should not inherit upload-sized parsing limits. A valid performance claim requires load testing, which was not performed.

**Remedy/acceptance:** set conservative default limits and deliberate route-specific exceptions; place authentication before large parsing where the contract permits. Oversized unauthenticated requests should fail early with bounded resource usage.

## 5. Staff application and clinical user experience

### F01. A legacy specimen-storage page presents browser-only demo state as an operational workspace

**P1 | Defect in that page's operational behavior | Confidence: high | Impact 5, risk 5, effort 3 | Score 30**

Evidence: [`../lobnos/app/operations/laboratory/sample/storage/page.tsx:108`](../lobnos/app/operations/laboratory/sample/storage/page.tsx#L108) seeds local samples/locations; [`page.tsx:211`](../lobnos/app/operations/laboratory/sample/storage/page.tsx#L211) changes sample state locally; [`page.tsx:247`](../lobnos/app/operations/laboratory/sample/storage/page.tsx#L247) adds records only to component state. Editing also populates a create form without an editing identity and appends a new location: [`page.tsx:227`](../lobnos/app/operations/laboratory/sample/storage/page.tsx#L227), [`page.tsx:283`](../lobnos/app/operations/laboratory/sample/storage/page.tsx#L283).

**Critique:** local interactions can look like persisted clinical actions, but reload loses them. An apparent edit can create a duplicate location. This is specifically the legacy `/operations/laboratory/sample/storage` page, **not** a claim that PLS lacks real storage/retention functionality. The legacy page is directly routable, but the inspected navigation search did not find a current link to it. The laboratory landing instead links to the real workflow at [`../lobnos/app/operations/laboratory/page.tsx:14`](../lobnos/app/operations/laboratory/page.tsx#L14); its wrapper is [`../lobnos/app/operations/phelobotomy/specimen-storage/page.tsx:4`](../lobnos/app/operations/phelobotomy/specimen-storage/page.tsx#L4).

**Remedy/acceptance:** retire or explicitly mark this legacy route as a non-operational demo and direct staff to the persisted workflow. If it must remain operational, use the tenant-scoped lifecycle APIs and genuine update identity. Reload and concurrent-user tests must preserve recorded changes and must not duplicate edits.

### F02. Printing-tracking API errors can be converted into an empty audit history

**P1 | Defect | Confidence: high | Impact 4, risk 3, effort 2 | Score 28**

Evidence: [`../lobnos/app/operations/laboratory/validated/printing-tracking/[ascensionid]/page.tsx:39`](../lobnos/app/operations/laboratory/validated/printing-tracking/[ascensionid]/page.tsx#L39) accepts arrays but maps other response payloads to an empty list and clears the error. The resulting empty state is rendered at [`page.tsx:212`](../lobnos/app/operations/laboratory/validated/printing-tracking/[ascensionid]/page.tsx#L212).

**Critique:** "there are no records" and "the history could not be retrieved" have different clinical/audit meanings. Throwing-network-error handling is not enough if the API returns a structured failure object.

**Remedy/acceptance:** validate the response envelope before interpreting data, preserve an explicit failure state, and provide retry. Tests cover successful empty data, structured API failure and rejected requests as distinct states.

### F03. Failed workbench refreshes leave old rows actionable

**P1 | Defect | Confidence: high | Impact 4, risk 3, effort 2 | Score 28**

Evidence: [`../lobnos/app/operations/laboratory/workbench/page.tsx:30`](../lobnos/app/operations/laboratory/workbench/page.tsx#L30) sets a refresh error without clearing or marking retained rows stale; [`page.tsx:136`](../lobnos/app/operations/laboratory/workbench/page.tsx#L136) still renders row actions.

**Critique:** after a failed filter/search/page change, staff can act on data belonging to the previous request. Retaining data can be a good UX choice, but only when its stale status and allowed actions are explicit.

**Remedy/acceptance:** distinguish query-changing loads from same-query refreshes, label stale rows and prevent unsafe actions until validation succeeds. Simulated failed refreshes must not silently preserve apparently current actionable rows.

### F04. Workbench secondary requests do not provide complete failure UX

**P1 | Defect | Confidence: high | Impact 3, risk 3, effort 2 | Score 24**

Evidence: [`../lobnos/app/operations/laboratory/workbench/page.tsx:48`](../lobnos/app/operations/laboratory/workbench/page.tsx#L48) loads options without a rejection handler; [`page.tsx:58`](../lobnos/app/operations/laboratory/workbench/page.tsx#L58) loads history without a request-specific error/loading state.

**Critique:** blank assignment options or history can look like missing configuration rather than a request failure. The main worklist's explicit error handling is a good pattern that should also cover secondary operations.

**Remedy/acceptance:** use operation-specific loading/error/retry states and handle rejected promises. Failure tests must display why options/history are unavailable rather than silently show a blank control.

### F05. Storage-form labels lack programmatic associations

**P2 | Accessibility defect | Confidence: high | Impact 3, risk 4, effort 1 | Score 35**

Evidence: [`../lobnos/app/operations/laboratory/sample/storage/page.tsx:901`](../lobnos/app/operations/laboratory/sample/storage/page.tsx#L901) renders sibling labels and controls without `htmlFor`/`id` or wrapping associations.

**Critique:** visual proximity is not an accessible name. Screen-reader and voice-control users may not identify fields reliably; label clicks do not focus the intended control. Fixing or retiring this page should not leave inaccessible form patterns elsewhere.

**Remedy/acceptance:** use associated, unique labels in shared field components and verify keyboard/accessibility behavior. All retained storage controls must expose their visible names programmatically.

### F06. Printing-tracking pagination buttons have no accessible names

**P2 | Accessibility defect | Confidence: high | Impact 3, risk 3, effort 1 | Score 30**

Evidence: [`../lobnos/app/operations/laboratory/validated/printing-tracking/[ascensionid]/page.tsx:130`](../lobnos/app/operations/laboratory/validated/printing-tracking/[ascensionid]/page.tsx#L130) uses SVG-only arrow buttons without text or an accessible label.

**Remedy/acceptance:** name previous/next controls explicitly and test focus order, disabled states and activation. Keep icons as visual reinforcement, not the only control description.

### F07. Route/role policy remains split between centralized policy and legacy proxy branches

**P2 | Weakness | Confidence: medium | Impact 3, risk 3, effort 3 | Score 18**

Evidence: [`../lobnos/lib/roleNavigationPolicy.ts:8`](../lobnos/lib/roleNavigationPolicy.ts#L8), [`../lobnos/proxy.ts:100`](../lobnos/proxy.ts#L100), [`../lobnos/proxy.ts:164`](../lobnos/proxy.ts#L164). Shared policy is applied alongside additional role-specific branching.

**Critique:** navigation visibility, direct-route access and server mutation authority need one understandable contract, even though they are separate enforcement layers. This finding does not establish a frontend route bypass.

**Remedy/acceptance:** consolidate policy or explicitly document the required layering and precedence. Test the role-by-route matrix, direct navigation and expired-session behavior; server authorization must remain independent of UI flags.

### F08. Large client pages and hook-shim tests limit confidence in actual clinical interaction

**P2 | Weakness | Confidence: high | Impact 3, risk 4, effort 4 | Score 14**

Evidence: [`../lobnos/app/operations/laboratory/sample/storage/page.tsx:66`](../lobnos/app/operations/laboratory/sample/storage/page.tsx#L66) through its tables/dialogs combines multiple models, local persistence substitutes and modal workflows. [`../lobnos/tests/laboratory-workflow.test.cjs:9`](../lobnos/tests/laboratory-workflow.test.cjs#L9) and [`laboratory-workflow.test.cjs:48`](../lobnos/tests/laboratory-workflow.test.cjs#L48) use transpilation and a lightweight React hook shim; the Node test command is at [`../lobnos/package.json:33`](../lobnos/package.json#L33).

**Critique:** useful helper/render-tree tests cannot establish real focus behavior, viewport overflow, request races or end-to-end persistence. Splitting components is valuable only if it makes real workflow contracts more testable, not merely to reduce file size.

**Remedy/acceptance:** extract domain-focused hooks/components and add focused DOM/browser scenarios for the persisted clinical paths, request failure/retry, modal focus and narrow screens. Keep current helper tests as fast complementary coverage.

### F09. Shared fetch normalization assumes every relevant failure payload has a string message

**P1 | Defect | Confidence: high | Impact 4, risk 3, effort 2 | Score 28**

Evidence: [`../lobnos/components/Auth/customFetch.js:84`](../lobnos/components/Auth/customFetch.js#L84) parses JSON and calls `message.toLowerCase()` for certain failure statuses without validating that the message exists and is a string; the catch rethrows.

**Critique:** a non-JSON gateway response or differently shaped API error becomes a normalization exception rather than a deliberate session/network/server error. Local pages must compensate inconsistently, multiplying failure-UX bugs.

**Remedy/acceptance:** define a typed success/error boundary that respects HTTP status, optional response bodies and session-expiry semantics. Tests cover HTML proxy failures, missing/non-string messages, malformed JSON, authorization failure and valid empty responses.

### F10. Analytics calendar-date defaults can shift in UTC-positive time zones

**P1 | Defect when used in affected time zones | Confidence: high | Impact 4, risk 3, effort 2 | Score 28**

Evidence: [`../lobnos/app/analytics/sales/dailySalesTrend/page.tsx:80`](../lobnos/app/analytics/sales/dailySalesTrend/page.tsx#L80), [`../lobnos/app/analytics/expenses/top-expense-merchants/page.tsx:60`](../lobnos/app/analytics/expenses/top-expense-merchants/page.tsx#L60), [`page.tsx:275`](../lobnos/app/analytics/expenses/top-expense-merchants/page.tsx#L275). Local calendar dates are converted using `toISOString().split('T')[0]`.

**Critique:** date-only report boundaries are not UTC instants. Local midnight in a UTC-positive zone serializes as the previous UTC calendar day. This is not a claim that a UTC-based facility's current reports are already shifted.

**Remedy/acceptance:** use a shared date-only formatter and an explicit facility/reporting timezone contract. Multi-timezone tests cover month/year boundaries, daylight-saving transitions where relevant and historical range selection.

### F11. Payment-method lookup failure silently blocks cash collection

**P1 | Defect | Confidence: high | Impact 3, risk 3, effort 1 | Score 30**

Evidence: [`../lobnos/app/billing/cash-collection/page.tsx:144`](../lobnos/app/billing/cash-collection/page.tsx#L144) catches payment-mode failures without exposing a retry/error state. The UI maps the loaded modes at [`page.tsx:846`](../lobnos/app/billing/cash-collection/page.tsx#L846), while submission requires a selected mode at [`page.tsx:367`](../lobnos/app/billing/cash-collection/page.tsx#L367).

**Critique:** "select a method" is not useful when a failed lookup leaves no method to select. Staff may reasonably mistake a recoverable request failure for configuration or permissions trouble.

**Remedy/acceptance:** distinguish loading, failed lookup and successfully empty configuration; offer retry without losing collection context. Existing retry-idempotency protection must remain intact.

### F12. Payment-method buttons declare radio semantics without the radio keyboard interaction

**P2 | Accessibility weakness | Confidence: high | Impact 2, risk 3, effort 2 | Score 20**

Evidence: [`../lobnos/app/billing/cash-collection/page.tsx:846`](../lobnos/app/billing/cash-collection/page.tsx#L846) uses `radiogroup`/`radio` roles on buttons without the expected arrow-key handling and roving tab index.

**Critique:** semantics and actual interaction disagree. Native buttons can be keyboard-operated, but that alone does not implement the announced radio-group pattern.

**Remedy/acceptance:** use native labeled radio inputs or implement the complete radio pattern, including selected state, focus and arrow-key behavior. Verify it with real keyboard/DOM tests.

## 6. Public website and product presentation

### W01. Lead-form native fallback can submit contact details in the URL

**P1 | Defect when the client handler is unavailable | Confidence: high | Impact 5, risk 3, effort 2 | Score 32**

Evidence: [`../primelaboratorysystems/src/components/forms/LeadForm.tsx:10`](../primelaboratorysystems/src/components/forms/LeadForm.tsx#L10), [`LeadForm.tsx:40`](../primelaboratorysystems/src/components/forms/LeadForm.tsx#L40). The form uses an `onSubmit` handler but lacks an HTML method/action fallback.

**Critique:** without the client handler, native HTML form submission defaults to GET. Contact fields can appear in browser history, URLs and request logs. JavaScript success-path testing does not cover this condition.

**Remedy/acceptance:** provide a safe server-side POST fallback compatible with validation/abuse controls, or prevent sensitive native GET submission explicitly. A JavaScript-disabled or pre-hydration test must never place submitted contact details in a URL.

### W02. Booking collects personal details while published legal pages remain drafts

**P1; launch gate for real public booking promotion | Readiness risk | Confidence: high | Impact 5, risk 4, effort 3 | Score 27**

Evidence: [`../primelaboratorysystems/src/components/marketplace/BookingRequestForm.tsx:128`](../primelaboratorysystems/src/components/marketplace/BookingRequestForm.tsx#L128) collects contact details and potentially a collection address. [`../primelaboratorysystems/src/app/privacy-policy/page.tsx:8`](../primelaboratorysystems/src/app/privacy-policy/page.tsx#L8) and [`../primelaboratorysystems/src/app/terms/page.tsx:8`](../primelaboratorysystems/src/app/terms/page.tsx#L8) explicitly identify draft content; both are linked at [`../primelaboratorysystems/src/components/layout/SiteFooter.tsx:25`](../primelaboratorysystems/src/components/layout/SiteFooter.tsx#L25).

**Critique:** transparent draft labels are better than invented legal assurances, but not a completed public-data collection policy. This is an engineering/product launch concern, not a legal determination of noncompliance.

**Remedy/acceptance:** obtain qualified review of purposes, recipients, retention, facility/platform responsibilities, contact and applicable rights. Match actual data collection and processing to the approved disclosure before promoting real bookings.

### W03. Lead validation discards field identity and lacks field-specific accessible errors

**P2 | Accessibility/usability defect | Confidence: high | Impact 3, risk 4, effort 2 | Score 28**

Evidence: [`../primelaboratorysystems/src/app/api/lead/route.ts:75`](../primelaboratorysystems/src/app/api/lead/route.ts#L75) returns field-keyed errors; [`../primelaboratorysystems/src/components/forms/LeadForm.tsx:24`](../primelaboratorysystems/src/components/forms/LeadForm.tsx#L24) reduces them to one message, and controls at [`LeadForm.tsx:42`](../primelaboratorysystems/src/components/forms/LeadForm.tsx#L42) lack matching invalid/error associations.

**Critique:** a visitor must infer which field failed. Showing an alert is not equivalent to identifying and explaining errors at the controls.

**Remedy/acceptance:** preserve keyed errors, set invalid state and associate messages with controls; focus the first invalid control appropriately. Tests verify multiple simultaneous errors and accessible correction.

### W04. Ambiguous lead-delivery failures are described as definitely unsent

**P1 | Reliability/UX risk | Confidence: medium-high | Impact 3, risk 3, effort 3 | Score 18**

Evidence: [`../primelaboratorysystems/src/app/api/lead/route.ts:128`](../primelaboratorysystems/src/app/api/lead/route.ts#L128) forwards with an eight-second timeout; [`../primelaboratorysystems/src/components/forms/LeadForm.tsx:33`](../primelaboratorysystems/src/components/forms/LeadForm.tsx#L33) tells the visitor the message was not sent. No visible forwarded idempotency key was established.

**Critique:** an upstream can accept a lead before its response is lost. Retrying can duplicate enquiries, while definitive failure copy misrepresents the known state.

**Remedy/acceptance:** use durable/idempotent delivery and distinguish rejected from unconfirmed outcomes. Test an accepted upstream request with a lost response and prove retry does not create another enquiry.

### W05. Website health proves process liveness, not enquiry or marketplace readiness

**P1 | Monitoring risk | Confidence: high for implementation, production usage unknown | Impact 3, risk 3, effort 2 | Score 24**

Evidence: [`../primelaboratorysystems/src/app/api/health/route.ts:3`](../primelaboratorysystems/src/app/api/health/route.ts#L3) returns a static success without checking required dependencies/configuration.

**Critique:** this is acceptable as a liveness endpoint. It is inadequate if interpreted as proof that bookings, portals or lead delivery work. Actual monitoring configuration was not inspected.

**Remedy/acceptance:** label liveness clearly and introduce a separate bounded readiness signal for required configured dependencies. Simulated upstream/configuration failures must make the relevant readiness state unhealthy without exposing secrets or invoking real transactions.

### W06. Custom pricing is honest but provides limited commercial self-qualification

**P2 | Product/conversion tradeoff | Confidence: high | Impact 3, risk 3, effort 2 | Score 24**

Evidence: [`../primelaboratorysystems/src/app/pricing/page.tsx:17`](../primelaboratorysystems/src/app/pricing/page.tsx#L17), [`pricing/page.tsx:32`](../primelaboratorysystems/src/app/pricing/page.tsx#L32), [`../primelaboratorysystems/src/data/pricing.ts:37`](../primelaboratorysystems/src/data/pricing.ts#L37).

**Critique:** quotation scopes avoid unsupported fixed prices, but prospects still lack a clear budget-fit signal and quote-response expectation. This is not a recommendation to invent amounts or represent scopes as licensed tiers.

**Remedy/acceptance:** have the commercial owner approve any budgetary range/minimum, exclusions and response-time promise. If prices cannot be published, clearly explain quote inputs, deliverables and next steps; measure qualified enquiries and abandonment before claiming improved conversion.

### W07. Screenshot evidence documentation and regression thresholds lag the published inventory

**P2 | Documentation/test weakness | Confidence: high | Impact 3, risk 3, effort 1 | Score 30**

Evidence: [`../primelaboratorysystems/README.md:50`](../primelaboratorysystems/README.md#L50) describes 42 captures/18 reporting views; [`../primelaboratorysystems/docs/product-capability-evidence.md:30`](../primelaboratorysystems/docs/product-capability-evidence.md#L30) still refers to 28; [`../primelaboratorysystems/src/data/product-screens.test.ts:11`](../primelaboratorysystems/src/data/product-screens.test.ts#L11) requires only at least 28.

**Critique:** the current analytics screenshots are present. The weakness is that old documentation and a permissive threshold can allow substantial future regression without an obvious gate. Asset integrity tests are a useful existing strength.

**Remedy/acceptance:** derive public counts from the registry, update evidence notes and test the intended set/report coverage explicitly. Intentional removals must update the documented expectation rather than silently pass an obsolete minimum.

### W08. Portal entry requires verified destination configuration that must be exercised before launch

**P1 | Configuration-dependent readiness risk | Confidence: high for fallback behavior | Impact 4, risk 2, effort 2 | Score 24**

Evidence: [`../primelaboratorysystems/src/app/facility-login/page.tsx:11`](../primelaboratorysystems/src/app/facility-login/page.tsx#L11), [`../primelaboratorysystems/src/app/patient-portal/page.tsx:10`](../primelaboratorysystems/src/app/patient-portal/page.tsx#L10). Configuration requirements are documented at [`../primelaboratorysystems/README.md:95`](../primelaboratorysystems/README.md#L95) and [`README.md:118`](../primelaboratorysystems/README.md#L118).

**Critique:** approved-destination gating is the right boundary, not a defect to bypass. However, promoting portal entry without a verified configured destination can terminate the user journey in "contact an administrator." Live destinations were not checked.

**Remedy/acceptance:** smoke-test each approved destination, facility selection and fallback contact path in the intended deployment. Do not weaken origin validation simply to make every arbitrary URL clickable.

## 7. Validation actually performed

- Backend `pnpm exec tsc --noEmit`: passed during this audit, without emitting build files.
- Backend `pnpm exec vitest run src\licensing\license.test.ts src\licensing\protection.test.ts src\licensing\legacy-window.test.ts`: 60 tests passed in 3 files.
- Vite emitted a configuration-loader compatibility warning; this is a future tooling risk, not a failed test.
- Website `pnpm test`: 96 tests passed across 25 files during this audit.
- Website `pnpm typecheck`: passed; website `pnpm lint`: passed during this audit.
- Staff-application review was source-based; no fresh frontend tests, build, browser or screen-reader checks were run.
- Tracked-file metadata and deployment/backup source were inspected; runtime environment contents were not opened.
- Production deployment, service restart, backup creation, restore, notification dispatch and payment mutations were intentionally not run.

Earlier sessions' tests and browser checks are not presented as fresh whole-product certification.

## 8. Remediation roadmap

### Triage order

This shortlist prioritizes release gates, then high-value localized fixes. The detailed sections above remain the complete finding register.

| Order | Findings | Why first | Suggested accountable owner |
|---|---|---|---|
| 1 | B01-B05 | Actor identity, clinical audit integrity, attachment boundary and SQL handling | Backend/domain lead with independent review |
| 2 | O01 | Prevent runtime configuration from entering source/distributions; establish rotation scope | Platform owner and credential owners |
| 3 | O04-O06 | Prevent false full-system assurance and deletion of recovery points | Platform/database owner |
| 4 | O02-O03, O09-O10, O13 | Make release and installation outcomes coherent, scoped and truthful | Release/platform owner |
| 5 | B06, F09-F11 | Correct report scope and remove high-frequency failure-UX traps | Analytics and frontend leads |
| 6 | B08-B11, O07-O08 | Durable job/retry behavior, role policy and per-tenant recovery coverage | Domain owners with platform support |
| 7 | W01-W02, W04-W05, W08 | Safe public submission, approved disclosures and launch readiness | Website lead, product/legal and operations |
| 8 | O11-O12, F01-F08, F12, W03, W06-W07, B07, B12 | Enforce quality gates, retire misleading legacy paths and improve consistency/accessibility | Engineering lead and product/design owners |

Some localized P2 accessibility fixes score highly and can be delivered alongside P0/P1 work. The score is not a justification to postpone clinical safety behind cosmetics, nor to defer cheap accessibility repairs indefinitely.

### Phase A: establish a production/recovery baseline

Indicative first cycle: focus on P0 paths rather than new feature work.

1. Bind privileged actions and financial attribution to the actual session actor; lock down result history and attachment/SQL boundaries.
2. Review tracked/distributed configuration without circulating its contents; identify any required rotation and provision sanitized artifacts.
3. Stop destructive retention after failed backup attempts. Correct/reject full-system schedule semantics.
4. Deploy an immutable, tested revision with scoped restart, explicit native exit checks and readiness/rollback evidence.
5. Restore a fixture database and its referenced private files into an isolated environment. Record recovery owner, RPO/RTO targets and measured recovery result.

**Exit gate:** no unmitigated P0 path is relied on; actor/audit/SQL/attachment contract tests pass; failed backup and release fixtures preserve the previous recovery/release state. A running backup service or green liveness endpoint alone does not satisfy the gate.

### Phase B: make work and reporting trustworthy

1. Unify analytics date-only/range semantics and fixture reconciliation.
2. Make billing retries and deferred commission/email processing durable and idempotent.
3. Define attendance/leave self-service and approval authority explicitly.
4. Introduce consistent typed fetch errors, stale-data policy and request-specific retry states.
5. Establish tenant-aware backup claims, last-success visibility and alerting.

**Exit gate:** concurrent/retried fixture submissions produce one intended transaction; work survives an interrupted worker; report counts and totals reconcile over the same selected population; stale/error states cannot masquerade as current successful data.

### Phase C: consolidate the interface and public launch

1. Remove/label misleading legacy demo routes while preserving the real lifecycle workspace.
2. Standardize form labels, field-level errors, radio/keyboard patterns, modal focus and accessible control names.
3. Add real DOM/browser regression scenarios for registration-to-result, cash collection, specimen lifecycle and reporting failure/retry paths using approved synthetic fixtures.
4. Approve booking/privacy/terms content, verify portal destinations and make lead submission safe without client JavaScript.
5. Tighten product evidence/count tests and commercial quote expectations without inventing pricing or capability claims.

**Exit gate:** required paths work at narrow and desktop widths with keyboard-only operation; failure handling is understandable; legal/commercial owners approve the public journey; screenshots and copy remain demonstrably tied to implemented functionality.

### Phase D: sustainable engineering and targeted performance work

1. Create one reproducible, non-destructive release gate across test runners and supported runtimes.
2. Tighten new/changed domain typing and extract testable boundaries from the largest client/service components.
3. Measure p50/p95/p99 latency, database connection pressure, query plans, queue age and backup age under representative fixture load. Define capacity and SLO targets before selecting architectural changes.
4. Revisit retention, external interoperability, device/QC workflow certification and module-level accounting reconciliation as separately scoped audits.

**Exit gate:** CI evidence is retained for the actual release; performance claims have measured thresholds; each remaining risk has an owner, mitigation and review date.

## 9. Product-level conclusions and what not to do

- **Do not confuse breadth with uniform maturity.** The strong transactional and retry-safe paths show that suitable patterns already exist. Reuse those patterns where legacy paths are weaker.
- **Do not solve this with another blanket redesign.** Smaller fonts and a polished website improve presentation, but operational credibility comes from accurate state, clear failures and protected histories.
- **Do not immediately rewrite the monolith.** Establish domain contracts and evidence first; extract services only when measured scaling/ownership requirements justify the operational cost.
- **Do not delete or simplify auditability to reduce UI clutter.** Clinical result revision, specimen lineage, financial attribution and recovery history are product foundations.
- **Do not invent competitor parity, prices or predictive features.** This audit did not establish that every advanced interoperability, QC, PACS or automation feature is absent. Such claims require adapter/workflow-specific verification.
- **Do not interpret green tests as certification.** Fresh validation here covers backend compilation, isolated licensing tests and website tests/lint/types. It does not certify every clinical formula or live integration.

### Candidates not escalated as confirmed defects

- A workbench drawer declares 520px width, but Bootstrap may constrain it. Without computed-layout evidence it is only a responsive-test candidate, not a proven mobile overflow defect.
- Client supervisor/capability flags are usability controls, not server authorization. Their existence alone does not prove a bypass; the specific backend identity defects are documented separately.
- The legacy storage route's local data does not negate the separate real specimen lifecycle implementation.
- The website's approved portal fallbacks and custom-quote pricing are intentional boundaries/tradeoffs, not evidence that portals or commercial licensing are universally missing.

## 10. Follow-up audit work needed for certification

This critique is complete as a broad source-backed engineering review. Closing the following evidence gaps requires separate controlled execution and accountable domain owners:

- End-to-end synthetic clinical workflow checks: registration, ordering, specimen collection/acceptance, aliquots, result revision/approval/release, printing and communications.
- Financial reconciliation fixtures across ordinary/advanced billing, refunds, debtors, outsourced costs, paid-amount commissions, accounting posting, procurement and payroll rules.
- Explicit tenant/role matrix checks for every authenticated resource family, including cross-tenant negative cases.
- Restore drills across real supported installation formats using approved backups, including files and key-recovery requirements.
- Browser/assistive-technology testing, realistic load profiling, provider/instrument contract tests and deployment configuration checks.
- Approved legal/privacy/retention review and an independent, dedicated vulnerability assessment where assurance is required.

Until those checks are performed, market PLS's implemented capabilities accurately, but avoid claiming a comprehensive clinical, financial, accessibility, security or production-readiness certification.
