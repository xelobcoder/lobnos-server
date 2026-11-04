import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { encryptBackupStream, decryptBackupFile } from './backupCipher';

const mocks = vi.hoisted(() => ({ encrypt: vi.fn() }));
vi.mock('./encryption', () => ({ default: { prepareBackupEncryption: mocks.encrypt } }));
import { runBackupProcess, withDatabaseDump } from './backupProcess';

let directory: string;
const key = randomBytes(32);
beforeEach(async () => {
     directory = await fs.mkdtemp(path.join(tmpdir(), 'pls-backup-process-test-'));
     vi.stubEnv('BACKUP_TEMP_DIRECTORY', directory);
     mocks.encrypt.mockImplementation(async tenantId => ({ keyId: 'fixture-key', encrypt: (input: any, output: string) => encryptBackupStream(input, output, key, tenantId, 'fixture-key') }));
});
afterEach(async () => { vi.unstubAllEnvs(); await fs.rm(directory, { recursive: true, force: true }); });

describe('backup utility integration', () => {
     it('streams a real child process directly into a recoverable encrypted backup', async () => {
          const output = path.join(directory, 'database.encrypted');
          expect(await runBackupProcess(process.execPath, ['-e', 'process.stdout.write("fixture SQL only")'], 7, output, true)).toBe('fixture-key');
          await decryptBackupFile(output, path.join(directory, 'restored'), key, 7, 'fixture-key');
          expect(await fs.readFile(path.join(directory, 'restored'), 'utf8')).toBe('fixture SQL only');
          expect((await fs.readdir(directory)).sort()).toEqual(['database.encrypted', 'restored']);
     });
     it('does not publish output when the dump process exits unsuccessfully', async () => {
          await expect(runBackupProcess(process.execPath, ['-e', 'process.stdout.write("partial"); process.exitCode=2'], 7, path.join(directory, 'backup'), true)).rejects.toThrow('utility failed');
          expect(await fs.readdir(directory)).toEqual([]);
     });
     it('fails cleanly for a missing backup utility', async () => {
          await expect(runBackupProcess(path.join(directory, 'missing-executable'), [], 7, path.join(directory, 'backup'), true)).rejects.toThrow();
          expect(await fs.readdir(directory)).toEqual([]);
     });
     it('kills the dump and leaves no plaintext or backup when encryption setup fails', async () => {
          mocks.encrypt.mockResolvedValue({ keyId: 'fixture-key', encrypt: async () => { throw new Error('No master key configured'); } });
          await expect(runBackupProcess(process.execPath, ['-e', 'setInterval(()=>process.stdout.write("fixture"),10)'], 7, path.join(directory, 'backup'), true)).rejects.toThrow('No master key');
          expect(await fs.readdir(directory)).toEqual([]);
     });
     it('supplies credentials in a private options file, inherits verified TLS and cleans up', async () => {
          let defaults = '';
          const secret = 'fixture-only-password-with-"quotes"\nline';
          await withDatabaseDump({ client: 'mysql2', connection: { host: 'db.example', user: 'fixture', password: secret, database: 'tenant_7', ssl: { ca: 'fixture CA' } } }, async (_binary, args) => {
               expect(args.join(' ')).not.toContain(secret);
               expect(args.slice(-2)).toEqual(['--', 'tenant_7']);
               defaults = args[0].split('=').slice(1).join('=');
               const content = await fs.readFile(defaults, 'utf8');
               expect(content).toContain('ssl-mode=VERIFY_IDENTITY');
               expect(content).toContain('password="fixture-only-password-with-\\"quotes\\"\\nline"');
               expect(content).toContain('ssl-ca=');
          });
          await expect(fs.stat(defaults)).rejects.toThrow();
          expect(await fs.readdir(directory)).toEqual([]);
     });
     it('removes temporary credentials when the dump fails', async () => {
          await expect(withDatabaseDump({ client: 'mysql2', connection: { database: 'tenant_7', password: 'fixture' } }, async () => { throw new Error('fixture failure'); })).rejects.toThrow('fixture failure');
          expect(await fs.readdir(directory)).toEqual([]);
     });
});
