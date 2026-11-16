import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
     RestoreError,
     assertRestoreTargetAllowed,
     bindDumpDefiners,
     formatBackupList,
     formatBytes,
     parseRestoreArguments,
     readDumpTableNames,
     resolveBackupCandidate,
     runRestoreCli,
     type BackupRecord,
     type RestoreDependencies,
} from './restore-backup';

const DUMP_SQL = [
     '-- fixture dump',
     'CREATE TABLE `patient` (',
     '  `id` int NOT NULL,',
     '  PRIMARY KEY (`id`)',
     ');',
     'INSERT INTO `patient` VALUES (1),(2);',
     'CREATE TABLE `visit` (',
     '  `id` int NOT NULL',
     ');',
].join('\n');

let workspace: string;

beforeEach(async () => {
     workspace = await fs.mkdtemp(path.join(tmpdir(), 'pls-restore-cli-test-'));
});

afterEach(async () => {
     await fs.rm(workspace, { recursive: true, force: true });
     vi.restoreAllMocks();
});

function backupPath(extension = '.encrypted'): string {
     return path.join(workspace, `database_2026-11-01${extension}`);
}

function buildRecords(file = backupPath()): BackupRecord[] {
     return [{
          id: 12,
          backup_name: 'database',
          backup_date: '2026-11-01T02:00:00.000Z',
          backup_size_bytes: 2048,
          backup_path: file,
          is_successful: 1,
          backup_type: 'database',
          encryption_key_id: 'KEY-fixture',
     }];
}

function createDependencies(overrides: Partial<RestoreDependencies> = {}) {
     const stdout: string[] = [];
     const stderr: string[] = [];
     const decryptToFile = vi.fn(async (_tenantId: number, _inputPath: string, outputPath: string) => {
          await fs.writeFile(outputPath, DUMP_SQL, { mode: 0o600 });
          return { success: true };
     });
     const streamDumpToTarget = vi.fn(async () => undefined);
     const targetExists = vi.fn(async () => true);
     const deps: RestoreDependencies = {
          stdout: line => stdout.push(line),
          stderr: line => stderr.push(line),
          listBackupRecords: async () => buildRecords(),
          tenantDatabaseName: async () => 'pls_t00003',
          controlDatabaseName: () => 'primelabmaster_control',
          configuredStorageRoot: () => undefined,
          activeKeyId: async () => 'KEY-fixture',
          decryptToFile,
          targetHost: () => 'fixture-db:3306',
          targetExists,
          streamDumpToTarget,
          listTargetTables: async () => [{ table: 'patient', rows: 2 }, { table: 'visit', rows: 0 }],
          tempDirectory: () => workspace,
          fileExists: async candidate => candidate === backupPath(),
          ...overrides,
     };
     return { deps, stdout, stderr, decryptToFile, streamDumpToTarget, targetExists };
}

const restoreArgs = ['--backup', '12', '--target-database', 'pls_restore_drill', '--tenant', '3'];

describe('restore argument parsing', () => {
     it('parses a read-only list request', () => {
          expect(parseRestoreArguments(['--list', '--tenant', '7'], {})).toEqual({
               mode: 'list', tenantId: 7, backup: undefined, targetDatabase: undefined,
               execute: false, forceOverwriteTenant: false, confirm: undefined,
          });
     });

     it('defaults to a dry run for restore requests', () => {
          const parsed = parseRestoreArguments(restoreArgs, {});
          expect(parsed.mode).toBe('restore');
          expect(parsed.backup).toBe('12');
          expect(parsed.targetDatabase).toBe('pls_restore_drill');
          expect(parsed.execute).toBe(false);
     });

     it('accepts --execute and the guarded tenant overwrite flags', () => {
          const parsed = parseRestoreArguments([...restoreArgs, '--execute', '--force-overwrite-tenant', '--confirm', 'pls_t00003'], {});
          expect(parsed.execute).toBe(true);
          expect(parsed.forceOverwriteTenant).toBe(true);
          expect(parsed.confirm).toBe('pls_t00003');
     });

     it('falls back to BACKUP_TENANT_ID when --tenant is omitted', () => {
          expect(parseRestoreArguments(['--list'], { BACKUP_TENANT_ID: '42' }).tenantId).toBe(42);
     });

     it('refuses a restore without a target database', () => {
          expect(() => parseRestoreArguments(['--backup', '12', '--tenant', '3'], {})).toThrow(/target-database/);
     });

     it('refuses a list request combined with restore options', () => {
          expect(() => parseRestoreArguments(['--list', '--execute', '--tenant', '3'], {})).toThrow(/read-only/);
     });

     it('refuses --force-overwrite-tenant without an explicit confirmation', () => {
          expect(() => parseRestoreArguments([...restoreArgs, '--force-overwrite-tenant'], {})).toThrow(/--confirm/);
     });

     it('refuses an unknown option', () => {
          expect(() => parseRestoreArguments([...restoreArgs, '--drop-everything'], {})).toThrow(/Unknown option/);
     });

     it('requires a positive tenant id', () => {
          expect(() => parseRestoreArguments(['--list'], {})).toThrow(/tenant/i);
          expect(() => parseRestoreArguments(['--list', '--tenant', 'abc'], {})).toThrow(/positive integer/);
     });
});

