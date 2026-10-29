import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
const prefix = 'sms:enc:v1:';
function key() {
 const secret = process.env.SMS_SECRET_KEY || process.env.JWT_SECRET_KEY;
 if (!secret || secret.length < 32) throw new Error('Configure SMS_SECRET_KEY with at least 32 characters before saving SMS credentials');
 return createHash('sha256').update(secret).digest();
}
export function encryptSmsSecret(value: string): string {
 if (!value) return value;
 const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key() as any, iv as any);
 const body = Buffer.concat([cipher.update(value,'utf8'), cipher.final()] as any);
 return prefix + [iv,cipher.getAuthTag(),body].map(v=>v.toString('base64')).join('.');
}
export function decryptSmsSecret(value: string): string {
 if (!value || !value.startsWith(prefix)) return value;
 const parts = value.slice(prefix.length).split('.');
 if (parts.length !== 3) throw new Error('Stored SMS credential is malformed');
 try {
  const [iv,tag,body] = parts.map(v=>Buffer.from(v,'base64')), cipher = createDecipheriv('aes-256-gcm',key() as any,iv as any);
  cipher.setAuthTag(tag as any); return Buffer.concat([cipher.update(body as any),cipher.final()] as any).toString('utf8');
 } catch { throw new Error('Unable to decrypt SMS credentials; check SMS_SECRET_KEY'); }
}
