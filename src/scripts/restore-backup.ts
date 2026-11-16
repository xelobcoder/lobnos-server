/**
 * Operator restore command for encrypted PLS database backups.
 *
 * Safety properties:
 * - Dry run is the default. Nothing is decrypted, written or connected to a target until `--execute`.
 * - Restoring over the tenant's own database is refused unless `--force-overwrite-tenant` is combined
 *   with an exact `--confirm <tenant database name>`.
 * - Decryption reuses `EncryptionManager.decryptFile` (AES-256-GCM and readable legacy CBC); no
 *   cryptographic code is reimplemented here.
 * - Plaintext SQL exists only inside a private 0700 directory created for this invocation and is
 *   removed in a `finally` block. The residual risk (plaintext briefly on disk, recoverable from a
 *   snapshot/crash dump) is documented in docs/backup-restore.md.
 * - `--list` reads `backup_logs` only and never opens a backup file.
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { StringDecoder } from 'node:string_decoder';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { databaseTlsOptions } from '../database/tls';

export class RestoreError extends Error {
     readonly code = 'RESTORE_REFUSED';
     constructor(message: string) {
          super(message);
          this.name = 'RestoreError';
     }
}

const BACKUP_ID = /^\d+$/;
const DATABASE_NAME = /^[A-Za-z0-9_]{1,64}$/;
const ENCRYPTED_SUFFIX = '.encrypted';
const RESERVED_DATABASES = ['information_schema', 'mysql', 'performance_schema', 'sys'];

export interface RestoreArguments {
     mode: 'list' | 'restore';
     tenantId: number;
     backup?: string;
     targetDatabase?: string;
     execute: boolean;
     forceOverwriteTenant: boolean;
     confirm?: string;
}

export interface BackupRecord {
     id: number;
     backup_name?: string | null;
     backup_date?: string | Date | null;
     backup_size_bytes?: number | null;
     backup_path?: string | null;
     is_successful?: boolean | number | null;
     backup_type?: string | null;
     encryption_key_id?: string | null;
}

export interface BackupCandidate {
     path: string;
     encrypted: boolean;
     record?: BackupRecord;
}

export interface RestoreDependencies {
     stdout(line: string): void;
     stderr(line: string): void;
     listBackupRecords(tenantId: number): Promise<BackupRecord[]>;
     tenantDatabaseName(tenantId: number): Promise<string | undefined>;
     controlDatabaseName(): string | undefined;
     configuredStorageRoot(): string | undefined;
     activeKeyId(tenantId: number): Promise<string | undefined>;
     decryptToFile(tenantId: number, inputPath: string, outputPath: string, keyId: string): Promise<{ success: boolean; error?: string }>;
     targetHost(): string;
     targetExists(database: string): Promise<boolean>;
     streamDumpToTarget(database: string, plaintextPath: string): Promise<void>;
     listTargetTables(database: string): Promise<Array<{ table: string; rows: number }>>;
     tempDirectory(): string;
     fileExists(candidate: string): Promise<boolean>;
}

function requiredValue(flag: string, value: string | undefined): string {
     if (value === undefined || value === '' || value.startsWith('--')) throw new RestoreError(`Missing value for ${flag}`);
     return value;
}

export function parseRestoreArguments(argv: string[], env: Record<string, string | undefined> = process.env): RestoreArguments {
     let list = false;
     let execute = false;
     let forceOverwriteTenant = false;
     let backup: string | undefined;
     let targetDatabase: string | undefined;
     let confirm: string | undefined;
     let tenant: string | undefined;

     for (let index = 0; index < argv.length; index++) {
          const token = argv[index];
          switch (token) {
               case '--list': list = true; break;
               case '--execute': execute = true; break;
               case '--force-overwrite-tenant': forceOverwriteTenant = true; break;
               case '--backup': backup = requiredValue(token, argv[++index]); break;
               case '--target-database': targetDatabase = requiredValue(token, argv[++index]); break;
               case '--confirm': confirm = requiredValue(token, argv[++index]); break;
               case '--tenant': tenant = requiredValue(token, argv[++index]); break;
               default: throw new RestoreError(`Unknown option ${token}. Use --list, or --backup <id|path> --target-database <name> [--execute]`);
          }
     }

     if (list) {
          if (backup || targetDatabase || execute || forceOverwriteTenant || confirm) {
               throw new RestoreError('--list is read-only and cannot be combined with restore options');
          }
     } else {
          if (!backup) throw new RestoreError('Provide --list, or --backup <id|path> with --target-database <name>');
          if (!targetDatabase) throw new RestoreError('--target-database <name> is required when restoring a backup');
          if (!DATABASE_NAME.test(targetDatabase)) throw new RestoreError('--target-database must be a plain MySQL database name (letters, digits, underscore)');
     }
     if (forceOverwriteTenant && !confirm) throw new RestoreError('--force-overwrite-tenant requires --confirm <tenant database name>');
     if (confirm && !forceOverwriteTenant) throw new RestoreError('--confirm is only valid together with --force-overwrite-tenant');

     const rawTenant = tenant || env.BACKUP_TENANT_ID;
     if (!rawTenant) throw new RestoreError('Pass --tenant <id> (or set BACKUP_TENANT_ID) to select the tenant');
     if (!BACKUP_ID.test(rawTenant)) throw new RestoreError('--tenant must be a positive integer');
     const tenantId = Number(rawTenant);
     if (!Number.isSafeInteger(tenantId) || tenantId <= 0) throw new RestoreError('--tenant must be a positive integer');

     return { mode: list ? 'list' : 'restore', tenantId, backup, targetDatabase, execute, forceOverwriteTenant, confirm };
}

export interface TargetGuardInput {
     targetDatabase: string;
     tenantDatabase: string | undefined;
     controlDatabase?: string;
     forceOverwriteTenant?: boolean;
     confirm?: string;
}

export function assertRestoreTargetAllowed(input: TargetGuardInput): void {
     if (!DATABASE_NAME.test(input.targetDatabase)) throw new RestoreError('Target database must be a plain MySQL database name');
     const target = input.targetDatabase.toLowerCase();
     if (RESERVED_DATABASES.includes(target)) throw new RestoreError(`Refusing to restore into the reserved MySQL database "${input.targetDatabase}"`);
     if (input.controlDatabase && target === input.controlDatabase.toLowerCase()) {
          throw new RestoreError(`Refusing to restore into the master control database "${input.controlDatabase}"`);
     }
     if (!input.tenantDatabase) {
          throw new RestoreError('The tenant database could not be resolved, so the overwrite guard cannot run; refusing to restore');
     }
     if (target !== input.tenantDatabase.toLowerCase()) return;
     if (!input.forceOverwriteTenant) {
          throw new RestoreError(`Refusing to restore over the tenant database "${input.tenantDatabase}". Restore into a scratch database, or re-run with --force-overwrite-tenant --confirm ${input.tenantDatabase} after approval and a write freeze.`);
     }
     if (input.confirm !== input.tenantDatabase) {
          throw new RestoreError(`--force-overwrite-tenant requires --confirm ${input.tenantDatabase}`);
     }
}

function isFailedBackup(record: BackupRecord): boolean {
     return record.is_successful === false || record.is_successful === 0;
}

function assertRestorableRecord(record: BackupRecord): void {
     if (isFailedBackup(record)) throw new RestoreError(`Backup ${record.id} is recorded as failed and cannot be restored`);
     if (record.backup_type && record.backup_type !== 'database') {
          throw new RestoreError(`Backup ${record.id} is a ${record.backup_type} backup, not a database backup`);
     }
     if (!record.backup_path) throw new RestoreError(`Backup ${record.id} has no stored file path`);
}

function samePath(left: string, right: string): boolean {
     const a = path.resolve(left);
     const b = path.resolve(right);
     return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/** Resolves an id or path to a restorable file. Refuses absent, failed and non-database backups. */