describe('tenant database overwrite guard', () => {
     it('allows a scratch target that differs from the tenant database', () => {
          expect(() => assertRestoreTargetAllowed({
               targetDatabase: 'pls_restore_drill',
               tenantDatabase: 'pls_t00003',
               controlDatabase: 'primelabmaster_control',
          })).not.toThrow();
     });

     it('refuses the tenant database unless the overwrite is forced', () => {
          expect(() => assertRestoreTargetAllowed({
               targetDatabase: 'pls_t00003',
               tenantDatabase: 'pls_t00003',
          })).toThrow(/Refusing to restore over the tenant database/);
     });

     it('refuses a forced overwrite with a mismatched confirmation', () => {
          expect(() => assertRestoreTargetAllowed({
               targetDatabase: 'pls_t00003',
               tenantDatabase: 'pls_t00003',
               forceOverwriteTenant: true,
               confirm: 'pls_t0003',
          })).toThrow(/--confirm pls_t00003/);
     });

     it('allows a forced overwrite when the confirmation matches exactly', () => {
          expect(() => assertRestoreTargetAllowed({
               targetDatabase: 'pls_t00003',
               tenantDatabase: 'pls_t00003',
               forceOverwriteTenant: true,
               confirm: 'pls_t00003',
          })).not.toThrow();
     });

     it('always refuses reserved and control databases', () => {
          expect(() => assertRestoreTargetAllowed({ targetDatabase: 'mysql', tenantDatabase: 'pls_t00003' })).toThrow(/reserved/);
          expect(() => assertRestoreTargetAllowed({
               targetDatabase: 'primelabmaster_control', tenantDatabase: 'pls_t00003',
               controlDatabase: 'primelabmaster_control',
          })).toThrow(/master control database/);
     });

     it('refuses when the tenant database cannot be resolved', () => {
          expect(() => assertRestoreTargetAllowed({ targetDatabase: 'pls_restore_drill', tenantDatabase: undefined })).toThrow(/cannot run/);
     });
});

describe('backup candidate resolution', () => {
     const exists = async () => true;

     it('resolves a recorded backup by id', async () => {
          const candidate = await resolveBackupCandidate('12', buildRecords(), exists);
          expect(candidate.path).toBe(backupPath());
          expect(candidate.encrypted).toBe(true);
          expect(candidate.record?.id).toBe(12);
     });

     it('refuses an id that is not recorded for the tenant', async () => {
          await expect(resolveBackupCandidate('99', buildRecords(), exists)).rejects.toThrow(/not recorded/);
          await expect(resolveBackupCandidate('99', buildRecords(), exists)).rejects.toBeInstanceOf(RestoreError);
     });

     it('refuses a backup recorded as failed', async () => {
          const failed = [{ ...buildRecords()[0], is_successful: 0 }];
          await expect(resolveBackupCandidate('12', failed, exists)).rejects.toThrow(/recorded as failed/);
     });

     it('refuses a files/archive backup', async () => {
          const archive = [{ ...buildRecords()[0], backup_path: path.join(workspace, 'files.tar.gz.encrypted') }];
          await expect(resolveBackupCandidate('12', archive, exists)).rejects.toThrow(/Only database SQL backups/);
     });

     it('refuses a missing backup file', async () => {
          await expect(resolveBackupCandidate('12', buildRecords(), async () => false)).rejects.toThrow(/missing/);
     });

     it('refuses an unrecognised file extension', async () => {
          await expect(resolveBackupCandidate(path.join(workspace, 'dump.bin'), [], exists)).rejects.toThrow(/\.sql/);
     });

     it('accepts a plain SQL path that has no backup_logs record', async () => {
          const candidate = await resolveBackupCandidate(backupPath('.sql'), [], exists);
          expect(candidate.encrypted).toBe(false);
          expect(candidate.record).toBeUndefined();
     });
});

