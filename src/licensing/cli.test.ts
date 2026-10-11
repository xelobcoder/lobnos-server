import { afterEach, beforeEach, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const cli = path.resolve('dist/src/scripts/license.js');
const issuer = path.resolve('scripts/licensing/issuer.cjs');
let directory: string;
let environment: NodeJS.ProcessEnv;
beforeEach(async () => {
     directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pls-cli-test-'));
     environment = { ...process.env, PLS_LICENSE_MODE: 'signed',
          PLS_LICENSE_STORAGE_DIR: path.join(directory, 'state'),
          PLS_LICENSE_PUBLIC_KEY_FILE: path.join(directory, 'public.pem') };
     delete environment.PLS_LICENSE_PUBLIC_KEY;
});
afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });
function run(file: string, args: string[]) {
     return JSON.parse(execFileSync(process.execPath, [file, ...args], {
          env: environment, encoding: 'utf8', timeout: 15000, windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
     }));
}
it('compiled desktop CLI request -> out-of-band issuer -> activation -> status, without DB bootstrap', async () => {
     // These are temporary test issuer keys, outside the source tree; neither is printed or persisted after testing.
     const privateKey = path.join(directory, 'private.pem');
     run(issuer, ['keygen', '--private-key', privateKey, '--public-key', environment.PLS_LICENSE_PUBLIC_KEY_FILE!]);
     const requestFile = path.join(directory, 'request.json');
     expect(run(cli, ['request', '--tenant-id', '3', '--output', requestFile]).status).toBe('success');
     const request = JSON.parse(await fs.readFile(requestFile, 'utf8'));
     expect(request).toMatchObject({ version: 1, tenantId: 3 });
     expect(request.deviceFingerprint).toMatch(/^[a-f0-9]{64}$/);
     expect(Object.keys(request)).not.toContain('privateKey');
     expect(run(cli, ['status', '--tenant-id', '3']).result).toMatchObject({
          state: 'missing', reason: 'LICENSE_MISSING', signedValid: false, operationalValid: null,
     });
     const payloadFile = path.join(directory, 'payload.json');
     const certificateFile = path.join(directory, 'certificate.json');
     await fs.writeFile(payloadFile, JSON.stringify({
          version: 1, licenseId: 'cli-test', tenantId: 3,
          installationId: request.installationId,
          installationPublicKeyFingerprint: request.installationPublicKeyFingerprint,
          deviceFingerprint: request.deviceFingerprint,
          startsAt: new Date(Date.now() - 86400000).toISOString(),
          endsAt: new Date(Date.now() + 86400000).toISOString(), graceDays: 3,
     }));
     run(issuer, ['sign', '--private-key', privateKey, '--payload', payloadFile, '--output', certificateFile]);
     expect(run(cli, ['activate', '--file', certificateFile, '--tenant-id', '3'])).toMatchObject({
          status: 'success', result: { existingWindowValidation: 'not_checked', operationalValid: null },
     });
     expect(run(cli, ['status', '--tenant-id', '3']).result).toMatchObject({
          signedValid: true, state: 'active', licenseId: 'cli-test',
     });
     const tampered = JSON.parse(await fs.readFile(certificateFile, 'utf8'));
     tampered.payload.endsAt = '2099-01-01T00:00:00.000Z';
     await fs.writeFile(certificateFile, JSON.stringify(tampered));
     const failed = spawnSync(process.execPath, [cli, 'activate', '--file', certificateFile, '--tenant-id', '3'],
          { env: environment, encoding: 'utf8', timeout: 15000, windowsHide: true });
     expect(failed.status).toBe(1);
     expect(JSON.parse(failed.stderr)).toEqual({ status: 'error', message: 'LICENSE_SIGNATURE_INVALID' });
     expect(run(cli, ['status', '--tenant-id', '3']).result.signedValid).toBe(true);
}, 30000);
it('CLI legacy status requires no storage/key/DB; malformed args and unsafe output fail', () => {
     delete environment.PLS_LICENSE_STORAGE_DIR;
     delete environment.PLS_LICENSE_PUBLIC_KEY_FILE;
     delete environment.PLS_LICENSE_MODE;
     expect(run(cli, ['status', '--tenant-id', '3']).result).toMatchObject({ mode: 'legacy', signedValid: null });
     const bad = spawnSync(process.execPath, [cli, 'activate', '--tenant-id', '3'],
          { env: environment, encoding: 'utf8', timeout: 15000, windowsHide: true });
     expect(bad.status).toBe(1);
     expect(JSON.parse(bad.stderr).message).toBe('LICENSE_CLI_ARGUMENTS_INVALID');
     environment.PLS_LICENSE_STORAGE_DIR = path.join(directory, 'state');
     const unsafe = spawnSync(process.execPath, [cli, 'request', '--tenant-id', '3', '--output',
          path.join(environment.PLS_LICENSE_STORAGE_DIR, 'license.lock')],
          { env: environment, encoding: 'utf8', timeout: 15000, windowsHide: true });
     expect(unsafe.status).toBe(1);
     expect(JSON.parse(unsafe.stderr).message).toBe('LICENSE_CLI_OUTPUT_IN_STORAGE');
}, 15000);