export async function resolveBackupCandidate(
     backupRef: string,
     records: BackupRecord[],
     fileExists: (candidate: string) => Promise<boolean>,
): Promise<BackupCandidate> {
     let record: BackupRecord | undefined;
     let filePath: string;

     if (BACKUP_ID.test(backupRef)) {
          const id = Number(backupRef);
          record = records.find(row => Number(row.id) === id);
          if (!record) throw new RestoreError(`Backup ${id} is not recorded in backup_logs for this tenant`);
          assertRestorableRecord(record);
          filePath = path.resolve(record.backup_path!);
     } else {
          filePath = path.resolve(backupRef);
          record = records.find(row => Boolean(row.backup_path) && samePath(String(row.backup_path), filePath));
          if (record) assertRestorableRecord(record);
     }

     if (!(await fileExists(filePath))) throw new RestoreError(`Backup file is missing: ${filePath}`);
     const lower = filePath.toLowerCase();
     if (lower.endsWith('.tar.gz') || lower.endsWith('.tar.gz.encrypted') || lower.endsWith('.tgz') || lower.endsWith('.tgz.encrypted')) {
          throw new RestoreError('Only database SQL backups can be restored; the selected file is a files/archive backup');
     }
     const encrypted = lower.endsWith(ENCRYPTED_SUFFIX);
     if (!encrypted && !lower.endsWith('.sql')) {
          throw new RestoreError('Backup file must end with .sql (plain) or .encrypted (encrypted database dump)');
     }
     return { path: filePath, encrypted, record };
}