describe('listing and formatting', () => {
     it('prints id, timestamp, size, status and storage path without opening a backup', async () => {
          const { deps, stdout, decryptToFile } = createDependencies();
          expect(await runRestoreCli(['--list', '--tenant', '3'], deps)).toBe(0);
          const text = stdout.join('\n');
          expect(text).toContain('12');
          expect(text).toContain('2026-11-01T02:00:00.000Z');
          expect(text).toContain('2.0 KiB');
          expect(text).toContain('ok');
          expect(text).toContain(backupPath());
          expect(text).not.toContain('KEY-fixture');
          expect(decryptToFile).not.toHaveBeenCalled();
     });

     it('formats sizes and renders an empty list', () => {
          expect(formatBytes(0)).toBe('0 B');
          expect(formatBytes(1536)).toBe('1.5 KiB');
          expect(formatBytes(undefined)).toBe('unknown');
          expect(formatBackupList([], { tenantId: 3 })).toContain('(none recorded)');
     });
});

describe('dry run', () => {
     it('prints the plan, exits 0 and writes nothing', async () => {
          const { deps, stdout, decryptToFile, streamDumpToTarget, targetExists } = createDependencies();
          expect(await runRestoreCli(restoreArgs, deps)).toBe(0);
          const text = stdout.join('\n');
          expect(text).toContain('DRY RUN');
          expect(text).toContain(backupPath());
          expect(text).toContain('pls_restore_drill');
          expect(text).toContain('Nothing was written');
          expect(decryptToFile).not.toHaveBeenCalled();
          expect(streamDumpToTarget).not.toHaveBeenCalled();
          expect(targetExists).not.toHaveBeenCalled();
          expect(await fs.readdir(workspace)).toEqual([]);
     });

     it('refuses to plan a restore over the tenant database without explicit confirmation', async () => {
          const { deps, decryptToFile } = createDependencies();
          await expect(runRestoreCli(['--backup', '12', '--target-database', 'pls_t00003', '--tenant', '3'], deps))
               .rejects.toThrow(/Refusing to restore over the tenant database/);
          expect(decryptToFile).not.toHaveBeenCalled();
     });

     it('allows a forced tenant overwrite once the exact database name is confirmed', async () => {
          const { deps, stdout } = createDependencies();
          const code = await runRestoreCli([
               '--backup', '12', '--target-database', 'pls_t00003', '--tenant', '3',
               '--force-overwrite-tenant', '--confirm', 'pls_t00003',
          ], deps);
          expect(code).toBe(0);
          expect(stdout.join('\n')).toContain('overwrite explicitly confirmed');
     });

     it('fails for a backup id that is not recorded', async () => {
          const { deps } = createDependencies();
          await expect(runRestoreCli(['--backup', '99', '--target-database', 'pls_restore_drill', '--tenant', '3'], deps))
               .rejects.toThrow(/not recorded/);
     });

     it('fails for a missing backup path', async () => {
          const { deps } = createDependencies();
          const absent = path.join(workspace, 'absent.sql');
          await expect(runRestoreCli(['--backup', absent, '--target-database', 'pls_restore_drill', '--tenant', '3'], deps))
               .rejects.toThrow(/missing/);
     });
});

