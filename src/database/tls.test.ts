import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { databaseTlsOptions } from './tls';

let directory: string;
beforeEach(() => {
     directory = mkdtempSync(path.join(tmpdir(), 'pls-tls-test-'));
     for (const name of ['PLS_ENCRYPTION_REQUIRED', 'DB_TLS_MODE', 'DB_TLS_CA_FILE', 'DB_TLS_CERT_FILE', 'DB_TLS_KEY_FILE',
          'SYSTEM_CONFIG_DB_TLS_MODE', 'SYSTEM_CONFIG_DB_TLS_CA_FILE', 'NODE_TLS_REJECT_UNAUTHORIZED']) vi.stubEnv(name, undefined);
     vi.stubEnv('NODE_ENV', 'test');
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); });

describe('deployment-owned database encryption policy', () => {
     it('preserves the local development connection', () => expect(databaseTlsOptions('localhost')).toEqual({}));
     it('requires verified TLS for production remote databases', () => {
          vi.stubEnv('NODE_ENV', 'production');
          expect(databaseTlsOptions('db.example').ssl).toMatchObject({ rejectUnauthorized: true, verifyIdentity: true, minVersion: 'TLSv1.2' });
          vi.stubEnv('DB_TLS_MODE', 'disabled');
          expect(() => databaseTlsOptions('db.example')).toThrow('TLS is required');
     });
     it('preserves the standalone loopback database until strict encryption is activated', () => {
          vi.stubEnv('NODE_ENV', 'production');
          expect(databaseTlsOptions('127.0.0.1')).toEqual({});
          vi.stubEnv('PLS_ENCRYPTION_REQUIRED', 'true');
          expect(databaseTlsOptions('127.0.0.1').ssl).toMatchObject({ verifyIdentity: true });
          vi.stubEnv('DB_TLS_MODE', 'disabled');
          expect(() => databaseTlsOptions('127.0.0.1')).toThrow('TLS is required');
     });
     it('inherits verification policy for the control database with a separate CA override', () => {
          const ca = path.join(directory, 'ca.pem');
          writeFileSync(ca, 'test-only-control-ca');
          vi.stubEnv('DB_TLS_MODE', 'verify-full');
          vi.stubEnv('SYSTEM_CONFIG_DB_TLS_CA_FILE', ca);
          expect(databaseTlsOptions('control', 'SYSTEM_CONFIG_DB').ssl).toMatchObject({ ca: 'test-only-control-ca', rejectUnauthorized: true });
     });
     it('fails on missing CA files, incomplete client identity and global verification bypass', () => {
          vi.stubEnv('DB_TLS_MODE', 'verify-full');
          vi.stubEnv('DB_TLS_CA_FILE', path.join(directory, 'missing'));
          expect(() => databaseTlsOptions('db')).toThrow();
          vi.stubEnv('DB_TLS_CA_FILE', undefined);
          const cert = path.join(directory, 'client.pem'); writeFileSync(cert, 'fixture');
          vi.stubEnv('DB_TLS_CERT_FILE', cert);
          expect(() => databaseTlsOptions('db')).toThrow('configured together');
          vi.stubEnv('NODE_TLS_REJECT_UNAUTHORIZED', '0');
          expect(() => databaseTlsOptions('db')).toThrow('verification must remain enabled');
     });
     it('rejects misspelled or permissive TLS modes', () => {
          vi.stubEnv('DB_TLS_MODE', 'require');
          expect(() => databaseTlsOptions('db')).toThrow('verify-full');
     });
});
