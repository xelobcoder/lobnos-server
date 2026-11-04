import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { BackupController } from './backup-controller';
import BackupManager from '../../models/security/database-backup/backup';
import EncryptionManager from '../../models/security/database-backup/encryption';

vi.mock('../../models/security/database-backup/backup', () => ({
     default: { findAll: vi.fn(), findById: vi.fn() }
}));
vi.mock('../../models/security/database-backup/encryption', () => ({
     default: { decryptFile: vi.fn() }
}));

describe('backup download availability and streaming', () => {
     let server: Server;
     let directory: string;
     let base: string;
     let file: string;
     const bytes = Buffer.from('synthetic encrypted backup bytes');
     const backup = () => ({
          id: 17, backup_name: 'Synthetic backup', is_successful: true, is_full_backup: true,
          backup_type: 'database' as const, backup_mode: 'manual' as const, backup_date: new Date(),
          created_by: 1, backup_path: file, encryption_key_id: 'synthetic-key'
     });

     beforeAll(async () => {
          directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pls-backup-download-test-'));
          file = path.join(directory, 'backup.sql.encrypted');
          fs.writeFileSync(file, bytes);
          const app = express();
          app.get('/logs', (req, res) => { void BackupController.getBackupLogs(req, res); });
          app.get<{ id: string }>('/logs/:id/download', (req, res) => { void BackupController.downloadBackup(req, res); });
          await new Promise<void>((resolve, reject) => {
               server = app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve());
          });
          const address = server.address();
          if (!address || typeof address === 'string') throw new Error('Missing test server address');
          base = `http://127.0.0.1:${address.port}`;
     });
     beforeEach(() => {
          vi.mocked(BackupManager.findById).mockResolvedValue(backup());
          vi.mocked(BackupManager.findAll).mockResolvedValue([backup()]);
     });
     afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });
     afterAll(async () => {
          await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); });
          fs.rmSync(directory, { recursive: true, force: true });
     });

     it('marks missing files, failed jobs and directories unavailable without changing the historical success flag', async () => {
          vi.mocked(BackupManager.findAll).mockResolvedValue([
               backup(), { ...backup(), id: 18, backup_path: path.join(directory, 'missing.sql') },
               { ...backup(), id: 19, is_successful: false }, { ...backup(), id: 20, backup_path: directory }
          ]);
          const response = await fetch(`${base}/logs?tenantId=7`);
          const result = await response.json();
          expect(response.status).toBe(200);
          expect(result.data.map((row: { file_available: boolean }) => row.file_available)).toEqual([true, false, false, false]);
          expect(result.data[1].is_successful).toBe(true);
          expect(BackupManager.findAll).toHaveBeenCalledWith(7, expect.any(Object));
     });
     it('distinguishes a missing record from a missing physical file', async () => {
          vi.mocked(BackupManager.findById).mockResolvedValue(undefined);
          const missingRecord = await fetch(`${base}/logs/17/download?tenantId=7`);
          expect(missingRecord.status).toBe(404);
          expect((await missingRecord.json()).code).toBe('BACKUP_NOT_FOUND');
          vi.mocked(BackupManager.findById).mockResolvedValue({ ...backup(), backup_path: path.join(directory, 'missing.sql') });
          const missingFile = await fetch(`${base}/logs/17/download?tenantId=7`);
          expect(missingFile.status).toBe(404);
          expect((await missingFile.json()).code).toBe('BACKUP_FILE_NOT_FOUND');
     });
     it('streams the exact encrypted file with its original attachment name and does not decrypt implicitly', async () => {
          const response = await fetch(`${base}/logs/17/download?tenantId=7`);
          expect(response.status).toBe(200);
          expect(response.headers.get('content-disposition')).toBe('attachment; filename="backup.sql.encrypted"');
          expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
          expect(EncryptionManager.decryptFile).not.toHaveBeenCalled();
          expect(BackupManager.findById).toHaveBeenCalledWith(7, 17);
     });
     it('retains explicit decryption and cleans up the temporary plaintext file', async () => {
          vi.mocked(EncryptionManager.decryptFile).mockImplementation(async (_tenantId, _input, output) => {
               await fs.promises.writeFile(output, 'synthetic restored sql');
               return { success: true };
          });
          const response = await fetch(`${base}/logs/17/download?tenantId=7&decrypt=true`);
          expect(response.status).toBe(200);
          expect(response.headers.get('content-disposition')).toBe('attachment; filename="backup.sql"');
          expect(await response.text()).toBe('synthetic restored sql');
          await vi.waitFor(() => expect(fs.readdirSync(directory).some(name => name.endsWith('.decrypted'))).toBe(false));
     });
     it('reports unexpected filesystem failures instead of returning success-shaped unavailable records', async () => {
          vi.spyOn(fs.promises, 'stat').mockRejectedValueOnce(Object.assign(new Error('Storage unavailable'), { code: 'EIO' }));
          const response = await fetch(`${base}/logs?tenantId=7`);
          expect(response.status).toBe(500);
          expect(await response.json()).toEqual({ status: false, error: 'Storage unavailable' });
     });
});
