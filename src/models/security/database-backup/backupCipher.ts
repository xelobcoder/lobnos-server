import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const MAGIC = Buffer.from('PLSBK002');
const TAG_BYTES = 16;

async function publish(partial: string, output: string): Promise<void> {
     // Exclusive publication prevents concurrent requests from overwriting a completed backup.
     await fs.link(partial, output);
     await fs.unlink(partial);
}

export async function encryptBackupStream(input: Readable, output: string, key: Buffer, tenantId: number, keyId: string): Promise<void> {
     const partial = `${output}.${randomUUID()}.partial`;
     try {
          const iv = randomBytes(12);
          const metadata = Buffer.from(JSON.stringify({ version: 2, tenantId, keyId, iv: iv.toString('base64') }));
          const length = Buffer.alloc(4);
          length.writeUInt32BE(metadata.length);
          const header = Buffer.concat([MAGIC, length, metadata]);
          const cipher = createCipheriv('aes-256-gcm', key, iv);
          cipher.setAAD(header);
          const destination = createWriteStream(partial, { flags: 'wx', mode: 0o600 });
          destination.write(header);
          await pipeline(input, cipher, destination);
          await fs.appendFile(partial, cipher.getAuthTag());
          await publish(partial, output);
     } catch (error) {
          input.destroy();
          await fs.unlink(partial).catch(() => undefined);
          throw error;
     }
}

/** Legacy CBC remains readable. New backups authenticate both ciphertext and tenant metadata. */
export async function decryptBackupFile(input: string, output: string, key: Buffer, tenantId: number, keyId: string, allowLegacy = false): Promise<void> {
     const partial = `${output}.${randomUUID()}.partial`;
     const file = await fs.open(input, 'r');
     try {
          const { size } = await file.stat();
          const prefix = Buffer.alloc(16);
          await file.read(prefix, 0, prefix.length, 0);
          let decipher: ReturnType<typeof createDecipheriv>;
          let start: number;
          let end = size - 1;
          if (prefix.subarray(0, MAGIC.length).equals(MAGIC)) {
               const length = prefix.readUInt32BE(MAGIC.length);
               if (length < 1 || length > 4096 || size < 12 + length + TAG_BYTES) throw new Error('Invalid encrypted backup header');
               const header = Buffer.alloc(12 + length);
               await file.read(header, 0, header.length, 0);
               const metadata = JSON.parse(header.subarray(12).toString('utf8'));
               if (metadata.version !== 2 || metadata.tenantId !== tenantId || metadata.keyId !== keyId) {
                    throw new Error('Encrypted backup does not belong to this tenant and key');
               }
               const iv = Buffer.from(metadata.iv, 'base64');
               if (iv.length !== 12) throw new Error('Invalid encrypted backup IV');
               const tag = Buffer.alloc(TAG_BYTES);
               await file.read(tag, 0, TAG_BYTES, size - TAG_BYTES);
               const authenticated = createDecipheriv('aes-256-gcm', key, iv);
               authenticated.setAAD(header);
               authenticated.setAuthTag(tag);
               decipher = authenticated;
               start = header.length;
               end = size - TAG_BYTES - 1;
          } else {
               if (!allowLegacy) throw new Error('Authenticated backup header is missing');
               if (size < 32 || size % 16 !== 0) throw new Error('Invalid legacy encrypted backup');
               decipher = createDecipheriv('aes-256-cbc', key, prefix);
               start = 16;
          }
          const source = end < start ? Readable.from([]) : createReadStream(input, { start, end });
          await pipeline(source, decipher, createWriteStream(partial, { flags: 'wx', mode: 0o600 }));
          await publish(partial, output);
     } catch (error) {
          await fs.unlink(partial).catch(() => undefined);
          throw error;
     } finally {
          await file.close();
     }
}
