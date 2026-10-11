import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateKeyPairSync, sign } from 'crypto';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { canonicalPayload, certificatePeriod, keyFingerprint, LicensePayload, parseCertificate, publicKey, verifyCertificate } from './certificate';
import { issuerPublicKey, LicenseStorage, storageDirectory } from './storage';
import { OfflineLicenseService } from './service';

const issuer = generateKeyPairSync('ed25519');
const issuerPem = issuer.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const deviceA = 'a'.repeat(64), deviceB = 'b'.repeat(64);
const now = Date.parse('2026-10-11T10:00:00.000Z');
let directory: string, service: OfflineLicenseService, request: Awaited<ReturnType<OfflineLicenseService['request']>>;
const env = { ...process.env };
function certificate(overrides: Partial<LicensePayload> = {}) {
     const payload: LicensePayload = {
          version: 1, licenseId: 'test-license', tenantId: 3,
          installationId: request.installationId,
          installationPublicKeyFingerprint: request.installationPublicKeyFingerprint,
          deviceFingerprint: request.deviceFingerprint,
          startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-10-12T00:00:00.000Z', graceDays: 3,
          features: ['results'], ...overrides,
     };
     return { payload, signature: sign(null, canonicalPayload(payload), issuer.privateKey).toString('base64') };
}
beforeEach(async () => {
     process.env.PLS_LICENSE_MODE = 'signed';
     directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pls-license-test-'));
     service = new OfflineLicenseService(new LicenseStorage(directory, () => deviceA), () => now, () => issuerPem);
     request = await service.request(3);
});
afterEach(async () => {
     process.env = { ...env };
     await fs.rm(directory, { recursive: true, force: true });
});
describe('offline certificate', () => {
     it('activates and verifies a valid certificate; identity stays stable', async () => {
          await service.activate(certificate(), 3);
          expect(await service.status(3)).toMatchObject({ signedValid: true, state: 'active', licenseId: 'test-license' });
          expect(await service.request(3)).toEqual(request);
          expect(await service.status(4)).toMatchObject({ signedValid: false, reason: 'LICENSE_MISSING' });
     });
     it('rejects tampering before writing and preserves the active certificate', async () => {
          await service.activate(certificate(), 3);
          const changed = certificate();
          changed.payload.endsAt = '2030-10-12T00:00:00.000Z';
          await expect(service.activate(changed, 3)).rejects.toMatchObject({ code: 'LICENSE_SIGNATURE_INVALID' });
          expect((await service.status(3)).endsAt).toBe('2026-10-12T00:00:00.000Z');
     });
     it.each([
          [{ installationId: 'f'.repeat(32) }, 'LICENSE_INSTALLATION_MISMATCH'],
          [{ installationPublicKeyFingerprint: 'f'.repeat(64) }, 'LICENSE_INSTALLATION_MISMATCH'],
          [{ tenantId: 4 }, 'LICENSE_TENANT_MISMATCH'],
          [{ deviceFingerprint: deviceB }, 'LICENSE_DEVICE_MISMATCH'],
     ])('rejects wrong binding %j', async (overrides, code) => {
          await expect(service.activate(certificate(overrides as Partial<LicensePayload>), 3)).rejects.toMatchObject({ code });
     });
     it('rejects a cloned identity on a different machine', async () => {
          await service.activate(certificate(), 3);
          const cloneDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pls-license-clone-'));
          try {
               await fs.copyFile(path.join(directory, 'license-state.json'), path.join(cloneDir, 'license-state.json'));
               const clone = new OfflineLicenseService(new LicenseStorage(cloneDir, () => deviceB), () => now, () => issuerPem);
               expect(await clone.status(3)).toMatchObject({ signedValid: false, reason: 'LICENSE_DEVICE_MISMATCH' });
               await expect(clone.request(3)).rejects.toMatchObject({ code: 'LICENSE_DEVICE_MISMATCH' });
          } finally { await fs.rm(cloneDir, { recursive: true, force: true }); }
     });
     it('has inclusive end/grace boundaries and rejects expired activation', async () => {
          const p = certificate().payload;
          expect(certificatePeriod(p, Date.parse(p.endsAt))).toBe('active');
          expect(certificatePeriod(p, Date.parse(p.endsAt) + 1)).toBe('grace');
          expect(certificatePeriod(p, Date.parse(p.endsAt) + 3 * 86400000)).toBe('grace');
          expect(certificatePeriod(p, Date.parse(p.endsAt) + 3 * 86400000 + 1)).toBe('expired');
          expect(certificatePeriod(p, Date.parse(p.startsAt) - 1)).toBe('not_started');
          await expect(service.activate(certificate({ endsAt: '2026-10-02T00:00:00.000Z' }), 3)).rejects.toMatchObject({ code: 'LICENSE_EXPIRED' });
     });
     it.each([
          { graceDays: -1 }, { graceDays: 366 }, { graceDays: 1.5 }, { tenantId: '3' },
          { startsAt: '2026-02-30T00:00:00.000Z' }, { endsAt: '2026-01-01' },
          { startsAt: '2027-01-01T00:00:00.000Z' }, { features: ['results', 'results'] },
          { features: [5] }, { version: 2 }, { extra: true }, { licenseId: '../license' },
     ])('rejects invalid payload %j', overrides => {
          const cert = certificate();
          Object.assign(cert.payload, overrides);
          expect(() => parseCertificate(cert)).toThrow();
     });
     it('rejects envelopes, signature encodings, non-Ed25519/private/malformed/wrong public keys', () => {
          for (const bad of [null, [], {}, { ...certificate(), extra: true }, { ...certificate(), signature: 'bad' }]) {
               expect(() => parseCertificate(bad)).toThrow();
          }
          expect(() => publicKey('invalid')).toThrow();
          expect(() => publicKey(issuer.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString())).toThrow();
          const rsa = generateKeyPairSync('rsa', { modulusLength: 1024 });
          expect(() => publicKey(rsa.publicKey.export({ type: 'spki', format: 'pem' }).toString())).toThrow();
          const other = generateKeyPairSync('ed25519');
          expect(() => verifyCertificate(certificate(), other.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
               { version: 1, installationId: request.installationId, publicKey: request.installationPublicKey, deviceFingerprint: deviceA }, 3)).toThrow('LICENSE_SIGNATURE_INVALID');
          expect(keyFingerprint(issuerPem)).toMatch(/^[a-f0-9]{64}$/);
     });
     it('detects clock rollback and renewal does not erase the observation', async () => {
          await service.activate(certificate(), 3);
          const older = new OfflineLicenseService(new LicenseStorage(directory, () => deviceA), () => now - 300001, () => issuerPem);
          expect(await older.status(3)).toMatchObject({ reason: 'LICENSE_CLOCK_ROLLBACK' });
          await expect(older.activate(certificate(), 3)).rejects.toMatchObject({ code: 'LICENSE_CLOCK_ROLLBACK' });
     });
     it('reports corrupted state rather than silently recreating identity', async () => {
          await fs.writeFile(path.join(directory, 'license-state.json'), '{broken');
          expect(await service.status(3)).toMatchObject({ state: 'invalid', signedValid: false, reason: 'LICENSE_STATE_INVALID' });
          await expect(service.request(3)).rejects.toMatchObject({ code: 'LICENSE_STATE_INVALID' });
     });
     it('serializes concurrent activations and preserves both tenant certificates', async () => {
          await Promise.all([
               service.activate(certificate(), 3),
               service.activate(certificate({ tenantId: 4 }), 4),
          ]);
          expect((await service.status(3)).signedValid).toBe(true);
          expect((await service.status(4)).signedValid).toBe(true);
     });
     it('enforces external absolute storage and exactly one usable public-key source', async () => {
          delete process.env.PLS_LICENSE_STORAGE_DIR;
          expect(() => storageDirectory()).toThrow('LICENSE_STORAGE_DIR_REQUIRED');
          process.env.PLS_LICENSE_STORAGE_DIR = 'relative';
          expect(() => storageDirectory()).toThrow('LICENSE_STORAGE_DIR_REQUIRED');
          process.env.PLS_LICENSE_STORAGE_DIR = path.resolve('src');
          expect(() => storageDirectory()).toThrow('LICENSE_STORAGE_INSIDE_RUNTIME');
          delete process.env.PLS_LICENSE_PUBLIC_KEY;
          delete process.env.PLS_LICENSE_PUBLIC_KEY_FILE;
          expect(() => issuerPublicKey()).toThrow('LICENSE_PUBLIC_KEY_REQUIRED');
          process.env.PLS_LICENSE_PUBLIC_KEY = issuerPem;
          expect(issuerPublicKey()).toBe(issuerPem);
          process.env.PLS_LICENSE_PUBLIC_KEY_FILE = path.join(directory, 'public.pem');
          expect(() => issuerPublicKey()).toThrow('LICENSE_PUBLIC_KEY_REQUIRED');
          delete process.env.PLS_LICENSE_PUBLIC_KEY;
          expect(() => issuerPublicKey()).toThrow('LICENSE_PUBLIC_KEY_INVALID');
          await fs.writeFile(process.env.PLS_LICENSE_PUBLIC_KEY_FILE, issuerPem);
          expect(issuerPublicKey()).toBe(issuerPem);
          const noKey = new OfflineLicenseService(new LicenseStorage(directory, () => deviceA), () => now, () => 'broken');
          expect(await noKey.status(3)).toMatchObject({ state: 'invalid', reason: 'LICENSE_PUBLIC_KEY_INVALID' });
     });
     it('defaults to legacy without touching licensing files or keys', async () => {
          delete process.env.PLS_LICENSE_MODE;
          const badStore = new LicenseStorage(path.join(directory, 'unused'), () => { throw new Error('must not run'); });
          expect(await new OfflineLicenseService(badStore).status(3)).toEqual({ mode: 'legacy', state: 'legacy', signedValid: null });
          await expect(fs.stat(path.join(directory, 'unused'))).rejects.toMatchObject({ code: 'ENOENT' });
          process.env.PLS_LICENSE_MODE = 'typo';
          await expect(service.status(3)).rejects.toMatchObject({ code: 'LICENSE_MODE_INVALID' });
     });
     it.each(['3junk', 0, -1, 1.5, [], null, '03'])('rejects invalid tenant %j', async id => {
          await expect(service.status(id as number)).rejects.toMatchObject({ code: 'LICENSE_INVALID_TENANT' });
     });
});
