import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCipheriv, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { decryptBackupFile, encryptBackupStream } from './backupCipher';

let directory: string;
const key = randomBytes(32);
const payload = Buffer.from('Patient fixture only. Amount 125.25.\n'.repeat(10000));
beforeEach(async () => { directory = await fs.mkdtemp(path.join(tmpdir(), 'pls-cipher-test-')); });
afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });
const target = (name: string) => path.join(directory, name);
async function encrypted() {
     await encryptBackupStream(Readable.from([payload.subarray(0, 9), payload.subarray(9)]), target('backup'), key, 7, 'key-7');
     return target('backup');
}

describe('authenticated streamed backups', () => {
     it('restores byte-for-byte and stores ciphertext without the patient fixture', async () => {
          const input = await encrypted();
          expect((await fs.readFile(input)).includes(payload.subarray(0, 20))).toBe(false);
          await decryptBackupFile(input, target('restored'), key, 7, 'key-7');
          expect(await fs.readFile(target('restored'))).toEqual(payload);
     });
     it('supports an empty database dump', async () => {
          await encryptBackupStream(Readable.from([]), target('empty'), key, 7, 'key-7');
          await decryptBackupFile(target('empty'), target('restored'), key, 7, 'key-7');
          expect((await fs.stat(target('restored'))).size).toBe(0);
     });
     it.each(['tenant', 'key', 'ciphertext', 'tag', 'header', 'truncated', 'wrong-secret'])('rejects %s mismatches and removes partial plaintext', async kind => {
          const input = await encrypted();
          let bytes = await fs.readFile(input);
          if (kind === 'ciphertext') bytes[bytes.length - 20] ^= 1;
          if (kind === 'tag') bytes[bytes.length - 1] ^= 1;
          if (kind === 'header') bytes[0] ^= 1;
          if (kind === 'truncated') bytes = bytes.subarray(0, 10);
          await fs.writeFile(input, bytes);
          await expect(decryptBackupFile(input, target('restored'), kind === 'wrong-secret' ? randomBytes(32) : key,
               kind === 'tenant' ? 8 : 7, kind === 'key' ? 'key-8' : 'key-7')).rejects.toThrow();
          expect(await fs.readdir(directory)).toEqual(['backup']);
     });
     it('keeps older CBC backups readable only through the legacy-key path', async () => {
          const iv = randomBytes(16);
          const cipher = createCipheriv('aes-256-cbc', key, iv);
          await fs.writeFile(target('old'), Buffer.concat([iv, cipher.update(payload), cipher.final()]));
          await expect(decryptBackupFile(target('old'), target('blocked'), key, 7, 'old-key')).rejects.toThrow('header');
          await decryptBackupFile(target('old'), target('restored'), key, 7, 'old-key', true);
          expect(await fs.readFile(target('restored'))).toEqual(payload);
     });
     it('never overwrites an existing restore or backup', async () => {
          const input = await encrypted();
          await fs.writeFile(target('restored'), 'existing');
          await expect(decryptBackupFile(input, target('restored'), key, 7, 'key-7')).rejects.toThrow();
          await expect(encryptBackupStream(Readable.from(['new']), input, key, 7, 'key-7')).rejects.toThrow();
          expect(await fs.readFile(target('restored'), 'utf8')).toBe('existing');
          expect((await fs.readdir(directory)).sort()).toEqual(['backup', 'restored']);
     });
     it('cleans up when the dump stream fails', async () => {
          const failed = new Readable({ read() { this.destroy(new Error('fixture stream failure')); } });
          await expect(encryptBackupStream(failed, target('backup'), key, 7, 'key-7')).rejects.toThrow('fixture stream failure');
          expect(await fs.readdir(directory)).toEqual([]);
     });
});
