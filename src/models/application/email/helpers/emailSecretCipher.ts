import crypto from 'crypto';
import { ENCRYPTION_KEY } from '../../../../utils/encryptionModels';

const PREFIX = 'enc:v1:';

/** EMAIL_SECRET_KEY (recommended in production) wins; otherwise the application-wide key is used. */
function resolveKey(): Buffer {
     const configured = process.env.EMAIL_SECRET_KEY;
     if (configured && configured.length > 0) {
          return crypto.createHash('sha256').update(configured).digest();
     }
     return ENCRYPTION_KEY;
}

export function isEncryptedSecret(value: unknown): boolean {
     return typeof value === 'string' && value.startsWith(PREFIX);
}

/** AES-256-GCM. Output: enc:v1:<iv>.<tag>.<ciphertext> (base64). Already-encrypted values are returned unchanged. */
export function encryptSecret(plain: string): string {
     if (!plain || isEncryptedSecret(plain)) return plain;
     const iv = crypto.randomBytes(12);
     const cipher = crypto.createCipheriv('aes-256-gcm', resolveKey() as any, iv as any);
     const body = Buffer.concat([cipher.update(plain, 'utf8') as any, cipher.final() as any] as any);
     const tag = cipher.getAuthTag();
     return `${PREFIX}${iv.toString('base64')}.${tag.toString('base64')}.${body.toString('base64')}`;
}

/** Values without the prefix are legacy plaintext rows and are returned as-is so existing providers keep working. */
export function decryptSecret(stored: string): string {
     if (!stored || !isEncryptedSecret(stored)) return stored;
     const [iv, tag, body] = stored.slice(PREFIX.length).split('.');
     if (!iv || !tag || !body) throw new Error('Stored email secret is malformed');
     const decipher = crypto.createDecipheriv('aes-256-gcm', resolveKey() as any, Buffer.from(iv, 'base64') as any);
     decipher.setAuthTag(Buffer.from(tag, 'base64') as any);
     try {
          return Buffer.concat([decipher.update(Buffer.from(body, 'base64') as any) as any, decipher.final() as any] as any).toString('utf8');
     } catch {
          throw new Error('Unable to decrypt stored email secret; check EMAIL_SECRET_KEY');
     }
}