describe('execute', () => {
     const executeArgs = [...restoreArgs, '--execute'];

     it('decrypts, streams the dump and verifies the table set', async () => {
          const { deps, stdout, decryptToFile, streamDumpToTarget } = createDependencies();
          expect(await runRestoreCli(executeArgs, deps)).toBe(0);
          expect(decryptToFile).toHaveBeenCalledTimes(1);
          expect(streamDumpToTarget).toHaveBeenCalledTimes(1);
          const text = stdout.join('\n');
          expect(text).toContain('Restoring 2 tables into pls_restore_drill');
          expect(text).toContain('patient');
          expect(text).toContain('Restore verification passed');
          expect(await fs.readdir(workspace)).toEqual([]);
     });

     it('returns 2 and reports missing tables when verification fails', async () => {
          const { deps, stderr } = createDependencies({
               listTargetTables: async () => [{ table: 'patient', rows: 2 }],
          });
          expect(await runRestoreCli(executeArgs, deps)).toBe(2);
          expect(stderr.join('\n')).toContain('Missing tables after restore: visit');
          expect(stderr.join('\n')).toContain('Restore verification FAILED');
     });

     it('removes the plaintext directory when decryption fails', async () => {
          const { deps } = createDependencies({
               decryptToFile: async () => ({ success: false, error: 'fixture key missing' }),
          });
          await expect(runRestoreCli(executeArgs, deps)).rejects.toThrow(/decryption failed/);
          expect(await fs.readdir(workspace)).toEqual([]);
     });

     it('skips decryption for a plain SQL backup', async () => {
          const sqlPath = backupPath('.sql');
          await fs.writeFile(sqlPath, DUMP_SQL, 'utf8');
          const { deps, decryptToFile, streamDumpToTarget } = createDependencies({
               listBackupRecords: async () => buildRecords(sqlPath),
               fileExists: async candidate => candidate === sqlPath,
          });
          expect(await runRestoreCli(executeArgs, deps)).toBe(0);
          expect(decryptToFile).not.toHaveBeenCalled();
          expect(streamDumpToTarget).toHaveBeenCalledWith('pls_restore_drill', sqlPath);
     });

     it('refuses an execute request when the target database does not exist', async () => {
          const { deps, decryptToFile } = createDependencies({ targetExists: async () => false });
          await expect(runRestoreCli(executeArgs, deps)).rejects.toThrow(/does not exist/);
          expect(decryptToFile).not.toHaveBeenCalled();
     });
});

describe('dump scanning', () => {
     it('collects CREATE TABLE names without reading rows', async () => {
          const dump = path.join(workspace, 'restore.sql');
          await fs.writeFile(dump, DUMP_SQL, 'utf8');
          expect(await readDumpTableNames(dump)).toEqual(['patient', 'visit']);
     });

     it('skips very long INSERT lines and still finds later tables', async () => {
          const dump = path.join(workspace, 'large.sql');
          const longInsert = 'INSERT INTO `patient` VALUES (' + '0,'.repeat(4096) + '0);';
          await fs.writeFile(dump, `CREATE TABLE \`patient\` (\r\n\`id\` int\r\n);\r\n${longInsert}\r\nCREATE TABLE \`visit\` (\r\n\`id\` int\r\n);`, 'utf8');
          expect(await readDumpTableNames(dump)).toEqual(['patient', 'visit']);
     });
});


describe('scoped restore', () => {
     it('rebinds mysqldump trigger and view definers across chunks while preserving data', async () => {
          const lines = [
               '/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `sample`',
               '/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */',
               "INSERT INTO notes VALUES ('DEFINER=`root`@`localhost`', '" + 'x'.repeat(8000) + "µ');",
          ];
          const input = Buffer.from(lines.join('\n'));
          async function* bytes() {
               for (let i = 0; i < input.length; i += 7) yield input.subarray(i, i + 7);
          }
          const output: string[] = [];
          for await (const chunk of bindDumpDefiners(bytes())) output.push(chunk);
          expect(output.join('')).toBe([
               lines[0].replace('`root`@`localhost`', 'CURRENT_USER'),
               lines[1].replace('`root`@`localhost`', 'CURRENT_USER'),
               lines[2],
          ].join('\n'));
     });
});
