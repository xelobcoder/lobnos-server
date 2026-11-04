import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('node:child_process', async load => {
     const original = await load<typeof import('node:child_process')>();
     return { ...original, execFile: Object.assign(vi.fn(), { [Symbol.for('nodejs.util.promisify.custom')]: mocks.execute }) };
});
import { assertEncryptedPaths, assertStorageEncryption, checkEncryptedPath } from './storageEncryption';

let directory: string;
const originalProcess = process;
beforeEach(async () => {
     directory = await fs.mkdtemp(path.join(tmpdir(), 'pls-storage-check-test-'));
     mocks.execute.mockReset();
});
afterEach(async () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); await fs.rm(directory, { recursive: true, force: true }); });
function platform(value: string) { vi.stubGlobal('process', new Proxy(originalProcess, { get: (target, property) => property === 'platform' ? value : Reflect.get(target, property) })); }

describe('encrypted-volume enforcement', () => {
     it('preserves staged deployments before host enforcement is enabled', async () => {
          vi.stubEnv('STORAGE_ENCRYPTION_REQUIRED', 'false');
          await assertStorageEncryption();
          expect(mocks.execute).not.toHaveBeenCalled();
     });
     it('requires explicit protected paths when activated', async () => {
          vi.stubEnv('STORAGE_ENCRYPTION_REQUIRED', 'true'); vi.stubEnv('STORAGE_ENCRYPTION_PATHS', '[]');
          await expect(assertStorageEncryption()).rejects.toThrow('STORAGE_ENCRYPTION_PATHS');
     });
     it('requires active, fully encrypted BitLocker protection', async () => {
          platform('win32'); mocks.execute.mockResolvedValue({ stdout: 'true' });
          expect(await checkEncryptedPath(directory)).toMatchObject({ encrypted: true, method: 'BitLocker' });
          expect(mocks.execute.mock.calls[0][2]).toMatchObject({ windowsHide: true, env: expect.objectContaining({ PLS_STORAGE_CHECK_PATH: await fs.realpath(directory) }) });
          mocks.execute.mockResolvedValue({ stdout: 'false' });
          await expect(assertEncryptedPaths([directory])).rejects.toThrow('could not be verified');
     });
     it('recognizes Linux encryption underneath a mounted filesystem', async () => {
          platform('linux'); mocks.execute.mockResolvedValueOnce({ stdout: '/dev/mapper/pls-data\n' }).mockResolvedValueOnce({ stdout: 'lvm\ncrypt\npart\ndisk\n' });
          expect(await checkEncryptedPath(directory)).toMatchObject({ encrypted: true, method: 'dm-crypt/LUKS' });
     });
     it('does not claim cloud or network storage is encrypted without evidence', async () => {
          platform('linux'); mocks.execute.mockResolvedValue({ stdout: 'server:/share\n' });
          expect((await checkEncryptedPath(directory)).encrypted).toBe(false);
     });
     it('fails closed on inaccessible tools or paths', async () => {
          platform('win32'); mocks.execute.mockRejectedValue(new Error('Access denied'));
          await expect(assertEncryptedPaths([directory])).rejects.toThrow('Access denied');
          await expect(checkEncryptedPath('relative-path')).rejects.toThrow('absolute');
     });
});