export function formatBytes(bytes: number | null | undefined): string {
     const value = Number(bytes);
     if (bytes === null || bytes === undefined || !Number.isFinite(value) || value < 0) return 'unknown';
     if (value < 1024) return `${value} B`;
     const units = ['KiB', 'MiB', 'GiB', 'TiB'];
     let size = value / 1024;
     let unit = 0;
     while (size >= 1024 && unit < units.length - 1) {
          size /= 1024;
          unit++;
     }
     return `${size.toFixed(1)} ${units[unit]}`;
}

export function formatBackupList(records: BackupRecord[], options: { tenantId: number; storageRoot?: string }): string {
     const lines = [`Available database backups for tenant ${options.tenantId} (read-only, from backup_logs):`];
     if (records.length === 0) {
          lines.push('  (none recorded)');
     } else {
          lines.push('  ID     CREATED (UTC)              SIZE        STATUS  STORAGE PATH');
          for (const record of records) {
               const created = record.backup_date ? new Date(record.backup_date) : undefined;
               const createdAt = created && !Number.isNaN(created.getTime()) ? created.toISOString() : 'unknown';
               const status = isFailedBackup(record) ? 'failed' : 'ok';
               lines.push(`  ${String(record.id).padEnd(6)} ${createdAt.padEnd(27)} ${formatBytes(record.backup_size_bytes).padEnd(11)} ${status.padEnd(7)} ${record.backup_path || '(no file path)'}`);
          }
     }
     if (options.storageRoot) lines.push(`  Configured storage root (BACKUP_DIRECTORY): ${options.storageRoot}`);
     lines.push('  Backup contents are not opened. Restore with --backup <id> --target-database <scratch database> --execute.');
     return lines.join('\n');
}

/**
 * Collects the table names declared by a mysqldump SQL file.
 * Streaming and memory-bounded: only the first 512 characters of each line are inspected, so
 * multi-megabyte INSERT lines are skipped without being buffered. No data rows are retained.
 * mysqldump writes `CREATE TABLE \`name\` (` at the start of a line.
 */
