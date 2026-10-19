import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { GatewayError } from './types';

const VERSION = 'v1';

/** Accepts 32 bytes as 64 hex characters or as base64. Anything else is rejected rather than silently weakened. */
export function parseCredentialKey(material: string | undefined): Buffer | null {
     const value = (material ?? '').trim();
     if (!value) return null;
     const key = /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64');
     return key.length === 32 ? key : null;
}

/**
 * AES-256-GCM for tenant merchant credentials at rest. The tenant id and provider are bound as additional
 * authenticated data, so a ciphertext copied onto another tenant's row fails to decrypt.
 */
export class CredentialCipher {
     constructor(private key: Buffer | null) { }

     static fromEnv(env: Record<string, string | undefined> = process.env) {
          return new CredentialCipher(parseCredentialKey(env.PAYMENT_CREDENTIAL_KEY));
     }

     get available() { return this.key !== null; }

     private requireKey() {
          if (!this.key) throw new GatewayError('Payment credential encryption is not configured on the server (PAYMENT_CREDENTIAL_KEY)', 503);
          return this.key;
     }

     encrypt(credentials: Record<string, string>, context: string): string {
          const iv = randomBytes(12);
          const cipher = createCipheriv('aes-256-gcm', this.requireKey(), iv);
          cipher.setAAD(Buffer.from(context));
          const body = Buffer.concat([cipher.update(JSON.stringify(credentials), 'utf8'), cipher.final()]);
          return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), body.toString('base64')].join(':');
     }

     decrypt(payload: string, context: string): Record<string, string> {
          const [version, iv, tag, body] = String(payload).split(':');
          if (version !== VERSION || !iv || !tag || !body) throw new GatewayError('Stored payment credentials are unreadable', 500);
          try {
               const decipher = createDecipheriv('aes-256-gcm', this.requireKey(), Buffer.from(iv, 'base64'));
               decipher.setAAD(Buffer.from(context));
               decipher.setAuthTag(Buffer.from(tag, 'base64'));
               const plain = Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8');
               return JSON.parse(plain);
          } catch (error) {
               if (error instanceof GatewayError) throw error;
               throw new GatewayError('Stored payment credentials could not be decrypted', 500);
          }
     }
}
