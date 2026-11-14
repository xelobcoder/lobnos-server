# Restoring an encrypted PLS database backup

`npm run backup:restore` restores one encrypted (or plain) MySQL dump produced by the
existing backup job. The command is a **dry run by default**: it prints the restore plan
and never decrypts, connects to a target database or writes anything until `--execute`
is passed.

Related: [encryption rollout](./encryption-rollout.md#4-backup-keys-and-encrypted-backups),
[deployment checklist](./deployment-checklist.md).

## Prerequisites

- Build the server so `dist/src/scripts/restore-backup.js` exists: `npm run build`.
- The tenant's `.env` must be loadable and contain the database settings for the target
  host plus the backup master secret (`BACKUP_MASTER_KEY_FILE`, or the legacy
  `BACKUP_MASTER_KEY`). See key custody below.
- The MySQL **client** binary must be available. The command uses `mysql` from `PATH`, the
  default Windows MySQL 8.0 path, or the path in `MYSQL_PATH`.
- The target database must already exist. This command never creates or drops databases.

## Commands

List recorded backups for a tenant (read-only; reads `backup_logs`, opens no backup file):

```sh
npm run backup:restore -- --list --tenant 100123
```

Print the plan for restoring one backup into a scratch database (no writes):

```sh
npm run backup:restore -- --backup 42 --target-database pls_restore_drill --tenant 100123
```

Perform the restore into the scratch database:

```sh
npm run backup:restore -- --backup 42 --target-database pls_restore_drill --tenant 100123 --execute
```

`--backup` accepts a `backup_logs.id` or an absolute/relative path to a `.sql` or
`.encrypted` database dump. Backups that are recorded as failed, recorded as a
files/archive backup, missing on disk, or not ending in `.sql`/`.encrypted` are refused.

Restoring **over the tenant's own database** is refused by default. It requires both an
explicit acknowledgement and an exact confirmation of the database name:

```sh
npm run backup:restore -- --backup 42 --target-database pls_t0100123 --tenant 100123 \
  --force-overwrite-tenant --confirm pls_t0100123 --execute
```

Only do that after a write freeze, an approved recovery decision, and a verified backup
of the current data. Reserved MySQL schemas and the master control database are always
refused.

Exit codes: `0` success/dry run, `1` refused or failed, `2` restore verification failed.

## What the command does

1. Resolves the backup id/path (and its recorded encryption key id) from `backup_logs`.
2. Applies the target guard above; resolves the tenant database read-only (configured
   `DATABASE`/`PRODUCTION_DATABASE` for single-tenant mode, `prime_tenants.database_name`
   for multi-tenant mode).
3. On `--execute`: verifies the target exists, then decrypts with the existing
   `EncryptionManager.decryptFile` helper (AES-256-GCM `PLSBK002`, legacy CBC still
   readable) and streams the plaintext SQL into the `mysql` client on stdin. Credentials
   are passed in a private 0600 `--defaults-extra-file`, never on the command line.
4. Verifies the restore: compares the `CREATE TABLE` names found in the dump with the
   restored `information_schema` table set, prints exact row counts per table, and exits
   `2` if any table is missing or unexpected. No table rows or credentials are printed.

Plaintext SQL is written only to a private 0700 directory created for this invocation
(under `BACKUP_TEMP_DIRECTORY` or the OS temp directory) and is deleted in a `finally`
block. The residual risk is the plaintext that can transiently survive in a filesystem
snapshot, page file/swap or crashed process dump; keep the temp directory on encrypted
storage with service-only ACLs.

## Key custody warning

- The **backup master secret is required to restore**. Without it the per-tenant data
  keys cannot be unwrapped and the backup is unreadable. Keep it in a secret manager or a
  service-readable file outside the checkout and outside the backed-up directories.
- Escrow the master secret **separately from the database backups**: a copy stored next
  to the backups defeats encryption. Restrict file and directory ACLs to the service
  identity and named recovery operators; record who holds the escrow.
- Keep historical wrapped data-key records and backup settings with the tenant database.
  Rotating the master secret requires rewrapping those records; changing the environment
  value alone makes old backups unreadable.
- Never paste the master secret, database password or key ids into tickets, chat, logs or
  screenshots.

## Known limitations

- **Format assumption:** backups are `mysqldump --single-transaction --hex-blob` SQL
  dumps. Objects such as views/triggers/routines appear as their own statements; the
  table-count check only compares base tables declared with `CREATE TABLE`, so a schema
  that relies on views may need manual review.
- **No row-count manifest:** the current backup format stores no expected row counts per
  table. Row counts are printed for operator review; the automated comparison is the
  table-set check. Comparing a small set of row counts requires opening the source
  database, which this command deliberately does not do.
- **Client availability:** the restore requires the MySQL client binary; if it is missing
  the command fails with a clear message and no partial restore guarantee.
- **Server-side settings:** the dump restores schema/data only. MySQL server settings,
  users/grants, `DEFINER` accounts and schema collation configuration are not restored.
- **Partial failure:** if the `mysql` client fails mid-stream, the target database may be
  partially restored. Drop and recreate the scratch database before retrying.
- **Multi-tenant names:** the tenant database name is read directly from
  `prime_tenants.database_name`; if the registry is unreachable the guard cannot run and
  the restore is refused.
- **Path-only encrypted backups:** a file supplied by path with no `backup_logs` record is
  decrypted with the tenant's *active* key. Pass the backup id instead so the recorded
  key id is used, especially for backups written before a data-key rotation.

## Quarterly restore-drill checklist

- [ ] Pick the newest successful encrypted backup for one representative tenant and
      record its `backup_logs.id`, size and timestamp.
- [ ] Confirm the master-secret escrow is retrievable by an authorized operator without
      using the production application host, and that its owning operator is current.
- [ ] Create an empty scratch database (for example `pls_restore_drill`) on a
      non-production MySQL instance.
- [ ] Run the dry run and confirm the printed plan names the expected backup, tenant and
      scratch target, and that it reports no writes.
- [ ] Run with `--execute`; confirm exit code `0`, the verification line, and that the
      per-table row counts look plausible for the facility.
- [ ] Spot-check a handful of restored tables read-only (counts, latest timestamps) without
      exporting patient rows.
- [ ] Confirm the command refuses `--target-database <tenant database>` without
      `--force-overwrite-tenant --confirm <tenant database>`.
- [ ] Confirm a wrong or missing master secret fails without publishing plaintext and
      leaves no restore temp directory behind.
- [ ] Drop the scratch database, record the drill date, participants, duration, result and
      any follow-up actions in the recovery log.
- [ ] If more than 90 days have passed, rotate the backup data key and repeat a restore
      drill against a backup written under the new key.
