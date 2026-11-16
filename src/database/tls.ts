import { readFileSync } from 'node:fs';
import { SslOptions } from 'mysql2';

/** Deployment-owned policy only. Tenant records cannot weaken certificate verification. */
export function databaseTlsOptions(host: string, scope: 'DB' | 'SYSTEM_CONFIG_DB' | 'BACKUP_RESTORE_DB' = 'DB'): { ssl?: SslOptions } {
     const setting = (suffix: string) => process.env[`${scope}_TLS_${suffix}`] ?? process.env[`DB_TLS_${suffix}`];
     const required = process.env.PLS_ENCRYPTION_REQUIRED === 'true';
     const loopback = ['localhost', '127.0.0.1', '::1'].includes(host?.toLowerCase());
     const defaultMode = required || (process.env.NODE_ENV === 'production' && !loopback) ? 'verify-full' : 'disabled';
     const mode = setting('MODE') || defaultMode;
     if (!['disabled', 'verify-full'].includes(mode)) throw new Error(`${scope}_TLS_MODE must be disabled or verify-full`);
     if (mode === 'disabled') {
          if (required || (process.env.NODE_ENV === 'production' && !loopback)) {
               throw new Error('Database TLS is required for this connection');
          }
          return {};
     }
     if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('Global TLS certificate verification must remain enabled');
     const read = (suffix: string) => setting(suffix) ? readFileSync(setting(suffix)!, 'utf8') : undefined;
     const cert = read('CERT_FILE');
     const key = read('KEY_FILE');
     if (Boolean(cert) !== Boolean(key)) throw new Error('Database TLS client certificate and key must be configured together');
     return { ssl: { ca: read('CA_FILE'), cert, key, rejectUnauthorized: true, verifyIdentity: true, minVersion: 'TLSv1.2' } };
}