export async function readDumpTableNames(filePath: string): Promise<string[]> {
     const LINE_LIMIT = 512;
     const found = new Set<string>();
     let partial = '';
     let skipping = false;
     let settled = false;

     const consumeLine = (line: string) => {
          const match = /^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?`([^`]+)`\s*\(/i.exec(line);
          if (match) found.add(match[1]);
     };
     const finishLine = () => {
          if (!skipping) consumeLine(partial.endsWith('\r') ? partial.slice(0, -1) : partial);
          partial = '';
          skipping = false;
     };

     const stream = createReadStream(filePath, { encoding: 'utf8' });
     await new Promise<void>((resolve, reject) => {
          const settle = (error?: Error) => {
               if (settled) return;
               settled = true;
               if (error) reject(error); else resolve();
          };
          stream.on('data', (chunk: string | Buffer) => {
               const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
               let start = 0;
               while (start <= text.length) {
                    const newline = text.indexOf('\n', start);
                    const end = newline < 0 ? text.length : newline;
                    if (!skipping) {
                         const room = LINE_LIMIT - partial.length;
                         if (end - start > room) {
                              partial += text.slice(start, start + Math.max(room, 0));
                              skipping = true;
                         } else {
                              partial += text.slice(start, end);
                         }
                    }
                    if (newline < 0) break;
                    finishLine();
                    start = newline + 1;
               }
          });
          stream.on('error', settle);
          stream.on('end', () => {
               if (!skipping && partial) consumeLine(partial.endsWith('\r') ? partial.slice(0, -1) : partial);
               settle();
          });
     });
     return Array.from(found).sort();
}

function describePlan(args: RestoreArguments, candidate: BackupCandidate, tenantDatabase: string, deps: RestoreDependencies): string {
     const record = candidate.record;
     const forced = tenantDatabase.toLowerCase() === args.targetDatabase!.toLowerCase();
     return [
          'PLS backup restore - DRY RUN (no decryption, no database writes)',
          `  Tenant:            ${args.tenantId}`,
          `  Backup record:     ${record ? `${record.id} (${record.backup_name || 'database backup'})` : 'not in backup_logs (path supplied directly)'}`,
          `  Backup file:       ${candidate.path}`,
          `  Backup format:     ${candidate.encrypted ? 'encrypted (PLSBK002 AES-256-GCM, existing key loader)' : 'plain SQL (.sql)'}`,
          `  Target database:   ${args.targetDatabase} on ${deps.targetHost()}`,
          `  Tenant database:   ${tenantDatabase}`,
          `  Overwrite guard:   ${forced ? 'tenant database overwrite explicitly confirmed' : 'target differs from the tenant database'}`,
          '  Restore method:    decrypt with the existing decrypt helper into a private 0700 temporary',
          '                     directory, stream the plaintext SQL to the mysql client, delete it in finally',
          '  Verification:      compare the CREATE TABLE set from the dump with information_schema after',
          '                     the restore, then print exact row counts per table',
          `  Exit codes:        0 success, 1 refused/failed, 2 verification failed`,
          '  Nothing was written. Re-run with --execute to perform this restore.',
     ].join('\n');
}

async function verifyRestore(database: string, expectedTables: string[], deps: RestoreDependencies): Promise<number> {
     const actual = await deps.listTargetTables(database);
     const expected = new Set(expectedTables);
     const actualNames = new Set(actual.map(row => row.table));
     const missing = expectedTables.filter(table => !actualNames.has(table));
     const extra = actual.map(row => row.table).filter(table => !expected.has(table));

     deps.stdout('');
     deps.stdout(`Row counts in ${database} (counts only, no rows are printed):`);
     deps.stdout(`  ${'TABLE'.padEnd(46)} ROWS`);
     for (const row of [...actual].sort((left, right) => left.table.localeCompare(right.table))) {
          deps.stdout(`  ${row.table.padEnd(46)} ${row.rows}`);
     }
     deps.stdout('');
     deps.stdout(`Verification: dump tables=${expectedTables.length}, restored tables=${actual.length}, missing=${missing.length}, extra=${extra.length}`);
     deps.stdout('This backup format has no row-count manifest; per-table counts are reported for operator review.');

     if (missing.length || extra.length || expectedTables.length !== actual.length) {
          if (missing.length) deps.stderr(`Missing tables after restore: ${missing.join(', ')}`);
          if (extra.length) deps.stderr(`Unexpected tables after restore: ${extra.join(', ')}`);
          deps.stderr('Restore verification FAILED. Do not reopen the target database.');
          return 2;
     }
     deps.stdout('Restore verification passed: the restored table set matches the backup dump.');
     return 0;
}

export async function runRestoreCli(argv: string[], deps: RestoreDependencies): Promise<number> {
     const args = parseRestoreArguments(argv);
     const records = await deps.listBackupRecords(args.tenantId);

     if (args.mode === 'list') {
          deps.stdout(formatBackupList(records, { tenantId: args.tenantId, storageRoot: deps.configuredStorageRoot() }));
          return 0;
     }

     const candidate = await resolveBackupCandidate(args.backup!, records, deps.fileExists);
     const tenantDatabase = await deps.tenantDatabaseName(args.tenantId);
     assertRestoreTargetAllowed({
          targetDatabase: args.targetDatabase!,
          tenantDatabase,
          controlDatabase: deps.controlDatabaseName(),
          forceOverwriteTenant: args.forceOverwriteTenant,
          confirm: args.confirm,
     });

     deps.stdout(describePlan(args, candidate, tenantDatabase!, deps));
     if (!args.execute) return 0;

     if (!(await deps.targetExists(args.targetDatabase!))) {
          throw new RestoreError(`Target database "${args.targetDatabase}" does not exist. Create an empty scratch database first; this command never creates databases.`);
     }

     const directory = await fs.mkdtemp(path.join(deps.tempDirectory(), 'pls-restore-'));
     await fs.chmod(directory, 0o700);
     const plaintext = path.join(directory, 'restore.sql');
     try {
          let dumpPath = candidate.path;
          if (candidate.encrypted) {
               const keyId = candidate.record?.encryption_key_id || await deps.activeKeyId(args.tenantId);
               if (!keyId) throw new RestoreError('No encryption key is recorded for this backup and the tenant has no active key');
               deps.stdout('Decrypting the backup into the private temporary directory...');
               const result = await deps.decryptToFile(args.tenantId, candidate.path, plaintext, keyId);
               if (!result.success) throw new RestoreError(`Backup decryption failed: ${result.error || 'unknown error'}`);
               dumpPath = plaintext;
          }

          const expectedTables = await readDumpTableNames(dumpPath);
          if (expectedTables.length === 0) {
               throw new RestoreError('The backup has no mysqldump CREATE TABLE statements; refusing to restore an unrecognised format');
          }

          deps.stdout(`Restoring ${expectedTables.length} tables into ${args.targetDatabase} ...`);
          await deps.streamDumpToTarget(args.targetDatabase!, dumpPath);
          return await verifyRestore(args.targetDatabase!, expectedTables, deps);
     } finally {
          // The decrypted plaintext exists only for the duration of this invocation.
          await fs.rm(directory, { recursive: true, force: true });
     }
}

/* -------------------------------------------------------------------------------------------------
 * Default (real) dependencies. Loaded lazily so tests can import the pure logic without a database.
 * ---------------------------------------------------------------------------------------------- */

function databaseSettings() {
     const production = process.env.NODE_ENV === 'production';
     const host = production ? process.env.PRODUCTION_DB_HOSTNAME : process.env.DB_HOST;
     const port = Number(production ? process.env.PRODUCTION_DB_PORT || 2309 : process.env.DB_PORT || 3306);
     const user = production ? process.env.PRODUCTION_DB_USERNAME : process.env.DB_USERNAME;
     const password = production ? process.env.PRODUCTION_DB_PASSWORD : process.env.DB_PASSWORD;
     if (!host) throw new RestoreError('Database host is not configured');
     if (!user) throw new RestoreError('Database user is not configured');
     return { host, port, user, password, ...databaseTlsOptions(host) };
}

function recoveryDatabaseSettings() {
     const host = process.env.BACKUP_RESTORE_DB_HOST?.trim();
     if (!host) return databaseSettings();
     const port = Number(process.env.BACKUP_RESTORE_DB_PORT || 3306);
     const user = process.env.BACKUP_RESTORE_DB_USERNAME;
     const password = process.env.BACKUP_RESTORE_DB_PASSWORD;
     if (!user || !Number.isInteger(port) || port < 1 || port > 65535) throw new RestoreError('The recovery MySQL connection is incomplete');
     return { host, port, user, password, ...databaseTlsOptions(host, 'BACKUP_RESTORE_DB') };
}

function tempRoot(): string {
     return process.env.BACKUP_TEMP_DIRECTORY || tmpdir();
}

async function openServerConnection(database?: string, settings = databaseSettings()) {
     const mysql = await import('mysql2/promise');
     return await mysql.createConnection({ ...settings, ...(database ? { database } : {}), connectTimeout: 10000 });
}

async function openControlConnection() {
     const mysql = await import('mysql2/promise');
     const settings = databaseSettings();
     const host = process.env.SYSTEM_CONFIG_DB_HOST || settings.host;
     return await mysql.createConnection({
          host,
          port: Number(process.env.SYSTEM_CONFIG_DB_PORT || settings.port),
          user: process.env.SYSTEM_CONFIG_DB_USERNAME || settings.user,
          password: process.env.SYSTEM_CONFIG_DB_PASSWORD || settings.password,
          database: process.env.SYSTEM_CONFIG_DATABASE || 'primelabmaster_control',
          ...databaseTlsOptions(host, 'SYSTEM_CONFIG_DB'),
          connectTimeout: 10000,
     });
}

function quoteOption(value: unknown): string {
     return `"${String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`;
}

