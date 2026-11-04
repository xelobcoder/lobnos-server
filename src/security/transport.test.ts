import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { Server } from 'node:http';
import { get } from 'node:https';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { configureTransport, applicationServer } from './transport';

const servers: Server[] = [];
afterEach(async () => {
     vi.unstubAllEnvs();
     await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});
async function workspace() {
     const app = express();
     configureTransport(app);
     app.post('/billing', express.json(), (req, res) => res.json({ tenant: req.body.tenant, amount: req.body.amount }));
     const server = applicationServer(app);
     servers.push(server);
     await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
     return `http://127.0.0.1:${(server.address() as any).port}/billing`;
}
const request = (url: string, headers = {}) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ tenant: 7, amount: 125.25 }) });

describe('HTTPS boundary', () => {
     it('preserves existing development requests while enforcement is staged', async () => {
          vi.stubEnv('HTTPS_REQUIRED', 'false'); vi.stubEnv('PLS_ENCRYPTION_REQUIRED', 'false'); vi.stubEnv('HTTPS_ENABLED', 'false');
          const response = await request(await workspace());
          expect(await response.json()).toEqual({ tenant: 7, amount: 125.25 });
     });
     it('rejects insecure submission without redirecting or processing its body', async () => {
          vi.stubEnv('HTTPS_REQUIRED', 'true'); vi.stubEnv('HTTPS_ALLOW_LOOPBACK_HTTP', 'false'); vi.stubEnv('PLS_DESKTOP_STANDALONE', 'false');
          const response = await request(await workspace());
          expect(response.status).toBe(426);
          expect(response.headers.get('location')).toBeNull();
          expect((await response.json()).code).toBe('HTTPS_REQUIRED');
     });
     it('accepts HTTPS forwarded by an explicitly trusted local proxy', async () => {
          vi.stubEnv('HTTPS_REQUIRED', 'true'); vi.stubEnv('HTTPS_TRUSTED_PROXIES', 'loopback');
          const response = await request(await workspace(), { 'X-Forwarded-Proto': 'https' });
          expect(response.status).toBe(200);
          expect(response.headers.get('strict-transport-security')).toContain('max-age=');
     });
     it('rejects a forged forwarded header from an untrusted peer', async () => {
          vi.stubEnv('HTTPS_REQUIRED', 'true'); vi.stubEnv('HTTPS_TRUSTED_PROXIES', '192.0.2.1');
          const response = await request(await workspace(), { 'X-Forwarded-Proto': 'https' });
          expect(response.status).toBe(426);
     });
     it('permits an opted-in local desktop request but rejects forwarded HTTP', async () => {
          vi.stubEnv('HTTPS_REQUIRED', 'true'); vi.stubEnv('HTTPS_ALLOW_LOOPBACK_HTTP', 'true');
          const url = await workspace();
          expect((await request(url)).status).toBe(200);
          expect((await request(url, { 'X-Forwarded-Proto': 'http' })).status).toBe(426);
     });
     it('fails immediately for missing native HTTPS certificates or broad proxy trust', () => {
          vi.stubEnv('HTTPS_ENABLED', 'true'); vi.stubEnv('SSL_CERT_PATH', undefined); vi.stubEnv('SSL_KEY_PATH', undefined);
          expect(() => applicationServer(express())).toThrow('SSL_CERT_PATH');
          vi.stubEnv('HTTPS_TRUSTED_PROXIES', 'true');
          expect(() => configureTransport(express())).toThrow('proxy addresses');
     });
     it('serves native HTTPS with a real certificate and rejects an untrusted certificate', async () => {
          const directory = mkdtempSync(path.join(tmpdir(), 'pls-https-certificate-test-'));
          try {
               const cert = path.join(directory, 'cert.pem');
               const key = path.join(directory, 'key.pem');
               const openssl = process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl';
               execFileSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost',
                    '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1', '-keyout', key, '-out', cert], { windowsHide: true, stdio: 'ignore', timeout: 15000 });
               vi.stubEnv('HTTPS_ENABLED', 'true'); vi.stubEnv('HTTPS_REQUIRED', 'true');
               vi.stubEnv('SSL_CERT_PATH', cert); vi.stubEnv('SSL_KEY_PATH', key);
               const app = express(); configureTransport(app); app.get('/', (_req, res) => res.json({ status: 'healthy' }));
               const server = applicationServer(app); servers.push(server);
               await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
               const url = `https://127.0.0.1:${(server.address() as any).port}/`;
               const response = await new Promise<any>((resolve, reject) => get(url, { ca: readFileSync(cert) }, result => {
                    result.resume(); result.on('end', () => resolve(result));
               }).on('error', reject));
               expect(response.statusCode).toBe(200);
               expect(response.headers['strict-transport-security']).toContain('max-age=');
               await expect(new Promise((resolve, reject) => get(url, result => { result.resume(); resolve(result); }).on('error', reject))).rejects.toThrow();
          } finally {
               rmSync(directory, { recursive: true, force: true });
          }
     });
});
