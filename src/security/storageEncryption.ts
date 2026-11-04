import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

const execute = promisify(execFile);
export type StorageCheck = { path: string; encrypted: boolean; method: string };

export async function checkEncryptedPath(target: string): Promise<StorageCheck> {
     if (!path.isAbsolute(target)) throw new Error('Protected storage paths must be absolute');
     const resolved = await realpath(target);
     if (process.platform === 'win32') {
          const script = "$ErrorActionPreference='Stop'; $targetVolume = @(Get-Volume -FilePath $env:PLS_STORAGE_CHECK_PATH); if ($targetVolume.Count -ne 1) { throw 'Storage volume cannot be resolved' }; $volume = Get-BitLockerVolume -MountPoint $targetVolume[0].Path; [bool]($volume.ProtectionStatus -eq 'On' -and $volume.VolumeStatus -eq 'FullyEncrypted') | ConvertTo-Json -Compress";
          const result = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
               windowsHide: true, timeout: 15000, env: { ...process.env, PLS_STORAGE_CHECK_PATH: resolved },
          });
          return { path: resolved, encrypted: JSON.parse(result.stdout.trim()) === true, method: 'BitLocker' };
     }
     if (process.platform === 'linux') {
          const mount = await execute('findmnt', ['--noheadings', '--output', 'SOURCE', '--target', resolved], { timeout: 10000 });
          const source = mount.stdout.trim();
          if (!source.startsWith('/dev/')) return { path: resolved, encrypted: false, method: 'Unverified filesystem' };
          const devices = await execute('lsblk', ['--inverse', '--noheadings', '--output', 'TYPE', '--', source], { timeout: 10000 });
          return { path: resolved, encrypted: devices.stdout.split(/\s+/).includes('crypt'), method: 'dm-crypt/LUKS' };
     }
     throw new Error('Automatic storage-encryption verification supports Windows BitLocker and Linux dm-crypt');
}

export async function assertEncryptedPaths(paths: string[]): Promise<StorageCheck[]> {
     const checks = await Promise.all([...new Set(paths)].map(checkEncryptedPath));
     if (checks.some(check => !check.encrypted)) throw new Error('Protected storage encryption could not be verified. Enable volume encryption before activating the encryption-required profile.');
     return checks;
}

export async function assertStorageEncryption(): Promise<void> {
     if (process.env.STORAGE_ENCRYPTION_REQUIRED !== 'true') return;
     const paths: unknown = JSON.parse(process.env.STORAGE_ENCRYPTION_PATHS || '[]');
     if (!Array.isArray(paths) || paths.length === 0 || paths.some(value => typeof value !== 'string' || !value)) {
          throw new Error('STORAGE_ENCRYPTION_PATHS must list existing database, upload and backup directories');
     }
     await assertEncryptedPaths([...paths, path.resolve(process.env.UPLOAD_DIR || './public/uploads'),
          path.resolve(process.env.BACKUP_TEMP_DIRECTORY || tmpdir())]);
}