/** Rebind MySQL dump trigger/view definers to the schema-scoped restore account. */
export async function* bindDumpDefiners(source: AsyncIterable<Buffer>) {
     const decoder = new StringDecoder('utf8');
     let prefix = '';
     let passedPrefix = false;
     const bind = (line: string) => line.replace(
          /^(\/\*!50003 CREATE\*\/ )?(\/\*!500(?:13|17) DEFINER=)`(?:[^`]|``)*`@`(?:[^`]|``)*`/,
          '$1$2CURRENT_USER',
     );
     for await (const chunk of source) {
          const parts = decoder.write(chunk).split('\n');
          for (let index = 0; index < parts.length; index++) {
               const part = parts[index];
               const finished = index < parts.length - 1;
               if (passedPrefix) {
                    if (part) yield part;
               } else {
                    prefix += part;
                    if (finished || prefix.length >= 512) {
                         yield bind(prefix);
                         passedPrefix = true;
                         prefix = '';
                    }
               }
               if (finished) {
                    yield '\n';
                    passedPrefix = false;
               }
          }
     }
     const end = decoder.end();
     if (prefix || end) yield passedPrefix ? end : bind(prefix + end);
}

async function streamDumpToTarget(database: string, plaintextPath: string, options?: { settings: ReturnType<typeof databaseSettings>; user: string; password: string }): Promise<void> {
     const settings = options ? { ...options.settings, user: options.user, password: options.password } : databaseSettings();
     const directory = await fs.mkdtemp(path.join(tempRoot(), 'pls-restore-client-'));
     await fs.chmod(directory, 0o700);
     try {
          // Credentials live in a private options file, never on the command line or in logs.
          const clientOptions = ['[client]', `host=${quoteOption(settings.host)}`, `port=${quoteOption(settings.port)}`,
               `user=${quoteOption(settings.user)}`, `password=${quoteOption(settings.password)}`];
          if (settings.ssl) {
               clientOptions.push('ssl-mode=VERIFY_IDENTITY');
               for (const [property, option] of [['ca', 'ssl-ca'], ['cert', 'ssl-cert'], ['key', 'ssl-key']] as const) {
                    const material = (settings.ssl as Record<string, unknown>)[property];
                    if (typeof material !== 'string' || !material) continue;
                    const filename = path.join(directory, `${property}.pem`);
                    await fs.writeFile(filename, material, { mode: 0o600 });
                    clientOptions.push(`${option}=${quoteOption(filename)}`);
               }
          }
          const defaults = path.join(directory, 'client.cnf');
          await fs.writeFile(defaults, clientOptions.join('\n') + '\n', { mode: 0o600 });

          const binary = process.env.MYSQL_PATH || (process.platform === 'win32'
               ? 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe' : 'mysql');
          const child = spawn(binary, [`--defaults-extra-file=${defaults}`, '--binary-mode', '--local-infile=0', '--database', database], {
               windowsHide: true, shell: false, stdio: ['pipe', 'ignore', 'pipe'],
          });
          // Retain just the vendor error number, since stderr may include rejected SQL.
          let mysqlError: string | undefined;
          child.stderr.on('data', (chunk: Buffer) => { mysqlError ??= /^ERROR (\d+)\b/.exec(chunk.toString('utf8', 0, 48))?.[1]; });
          const reportFailure = () => {
               if (options && (mysqlError === '1419' || mysqlError === '1227')) {
                    return new RestoreError('The recovery MySQL server rejected a privileged dump statement. Use a recovery server configured to restore triggers and views.');
               }
               return null;
          };
          const exited = new Promise<number>((resolve, reject) => {
               child.once('error', () => reject(new RestoreError('The mysql client could not be started; install it or set MYSQL_PATH')));
               child.once('close', code => resolve(code === null ? -1 : code));
          });
          void exited.catch(() => undefined);
          try {
               const file = createReadStream(plaintextPath);
               if (options) await pipeline(file, bindDumpDefiners, child.stdin);
               else await pipeline(file, child.stdin);
          } catch {
               child.kill();
               const code = await exited.catch(() => -1);
               throw reportFailure() ?? new RestoreError(`Streaming the dump to the mysql client failed (client exit code ${code}); the target database may be partially restored and should be dropped before retrying`);
          }
          const code = await exited;
          if (code !== 0) {
               throw reportFailure() ?? new RestoreError(`The mysql client exited with code ${code}; the target database may be partially restored and should be dropped before retrying`);
          }
     } finally {
          await fs.rm(directory, { recursive: true, force: true });
     }
}

export async function createDefaultDependencies(target = databaseSettings): Promise<RestoreDependencies> {
     const { default: BackupManager } = await import('../models/security/database-backup/backup');
     const { default: EncryptionManager } = await import('../models/security/database-backup/encryption');
     const { configuration } = await import('../hooks/configuration');

     return {
          stdout: line => console.log(line),
          stderr: line => console.error(line),
          listBackupRecords: async tenantId => {
               const records = await BackupManager.findAll(tenantId, { backup_type: 'database' });
               return records as unknown as BackupRecord[];
          },
          tenantDatabaseName: async tenantId => {
               if (!configuration.isMultiTenant) {
                    return process.env.NODE_ENV === 'production' ? process.env.PRODUCTION_DATABASE : process.env.DATABASE;
               }
               // Read-only registry lookup; it deliberately avoids TenantRegistry's bootstrap side effects.
               const connection = await openControlConnection();
               try {
                    const [rows] = await connection.query('SELECT database_name FROM prime_tenants WHERE tenant_number = ? LIMIT 1', [tenantId]);
                    const row = Array.isArray(rows) ? rows[0] as { database_name?: string } | undefined : undefined;
                    return row?.database_name ? String(row.database_name) : undefined;
               } finally {
                    await connection.end();
               }
          },
          controlDatabaseName: () => process.env.SYSTEM_CONFIG_DATABASE || 'primelabmaster_control',
          configuredStorageRoot: () => process.env.BACKUP_DIRECTORY,
          activeKeyId: async tenantId => {
               const active = await EncryptionManager.getActiveEncryptionKey(tenantId);
               return active?.keyId;
          },
          decryptToFile: (tenantId, inputPath, outputPath, keyId) => EncryptionManager.decryptFile(tenantId, inputPath, outputPath, keyId),
          targetHost: () => {
               const settings = target();
               return `${settings.host}:${settings.port}`;
          },
          targetExists: async database => {
               const connection = await openServerConnection(undefined, target());
               try {
                    const [rows] = await connection.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ? LIMIT 1', [database]);
                    return Array.isArray(rows) && rows.length > 0;
               } finally {
                    await connection.end();
               }
          },
          streamDumpToTarget,
          listTargetTables: async database => {
               const connection = await openServerConnection(database, target());
               try {
                    const [rows] = await connection.query(
                         "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
                         [database],
                    );
                    const tables = (Array.isArray(rows) ? rows : []).map(row => String((row as { name: unknown }).name));
                    const counts: Array<{ table: string; rows: number }> = [];
                    for (const table of tables) {
                         const [result] = await connection.query(`SELECT COUNT(*) AS total FROM \`${table.replace(/`/g, '``')}\``);
                         const first = Array.isArray(result) ? result[0] as { total?: unknown } | undefined : undefined;
                         counts.push({ table, rows: Number(first?.total || 0) });
                    }
                    return counts;
               } finally {
                    await connection.end();
               }
          },
          tempDirectory: tempRoot,
          fileExists: async candidate => await fs.stat(candidate).then(stat => stat.isFile()).catch(() => false),
     };
}

