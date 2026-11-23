# Test instrument mapping integration (not wired)

Do not enable mapping configuration in production until every enforcement and startup
hook below is deployed and tested together. These files are intentionally separate from
shared startup, routing, workbench, result and maintenance files.

## Schema and routes

* Import `bootstrapTestInstrumentMapping` from
  `src/models/QualityControl/TestInstrumentMappingBootstrapper`. In
  `src/bootstrap/applicationStartup.ts`, call
  `await bootstrapTestInstrumentMapping(tenantId)` in `runApplicationBootstrappers`
  after `bootstrapCalculationAndQcTables` (and after base test/device tables exist).
  Also call `await bootstrapTestInstrumentMapping(tenant.tenantId)` in the
  `hasCurrentTenantBootstrap` skip branch: existing tenants otherwise skip new DDL.
  Treat failures as startup failures. The bootstrap uses the awaited tenant Knex
  connection, is additive, and requires `test_panels.id` and `devices.id` as in the
  repository's exported MySQL schema. Verify deployed column types, keys, collation,
  permissions and existing data before rolling out; do not run against live data
  without approval. DDL is not transactional in MySQL.
* In `src/app.ts`, import `testInstrumentMappingRoutes` from
  `./controllers/QualityControl/testInstrumentMappingRoutes`; add
  `app.use(testInstrumentMappingRoutes)` **after** `app.use(checkTokenExists)`.
  Reads require QC configuration role, writes require admin/manager; both validate
  the tenant against the authenticated session. The actor comes from that session.
* Add a navigation link in the shared frontend sidebar or QC workspace to
  `/operations/laboratory/test-instruments`. The page itself is present.

## Enforcement

Import `assertTestInstrumentEligible` from
`src/models/QualityControl/TestInstrumentMapping`. Its entire interface is:

```ts
await assertTestInstrumentEligible(trxOrDb, ascensionid);
```

It uses only the supplied tenant Knex connection/transaction. No tenant lookup is
performed. It locks the ordered test, the test definition and assignment; mapping
configuration changes lock the same test definition. Errors have `statusCode` 409
(or 404 for an absent order); do not swallow them.

* **Result entry:** in `src/models/creator/creator.ts`, within the existing save
  transaction, immediately after `beginResultSave(...)` and **before** replay return
  or `stageAnalyzerResults`, call `await assertTestInstrumentEligible(trx,
  Number(ascensionid))`. This covers normal and staged analyzer saves, including
  idempotent retries. In `ManualParameterRerunService.ts`, add the same call in the
  existing transactions for `stageManualResults` and `confirm` after the ordered-test
  lock and before any result/rerun value write. Review all other result writers and
  device interface paths for equivalent coverage.
* **Approval:** in `ResultApprovalService.approve`, call the hook inside the existing
  transaction after locking the ordered test and before approval changes. Likewise
  cover any other approval path.
* **Release and print:** in `ResultReleaseGuard.captureReportRevision`, call the hook
  before authorization checks. This covers calls from both `captureReportRevision`
  and `assertReportRevision`, including the existing transactional
  `archiveLaboratoryReport` check and `ResultReleaseService` release/manager-approval
  transactions. Also explicitly call inside those release transactions before any
  release/approval write if their flow can bypass that guard. Review the printable
  preview route: its direct `previewReport` currently checks `captureReportRevision`
  only for CRM roles; enforce the mapping for **all** relevant roles and ordered
  tests before publishing output. Audit any alternate portal/report delivery path.

Pass the existing transaction for writes/final authorization; it holds locks until
commit. Passing a plain DB is supported for a preflight: the hook opens a short
transaction, but its locks end when the hook returns. It cannot make subsequent
rendering or HTTP delivery atomic with a mapping change. Revalidate under the
publication transaction or use a mapping-version witness and a final synchronized
check before delivery. Do not claim preflight alone provides race-free release.

The workbench currently locks the ordered test and disallows changing `device_id`
after any `test_results` row exists. Preserve that invariant in **every** assignment
writer and ensure entry holds the same order lock until results commit. Never infer
an instrument or update historical assignments. Manual-only configurations reject
an assigned device; instrument mode requires an active mapped device. Unconfigured
tests are unchanged. Existing results without a device cannot be retroactively
attributed by this feature: review them and the effects on pending/previously
released reports before enabling mappings. Changing/deactivating mappings can
block old results.

## Verification

Run the mapping unit/SQLite HTTP integration tests and both repository typechecks.
Add MySQL integration tests for foreign keys/collation, concurrent assignment vs.
save, mapping update vs. save/release, and all actual result/approval/print endpoints
after wiring. SQLite tests do not establish MySQL lock semantics. No live database
checks or migrations have been performed by this change.