/**
 * Restore into a newly allocated schema using a MySQL account that can only access that schema.
 * Keep the account locked on success so any objects created with that definer remain valid.
 */
export async function restoreIsolatedBackup(tenantId: number, backup: BackupRecord): Promise<{ database: string; tableCount: number; server: string }> {
     const settings = recoveryDatabaseSettings();
     const deps = await createDefaultDependencies(() => settings);
     const nonce = randomBytes(8).toString('hex');
     const database = `plsrestore${tenantId}x${nonce}`;
     const user = `plsrestore${nonce}`;
     const password = randomBytes(32).toString('hex');
     const account = `'${user}'@'%'`;
     const connection = await openServerConnection(undefined, settings);
     let createdDatabase = false;
     let createdAccount = false;
     let verified = false;
     let tableCount = 0;
     try {
          await assertRestoreTargetAllowed({ targetDatabase: database, tenantDatabase: await deps.tenantDatabaseName(tenantId),
               controlDatabase: deps.controlDatabaseName() });
          await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4`);
          createdDatabase = true;
          await connection.query(`CREATE USER ${account} IDENTIFIED BY ?`, [password]);
          createdAccount = true;
          await connection.query(`GRANT ALL PRIVILEGES ON \`${database}\`.* TO ${account}`);
          const result = await runRestoreCli(['--tenant', String(tenantId), '--backup', String(backup.id),
               '--target-database', database, '--execute'], {
               ...deps,
               stdout: () => undefined,
               stderr: () => undefined,
               listBackupRecords: async () => [backup],
               streamDumpToTarget: (target, file) => streamDumpToTarget(target, file, { settings, user, password }),
               listTargetTables: async target => {
                    const tables = await deps.listTargetTables(target);
                    tableCount = tables.length;
                    return tables;
               },
          });
          if (result !== 0) throw new RestoreError('The restored table set could not be verified');
          await connection.query(`ALTER USER ${account} ACCOUNT LOCK`);
          verified = true;
          return { database, tableCount, server: deps.targetHost() };
     } finally {
          try {
               if (!verified) {
                    try { if (createdAccount) await connection.query(`DROP USER ${account}`); }
                    finally { if (createdDatabase) await connection.query(`DROP DATABASE \`${database}\``); }
               }
          } finally { await connection.end(); }
     }
}

async function main(): Promise<number> {
     return await runRestoreCli(process.argv.slice(2), await createDefaultDependencies());
}

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
     main().then(code => {
          process.exitCode = code;
     }).catch(error => {
          // Messages are produced by this module or by the mysql drivers; they contain no passwords.
          console.error(`Restore failed: ${error instanceof Error && error.message ? error.message : 'unexpected error'}`);
          process.exitCode = 1;
     });
}
